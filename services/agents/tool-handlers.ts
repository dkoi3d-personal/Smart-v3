/**
 * Tool Handler Registry
 *
 * Replaces the giant switch statement in executeTool with O(1) handler lookups.
 * Each tool handler is a function that takes context and returns a result string.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import * as lockfile from 'proper-lockfile';
import writeFileAtomic from 'write-file-atomic';
import {
  normalizePathForGlob,
  execCommandSafe,
} from '@/lib/cross-platform';
import { scaffoldProject, needsScaffolding } from '@/services/project-scaffold-service';

import type { AgentRole, MultiAgentSession, Task, Epic, AgentConfig } from './types';

// Message type for agent messages
type AgentMessageType = 'thinking' | 'action' | 'result' | 'chat' | 'error';

// Tool handler context passed to each handler
export interface ToolContext {
  role: AgentRole;
  toolInput: Record<string, any>;
  session: MultiAgentSession;
  config: AgentConfig;
  // Callbacks for emitting events
  emit: (event: string, data: any) => void;
  emitAgentMessage: (message: { agentRole: AgentRole; agentName: string; type: AgentMessageType; content: string }) => void;
  // Helpers
  generateId: () => string;
  persistStoriesToFile: () => Promise<void>;
}

// Tool handler function signature
export type ToolHandler = (ctx: ToolContext) => Promise<string>;

// Registry of all tool handlers
const toolHandlers = new Map<string, ToolHandler>();

// Register a tool handler
export function registerTool(name: string, handler: ToolHandler): void {
  toolHandlers.set(name, handler);
}

// Get a tool handler by name
export function getToolHandler(name: string): ToolHandler | undefined {
  return toolHandlers.get(name);
}

// Execute a tool using the registry
export async function executeToolFromRegistry(
  toolName: string,
  ctx: ToolContext
): Promise<string> {
  const handler = toolHandlers.get(toolName);
  if (!handler) {
    return `Unknown tool: ${toolName}`;
  }
  try {
    return await handler(ctx);
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// =============================================================================
// File Tools
// =============================================================================

registerTool('write_file', async (ctx) => {
  const { path: filePath, content } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
  const agentId = ctx.toolInput._agentId || ctx.role;

  // Check if file is locked by another agent
  const existingLock = ctx.session.fileLocks.get(filePath);
  if (existingLock && existingLock !== agentId) {
    return `⚠️ FILE LOCKED: ${filePath} is being edited by ${existingLock}. Choose a different file or wait.`;
  }

  await fs.mkdir(path.dirname(absolutePath), { recursive: true });

  // Acquire proper-lockfile lock for atomic write
  let release: (() => Promise<void>) | null = null;
  try {
    // Create file if it doesn't exist (lockfile requires it)
    try {
      await fs.access(absolutePath);
    } catch {
      await fs.writeFile(absolutePath, '');
    }

    release = await lockfile.lock(absolutePath, {
      stale: 30000,
      retries: 3,
      realpath: false,
    });

    // Track lock in session
    ctx.session.fileLocks.set(filePath, agentId);

    // Use atomic write
    await writeFileAtomic(absolutePath, content);

    console.log('[ToolHandlers] Atomic write to:', filePath, 'by', agentId);
    ctx.emit('file:changed', { path: filePath, action: 'write', agent: ctx.role, content });
    return `Successfully wrote ${content.length} bytes to ${filePath}`;
  } catch (err: any) {
    if (err.code === 'ELOCKED') {
      return `⚠️ FILE LOCKED: ${filePath} is being written by another process. Try again shortly.`;
    }
    throw err;
  } finally {
    if (release) {
      try { await release(); } catch { /* ignore */ }
    }
  }
});

registerTool('read_file', async (ctx) => {
  const { path: filePath } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
  return await fs.readFile(absolutePath, 'utf-8');
});

registerTool('edit_file', async (ctx) => {
  const { path: filePath, old_content, new_content } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(baseDir, filePath);
  const agentId = ctx.toolInput._agentId || ctx.role;

  // Check if file is locked by another agent
  const existingLock = ctx.session.fileLocks.get(filePath);
  if (existingLock && existingLock !== agentId) {
    return `⚠️ FILE LOCKED: ${filePath} is being edited by ${existingLock}. Choose a different file or wait.`;
  }

  // Acquire proper-lockfile lock for atomic edit
  let release: (() => Promise<void>) | null = null;
  try {
    release = await lockfile.lock(absolutePath, {
      stale: 30000,
      retries: 3,
      realpath: false,
    });

    // Track lock in session
    ctx.session.fileLocks.set(filePath, agentId);

    let content = await fs.readFile(absolutePath, 'utf-8');
    if (!content.includes(old_content)) {
      return `Error: Could not find content to replace in ${filePath}`;
    }
    content = content.replace(old_content, new_content);

    // Use atomic write
    await writeFileAtomic(absolutePath, content);

    console.log('[ToolHandlers] Atomic edit to:', filePath, 'by', agentId);
    ctx.emit('file:changed', { path: filePath, action: 'edit', agent: ctx.role, content });
    return `Successfully edited ${filePath}`;
  } catch (err: any) {
    if (err.code === 'ELOCKED') {
      return `⚠️ FILE LOCKED: ${filePath} is being edited by another process. Try again shortly.`;
    }
    throw err;
  } finally {
    if (release) {
      try { await release(); } catch { /* ignore */ }
    }
  }
});

registerTool('list_files', async (ctx) => {
  const { pattern } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;
  const normalizedDir = normalizePathForGlob(baseDir);
  const files = await glob(pattern, { cwd: normalizedDir, nodir: true });
  return files.join('\n') || 'No files found matching pattern';
});

// =============================================================================
// Project Tools
// =============================================================================

registerTool('scaffold_project', async (ctx) => {
  const { project_name } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;

  // Check if already scaffolded
  const needs = await needsScaffolding(baseDir);
  if (!needs) {
    return 'Project already has package.json - scaffold not needed. Skip to implementing features!';
  }

  ctx.emit('command:start', { command: 'scaffold_project', agent: ctx.role });

  try {
    const result = await scaffoldProject({
      projectDir: baseDir,
      projectName: project_name || ctx.session.projectId,
      includeTests: true,
      useSymlinks: false,
    });

    ctx.emit('command:complete', {
      command: 'scaffold_project',
      output: result.message,
      agent: ctx.role,
      exitCode: result.success ? 0 : 1,
    });

    return result.success
      ? `${result.message}\n\nProject scaffolded! Now implement features - DON'T run npm install or create-next-app.`
      : `Scaffold failed: ${result.message}`;
  } catch (error) {
    ctx.emit('command:complete', {
      command: 'scaffold_project',
      output: error instanceof Error ? error.message : 'Unknown error',
      agent: ctx.role,
      exitCode: 1,
    });
    return `Scaffold error: ${error instanceof Error ? error.message : 'Unknown'}`;
  }
});

