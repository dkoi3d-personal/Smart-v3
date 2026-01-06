/**
 * Multi-Agent Resume API
 * Resumes a build from the latest checkpoint
 */

import { NextRequest } from 'next/server';
import { multiAgentService, AgentRole } from '@/services/multi-agent-service';
import { getProjectDir } from '@/lib/project-paths';

export const dynamic = 'force-dynamic';

// Helper to broadcast to WebSocket for live reconnection
function broadcastToProject(projectId: string, event: string, data: any) {
  const io = (global as any).io;
  if (io) {
    io.to(`project:${projectId}`).emit(event, { ...data, projectId });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId } = body;

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: 'Project ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Get project directory
  const projectDir = await getProjectDir(projectId);
  if (!projectDir) {
    return new Response(
      JSON.stringify({ error: 'Project not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
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

      // Send reconnection status
      sendEvent('reconnecting', { projectId, status: 'loading_checkpoint' });

      // Event listeners (similar to main route)
      const onFileChanged = (data: any) => {
        sendEvent('file:changed', data);
        broadcastToProject(projectId, 'file:changed', data);
      };
      const onTaskCreated = (data: any) => {
        sendEvent('task:created', data);
        broadcastToProject(projectId, 'task:created', data);
      };
      const onTaskUpdated = (data: any) => {
        sendEvent('task:updated', data);
        broadcastToProject(projectId, 'task:update', data);
      };
      const onAgentStatus = (data: any) => {
        sendEvent('agent:status', data);
        broadcastToProject(projectId, 'agent:status', data);
      };
      const onEpicCreated = (data: any) => {
        sendEvent('epic:created', data);
        broadcastToProject(projectId, 'epic:created', data);
      };
      const onTestResults = (data: any) => {
        sendEvent('test:results', data);
        broadcastToProject(projectId, 'test:results', data);
      };
      const onSecurityReport = (data: any) => {
        sendEvent('security:report', data);
        broadcastToProject(projectId, 'security:report', data);
      };
      const onStateRestored = (data: any) => {
        // Send full state to UI on resume - includes all tasks and epics
        sendEvent('state:restored', data);
        broadcastToProject(projectId, 'state:restored', data);
      };

      multiAgentService.on('file:changed', onFileChanged);
      multiAgentService.on('task:created', onTaskCreated);
      multiAgentService.on('task:updated', onTaskUpdated);
      multiAgentService.on('agent:status', onAgentStatus);
      multiAgentService.on('epic:created', onEpicCreated);
      multiAgentService.on('test:results', onTestResults);
      multiAgentService.on('security:report', onSecurityReport);
      multiAgentService.on('state:restored', onStateRestored);

      try {
        // Resume from checkpoint
        for await (const message of multiAgentService.resumeFromCheckpoint(
          projectId,
          projectDir
        )) {
          const msgData = {
            id: message.id,
            agentRole: message.agentRole,
            agentName: message.agentName,
            type: message.type,
            content: message.content,
            toolName: message.toolName,
            toolInput: message.toolInput,
            timestamp: message.timestamp.toISOString(),
            instanceNumber: message.instanceNumber,
          };
          sendEvent('agent:message', msgData);
          broadcastToProject(projectId, 'agent:message', msgData);
        }

        sendEvent('complete', {
          projectId,
          status: 'resumed_complete',
        });
        broadcastToProject(projectId, 'workflow:completed', { status: 'resumed' });

      } catch (error) {
        const errorData = {
          message: error instanceof Error ? error.message : 'Resume failed',
        };
        sendEvent('error', errorData);
        broadcastToProject(projectId, 'workflow:error', { error: errorData.message });
      } finally {
        // Cleanup listeners
        multiAgentService.removeListener('file:changed', onFileChanged);
        multiAgentService.removeListener('task:created', onTaskCreated);
        multiAgentService.removeListener('task:updated', onTaskUpdated);
        multiAgentService.removeListener('agent:status', onAgentStatus);
        multiAgentService.removeListener('epic:created', onEpicCreated);
        multiAgentService.removeListener('test:results', onTestResults);
        multiAgentService.removeListener('security:report', onSecurityReport);
        multiAgentService.removeListener('state:restored', onStateRestored);

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

// GET endpoint to check if a checkpoint exists
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return new Response(
      JSON.stringify({ error: 'Project ID is required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const projectDir = await getProjectDir(projectId);
  if (!projectDir) {
    return new Response(
      JSON.stringify({ hasCheckpoint: false, error: 'Project not found' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const checkpoint = await multiAgentService.loadCheckpoint(projectDir);

  return new Response(
    JSON.stringify({
      hasCheckpoint: checkpoint !== null,
      checkpoint: checkpoint ? {
        phase: checkpoint.phase,
        taskCount: checkpoint.tasks.length,
        completedAgents: checkpoint.completedAgents,
        timestamp: checkpoint.timestamp,
      } : null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
