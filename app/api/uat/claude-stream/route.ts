/**
 * Claude Stream API - With session resume support
 * Can resume previous sessions using Claude CLI's --resume flag
 * Uses ClaudeSubscriptionService - subscription based, not API credits
 */

import { NextRequest } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      let capturedSessionId: string | null = null;

      const sendOutput = (text: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ output: text })}\n\n`));
        } catch { isClosed = true; }
      };

      const sendStatus = (status: string, data?: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ status, ...data })}\n\n`));
        } catch { isClosed = true; }
      };

      const sendSessionId = (sessionId: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ claudeSessionId: sessionId })}\n\n`));
        } catch { isClosed = true; }
      };

      const safeClose = () => {
        isClosed = true;
        controller.close();
      };

      try {
        const { projectId, prompt, claudeSessionId, continueSession } = await request.json();

        if (!projectId || !prompt) {
          sendOutput('Error: Missing project ID or prompt\n');
          sendStatus('error', { error: 'Missing required fields' });
          safeClose();
          return;
        }

        const projectDir = getProjectDir(projectId).replace(/\\/g, '/');
        const isResuming = continueSession && claudeSessionId;

        if (isResuming) {
          sendOutput('🔄 Resuming session: ' + claudeSessionId.slice(0, 8) + '...\n');
        }
        sendOutput('$ ' + prompt + '\n');
        sendOutput('Working directory: ' + projectDir + '\n');
        sendOutput('─'.repeat(50) + '\n');

        try {
          // Build CLI args - use --resume if we have a session to continue
          const processId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const tempDir = os.tmpdir();
          const promptFile = path.join(tempDir, `claude-prompt-${processId}.txt`);
          fs.writeFileSync(promptFile, prompt, 'utf-8');

          const args = [
            '-p',
            '--model', 'sonnet',
            '--max-turns', '100',
            '--output-format', 'stream-json',
            '--verbose',
            '--dangerously-skip-permissions',
          ];

          // Add resume flag if continuing a session
          if (isResuming) {
            args.push('--resume', claudeSessionId);
          }

          const isWindows = process.platform === 'win32';
          const fullCommand = isWindows
            ? `type "${promptFile}" | claude ${args.join(' ')}`
            : `cat "${promptFile}" | claude ${args.join(' ')}`;

          const cleanEnv = { ...process.env };
          delete cleanEnv.ANTHROPIC_API_KEY;
          delete cleanEnv.TURBOPACK;
          delete cleanEnv.DATABASE_URL;
          cleanEnv.NODE_ENV = 'development';
          cleanEnv.CLAUDE_CODE_MAX_OUTPUT_TOKENS = '128000';

          const claudeProcess = spawn(fullCommand, [], {
            cwd: projectDir,
            shell: true,
            env: cleanEnv,
            stdio: ['ignore', 'pipe', 'pipe'],
          });

          // Clean up temp file when process ends
          claudeProcess.on('close', () => {
            try { fs.unlinkSync(promptFile); } catch {}
          });

          let buffer = '';

          claudeProcess.stdout?.on('data', (data: Buffer) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const event = JSON.parse(line);

                // Capture session ID from system events
                if (event.type === 'system' && event.session_id) {
                  capturedSessionId = event.session_id;
                  sendSessionId(event.session_id);
                }

                if (event.type === 'assistant' && event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === 'text' && block.text) {
                      sendOutput(block.text + '\n');
                    } else if (block.type === 'tool_use') {
                      sendOutput('\n╭─ ' + block.name + ' ─╮\n');
                      if (block.name === 'Read') {
                        sendOutput('│ Reading: ' + (block.input?.file_path || '') + '\n');
                      } else if (block.name === 'Edit') {
                        sendOutput('│ Editing: ' + (block.input?.file_path || '') + '\n');
                      } else if (block.name === 'Write') {
                        sendOutput('│ Writing: ' + (block.input?.file_path || '') + '\n');
                      } else if (block.name === 'Bash') {
                        sendOutput('│ Running: ' + (block.input?.command?.slice(0, 80) || '') + '\n');
                      } else if (block.name === 'Glob') {
                        sendOutput('│ Searching: ' + (block.input?.pattern || '') + '\n');
                      } else if (block.name === 'Grep') {
                        sendOutput('│ Grep: ' + (block.input?.pattern || '') + '\n');
                      } else {
                        const input = block.input ? JSON.stringify(block.input).slice(0, 100) : '';
                        sendOutput('│ Input: ' + input + '\n');
                      }
                    }
                  }
                } else if (event.type === 'user' && event.message?.content) {
                  for (const block of event.message.content) {
                    if (block.type === 'tool_result') {
                      const content = typeof block.content === 'string' ? block.content : JSON.stringify(block.content);
                      const resultLines = content.split('\n').slice(0, 8);
                      for (const rLine of resultLines) {
                        if (rLine.trim()) {
                          sendOutput('│ ' + rLine.slice(0, 100) + '\n');
                        }
                      }
                      if (content.split('\n').length > 8) {
                        sendOutput('│ ... (' + (content.split('\n').length - 8) + ' more lines)\n');
                      }
                      sendOutput('╰─────────────────╯\n');
                    }
                  }
                } else if (event.type === 'result') {
                  sendOutput('\n✓ ' + (event.result || 'Done').slice(0, 300) + '\n');
                }
              } catch {
                // Plain text output
                sendOutput(line + '\n');
              }
            }
          });

          claudeProcess.stderr?.on('data', (data: Buffer) => {
            const text = data.toString();
            if (text.includes('Error') || text.includes('error')) {
              sendOutput('⚠️ ' + text + '\n');
            }
          });

          await new Promise<void>((resolve) => {
            claudeProcess.on('close', (code) => {
              sendOutput('\n─────────────────────────────────────────────────\n');
              if (capturedSessionId) {
                sendOutput('💾 Session saved: ' + capturedSessionId.slice(0, 8) + '... (use Continue to resume)\n');
              }
              sendStatus('complete', {
                success: code === 0,
                claudeSessionId: capturedSessionId,
                canContinue: !!capturedSessionId
              });
              resolve();
            });
          });
        } catch (err: any) {
          sendOutput('\nError: ' + err.message + '\n');
          sendStatus('error', { error: err.message });
        }

        safeClose();

      } catch (error) {
        sendOutput('Error: ' + (error instanceof Error ? error.message : 'Unknown error') + '\n');
        sendStatus('error', { error: error instanceof Error ? error.message : 'Unknown error' });
        safeClose();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