registerTool('run_command', async (ctx) => {
  const { command } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;

  // 🚫 BLOCK: Coders should NOT run builds - testers handle that!
  // This prevents parallel build conflicts that corrupt .next/ directory
  if (ctx.role === 'coder' && (
    command.includes('npm run build') ||
    command.includes('next build') ||
    command.match(/npm\s+run\s+build/)
  )) {
    console.log(`[ToolHandlers] BLOCKED: Coder tried to run build command: ${command}`);
    return `🚫 BUILD BLOCKED: Coders should NOT run "npm run build"!

WHY: Multiple coders running builds simultaneously corrupts the .next/ directory.

INSTEAD, use FAST type checking (catches the same errors in 5 seconds):
  ./node_modules/.bin/tsc --noEmit

Then mark your story as "testing" - the Tester agent will run the build.

This is 10x faster and prevents build conflicts!`;
  }

  // Auto-intercept create-next-app and use fast scaffold instead
  if (command.includes('create-next-app') || command.includes('npx create-next')) {
    console.log('[ToolHandlers] Intercepting create-next-app, using fast scaffold instead');
    ctx.emit('command:start', { command: 'scaffold_project (auto-redirected)', agent: ctx.role });
    try {
      const needs = await needsScaffolding(baseDir);
      if (!needs) {
        ctx.emit('command:complete', { command: 'scaffold_project', output: 'Already scaffolded', agent: ctx.role, exitCode: 0 });
        return 'Project already has package.json - setup complete!';
      }
      const result = await scaffoldProject({
        projectDir: baseDir,
        projectName: ctx.session.projectId,
        includeTests: true,
        useSymlinks: false,
      });
      ctx.session.commandLogs.push({
        command: 'scaffold_project (auto-redirected from create-next-app)',
        output: result.message,
        exitCode: result.success ? 0 : 1,
        timestamp: new Date(),
        agent: ctx.role,
      });
      ctx.emit('command:complete', { command: 'scaffold_project', output: result.message, agent: ctx.role, exitCode: result.success ? 0 : 1 });
      return result.success
        ? `Project scaffolded in ${result.duration.toFixed(1)}s (fast scaffold used instead of create-next-app)`
        : `Scaffold failed: ${result.message}`;
    } catch (err: any) {
      return `Scaffold error: ${err.message}`;
    }
  }

  ctx.emit('command:start', { command, agent: ctx.role });

  try {
    const result = execCommandSafe(command, { cwd: baseDir, timeout: 120000 });
    const output = result.output || 'Command completed (no output)';
    const exitCode = result.success ? 0 : 1;

    // Log command execution
    ctx.session.commandLogs.push({
      command,
      output: result.output || '',
      error: result.error || undefined,
      exitCode,
      timestamp: new Date(),
      agent: ctx.role,
    });

    ctx.emit('command:complete', {
      command,
      output,
      agent: ctx.role,
      exitCode,
    });

    return output.slice(0, 10000); // Truncate long output
  } catch (error: any) {
    const errorMsg = error.message || 'Command failed';

    ctx.session.commandLogs.push({
      command,
      output: '',
      error: errorMsg,
      exitCode: 1,
      timestamp: new Date(),
      agent: ctx.role,
    });

    ctx.emit('command:complete', {
      command,
      output: errorMsg,
      agent: ctx.role,
      exitCode: 1,
    });

    return `Error: ${errorMsg.slice(0, 5000)}`;
  }
});

// =============================================================================
// Communication Tools
// =============================================================================

registerTool('send_message', async (ctx) => {
  const { message, to } = ctx.toolInput;
  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'chat',
    content: `[To: ${to}] ${message}`,
  });
  return 'Message sent';
});

// =============================================================================
// Task Management Tools
// =============================================================================

registerTool('create_task', async (ctx) => {
  const { title, description, assigned_to } = ctx.toolInput;
  const task: Task = {
    id: `task-${ctx.generateId()}`,
    title,
    description,
    status: 'pending',
    assignedTo: assigned_to,
  };
  ctx.session.tasks.push(task);
  ctx.emit('task:created', task);
  return `Created task ${task.id}: "${title}" assigned to ${assigned_to}`;
});

registerTool('complete_task', async (ctx) => {
  const { task_id, result } = ctx.toolInput;
  const task = ctx.session.tasks.find(t => t.id === task_id);
  if (task) {
    task.status = 'done';
    task.result = result;
    task.workingAgent = null;
    ctx.emit('task:updated', task);
    await ctx.persistStoriesToFile();
    return `Task ${task_id} completed: ${result}`;
  }
  return `Task ${task_id} not found`;
});

registerTool('list_tasks', async (ctx) => {
  const tasks = ctx.session.tasks;
  if (tasks.length === 0) {
    return 'No tasks in backlog.';
  }

  const grouped = {
    backlog: tasks.filter(t => t.status === 'backlog' || t.status === 'pending'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    testing: tasks.filter(t => t.status === 'testing'),
    done: tasks.filter(t => t.status === 'done' || t.status === 'completed'),
    failed: tasks.filter(t => t.status === 'failed'),
  };

  let output = '=== TASK STATUS ===\n\n';
  for (const [status, taskList] of Object.entries(grouped)) {
    if (taskList.length > 0) {
      output += `${status.toUpperCase()} (${taskList.length}):\n`;
      for (const t of taskList) {
        output += `  - [${t.id}] ${t.title}${t.assignedTo ? ` (${t.assignedTo})` : ''}\n`;
      }
      output += '\n';
    }
  }
  return output;
});

registerTool('start_story', async (ctx) => {
  const { task_id } = ctx.toolInput;
  const agentId = ctx.toolInput._agentId || ctx.role;
  const task = ctx.session.tasks.find(t => t.id === task_id);

  if (!task) {
    return `Story ${task_id} not found`;
  }

  if (task.status === 'in_progress' && task.workingAgent && task.workingAgent !== agentId) {
    return `Story ${task_id} is already being worked on by ${task.workingAgent}`;
  }

  task.status = 'in_progress';
  task.assignedTo = 'coder';
  task.workingAgent = agentId;
  ctx.emit('task:updated', task);
  await ctx.persistStoriesToFile();

  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'chat',
    content: `📋 Started story: "${task.title}" (${task_id})`,
  });

  return `Started story ${task_id}. Now implement it and call mark_ready_for_testing when done.`;
});

registerTool('mark_ready_for_testing', async (ctx) => {
  const { task_id } = ctx.toolInput;
  const task = ctx.session.tasks.find(t => t.id === task_id);

  if (!task) {
    return `Story ${task_id} not found`;
  }

  task.status = 'testing';
  task.workingAgent = null;
  ctx.emit('task:updated', task);
  ctx.emit('story:ready_for_testing', { storyId: task_id, title: task.title });
  await ctx.persistStoriesToFile();

  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'result',
    content: `✅ Story "${task.title}" (${task_id}) marked ready for testing`,
  });

  return `Story ${task_id} moved to testing. Tester will pick it up.`;
});

registerTool('delegate_work', async (ctx) => {
  const { agents } = ctx.toolInput;
  ctx.emit('delegate', { agents });
  return `Delegated work to: ${agents.join(', ')}`;
});

registerTool('create_epic', async (ctx) => {
  const { title, description, priority = 'medium' } = ctx.toolInput;
  const epic: Epic = {
    id: `epic-${ctx.generateId()}`,
    projectId: ctx.session.projectId,
    title,
    description,
    priority: priority as 'high' | 'medium' | 'low',
    status: 'pending',
    stories: [],
    createdAt: new Date(),
  };
  ctx.session.epics.push(epic);
  await ctx.persistStoriesToFile();
  ctx.emit('epic:created', epic);
  return `Created epic ${epic.id}: "${title}"`;
});

registerTool('create_story', async (ctx) => {
  const { epic_id, title, description, acceptance_criteria = [], priority = 'medium', story_points = 3 } = ctx.toolInput;
  const storyId = `story-${ctx.generateId()}`;
  const task: Task = {
    id: storyId,
    title,
    description,
    status: 'backlog',
    assignedTo: undefined,
    epicId: epic_id,
    storyPoints: story_points,
    priority: priority as 'high' | 'medium' | 'low',
    acceptanceCriteria: acceptance_criteria,
  };
  ctx.session.tasks.push(task);

  const parentEpic = ctx.session.epics.find(e => e.id === epic_id);
  if (parentEpic) {
    parentEpic.stories.push(storyId);
  }

  await ctx.persistStoriesToFile();
  ctx.emit('task:created', task);
  return `Created story ${storyId}: "${title}" (${story_points} points)`;
});

// =============================================================================
// Testing Tools
// =============================================================================

registerTool('start_testing', async (ctx) => {
  const { task_id } = ctx.toolInput;
  const testerId = ctx.toolInput._agentId || 'tester';
  const task = ctx.session.tasks.find(t => t.id === task_id);

  if (!task) {
    return `Story ${task_id} not found`;
  }

  if (task.status !== 'testing') {
    return `Story ${task_id} is not ready for testing (status: ${task.status})`;
  }

  if (task.workingAgent && task.workingAgent !== testerId) {
    return `Story ${task_id} is already being tested by ${task.workingAgent}`;
  }

  task.workingAgent = testerId;
  ctx.emit('task:updated', task);
  await ctx.persistStoriesToFile();

  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'chat',
    content: `🧪 Started testing: "${task.title}" (${task_id})`,
  });

  return `Started testing ${task_id}. Write tests and report results.`;
});

