/**
 * Build History API
 *
 * Manages build history - loading, archiving, and starting new builds.
 *
 * GET: Load build history for a project
 * POST: Archive current build and start a new one
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadBuildHistory,
  archiveCurrentBuild,
  initializeBuildHistory,
  completeBuild,
  loadBuildMetadata,
  isExistingProject,
  migrateFromIterationState,
  type BuildHistoryEntry,
  type MetricsSnapshot,
} from '@/lib/build-history';
import path from 'path';
import fs from 'fs/promises';

/**
 * GET /api/build-history?projectId=xxx
 * Load build history for a project
 * Optionally include stories/epics with ?includeStories=true
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const includeStories = searchParams.get('includeStories') === 'true';

    if (!projectId) {
      return NextResponse.json({ error: 'projectId required' }, { status: 400 });
    }

    // Get project directory from projects.json
    const projectDir = await getProjectDirectory(projectId);
    if (!projectDir) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Migrate from old iteration state if needed
    await migrateFromIterationState(projectDir);

    // Load build history (includes current build if not archived, handles deduplication)
    const history = await loadBuildHistory(projectDir);
    const currentMetadata = await loadBuildMetadata(projectDir);
    const isExisting = await isExistingProject(projectDir);

    // loadBuildHistory already handles deduplication and stale metadata cleanup
    const builds = [...history].sort((a, b) => b.buildNumber - a.buildNumber);

    // Load stories/epics for each build if requested
    if (includeStories) {
      for (const build of builds) {
        try {
          let storiesPath: string;
          if (build.isCurrent) {
            // Current build stories are in the root
            storiesPath = path.join(projectDir, '.agile-stories.json');
          } else {
            // Archived build stories
            storiesPath = path.join(projectDir, '.build-history', `build-${build.buildNumber}`, '.agile-stories.json');
          }

          const storiesData = await fs.readFile(storiesPath, 'utf-8');
          const stories = JSON.parse(storiesData);
          (build as any).epics = stories.epics || [];
          (build as any).tasks = stories.tasks || [];
        } catch {
          // No stories file for this build
          (build as any).epics = [];
          (build as any).tasks = [];
        }
      }
    }

    return NextResponse.json({
      success: true,
      projectId,
      builds, // Frontend expects this
      history, // Keep for backwards compatibility
      currentBuild: currentMetadata,
      isExistingProject: isExisting,
    });
  } catch (error) {
    console.error('[Build History API] GET error:', error);
    return NextResponse.json({
      error: 'Failed to load build history',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * POST /api/build-history
 * Actions: archive, start, complete
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, projectDirectory, prompt, source, figmaUrl, status, metrics } = body;

    if (!projectId && !projectDirectory) {
      return NextResponse.json({ error: 'projectId or projectDirectory required' }, { status: 400 });
    }

    // Get project directory
    let projectDir = projectDirectory;
    if (!projectDir && projectId) {
      projectDir = await getProjectDirectory(projectId);
    }

    if (!projectDir) {
      return NextResponse.json({ error: 'Project directory not found' }, { status: 404 });
    }

    switch (action) {
      case 'archive': {
        // Archive current build (call before starting new build)
        const result = await archiveCurrentBuild(projectDir);
        return NextResponse.json({
          success: true,
          archived: result.archived,
          buildNumber: result.buildNumber,
        });
      }

      case 'start': {
        // Start a new build (archives current, cleans up artifacts, then creates fresh metadata)
        if (!prompt) {
          return NextResponse.json({ error: 'prompt required for start action' }, { status: 400 });
        }

        // initializeBuildHistory handles: archive old build -> cleanup artifacts -> create fresh metadata
        const metadata = await initializeBuildHistory(
          projectDir,
          prompt,
          source || 'text',
          figmaUrl
        );

        return NextResponse.json({
          success: true,
          buildNumber: metadata.buildNumber,
          metadata,
        });
      }

      case 'complete': {
        // Mark current build as complete
        await completeBuild(
          projectDir,
          status || 'completed',
          metrics as MetricsSnapshot | undefined
        );

        const metadata = await loadBuildMetadata(projectDir);
        return NextResponse.json({
          success: true,
          metadata,
        });
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[Build History API] POST error:', error);
    return NextResponse.json({
      error: 'Failed to process build history action',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * Helper to get project directory from projects.json
 */
async function getProjectDirectory(projectId: string): Promise<string | null> {
  try {
    const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
    const data = await fs.readFile(projectsPath, 'utf-8');
    const parsed = JSON.parse(data);
    // Handle both array format and {projects: [...]} format
    const projects = Array.isArray(parsed) ? parsed : (parsed.projects || []);
    const project = projects.find((p: any) => p.projectId === projectId);
    return project?.projectDirectory || null;
  } catch {
    return null;
  }
}
