/**
 * Quick Build Projects API
 *
 * POST /api/quick-build - Create a new Quick Build project
 * GET /api/quick-build - List all Quick Build projects
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

const QUICK_BUILD_STORE = path.join(process.cwd(), 'data', 'quick-builds.json');

export interface QuickBuildProject {
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

// POST - Create new project
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, templateConfig } = body;

    if (!templateId || !templateConfig) {
      return NextResponse.json(
        { error: 'templateId and templateConfig are required' },
        { status: 400 }
      );
    }

    // Generate project ID
    const projectId = `qb-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const project: QuickBuildProject = {
      projectId,
      templateId,
      templateConfig,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Save to store
    const projects = await loadProjects();
    projects.unshift(project); // Add to beginning

    // Keep only last 50 projects
    if (projects.length > 50) {
      projects.splice(50);
    }

    await saveProjects(projects);

    console.log('[quick-build] Created project:', projectId, 'template:', templateId);

    return NextResponse.json({ projectId, project });
  } catch (error) {
    console.error('[quick-build] Error creating project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

// GET - List projects
export async function GET() {
  try {
    const projects = await loadProjects();
    return NextResponse.json(projects);
  } catch (error) {
    console.error('[quick-build] Error listing projects:', error);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}