registerTool('run_tests', async (ctx) => {
  const { test_command = 'npm test', test_file } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;
  const command = test_file ? `${test_command} -- ${test_file}` : test_command;

  ctx.emit('command:start', { command, agent: ctx.role });

  try {
    const result = execCommandSafe(command, { cwd: baseDir, timeout: 180000 });
    const output = result.output || 'Tests completed (no output)';
    const exitCode = result.success ? 0 : 1;

    ctx.emit('command:complete', {
      command,
      output,
      agent: ctx.role,
      exitCode,
    });

    return output.slice(0, 15000);
  } catch (error: any) {
    const errorMsg = error.message || 'Tests failed';
    ctx.emit('command:complete', {
      command,
      output: errorMsg,
      agent: ctx.role,
      exitCode: 1,
    });
    return `Test output:\n${errorMsg.slice(0, 15000)}`;
  }
});

registerTool('get_story_acceptance_criteria', async (ctx) => {
  const { task_id } = ctx.toolInput;
  const task = ctx.session.tasks.find(t => t.id === task_id);

  if (!task) {
    return `Story ${task_id} not found`;
  }

  const criteria = task.acceptanceCriteria || [];
  if (criteria.length === 0) {
    return `Story "${task.title}" has no explicit acceptance criteria. Test based on the description: ${task.description}`;
  }

  return `Story: "${task.title}"\n\nAcceptance Criteria:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
});

registerTool('report_test_results', async (ctx) => {
  const { task_id, passed, total_tests, passed_tests, failed_tests, summary, error_output, coverage } = ctx.toolInput;
  const task = ctx.session.tasks.find(t => t.id === task_id);

  if (!task) {
    return `Story ${task_id} not found`;
  }

  // Emit test results
  ctx.emit('test:results', {
    storyId: task_id,
    storyTitle: task.title,
    passed,
    total: total_tests,
    passed_tests,
    failed_tests,
    summary,
    error_output,
    coverage,
  });

  // Store test results on task for validation and tracking
  (task as any).testResults = {
    passed,
    total_tests,
    passed_tests,
    failed_tests,
    coverage,
    summary,
  };

  if (passed) {
    task.status = 'done';
    task.result = `Tests passed: ${passed_tests}/${total_tests}. ${summary}`;
    task.workingAgent = null;
    ctx.emit('task:updated', task);
    await ctx.persistStoriesToFile();

    ctx.emitAgentMessage({
      agentRole: ctx.role,
      agentName: ctx.config.name,
      type: 'result',
      content: `✅ Story "${task.title}" PASSED - ${passed_tests}/${total_tests} tests${coverage ? ` (${coverage}% coverage)` : ''}`,
    });

    return `Story ${task_id} marked as done. All tests passed!`;
  } else {
    task.status = 'failed';
    task.result = `Tests failed: ${failed_tests}/${total_tests}. ${summary}\n\nError output:\n${error_output || 'No error details'}`;
    task.workingAgent = null;
    const retryCount = (task as any).retryCount || 0;

    // Detailed failure logging
    console.log(`\n${'='.repeat(60)}`);
    console.log(`❌ STORY FAILED: ${task.title}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Story ID: ${task_id}`);
    console.log(`Retry count: ${retryCount}/3`);
    console.log(`Tests: ${passed_tests} passed, ${failed_tests} failed of ${total_tests} total`);
    console.log(`Summary: ${summary}`);
    if (error_output) {
      console.log(`\nError output:\n${error_output.slice(0, 1000)}`);
    }
    console.log(`${'='.repeat(60)}\n`);

    ctx.emit('task:updated', task);

    // Emit detailed failure event for UI
    ctx.emit('story:failed', {
      storyId: task_id,
      storyTitle: task.title,
      status: 'failed',
      retryCount,
      testResults: {
        passed: passed_tests,
        failed: failed_tests,
        total: total_tests,
        summary,
        errorOutput: error_output?.slice(0, 500),
      },
    });

    await ctx.persistStoriesToFile();

    ctx.emitAgentMessage({
      agentRole: ctx.role,
      agentName: ctx.config.name,
      type: 'error',
      content: `❌ Story "${task.title}" FAILED - ${failed_tests}/${total_tests} tests failed (retry ${retryCount}/3)\n${error_output?.slice(0, 500) || ''}`,
    });

    return `Story ${task_id} marked as failed. ${failed_tests} tests failed. Will retry (attempt ${retryCount + 1}/3).`;
  }
});

registerTool('report_setup_error', async (ctx) => {
  const { task_id, error_type, error_message, suggested_fix } = ctx.toolInput;

  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'error',
    content: `🔧 SETUP ERROR (${error_type})\n\n${error_message}\n\nSuggested fix: ${suggested_fix || 'Check the error message above'}`,
  });

  ctx.emit('setup:error', {
    taskId: task_id,
    errorType: error_type,
    errorMessage: error_message,
    suggestedFix: suggested_fix,
  });

  // If it's a project-wide issue, mark stories as needing attention
  if (task_id === 'all') {
    return 'Setup error reported. Coder will need to fix infrastructure issues before testing can proceed.';
  }

  const task = ctx.session.tasks.find(t => t.id === task_id);
  if (task) {
    task.status = 'failed';
    task.result = `Setup error: ${error_type} - ${error_message}`;
    task.workingAgent = null;

    // Detailed setup error logging
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔧 SETUP ERROR - Story: ${task.title}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Story ID: ${task_id}`);
    console.log(`Error type: ${error_type}`);
    console.log(`Error message: ${error_message}`);
    console.log(`Suggested fix: ${suggested_fix || 'N/A'}`);
    console.log(`${'='.repeat(60)}\n`);

    ctx.emit('task:updated', task);
    ctx.emit('story:failed', {
      storyId: task_id,
      storyTitle: task.title,
      status: 'failed',
      setupError: { errorType: error_type, errorMessage: error_message, suggestedFix: suggested_fix },
    });
    await ctx.persistStoriesToFile();
  }

  return 'Setup error reported. Story routed back to coder for infrastructure fixes.';
});

registerTool('skip_testing', async (ctx) => {
  const { task_id, reason } = ctx.toolInput;
  const task = ctx.session.tasks.find(t => t.id === task_id);

  if (!task) {
    return `Story ${task_id} not found`;
  }

  task.status = 'done';
  task.result = `Testing skipped: ${reason}`;
  task.workingAgent = null;
  ctx.emit('task:updated', task);
  await ctx.persistStoriesToFile();

  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'result',
    content: `⏭️ Skipped testing for "${task.title}": ${reason}`,
  });

  return `Story ${task_id} marked as done (testing skipped).`;
});

// =============================================================================
// Export handler check
// =============================================================================

export function hasToolHandler(name: string): boolean {
  return toolHandlers.has(name);
}

// List of all registered tool names
export function getRegisteredTools(): string[] {
  return Array.from(toolHandlers.keys());
}

// =============================================================================
// Security Tools
// =============================================================================

