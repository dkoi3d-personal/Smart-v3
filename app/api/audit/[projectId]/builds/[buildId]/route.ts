/**
 * Build Audit Details API
 *
 * Returns detailed audit information for a specific build
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { projects, ensureProjectsLoaded } from '@/app/api/projects/route';

interface RouteContext {
  params: Promise<{ projectId: string; buildId: string }>;
}

/**
 * GET /api/audit/[projectId]/builds/[buildId]
 *
 * Returns the build summary and list of stories
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId, buildId } = await context.params;

    // Load projects to find the working directory
    await ensureProjectsLoaded();
    const project = projects.get(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const buildDir = path.join(project.projectDirectory, '.audit', 'builds', buildId);

    // Check if build directory exists
    try {
      await fs.access(buildDir);
    } catch {
      return NextResponse.json(
        { error: 'Build not found' },
        { status: 404 }
      );
    }

    // Load build summary
    const summaryPath = path.join(buildDir, 'build-summary.json');
    let buildSummary;
    try {
      const content = await fs.readFile(summaryPath, 'utf-8');
      buildSummary = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Build summary not found' },
        { status: 404 }
      );
    }

    // List stories in this build
    const storiesDir = path.join(buildDir, 'stories');
    let stories: string[] = [];
    try {
      const storyDirs = await fs.readdir(storiesDir, { withFileTypes: true });
      stories = storyDirs
        .filter((d) => d.isDirectory())
        .map((d) => d.name);
    } catch {
      // No stories directory
    }

    // Load story summaries
    const storyData = await Promise.all(
      stories.map(async (storyId) => {
        try {
          const logPath = path.join(storiesDir, storyId, 'audit-log.json');
          const content = await fs.readFile(logPath, 'utf-8');
          const log = JSON.parse(content);
          return {
            storyId,
            title: log.title,
            status: log.outcome,
            epicId: log.epicId || null,
            agentCount: log.agents?.length || 0,
            filesCreated: log.filesCreated?.length || 0,
            filesModified: log.filesModified?.length || 0,
            totalActions: log.agents?.reduce(
              (sum: number, a: any) => sum + (a.totalActions || 0),
              0
            ) || 0,
          };
        } catch {
          return { storyId, error: 'Failed to load story log' };
        }
      })
    );

    // Load build report markdown if available
    let buildReport;
    try {
      buildReport = await fs.readFile(
        path.join(buildDir, 'build-report.md'),
        'utf-8'
      );
    } catch {
      // No report available
    }

    return NextResponse.json({
      buildId,
      projectId,
      summary: buildSummary,
      stories: storyData,
      buildReport,
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch build audit data' },
      { status: 500 }
    );
  }
}
