/**
 * Git Service - Handle git operations for projects
 * Enables cloning repositories and managing git state per project
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { promises as fs } from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export interface GitConfig {
  repoUrl: string;
  branch?: string;
  remoteName?: string;
}

export interface GitStatus {
  isGitRepo: boolean;
  currentBranch?: string;
  remoteUrl?: string;
  hasUncommittedChanges?: boolean;
  ahead?: number;
  behind?: number;
  lastCommit?: {
    hash: string;
    message: string;
    author: string;
    date: string;
  };
}

export interface GitOperationResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Check if a directory is a git repository
 */
export async function isGitRepository(projectDir: string): Promise<boolean> {
  try {
    const gitDir = path.join(projectDir, '.git');
    const stat = await fs.stat(gitDir);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Clone a git repository to the project directory
 */
export async function cloneRepository(
  repoUrl: string,
  projectDir: string,
  branch?: string
): Promise<GitOperationResult> {
  try {
    // Ensure parent directory exists
    const parentDir = path.dirname(projectDir);
    await fs.mkdir(parentDir, { recursive: true });

    // Check if directory already exists
    try {
      await fs.access(projectDir);
      // Directory exists, check if it's empty
      const files = await fs.readdir(projectDir);
      if (files.length > 0) {
        return {
          success: false,
          message: 'Project directory already exists and is not empty',
          error: 'DIRECTORY_NOT_EMPTY',
        };
      }
    } catch {
      // Directory doesn't exist, that's fine
    }

    // Build clone command
    let command = `git clone "${repoUrl}"`;
    if (branch) {
      command += ` --branch "${branch}"`;
    }
    command += ` "${projectDir}"`;

    console.log(`🔄 Cloning repository: ${command}`);
    const { stdout, stderr } = await execAsync(command, {
      timeout: 300000, // 5 minute timeout for large repos
    });

    console.log(`✅ Repository cloned successfully`);
    return {
      success: true,
      message: 'Repository cloned successfully',
      data: { stdout, stderr },
    };
  } catch (error: any) {
    console.error(`❌ Failed to clone repository:`, error);
    return {
      success: false,
      message: 'Failed to clone repository',
      error: error.message || String(error),
    };
  }
}

/**
 * Pull latest changes from remote
 */
export async function pullRepository(
  projectDir: string,
  remoteName: string = 'origin',
  branch?: string
): Promise<GitOperationResult> {
  try {
    // Check if it's a git repo
    if (!(await isGitRepository(projectDir))) {
      return {
        success: false,
        message: 'Not a git repository',
        error: 'NOT_A_GIT_REPO',
      };
    }

    // Get current branch if not specified
    if (!branch) {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: projectDir,
      });
      branch = stdout.trim();
    }

    console.log(`🔄 Pulling from ${remoteName}/${branch}`);
    const { stdout, stderr } = await execAsync(
      `git pull "${remoteName}" "${branch}"`,
      { cwd: projectDir, timeout: 120000 }
    );

    console.log(`✅ Pull completed`);
    return {
      success: true,
      message: 'Pull completed successfully',
      data: { stdout, stderr },
    };
  } catch (error: any) {
    console.error(`❌ Failed to pull:`, error);
    return {
      success: false,
      message: 'Failed to pull from remote',
      error: error.message || String(error),
    };
  }
}

/**
 * Get the current git status of a project
 */
export async function getGitStatus(projectDir: string): Promise<GitStatus> {
  try {
    if (!(await isGitRepository(projectDir))) {
      return { isGitRepo: false };
    }

    // Get current branch
    const { stdout: branchOutput } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: projectDir }
    );
    const currentBranch = branchOutput.trim();

    // Get remote URL
    let remoteUrl: string | undefined;
    try {
      const { stdout: remoteOutput } = await execAsync(
        'git remote get-url origin',
        { cwd: projectDir }
      );
      remoteUrl = remoteOutput.trim();
    } catch {
      // No remote configured
    }

    // Check for uncommitted changes
    const { stdout: statusOutput } = await execAsync('git status --porcelain', {
      cwd: projectDir,
    });
    const hasUncommittedChanges = statusOutput.trim().length > 0;

    // Get ahead/behind status
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout: revOutput } = await execAsync(
        `git rev-list --left-right --count origin/${currentBranch}...HEAD`,
        { cwd: projectDir }
      );
      const [behindStr, aheadStr] = revOutput.trim().split('\t');
      behind = parseInt(behindStr, 10) || 0;
      ahead = parseInt(aheadStr, 10) || 0;
    } catch {
      // Can't determine ahead/behind (no tracking branch)
    }

    // Get last commit info
    let lastCommit: GitStatus['lastCommit'];
    try {
      const { stdout: logOutput } = await execAsync(
        'git log -1 --format="%H|%s|%an|%ai"',
        { cwd: projectDir }
      );
      const [hash, message, author, date] = logOutput.trim().split('|');
      lastCommit = { hash, message, author, date };
    } catch {
      // No commits yet
    }

    return {
      isGitRepo: true,
      currentBranch,
      remoteUrl,
      hasUncommittedChanges,
      ahead,
      behind,
      lastCommit,
    };
  } catch (error) {
    console.error(`❌ Failed to get git status:`, error);
    return { isGitRepo: false };
  }
}

/**
 * Fetch latest refs from remote without merging
 */