registerTool('security_scan', async (ctx) => {
  const { scan_type = 'all' } = ctx.toolInput;
  try {
    const { securityService } = await import('@/lib/security');

    if (scan_type === 'all') {
      const result = await securityService.scan(ctx.session.workingDirectory);
      const summary = securityService.formatReportSummary(result);

      const vulnerabilities = [
        ...result.sast.findings.map((f: any) => ({
          id: f.id,
          severity: f.severity,
          title: f.title,
          description: f.description,
          file: f.file,
          line: f.line,
          cwe: f.cwe,
          owasp: f.owasp,
          category: f.category,
          recommendation: f.remediation,
          autoFixAvailable: f.autoFixable || false,
        })),
        ...result.secrets.findings.map((f: any) => ({
          id: f.id,
          severity: f.severity,
          title: f.name,
          description: `Hardcoded ${f.type} detected`,
          file: f.file,
          line: f.line,
          category: 'HARDCODED_SECRET',
          recommendation: 'Move to environment variables or a secrets manager',
          autoFixAvailable: false,
        })),
        ...result.dependencies.vulnerabilities.map((v: any) => ({
          id: v.id,
          severity: v.severity === 'moderate' ? 'medium' : v.severity,
          title: v.title,
          description: v.description,
          cve: v.cve?.join(', '),
          cwe: v.cwe?.join(', '),
          category: 'VULNERABLE_DEPENDENCY',
          recommendation: v.recommendation,
          autoFixAvailable: true,
        })),
      ];

      ctx.emit('security:report', {
        score: result.metrics.score.overall,
        grade: result.metrics.score.grade,
        riskLevel: result.metrics.score.riskLevel,
        vulnerabilities,
        owaspCompliance: result.metrics.owasp,
        breakdown: result.metrics.score.breakdown,
        summary: result.metrics.summary,
        categories: result.metrics.categories,
        recommendations: result.metrics.recommendations,
        scanDate: new Date(),
        scanDuration: result.scanDuration,
      });

      return summary;
    } else if (scan_type === 'sast') {
      const sastResult = await securityService.scanSAST(ctx.session.workingDirectory);
      return `SAST Scan Complete:
- Files scanned: ${sastResult.filesScanned}
- Lines analyzed: ${sastResult.linesAnalyzed}
- Findings: ${sastResult.summary.total} (${sastResult.summary.critical} critical, ${sastResult.summary.high} high, ${sastResult.summary.medium} medium, ${sastResult.summary.low} low)

Top findings:
${sastResult.findings.slice(0, 10).map((f: any) => `• [${f.severity.toUpperCase()}] ${f.title} in ${f.file}:${f.line}`).join('\n')}`;
    } else if (scan_type === 'secrets') {
      const secretResult = await securityService.scanSecrets(ctx.session.workingDirectory);
      return `Secret Scan Complete:
- Files scanned: ${secretResult.filesScanned}
- Secrets found: ${secretResult.summary.total} (${secretResult.summary.critical} critical, ${secretResult.summary.high} high)

${secretResult.findings.length > 0 ? `Secrets detected:\n${secretResult.findings.slice(0, 10).map((f: any) => `• [${f.severity.toUpperCase()}] ${f.name} in ${f.file}:${f.line}`).join('\n')}` : 'No hardcoded secrets detected!'}`;
    } else if (scan_type === 'dependencies') {
      const depResult = await securityService.scanDependencies(ctx.session.workingDirectory);
      return `Dependency Scan Complete:
- Total dependencies: ${depResult.metadata.totalDependencies}
- Vulnerable packages: ${depResult.vulnerabilities.length}
- Outdated packages: ${depResult.outdatedPackages.length}

${depResult.vulnerabilities.length > 0 ? `Vulnerabilities:\n${depResult.vulnerabilities.slice(0, 10).map((v: any) => `• [${v.severity.toUpperCase()}] ${v.packageName}: ${v.title}`).join('\n')}` : 'No vulnerable dependencies found!'}`;
    }
    return 'Unknown scan type';
  } catch (error) {
    return `Security scan error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
});

registerTool('get_security_metrics', async (ctx) => {
  try {
    const { securityService } = await import('@/lib/security');
    const report = await securityService.scan(ctx.session.workingDirectory);
    const { score, owasp, summary } = report.metrics;

    let owaspStatus = '';
    for (const [id, data] of Object.entries(owasp) as [string, any][]) {
      const icon = data.status === 'pass' ? '✓' : data.status === 'fail' ? '✗' : '⚠';
      owaspStatus += `${icon} ${id}: ${data.name} (${data.findings} findings)\n`;
    }

    const soc2Score = Math.max(0, 100 - (summary.criticalFindings * 25) - (summary.highFindings * 10) - (summary.mediumFindings * 3));
    const soc2Grade = soc2Score >= 90 ? 'Compliant' : soc2Score >= 70 ? 'Needs Improvement' : 'Non-Compliant';

    const breachRisk = summary.criticalFindings > 0 ? 'HIGH' : summary.highFindings > 2 ? 'MEDIUM' : 'LOW';
    const breachIcon = breachRisk === 'HIGH' ? '🔴' : breachRisk === 'MEDIUM' ? '🟡' : '🟢';

    return `🛡️ ENTERPRISE SECURITY METRICS
═══════════════════════════════════════════════════════════════

📊 OVERALL SECURITY SCORE
   Score: ${score.overall}/100 (Grade: ${score.grade})
   Risk Level: ${score.riskLevel.toUpperCase()}

${breachIcon} DATA BREACH RISK: ${breachRisk}
   ${summary.criticalFindings > 0 ? '⚠️ Critical vulnerabilities detected - immediate action required!' : 'No critical data exposure risks detected.'}

📋 SOC 2 COMPLIANCE ESTIMATE
   Score: ${soc2Score}/100
   Status: ${soc2Grade}
   ${soc2Score < 90 ? '⚠️ Review findings for SOC 2 Trust Services Criteria compliance' : '✅ Meets minimum SOC 2 security requirements'}

🛡️ NIST CSF ALIGNMENT
   PR.DS (Data Security): ${score.breakdown.secrets >= 90 ? '✓' : '⚠️'} ${score.breakdown.secrets >= 90 ? 'Adequate' : 'Needs Review'}
   PR.AC (Access Control): ⚠️ Manual Review Required
   DE.CM (Monitoring): ⚠️ Manual Review Required

📈 SCAN BREAKDOWN
   SAST Analysis: ${score.breakdown.sast}/100
   Secret Detection: ${score.breakdown.secrets}/100
   Dependencies: ${score.breakdown.dependencies}/100

🔍 FINDINGS SUMMARY
   🔴 Critical: ${summary.criticalFindings} ${summary.criticalFindings > 0 ? '(Potential data breach risk)' : ''}
   🟠 High: ${summary.highFindings} ${summary.highFindings > 0 ? '(Compliance violation risk)' : ''}
   🟡 Medium: ${summary.mediumFindings}
   🟢 Low: ${summary.lowFindings}
   🔧 Auto-Fixable: ${summary.fixableFindings}

📜 OWASP TOP 10 (Insurance Context)
${owaspStatus}

💡 NEXT STEPS:
   1. Call get_soc2_compliance() for detailed SOC 2 checklist
   2. Call get_nist_compliance() for NIST framework status
   3. Address CRITICAL findings first (data breach risk)`;
  } catch (error) {
    return `Could not get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
});

registerTool('report_vulnerability', async (ctx) => {
  const { severity, file, vulnerability_type, description, remediation, owasp, cwe, soc2_ref, nist_ref, pii_impact, breach_risk } = ctx.toolInput;

  let report = `🛡️ SECURITY FINDING [${severity.toUpperCase()}]\n`;
  report += `═══════════════════════════════════════════════════════════════\n`;
  report += `📁 File: ${file}\n`;
  report += `🔍 Type: ${vulnerability_type}\n`;

  if (soc2_ref || nist_ref) {
    report += `\n📋 COMPLIANCE REFERENCES:\n`;
    if (soc2_ref) report += `   SOC 2: ${soc2_ref}\n`;
    if (nist_ref) report += `   NIST: ${nist_ref}\n`;
  }
  if (owasp) report += `   OWASP: ${owasp}\n`;
  if (cwe) report += `   CWE: ${cwe}\n`;

  if (pii_impact) {
    report += `\n⚠️ PII IMPACT:\n   ${pii_impact}\n`;
  }
  if (breach_risk) {
    const riskIcon = breach_risk === 'high' ? '🔴' : breach_risk === 'medium' ? '🟡' : '🟢';
    report += `\n${riskIcon} BREACH RISK: ${breach_risk.toUpperCase()}\n`;
  }

  report += `\n📝 DESCRIPTION:\n   ${description}\n`;
  report += `\n✅ REMEDIATION:\n   ${remediation}`;

  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'result',
    content: report,
  });

  ctx.emit('security:alert', {
    severity,
    file,
    vulnerability_type,
    description,
    remediation,
    owasp,
    cwe,
    soc2_ref,
    nist_ref,
    pii_impact,
    breach_risk,
    insurance_context: true,
  });

  return 'Security vulnerability reported and emitted to compliance dashboard';
});

