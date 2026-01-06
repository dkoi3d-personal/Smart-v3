/**
 * Quick Build Project API
 *
 * GET /api/quick-build/[projectId] - Get project details
 * PATCH /api/quick-build/[projectId] - Update project status
 * DELETE /api/quick-build/[projectId] - Delete project
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const QUICK_BUILD_STORE = path.join(process.cwd(), 'data', 'quick-builds.json');

interface QuickBuildProject {
  projectId: string;
  templateId: string;
  templateConfig: any;
  status: 'pending' | 'building' | 'complete' | 'error';
  error?: string;
  createdAt: string;
  updatedAt: string;
}

async function loadProjects(): Promise<QuickBuildProject[]> {
  try {
    const content = await fs.readFile(QUICK_BUILD_STORE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveProjects(projects: QuickBuildProject[]): Promise<void> {
  await fs.mkdir(path.dirname(QUICK_BUILD_STORE), { recursive: true });
  await fs.writeFile(QUICK_BUILD_STORE, JSON.stringify(projects, null, 2));
}

// GET - Get project by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projects = await loadProjects();
    const project = projects.find(p => p.projectId === projectId);

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error('[quick-build] Error getting project:', error);
    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

// PATCH - Update project
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { status, error } = body;

    const projects = await loadProjects();
    const projectIndex = projects.findIndex(p => p.projectId === projectId);

    if (projectIndex === -1) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Update project
    if (status) {
      projects[projectIndex].status = status;
    }
    if (error !== undefined) {
      projects[projectIndex].error = error;
    }
    projects[projectIndex].updatedAt = new Date().toISOString();

    await saveProjects(projects);

    console.log('[quick-build] Updated project:', projectId, 'status:', status);

    return NextResponse.json(projects[projectIndex]);
  } catch (error) {
    console.error('[quick-build] Error updating project:', error);
    return NextResponse.json(
      { error: 'Failed to update project' },
      { status: 500 }
    );
  }
}

// DELETE - Delete project
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projects = await loadProjects();
    const projectIndex = projects.findIndex(p => p.projectId === projectId);

    if (projectIndex === -1) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    projects.splice(projectIndex, 1);
    await saveProjects(projects);

    console.log('[quick-build] Deleted project:', projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[quick-build] Error deleting project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
