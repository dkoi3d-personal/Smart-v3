/**
 * Claude Subscription Service
 *
 * Spawns Claude Code CLI directly to run agents with your Claude Code subscription.
 * This does NOT use API credits - it uses your Pro/Max subscription.
 *
 * Uses direct process spawning with shell:true to work around Windows .cmd issues.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { hasEnabledMcpServers, loadMcpConfig } from '@/lib/mcp-config-store';
import { getFigmaToken } from '@/lib/figma/config-store';
import { createLogger } from '@/lib/logger';

// Service-level logger
const serviceLogger = createLogger('ClaudeSubscriptionService');

export interface AgentConfig {
  model?: 'opus' | 'sonnet' | 'haiku';
  maxTurns?: number;
  allowedTools?: string[];
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions';
  workingDirectory?: string;
  systemPrompt?: string;
  allowExtraUsage?: boolean;  // Use extra usage when hitting weekly/session limits
}

export interface AgentMessage {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'system' | 'complete';
  content: string;
  toolName?: string;
  toolInput?: any;
  sessionId?: string;
  cost?: number;
  tokens?: { input: number; output: number };
}

export class ClaudeSubscriptionService extends EventEmitter {
  private activeProcesses: Map<string, ChildProcess> = new Map();
  private emittedStoryIds: Set<string> = new Set();
  private emittedEpicIds: Set<string> = new Set();

  constructor() {
    super();

    // Warn if API key is set
    if (process.env.ANTHROPIC_API_KEY) {
      serviceLogger.warn('ANTHROPIC_API_KEY is set! This may use API credits instead of your subscription.');
    }
  }

  /**
   * Run an agent with the given prompt and config
   * Returns an async generator that yields messages as they arrive
   */
  async *runAgent(
    prompt: string,
    config: AgentConfig = {}
  ): AsyncGenerator<AgentMessage> {
    const {
      model = 'opus',  // Use Opus 4.5 for best quality
      maxTurns = 50,
      permissionMode = 'bypassPermissions',
      workingDirectory,
      allowExtraUsage = true,  // Default to true - use extra usage when hitting limits
    } = config;

    serviceLogger.log(`Starting agent with model: ${model}`);
    serviceLogger.debug(`Working directory: ${workingDirectory || process.cwd()}`);

    const processId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Write prompt to a temp file to avoid command line length limits on Windows
    const tempDir = os.tmpdir();
    const promptFile = path.join(tempDir, `claude-prompt-${processId}.txt`);
    fs.writeFileSync(promptFile, prompt, 'utf-8');
    serviceLogger.debug(`Wrote prompt to temp file: ${promptFile}`);

    // Build CLI arguments using stdin from file
    const args = [
      '-p',  // Print mode
      '--model', model,
      '--max-turns', String(maxTurns),  // Limit agentic loop iterations to prevent infinite loops
      '--output-format', 'stream-json',
      '--verbose',  // Required for stream-json output
    ];

    // Check if MCP servers are enabled and add config flag
    const mcpEnabled = await hasEnabledMcpServers();
    const mcpConfig = await loadMcpConfig();
    if (mcpEnabled) {
      const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
      if (fs.existsSync(mcpConfigPath)) {
        args.push('--mcp-config', mcpConfigPath);
        console.log(`[ClaudeSubscriptionService] MCP enabled, using config: ${mcpConfigPath}`);
      }
    }

    // Load Figma token if Figma MCP is enabled
    let figmaToken: string | null = null;
    if (mcpConfig.figmaMcpEnabled) {
      figmaToken = await getFigmaToken();
      if (figmaToken) {
        console.log(`[ClaudeSubscriptionService] Figma token loaded for MCP`);
      } else {
        console.warn(`[ClaudeSubscriptionService] Figma MCP enabled but no token found`);
      }
    }

    if (permissionMode === 'bypassPermissions') {
      args.push('--dangerously-skip-permissions');
    } else if (permissionMode === 'acceptEdits') {
      args.push('--permission-mode', 'acceptEdits');
    }

    // Note: Extra usage is controlled through Claude account settings, not CLI flags
    // When limits are hit, Claude will automatically use extra usage if enabled in your account

    console.log(`[ClaudeSubscriptionService] Spawning claude with model: ${model}`);
    console.log(`[ClaudeSubscriptionService] CWD: ${workingDirectory || process.cwd()}`);
    console.log(`[ClaudeSubscriptionService] Prompt length: ${prompt.length}`);
    console.log(`[ClaudeSubscriptionService] Full command: claude ${args.join(' ')}`);

    // Create clean environment for Claude CLI
    const cleanEnv = { ...process.env };

    // Remove ANTHROPIC_API_KEY so Claude uses subscription instead of API
    if (cleanEnv.ANTHROPIC_API_KEY) {
      console.log(`[ClaudeSubscriptionService] Removing ANTHROPIC_API_KEY from env to use subscription`);
      delete cleanEnv.ANTHROPIC_API_KEY;
    }

    // Inject Figma token for MCP if available
    if (figmaToken) {
      cleanEnv.FIGMA_PERSONAL_ACCESS_TOKEN = figmaToken;
      cleanEnv.FIGMA_API_KEY = figmaToken; // Some MCP servers use this name
      console.log(`[ClaudeSubscriptionService] Injected Figma token into environment`);
    }

    // Use system default Claude config (whatever account user logged in with via setup-token)
    console.log(`[ClaudeSubscriptionService] Using default Claude config`);

    // Remove turbopack-related env vars to prevent build errors in generated projects
    delete cleanEnv.TURBOPACK;
    delete cleanEnv.NEXT_CLI_TURBO;
    delete cleanEnv.__NEXT_EXPERIMENTAL_TURBO;

    // Remove DATABASE_URL so child projects use their own .env instead of inheriting studio's
    delete cleanEnv.DATABASE_URL;

    // Set a clean NODE_ENV
    cleanEnv.NODE_ENV = 'development';

    // Increase output token limit to handle large architecture responses
    cleanEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS = '128000';

    // On Windows, use shell redirection to pipe the temp file to stdin
    // This avoids issues with spawn stdin on Windows
    const isWindows = process.platform === 'win32';
    const fullCommand = isWindows
      ? `type "${promptFile}" | claude ${args.join(' ')}`
      : `cat "${promptFile}" | claude ${args.join(' ')}`;

    console.log(`[ClaudeSubscriptionService] Running command: ${fullCommand.substring(0, 200)}...`);

    // Spawn with shell:true to handle Windows .cmd files and redirection
    const claudeProcess = spawn(fullCommand, [], {
      cwd: workingDirectory || process.cwd(),
      shell: true,
      env: cleanEnv,
      stdio: ['ignore', 'pipe', 'pipe'],  // stdin is handled by shell redirection
    });

    console.log(`[ClaudeSubscriptionService] Process spawned, PID: ${claudeProcess.pid}`);

    this.activeProcesses.set(processId, claudeProcess);

    // Clean up temp file when process ends
    claudeProcess.on('close', () => {
      try {
        fs.unlinkSync(promptFile);
        console.log(`[ClaudeSubscriptionService] Cleaned up temp file: ${promptFile}`);
      } catch (e) {
        // Ignore cleanup errors
      }
    });

    // Create async generator from process output
    console.log(`[ClaudeSubscriptionService] Starting to process output...`);
    yield* this.processOutput(claudeProcess, processId);
    console.log(`[ClaudeSubscriptionService] Finished processing output`);
  }

  /**
   * Process stdout from Claude CLI and yield messages
   */
  private async *processOutput(
    process: ChildProcess,
    processId: string
  ): AsyncGenerator<AgentMessage> {
    let buffer = '';
    const messages: AgentMessage[] = [];
    let resolveNext: ((value: AgentMessage | null) => void) | null = null;
    let done = false;

    // Handle stdout data
    process.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const event = JSON.parse(line);
          console.log(`[ClaudeSubscriptionService] Event type: ${event.type}`);
          const msg = this.parseEvent(event);
          if (msg) {
            console.log(`[ClaudeSubscriptionService] Parsed message: ${msg.type} - ${msg.content?.substring(0, 100)}`);
            if (resolveNext) {
              resolveNext(msg);
              resolveNext = null;
            } else {
              messages.push(msg);
            }
          }
        } catch (e) {
          // Plain text output
          console.log(`[ClaudeSubscriptionService] Plain text: ${line.substring(0, 100)}`);
          const msg: AgentMessage = {
            type: 'text',
            content: line,
          };
          if (resolveNext) {
            resolveNext(msg);
            resolveNext = null;
          } else {
            messages.push(msg);
          }
        }
      }
    });

    // Handle stderr (Claude outputs progress info here)
    const stderrChunks: string[] = [];
    process.stderr?.on('data', (data: Buffer) => {
      const stderrText = data.toString();
      stderrChunks.push(stderrText);
      console.log(`[ClaudeSubscriptionService] stderr:`, stderrText);

      // Check for quota/limit errors - these are informational if extra usage is enabled
      const isQuotaError = stderrText.toLowerCase().includes('rate limit') ||
                          stderrText.toLowerCase().includes('quota') ||
                          stderrText.toLowerCase().includes('usage limit') ||
                          stderrText.toLowerCase().includes('weekly limit') ||
                          stderrText.toLowerCase().includes('session limit') ||
                          stderrText.includes('429');

      if (isQuotaError) {
        console.log(`[ClaudeSubscriptionService] Quota/rate limit message detected - extra usage should handle this`);
        const msg: AgentMessage = {
          type: 'system',
          content: `Rate/quota limit reached - using extra usage: ${stderrText}`,
        };
        if (resolveNext) {
          resolveNext(msg);
          resolveNext = null;
        } else {
          messages.push(msg);
        }
      }
      // Check for other error patterns
      else if (stderrText.includes('Error') || stderrText.includes('error')) {
        const msg: AgentMessage = {
          type: 'error',
          content: `Claude stderr: ${stderrText}`,
        };
        if (resolveNext) {
          resolveNext(msg);
          resolveNext = null;
        } else {
          messages.push(msg);
        }
      }
    });

    // Handle process end
    process.on('close', (code) => {
      console.log(`[ClaudeSubscriptionService] Process exited with code ${code}`);
      this.activeProcesses.delete(processId);
      done = true;

      // Signal completion
      const msg: AgentMessage = {
        type: 'complete',
        content: `Agent completed with exit code ${code}`,
      };
      if (resolveNext) {
        resolveNext(msg);
        resolveNext = null;
      } else {
        messages.push(msg);
      }
    });

    process.on('error', (error) => {
      console.error(`[ClaudeSubscriptionService] Process error:`, error);
      done = true;
      const msg: AgentMessage = {
        type: 'error',
        content: error.message,
      };
      if (resolveNext) {
        resolveNext(msg);
        resolveNext = null;
      } else {
        messages.push(msg);
      }
    });

    // Yield messages as they arrive
    while (!done || messages.length > 0) {
      if (messages.length > 0) {
        const msg = messages.shift()!;
        yield msg;
        if (msg.type === 'complete' || msg.type === 'error') {
          break;
        }
      } else if (!done) {
        // Wait for next message
        const msg = await new Promise<AgentMessage | null>((resolve) => {
          resolveNext = resolve;
          // Timeout to check done status
          setTimeout(() => {
            if (resolveNext === resolve) {
              resolveNext = null;
              resolve(null);
            }
          }, 100);
        });
        if (msg) {
          yield msg;
          if (msg.type === 'complete' || msg.type === 'error') {
            break;
          }
        }
      }
    }
  }

  /**
   * Parse a JSON event from Claude CLI stream-json output
   */
  private parseEvent(event: any): AgentMessage | null {
    switch (event.type) {
      case 'assistant':
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'text' && block.text) {
              return {
                type: 'text',
                content: block.text,
              };
            } else if (block.type === 'tool_use') {
              // Emit file events
              if (block.name === 'Write' || block.name === 'write_file') {
                const filePath = block.input?.file_path || block.input?.path;
                const content = block.input?.content;

                this.emit('file:write', {
                  path: filePath,
                  content: content,
                });

                // Check if this is a stories file - emit individual story/epic events
                // Only emit for FIRST write of this file to avoid duplicates
                if (filePath && (filePath.includes('.agile-stories.json') || filePath.includes('.agent-stories.json') || filePath.includes('stories.json'))) {
                  try {
                    const stories = JSON.parse(content);
                    // Emit epic events (only for new epics)
                    for (const epic of stories.epics || []) {
                      if (!this.emittedEpicIds.has(epic.id)) {
                        console.log(`[ClaudeSubscriptionService] Emitting epic:created for ${epic.id}`);
                        this.emit('epic:created', epic);
                        this.emittedEpicIds.add(epic.id);
                      }
                    }
                    // Emit task/story events (only for new tasks)
                    for (const task of stories.tasks || []) {
                      if (!this.emittedStoryIds.has(task.id)) {
                        console.log(`[ClaudeSubscriptionService] Emitting task:created for ${task.id}`);
                        this.emit('task:created', task);
                        this.emittedStoryIds.add(task.id);
                      }
                    }
                  } catch (e) {
                    console.log(`[ClaudeSubscriptionService] Could not parse stories file: ${e}`);
                  }
                }
              } else if (block.name === 'Edit' || block.name === 'edit_file') {
                this.emit('file:edit', {
                  path: block.input?.file_path || block.input?.path,
                });
              } else if (block.name === 'Bash' || block.name === 'bash') {
                this.emit('command:run', {
                  command: block.input?.command,
                });
              }

              return {
                type: 'tool_use',
                content: `Using tool: ${block.name}`,
                toolName: block.name,
                toolInput: block.input,
              };
            }
          }
        }
        return null;

      case 'user':
        // Tool results
        if (event.message?.content) {
          for (const block of event.message.content) {
            if (block.type === 'tool_result') {
              return {
                type: 'tool_result',
                content: typeof block.content === 'string'
                  ? block.content.substring(0, 500)
                  : JSON.stringify(block.content).substring(0, 500),
              };
            }
          }
        }
        return null;

      case 'result':
        return {
          type: 'complete',
          content: event.result || 'Agent completed',
          cost: event.total_cost_usd,
          tokens: {
            input: event.input_tokens || 0,
            output: event.output_tokens || 0,
          },
        };

      case 'system':
        return {
          type: 'system',
          content: event.message || 'System event',
          sessionId: event.session_id,
        };

      default:
        return null;
    }
  }

  /**
   * Interrupt an active agent
   */
  async interruptAgent(processId: string): Promise<void> {
    const proc = this.activeProcesses.get(processId);
    if (proc) {
      proc.kill();
      this.activeProcesses.delete(processId);
    }
  }

  /**
   * Get count of active agents
   */
  getActiveCount(): number {
    return this.activeProcesses.size;
  }

  /**
   * Clear all active agents and reset tracking state
   */
  async clearAll(): Promise<void> {
    for (const [id, proc] of this.activeProcesses) {
      proc.kill();
    }
    this.activeProcesses.clear();
    // Reset story/epic tracking for new builds
    this.emittedStoryIds.clear();
    this.emittedEpicIds.clear();
  }
}

// Export singleton instance
export const claudeSubscriptionService = new ClaudeSubscriptionService();