registerTool('get_soc2_compliance', async () => {
  const soc2Checks = {
    security: {
      ref: 'CC6',
      name: 'Logical and Physical Access Controls',
      checks: [
        { name: 'User Access Management (CC6.1)', required: true, status: 'review' },
        { name: 'System Access Restrictions (CC6.2)', required: true, status: 'review' },
        { name: 'Encryption at Rest (CC6.6)', required: true, status: 'review' },
        { name: 'Transmission Encryption (CC6.7)', required: true, status: 'review' },
      ],
    },
    availability: {
      ref: 'A1',
      name: 'Availability',
      checks: [
        { name: 'System Monitoring (A1.1)', required: true, status: 'review' },
        { name: 'Recovery Procedures (A1.2)', required: true, status: 'review' },
      ],
    },
    processing_integrity: {
      ref: 'PI1',
      name: 'Processing Integrity',
      checks: [
        { name: 'Data Validation (PI1.1)', required: true, status: 'review' },
        { name: 'Error Handling (PI1.2)', required: true, status: 'review' },
      ],
    },
    confidentiality: {
      ref: 'C1',
      name: 'Confidentiality',
      checks: [
        { name: 'Data Classification (C1.1)', required: true, status: 'review' },
        { name: 'Confidential Data Protection (C1.2)', required: true, status: 'review' },
      ],
    },
    privacy: {
      ref: 'P1-P8',
      name: 'Privacy',
      checks: [
        { name: 'PII Collection Notice (P1)', required: true, status: 'review' },
        { name: 'PII Use Limitation (P3)', required: true, status: 'review' },
      ],
    },
  };

  let report = `🛡️ SOC 2 TRUST SERVICES CRITERIA COMPLIANCE STATUS\n`;
  report += `═══════════════════════════════════════════════════════════════\n`;
  report += `AICPA Trust Services Criteria\n\n`;

  for (const [, section] of Object.entries(soc2Checks)) {
    report += `${section.ref} - ${section.name}\n`;
    for (const check of section.checks) {
      report += `  ${check.name}: ⚠️ NEEDS REVIEW\n`;
    }
    report += '\n';
  }

  report += `\n💡 TIP: Use read_file() to examine code and verify each control.\n`;
  report += `Report findings with report_vulnerability() including soc2_ref.`;

  return report;
});

registerTool('get_nist_compliance', async () => {
  const nistFramework = {
    identify: {
      controls: [
        { id: 'ID.AM-1', name: 'Physical devices inventory', category: 'Asset Management' },
        { id: 'ID.AM-2', name: 'Software platforms inventory', category: 'Asset Management' },
        { id: 'ID.RA-1', name: 'Asset vulnerabilities identified', category: 'Risk Assessment' },
        { id: 'ID.RA-5', name: 'Threats identified', category: 'Risk Assessment' },
      ],
    },
    protect: {
      controls: [
        { id: 'PR.AC-1', name: 'Identities and credentials managed', category: 'Access Control' },
        { id: 'PR.AC-3', name: 'Remote access managed', category: 'Access Control' },
        { id: 'PR.AC-4', name: 'Access permissions managed', category: 'Access Control' },
        { id: 'PR.DS-1', name: 'Data-at-rest protected', category: 'Data Security' },
        { id: 'PR.DS-2', name: 'Data-in-transit protected', category: 'Data Security' },
        { id: 'PR.DS-5', name: 'Data leak protections', category: 'Data Security' },
        { id: 'PR.IP-1', name: 'Security baselines established', category: 'Information Protection' },
      ],
    },
    detect: {
      controls: [
        { id: 'DE.AE-2', name: 'Events analyzed', category: 'Anomalies and Events' },
        { id: 'DE.CM-1', name: 'Network monitored', category: 'Continuous Monitoring' },
        { id: 'DE.CM-4', name: 'Malicious code detected', category: 'Continuous Monitoring' },
        { id: 'DE.CM-7', name: 'Unauthorized access monitored', category: 'Continuous Monitoring' },
      ],
    },
    respond: {
      controls: [
        { id: 'RS.AN-1', name: 'Incident notifications received', category: 'Analysis' },
        { id: 'RS.MI-1', name: 'Incidents contained', category: 'Mitigation' },
        { id: 'RS.MI-2', name: 'Incidents mitigated', category: 'Mitigation' },
      ],
    },
    recover: {
      controls: [
        { id: 'RC.RP-1', name: 'Recovery plan executed', category: 'Recovery Planning' },
      ],
    },
  };

  let report = `🛡️ NIST CYBERSECURITY FRAMEWORK COMPLIANCE\n`;
  report += `═══════════════════════════════════════════════════════════════\n`;
  report += `NIST SP 800-53 / CSF Controls for Insurance\n\n`;

  const sections = ['identify', 'protect', 'detect', 'respond', 'recover'] as const;
  const sectionEmojis: Record<string, string> = { identify: '🔍', protect: '🛡️', detect: '👁️', respond: '🚨', recover: '♻️' };

  for (const section of sections) {
    const data = nistFramework[section];
    report += `${sectionEmojis[section]} ${section.toUpperCase()}\n`;
    for (const control of data.controls) {
      report += `  ⚠️ ${control.id}: ${control.name}\n`;
    }
    report += '\n';
  }

  report += `\n💡 TIP: When reporting vulnerabilities, include nist_ref (e.g., "PR.DS-1").\n`;
  report += `Focus on PROTECT controls for PII/data security.`;

  return report;
});

// =============================================================================
// Fixer Tools
// =============================================================================

registerTool('get_error_logs', async (ctx) => {
  const { limit = 50, include_warnings = true } = ctx.toolInput;
  let output = '';

  // 1. Get failed command outputs
  const failedCommands = ctx.session.commandLogs
    .filter(log => log.exitCode !== 0 || log.error)
    .slice(-20);

  if (failedCommands.length > 0) {
    output += `═══════════════════════════════════════════════════════════════\n`;
    output += `FAILED COMMANDS (${failedCommands.length})\n`;
    output += `═══════════════════════════════════════════════════════════════\n\n`;
    failedCommands.forEach(log => {
      const time = log.timestamp.toLocaleTimeString();
      output += `[${time}] $ ${log.command}\n`;
      output += `Exit Code: ${log.exitCode}\n`;
      if (log.error) {
        output += `ERROR:\n${log.error.slice(0, 2000)}\n`;
      }
      if (log.output) {
        output += `OUTPUT:\n${log.output.slice(0, 1000)}\n`;
      }
      output += '\n---\n\n';
    });
  }

  // 2. Get recent command outputs
  const recentCommands = ctx.session.commandLogs.slice(-10);
  if (recentCommands.length > 0) {
    output += `═══════════════════════════════════════════════════════════════\n`;
    output += `RECENT COMMAND OUTPUTS (${recentCommands.length})\n`;
    output += `═══════════════════════════════════════════════════════════════\n\n`;
    recentCommands.forEach(log => {
      const time = log.timestamp.toLocaleTimeString();
      const status = log.exitCode === 0 ? '✓' : '✗';
      output += `[${time}] ${status} $ ${log.command} (exit: ${log.exitCode})\n`;
      const fullOutput = log.error || log.output || '';
      if (fullOutput) {
        output += fullOutput.slice(-500) + '\n';
      }
      output += '\n';
    });
  }

  // 3. Get error messages from agent logs
  const errorKeywords = ['error', 'failed', 'exception', 'cannot', 'unable', 'undefined', 'null', 'missing', 'not found'];
  const warningKeywords = include_warnings ? ['warning', 'warn', 'deprecated'] : [];
  const allKeywords = [...errorKeywords, ...warningKeywords];

  const errorMessages = ctx.session.messages
    .filter(m => {
      if (m.type === 'error') return true;
      const lowerContent = m.content.toLowerCase();
      return allKeywords.some(kw => lowerContent.includes(kw));
    })
    .slice(-limit);

  if (errorMessages.length > 0) {
    output += `═══════════════════════════════════════════════════════════════\n`;
    output += `AGENT ERROR MESSAGES (${errorMessages.length})\n`;
    output += `═══════════════════════════════════════════════════════════════\n\n`;
    errorMessages.forEach(m => {
      const time = m.timestamp.toLocaleTimeString();
      const typeIcon = m.type === 'error' ? '❌' : '⚠️';
      output += `[${time}] ${typeIcon} [${m.agentRole}] ${m.content.slice(0, 500)}\n\n`;
    });
  }

  // 4. Get failed tasks/stories
  const failedTasks = ctx.session.tasks.filter(t => t.status === 'failed');
  if (failedTasks.length > 0) {
    output += `═══════════════════════════════════════════════════════════════\n`;
    output += `FAILED STORIES (${failedTasks.length})\n`;
    output += `═══════════════════════════════════════════════════════════════\n\n`;
    failedTasks.forEach(t => {
      output += `• [${t.id}] ${t.title}\n`;
      output += `  Status: ${t.status}\n`;
      if (t.result) {
        output += `  Error: ${t.result.slice(0, 300)}\n`;
      }
      output += '\n';
    });
  }

  if (!output) {
    return `No errors found in session logs.\n\nTIP: Run these commands to check for errors:\n• run_command("./node_modules/.bin/tsc --noEmit") - Check for TypeScript errors\n• run_command("npm test") - Check for test failures\n• run_command("npm run lint") - Check for lint issues`;
  }

  return output;
});

