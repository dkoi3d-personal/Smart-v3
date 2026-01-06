/**
 * Fast Project Scaffolding API
 *
 * POST /api/projects/[projectId]/scaffold
 *
 * Quickly scaffolds a new Next.js project by copying a pre-built template
 * instead of running create-next-app (10 min → 30 sec).
 *
 * First call initializes the template (~5 min), subsequent calls are fast (~30 sec).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import { scaffoldProject, needsScaffolding, isTemplateReady } from '@/services/project-scaffold-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const projectDir = getProjectDir(projectId);

  // Parse options from body
  let projectName = projectId;
  let useSymlinks = false;

  try {
    const body = await request.json();
    if (body.projectName) projectName = body.projectName;
    if (body.useSymlinks) useSymlinks = body.useSymlinks;
  } catch {
    // No body, use defaults
  }

  console.log(`[Scaffold API] Request for project: ${projectId}`);

  // Check if project already has package.json
  const needs = await needsScaffolding(projectDir);
  if (!needs) {
    return NextResponse.json({
      success: true,
      message: 'Project already scaffolded (package.json exists)',
      duration: 0,
      method: 'already-exists',
    });
  }

  // Check template status
  const templateReady = await isTemplateReady();
  if (!templateReady) {
    console.log('[Scaffold API] Template not ready - first run will be slow (~5 min)');
  }

  // Scaffold the project
  const result = await scaffoldProject({
    projectDir,
    projectName,
    includeTests: true,
    useSymlinks,
  });

  if (result.success) {
    return NextResponse.json(result);
  } else {
    return NextResponse.json(result, { status: 500 });
  }
}

/**
 * GET - Check scaffold status
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const projectDir = getProjectDir(projectId);

  const templateReady = await isTemplateReady();
  const needsScaffold = await needsScaffolding(projectDir);

  return NextResponse.json({
    projectId,
    templateReady,
    needsScaffolding: needsScaffold,
    estimatedTime: templateReady ? '~30 seconds' : '~5 minutes (first run)',
  });
}
