/**
 * Git Restore API
 *
 * Restores a project to a specific Git commit hash.
 * Creates a new branch from the specified commit to preserve history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: NextRequest) {
  try {
    const { projectDir, commitHash } = await request.json();

    if (!projectDir || !commitHash) {
      return NextResponse.json(
        { error: 'Missing projectDir or commitHash' },
        { status: 400 }
      );
    }

    // Validate commit hash format (40 chars for full hash or 7+ for short)
    if (!/^[a-f0-9]{7,40}$/i.test(commitHash)) {
      return NextResponse.json(
        { error: 'Invalid commit hash format' },
        { status: 400 }
      );
    }

    // Check if the directory is a git repository
    try {
      await execAsync('git rev-parse --git-dir', { cwd: projectDir });
    } catch {
      return NextResponse.json(
        { error: 'Not a git repository' },
        { status: 400 }
      );
    }

    // Check if there are uncommitted changes
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: projectDir,
    });

    if (statusOutput.trim()) {
      return NextResponse.json(
        {
          error: 'Uncommitted changes detected',
          details: 'Please commit or stash your changes before restoring to a previous version.'
        },
        { status: 409 }
      );
    }

    // Verify the commit exists
    try {
      await execAsync(`git cat-file -t ${commitHash}`, { cwd: projectDir });
    } catch {
      return NextResponse.json(
        { error: 'Commit not found' },
        { status: 404 }
      );
    }

    // Get the short hash for branch naming
    const { stdout: shortHash } = await execAsync(
      `git rev-parse --short ${commitHash}`,
      { cwd: projectDir }
    );
    const branchName = `restore-${shortHash.trim()}-${Date.now()}`;

    // Create a new branch from the commit and switch to it
    await execAsync(`git checkout -b ${branchName} ${commitHash}`, {
      cwd: projectDir,
    });

    // Get current commit info for confirmation
    const { stdout: commitInfo } = await execAsync(
      'git log -1 --format="%H|%s|%ai"',
      { cwd: projectDir }
    );
    const [fullHash, message, date] = commitInfo.trim().split('|');

    return NextResponse.json({
      success: true,
      branch: branchName,
      commit: {
        hash: fullHash,
        shortHash: fullHash.slice(0, 7),
        message: message,
        date: date,
      },
    });
  } catch (error) {
    console.error('[Git Restore] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to restore version',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check current git status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectDir = searchParams.get('projectDir');

  if (!projectDir) {
    return NextResponse.json(
      { error: 'Missing projectDir' },
      { status: 400 }
    );
  }

  try {
    // Get current branch
    const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: projectDir,
    });

    // Get current commit
    const { stdout: commit } = await execAsync('git rev-parse HEAD', {
      cwd: projectDir,
    });

    // Check for uncommitted changes
    const { stdout: status } = await execAsync('git status --porcelain', {
      cwd: projectDir,
    });

    return NextResponse.json({
      branch: branch.trim(),
      commit: commit.trim(),
      shortCommit: commit.trim().slice(0, 7),
      hasUncommittedChanges: status.trim().length > 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get git status' },
      { status: 500 }
    );
  }
}
