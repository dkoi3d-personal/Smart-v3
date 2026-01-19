import { NextRequest, NextResponse } from 'next/server';
import { devServerManager } from '@/services/dev-server-manager';
import { Server as IOServer } from 'socket.io';
import { getProjectDir } from '@/lib/project-paths';
import { resolveProjectPath } from '@/lib/project-path-resolver';
import { setupLocalEnvironment } from '@/lib/env-manager';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

// Allow up to 5 minutes for rebuilds (npm install + prisma + next build)
export const maxDuration = 300;

const execAsync = promisify(exec);

interface BuildVerificationResult {
  success: boolean;
  error?: string;
  needsRebuild?: boolean;
  details?: string;
}

/**
 * Verify that a Next.js build completed successfully before starting preview
 * Checks for required build artifacts that indicate a successful build
 */
async function verifyNextJsBuild(projectDir: string): Promise<BuildVerificationResult> {
  const nextDir = path.join(projectDir, '.next');

  // Check if project has middleware (requires special handling)
  let hasMiddleware = false;
  try {
    const middlewareTsPath = path.join(projectDir, 'middleware.ts');
    const middlewareJsPath = path.join(projectDir, 'middleware.js');
    await fs.access(middlewareTsPath).catch(() => fs.access(middlewareJsPath));
    hasMiddleware = true;
  } catch {
    // No middleware
  }

  // Check if .next directory exists
  try {
    await fs.access(nextDir);
  } catch {
    return {
      success: false,
      error: hasMiddleware
        ? 'No .next directory found. Project with middleware needs production build.'
        : 'No .next directory found. Project needs to be built first.',
      needsRebuild: true,
    };
  }

  // For projects with middleware, verify the middleware.js is valid
  if (hasMiddleware) {
    const middlewareJsPath = path.join(nextDir, 'server', 'middleware.js');
    try {
      const content = await fs.readFile(middlewareJsPath, 'utf-8');
      // Check for eval patterns that cause Edge Runtime issues
      if (content.includes('eval(') || content.includes('Code generation from strings')) {
        return {
          success: false,
          error: 'Corrupted middleware build (contains eval). Needs clean rebuild.',
          needsRebuild: true,
          details: 'Edge Runtime does not support eval in middleware',
        };
      }
    } catch {
      // middleware.js doesn't exist or can't be read - will be rebuilt
    }
  }

  // Check for BUILD_ID (indicates build was started)
  const buildIdPath = path.join(nextDir, 'BUILD_ID');
  try {
    await fs.access(buildIdPath);
  } catch {
    return {
      success: false,
      error: 'No BUILD_ID found. Build may have been interrupted.',
      needsRebuild: true,
    };
  }

  // Check for prerender-manifest.json (indicates build completed successfully)
  const prerenderManifestPath = path.join(nextDir, 'prerender-manifest.json');
  try {
    await fs.access(prerenderManifestPath);
  } catch {
    return {
      success: false,
      error: 'Build incomplete: prerender-manifest.json missing. The build failed or was interrupted.',
      needsRebuild: true,
    };
  }

  // Check export-detail.json if it exists (for static exports)
  const exportDetailPath = path.join(nextDir, 'export-detail.json');
  try {
    const exportDetailContent = await fs.readFile(exportDetailPath, 'utf-8');
    const exportDetail = JSON.parse(exportDetailContent);
    if (exportDetail.success === false) {
      return {
        success: false,
        error: 'Build export failed. Check build logs for errors.',
        needsRebuild: true,
        details: 'export-detail.json indicates success: false',
      };
    }
  } catch {
    // export-detail.json doesn't exist or couldn't be read - that's OK for non-static builds
  }

  // Check for routes-manifest.json (another critical build artifact)
  const routesManifestPath = path.join(nextDir, 'routes-manifest.json');
  try {
    await fs.access(routesManifestPath);
  } catch {
    return {
      success: false,
      error: 'Build incomplete: routes-manifest.json missing.',
      needsRebuild: true,
    };
  }

  return { success: true };
}

/**
 * Wrapper for setupLocalEnvironment that adapts to emitLog format
 */
