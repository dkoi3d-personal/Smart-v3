import { NextRequest, NextResponse } from 'next/server';
import { projects, ensureProjectsLoaded } from '../../../projects/route';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Ensure projects are loaded before checking
  await ensureProjectsLoaded();

  const activeOrchestrators = (global as any).activeOrchestrators;

  if (!activeOrchestrators || !activeOrchestrators.has(projectId)) {
    return NextResponse.json(
      { error: 'No active workflow found for this project' },
      { status: 404 }
    );
  }

  const orchestrator = activeOrchestrators.get(projectId);

  try {
    orchestrator.pause();

    // Update project status
    const project = projects.get(projectId);
    if (project) {
      project.status = 'paused';
      project.updatedAt = new Date().toISOString();
    }

    console.log(`⏸️  Workflow paused for project: ${projectId}`);

    return NextResponse.json({ success: true, message: 'Workflow paused' });
  } catch (error) {
    console.error('Error pausing workflow:', error);
    return NextResponse.json(
      { error: 'Failed to pause workflow' },
      { status: 500 }
    );
  }
}
