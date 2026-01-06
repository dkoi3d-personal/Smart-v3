/**
 * Cross-Platform Utilities
 * Ensures code works correctly on both Windows and macOS/Linux
 */

import * as path from 'path';
import { execSync, ExecSyncOptions } from 'child_process';

/**
 * Detect if running on Windows
 */
export const isWindows = process.platform === 'win32';

/**
 * Detect if running on macOS
 */
export const isMacOS = process.platform === 'darwin';

/**
 * Detect if running on Linux
 */
export const isLinux = process.platform === 'linux';

/**
 * Normalize a path for use with glob library
 * Glob always expects forward slashes, even on Windows
 */
export function normalizePathForGlob(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * Normalize a path for display (always use forward slashes for consistency)
 */
export function normalizePathForDisplay(inputPath: string): string {
  return inputPath.replace(/\\/g, '/');
}

/**
 * Get the correct npm command for the current OS
 * Note: When using shell: true in spawn/exec, just 'npm' works on all platforms
 */
export function getNpmCommand(): string {
  // With shell: true, 'npm' works on all platforms
  // Only use .cmd extension for direct execution without shell
  return 'npm';
}

/**
 * Get the correct npx command for the current OS
 * Note: When using shell: true in spawn/exec, just 'npx' works on all platforms
 */
export function getNpxCommand(): string {
  // With shell: true, 'npx' works on all platforms
  return 'npx';
}

/**
 * Get the correct node command for the current OS
 * Note: 'node' works on all platforms when in PATH
 */
export function getNodeCommand(): string {
  // 'node' is the correct command on all platforms
  return 'node';
}

/**
 * Execute a command with cross-platform error handling
 * Handles stderr redirection properly on both Windows and Unix
 */
export function execCrossPlatform(
  command: string,
  options: ExecSyncOptions = {}
): string {
  // Remove Unix-specific redirections that don't work on Windows
  let safeCommand = command;

  if (isWindows) {
    // Replace 2>/dev/null with nothing (we'll handle stderr via stdio)
    safeCommand = safeCommand.replace(/\s*2>\/dev\/null/g, '');
    // Replace 2>&1 with nothing
    safeCommand = safeCommand.replace(/\s*2>&1/g, '');
    // Replace || true with nothing (handle errors via try/catch)
    safeCommand = safeCommand.replace(/\s*\|\|\s*true/g, '');
  }

  try {
    const result = execSync(safeCommand, {
      encoding: 'utf-8',
      ...options,
    });
    return typeof result === 'string' ? result : result.toString('utf-8');
  } catch (error: unknown) {
    // Return stdout even on error (like || true behavior)
    const execError = error as { stdout?: string | Buffer; stderr?: string };
    if (execError.stdout) {
      return typeof execError.stdout === 'string' ? execError.stdout : execError.stdout.toString('utf-8');
    }
    return '';
  }
}

/**
 * Execute npm audit with cross-platform compatibility
 */
export function execNpmAudit(directory: string): string {
  const npmCmd = getNpmCommand();

  try {
    return execSync(`${npmCmd} audit --json`, {
      cwd: directory,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    // npm audit returns exit code 1 when vulnerabilities are found
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }
    return '{}';
  }
}

/**
 * Execute npm outdated with cross-platform compatibility
 */
export function execNpmOutdated(directory: string): string {
  const npmCmd = getNpmCommand();

  try {
    return execSync(`${npmCmd} outdated --json`, {
      cwd: directory,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch (error: unknown) {
    // npm outdated returns exit code 1 when packages are outdated
    const execError = error as { stdout?: string };
    if (execError.stdout) {
      return execError.stdout;
    }
    return '{}';
  }
}

/**
 * Execute npm run build with cross-platform compatibility
 */
export function execNpmBuild(directory: string, captureOutput = true): string {
  const npmCmd = getNpmCommand();

  try {
    return execSync(`${npmCmd} run build`, {
      cwd: directory,
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 300000, // 5 minutes for builds
      stdio: captureOutput ? ['pipe', 'pipe', 'pipe'] : 'inherit',
    });
  } catch (error: unknown) {
    const execError = error as { stdout?: string; stderr?: string; message?: string };
    if (captureOutput && (execError.stdout || execError.stderr)) {
      return `${execError.stdout || ''}\n${execError.stderr || ''}`;
    }
    throw error;
  }
}

/**
 * Execute a command safely, handling common cross-platform issues
 */
export function execCommandSafe(
  command: string,
  options: ExecSyncOptions & { throwOnError?: boolean } = {}
): { output: string; success: boolean; error?: string } {
  const { throwOnError = false, ...execOptions } = options;

  // Sanitize command for cross-platform compatibility
  let safeCommand = command;

  if (isWindows) {
    // Handle common Unix patterns
    safeCommand = safeCommand
      .replace(/\s*2>\/dev\/null/g, '')
      .replace(/\s*2>&1/g, '')
      .replace(/\s*\|\|\s*true$/g, '');
  }

  try {
    const result = execSync(safeCommand, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      timeout: 120000,
      ...execOptions,
    });
    const output = typeof result === 'string' ? result : result.toString('utf-8');
    return { output, success: true };
  } catch (error: unknown) {
    const execError = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
    const output = execError.stdout
      ? (typeof execError.stdout === 'string' ? execError.stdout : execError.stdout.toString('utf-8'))
      : '';
    const errorMsg = execError.stderr
      ? (typeof execError.stderr === 'string' ? execError.stderr : execError.stderr.toString('utf-8'))
      : (execError.message || 'Command failed');

    if (throwOnError) {
      throw error;
    }

    return { output, success: false, error: errorMsg };
  }
}

/**
 * Get glob options with normalized cwd for cross-platform compatibility
 */
export function getGlobOptions(
  directory: string,
  additionalOptions: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    cwd: normalizePathForGlob(path.resolve(directory)),
    ...additionalOptions,
  };
}

/**
 * Join paths and normalize for display (always forward slashes)
 */
export function joinPathsForDisplay(...paths: string[]): string {
  return path.join(...paths).replace(/\\/g, '/');
}

/**
 * Resolve a path and normalize for glob
 */
export function resolvePathForGlob(basePath: string, ...paths: string[]): string {
  return normalizePathForGlob(path.resolve(basePath, ...paths));
}

/**
 * Check if a command contains Unix-specific syntax that won't work on Windows
 */
export function hasUnixSpecificSyntax(command: string): boolean {
  const unixPatterns = [
    /2>\/dev\/null/,      // stderr to /dev/null
    /2>&1/,               // stderr to stdout redirect
    />\s*\/dev\/null/,    // stdout to /dev/null
    /\|\|\s*true$/,       // || true at end
    /&&\s*true$/,         // && true at end
    /\bsudo\b/,           // sudo command
    /\bchmod\b/,          // chmod command
    /\bchown\b/,          // chown command
  ];

  return unixPatterns.some(pattern => pattern.test(command));
}

/**
 * Convert a Unix command to Windows equivalent (basic patterns)
 */
export function convertCommandForWindows(command: string): string {
  if (!isWindows) return command;

  return command
    .replace(/\s*2>\/dev\/null/g, '')
    .replace(/\s*2>&1/g, '')
    .replace(/\s*\|\|\s*true$/g, '')
    .replace(/\bcat\s+/g, 'type ')
    .replace(/\brm\s+-rf?\s+/g, 'rmdir /s /q ')
    .replace(/\bmkdir\s+-p\s+/g, 'mkdir ')
    .replace(/\bcp\s+-r?\s+/g, 'xcopy /e /i ')
    .replace(/\bls\s*/g, 'dir ');
}

/**
 * Kill a process by PID - cross-platform
 */
export async function killProcess(pid: string | number): Promise<boolean> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    if (isWindows) {
      await execAsync(`taskkill /PID ${pid} /F`);
    } else {
      await execAsync(`kill -9 ${pid}`);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Find PIDs using a specific port - cross-platform
 */
export async function findPidsOnPort(port: number): Promise<string[]> {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);

  try {
    if (isWindows) {
      const { stdout } = await execAsync(`cmd /c "netstat -ano | findstr :${port} | findstr LISTENING"`);
      const pids: string[] = [];
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') {
          pids.push(pid);
        }
      }
      return pids;
    } else {
      const { stdout } = await execAsync(`lsof -ti :${port}`);
      return stdout.trim().split('\n').filter(p => p && /^\d+$/.test(p));
    }
  } catch {
    return [];
  }
}

/**
 * Kill all processes on a specific port - cross-platform
 */
export async function killProcessesOnPort(port: number): Promise<number> {
  const pids = await findPidsOnPort(port);
  let killed = 0;
  for (const pid of pids) {
    if (await killProcess(pid)) {
      killed++;
    }
  }
  return killed;
}

export default {
  isWindows,
  isMacOS,
  isLinux,
  normalizePathForGlob,
  normalizePathForDisplay,
  getNpmCommand,
  getNpxCommand,
  getNodeCommand,
  execCrossPlatform,
  execNpmAudit,
  execNpmOutdated,
  execNpmBuild,
  execCommandSafe,
  getGlobOptions,
  joinPathsForDisplay,
  resolvePathForGlob,
  hasUnixSpecificSyntax,
  convertCommandForWindows,
  killProcess,
  findPidsOnPort,
  killProcessesOnPort,
};