async function ensureLocalDevEnvironment(
  projectDir: string,
  emitLog?: (type: string, message: string) => void
): Promise<void> {
  await setupLocalEnvironment(projectDir, (msg) => {
    // Determine log type from message content
    const type = msg.startsWith('✓') || msg.includes('Created') || msg.includes('Switched')
      ? 'success'
      : 'info';
    emitLog?.(type, msg);
  });
}

/**
 * Attempt to rebuild the project if verification fails
 */
async function rebuildProject(
  projectDir: string,
  emitLog?: (type: string, message: string) => void
): Promise<{ success: boolean; error?: string }> {
  emitLog?.('info', 'Build verification failed - attempting rebuild...');

  // FIRST: Ensure local dev environment is configured (.env, SQLite schema)
  await ensureLocalDevEnvironment(projectDir, emitLog);

  // Check for Prisma schema
  const prismaSchemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
  let hasPrisma = false;
  try {
    await fs.access(prismaSchemaPath);
    hasPrisma = true;
  } catch {
    // No Prisma schema
  }

  // Check if node_modules exists and is complete
  const nodeModulesPath = path.join(projectDir, 'node_modules');
  let needsInstall = false;

  try {
    await fs.access(nodeModulesPath);
    emitLog?.('info', 'node_modules exists');

    // If project uses Prisma, verify @prisma/client exists
    if (hasPrisma) {
      const prismaClientPath = path.join(nodeModulesPath, '@prisma', 'client');
      try {
        await fs.access(prismaClientPath);
      } catch {
        emitLog?.('warning', '@prisma/client missing - need to reinstall');
        needsInstall = true;
      }
    }
  } catch {
    needsInstall = true;
  }

  if (needsInstall) {
    emitLog?.('info', 'Installing dependencies...');
    try {
      const { stdout, stderr } = await execAsync('npm install', {
        cwd: projectDir,
        timeout: 180000, // 3 minute timeout for npm install
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, NODE_ENV: 'development' },
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      });
      emitLog?.('info', 'npm install output: ' + stdout.slice(-300));
      if (stderr && !stderr.includes('npm warn')) {
        emitLog?.('warning', 'npm install stderr: ' + stderr.slice(-200));
      }
      emitLog?.('success', '✓ Dependencies installed');
    } catch (installError) {
      const errorMsg = installError instanceof Error ? installError.message : String(installError);
      emitLog?.('error', `npm install failed: ${errorMsg}`);
      return { success: false, error: `Failed to install dependencies: ${errorMsg}` };
    }
  }

  if (hasPrisma) {
    emitLog?.('info', 'Prisma schema detected, setting up database...');

    // Load .env.local environment variables manually for cross-platform compatibility
    // Windows doesn't work well with `npx dotenv -e .env.local -- prisma generate`
    let envLocalVars: Record<string, string> = {};
    const envLocalPath = path.join(projectDir, '.env.local');
    try {
      const envContent = await fs.readFile(envLocalPath, 'utf-8');
      for (const line of envContent.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let value = trimmed.slice(eqIdx + 1).trim();
            // Remove surrounding quotes if present
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
              value = value.slice(1, -1);
            }
            envLocalVars[key] = value;
          }
        }
      }
      emitLog?.('info', `Loaded ${Object.keys(envLocalVars).length} env vars from .env.local`);
    } catch {
      emitLog?.('info', 'No .env.local found, using default environment');
    }

    // Merge env.local vars with process.env (env.local takes precedence)
    const prismaEnv = { ...process.env, ...envLocalVars, FORCE_COLOR: '0' };

    try {
      // Step 1: Generate Prisma client
      emitLog?.('info', 'Running: npx prisma generate');
      await execAsync('npx prisma generate', {
        cwd: projectDir,
        timeout: 60000,
        env: prismaEnv,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      });
      emitLog?.('success', '✓ Prisma client generated');

      // Step 2: Push schema to database (creates tables)
      emitLog?.('info', 'Running: npx prisma db push');
      await execAsync('npx prisma db push --accept-data-loss', {
        cwd: projectDir,
        timeout: 60000,
        env: prismaEnv,
        shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      });
      emitLog?.('success', '✓ Database schema pushed');

      // Step 3: Check for seed script and run it
      const seedTsPath = path.join(projectDir, 'prisma', 'seed.ts');
      const seedJsPath = path.join(projectDir, 'prisma', 'seed.js');
      let hasSeed = false;
      try {
        await fs.access(seedTsPath);
        hasSeed = true;
      } catch {
        try {
          await fs.access(seedJsPath);
          hasSeed = true;
        } catch {
          // No seed script
        }
      }

      if (hasSeed) {
        emitLog?.('info', 'Running: npx prisma db seed');
        try {
          await execAsync('npx prisma db seed', {
            cwd: projectDir,
            timeout: 120000,
            env: prismaEnv,
            shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
          });
          emitLog?.('success', '✓ Database seeded');
        } catch (seedError) {
          // Seed failure is non-fatal - app can still run
          const seedErrMsg = seedError instanceof Error ? seedError.message : String(seedError);
          emitLog?.('warning', `Database seed failed (non-fatal): ${seedErrMsg.slice(0, 200)}`);
        }
      }
    } catch (dbError) {
      const dbErrMsg = dbError instanceof Error ? dbError.message : String(dbError);
      emitLog?.('warning', `Database setup failed: ${dbErrMsg.slice(0, 300)}`);
      emitLog?.('info', 'App may still work if using mock data or no database');
    }
  }

  // Remove corrupted .next directory - use Windows-specific command for reliability
  const nextDir = path.join(projectDir, '.next');
  try {
    // Check if directory exists first
    await fs.access(nextDir);

    if (process.platform === 'win32') {
      // On Windows, use rd /s /q which is more reliable than fs.rm
      // It handles locked files better and doesn't fail on non-empty directories
      emitLog?.('info', 'Removing .next directory with rd /s /q...');
      const windowsPath = nextDir.replace(/\//g, '\\');
      await execAsync(`rd /s /q "${windowsPath}"`, {
        shell: 'cmd.exe',
        windowsHide: true,
      });
    } else {
      await fs.rm(nextDir, { recursive: true, force: true });
    }
    emitLog?.('info', 'Removed corrupted .next directory');
  } catch (err) {
    // Directory may not exist or couldn't be deleted
    const errMsg = err instanceof Error ? err.message : '';
    if (!errMsg.includes('ENOENT')) {
      emitLog?.('warning', `Could not fully remove .next: ${errMsg.slice(0, 100)}`);
    }
  }

  // Run next build directly (bypassing package.json scripts which may have unsupported flags like --turbo)
  try {
    // Create a completely isolated environment to prevent Turbopack workspace issues
    // Only inherit essential env vars, not the parent platform's Next.js internals
    const cleanEnv: Record<string, string> = {
      PATH: process.env.PATH || '',
      HOME: process.env.HOME || process.env.USERPROFILE || '',
      USERPROFILE: process.env.USERPROFILE || '',
      NODE_ENV: 'production',
      // Windows-specific
      SYSTEMROOT: process.env.SYSTEMROOT || '',
      COMSPEC: process.env.COMSPEC || '',
      APPDATA: process.env.APPDATA || '',
      LOCALAPPDATA: process.env.LOCALAPPDATA || '',
      TEMP: process.env.TEMP || '',
      TMP: process.env.TMP || '',
    };

    // Run standard next build - webpack is default for production builds
    const buildCommand = 'npx next build';
    emitLog?.('info', `Running: ${buildCommand}`);

    const { stdout, stderr } = await execAsync(buildCommand, {
      cwd: projectDir,
      timeout: 300000, // 5 minute timeout
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      env: cleanEnv as NodeJS.ProcessEnv,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });

    emitLog?.('info', 'Build output: ' + stdout.slice(-500)); // Last 500 chars

    if (stderr && !stderr.includes('ExperimentalWarning')) {
      emitLog?.('warning', 'Build stderr: ' + stderr.slice(-300));
    }

    // Verify the rebuild succeeded
    const verification = await verifyNextJsBuild(projectDir);
    if (!verification.success) {
      return {
        success: false,
        error: `Rebuild completed but verification still failed: ${verification.error}`
      };
    }

    emitLog?.('success', '✓ Project rebuilt successfully');
    return { success: true };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    emitLog?.('error', `Rebuild failed: ${errorMsg}`);
    return { success: false, error: `Rebuild failed: ${errorMsg}` };
  }
}