export async function fetchRepository(
  projectDir: string,
  remoteName: string = 'origin'
): Promise<GitOperationResult> {
  try {
    if (!(await isGitRepository(projectDir))) {
      return {
        success: false,
        message: 'Not a git repository',
        error: 'NOT_A_GIT_REPO',
      };
    }

    console.log(`🔄 Fetching from ${remoteName}`);
    const { stdout, stderr } = await execAsync(`git fetch "${remoteName}"`, {
      cwd: projectDir,
      timeout: 60000,
    });

    return {
      success: true,
      message: 'Fetch completed successfully',
      data: { stdout, stderr },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to fetch from remote',
      error: error.message || String(error),
    };
  }
}

/**
 * Get list of branches (local and remote)
 */
export async function getBranches(projectDir: string): Promise<{
  current: string;
  local: string[];
  remote: string[];
}> {
  try {
    if (!(await isGitRepository(projectDir))) {
      return { current: '', local: [], remote: [] };
    }

    // Current branch
    const { stdout: currentOutput } = await execAsync(
      'git rev-parse --abbrev-ref HEAD',
      { cwd: projectDir }
    );
    const current = currentOutput.trim();

    // Local branches
    const { stdout: localOutput } = await execAsync('git branch --format="%(refname:short)"', {
      cwd: projectDir,
    });
    const local = localOutput
      .trim()
      .split('\n')
      .filter((b) => b.length > 0);

    // Remote branches
    const { stdout: remoteOutput } = await execAsync(
      'git branch -r --format="%(refname:short)"',
      { cwd: projectDir }
    );
    const remote = remoteOutput
      .trim()
      .split('\n')
      .filter((b) => b.length > 0);

    return { current, local, remote };
  } catch (error) {
    console.error(`❌ Failed to get branches:`, error);
    return { current: '', local: [], remote: [] };
  }
}

/**
 * Checkout a branch
 */
export async function checkoutBranch(
  projectDir: string,
  branch: string,
  create: boolean = false
): Promise<GitOperationResult> {
  try {
    if (!(await isGitRepository(projectDir))) {
      return {
        success: false,
        message: 'Not a git repository',
        error: 'NOT_A_GIT_REPO',
      };
    }

    const command = create
      ? `git checkout -b "${branch}"`
      : `git checkout "${branch}"`;

    console.log(`🔄 Checking out branch: ${branch}`);
    const { stdout, stderr } = await execAsync(command, { cwd: projectDir });

    return {
      success: true,
      message: `Switched to branch ${branch}`,
      data: { stdout, stderr },
    };
  } catch (error: any) {
    return {
      success: false,
      message: `Failed to checkout branch ${branch}`,
      error: error.message || String(error),
    };
  }
}

/**
 * Initialize a new git repository
 */
export async function initRepository(projectDir: string): Promise<GitOperationResult> {
  try {
    // Ensure directory exists
    await fs.mkdir(projectDir, { recursive: true });

    // Check if already a git repo
    if (await isGitRepository(projectDir)) {
      return {
        success: true,
        message: 'Already a git repository',
      };
    }

    console.log(`🔄 Initializing git repository`);
    const { stdout, stderr } = await execAsync('git init', { cwd: projectDir });

    return {
      success: true,
      message: 'Git repository initialized',
      data: { stdout, stderr },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to initialize git repository',
      error: error.message || String(error),
    };
  }
}

/**
 * Add a remote to the repository
 */
export async function addRemote(
  projectDir: string,
  remoteName: string,
  remoteUrl: string
): Promise<GitOperationResult> {
  try {
    if (!(await isGitRepository(projectDir))) {
      return {
        success: false,
        message: 'Not a git repository',
        error: 'NOT_A_GIT_REPO',
      };
    }

    const { stdout, stderr } = await execAsync(
      `git remote add "${remoteName}" "${remoteUrl}"`,
      { cwd: projectDir }
    );

    return {
      success: true,
      message: `Remote ${remoteName} added`,
      data: { stdout, stderr },
    };
  } catch (error: any) {
    // Check if remote already exists
    if (error.message?.includes('already exists')) {
      // Update existing remote
      try {
        await execAsync(`git remote set-url "${remoteName}" "${remoteUrl}"`, {
          cwd: projectDir,
        });
        return {
          success: true,
          message: `Remote ${remoteName} updated`,
        };
      } catch (updateError: any) {
        return {
          success: false,
          message: 'Failed to update remote',
          error: updateError.message,
        };
      }
    }
    return {
      success: false,
      message: 'Failed to add remote',
      error: error.message || String(error),
    };
  }
}

/**
 * Get the diff of uncommitted changes
 */
export async function getDiff(
  projectDir: string,
  staged: boolean = false
): Promise<GitOperationResult> {
  try {
    if (!(await isGitRepository(projectDir))) {
      return {
        success: false,
        message: 'Not a git repository',
        error: 'NOT_A_GIT_REPO',
      };
    }

    const command = staged ? 'git diff --staged' : 'git diff';
    const { stdout } = await execAsync(command, { cwd: projectDir });

    return {
      success: true,
      message: 'Diff retrieved',
      data: { diff: stdout },
    };
  } catch (error: any) {
    return {
      success: false,
      message: 'Failed to get diff',
      error: error.message || String(error),
    };
  }
}
