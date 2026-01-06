/**
 * Session API Endpoint
 * Load and manage project sessions
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import path from 'path';
import { getProjectDir, getProjectsBaseDir } from '@/lib/project-paths';

/**
 * Validate that a project path is within the projects directory
 * Prevents path traversal attacks
 */
function validateProjectPath(projectId: string): { valid: boolean; projectDir: string; error?: string } {
  // Projects are now in C:\Users\srfit\coding\ai-projects\
  const projectsDir = path.resolve(getProjectsBaseDir());
  const projectDir = path.resolve(getProjectDir(projectId));

  // Ensure the resolved path is within the projects directory
  if (!projectDir.startsWith(projectsDir + path.sep) && projectDir !== projectsDir) {
    return { valid: false, projectDir, error: 'Invalid project ID - path traversal detected' };
  }

  // Validate projectId doesn't contain dangerous characters
  if (projectId.includes('..') || projectId.includes('/') || projectId.includes('\\')) {
    return { valid: false, projectDir, error: 'Invalid project ID format' };
  }

  return { valid: true, projectDir };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  // Validate the project path to prevent path traversal
  const validation = validateProjectPath(projectId);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const projectDir = validation.projectDir;

  try {
    // Check if project exists
    await fs.access(projectDir);

    // Load project metadata
    let projectMeta: any = { projectId };
    try {
      projectMeta = JSON.parse(
        await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8')
      );
    } catch {
      // No metadata file
    }

    // Load plan
    let plan = '';
    try {
      plan = await fs.readFile(path.join(projectDir, 'plan.md'), 'utf-8');
    } catch {
      // No plan file
    }

    // Load tasks
    let tasks: any[] = [];
    try {
      tasks = JSON.parse(
        await fs.readFile(path.join(projectDir, 'tasks.json'), 'utf-8')
      );
    } catch {
      // No tasks file
    }

    // Load build output if exists
    let buildOutput = '';
    try {
      buildOutput = await fs.readFile(path.join(projectDir, 'build-output.md'), 'utf-8');
    } catch {
      // No build output
    }

    return NextResponse.json({
      projectId,
      name: projectMeta.name || projectId,
      requirements: projectMeta.requirements || '',
      status: projectMeta.status || 'idle',
      plan,
      tasks,
      buildOutput,
      createdAt: projectMeta.createdAt,
      updatedAt: projectMeta.updatedAt,
    });

  } catch {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  // Validate the project path to prevent path traversal
  const validation = validateProjectPath(projectId);
  if (!validation.valid) {
    return NextResponse.json(
      { error: validation.error },
      { status: 400 }
    );
  }

  const projectDir = validation.projectDir;

  try {
    await fs.rm(projectDir, { recursive: true, force: true });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
