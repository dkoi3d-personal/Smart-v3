/**
 * Project Bugs API
 * Manages bug reports for a project - save, load, update
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';

interface Bug {
  id: string;
  title: string;
  description: string;
  steps: string;
  expected: string;
  actual: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'open' | 'analyzing' | 'fixing' | 'fixed' | 'verified' | 'rejected';
  reportedBy?: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt?: string;
  fixedAt?: string;
  verifiedAt?: string;
  fixPlan?: string;
}

interface BugsData {
  projectId: string;
  bugs: Bug[];
  lastUpdated: string;
}

// GET - Load all bugs for a project
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectDir = getProjectDir(projectId);
    const bugsFile = path.join(projectDir, '.uat', 'bugs.json');

    try {
      const data = await fs.readFile(bugsFile, 'utf-8');
      const bugsData: BugsData = JSON.parse(data);
      return NextResponse.json(bugsData);
    } catch {
      // No bugs file yet, return empty
      return NextResponse.json({
        projectId,
        bugs: [],
        lastUpdated: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error('Error loading bugs:', error);
    return NextResponse.json(
      { error: 'Failed to load bugs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST - Add a new bug or update existing
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectDir = getProjectDir(projectId);
    const uatDir = path.join(projectDir, '.uat');
    const bugsFile = path.join(uatDir, 'bugs.json');

    // Ensure .uat directory exists
    await fs.mkdir(uatDir, { recursive: true });

    const { bug, action } = await request.json();

    // Load existing bugs
    let bugsData: BugsData;
    try {
      const data = await fs.readFile(bugsFile, 'utf-8');
      bugsData = JSON.parse(data);
    } catch {
      bugsData = {
        projectId,
        bugs: [],
        lastUpdated: new Date().toISOString(),
      };
    }

    if (action === 'add') {
      // Add new bug
      const newBug: Bug = {
        ...bug,
        id: bug.id || `bug-${Date.now()}`,
        status: bug.status || 'open',
        createdAt: bug.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bugsData.bugs.push(newBug);
    } else if (action === 'update') {
      // Update existing bug
      const index = bugsData.bugs.findIndex(b => b.id === bug.id);
      if (index !== -1) {
        bugsData.bugs[index] = {
          ...bugsData.bugs[index],
          ...bug,
          updatedAt: new Date().toISOString(),
        };
      } else {
        return NextResponse.json({ error: 'Bug not found' }, { status: 404 });
      }
    } else if (action === 'delete') {
      bugsData.bugs = bugsData.bugs.filter(b => b.id !== bug.id);
    }

    bugsData.lastUpdated = new Date().toISOString();

    // Save bugs
    await fs.writeFile(bugsFile, JSON.stringify(bugsData, null, 2));

    return NextResponse.json({ success: true, bugsData });
  } catch (error) {
    console.error('Error saving bug:', error);
    return NextResponse.json(
      { error: 'Failed to save bug', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT - Bulk update bugs (e.g., import from another source)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const projectDir = getProjectDir(projectId);
    const uatDir = path.join(projectDir, '.uat');
    const bugsFile = path.join(uatDir, 'bugs.json');

    await fs.mkdir(uatDir, { recursive: true });

    const { bugs } = await request.json();

    const bugsData: BugsData = {
      projectId,
      bugs: bugs.map((bug: Partial<Bug>) => ({
        ...bug,
        id: bug.id || `bug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        status: bug.status || 'open',
        createdAt: bug.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })),
      lastUpdated: new Date().toISOString(),
    };

    await fs.writeFile(bugsFile, JSON.stringify(bugsData, null, 2));

    return NextResponse.json({ success: true, bugsData });
  } catch (error) {
    console.error('Error bulk updating bugs:', error);
    return NextResponse.json(
      { error: 'Failed to update bugs', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
