/**
 * Git Pull API - Pull latest changes for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import { pullRepository, getGitStatus, fetchRepository } from '@/services/git-service';
import { loadProjectState, saveProjectState } from '@/lib/project-persistence';
import { getProjectsBaseDir } from '@/lib/project-paths';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, remoteName = 'origin', branch } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const projectDir = path.join(getProjectsBaseDir(), projectId);

    // Load project state to verify it exists
    const projectState = await loadProjectState(projectDir);
    if (!projectState) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // First fetch to get remote refs
    await fetchRepository(projectDir, remoteName);

    // Then pull
    const pullResult = await pullRepository(projectDir, remoteName, branch);

    if (!pullResult.success) {
      return NextResponse.json(
        { error: pullResult.message, details: pullResult.error },
        { status: 500 }
      );
    }

    // Get updated git status
    const gitStatus = await getGitStatus(projectDir);

    // Update project state with new git info
    if (projectState.config?.git) {
      projectState.config.git.lastPulledAt = new Date();
      projectState.config.git.lastCommitHash = gitStatus.lastCommit?.hash;
      await saveProjectState(projectDir, projectState);
    }

    return NextResponse.json({
      success: true,
      projectId,
      git: {
        currentBranch: gitStatus.currentBranch,
        lastCommit: gitStatus.lastCommit,
        hasUncommittedChanges: gitStatus.hasUncommittedChanges,
        ahead: gitStatus.ahead,
        behind: gitStatus.behind,
      },
      pullOutput: pullResult.data,
      message: 'Pull completed successfully',
    });
  } catch (error: any) {
    console.error('❌ Pull API error:', error);
    return NextResponse.json(
      { error: 'Failed to pull repository', details: error.message },
      { status: 500 }
    );
  }
}
