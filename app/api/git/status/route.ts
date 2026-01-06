/**
 * Git Status API - Get git status for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { getGitStatus, getBranches, isGitRepository } from '@/services/git-service';
import { getProjectsBaseDir } from '@/lib/project-paths';

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

    // Check if it's a git repo
    const isRepo = await isGitRepository(projectDir);
    if (!isRepo) {
      return NextResponse.json({
        projectId,
        isGitRepo: false,
        message: 'Not a git repository',
      });
    }

    // Get full git status
    const gitStatus = await getGitStatus(projectDir);
    const branches = await getBranches(projectDir);

    return NextResponse.json({
      projectId,
      ...gitStatus,
      branches,
    });
  } catch (error: any) {
    console.error('❌ Git status API error:', error);
    return NextResponse.json(
      { error: 'Failed to get git status', details: error.message },
      { status: 500 }
    );
  }
}
