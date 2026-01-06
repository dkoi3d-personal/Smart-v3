/**
 * Build History Management
 *
 * Handles archiving builds to .build-history/ folders and loading history.
 * Each build (including iterations) gets archived as a clean snapshot.
 *
 * File structure:
 * project-dir/
 *   .agile-stories.json      - Current build stories only
 *   .build-metadata.json     - Current build info
 *   .build-history/
 *     build-1/
 *       .agile-stories.json  - Archived stories
 *       metadata.json        - Build metrics, commit hash, etc.
 *       figma-context.json   - Design context (if Figma build)
 *     build-2/
 *       ...
 */

import * as fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

// =============================================================================
// Types
// =============================================================================

export interface BuildMetadata {
  buildNumber: number;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  status: 'in_progress' | 'completed' | 'failed';
  metrics?: MetricsSnapshot;
  initialCommitHash?: string; // Commit hash at build start (to detect if new commit was made)
  commitHash?: string;        // Commit hash at build completion (only set if new commit was made)
  storyCount?: number;
  epicCount?: number;
  source?: 'text' | 'figma';
  figmaUrl?: string;
}

export interface MetricsSnapshot {
  filesCreated: number;
  filesModified: number;
  linesOfCode: number;
  testsTotal: number;
  testsPassed: number;
  testsFailed: number;
  coverage: number;
  duration: number;
  tokensUsed: number;
  commandsRun: number;
  securityGrade?: string;
  securityScore?: number;
}

export interface BuildHistoryEntry extends BuildMetadata {
  isCurrent?: boolean;
  archivePath?: string;
}

// =============================================================================
// Constants
// =============================================================================

const BUILD_HISTORY_DIR = '.build-history';
const BUILD_METADATA_FILE = '.build-metadata.json';
const STORIES_FILE = '.agile-stories.json';
const FIGMA_CONTEXT_FILE = 'figma-context.json';
const DESIGN_TOKENS_FILE = 'design-tokens.json';
const AGENT_MESSAGES_FILE = '.agent-messages.json';
const BUILD_LOGS_FILE = '.build-logs.json';
const TEST_RESULTS_FILE = '.vitest-results.json';

// =============================================================================
// Git Utilities
// =============================================================================

/**
 * Get current git commit hash (short form)
 */
