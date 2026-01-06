/**
 * Claude Code Service v2
 * Simplified agent service using Claude SDK with streaming support
 *
 * Key Features:
 * - Real-time streaming responses via SSE
 * - Tool execution for file operations and bash commands
 * - Session persistence for resumable workflows
 * - Two modes: Plan and Build
 */

import Anthropic from '@anthropic-ai/sdk';
import * as fs from 'fs/promises';
import { execSync, spawn } from 'child_process';
import path from 'path';
import { glob } from 'glob';
import { EventEmitter } from 'events';
import { normalizePathForGlob } from '@/lib/cross-platform';
import { promptGenerator } from '@/lib/services/prompt-generator';

// Types
export interface StreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'done' | 'error';
  content: string;
  toolName?: string;
  toolInput?: Record<string, any>;
  toolResult?: string;
}

export interface SessionState {
  id: string;
  projectId: string;
  mode: 'plan' | 'build' | 'iterate';
  messages: Anthropic.MessageParam[];
  tasks: Task[];
  createdAt: Date;
  updatedAt: Date;
  workingDirectory: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  files?: string[];
  result?: string;
  updatedAt?: Date;
}

export interface BuildOptions {
  projectId: string;
  requirements: string;
  workingDirectory: string;
  mode: 'plan' | 'build' | 'iterate';
  sessionId?: string;
  tasks?: Task[];
}

// Tool definitions for Claude
const tools: Anthropic.Tool[] = [
  {
    name: 'write_file',
    description: 'Write content to a file. Creates the file if it doesn\'t exist, overwrites if it does. Always use this to create new files.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to working directory',
        },
        content: {
          type: 'string',
          description: 'The file content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the contents of a file',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to working directory',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'edit_file',
    description: 'Edit a specific section of a file by replacing old content with new content',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'File path relative to working directory',
        },
        old_content: {
          type: 'string',
          description: 'The exact content to find and replace',
        },
        new_content: {
          type: 'string',
          description: 'The replacement content',
        },
      },
      required: ['path', 'old_content', 'new_content'],
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command and return stdout/stderr. Use for npm install, git, builds, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
        timeout: {
          type: 'number',
          description: 'Timeout in milliseconds (default: 60000)',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory matching a glob pattern',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'Glob pattern (e.g., "**/*.ts", "src/**/*.tsx")',
        },
        directory: {
          type: 'string',
          description: 'Directory to search in (default: working directory)',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'search_files',
    description: 'Search for a pattern in files (like grep)',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'The search pattern (regex supported)',
        },
        directory: {
          type: 'string',
          description: 'Directory to search in (default: working directory)',
        },
        file_pattern: {
          type: 'string',
          description: 'Only search files matching this glob pattern',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task in the task list for tracking work',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: {
          type: 'string',
          description: 'Short task title',
        },
        description: {
          type: 'string',
          description: 'Detailed task description',
        },
      },
      required: ['title', 'description'],
    },
  },
  {
    name: 'update_task',
    description: 'Update the status of an existing task',
    input_schema: {
      type: 'object' as const,
      properties: {
        task_id: {
          type: 'string',
          description: 'The task ID to update',
        },
        status: {
          type: 'string',
          enum: ['pending', 'in_progress', 'completed', 'failed'],
          description: 'New task status',
        },
        result: {
          type: 'string',
          description: 'Optional result or notes about the task',
        },
      },
      required: ['task_id', 'status'],
    },
  },
];

export class ClaudeCodeService extends EventEmitter {
  private client: Anthropic;
  private sessions: Map<string, SessionState> = new Map();

