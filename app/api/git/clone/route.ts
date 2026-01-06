/**
 * Git Clone API - Clone a repository for a new project
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { promises as fs } from 'fs';
import { cloneRepository, getGitStatus } from '@/services/git-service';
import { saveProjectState } from '@/lib/project-persistence';
import { projects, saveProjects } from '../../projects/route';
import { createSession } from '@/services/session-service';
import { getProjectsBaseDir } from '@/lib/project-paths';
import { initializeGitHubProjectHistory, type BuildMetadata } from '@/lib/build-history';
import type { MetricsSnapshot } from '@/features/build/types';

// File extensions to count as code (actual source code, not data/config/docs)
const CODE_EXTENSIONS = new Set([
  // JavaScript/TypeScript
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  // Other languages
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.php', '.swift', '.m', '.mm',
  // Frontend frameworks
  '.vue', '.svelte', '.astro',
  // Stylesheets
  '.css', '.scss', '.sass', '.less',
  // Markup (minimal)
  '.html', '.htm',
  // Database/API
  '.sql', '.graphql', '.prisma',
  // Shell scripts
  '.sh', '.bash', '.zsh', '.fish',
]);

// Config files to count as code (but not data files like .json)
const CONFIG_FILES = new Set([
  'Dockerfile',
  '.env',
  '.env.local',
  '.env.example',
]);

// Directories to skip (matches /api/projects/[projectId]/stats for consistency)
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.turbo', '.cache', 'coverage', '.nyc_output',
  '__pycache__', '.pytest_cache', 'venv', '.venv',
  'vendor', 'target', 'bin', 'obj',
  // Platform-specific directories
  '.audit', '.architecture', 'figma-frames', 'backlog',
]);

// Files to exclude from LOC count (large generated files)
const SKIP_FILES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'figma-context.json',
  'project-state.json',
  'session-state.json',
  '.iteration-state.json',
  'tasks.json',
]);

interface CodebaseStats {
  codeFiles: number;
  codeLines: number;
  totalFiles: number;
  testFiles: number;
}

/**
 * Analyze a directory to count code files and lines
 */
