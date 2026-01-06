/**
 * Project Paths Configuration
 *
 * Projects are created OUTSIDE of the ai-dev-platform-v2 directory
 * to avoid conflicts with the parent Next.js app.
 *
 * The coding directory can be configured via:
 * 1. The platform UI (stored in data/platform-config.json)
 * 2. Environment variable PROJECTS_BASE_DIR
 * 3. Default: ~/coding/ai-projects/
 */

import path from 'path';
import * as fs from 'fs';
import os from 'os';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'platform-config.json');
const IS_WINDOWS = process.platform === 'win32';

/**
 * Normalize a path for the current OS
 * Detects Windows paths on Unix and vice versa, falling back to default if incompatible
 */
function normalizePathForOS(configPath: string | null): string | null {
  if (!configPath) return null;

  // Detect Windows absolute path (e.g., C:\Users\...)
  const isWindowsPath = /^[A-Za-z]:[\\\/]/.test(configPath);

  // If we're on Unix but have a Windows path, it's invalid - return null to use default
  if (!IS_WINDOWS && isWindowsPath) {
    console.warn(`[project-paths] Windows path detected on Unix system, using default: ${configPath}`);
    return null;
  }

  // If we're on Windows but have a Unix absolute path, it's invalid
  if (IS_WINDOWS && configPath.startsWith('/') && !configPath.startsWith('//')) {
    console.warn(`[project-paths] Unix path detected on Windows system, using default: ${configPath}`);
    return null;
  }

  return configPath;
}

interface PlatformConfig {
  codingDirectory: string | null;
  configuredAt: string | null;
}

// Cache the config to avoid reading from disk on every call
let cachedConfig: PlatformConfig | null = null;
let configLastRead = 0;
const CONFIG_CACHE_TTL = 5000; // 5 seconds

/**
 * Load the platform configuration from disk
 */
function loadConfigSync(): PlatformConfig {
  const now = Date.now();
  if (cachedConfig && (now - configLastRead) < CONFIG_CACHE_TTL) {
    return cachedConfig;
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    cachedConfig = JSON.parse(data);
    configLastRead = now;
    return cachedConfig!;
  } catch {
    cachedConfig = { codingDirectory: null, configuredAt: null };
    configLastRead = now;
    return cachedConfig;
  }
}

/**
 * Clear the config cache (call this after saving new config)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
  configLastRead = 0;
}

/**
 * Get the default projects base directory based on the OS
 */
function getDefaultProjectsBaseDir(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, 'coding', 'ai-projects');
}

/**
 * Get the base directory where all projects are created
 * Priority: 1. User config (if valid for OS), 2. Environment variable, 3. Default
 */
export function getProjectsBaseDir(): string {
  // First check user config (with OS validation)
  const config = loadConfigSync();
  const normalizedConfigPath = normalizePathForOS(config.codingDirectory);
  if (normalizedConfigPath) {
    return normalizedConfigPath;
  }

  // Then check environment variable
  if (process.env.PROJECTS_BASE_DIR) {
    return process.env.PROJECTS_BASE_DIR;
  }

  // Fall back to default
  return getDefaultProjectsBaseDir();
}

/**
 * Get the full path to a specific project directory
 */
export function getProjectDir(projectId: string): string {
  return path.join(getProjectsBaseDir(), projectId);
}

/**
 * Get the path to the projects metadata file
 * This stays in the ai-dev-platform-v2 directory for the app to read
 */
export function getProjectsMetadataPath(): string {
  return path.join(process.cwd(), 'data', 'projects.json');
}

/**
 * Ensure the projects base directory exists
 */
export async function ensureProjectsBaseDir(): Promise<void> {
  const baseDir = getProjectsBaseDir();
  try {
    await fs.promises.mkdir(baseDir, { recursive: true });
  } catch (err) {
    // Directory already exists or other error
    console.log(`[project-paths] Projects base dir: ${baseDir}`);
  }
}

/**
 * Ensure a specific project directory exists
 */
export async function ensureProjectDir(projectId: string): Promise<string> {
  const projectDir = getProjectDir(projectId);
  await fs.promises.mkdir(projectDir, { recursive: true });
  return projectDir;
}

/**
 * Check if a project directory exists
 */
export async function projectDirExists(projectId: string): Promise<boolean> {
  try {
    await fs.promises.access(getProjectDir(projectId));
    return true;
  } catch {
    return false;
  }
}

/**
 * Files/folders to preserve during project cleanup
 * These won't be deleted when cleaning a project directory
 */
const PRESERVE_ON_CLEAN = [
  '.git',           // Git history
  '.gitignore',     // Git ignore rules
  '.env',           // Environment variables
  '.env.local',     // Local environment variables
];

/**
 * Files/folders that cause issues and should be aggressively cleaned
 * These are build artifacts and caches that can cause conflicts
 */
const AGGRESSIVE_CLEAN_TARGETS = [
  '.next',          // Next.js build cache
  'pages',          // Pages Router folder (conflicts with App Router)
  'out',            // Next.js static export
  'node_modules',   // NPM packages
  '.turbo',         // Turbo cache
  '.swc',           // SWC cache
  'dist',           // Build output
  'build',          // Build output
  '.cache',         // General cache
  'coverage',       // Test coverage
  '.nyc_output',    // NYC coverage
];