registerTool('analyze_error', async (ctx) => {
  const { error_message, file_path } = ctx.toolInput;

  const patterns = [
    { regex: /Cannot find module ['"](.+)['"]/i, type: 'MISSING_MODULE', severity: 'HIGH',
      fix: 'Install the missing module with: npm install <module-name>',
      action: 'run_command("npm install <extracted-module>")' },
    { regex: /Module not found.*['"](.+)['"]/i, type: 'MODULE_NOT_FOUND', severity: 'HIGH',
      fix: 'Check import path is correct. If external module, run npm install.',
      action: 'Check relative path starts with ./ or ../' },
    { regex: /Cannot use import statement outside a module/i, type: 'ESM_ERROR', severity: 'HIGH',
      fix: 'Add "type": "module" to package.json or use .mjs extension or configure tsconfig.',
      action: 'edit_file("package.json") to add "type": "module"' },
    { regex: /Type ['"](.+)['"] is not assignable to type ['"](.+)['"]/i, type: 'TYPE_MISMATCH', severity: 'MEDIUM',
      fix: 'Check that the value matches the expected type. May need type assertion or interface update.',
      action: 'Use "as Type" assertion or fix the interface definition' },
    { regex: /Property ['"](.+)['"] does not exist on type ['"](.+)['"]/i, type: 'MISSING_PROPERTY', severity: 'MEDIUM',
      fix: 'Add the property to the interface/type, or check for typos in property name.',
      action: 'Update the interface or use optional chaining (?.)' },
    { regex: /SyntaxError.*Unexpected token/i, type: 'SYNTAX_ERROR', severity: 'CRITICAL',
      fix: 'Unexpected token - check for missing brackets, commas, or invalid syntax.',
      action: 'Read the file around the line number and fix syntax' },
    { regex: /TypeError.*undefined/i, type: 'UNDEFINED_ACCESS', severity: 'HIGH',
      fix: 'Trying to access property or call method on undefined.',
      action: 'Add null check: if (obj) { obj.method() }' },
    { regex: /ENOENT.*no such file or directory/i, type: 'FILE_NOT_FOUND', severity: 'HIGH',
      fix: 'File or directory does not exist.',
      action: 'Create the file or fix the path' },
    { regex: /npm ERR!/i, type: 'NPM_ERROR', severity: 'MEDIUM',
      fix: 'NPM error - check package.json and node_modules.',
      action: 'Try: rm -rf node_modules && npm install' },
    { regex: /Invalid hook call/i, type: 'INVALID_HOOK', severity: 'HIGH',
      fix: 'Hook called outside component or multiple React versions.',
      action: 'Ensure hooks are only called inside function components' },
    { regex: /Hydration failed/i, type: 'HYDRATION_ERROR', severity: 'MEDIUM',
      fix: 'Server/client HTML mismatch.',
      action: 'Check for browser-only code, use useEffect or dynamic import' },
    { regex: /FAIL.*test/i, type: 'TEST_FAILURE', severity: 'MEDIUM',
      fix: 'Test failed - check the assertion and expected value.',
      action: 'Read the test file and fix the failing assertion' },
  ];

  const fileMatch = error_message.match(/(?:at\s+)?([^\s:]+\.(?:ts|tsx|js|jsx)):(\d+)(?::(\d+))?/);
  const extractedFile = fileMatch ? fileMatch[1] : file_path;
  const lineNumber = fileMatch ? fileMatch[2] : null;
  const colNumber = fileMatch ? fileMatch[3] : null;

  let analysis = `═══════════════════════════════════════════════════════════════\n`;
  analysis += `ERROR ANALYSIS\n`;
  analysis += `═══════════════════════════════════════════════════════════════\n\n`;
  analysis += `Error Message:\n${error_message.slice(0, 800)}\n\n`;

  if (extractedFile) {
    analysis += `📁 File: ${extractedFile}`;
    if (lineNumber) analysis += `:${lineNumber}`;
    if (colNumber) analysis += `:${colNumber}`;
    analysis += '\n\n';
  }

  const matchedPatterns = patterns.filter(p => p.regex.test(error_message));

  if (matchedPatterns.length > 0) {
    const primary = matchedPatterns[0];
    analysis += `🔍 Type: ${primary.type}\n`;
    analysis += `⚠️ Severity: ${primary.severity}\n`;
    analysis += `💡 Fix: ${primary.fix}\n`;
    analysis += `🔧 Action: ${primary.action}\n\n`;

    if (matchedPatterns.length > 1) {
      analysis += `Other possible issues:\n`;
      matchedPatterns.slice(1, 3).forEach(p => {
        analysis += `  • ${p.type}: ${p.fix}\n`;
      });
      analysis += '\n';
    }
  } else {
    analysis += `🔍 Type: UNKNOWN\n`;
    analysis += `⚠️ Severity: MEDIUM\n`;
    analysis += `💡 Fix: Read the error message carefully and check the mentioned file.\n`;
    analysis += `🔧 Action: Use read_file() to examine the code and find the issue.\n\n`;
  }

  analysis += `═══════════════════════════════════════════════════════════════\n`;
  analysis += `RECOMMENDED ACTIONS\n`;
  analysis += `═══════════════════════════════════════════════════════════════\n\n`;
  analysis += `1. READ the source file: read_file("${extractedFile || '<path>'}")\n`;
  analysis += `2. EXAMINE code around line ${lineNumber || 'N/A'}\n`;
  analysis += `3. FIX the issue: edit_file() with targeted change\n`;
  analysis += `4. VERIFY: run_command("./node_modules/.bin/tsc --noEmit") to check types\n`;

  return analysis;
});

registerTool('report_fix', async (ctx) => {
  const { issue, root_cause, fix_applied, files_modified = [], verified } = ctx.toolInput;

  const report = {
    id: `fix-${ctx.generateId()}`,
    issue,
    root_cause,
    fix_applied,
    files_modified,
    verified,
    timestamp: new Date().toISOString(),
    agent: 'fixer',
  };

  ctx.emit('fix:reported', report);

  const statusIcon = verified ? '✅' : '⚠️';
  const verifiedText = verified ? 'VERIFIED' : 'UNVERIFIED';

  ctx.emitAgentMessage({
    agentRole: 'fixer',
    agentName: 'Fixer',
    type: 'result',
    content: `${statusIcon} FIX ${verifiedText}

Issue: ${issue}
Root Cause: ${root_cause}
Fix Applied: ${fix_applied}
Files Modified: ${files_modified.length > 0 ? files_modified.join(', ') : 'None'}`,
  });

  return `Fix reported successfully. Status: ${verifiedText}`;
});

registerTool('request_coder_help', async (ctx) => {
  const { issue, suggested_fix, files_involved = [], error_context = '', create_task = true } = ctx.toolInput;

  if (create_task) {
    const fixTask: Task = {
      id: `fix-task-${ctx.generateId()}`,
      title: `🔧 FIX: ${issue.slice(0, 50)}${issue.length > 50 ? '...' : ''}`,
      description: `FIXER AGENT HANDOFF

ERROR/ISSUE:
${issue}

SUGGESTED FIX:
${suggested_fix}

FILES INVOLVED:
${files_involved.length > 0 ? files_involved.map((f: string) => `• ${f}`).join('\n') : '• Unknown - investigate needed'}

${error_context ? `ERROR CONTEXT:\n${error_context.slice(0, 500)}` : ''}

INSTRUCTIONS FOR CODER:
1. Read the files involved to understand the issue
2. Implement the suggested fix (or a better solution)
3. Run build/test to verify the fix works
4. Mark this task as ready for testing when done`,
      status: 'backlog',
      assignedTo: 'coder',
      priority: 'high',
    };
    ctx.session.tasks.push(fixTask);
    ctx.emit('task:created', { ...fixTask, priority: 'high', fromFixer: true });

    ctx.emitAgentMessage({
      agentRole: 'fixer',
      agentName: 'Fixer',
      type: 'result',
      content: `📋 CREATED FIX TASK FOR CODER

Task ID: ${fixTask.id}
Issue: ${issue.slice(0, 100)}
Suggested Fix: ${suggested_fix.slice(0, 100)}
Files: ${files_involved.join(', ') || 'To be determined'}

The task has been added to the backlog with HIGH priority.
Coder agent will pick it up automatically.`,
    });

    ctx.emit('fixer:needs_help', {
      taskId: fixTask.id,
      issue,
      suggested_fix,
      files_involved,
      timestamp: new Date().toISOString(),
    });

    return `Created fix task ${fixTask.id} for Coder agent. The Coder will pick this up from the backlog.`;
  }

  ctx.emit('fixer:needs_help', {
    issue,
    suggested_fix,
    files_involved,
    timestamp: new Date().toISOString(),
  });

  ctx.emitAgentMessage({
    agentRole: 'fixer',
    agentName: 'Fixer',
    type: 'chat',
    content: `🆘 REQUESTING CODER ASSISTANCE

Issue: ${issue}
Suggested Fix: ${suggested_fix}
Files Involved: ${files_involved.join(', ') || 'Unknown'}

The Coder agent should review and implement a more comprehensive fix.`,
  });

  return `Help request sent to Coder agent. Issue: ${issue}`;
});

// =============================================================================
// Researcher Tools
// =============================================================================

registerTool('suggest_enhancement', async (ctx) => {
  const { category, title, description, priority, effort, impact, implementation_hint } = ctx.toolInput;

  const suggestion = {
    id: `suggestion-${ctx.generateId()}`,
    category,
    title,
    description,
    priority,
    effort,
    impact,
    implementation_hint,
    timestamp: new Date().toISOString(),
  };

  ctx.emit('research:suggestion', suggestion);

  const priorityIcon = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';
  const effortIcon = effort === 'small' ? '⚡' : effort === 'medium' ? '⏱️' : '🏗️';

  ctx.emitAgentMessage({
    agentRole: 'researcher',
    agentName: 'Researcher',
    type: 'result',
    content: `💡 SUGGESTION: ${title}
${priorityIcon} Priority: ${priority} | ${effortIcon} Effort: ${effort}
Category: ${category}

${description}

Impact: ${impact}${implementation_hint ? `\nHint: ${implementation_hint}` : ''}`,
  });

  return `Suggestion submitted: "${title}"`;
});

registerTool('analyze_dependencies', async (ctx) => {
  try {
    const pkgPath = path.join(ctx.session.workingDirectory, 'package.json');
    const pkgContent = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(pkgContent);

    const deps = Object.keys(pkg.dependencies || {});
    const devDeps = Object.keys(pkg.devDependencies || {});

    let analysis = `=== DEPENDENCY ANALYSIS ===\n\n`;
    analysis += `Production dependencies (${deps.length}):\n${deps.map(d => `  - ${d}`).join('\n') || '  (none)'}\n\n`;
    analysis += `Dev dependencies (${devDeps.length}):\n${devDeps.map(d => `  - ${d}`).join('\n') || '  (none)'}\n\n`;

    const suggestions: string[] = [];

    if (!deps.includes('sentry') && !deps.includes('@sentry/nextjs') && !deps.includes('@sentry/react')) {
      suggestions.push('Consider adding Sentry for error tracking');
    }
    if (!devDeps.includes('jest') && !devDeps.includes('vitest') && !devDeps.includes('@testing-library/react')) {
      suggestions.push('No testing framework detected - consider adding Jest or Vitest');
    }
    if (!devDeps.includes('eslint')) {
      suggestions.push('Consider adding ESLint for code quality');
    }
    if (!devDeps.includes('prettier')) {
      suggestions.push('Consider adding Prettier for code formatting');
    }
    if (!deps.includes('zod') && !deps.includes('yup') && !deps.includes('joi')) {
      suggestions.push('Consider adding Zod or Yup for runtime validation');
    }

    if (suggestions.length > 0) {
      analysis += `Suggestions:\n${suggestions.map(s => `  ⚠️ ${s}`).join('\n')}`;
    } else {
      analysis += `✅ Dependencies look comprehensive!`;
    }

    return analysis;
  } catch {
    return 'Could not analyze dependencies - package.json not found or invalid';
  }
});

registerTool('complete_research', async (ctx) => {
  const { summary, total_suggestions, top_priorities = [] } = ctx.toolInput;

  ctx.emit('research:complete', {
    summary,
    total_suggestions,
    top_priorities,
    timestamp: new Date().toISOString(),
  });

  ctx.emitAgentMessage({
    agentRole: 'researcher',
    agentName: 'Researcher',
    type: 'result',
    content: `✅ RESEARCH COMPLETE

${summary}

Total suggestions: ${total_suggestions}
${top_priorities.length > 0 ? `\nTop priorities:\n${top_priorities.map((p: string, i: number) => `${i + 1}. ${p}`).join('\n')}` : ''}

Click on any suggestion button to add it to the backlog!`,
  });

  return 'Research complete';
});

// =============================================================================
// Quality Assurance Tools - Fast validation before expensive builds
// =============================================================================

registerTool('validate_code', async (ctx) => {
  const { files = [], fix = false } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;

  ctx.emit('command:start', { command: 'validate_code', agent: ctx.role });

  const results: string[] = [];
  let hasErrors = false;

  // 1. Run TypeScript type check (fast - no emit)
  try {
    const tscCommand = './node_modules/.bin/tsc --noEmit --pretty';
    const tscResult = execCommandSafe(tscCommand, { cwd: baseDir, timeout: 60000 });

    if (!tscResult.success) {
      hasErrors = true;
      const errorLines = (tscResult.output || tscResult.error || '').split('\n')
        .filter(line => line.includes('error TS') || line.includes('.ts') || line.includes('.tsx'))
        .slice(0, 20);

      results.push(`❌ TYPESCRIPT ERRORS:\n${errorLines.join('\n')}`);
    } else {
      results.push(`✅ TypeScript: No type errors`);
    }
  } catch (err: any) {
    results.push(`⚠️ TypeScript check failed: ${err.message}`);
  }

  // 2. Run ESLint
  try {
    const fileArgs = files.length > 0 ? files.join(' ') : '.';
    const fixFlag = fix ? '--fix' : '';
    const eslintCommand = `npx eslint ${fileArgs} ${fixFlag} --format stylish --max-warnings 50`;
    const eslintResult = execCommandSafe(eslintCommand, { cwd: baseDir, timeout: 60000 });

    if (!eslintResult.success) {
      hasErrors = true;
      const output = (eslintResult.output || eslintResult.error || '').slice(0, 3000);
      results.push(`❌ ESLINT ERRORS:\n${output}`);
    } else {
      const warnings = (eslintResult.output || '').match(/warning/gi)?.length || 0;
      results.push(`✅ ESLint: Passed${warnings > 0 ? ` (${warnings} warnings)` : ''}`);
    }
  } catch (err: any) {
    results.push(`⚠️ ESLint check failed: ${err.message}`);
  }

  ctx.emit('command:complete', {
    command: 'validate_code',
    output: results.join('\n\n'),
    agent: ctx.role,
    exitCode: hasErrors ? 1 : 0,
  });

  const summary = hasErrors
    ? `\n\n⚠️ FIX THESE ISSUES BEFORE RUNNING BUILD!`
    : `\n\n✅ All checks passed! Ready to mark story as testing.`;

  return `═══════════════════════════════════════════════════════════════
CODE VALIDATION RESULTS
═══════════════════════════════════════════════════════════════

${results.join('\n\n')}${summary}`;
});

registerTool('format_code', async (ctx) => {
  const { files = [], check_only = false } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;

  ctx.emit('command:start', { command: 'format_code', agent: ctx.role });

  // Check if Prettier is available
  try {
    const checkPrettier = execCommandSafe('npx prettier --version', { cwd: baseDir, timeout: 10000 });
    if (!checkPrettier.success) {
      return `⚠️ Prettier not installed. Run: npm install -D prettier

Then create a .prettierrc file:
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}`;
    }
  } catch {
    return '⚠️ Could not check Prettier installation';
  }

  const fileArgs = files.length > 0
    ? files.join(' ')
    : '"**/*.{ts,tsx,js,jsx,json,css,md}"';

  const action = check_only ? '--check' : '--write';
  const ignoreFlag = '--ignore-path .gitignore --ignore-unknown';
  const command = `npx prettier ${action} ${ignoreFlag} ${fileArgs}`;

  try {
    const result = execCommandSafe(command, { cwd: baseDir, timeout: 60000 });

    ctx.emit('command:complete', {
      command: 'format_code',
      output: result.output || '',
      agent: ctx.role,
      exitCode: result.success ? 0 : 1,
    });

    if (check_only) {
      if (result.success) {
        return '✅ All files are properly formatted!';
      } else {
        const unformatted = (result.output || result.error || '')
          .split('\n')
          .filter(line => line.includes('.ts') || line.includes('.tsx') || line.includes('.js'))
          .slice(0, 10);
        return `❌ Files need formatting:\n${unformatted.join('\n')}\n\nRun format_code() without check_only to fix.`;
      }
    } else {
      const filesChanged = (result.output || '').split('\n').filter(Boolean).length;
      return `✅ Formatted ${filesChanged > 0 ? filesChanged + ' files' : 'code successfully'}`;
    }
  } catch (err: any) {
    ctx.emit('command:complete', {
      command: 'format_code',
      output: err.message,
      agent: ctx.role,
      exitCode: 1,
    });
    return `❌ Format error: ${err.message}`;
  }
});

registerTool('fix_lint', async (ctx) => {
  const { files = [] } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;

  ctx.emit('command:start', { command: 'fix_lint', agent: ctx.role });

  const fileArgs = files.length > 0 ? files.join(' ') : '.';
  const command = `npx eslint ${fileArgs} --fix --format stylish`;

  try {
    const result = execCommandSafe(command, { cwd: baseDir, timeout: 60000 });

    ctx.emit('command:complete', {
      command: 'fix_lint',
      output: result.output || '',
      agent: ctx.role,
      exitCode: result.success ? 0 : 1,
    });

    if (result.success) {
      return `✅ ESLint auto-fix complete!

Fixed issues automatically. Remaining warnings (if any) require manual review.`;
    } else {
      // ESLint returns non-zero if there are remaining errors
      const output = (result.output || result.error || '').slice(0, 2000);
      const errorCount = (output.match(/error/gi) || []).length;
      const warningCount = (output.match(/warning/gi) || []).length;

      return `⚠️ ESLint auto-fix applied. Remaining issues:
- Errors: ${errorCount} (require manual fix)
- Warnings: ${warningCount}

${output}`;
    }
  } catch (err: any) {
    ctx.emit('command:complete', {
      command: 'fix_lint',
      output: err.message,
      agent: ctx.role,
      exitCode: 1,
    });
    return `❌ ESLint fix error: ${err.message}`;
  }
});

registerTool('pre_build_check', async (ctx) => {
  const { auto_fix = true } = ctx.toolInput;
  const baseDir = ctx.session.workingDirectory;

  ctx.emit('command:start', { command: 'pre_build_check', agent: ctx.role });

  const startTime = Date.now();
  const results: { name: string; status: 'pass' | 'fail' | 'warn'; message: string }[] = [];
  let overallPass = true;

  // 1. TypeScript type check
  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'action',
    content: '🔍 Running TypeScript type check...',
  });

  try {
    const tscResult = execCommandSafe('./node_modules/.bin/tsc --noEmit --pretty', { cwd: baseDir, timeout: 60000 });
    if (tscResult.success) {
      results.push({ name: 'TypeScript', status: 'pass', message: 'No type errors' });
    } else {
      overallPass = false;
      const errors = (tscResult.output || tscResult.error || '')
        .split('\n')
        .filter(line => line.includes('error TS'))
        .length;
      results.push({ name: 'TypeScript', status: 'fail', message: `${errors} type error(s)` });
    }
  } catch (err: any) {
    results.push({ name: 'TypeScript', status: 'warn', message: err.message });
  }

  // 2. ESLint (with auto-fix if enabled)
  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'action',
    content: `🔍 Running ESLint${auto_fix ? ' with auto-fix' : ''}...`,
  });

  try {
    const fixFlag = auto_fix ? '--fix' : '';
    const eslintResult = execCommandSafe(`npx eslint . ${fixFlag} --format stylish --max-warnings 100`, {
      cwd: baseDir,
      timeout: 60000
    });

    if (eslintResult.success) {
      results.push({ name: 'ESLint', status: 'pass', message: auto_fix ? 'Passed (auto-fixed)' : 'No errors' });
    } else {
      const output = eslintResult.output || eslintResult.error || '';
      const errorCount = (output.match(/\d+ error/g) || ['0 error'])[0];
      // ESLint errors don't necessarily block build, but should be fixed
      results.push({ name: 'ESLint', status: 'warn', message: errorCount });
    }
  } catch (err: any) {
    results.push({ name: 'ESLint', status: 'warn', message: err.message });
  }

  // 3. Prettier format check (or format if auto_fix)
  ctx.emitAgentMessage({
    agentRole: ctx.role,
    agentName: ctx.config.name,
    type: 'action',
    content: `🔍 Checking code formatting${auto_fix ? ' and auto-formatting' : ''}...`,
  });

  try {
    const prettierAction = auto_fix ? '--write' : '--check';
    const prettierResult = execCommandSafe(
      `npx prettier ${prettierAction} "**/*.{ts,tsx,js,jsx}" --ignore-path .gitignore --ignore-unknown 2>/dev/null || true`,
      { cwd: baseDir, timeout: 60000 }
    );

    if (prettierResult.success || auto_fix) {
      results.push({ name: 'Prettier', status: 'pass', message: auto_fix ? 'Formatted' : 'All files formatted' });
    } else {
      results.push({ name: 'Prettier', status: 'warn', message: 'Some files need formatting' });
    }
  } catch {
    results.push({ name: 'Prettier', status: 'warn', message: 'Not installed (optional)' });
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  ctx.emit('command:complete', {
    command: 'pre_build_check',
    output: JSON.stringify(results),
    agent: ctx.role,
    exitCode: overallPass ? 0 : 1,
  });

  // Build output
  let output = `═══════════════════════════════════════════════════════════════
PRE-BUILD CHECK RESULTS (${duration}s)
═══════════════════════════════════════════════════════════════

`;

  for (const r of results) {
    const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⚠️';
    output += `${icon} ${r.name}: ${r.message}\n`;
  }

  output += `\n═══════════════════════════════════════════════════════════════\n`;

  if (overallPass) {
    output += `✅ ALL CHECKS PASSED! Ready to mark story as testing.`;

    ctx.emitAgentMessage({
      agentRole: ctx.role,
      agentName: ctx.config.name,
      type: 'result',
      content: `✅ Pre-build checks passed in ${duration}s - ready to mark as testing!`,
    });
  } else {
    output += `❌ FIX TYPE ERRORS BEFORE BUILD!

The TypeScript errors above WILL cause build failure. Fix them first, then run pre_build_check() again.`;

    ctx.emitAgentMessage({
      agentRole: ctx.role,
      agentName: ctx.config.name,
      type: 'error',
      content: `❌ Pre-build check failed - fix TypeScript errors before building`,
    });
  }

  return output;
});
