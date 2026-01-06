/**
 * Stream API Endpoint
 * Server-Sent Events (SSE) for real-time streaming of Claude responses
 */

import { NextRequest } from 'next/server';
import { claudeCodeService, Task, StreamEvent } from '@/services/claude-code-service';
import * as fs from 'fs/promises';
import path from 'path';
import { ensureProjectDir } from '@/lib/project-paths';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, mode = 'build', requirements, sessionId } = body;

  // Validate inputs
  if (!projectId) {
    return new Response(
      JSON.stringify({ error: 'Project ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Find project directory OUTSIDE of ai-dev-platform-v2
  const projectDir = await ensureProjectDir(projectId);

  // Load project metadata if exists
  let projectMeta: any = { projectId, name: projectId };
  try {
    projectMeta = JSON.parse(
      await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8')
    );
  } catch {
    // No metadata yet
  }

  // Load existing tasks if any
  let tasks: Task[] = [];
  try {
    tasks = JSON.parse(
      await fs.readFile(path.join(projectDir, 'tasks.json'), 'utf-8')
    );
  } catch {
    // No tasks yet
  }

  // Build the prompt based on mode
  let prompt = requirements || projectMeta.requirements || '';

  if (mode === 'build') {
    // Try to load plan
    try {
      const plan = await fs.readFile(path.join(projectDir, 'plan.md'), 'utf-8');
      prompt = `Project: ${projectMeta.name}\n\nPlan:\n${plan}\n\nRequirements:\n${prompt}`;
    } catch {
      prompt = `Project: ${projectMeta.name}\n\nRequirements:\n${prompt}`;
    }
  } else if (mode === 'iterate') {
    // Iterate mode - for fixing errors or adding features to existing code
    // Load existing files to give context
    const existingFiles: string[] = [];
    try {
      const { glob } = await import('glob');
      // Normalize path for glob (use forward slashes on Windows)
      const normalizedDir = projectDir.replace(/\\/g, '/');
      const files = await glob('**/*', {
        cwd: normalizedDir,
        ignore: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/dist/**'],
        nodir: true,
      });
      existingFiles.push(...files.slice(0, 20)); // Limit to 20 files for context
    } catch {
      // Ignore glob errors
    }

    prompt = `Project: ${projectMeta.name}

You are in ITERATION mode. The project already exists with these files:
${existingFiles.map(f => `- ${f}`).join('\n')}

User request:
${requirements}

Instructions:
- Read existing files before making changes
- Make targeted changes to fix the issue or add the requested feature
- Do NOT rewrite entire files unless necessary
- Run any necessary commands (npm install, etc.) after changes
- Test that the changes work`;
  }

  // Create SSE stream
  const encoder = new TextEncoder();

  // Track build metrics
  const buildMetrics = {
    startTime: Date.now(),
    filesCreated: 0,
    filesModified: 0,
    commandsRun: 0,
    toolCalls: 0,
    tokensUsed: 0,
    linesOfCode: 0,
    iterations: 0,
  };

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return; // Prevent writes after close
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          // Controller may have been closed
          isClosed = true;
        }
      };

      // Send metrics update
      const sendMetrics = () => {
        sendEvent('metrics', {
          ...buildMetrics,
          elapsedTime: Date.now() - buildMetrics.startTime,
        });
      };

      try {
        // Send initial connection event
        sendEvent('connected', { projectId, mode, sessionId, startTime: buildMetrics.startTime });

        // Set up task event listeners
        const onTaskCreated = (task: Task) => {
          sendEvent('task:created', task);
        };

        const onTaskUpdated = (task: Task) => {
          sendEvent('task:updated', task);
        };

        const onFileChanged = (data: { path: string; action: string; content?: string }) => {
          if (data.action === 'write') {
            buildMetrics.filesCreated++;
            if (data.content) {
              buildMetrics.linesOfCode += data.content.split('\n').length;
            }
          } else if (data.action === 'edit') {
            buildMetrics.filesModified++;
          }
          sendEvent('file:changed', data);
          sendMetrics();
        };

        const onCommandStart = (data: { command: string }) => {
          buildMetrics.commandsRun++;
          sendEvent('command:start', data);
          sendMetrics();
        };

        const onCommandComplete = (data: { command: string; output: string }) => {
          sendEvent('command:complete', { command: data.command, output: data.output.substring(0, 1000) });
        };

        claudeCodeService.on('task:created', onTaskCreated);
        claudeCodeService.on('task:updated', onTaskUpdated);
        claudeCodeService.on('file:changed', onFileChanged);
        claudeCodeService.on('command:start', onCommandStart);
        claudeCodeService.on('command:complete', onCommandComplete);

        // Run the agent with streaming
        for await (const event of claudeCodeService.runStream({
          projectId,
          requirements: prompt,
          workingDirectory: projectDir,
          mode: mode as 'plan' | 'build',
          sessionId,
          tasks,
        })) {
          switch (event.type) {
            case 'text':
              sendEvent('text', { content: event.content });
              break;

            case 'tool_use':
              buildMetrics.toolCalls++;
              sendEvent('tool:use', {
                tool: event.toolName,
                input: event.toolInput,
              });
              sendMetrics();
              break;

            case 'tool_result':
              sendEvent('tool:result', {
                tool: event.toolName,
                result: event.toolResult?.substring(0, 2000),
              });
              break;

            case 'thinking':
              buildMetrics.iterations++;
              sendEvent('thinking', { content: event.content, iteration: buildMetrics.iterations });
              sendMetrics();
              break;

            case 'done':
              sendEvent('done', {
                message: 'Completed successfully',
                finalMetrics: {
                  ...buildMetrics,
                  elapsedTime: Date.now() - buildMetrics.startTime,
                }
              });
              break;

            case 'error':
              sendEvent('error', { message: event.content });
              break;
          }
        }

        // Remove listeners
        claudeCodeService.removeListener('task:created', onTaskCreated);
        claudeCodeService.removeListener('task:updated', onTaskUpdated);
        claudeCodeService.removeListener('file:changed', onFileChanged);
        claudeCodeService.removeListener('command:start', onCommandStart);
        claudeCodeService.removeListener('command:complete', onCommandComplete);

        // Save session
        if (sessionId) {
          await claudeCodeService.saveSession(sessionId, projectDir);
        }

        // Final event
        sendEvent('complete', { projectId, status: 'success' });

      } catch (error) {
        console.error('Stream error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        isClosed = true;
        controller.close();
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
