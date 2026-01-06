import { NextRequest, NextResponse } from 'next/server';
import { projects, ensureProjectsLoaded } from '../../projects/route';

export async function POST(request: NextRequest) {
  try {
    // Ensure projects are loaded before checking
    await ensureProjectsLoaded();

    const body = await request.json();
    const { projectId, feature } = body;

    if (!projectId || !feature || !feature.trim()) {
      return NextResponse.json(
        { error: 'Project ID and feature description are required' },
        { status: 400 }
      );
    }

    const activeOrchestrators = (global as any).activeOrchestrators;
    const project = projects.get(projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Check if there's an active orchestrator for this project
    const hasActiveOrchestrator = activeOrchestrators && activeOrchestrators.has(projectId);

    if (!hasActiveOrchestrator) {
      return NextResponse.json(
        { error: 'No active workflow found for this project. Please resume the project first.' },
        { status: 404 }
      );
    }

    const orchestrator = activeOrchestrators.get(projectId);

    // Add the feature to the orchestrator's state for processing
    // The orchestrator will pick this up and create new epics/stories
    const state = orchestrator.getState();

    // Append the feature to requirements
    const updatedRequirements = `${state.requirements}\n\nAdditional Feature:\n${feature}`;
    state.requirements = updatedRequirements;

    // Update project requirements
    project.requirements = updatedRequirements;
    project.updatedAt = new Date().toISOString();

    console.log(`📝 Feature added to project ${projectId}: ${feature.substring(0, 100)}`);

    // Emit event to notify frontend
    const io = (global as any).io;
    if (io) {
      io.to(projectId).emit('feature:added', {
        projectId,
        feature,
        timestamp: new Date(),
      });

      // Emit agent message
      io.to(projectId).emit('agent:message', {
        id: `msg-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: `📝 New feature request received: "${feature.substring(0, 100)}${feature.length > 100 ? '...' : ''}"\n\nThe agents will analyze and prioritize this feature in the next planning cycle.`,
        timestamp: new Date(),
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Feature added successfully',
      projectId,
      feature,
    });
  } catch (error) {
    console.error('Error adding feature:', error);
    return NextResponse.json(
      { error: 'Failed to add feature', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
