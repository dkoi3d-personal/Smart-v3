import { NextRequest, NextResponse } from 'next/server';
import { projects, saveProjects, ensureProjectsLoaded } from '../../../projects/route';
import { multiAgentService } from '@/services/multi-agent-service';
import { devServerManager } from '@/services/dev-server-manager';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Ensure projects are loaded before checking
  await ensureProjectsLoaded();

  console.log(`🛑 Stop request received for project: ${projectId}`);

  const activeOrchestrators = (global as any).activeOrchestrators;
  let orchestratorStopped = false;
  let multiAgentStopped = false;
  let devServerStopped = false;

  // Try to stop the orchestrator if it exists
  if (activeOrchestrators && activeOrchestrators.has(projectId)) {
    const orchestrator = activeOrchestrators.get(projectId);
    try {
      await orchestrator.stop();
      activeOrchestrators.delete(projectId);
      orchestratorStopped = true;
      console.log(`⏹️  Orchestrator stopped for project: ${projectId}`);
    } catch (error) {
      console.error('Error stopping orchestrator:', error);
    }
  }

  // Try to stop multi-agent session if it exists
  if (multiAgentService.hasActiveSession(projectId)) {
    try {
      multiAgentStopped = multiAgentService.stopByProjectId(projectId);
      console.log(`⏹️  Multi-agent session stopped for project: ${projectId}`);
    } catch (error) {
      console.error('Error stopping multi-agent session:', error);
    }
  }

  // Stop the dev server if running
  try {
    await devServerManager.stopDevServer(projectId);
    devServerStopped = true;
    console.log(`⏹️  Dev server stopped for project: ${projectId}`);
  } catch (error) {
    // Dev server may not be running, that's OK
    console.log(`ℹ️  No dev server to stop for project: ${projectId}`);
  }

  // Broadcast stop event via WebSocket
  const io = (global as any).io;
  if (io) {
    io.to(`project:${projectId}`).emit('workflow:stopped', { projectId });
  }

  // Always update project status to idle, even if no orchestrator was running
  // This allows users to reset stuck projects
  const project = projects.get(projectId);
  if (project) {
    const previousStatus = project.status;
    project.status = 'idle';
    project.updatedAt = new Date().toISOString();

    // Persist the change
    await saveProjects();

    console.log(`⏹️  Project ${projectId} status changed: ${previousStatus} -> idle`);

    return NextResponse.json({
      success: true,
      message: orchestratorStopped || multiAgentStopped || devServerStopped
        ? 'Workflow and all processes stopped'
        : 'Project status reset to idle',
      previousStatus,
      orchestratorStopped,
      multiAgentStopped,
      devServerStopped
    });
  }

  return NextResponse.json(
    { error: 'Project not found' },
    { status: 404 }
  );
}
