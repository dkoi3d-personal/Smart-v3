import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { getProjectDir } from '@/lib/project-paths';

// Import projects map and functions from parent route
import { projects, saveProjects, deletedProjectIds, saveDeletedProjects, ensureProjectsLoaded } from '../route';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Ensure projects are loaded before checking - critical for page refreshes
  await ensureProjectsLoaded();

  if (!projects.has(projectId)) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }

  const project = projects.get(projectId)!;

  // Get the orchestrator if it's running
  const activeOrchestrators = (global as any).activeOrchestrators;
  const orchestrator = activeOrchestrators?.get(projectId);

  // Build full project state
  const fullState = {
    ...project,
    // Add orchestrator state if available
    orchestratorState: orchestrator ? {
      status: orchestrator.state.status,
      currentStep: orchestrator.state.currentStep,
      progress: orchestrator.state.progress,
      epics: orchestrator.state.epics || [],
      stories: orchestrator.state.stories || [],
      messages: Array.from(orchestrator.state.messages || []),
      codeFiles: (Array.from(orchestrator.state.codeFiles?.entries() || []) as [string, any][]).map(([path, file]) => ({
        path,
        ...file
      })),
      testResults: orchestrator.state.testResults,
      securityReport: orchestrator.state.securityReport,
      deployment: orchestrator.state.deployment,
      agents: Array.from(orchestrator.agents?.values() || []).map((agent: any) => ({
        id: agent.id,
        type: agent.type,
        name: agent.name,
        status: agent.status,
        currentTask: agent.currentTask,
        progress: agent.progress,
      })),
    } : null,
  };

  // Try to load persisted files from project directory
  // Project directory is OUTSIDE ai-dev-platform-v2 in C:\Users\srfit\coding\ai-projects\
  const projectDirectory = project.projectDirectory || getProjectDir(projectId);

  // IMPORTANT: Add projectDirectory to the response so the UI can use it
  (fullState as any).projectDirectory = projectDirectory;

  // Check if directory exists
  try {
    await fs.access(projectDirectory);
    console.log('[API] ✅ Project directory exists:', projectDirectory);
  } catch (err) {
    console.log('[API] ⚠️  Project directory not found:', projectDirectory);
  }

  if (projectDirectory) {
    try {
      console.log('[API] Loading files from:', projectDirectory);

      // Load research findings if available
      const researchPath = path.join(projectDirectory, 'research-findings.json');
      try {
        const researchData = await fs.readFile(researchPath, 'utf-8');
        fullState.researchFindings = JSON.parse(researchData);
        console.log('[API] ✅ Loaded research findings');
      } catch (err) {
        console.log('[API] ⚠️  No research findings file');
      }

      // Load epics if available and orchestrator doesn't have them
      if (!fullState.orchestratorState?.epics?.length) {
        const epicsPath = path.join(projectDirectory, 'epics.json');
        try {
          const epicsData = await fs.readFile(epicsPath, 'utf-8');
          fullState.epics = JSON.parse(epicsData);
          console.log('[API] ✅ Loaded', fullState.epics.length, 'epics from file');
        } catch (err) {
          console.log('[API] ⚠️  No epics file, checking user-stories for epics');
          // Epics might be embedded in user-stories file, extract them
        }
      }

      // Load stories if available and orchestrator doesn't have them
      if (!fullState.orchestratorState?.stories?.length) {
        const storiesPath = path.join(projectDirectory, 'user-stories.json');
        try {
          const storiesData = await fs.readFile(storiesPath, 'utf-8');
          fullState.stories = JSON.parse(storiesData);
          console.log('[API] ✅ Loaded', fullState.stories.length, 'stories from file');

          // Extract unique epics from stories if we don't have epics yet
          if (!fullState.epics) {
            const epicIds = [...new Set(fullState.stories.map((s: any) => s.epicId))];
            console.log('[API] 📊 Found', epicIds.length, 'unique epic IDs in stories');
            fullState.epicIds = epicIds;
          }
        } catch (err) {
          console.log('[API] ⚠️  No user-stories file:', err);
        }
      }
    } catch (error) {
      console.error('[API] ❌ Error loading project files:', error);
    }
  } else {
    console.log('[API] ⚠️  No project directory set');
  }

  return NextResponse.json(fullState);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Get project from map if it exists (may not be loaded yet)
  const project = projects.get(projectId);

  // Even if not in map, we can still delete from filesystem
  const projectDir = project?.projectDirectory || getProjectDir(projectId);

  // Check if project exists either in map or on filesystem
  let existsOnDisk = false;
  try {
    await fs.access(projectDir);
    existsOnDisk = true;
  } catch {
    // Directory doesn't exist
  }

  if (!project && !existsOnDisk) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }

  // Stop the orchestrator if it's running
  const activeOrchestrators = (global as any).activeOrchestrators;
  if (activeOrchestrators && activeOrchestrators.has(projectId)) {
    const orchestrator = activeOrchestrators.get(projectId);
    try {
      await orchestrator.stop();
      activeOrchestrators.delete(projectId);
      orchestrator.removeAllListeners();
    } catch (error) {
      console.error('Error stopping orchestrator:', error);
    }
  }

  // Stop dev server if running - wait for it to fully stop
  const { devServerManager } = await import('@/services/dev-server-manager');
  try {
    await devServerManager.stopDevServer(projectId);
    // Give Windows time to release file handles
    await new Promise(resolve => setTimeout(resolve, 1000));
  } catch (error) {
    console.error('Error stopping dev server:', error);
  }

  // Delete project directory from file system
  console.log(`🗑️  DELETE request for project: ${projectId}`);
  console.log(`🗑️  Project dir to delete: ${projectDir}`);
  console.log(`🗑️  Project in map: ${!!project}`);
  console.log(`🗑️  Exists on disk: ${existsOnDisk}`);

  if (existsOnDisk) {
    // Retry deletion up to 3 times (Windows file locks can take time to release)
    let deleted = false;
    let lastError: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`🗑️  Attempt ${attempt} to delete: ${projectDir}`);
        await fs.rm(projectDir, { recursive: true, force: true });

        // Verify it's actually gone
        try {
          await fs.access(projectDir);
          console.log(`⚠️  Directory still exists after rm, retrying...`);
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        } catch {
          // Directory doesn't exist - success!
          deleted = true;
          console.log(`✅ Successfully deleted project directory: ${projectDir}`);
          break;
        }
      } catch (error: any) {
        lastError = error;
        console.error(`❌ Attempt ${attempt} failed:`, error.message);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }

    if (!deleted) {
      console.error(`❌ Failed to delete after 3 attempts:`, lastError?.message);
      // Continue anyway - add to deleted list so it won't show up
      console.log(`⚠️  Adding to deleted list anyway to hide from UI`);
    }
  } else {
    console.log(`⚠️  Directory doesn't exist, just removing from registry`);
  }

  // Remove from projects map
  projects.delete(projectId);

  // Add to deleted list so it won't be re-discovered
  deletedProjectIds.add(projectId);

  // Save both lists to disk
  await saveProjects();
  await saveDeletedProjects();

  console.log(`✅ Project ${projectId} deleted successfully`);

  return NextResponse.json({ success: true, message: 'Project deleted successfully' });
}
