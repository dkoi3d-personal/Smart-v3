/**
 * Archive completed stories for a project
 * POST /api/projects/[projectId]/stories/archive
 *
 * Moves completed stories from .agile-stories.json to .agile-stories-archive.json
 * to reduce main file size and improve performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { StoryFileManager } from '@/services/orchestration/story-file-manager';
import { EventEmitter } from 'events';

// Mock session for file operations
function createMockSession(workingDirectory: string) {
  return {
    workingDirectory,
    tasks: [],
    epics: [],
    agentToStory: new Map(),
  } as any;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json().catch(() => ({}));
    const { keepCurrentIteration, keepRecentCount } = body;

    // Get project path from projects.json
    const projectsFile = path.join(process.cwd(), 'data', 'projects.json');
    const projectsData = JSON.parse(await fs.readFile(projectsFile, 'utf-8'));
    const project = projectsData.projects?.find((p: any) => p.id === projectId);

    if (!project?.directory) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const emitter = new EventEmitter();
    const storyFileManager = new StoryFileManager({ emitter });
    const session = createMockSession(project.directory);

    // Load current stories into session
    await storyFileManager.loadExistingStories(session);

    // Archive completed stories
    const result = await storyFileManager.archiveCompletedStories(session, {
      keepRecentCount: keepRecentCount ?? 0,
    });

    return NextResponse.json({
      success: true,
      archived: result.archived,
      remaining: result.remaining,
      message: `Archived ${result.archived} completed stories, ${result.remaining} stories remaining`,
    });
  } catch (error: any) {
    console.error('[Archive API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to archive stories' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    // Get project path from projects.json
    const projectsFile = path.join(process.cwd(), 'data', 'projects.json');
    const projectsData = JSON.parse(await fs.readFile(projectsFile, 'utf-8'));
    const project = projectsData.projects?.find((p: any) => p.id === projectId);

    if (!project?.directory) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const emitter = new EventEmitter();
    const storyFileManager = new StoryFileManager({ emitter });

    // Get story counts
    const counts = await storyFileManager.getStoryCounts(project.directory);

    return NextResponse.json({
      success: true,
      counts,
    });
  } catch (error: any) {
    console.error('[Archive API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get story counts' },
      { status: 500 }
    );
  }
}
