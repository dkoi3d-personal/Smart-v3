/**
 * Cleanup Build Artifacts API
 *
 * Deletes stale build artifacts before starting a new build.
 * Call this BEFORE Figma extraction or text build start.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupBuildArtifacts, archiveCurrentBuild, loadBuildMetadata } from '@/lib/build-history';
import * as fs from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectDirectory } = body;

    if (!projectDirectory) {
      return NextResponse.json({ error: 'projectDirectory is required' }, { status: 400 });
    }

    // Check for existing metadata OR stories without metadata (cloned repo case)
    const existingMetadata = await loadBuildMetadata(projectDirectory);
    let hasStories = false;
    try {
      const storiesPath = path.join(projectDirectory, '.agile-stories.json');
      const storiesData = JSON.parse(await fs.readFile(storiesPath, 'utf-8'));
      hasStories = (storiesData?.tasks?.length ?? 0) > 0 || (storiesData?.epics?.length ?? 0) > 0;
    } catch {
      // No stories file
    }

    // Archive if we have metadata OR stories (handles cloned repos with stories but no metadata)
    if (existingMetadata || hasStories) {
      if (existingMetadata) {
        console.log(`[Cleanup] Found existing build ${existingMetadata.buildNumber} (status: ${existingMetadata.status}), archiving...`);
      } else {
        console.log('[Cleanup] Found stories without metadata (cloned repo), archiving...');
      }
      await archiveCurrentBuild(projectDirectory);
      console.log('[Cleanup] Archived existing build');
    } else {
      console.log('[Cleanup] No existing build to archive');
    }

    // Clean up build artifacts (deletes figma-context, figma-frames, stories, etc.)
    await cleanupBuildArtifacts(projectDirectory);
    console.log('[Cleanup] Cleaned up build artifacts');

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('[Cleanup] Error:', error);
    return NextResponse.json({
      error: 'Failed to cleanup build artifacts',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