async function analyzeCodebase(dir: string): Promise<CodebaseStats> {
  const stats: CodebaseStats = { codeFiles: 0, codeLines: 0, totalFiles: 0, testFiles: 0 };

  async function walk(currentDir: string, relativePath: string = ''): Promise<void> {
    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        const relPath = path.join(relativePath, entry.name);

        if (entry.isDirectory()) {
          if (!SKIP_DIRS.has(entry.name)) {
            await walk(fullPath, relPath);
          }
        } else if (entry.isFile()) {
          // Skip large generated files
          if (SKIP_FILES.has(entry.name)) {
            continue;
          }

          stats.totalFiles++;
          const ext = path.extname(entry.name).toLowerCase();

          if (CODE_EXTENSIONS.has(ext) || CONFIG_FILES.has(entry.name)) {
            stats.codeFiles++;

            // Check if it's a test file
            const isTest = entry.name.includes('.test.') ||
                           entry.name.includes('.spec.') ||
                           entry.name.includes('_test.') ||
                           relPath.includes('__tests__') ||
                           relPath.includes('/tests/') ||
                           relPath.includes('/test/') ||
                           relPath.includes('\\tests\\') ||
                           relPath.includes('\\test\\');
            if (isTest) {
              stats.testFiles++;
            }

            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              stats.codeLines += content.split('\n').length;
            } catch {
              // Can't read file, skip line counting
            }
          }
        }
      }
    } catch {
      // Directory read error, skip
    }
  }

  await walk(dir);
  return stats;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { repoUrl, branch, projectName } = body;

    if (!repoUrl) {
      return NextResponse.json(
        { error: 'Repository URL is required' },
        { status: 400 }
      );
    }

    // Normalize and validate URL
    let normalizedUrl = repoUrl.trim();

    // Check for valid git URL patterns:
    // - https://github.com/user/repo
    // - https://github.com/user/repo.git
    // - git@github.com:user/repo.git
    // - https://gitlab.com/user/repo
    // - https://bitbucket.org/user/repo
    // - https://dev.azure.com/org/project/_git/repo
    // - https://user@dev.azure.com/org/project/_git/repo
    const httpsPattern = /^https?:\/\/([\w.-]+@)?(github\.com|gitlab\.com|bitbucket\.org|dev\.azure\.com|[\w.-]+)\/.+/i;
    const sshPattern = /^git@[\w.-]+:.+/i;
    // Azure DevOps SSH: git@ssh.dev.azure.com:v3/org/project/repo
    const azureSshPattern = /^git@ssh\.dev\.azure\.com:.+/i;

    const isValidUrl = httpsPattern.test(normalizedUrl) || sshPattern.test(normalizedUrl) || azureSshPattern.test(normalizedUrl);

    if (!isValidUrl) {
      return NextResponse.json(
        { error: 'Invalid repository URL format. Supported formats: GitHub, GitLab, Bitbucket, Azure DevOps (HTTPS or SSH)' },
        { status: 400 }
      );
    }

    // Ensure URL ends with .git for HTTPS GitHub/GitLab/Bitbucket URLs (some git clients need this)
    // Note: Azure DevOps URLs don't need .git suffix
    if (!normalizedUrl.endsWith('.git') && !normalizedUrl.includes('dev.azure.com')) {
      // Add .git suffix if it's a recognized host without it
      if (/\/(github|gitlab|bitbucket)\.(com|org)/i.test(normalizedUrl)) {
        normalizedUrl = normalizedUrl + '.git';
      }
    }

    // Generate project ID
    const projectId = uuidv4();
    const projectDir = path.join(getProjectsBaseDir(), projectId);

    // Clone the repository
    console.log(`📥 Cloning ${normalizedUrl} to ${projectDir}`);
    const cloneResult = await cloneRepository(normalizedUrl, projectDir, branch);

    if (!cloneResult.success) {
      return NextResponse.json(
        { error: cloneResult.message, details: cloneResult.error },
        { status: 500 }
      );
    }

    // Get git status after clone
    const gitStatus = await getGitStatus(projectDir);

    // Infer project name from repo URL if not provided
    const inferredName = projectName ||
      normalizedUrl.split('/').pop()?.replace('.git', '') ||
      projectId;

    // Analyze the cloned codebase for initial metrics
    const codebaseStats = await analyzeCodebase(projectDir);

    // Create initial project state - set to 'completed' so it shows the iteration view
    // Cloned projects already have code, so they're ready for iteration
    const projectState = {
      projectId,
      requirements: `Project cloned from ${normalizedUrl}`,
      config: {
        name: inferredName,
        description: `Project initialized from git repository: ${normalizedUrl}`,
        techStack: [],
        requirements: '',
        targetPlatform: 'web' as const,
        deployment: {
          provider: 'aws' as const,
          environment: 'dev' as const,
        },
        git: {
          repoUrl: normalizedUrl,
          branch: gitStatus.currentBranch || branch || 'main',
          remoteName: 'origin',
          lastPulledAt: new Date(),
          lastCommitHash: gitStatus.lastCommit?.hash,
        },
      },
      epics: [],
      stories: [],
      tasks: [],
      messages: [],
      status: 'completed', // Set to completed so it shows iteration view
      progress: 100,
      errors: [],
      // Include build metrics from codebase analysis
      buildMetrics: {
        startTime: new Date().toISOString(),
        elapsedTime: 0,
        filesCreated: codebaseStats.codeFiles,
        filesModified: 0,
        commandsRun: 0,
        toolCalls: 0,
        tokensUsed: 0,
        linesOfCode: codebaseStats.codeLines,
        iterations: 0,
      },
      testingMetrics: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        passRate: 0,
        duration: 0,
        storiesTested: 0,
        storiesPassed: 0,
        testFiles: [],
        seenTaskIds: [],
      },
      securityMetrics: undefined as any,
      doraMetrics: undefined as any,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Check if the cloned repo already has state files (from a platform-built project)
    // Priority: .agile-stories.json (source of truth) > project-state.json (may be stale)
    const agileStoriesPath = path.join(projectDir, '.agile-stories.json');
    const existingProjectStatePath = path.join(projectDir, 'project-state.json');
    let existingProjectState: any = null;
    let agileStories: any = null;

    // First try to load .agile-stories.json (source of truth for tasks/epics)
    try {
      const content = await fs.readFile(agileStoriesPath, 'utf-8');
      agileStories = JSON.parse(content);
      console.log(`📋 Found .agile-stories.json with ${agileStories.tasks?.length || 0} tasks`);
    } catch {
      // No agile stories file
    }

    // Then load project-state.json for metrics and other state
    try {
      const content = await fs.readFile(existingProjectStatePath, 'utf-8');
      existingProjectState = JSON.parse(content);
      console.log(`📋 Found existing project state from git`);
    } catch {
      // No existing project state
    }

    // Use existing state if available, otherwise create new
    if (existingProjectState || agileStories) {
      // Tasks/epics from .agile-stories.json (source of truth), fallback to project-state.json
      projectState.tasks = agileStories?.tasks || existingProjectState?.tasks || [];
      projectState.epics = agileStories?.epics || existingProjectState?.epics || [];
      projectState.stories = existingProjectState?.stories || [];

      // Metrics from project-state.json
      if (existingProjectState) {
        projectState.buildMetrics = existingProjectState.buildMetrics || projectState.buildMetrics;
        projectState.testingMetrics = existingProjectState.testingMetrics || projectState.testingMetrics;
        projectState.securityMetrics = existingProjectState.securityMetrics;
        projectState.doraMetrics = existingProjectState.doraMetrics;
        // Keep original build time if available
        if (existingProjectState.createdAt) {
          projectState.createdAt = existingProjectState.createdAt;
        }
      }
    }

    // Save project state to project directory
    await saveProjectState(projectDir, projectState);

    // Initialize build history with v1 as the cloned state
    // Next build will be v2
    const v1Metadata = await initializeGitHubProjectHistory(
      projectDir,
      normalizedUrl,
      inferredName
    );
    if (v1Metadata) {
      console.log(`📋 Created v1 build history with commit ${v1Metadata.commitHash?.slice(0, 7) || 'unknown'}, ${v1Metadata.metrics?.filesCreated || 0} files, ${v1Metadata.metrics?.linesOfCode || 0} LOC`);
    }

    // Register project in the global projects map
    projects.set(projectId, {
      projectId,
      requirements: `Project cloned from ${normalizedUrl}`,
      config: projectState.config,
      status: 'completed', // Cloned projects are ready for iteration
      progress: 100,
      projectDirectory: projectDir,
      source: 'github', // Mark as GitHub project for UI detection
      gitUrl: normalizedUrl,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await saveProjects(); // Persist to disk

    // Create a session for this project
    const session = await createSession({
      projectId,
      projectDir,
      resumeIfExists: false,
    });
    console.log(`📋 Created session ${session.sessionId} for cloned project ${projectId}`);

    console.log(`📊 Codebase stats: ${codebaseStats.codeFiles} files, ${codebaseStats.codeLines} LOC, ${codebaseStats.testFiles} test files`);

    return NextResponse.json({
      success: true,
      projectId,
      projectDirectory: projectDir,
      name: inferredName,
      sessionId: session.sessionId,
      git: {
        repoUrl: normalizedUrl,
        branch: gitStatus.currentBranch,
        lastCommit: gitStatus.lastCommit,
      },
      stats: {
        files: codebaseStats.codeFiles,
        linesOfCode: codebaseStats.codeLines,
        totalFiles: codebaseStats.totalFiles,
        testFiles: codebaseStats.testFiles,
      },
      message: 'Repository cloned successfully',
    });
  } catch (error: any) {
    console.error('❌ Clone API error:', error);
    return NextResponse.json(
      { error: 'Failed to clone repository', details: error.message },
      { status: 500 }
    );
  }
}
