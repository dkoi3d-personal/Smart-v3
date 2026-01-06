/**
 * Git Branches API - Get and manage branches for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getBranches, checkoutBranch, fetchRepository } from '@/services/git-service';
import { getProjectsBaseDir } from '@/lib/project-paths';

// GET - List all branches
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectDir = path.join(getProjectsBaseDir(), projectId);

    // Fetch latest remote refs first
    await fetchRepository(projectDir, 'origin');

    const branches = await getBranches(projectDir);

    return NextResponse.json({
      projectId,
      ...branches,
    });
  } catch (error: any) {
    console.error('❌ Branches API error:', error);
    return NextResponse.json(
      { error: 'Failed to get branches', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Checkout a branch
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, branch, create = false } = body;

    if (!projectId || !branch) {
      return NextResponse.json(
        { error: 'Project ID and branch name are required' },
        { status: 400 }
      );
    }

    const projectDir = path.join(getProjectsBaseDir(), projectId);

    const result = await checkoutBranch(projectDir, branch, create);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message, details: result.error },
        { status: 500 }
      );
    }

    // Get updated branches
    const branches = await getBranches(projectDir);

    return NextResponse.json({
      success: true,
      projectId,
      message: result.message,
      ...branches,
    });
  } catch (error: any) {
    console.error('❌ Checkout API error:', error);
    return NextResponse.json(
      { error: 'Failed to checkout branch', details: error.message },
      { status: 500 }
    );
  }
}