/**
 * Kill any stale processes on preview ports (5001-5020) - cross-platform
 */
async function killStaleProcessesOnPreviewPorts(): Promise<void> {
  const isWindows = process.platform === 'win32';

  try {
    const pidsToKill = new Set<string>();

    if (isWindows) {
      // Windows: Find all processes listening on ports 5001-5099 using netstat
      // Use cmd.exe explicitly to avoid git-bash interpretation issues
      try {
        const stdout = execSync('netstat -ano | findstr LISTENING | findstr :50', {
          encoding: 'utf-8',
          shell: 'cmd.exe',
          windowsHide: true,
        });
        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          // Match ports 5001-5099
          const portMatch = line.match(/:50(\d{2})\s/);
          if (portMatch) {
            const portNum = parseInt(portMatch[1]);
            if (portNum >= 1 && portNum <= 99) {
              const parts = line.trim().split(/\s+/);
              const pid = parts[parts.length - 1];
              if (pid && /^\d+$/.test(pid) && pid !== '0') {
                pidsToKill.add(pid);
              }
            }
          }
        }
      } catch {
        // No processes found - that's OK
      }

      // Kill each stale process using taskkill with cmd.exe for reliability
      for (const pid of pidsToKill) {
        console.log(`[Preview] Killing stale process ${pid}`);
        try {
          execSync(`taskkill /PID ${pid} /F /T`, {
            encoding: 'utf-8',
            shell: 'cmd.exe',
            windowsHide: true,
            stdio: 'pipe',
          });
          console.log(`[Preview] Successfully killed process ${pid}`);
        } catch {
          // Process may have already exited
        }
      }
    } else {
      // macOS/Linux: Use single lsof command to find ALL processes on preview port range
      // This is much faster than checking each port individually (was 100 commands, now 1)
      try {
        const { stdout } = await execAsync(`lsof -iTCP:5001-5020 -sTCP:LISTEN -t 2>/dev/null || true`);
        const pids = stdout.trim().split('\n').filter(p => p && /^\d+$/.test(p));
        pids.forEach(pid => pidsToKill.add(pid));
      } catch {
        // No processes found - that's fine
      }

      // Kill each stale process and its children using kill
      for (const pid of pidsToKill) {
        console.log(`[Preview] Killing process ${pid} and children`);
        // First try to kill the process group (negative PID kills the group)
        await execAsync(`kill -9 -${pid}`).catch(() => {});
        // Then kill the individual process
        await execAsync(`kill -9 ${pid}`).catch(() => {});
      }
    }

    // Wait for ports to be released
    if (pidsToKill.size > 0) {
      await new Promise(r => setTimeout(r, 500));
    }
  } catch {
    // No processes found or error - that's OK
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectId, forceRebuild, skipRebuild, forceDevMode = true } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get Socket.IO instance (optional - works without it)
    const io: IOServer | undefined = (global as any).io;

    // Get project directory - use resolveProjectPath for consistency with files API
    // This handles custom paths for cloned repos stored in projects.json
    const projectDir = await resolveProjectPath(projectId);
    console.log(`[Preview] Project directory: ${projectDir}`);

    // Verify the project directory exists
    try {
      await fs.access(projectDir);
    } catch {
      console.error(`[Preview] Project directory not found: ${projectDir}`);
      return NextResponse.json(
        { error: `Project directory not found: ${projectDir}` },
        { status: 404 }
      );
    }

    // Check if a server is already running for this project
    const existingServer = devServerManager.getDevServer(projectId);
    if (existingServer && existingServer.status === 'ready') {
      console.log(`[Preview] Server already running for ${projectId} on port ${existingServer.port}`);

      // Update activity timestamp
      devServerManager.updateActivity(projectId);

      // Return existing server info
      return NextResponse.json({
        success: true,
        port: existingServer.port,
        url: `http://localhost:${existingServer.port}`,
        reused: true,
      });
    }

    // Stop ALL running dev servers to prevent port conflicts
    // This ensures only one project preview runs at a time
    console.log(`[Preview] Stopping all existing servers before starting ${projectId}`);
    await devServerManager.stopAll();

    // Also kill any stale processes on common preview ports
    await killStaleProcessesOnPreviewPorts();

    // Emit log function (no-op if no WebSocket)
    const emitLog = (type: string, message: string) => {
      console.log(`[Preview ${projectId}] ${type}: ${message}`);
      if (io) {
        io.to(`project:${projectId}`).emit('preview:log', { type, message });
      }
    };

    // Emit status function (no-op if no WebSocket)
    const emitStatus = (status: string, message?: string) => {
      console.log(`[Preview ${projectId}] Status: ${status} ${message || ''}`);
      if (io) {
        io.to(`project:${projectId}`).emit('preview:status', { status, message });
      }
    };

    // Check if this is a Next.js project and verify build before starting
    const packageJsonPath = path.join(projectDir, 'package.json');
    let isNextJs = false;
    try {
      const pkgContent = await fs.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(pkgContent);
      isNextJs = !!pkg.dependencies?.next || !!pkg.devDependencies?.next;
    } catch {
      // Not a node project or can't read package.json
    }

    // For Next.js projects, verify build completed successfully before starting
    // Skip rebuild if explicitly requested (e.g., after rebuild-local-db already did the work)
    if (isNextJs && !skipRebuild) {
      emitLog('info', 'Verifying Next.js build artifacts...');
      emitStatus('verifying', 'Verifying build...');

      const verification = await verifyNextJsBuild(projectDir);

      // Force rebuild if requested (e.g., after bug fixes)
      if (forceRebuild) {
        emitLog('info', 'Force rebuild requested...');
        emitStatus('rebuilding', 'Force rebuilding project...');

        const rebuildResult = await rebuildProject(projectDir, emitLog);

        if (!rebuildResult.success) {
          emitLog('error', rebuildResult.error || 'Rebuild failed');
          emitStatus('error', rebuildResult.error);

          if (io) {
            io.to(`project:${projectId}`).emit('preview:error', {
              error: rebuildResult.error,
              needsRebuild: true,
            });
          }

          return NextResponse.json(
            { error: rebuildResult.error, needsRebuild: true },
            { status: 500 }
          );
        }
      } else if (!verification.success) {
        emitLog('warning', `Build verification failed: ${verification.error}`);

        if (verification.needsRebuild) {
          emitStatus('rebuilding', 'Rebuilding project...');

          const rebuildResult = await rebuildProject(projectDir, emitLog);

          if (!rebuildResult.success) {
            emitLog('error', rebuildResult.error || 'Rebuild failed');
            emitStatus('error', rebuildResult.error);

            if (io) {
              io.to(`project:${projectId}`).emit('preview:error', {
                error: rebuildResult.error,
                needsRebuild: true,
              });
            }

            return NextResponse.json(
              { error: rebuildResult.error, needsRebuild: true },
              { status: 500 }
            );
          }
        } else {
          // Verification failed but rebuild not recommended
          emitStatus('error', verification.error);
          return NextResponse.json(
            { error: verification.error },
            { status: 500 }
          );
        }
      } else {
        emitLog('success', '✓ Build verification passed');
      }
    } else if (isNextJs && skipRebuild) {
      emitLog('info', 'Skipping rebuild (already done by rebuild-local-db)');
    }

    try {
      // Start the dev server
      // forceDevMode=true enables hot reload (default for UAT)
      const { port, url } = await devServerManager.startDevServer(
        projectId,
        projectDir,
        emitLog,
        emitStatus,
        forceDevMode
      );

      // Emit ready event if WebSocket available
      if (io) {
        io.to(`project:${projectId}`).emit('preview:ready', { port, url });
      }

      return NextResponse.json({
        success: true,
        port,
        url,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      emitLog('error', errorMessage);
      emitStatus('error', errorMessage);

      if (io) {
        io.to(`project:${projectId}`).emit('preview:error', {
          error: errorMessage,
        });
      }

      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Preview start error:', error);
    return NextResponse.json(
      { error: 'Failed to start preview' },
      { status: 500 }
    );
  }
}