export function getGitCommitHash(projectDir: string): string | undefined {
  try {
    const hash = execSync('git rev-parse --short HEAD', {
      cwd: projectDir,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    return hash || undefined;
  } catch {
    return undefined;
  }
}

// =============================================================================
// File Utilities
// =============================================================================

/**
 * Recursively copy a directory
 */
async function copyDirectory(src: string, dest: string): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

// =============================================================================
// Build Metadata Management
// =============================================================================

/**
 * Load current build metadata from project directory
 */
export async function loadBuildMetadata(projectDir: string): Promise<BuildMetadata | null> {
  try {
    const metadataPath = path.join(projectDir, BUILD_METADATA_FILE);
    const data = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Save current build metadata
 */
export async function saveBuildMetadata(projectDir: string, metadata: BuildMetadata): Promise<void> {
  const metadataPath = path.join(projectDir, BUILD_METADATA_FILE);
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
}

/**
 * Get the next build number for a project
 */
export async function getNextBuildNumber(projectDir: string): Promise<number> {
  const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);

  try {
    const entries = await fs.readdir(historyDir);
    const buildNumbers = entries
      .filter(e => e.startsWith('build-'))
      .map(e => parseInt(e.replace('build-', ''), 10))
      .filter(n => !isNaN(n));

    if (buildNumbers.length === 0) return 1;
    return Math.max(...buildNumbers) + 1;
  } catch {
    // No history directory yet
    return 1;
  }
}

/**
 * Check if this is an existing project (has previous builds or code)
 */
export async function isExistingProject(projectDir: string): Promise<boolean> {
  // Check for .build-history folder with builds
  const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);
  try {
    const entries = await fs.readdir(historyDir);
    if (entries.some(e => e.startsWith('build-'))) {
      return true;
    }
  } catch {
    // No history directory
  }

  // Check for package.json (indicates initialized project)
  try {
    await fs.access(path.join(projectDir, 'package.json'));
    return true;
  } catch {
    // No package.json
  }

  // Check for current build metadata with buildNumber > 1
  const metadata = await loadBuildMetadata(projectDir);
  if (metadata && metadata.buildNumber > 1) {
    return true;
  }

  return false;
}

// =============================================================================
// Archive Operations
// =============================================================================

/**
 * Archive the current build state to .build-history/build-N/
 * Call this BEFORE starting a new build
 */
export async function archiveCurrentBuild(projectDir: string): Promise<{ archived: boolean; buildNumber: number }> {
  let currentMetadata = await loadBuildMetadata(projectDir);

  // Check if stories exist even without metadata (e.g., cloned from git)
  const storiesPath = path.join(projectDir, STORIES_FILE);
  let hasStories = false;
  let storiesData: { tasks?: unknown[]; epics?: unknown[] } | null = null;

  try {
    const storiesContent = await fs.readFile(storiesPath, 'utf-8');
    storiesData = JSON.parse(storiesContent);
    hasStories = (storiesData?.tasks?.length ?? 0) > 0 || (storiesData?.epics?.length ?? 0) > 0;
  } catch {
    // No stories file
  }

  // If no current build metadata AND no stories, nothing to archive
  if (!currentMetadata && !hasStories) {
    console.log('[Build History] No current build to archive');
    return { archived: false, buildNumber: 1 };
  }

  // If we have stories but no metadata (cloned repo case), add stories to existing build
  if (!currentMetadata && hasStories) {
    const nextBuildNumber = await getNextBuildNumber(projectDir);
    const targetBuildNumber = nextBuildNumber > 1 ? nextBuildNumber - 1 : 1;
    const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);
    const targetArchiveDir = path.join(historyDir, `build-${targetBuildNumber}`);
    const targetStoriesPath = path.join(targetArchiveDir, STORIES_FILE);
    const targetMetadataPath = path.join(targetArchiveDir, 'metadata.json');

    // Check if target build folder exists but is missing stories
    let existingBuildMissingStories = false;
    try {
      await fs.access(targetArchiveDir);
      try {
        await fs.access(targetStoriesPath);
      } catch {
        existingBuildMissingStories = true;
      }
    } catch {
      // Target folder doesn't exist, will create new
    }

    if (existingBuildMissingStories) {
      // Add stories to existing build folder and update counts
      console.log(`[Build History] Adding missing stories to existing build-${targetBuildNumber}`);
      await fs.copyFile(storiesPath, targetStoriesPath);

      // Update metadata counts without overwriting original data
      try {
        const existingMetadata = JSON.parse(await fs.readFile(targetMetadataPath, 'utf-8'));
        existingMetadata.storyCount = storiesData?.tasks?.length || 0;
        existingMetadata.epicCount = storiesData?.epics?.length || 0;
        await fs.writeFile(targetMetadataPath, JSON.stringify(existingMetadata, null, 2));
        console.log(`[Build History] Updated build-${targetBuildNumber} metadata: ${existingMetadata.storyCount} stories, ${existingMetadata.epicCount} epics`);
      } catch (err) {
        console.warn('[Build History] Could not update metadata:', err);
      }

      // Stories are now archived, return success
      return { archived: true, buildNumber: targetBuildNumber };
    }

    // No existing build to update, create synthetic metadata for new archive
    console.log('[Build History] Found stories without metadata (likely cloned repo), creating synthetic metadata');
    currentMetadata = {
      buildNumber: targetBuildNumber,
      prompt: 'Archived from cloned repository',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      status: 'completed',
      storyCount: storiesData?.tasks?.length || 0,
      epicCount: storiesData?.epics?.length || 0,
    };
  }

  // At this point currentMetadata is guaranteed non-null:
  // - Line 222 returns early if both are null/false
  // - Line 271 assigns synthetic metadata if hasStories but no metadata
  if (!currentMetadata) {
    console.log('[Build History] No metadata available for archiving');
    return { archived: false, buildNumber: 1 };
  }

  if (currentMetadata.status === 'in_progress') {
    console.log('[Build History] Current build still in progress, marking as failed before archive');
    currentMetadata.status = 'failed';
    currentMetadata.completedAt = new Date().toISOString();
  }

  const buildNumber = currentMetadata.buildNumber;
  const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);
  const archiveDir = path.join(historyDir, `build-${buildNumber}`);

  // Create archive directory
  await fs.mkdir(archiveDir, { recursive: true });

  // Archive stories file with filtering (remove old stories from previous builds)
  try {
    const srcStoriesPath = path.join(projectDir, STORIES_FILE);
    const destStoriesPath = path.join(archiveDir, STORIES_FILE);
    const storiesContent = await fs.readFile(srcStoriesPath, 'utf-8');
    const stories = JSON.parse(storiesContent);

    // Filter stories to only include ones from this build (based on timestamp in ID)
    const buildStartTime = new Date(currentMetadata.startedAt).getTime();
    const maxAgeMs = 60 * 60 * 1000; // 1 hour buffer

    const filterByTimestamp = (item: any) => {
      const match = item.id?.match(/\b(1\d{12})\b/);
      if (!match) return true; // Keep items without timestamp (e.g., "story-foundation")
      const timestamp = parseInt(match[1], 10);
      return timestamp >= buildStartTime - maxAgeMs;
    };

    const filteredTasks = (stories.tasks || []).filter(filterByTimestamp);
    const filteredEpics = (stories.epics || []).filter(filterByTimestamp);

    const removedTasks = (stories.tasks?.length || 0) - filteredTasks.length;
    const removedEpics = (stories.epics?.length || 0) - filteredEpics.length;

    if (removedTasks > 0 || removedEpics > 0) {
      console.log(`[Build History] Filtered out ${removedTasks} stale tasks and ${removedEpics} stale epics from archive`);
    }

    const filteredStories = {
      tasks: filteredTasks,
      epics: filteredEpics,
      lastUpdated: stories.lastUpdated || new Date().toISOString(),
    };

    await fs.writeFile(destStoriesPath, JSON.stringify(filteredStories, null, 2));
  } catch {
    // Stories file doesn't exist, skip
  }

  // Copy other files to archive
  const filesToArchive = [
    { src: FIGMA_CONTEXT_FILE, dest: FIGMA_CONTEXT_FILE },
    { src: DESIGN_TOKENS_FILE, dest: DESIGN_TOKENS_FILE },
    { src: AGENT_MESSAGES_FILE, dest: AGENT_MESSAGES_FILE },
    { src: BUILD_LOGS_FILE, dest: BUILD_LOGS_FILE },
    { src: TEST_RESULTS_FILE, dest: TEST_RESULTS_FILE },
  ];

  for (const file of filesToArchive) {
    try {
      const srcPath = path.join(projectDir, file.src);
      const destPath = path.join(archiveDir, file.dest);
      await fs.copyFile(srcPath, destPath);
    } catch {
      // File doesn't exist, skip
    }
  }

  // Archive directories (coverage, audit logs, etc.)
  const dirsToArchive = [
    { src: 'coverage', dest: 'coverage' },      // Test coverage reports
    { src: '.audit', dest: 'audit' },           // Audit logs (comprehensive build history)
  ];

  for (const dir of dirsToArchive) {
    try {
      const srcDir = path.join(projectDir, dir.src);
      const destDir = path.join(archiveDir, dir.dest);
      await copyDirectory(srcDir, destDir);
      console.log(`[Build History] Archived ${dir.src} directory`);
    } catch {
      // Directory doesn't exist, skip
    }
  }

  // Archive per-story test results (.test-results-*.json) to tests/ subfolder, then delete originals
  try {
    const projectFiles = await fs.readdir(projectDir);
    const testResultFiles = projectFiles.filter(f => f.startsWith('.test-results-') && f.endsWith('.json'));

    if (testResultFiles.length > 0) {
      const testsDir = path.join(archiveDir, 'tests');
      await fs.mkdir(testsDir, { recursive: true });

      for (const file of testResultFiles) {
        const srcPath = path.join(projectDir, file);
        const destPath = path.join(testsDir, file);
        await fs.copyFile(srcPath, destPath);
        await fs.unlink(srcPath); // Delete original after copying
      }
      console.log(`[Build History] Archived ${testResultFiles.length} test result files to tests/`);
    }
  } catch (err) {
    console.warn('[Build History] Failed to archive test results:', err);
  }

  // Get final story/epic counts from stories file
  try {
    const storiesPath = path.join(projectDir, STORIES_FILE);
    const storiesData = JSON.parse(await fs.readFile(storiesPath, 'utf-8'));
    currentMetadata.storyCount = storiesData.tasks?.length || 0;
    currentMetadata.epicCount = storiesData.epics?.length || 0;
  } catch {
    // Stories file doesn't exist
  }

  // Capture git commit hash if not already set
  if (!currentMetadata.commitHash) {
    currentMetadata.commitHash = getGitCommitHash(projectDir);
  }

  // Save metadata to archive
  const archiveMetadataPath = path.join(archiveDir, 'metadata.json');
  await fs.writeFile(archiveMetadataPath, JSON.stringify(currentMetadata, null, 2));

  // Archive figma-frames directory if it exists
  try {
    const figmaFramesDir = path.join(projectDir, 'figma-frames');
    const archiveFramesDir = path.join(archiveDir, 'figma-frames');
    await copyDirectory(figmaFramesDir, archiveFramesDir);
    console.log(`[Build History] Archived figma-frames directory`);
  } catch {
    // Directory doesn't exist, skip
  }

  console.log(`[Build History] Archived build ${buildNumber} to ${archiveDir}`);

  return { archived: true, buildNumber };
}

