import { NextResponse } from 'next/server';
import { projects, ensureProjectsLoaded } from '../../projects/route';

export async function POST() {
  try {
    // Ensure projects are loaded before checking
    await ensureProjectsLoaded();

    const activeOrchestrators = (global as any).activeOrchestrators;

    if (!activeOrchestrators) {
      return NextResponse.json({ message: 'No active orchestrators found' });
    }

    const stoppedProjects: string[] = [];
    const errors: string[] = [];

    // Stop all active orchestrators
    for (const [projectId, orchestrator] of activeOrchestrators.entries()) {
      try {
        await orchestrator.stop();
        activeOrchestrators.delete(projectId);

        // Update project status
        const project = projects.get(projectId);
        if (project) {
          project.status = 'idle';
          project.updatedAt = new Date().toISOString();
        }

        stoppedProjects.push(projectId);
        console.log(`⏹️  Stopped workflow for project: ${projectId}`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`${projectId}: ${errorMsg}`);
        console.error(`Error stopping project ${projectId}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Stopped ${stoppedProjects.length} project(s)`,
      stoppedProjects,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error stopping all projects:', error);
    return NextResponse.json(
      { error: 'Failed to stop all projects' },
      { status: 500 }
    );
  }
}
