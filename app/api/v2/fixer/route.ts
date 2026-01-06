/**
 * Fixer Agent API
 * Triggers the Fixer agent to diagnose and fix errors in a project
 */

import { NextRequest } from 'next/server';
import { multiAgentService } from '@/services/multi-agent-service';
import * as fs from 'fs/promises';
import { getProjectDir, projectDirExists } from '@/lib/project-paths';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId, sessionId, errorContext } = body;

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: 'Project ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Setup project directory OUTSIDE of ai-dev-platform-v2
  const projectDir = getProjectDir(projectId);
  if (!await projectDirExists(projectId)) {
    return new Response(
      JSON.stringify({ error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get or create session
  let session = sessionId ? multiAgentService.getSession(sessionId) : null;
  if (!session) {
    session = multiAgentService.createSession(projectId, projectDir);
  }

  // Setup SSE stream
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

      // Send initial connection
      sendEvent('connected', {
        sessionId: session!.id,
        projectId,
        agent: 'fixer',
      });

      // Listen for fix reports
      const onFixReported = (data: any) => {
        sendEvent('fix:reported', data);
      };
      const onFixerNeedsHelp = (data: any) => {
        sendEvent('fixer:needs_help', data);
      };
      const onFileChanged = (data: any) => {
        sendEvent('file:changed', data);
      };
      const onCommandStart = (data: any) => {
        sendEvent('command:start', data);
      };
      const onCommandComplete = (data: any) => {
        sendEvent('command:complete', data);
      };

      multiAgentService.on('fix:reported', onFixReported);
      multiAgentService.on('fixer:needs_help', onFixerNeedsHelp);
      multiAgentService.on('file:changed', onFileChanged);
      multiAgentService.on('command:start', onCommandStart);
      multiAgentService.on('command:complete', onCommandComplete);

      try {
        // Run the fixer agent
        for await (const message of multiAgentService.runFixer(session!, errorContext)) {
          sendEvent('agent:message', {
            id: message.id,
            agentRole: message.agentRole,
            agentName: message.agentName,
            type: message.type,
            content: message.content,
            toolName: message.toolName,
            toolInput: message.toolInput,
            timestamp: message.timestamp.toISOString(),
          });
        }

        sendEvent('complete', {
          sessionId: session!.id,
          status: 'success',
        });

      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        // Cleanup listeners
        multiAgentService.removeListener('fix:reported', onFixReported);
        multiAgentService.removeListener('fixer:needs_help', onFixerNeedsHelp);
        multiAgentService.removeListener('file:changed', onFileChanged);
        multiAgentService.removeListener('command:start', onCommandStart);
        multiAgentService.removeListener('command:complete', onCommandComplete);

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
