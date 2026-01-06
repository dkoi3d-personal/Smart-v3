/**
 * Story Audit Details API
 *
 * Returns detailed audit information for a specific story
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { projects, ensureProjectsLoaded } from '@/app/api/projects/route';

interface RouteContext {
  params: Promise<{ projectId: string; buildId: string; storyId: string }>;
}

/**
 * GET /api/audit/[projectId]/builds/[buildId]/stories/[storyId]
 *
 * Returns the full audit log for a specific story
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { projectId, buildId, storyId } = await context.params;

    // Load projects to find the working directory
    await ensureProjectsLoaded();
    const project = projects.get(projectId);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    const storyDir = path.join(
      project.projectDirectory,
      '.audit',
      'builds',
      buildId,
      'stories',
      storyId
    );

    // Check if story directory exists
    try {
      await fs.access(storyDir);
    } catch {
      return NextResponse.json(
        { error: 'Story audit data not found' },
        { status: 404 }
      );
    }

    // Load audit log
    const logPath = path.join(storyDir, 'audit-log.json');
    let auditLog;
    try {
      const content = await fs.readFile(logPath, 'utf-8');
      auditLog = JSON.parse(content);
    } catch {
      return NextResponse.json(
        { error: 'Story audit log not found' },
        { status: 404 }
      );
    }

    // Load files touched
    let filesTouched;
    try {
      const content = await fs.readFile(
        path.join(storyDir, 'files-touched.json'),
        'utf-8'
      );
      filesTouched = JSON.parse(content);
    } catch {
      filesTouched = { created: [], modified: [], deleted: [] };
    }

    // Load markdown summary
    let summary;
    try {
      summary = await fs.readFile(path.join(storyDir, 'summary.md'), 'utf-8');
    } catch {
      // No summary available
    }

    return NextResponse.json({
      storyId,
      buildId,
      projectId,
      auditLog,
      filesTouched,
      summary,
    });
  } catch (error) {
    console.error('[Audit API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch story audit data' },
      { status: 500 }
    );
  }
}