  constructor() {
    super();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not found in environment variables');
    }
    this.client = new Anthropic({ apiKey: apiKey || 'sk-placeholder' });
  }

  /**
   * Validate and normalize a path to ensure it stays within the project directory
   * Prevents path traversal attacks (e.g., ../../../etc/passwd)
   */
  private validatePath(filePath: string, baseDir: string): string {
    // Normalize the path first
    const normalizedBase = path.resolve(baseDir);

    // Handle both absolute and relative paths
    const absolutePath = path.isAbsolute(filePath)
      ? path.resolve(filePath)
      : path.resolve(baseDir, filePath);

    // Ensure the resolved path is within the base directory
    if (!absolutePath.startsWith(normalizedBase + path.sep) && absolutePath !== normalizedBase) {
      throw new Error(`Security: Path "${filePath}" escapes project directory. All files must be within the project folder.`);
    }

    return absolutePath;
  }

  /**
   * Validate a command to prevent dangerous operations outside the project
   */
  private validateCommand(command: string, baseDir: string): void {
    const normalizedBase = path.resolve(baseDir);

    // Block potentially dangerous commands that could affect the parent codebase
    const dangerousPatterns = [
      /rm\s+-rf?\s+\//, // rm -rf /
      /rm\s+-rf?\s+~/, // rm -rf ~
      /rm\s+-rf?\s+\.\./, // rm -rf ..
      />\s*\//, // redirect to root
      />\s*\.\./, // redirect to parent
      /cd\s+\.\./, // cd to parent (in compound commands)
      /npm\s+(link|publish)/, // npm link/publish could affect global
      /git\s+push/, // prevent pushing from within projects
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        throw new Error(`Security: Command "${command}" is not allowed as it could affect files outside the project.`);
      }
    }
  }

  /**
   * Execute a tool and return the result
   */
  private async executeTool(
    toolName: string,
    toolInput: Record<string, any>,
    workingDirectory: string,
    session: SessionState
  ): Promise<string> {
    const baseDir = workingDirectory;

    try {
      switch (toolName) {
        case 'write_file': {
          const { path: filePath, content } = toolInput;
          // Validate path stays within project directory
          const absolutePath = this.validatePath(filePath, baseDir);

          await fs.mkdir(path.dirname(absolutePath), { recursive: true });
          await fs.writeFile(absolutePath, content, 'utf-8');

          this.emit('file:changed', { path: absolutePath, action: 'write', content });
          return `Successfully wrote ${content.length} bytes to ${filePath}`;
        }

        case 'read_file': {
          const { path: filePath } = toolInput;
          // Validate path stays within project directory
          const absolutePath = this.validatePath(filePath, baseDir);

          const content = await fs.readFile(absolutePath, 'utf-8');
          return content;
        }

        case 'edit_file': {
          const { path: filePath, old_content, new_content } = toolInput;
          // Validate path stays within project directory
          const absolutePath = this.validatePath(filePath, baseDir);

          let content = await fs.readFile(absolutePath, 'utf-8');
          if (!content.includes(old_content)) {
            return `Error: Could not find the exact content to replace in ${filePath}`;
          }

          content = content.replace(old_content, new_content);
          await fs.writeFile(absolutePath, content, 'utf-8');

          this.emit('file:changed', { path: absolutePath, action: 'edit', content });
          return `Successfully edited ${filePath}`;
        }

        case 'run_command': {
          const { command, timeout = 60000 } = toolInput;

          // Validate command is safe
          this.validateCommand(command, baseDir);

          this.emit('command:start', { command });

          try {
            const output = execSync(command, {
              cwd: baseDir,
              encoding: 'utf-8',
              maxBuffer: 10 * 1024 * 1024,
              timeout,
            });

            this.emit('command:complete', { command, output });
            return output || 'Command executed successfully (no output)';
          } catch (error: any) {
            const errorMsg = error.stderr || error.message || String(error);
            this.emit('command:error', { command, error: errorMsg });
            return `Command failed: ${errorMsg}`;
          }
        }

        case 'list_files': {
          const { pattern, directory } = toolInput;
          // Validate directory stays within project
          const searchDir = directory
            ? this.validatePath(directory, baseDir)
            : baseDir;

          // Normalize path for glob (cross-platform compatible)
          const normalizedSearchDir = normalizePathForGlob(searchDir);
          const matches = await glob(pattern, {
            cwd: normalizedSearchDir,
            ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/dist/**'],
            absolute: false,
          });

          return matches.length > 0
            ? matches.slice(0, 100).join('\n')
            : `No files found matching pattern: ${pattern}`;
        }

        case 'search_files': {
          const { pattern, directory, file_pattern } = toolInput;
          // Validate directory stays within project
          const searchDir = directory
            ? this.validatePath(directory, baseDir)
            : baseDir;

          const results: string[] = [];
          const regex = new RegExp(pattern, 'i');

          // Normalize path for glob (cross-platform compatible)
          const normalizedSearchDir = normalizePathForGlob(searchDir);

          // Get files to search
          const files = await glob(file_pattern || '**/*', {
            cwd: normalizedSearchDir,
            ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**'],
            nodir: true,
          });

          for (const file of files.slice(0, 50)) {
            try {
              const content = await fs.readFile(path.join(searchDir, file), 'utf-8');
              const lines = content.split('\n');

              lines.forEach((line, index) => {
                if (regex.test(line)) {
                  results.push(`${file}:${index + 1}:${line.trim()}`);
                }
              });
            } catch {
              // Skip files that can't be read
            }
          }

          return results.length > 0
            ? results.slice(0, 100).join('\n')
            : `No matches found for pattern: ${pattern}`;
        }

        case 'create_task': {
          const { title, description } = toolInput;
          const task: Task = {
            id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            title,
            description,
            status: 'pending',
          };

          session.tasks.push(task);
          this.emit('task:created', task);
          return `Created task: ${task.id} - ${title}`;
        }

        case 'update_task': {
          const { task_id, status, result } = toolInput;
          const task = session.tasks.find(t => t.id === task_id);

          if (!task) {
            return `Error: Task ${task_id} not found`;
          }

          task.status = status;
          if (result) task.result = result;
          task.updatedAt = new Date();

          this.emit('task:updated', task);
          return `Updated task ${task_id} to status: ${status}`;
        }

        default:
          return `Error: Unknown tool '${toolName}'`;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      return `Error executing tool '${toolName}': ${errorMsg}`;
    }
  }

  /**
   * Get system prompt based on mode
   */
  private getSystemPrompt(mode: 'plan' | 'build' | 'iterate', projectName?: string): string {
    if (mode === 'plan') {
      return `You are an expert software architect and product owner. Your job is to analyze requirements and create a clear, actionable plan.

When given requirements:
1. Analyze the scope and complexity
2. Break down into simple, focused tasks (not epics/stories - just tasks)
3. For simple apps (hello world, single page apps), create 1-3 tasks maximum
4. For medium apps, create 3-7 tasks
5. For complex apps, create up to 15 tasks

Each task should be:
- Specific and actionable
- Achievable in a single coding session
- Independent when possible

Use the create_task tool to create each task in the list.

Output your plan as a clear markdown document with:
- Project Overview (2-3 sentences)
- Tech Stack recommendation
- Task List (use create_task for each)
- Any assumptions or clarifications needed

CRITICAL: For Next.js apps, ALWAYS include a task for creating \`app/page.tsx\` (the root homepage).
This is required for localhost:3000 to work - without it users get a 404 error.

Be concise. Don't over-engineer simple requests.`;
    }

    if (mode === 'iterate') {
      return `You are Claude Code, an expert software developer in ITERATION mode. The project already exists and you need to make targeted changes.

Project: ${projectName || 'Unnamed Project'}

IMPORTANT - PROJECT ISOLATION:
- This project is isolated in its own directory
- All file paths must be relative to the project root
- You CANNOT access files outside the project directory
- Do NOT use ".." or absolute paths to access parent directories

Your workflow for iteration:
1. FIRST: Read the relevant existing files to understand the current code
2. Analyze the issue or feature request
3. Make MINIMAL, targeted changes - don't rewrite entire files
4. Use edit_file when possible instead of write_file to preserve existing code
5. If you add new dependencies, run npm install
6. If you fix compilation errors, verify with a build command

Common issues and fixes:
- Missing dependencies: Check package.json, run npm install <package>
- TypeScript errors: Check types, add missing imports
- Build errors: Read the error message carefully, fix the specific issue
- Runtime errors: Check for null/undefined, async/await issues

${this.getPlatformServicesPrompt()}

Guidelines:
- Be surgical - change only what's necessary
- Keep existing code style and patterns
- Test your changes work before finishing
- Explain what you changed and why`;
    }

    return `You are Claude Code, an expert software developer. You have access to tools for reading, writing, and editing files, as well as running shell commands.

Project: ${projectName || 'Unnamed Project'}

IMPORTANT - PROJECT ISOLATION:
- This project is isolated in its own directory
- All file paths must be relative to the project root
- You CANNOT access files outside the project directory
- Do NOT use ".." or absolute paths to access parent directories
- All your code and files must stay within this project folder

Your workflow:
1. Review the tasks assigned to you
2. For each task, update its status to 'in_progress' before starting
3. Write clean, production-ready code
4. Test your code by running relevant commands
5. Mark tasks as 'completed' when done

${this.getPlatformServicesPrompt()}

Guidelines:
- Write modern, clean code following best practices
- For React/Next.js: Use TypeScript, functional components, hooks
- Include proper error handling
- Write self-documenting code with clear variable names
- Create necessary config files (package.json, tsconfig, etc.)
- Run npm install when adding dependencies
- Test that the code compiles and basic functionality works

CRITICAL - ROOT PAGE REQUIREMENT:
- You MUST create an \`app/page.tsx\` file that serves as the homepage
- This is the page users see when they visit localhost:3000
- Without this file, the app will show a 404 error on the root URL
- The root page should either:
  1. Be the main landing/home page of the app, OR
  2. Redirect to the appropriate main page (e.g., /dashboard, /login)
- Always verify \`app/page.tsx\` exists before completing the build

When you complete all tasks, summarize what was built and how to run it.`;
  }

  /**
   * Get platform services documentation for the agent
   * Uses the dynamic service catalog for up-to-date service information
   */
  private getPlatformServicesPrompt(): string {
    return promptGenerator.generateServicesPrompt({
      includeApis: true,
      includeMcp: true,
      includeLlms: false,
      verbosity: 'standard',
      includeExamples: true,
    });
  }

  /**
   * Create or resume a session
   */
  async createSession(options: BuildOptions): Promise<SessionState> {
    const sessionId = options.sessionId || `session-${Date.now()}`;

    // Check for existing session
    if (options.sessionId && this.sessions.has(options.sessionId)) {
      const existing = this.sessions.get(options.sessionId)!;
      existing.updatedAt = new Date();
      return existing;
    }

    const session: SessionState = {
      id: sessionId,
      projectId: options.projectId,
      mode: options.mode,
      messages: [],
      tasks: options.tasks || [],
      createdAt: new Date(),
      updatedAt: new Date(),
      workingDirectory: options.workingDirectory,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Run the agent with streaming
   * Yields StreamEvents as they occur
   */
  async *runStream(options: BuildOptions): AsyncGenerator<StreamEvent> {
    const session = await this.createSession(options);
    const systemPrompt = this.getSystemPrompt(options.mode, options.projectId);

    // Build initial user message
    let userContent = options.requirements;
    if (options.tasks && options.tasks.length > 0) {
      userContent += '\n\nTasks to complete:\n';
      options.tasks.forEach((task, i) => {
        userContent += `${i + 1}. [${task.status}] ${task.title}: ${task.description}\n`;
      });
    }

    session.messages.push({ role: 'user', content: userContent });

    let iteration = 0;
    const maxIterations = 25;

    while (iteration < maxIterations) {
      iteration++;

      yield { type: 'thinking', content: `Iteration ${iteration}/${maxIterations}` };

      // Sliding context window: keep messages manageable (20-30% token savings)
      // Keep first 2 messages (original prompt) + last 12 messages (6 recent turns)
      const MAX_MESSAGES = 14;
      if (session.messages.length > MAX_MESSAGES) {
        const firstMessages = session.messages.slice(0, 2); // Original user prompt + first response
        const recentMessages = session.messages.slice(-12); // Last 6 turns
        session.messages = [...firstMessages, ...recentMessages];
      }

      try {
        // Create streaming message
        const stream = await this.client.messages.stream({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 8192,
          system: systemPrompt,
          tools,
          messages: session.messages,
        });

        let assistantContent: Anthropic.ContentBlock[] = [];
        let currentText = '';

        // Process the stream
        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const delta = event.delta as any;
            if (delta.type === 'text_delta') {
              currentText += delta.text;
              yield { type: 'text', content: delta.text };
            }
          } else if (event.type === 'content_block_stop') {
            // Block finished
          } else if (event.type === 'message_stop') {
            // Message complete
          }
        }

        // Get the final message
        const finalMessage = await stream.finalMessage();
        assistantContent = finalMessage.content;

        // Add assistant response to messages
        session.messages.push({ role: 'assistant', content: assistantContent });

        // Check for tool use
        const toolUseBlocks = assistantContent.filter(
          (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
        );

        if (toolUseBlocks.length === 0) {
          // No more tool use, we're done
          yield { type: 'done', content: 'Completed' };
          break;
        }

        // Execute tools in PARALLEL for speed (15-20% faster)
        // First, yield all tool_use events (fast, sequential for UI)
        for (const toolUse of toolUseBlocks) {
          yield {
            type: 'tool_use',
            content: `Using tool: ${toolUse.name}`,
            toolName: toolUse.name,
            toolInput: toolUse.input as Record<string, any>,
          };
        }

        // Execute all tools in parallel
        const toolExecutions = await Promise.all(
          toolUseBlocks.map(async (toolUse) => ({
            toolUse,
            result: await this.executeTool(
              toolUse.name,
              toolUse.input as Record<string, any>,
              session.workingDirectory,
              session
            ),
          }))
        );

        // Build results and yield tool_result events
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const { toolUse, result } of toolExecutions) {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolUse.id,
            content: result,
          });

          yield {
            type: 'tool_result',
            content: result.substring(0, 500) + (result.length > 500 ? '...' : ''),
            toolName: toolUse.name,
            toolResult: result,
          };
        }

        // Add tool results to messages
        session.messages.push({ role: 'user', content: toolResults });

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        yield { type: 'error', content: errorMsg };
        break;
      }
    }

    if (iteration >= maxIterations) {
      yield { type: 'error', content: 'Max iterations reached' };
    }

    // Save session state
    session.updatedAt = new Date();
  }

  /**
   * Run without streaming (returns final result)
   */
  async run(options: BuildOptions): Promise<{ tasks: Task[]; result: string }> {
    let result = '';
    const tasks: Task[] = [];

    for await (const event of this.runStream(options)) {
      if (event.type === 'text') {
        result += event.content;
      }
      // Task events handled via EventEmitter
    }

    const session = this.sessions.get(options.sessionId || '');
    return {
      tasks: session?.tasks || tasks,
      result,
    };
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Save session to disk for persistence
   */
  async saveSession(sessionId: string, projectDir: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const sessionPath = path.join(projectDir, '.claude-session.json');
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));
  }

  /**
   * Load session from disk
   */
  async loadSession(projectDir: string): Promise<SessionState | null> {
    const sessionPath = path.join(projectDir, '.claude-session.json');

    try {
      const content = await fs.readFile(sessionPath, 'utf-8');
      const session = JSON.parse(content) as SessionState;
      this.sessions.set(session.id, session);
      return session;
    } catch {
      return null;
    }
  }
}

// Singleton instance
export const claudeCodeService = new ClaudeCodeService();
