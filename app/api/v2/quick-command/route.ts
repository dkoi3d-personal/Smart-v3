/**
 * Quick Command API
 * Executes a single command directly using Claude Code CLI without the full multi-agent workflow.
 * This is for quick changes, edits, and simple tasks that don't need the full agent pipeline.
 */

import { NextRequest } from 'next/server';
import { claudeSubscriptionService } from '@/services/claude-subscription-service';
import { getProjectDir, projectDirExists } from '@/lib/project-paths';
import { glob } from 'glob';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, command } = body;

  if (!projectId || !command) {
    return new Response(
      JSON.stringify({ error: 'Project ID and command are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const projectDir = getProjectDir(projectId);
  if (!await projectDirExists(projectId)) {
    return new Response(
      JSON.stringify({ error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get list of files in project for context
  let fileList: string[] = [];
  try {
    // Normalize path for glob (use forward slashes on Windows)
    const normalizedDir = projectDir.replace(/\\/g, '/');
    const files = await glob('**/*', {
      cwd: normalizedDir,
      nodir: true,
      ignore: ['node_modules/**', '.git/**', 'dist/**', 'build/**', '.next/**']
    });
    fileList = files.slice(0, 50); // Limit to 50 files for context
  } catch (e) {
    // Ignore glob errors
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return;
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          isClosed = true;
        }
      };

      sendEvent('connected', { projectId });

      try {
        // Build prompt for Claude
        const prompt = `You are a coding assistant helping with a project.

Current project files: ${fileList.join(', ')}

USER REQUEST: ${command}

Execute this request. Be concise and efficient. If you need to:
- Read files: Use the Read tool
- Edit files: Use the Edit tool
- Create files: Use the Write tool
- Run commands: Use the Bash tool

Focus on completing the task quickly. Don't explain what you're doing unless asked.`;

        // Run Claude CLI directly using the subscription service
        for await (const message of claudeSubscriptionService.runAgent(prompt, {
          model: 'sonnet', // Use Sonnet for faster responses
          workingDirectory: projectDir,
          permissionMode: 'bypassPermissions',
          maxTurns: 20, // Limit turns for quick commands
        })) {
          // Forward messages to the client
          switch (message.type) {
            case 'text':
              sendEvent('text', { content: message.content });
              break;
            case 'tool_use':
              sendEvent('tool:call', {
                name: message.toolName,
                input: message.toolInput
              });
              break;
            case 'tool_result':
              sendEvent('tool:result', {
                name: message.toolName,
                result: message.content?.slice(0, 1000) // Truncate for display
              });
              // Check for file changes
              if (message.toolName === 'Write' || message.toolName === 'Edit') {
                sendEvent('file:changed', {
                  action: message.toolName.toLowerCase(),
                  content: message.content
                });
              }
              break;
            case 'error':
              sendEvent('error', { message: message.content });
              break;
            case 'complete':
              // Don't send complete here, we'll do it at the end
              break;
          }
        }

        sendEvent('complete', { success: true });

      } catch (error) {
        console.error('Quick command error:', error);
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        isClosed = true;
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
