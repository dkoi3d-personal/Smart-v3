/**
 * API Route: Get/Update Architecture Documentation
 * GET /api/architecture/[projectId] - Get existing documentation
 * PUT /api/architecture/[projectId] - Update documentation
 *
 * Supports custom project paths for cloned repositories
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveProjectPath } from '@/lib/project-path-resolver';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectPath = await resolveProjectPath(projectId);
    const docsPath = path.join(
      projectPath,
      '.architecture',
      'overview.json'
    );

    try {
      const content = await fs.readFile(docsPath, 'utf-8');
      const overview = JSON.parse(content);

      return NextResponse.json({ overview });
    } catch (readError) {
      // No existing documentation
      return NextResponse.json({ overview: null });
    }
  } catch (error) {
    console.error('Error fetching architecture docs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const { overview } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!overview) {
      return NextResponse.json(
        { error: 'Overview data is required' },
        { status: 400 }
      );
    }

    const projectPath = await resolveProjectPath(projectId);
    const docsPath = path.join(
      projectPath,
      '.architecture'
    );

    // Ensure directory exists
    await fs.mkdir(docsPath, { recursive: true });

    // Update lastUpdated
    overview.lastUpdated = new Date().toISOString();

    // Save the documentation
    await fs.writeFile(
      path.join(docsPath, 'overview.json'),
      JSON.stringify(overview, null, 2)
    );

    return NextResponse.json({ success: true, overview });
  } catch (error) {
    console.error('Error updating architecture docs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectPath = await resolveProjectPath(projectId);
    const docsPath = path.join(
      projectPath,
      '.architecture'
    );

    try {
      await fs.rm(docsPath, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting architecture docs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
