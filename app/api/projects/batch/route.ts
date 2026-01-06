import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProjectDir } from '@/lib/project-paths';

// Import projects map from parent route
import { projects } from '../route';

/**
 * Batch API endpoint to fetch multiple project states at once
 * This is more efficient than making multiple individual requests
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectIds, includeFullState = false } = body;

    if (!projectIds || !Array.isArray(projectIds)) {
      return NextResponse.json(
        { error: 'projectIds must be an array' },
        { status: 400 }
      );
    }

    const activeOrchestrators = (global as any).activeOrchestrators;
    const results: Record<string, any> = {};

    for (const projectId of projectIds) {
      if (!projects.has(projectId)) {
        results[projectId] = { error: 'Project not found' };
        continue;
      }

      const project = projects.get(projectId)!;
      const orchestrator = activeOrchestrators?.get(projectId);

      // Build project state
      const projectState: any = {
        projectId: project.projectId,
        requirements: project.requirements,
        status: project.status,
        progress: project.progress || 0,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        config: project.config,
      };

      // Add orchestrator state if available
      if (orchestrator) {
        projectState.status = orchestrator.state.status || project.status;
        projectState.progress = orchestrator.state.progress || project.progress || 0;
        projectState.currentStep = orchestrator.state.currentStep;

        // Add agent status
        if (orchestrator.agents) {
          projectState.activeAgent = null;
          for (const agent of orchestrator.agents.values()) {
            if (agent.status === 'working' || agent.status === 'thinking') {
              projectState.activeAgent = {
                type: agent.type,
                status: agent.status,
                task: agent.currentTask,
              };
              break;
            }
          }
        }

        // Include full state if requested
        if (includeFullState) {
          projectState.orchestratorState = {
            currentStep: orchestrator.state.currentStep,
            progress: orchestrator.state.progress,
            epics: orchestrator.state.epics || [],
            stories: orchestrator.state.stories || [],
            messages: Array.from(orchestrator.state.messages || []).slice(-20), // Last 20 messages
            codeFiles: (Array.from(orchestrator.state.codeFiles?.entries() || []) as [string, any][]).map(
              ([filePath, file]) => ({
                path: filePath,
                language: file.language,
                size: file.size,
              })
            ),
            agents: Array.from(orchestrator.agents?.values() || []).map((agent: any) => ({
              type: agent.type,
              status: agent.status,
              currentTask: agent.currentTask,
            })),
          };
        }
      }

      // Load persisted data if no orchestrator
      if (!orchestrator && includeFullState) {
        const projectDirectory = project.projectDirectory || getProjectDir(projectId);

        try {
          // Load epics
          const epicsPath = path.join(projectDirectory, 'epics.json');
          try {
            const epicsData = await fs.readFile(epicsPath, 'utf-8');
            projectState.epics = JSON.parse(epicsData);
          } catch {
            // No epics file
          }

          // Load stories
          const storiesPath = path.join(projectDirectory, 'user-stories.json');
          try {
            const storiesData = await fs.readFile(storiesPath, 'utf-8');
            projectState.stories = JSON.parse(storiesData);
          } catch {
            // No stories file
          }
        } catch (error) {
          console.error(`Error loading persisted data for ${projectId}:`, error);
        }
      }

      results[projectId] = projectState;
    }

    return NextResponse.json({
      success: true,
      projects: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Batch API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch project states' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to fetch all active projects with their current states
 */
export async function GET(request: NextRequest) {
  const activeOrchestrators = (global as any).activeOrchestrators;
  const activeProjects: any[] = [];

  // Get all projects
  const allProjects = Array.from(projects.values());

  for (const project of allProjects) {
    const orchestrator = activeOrchestrators?.get(project.projectId);
    const isActive = orchestrator && ['planning', 'developing', 'testing', 'deploying'].includes(
      orchestrator.state.status || project.status
    );

    const projectInfo: any = {
      projectId: project.projectId,
      name: project.config?.name || project.projectId,
      requirements: project.requirements,
      status: orchestrator?.state.status || project.status,
      progress: orchestrator?.state.progress || project.progress || 0,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      isActive,
    };

    // Add active agent info
    if (orchestrator?.agents) {
      for (const agent of orchestrator.agents.values()) {
        if (agent.status === 'working' || agent.status === 'thinking') {
          projectInfo.activeAgent = {
            type: agent.type,
            status: agent.status,
            task: agent.currentTask,
          };
          break;
        }
      }
    }

    // Add stats
    projectInfo.stats = {
      epicCount: orchestrator?.state.epics?.length || 0,
      storyCount: orchestrator?.state.stories?.length || 0,
      storiesCompleted: orchestrator?.state.stories?.filter((s: any) => s.status === 'done').length || 0,
      codeFileCount: orchestrator?.state.codeFiles?.size || 0,
    };

    activeProjects.push(projectInfo);
  }

  // Sort by updatedAt descending
  activeProjects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return NextResponse.json({
    success: true,
    projects: activeProjects,
    activeCount: activeProjects.filter(p => p.isActive).length,
    totalCount: activeProjects.length,
    timestamp: new Date().toISOString(),
  });
}