/**
 * Clean up build artifacts after archiving (for fresh build start)
 * Call this after archiveCurrentBuild when starting a new build
 *
 * Deletes: stories, messages, logs, test results, figma-frames, figma-context.json
 * Keeps: design-tokens.json, figma-icons/ (code may reference these)
 */
export async function cleanupBuildArtifacts(projectDir: string): Promise<void> {
  console.log('[Build History] Cleaning up build artifacts for fresh start...');

  // Files to DELETE (pure build artifacts)
  const filesToDelete = [
    STORIES_FILE,           // .agile-stories.json
    AGENT_MESSAGES_FILE,    // .agent-messages.json
    BUILD_LOGS_FILE,        // .build-logs.json
    TEST_RESULTS_FILE,      // .vitest-results.json
    'figma-context.json',   // MUST delete so new extraction replaces it
    'figma-screens.json',   // Large screens data file
    'project-state.json',   // Clear old build state (tasks, epics from previous builds)
  ];

  for (const file of filesToDelete) {
    try {
      await fs.unlink(path.join(projectDir, file));
      console.log(`[Build History] Deleted ${file}`);
    } catch {
      // File doesn't exist, skip
    }
  }

  // Delete figma-frames directory (reference images, not used in code)
  try {
    const figmaFramesDir = path.join(projectDir, 'figma-frames');
    await fs.rm(figmaFramesDir, { recursive: true, force: true });
    console.log(`[Build History] Deleted figma-frames directory`);
  } catch {
    // Directory doesn't exist, skip
  }

  // Delete any remaining .test-results-*.json files
  try {
    const projectFiles = await fs.readdir(projectDir);
    const testResultFiles = projectFiles.filter(f => f.startsWith('.test-results-') && f.endsWith('.json'));
    for (const file of testResultFiles) {
      await fs.unlink(path.join(projectDir, file));
    }
    if (testResultFiles.length > 0) {
      console.log(`[Build History] Deleted ${testResultFiles.length} test result files`);
    }
  } catch {
    // Error reading directory, skip
  }

  // NOTE: We intentionally KEEP these files:
  // - design-tokens.json (tokens are implemented in codebase, diff detection handles updates)
  // - figma-icons/ (SVGs may be imported in components)
  // We DELETE figma-context.json so PO never sees stale data from previous builds

  // CRITICAL: Create an empty stories file to prevent git from restoring old stories
  // When the file doesn't exist, Claude CLI might restore it from git HEAD
  // Creating an empty file ensures the PO starts fresh
  const emptyStories = { tasks: [], epics: [], lastUpdated: new Date().toISOString() };
  await fs.writeFile(
    path.join(projectDir, STORIES_FILE),
    JSON.stringify(emptyStories, null, 2)
  );
  console.log('[Build History] Created empty .agile-stories.json to prevent git restore');

  console.log('[Build History] Build artifacts cleaned up');
}