export interface CleanProjectResult {
  success: boolean;
  cleaned: string[];
  preserved: string[];
  errors: string[];
  message: string;
}

/**
 * Clean a project directory by removing build artifacts and optionally all files
 *
 * @param projectId - The project ID
 * @param options - Cleanup options
 * @param options.mode - 'soft' preserves git/env, 'hard' removes everything except git, 'full' removes everything
 * @param options.waitForHandles - Wait time in ms for file handles to release (Windows)
 * @returns Result object with cleaned/preserved files and any errors
 */
export async function cleanProjectDir(
  projectId: string,
  options: {
    mode?: 'soft' | 'hard' | 'full';
    waitForHandles?: number;
  } = {}
): Promise<CleanProjectResult> {
  const { mode = 'soft', waitForHandles = 1000 } = options;
  const projectDir = getProjectDir(projectId);

  const result: CleanProjectResult = {
    success: true,
    cleaned: [],
    preserved: [],
    errors: [],
    message: '',
  };

  // Validate project directory is within allowed base
  const projectsBase = path.resolve(getProjectsBaseDir());
  const resolvedDir = path.resolve(projectDir);
  if (!resolvedDir.startsWith(projectsBase)) {
    return {
      success: false,
      cleaned: [],
      preserved: [],
      errors: ['Security: Project directory path escapes projects base directory'],
      message: 'Security validation failed',
    };
  }

  // Check if directory exists
  try {
    await fs.promises.access(projectDir);
  } catch {
    return {
      success: true,
      cleaned: [],
      preserved: [],
      errors: [],
      message: 'Directory does not exist, nothing to clean',
    };
  }

  // Give Windows time to release file handles
  if (IS_WINDOWS && waitForHandles > 0) {
    await new Promise(resolve => setTimeout(resolve, waitForHandles));
  }

  // Get list of items in directory
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(projectDir, { withFileTypes: true });
  } catch (err) {
    return {
      success: false,
      cleaned: [],
      preserved: [],
      errors: [`Failed to read directory: ${err}`],
      message: 'Failed to read project directory',
    };
  }

  // Determine what to preserve based on mode
  const preserveSet = new Set<string>();
  if (mode === 'soft') {
    PRESERVE_ON_CLEAN.forEach(p => preserveSet.add(p));
    // In soft mode, only clean aggressive targets
  } else if (mode === 'hard') {
    // In hard mode, only preserve .git
    preserveSet.add('.git');
  }
  // In 'full' mode, preserve nothing

  for (const entry of entries) {
    const entryPath = path.join(projectDir, entry.name);

    // Check if this should be preserved
    if (preserveSet.has(entry.name)) {
      result.preserved.push(entry.name);
      continue;
    }

    // In soft mode, only clean aggressive targets
    if (mode === 'soft' && !AGGRESSIVE_CLEAN_TARGETS.includes(entry.name)) {
      result.preserved.push(entry.name);
      continue;
    }

    // Attempt to delete with retry logic for Windows
    let deleted = false;
    let lastError: any = null;
    const maxAttempts = IS_WINDOWS ? 3 : 1;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await fs.promises.rm(entryPath, { recursive: true, force: true });

        // Verify deletion
        try {
          await fs.promises.access(entryPath);
          // Still exists, wait and retry
          if (attempt < maxAttempts) {
            await new Promise(r => setTimeout(r, 500));
            continue;
          }
        } catch {
          // Successfully deleted
          deleted = true;
          break;
        }
      } catch (err) {
        lastError = err;
        if (attempt < maxAttempts) {
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    if (deleted) {
      result.cleaned.push(entry.name);
    } else {
      result.errors.push(`Failed to delete ${entry.name}: ${lastError?.message || 'Unknown error'}`);
      result.success = false;
    }
  }

  result.message = result.success
    ? `Cleaned ${result.cleaned.length} items, preserved ${result.preserved.length}`
    : `Partially cleaned: ${result.cleaned.length} deleted, ${result.errors.length} errors`;

  console.log(`[project-paths] cleanProjectDir result for ${projectId}:`, result.message);

  return result;
}

/**
 * Reset a project for fresh initialization
 * Cleans the directory and recreates it empty
 */
export async function resetProjectDir(projectId: string): Promise<CleanProjectResult> {
  // First clean with hard mode (preserve only .git)
  const cleanResult = await cleanProjectDir(projectId, { mode: 'hard', waitForHandles: 1500 });

  if (!cleanResult.success && cleanResult.errors.length > 0) {
    // If some files couldn't be deleted, still try to continue
    console.warn(`[project-paths] Reset had errors but continuing:`, cleanResult.errors);
  }

  // Ensure directory exists (recreate if fully deleted)
  try {
    await ensureProjectDir(projectId);
  } catch (err) {
    cleanResult.errors.push(`Failed to recreate directory: ${err}`);
    cleanResult.success = false;
  }

  return cleanResult;
}

export default {
  getProjectsBaseDir,
  getProjectDir,
  getProjectsMetadataPath,
  ensureProjectsBaseDir,
  ensureProjectDir,
  projectDirExists,
  cleanProjectDir,
  resetProjectDir,
};