/**
 * Reset project for a new build (clears stories, creates fresh metadata)
 */
export async function resetForNewBuild(
  projectDir: string,
  prompt: string,
  source: 'text' | 'figma' = 'text',
  figmaUrl?: string
): Promise<BuildMetadata> {
  // Get next build number
  const buildNumber = await getNextBuildNumber(projectDir);

  // Capture current commit hash at build start (to detect if new commits were made)
  const initialCommitHash = getGitCommitHash(projectDir);

  // Create fresh metadata
  const metadata: BuildMetadata = {
    buildNumber,
    prompt,
    startedAt: new Date().toISOString(),
    status: 'in_progress',
    source,
    figmaUrl,
    initialCommitHash, // Track starting point to detect new commits
  };

  // Save metadata
  await saveBuildMetadata(projectDir, metadata);

  // Reset stories file to empty
  const storiesPath = path.join(projectDir, STORIES_FILE);
  const emptyStories = {
    epics: [],
    tasks: [],
    lastUpdated: new Date().toISOString(),
  };
  await fs.writeFile(storiesPath, JSON.stringify(emptyStories, null, 2));

  console.log(`[Build History] Reset for build ${buildNumber}`);

  return metadata;
}

/**
 * Complete the current build (update metadata with final state)
 */
export async function completeBuild(
  projectDir: string,
  status: 'completed' | 'failed',
  metrics?: MetricsSnapshot
): Promise<void> {
  const metadata = await loadBuildMetadata(projectDir);
  if (!metadata) {
    console.warn('[Build History] No build metadata to complete');
    return;
  }

  metadata.status = status;
  metadata.completedAt = new Date().toISOString();

  // Capture commit hash - prefer final commit if different from start, otherwise use initial
  const currentCommitHash = getGitCommitHash(projectDir);
  if (currentCommitHash && currentCommitHash !== metadata.initialCommitHash) {
    metadata.commitHash = currentCommitHash;
    console.log(`[Build History] New commit detected: ${currentCommitHash}`);
  } else if (currentCommitHash) {
    // No new commit, but still capture the commit hash for reference
    metadata.commitHash = currentCommitHash;
    console.log(`[Build History] Using current commit hash: ${currentCommitHash}`);
  } else if (metadata.initialCommitHash) {
    // Git not working now but we had a hash at start
    metadata.commitHash = metadata.initialCommitHash;
    console.log(`[Build History] Using initial commit hash: ${metadata.initialCommitHash}`);
  }

  if (metrics) {
    metadata.metrics = metrics;
  }

  // Get final story/epic counts
  try {
    const storiesPath = path.join(projectDir, STORIES_FILE);
    const storiesData = JSON.parse(await fs.readFile(storiesPath, 'utf-8'));
    metadata.storyCount = storiesData.tasks?.length || 0;
    metadata.epicCount = storiesData.epics?.length || 0;
  } catch {
    // Stories file doesn't exist
  }

  await saveBuildMetadata(projectDir, metadata);
  console.log(`[Build History] Build ${metadata.buildNumber} marked as ${status}`);

  // Archive the completed build immediately (don't wait for next build to start)
  const archiveResult = await archiveCurrentBuild(projectDir);

  // Delete the stale .build-metadata.json since it's now archived
  if (archiveResult.archived) {
    try {
      await fs.unlink(path.join(projectDir, BUILD_METADATA_FILE));
      console.log(`[Build History] Cleaned up .build-metadata.json after archiving build ${metadata.buildNumber}`);
    } catch {
      // File already deleted or doesn't exist
    }
  }
}

/**
 * Save agent messages to file (call at build completion)
 */
export async function saveAgentMessages(projectDir: string, messages: any[]): Promise<void> {
  try {
    const messagesPath = path.join(projectDir, AGENT_MESSAGES_FILE);
    await fs.writeFile(messagesPath, JSON.stringify(messages, null, 2));
    console.log(`[Build History] Saved ${messages.length} agent messages`);
  } catch (err) {
    console.error('[Build History] Failed to save agent messages:', err);
  }
}

/**
 * Save build logs to file (call at build completion)
 */
export async function saveBuildLogs(projectDir: string, logs: any[]): Promise<void> {
  try {
    const logsPath = path.join(projectDir, BUILD_LOGS_FILE);
    await fs.writeFile(logsPath, JSON.stringify(logs, null, 2));
    console.log(`[Build History] Saved ${logs.length} build logs`);
  } catch (err) {
    console.error('[Build History] Failed to save build logs:', err);
  }
}

/**
 * Load agent messages from archived build
 */
export async function loadArchivedMessages(projectDir: string, buildNumber: number): Promise<any[]> {
  try {
    const messagesPath = path.join(projectDir, BUILD_HISTORY_DIR, `build-${buildNumber}`, AGENT_MESSAGES_FILE);
    const data = await fs.readFile(messagesPath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// =============================================================================
// History Loading
// =============================================================================

/**
 * Load all build history for a project
 */
export async function loadBuildHistory(projectDir: string): Promise<BuildHistoryEntry[]> {
  const builds: BuildHistoryEntry[] = [];
  const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);

  // Load archived builds
  try {
    const entries = await fs.readdir(historyDir);
    const buildFolders = entries
      .filter(e => e.startsWith('build-'))
      .sort((a, b) => {
        const numA = parseInt(a.replace('build-', ''), 10);
        const numB = parseInt(b.replace('build-', ''), 10);
        return numA - numB;
      });

    for (const folder of buildFolders) {
      try {
        const metadataPath = path.join(historyDir, folder, 'metadata.json');
        const data = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(data) as BuildMetadata;
        builds.push({
          ...metadata,
          isCurrent: false,
          archivePath: path.join(historyDir, folder),
        });
      } catch {
        // Skip invalid build folders
      }
    }
  } catch {
    // No history directory yet
  }

  // Add current build ONLY if not already archived
  const currentMetadata = await loadBuildMetadata(projectDir);
  if (currentMetadata) {
    const alreadyArchived = builds.some(b => b.buildNumber === currentMetadata.buildNumber);
    if (alreadyArchived) {
      // Current metadata is stale (build already archived) - clean it up
      console.log(`[Build History] Cleaning up stale .build-metadata.json for already-archived build ${currentMetadata.buildNumber}`);
      try {
        await fs.unlink(path.join(projectDir, BUILD_METADATA_FILE));
      } catch {
        // Ignore deletion errors
      }
    } else {
      builds.push({
        ...currentMetadata,
        isCurrent: true,
      });
    }
  }

  return builds;
}

/**
 * Get summary of build history (lightweight, for sidebar)
 */
export async function getBuildHistorySummary(projectDir: string): Promise<{
  totalBuilds: number;
  currentBuild: number | null;
  latestCompletedBuild: number | null;
}> {
  const history = await loadBuildHistory(projectDir);

  const completedBuilds = history.filter(b => b.status === 'completed');
  const currentBuild = history.find(b => b.isCurrent);

  return {
    totalBuilds: history.length,
    currentBuild: currentBuild?.buildNumber || null,
    latestCompletedBuild: completedBuilds.length > 0
      ? completedBuilds[completedBuilds.length - 1].buildNumber
      : null,
  };
}

/**
 * Load archived stories for a specific build
 */
export async function loadArchivedStories(projectDir: string, buildNumber: number): Promise<any | null> {
  const archivePath = path.join(projectDir, BUILD_HISTORY_DIR, `build-${buildNumber}`, STORIES_FILE);
  try {
    const data = await fs.readFile(archivePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// =============================================================================
// Migration from Old System
// =============================================================================

/**
 * Migrate from old iteration-state.json to new build-history system
 */
export async function migrateFromIterationState(projectDir: string): Promise<boolean> {
  const oldStatePath = path.join(projectDir, '.iteration-state.json');

  try {
    const oldData = await fs.readFile(oldStatePath, 'utf-8');
    const oldState = JSON.parse(oldData);

    console.log('[Build History] Found old .iteration-state.json, migrating...');

    const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);
    await fs.mkdir(historyDir, { recursive: true });

    // Get current commit hash as fallback
    const currentCommitHash = getGitCommitHash(projectDir);

    // Create build-1 from original build
    if (oldState.originalBuildMetrics) {
      const build1Dir = path.join(historyDir, 'build-1');
      await fs.mkdir(build1Dir, { recursive: true });

      const metadata: BuildMetadata = {
        buildNumber: 1,
        prompt: 'Original build (migrated)',
        startedAt: oldState.originalBuildCompletedAt || new Date().toISOString(),
        completedAt: oldState.originalBuildCompletedAt,
        status: 'completed',
        metrics: oldState.originalBuildMetrics,
        // Use old commit hash if available, otherwise use current HEAD
        commitHash: oldState.originalCommitHash || currentCommitHash,
        storyCount: oldState.originalStoryCount,
        epicCount: oldState.originalEpicCount,
      };

      await fs.writeFile(
        path.join(build1Dir, 'metadata.json'),
        JSON.stringify(metadata, null, 2)
      );
    }

    // Create builds from iterations
    if (oldState.iterations && Array.isArray(oldState.iterations)) {
      for (let i = 0; i < oldState.iterations.length; i++) {
        const iter = oldState.iterations[i];
        const buildNumber = i + 2; // Iterations start at build 2
        const buildDir = path.join(historyDir, `build-${buildNumber}`);
        await fs.mkdir(buildDir, { recursive: true });

        const metadata: BuildMetadata = {
          buildNumber,
          prompt: iter.prompt || `Iteration ${i + 1} (migrated)`,
          startedAt: iter.startTime,
          completedAt: iter.endTime,
          status: iter.status === 'completed' ? 'completed' : 'failed',
          metrics: iter.metricsAdded,
          commitHash: iter.commitHash,
          storyCount: iter.storiesCreated?.length || 0,
        };

        await fs.writeFile(
          path.join(buildDir, 'metadata.json'),
          JSON.stringify(metadata, null, 2)
        );
      }
    }

    // DON'T create a "current build" after migration
    // The user should start a new build themselves
    // This prevents cloned repos from showing an empty v2

    // Rename old file to indicate migration
    await fs.rename(oldStatePath, path.join(projectDir, '.iteration-state.json.migrated'));

    const archivedCount = await getNextBuildNumber(projectDir) - 1;
    console.log(`[Build History] Migration complete. Created ${archivedCount} archived builds.`);
    return true;
  } catch (err) {
    // No old state file or migration failed
    return false;
  }
}

/**
 * Initialize build history for a new project
 *
 * NOTE: This does NOT cleanup build artifacts anymore. Cleanup should be called
 * separately BEFORE this function, typically via /api/build-history/cleanup.
 * This is because for Figma builds, the frontend saves fresh files BEFORE calling
 * multi-agent, and we don't want to delete those files.
 */
export async function initializeBuildHistory(
  projectDir: string,
  prompt: string,
  source: 'text' | 'figma' = 'text',
  figmaUrl?: string
): Promise<BuildMetadata> {
  // Check for old iteration state and migrate if needed
  await migrateFromIterationState(projectDir);

  // Check if there's already a current build OR stories without metadata (cloned repo case)
  const existingMetadata = await loadBuildMetadata(projectDir);
  let hasStories = false;
  try {
    const storiesPath = path.join(projectDir, STORIES_FILE);
    const storiesData = JSON.parse(await fs.readFile(storiesPath, 'utf-8'));
    hasStories = (storiesData?.tasks?.length ?? 0) > 0 || (storiesData?.epics?.length ?? 0) > 0;
  } catch {
    // No stories file
  }

  if (existingMetadata || hasStories) {
    // Archive existing build first (handles both metadata case and cloned repo case)
    await archiveCurrentBuild(projectDir);
  }

  // NOTE: Cleanup is NOT done here anymore - caller must handle it via /api/build-history/cleanup
  // This prevents deleting fresh Figma files that were just saved by the frontend

  // Create fresh build
  return resetForNewBuild(projectDir, prompt, source, figmaUrl);
}

/**
 * Count files and lines of code in a directory (for initial stats)
 */
async function countProjectStats(projectDir: string): Promise<{ files: number; lines: number }> {
  let files = 0;
  let lines = 0;

  const codeExtensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.html', '.json', '.md'];
  const ignoreDirs = ['node_modules', '.git', '.next', 'dist', 'build', '.build-history', 'coverage'];

  async function walkDir(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (!ignoreDirs.includes(entry.name)) {
            await walkDir(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (codeExtensions.includes(ext)) {
            files++;
            try {
              const content = await fs.readFile(fullPath, 'utf-8');
              lines += content.split('\n').length;
            } catch {
              // Skip files we can't read
            }
          }
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  await walkDir(projectDir);
  return { files, lines };
}

/**
 * Initialize build history for a GitHub cloned project
 * Creates v1 as the initial clone state, so next build will be v2
 */
export async function initializeGitHubProjectHistory(
  projectDir: string,
  gitUrl?: string,
  repoName?: string
): Promise<BuildMetadata | null> {
  // First, check for old iteration state and migrate if needed
  // This handles repos that were built with the old system
  const migrated = await migrateFromIterationState(projectDir);
  if (migrated) {
    console.log('[Build History] Migrated from old iteration state');
    // Return the first build's metadata
    const history = await loadBuildHistory(projectDir);
    return history.length > 0 ? history[0] : null;
  }

  // Check if build history already exists
  const historyDir = path.join(projectDir, BUILD_HISTORY_DIR);
  try {
    const entries = await fs.readdir(historyDir);
    if (entries.some(e => e.startsWith('build-'))) {
      console.log('[Build History] GitHub project already has build history');
      // Clean up any stale .build-metadata.json that might have been cloned
      const metadataPath = path.join(projectDir, BUILD_METADATA_FILE);
      try {
        await fs.unlink(metadataPath);
        console.log('[Build History] Cleaned up stale .build-metadata.json');
      } catch {
        // File doesn't exist, that's fine
      }
      return null;
    }
  } catch {
    // No history directory yet - this is expected
  }

  // Check if there's existing metadata (might be stale from a previous platform build in the repo)
  // If so, we need to clean it up - it's not a current build, just leftover from the clone
  const existingMetadata = await loadBuildMetadata(projectDir);
  if (existingMetadata) {
    console.log('[Build History] Found stale .build-metadata.json from cloned repo, cleaning up...');
    const metadataPath = path.join(projectDir, BUILD_METADATA_FILE);
    try {
      await fs.unlink(metadataPath);
    } catch {
      // File doesn't exist, that's fine
    }
    // Continue to create fresh v1
  }

  console.log('[Build History] Initializing v1 for GitHub project...');

  // Create build-1 archive for the initial clone
  await fs.mkdir(historyDir, { recursive: true });
  const build1Dir = path.join(historyDir, 'build-1');
  await fs.mkdir(build1Dir, { recursive: true });

  // Get commit hash
  const commitHash = getGitCommitHash(projectDir);

  // Count files and lines
  const stats = await countProjectStats(projectDir);

  // Create v1 metadata
  const v1Metadata: BuildMetadata = {
    buildNumber: 1,
    prompt: gitUrl
      ? `Initial clone from GitHub: ${gitUrl}`
      : repoName
        ? `Initial clone: ${repoName}`
        : 'Initial project state (cloned from GitHub)',
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    status: 'completed',
    commitHash,
    source: 'text',
    metrics: {
      filesCreated: stats.files,
      filesModified: 0,
      linesOfCode: stats.lines,
      testsTotal: 0,
      testsPassed: 0,
      testsFailed: 0,
      coverage: 0,
      duration: 0,
      tokensUsed: 0,
      commandsRun: 0,
    },
  };

  // Save v1 to archive
  await fs.writeFile(
    path.join(build1Dir, 'metadata.json'),
    JSON.stringify(v1Metadata, null, 2)
  );

  console.log(`[Build History] Created v1 for GitHub project: ${stats.files} files, ${stats.lines} lines, commit ${commitHash || 'unknown'}`);

  return v1Metadata;
}
