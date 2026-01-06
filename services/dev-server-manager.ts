import { spawn, ChildProcess } from 'child_process';
import * as net from 'net';
import * as path from 'path';
import { getProjectsBaseDir } from '@/lib/project-paths';
import { setupLocalEnvironment } from '@/lib/env-manager';

interface DevServer {
  projectId: string;
  process: ChildProcess;
  port: number;
  status: 'starting' | 'ready' | 'error' | 'stopped';
  startTime: Date;
  lastActivity: Date;
  type: 'nextjs' | 'vite' | 'node' | 'static';
}

class DevServerManager {
  private servers: Map<string, DevServer> = new Map();
  // Reserved ports: 3000 = main app, 4567-4599 = agent testing
  private readonly RESERVED_PORTS = [3000, 3001, ...Array.from({length: 33}, (_, i) => 4567 + i)];
  private readonly MIN_PORT = 5005;  // Start at 5005 as requested
  private readonly MAX_PORT = 5100;
  private readonly SERVER_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  private readonly isWindows = process.platform === 'win32';

  constructor() {
    // Start cleanup timer
    setInterval(() => this.cleanupInactiveServers(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Validate that the project directory is within the projects folder
   * Prevents running servers outside the isolated projects area
   */
  private validateProjectDir(projectDir: string): void {
    // Projects are now in C:\Users\srfit\coding\ai-projects\
    const projectsBaseDir = getProjectsBaseDir();
    // Normalize both paths to forward slashes for consistent comparison
    const normalizedBase = path.resolve(projectsBaseDir).replace(/\\/g, '/');
    const normalizedDir = path.resolve(projectDir).replace(/\\/g, '/');

    if (!normalizedDir.startsWith(normalizedBase + '/') && normalizedDir !== normalizedBase) {
      throw new Error(`Security: Project directory must be within the projects folder (${projectsBaseDir}).`);
    }
  }

  /**
   * Ensure local development environment is properly configured
   * Uses shared env-manager utility
   */
  private async ensureLocalDevEnvironment(
    projectDir: string,
    _fs: typeof import('fs/promises'),
    emitLog?: (type: string, message: string) => void
  ): Promise<void> {
    await setupLocalEnvironment(projectDir, (msg) => {
      const type = msg.startsWith('✓') || msg.includes('Created') || msg.includes('Switched')
        ? 'success'
        : 'info';
      emitLog?.(type, msg);
    });
  }

  /**
   * Find an available port in the range (excludes reserved ports like 3000)
   */
  private async findAvailablePort(emitLog?: (type: string, message: string) => void): Promise<number> {
    emitLog?.('info', `Finding available port starting from ${this.MIN_PORT}...`);

    for (let port = this.MIN_PORT; port <= this.MAX_PORT; port++) {
      // Never use reserved ports (e.g., 3000 for main app)
      if (this.RESERVED_PORTS.includes(port)) {
        continue;
      }
      // Validate port is a valid number
      if (typeof port !== 'number' || isNaN(port) || port < 1 || port > 65535) {
        continue;
      }

      // Double-check port availability with both TCP bind test AND netstat check
      const isAvailable = await this.isPortAvailable(port);
      if (!isAvailable) {
        emitLog?.('info', `Port ${port} in use, trying next...`);
        continue;
      }

      // Also verify with netstat that no process is listening (Windows can have race conditions)
      if (this.isWindows) {
        try {
          const { execSync } = await import('child_process');
          const result = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
            encoding: 'utf-8',
            shell: 'cmd.exe',
            windowsHide: true,
            stdio: 'pipe',
          });
          if (result.trim()) {
            emitLog?.('info', `Port ${port} has listener per netstat, trying next...`);
            continue;
          }
        } catch {
          // No listener found - good!
        }
      }

      emitLog?.('info', `Found available port: ${port}`);
      return port;
    }
    throw new Error(`No available ports in range ${this.MIN_PORT}-${this.MAX_PORT}`);
  }

  /**
   * Check if a port is available
   */
  private isPortAvailable(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => {
        server.close();
        resolve(true);
      });
      server.listen(port, '127.0.0.1');
    });
  }

  /**
   * Kill any process using a specific port (cross-platform)
   */
  private async killProcessOnPort(port: number): Promise<void> {
    try {
      const { exec, execSync } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      if (this.isWindows) {
        // Windows: Find PID using netstat - use cmd.exe explicitly to avoid git-bash issues
        try {
          const stdout = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
            encoding: 'utf-8',
            shell: 'cmd.exe',
            windowsHide: true,
          });
          const lines = stdout.trim().split('\n');

          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            const pid = parts[parts.length - 1];
            if (pid && /^\d+$/.test(pid) && pid !== '0') {
              console.log(`[DevServer] Killing process ${pid} on port ${port}`);
              try {
                // Use cmd.exe explicitly for taskkill
                execSync(`taskkill /PID ${pid} /F /T`, {
                  encoding: 'utf-8',
                  shell: 'cmd.exe',
                  windowsHide: true,
                  stdio: 'pipe',
                });
                console.log(`[DevServer] Successfully killed process ${pid}`);
              } catch (killErr) {
                console.log(`[DevServer] Failed to kill process ${pid}: ${killErr}`);
              }
            }
          }
        } catch {
          // No process found on port - that's OK
        }
      } else {
        // macOS/Linux: Use lsof to find process on port
        try {
          const { stdout } = await execAsync(`lsof -ti :${port}`);
          const pids = stdout.trim().split('\n').filter(p => p && /^\d+$/.test(p));

          for (const pid of pids) {
            console.log(`[DevServer] Killing process ${pid} on port ${port}`);
            await execAsync(`kill -9 ${pid}`).catch(() => {});
          }
        } catch {
          // lsof may fail if no process is using the port - that's OK
        }
      }

      // Wait a moment for port to be released
      await new Promise(r => setTimeout(r, 500));
    } catch {
      // No process found or kill failed - that's OK
    }
  }

  /**
   * Wait for a port to become active (server started)
   * Uses HTTP fetch for more reliable detection
   */
  private waitForPort(port: number, timeout: number = 30000, emitLog?: (type: string, message: string) => void): Promise<void> {
    const startTime = Date.now();
    let checkCount = 0;
    let httpSuccessCount = 0;

    return new Promise((resolve, reject) => {
      const checkPort = async () => {
        checkCount++;
        const elapsed = Date.now() - startTime;

        if (elapsed > timeout) {
          reject(new Error(`Port ${port} did not become available within ${timeout}ms (${checkCount} checks)`));
          return;
        }

        try {
          // Try HTTP fetch
          const controller = new AbortController();
          const fetchTimeout = setTimeout(() => controller.abort(), 3000);

          const response = await fetch(`http://localhost:${port}`, {
            signal: controller.signal,
          }).catch(() => null);

          clearTimeout(fetchTimeout);

          if (response) {
            httpSuccessCount++;
            // Accept any HTTP response (even errors) as server being ready
            // Next.js may return errors during compilation but the server is up
            if (response.ok || response.status < 500) {
              emitLog?.('info', `Port ${port} responding (status ${response.status}) after ${checkCount} checks (${elapsed}ms)`);
              resolve();
              return;
            }
            // Server responded with 500, might still be compiling
            // After 3 successful HTTP connections, consider it ready
            if (httpSuccessCount >= 3) {
              emitLog?.('info', `Port ${port} responding (accepting after ${httpSuccessCount} HTTP responses)`);
              resolve();
              return;
            }
            // Keep checking
            setTimeout(checkPort, 800);
            return;
          }
        } catch {
          // Fetch failed, try socket as fallback
        }

        // Fallback: try raw socket connection
        const socket = new net.Socket();
        let resolved = false;

        const cleanup = () => {
          if (!resolved) {
            socket.destroy();
          }
        };

        socket.setTimeout(2000);

        socket.once('connect', () => {
          resolved = true;
          socket.destroy();
          emitLog?.('info', `Port ${port} socket connected after ${checkCount} checks (${elapsed}ms)`);
          // Socket connected - server is running, resolve immediately
          resolve();
        });

        socket.once('timeout', () => {
          cleanup();
          setTimeout(checkPort, 800);
        });

        socket.once('error', () => {
          cleanup();
          setTimeout(checkPort, 800);
        });

        try {
          socket.connect(port, '127.0.0.1');
        } catch {
          cleanup();
          setTimeout(checkPort, 800);
        }
      };

      // Start checking after initial delay to give server time to bind port
      const initialDelay = this.isWindows ? 2000 : 1000;
      setTimeout(checkPort, initialDelay);
    });
  }

  /**
   * Start a development server for a project
   */
  async startDevServer(
    projectId: string,
    projectDir: string,
    emitLog?: (type: string, message: string) => void,
    emitStatus?: (status: string, message?: string) => void
  ): Promise<{ port: number; url: string }> {
    // Normalize the project directory path - use forward slashes for Windows compatibility
    // Windows accepts forward slashes in paths and this avoids escaping issues
    projectDir = path.resolve(projectDir).replace(/\\/g, '/');
    emitLog?.('info', `Normalized project directory: ${projectDir}`);

    // Validate project directory is within the projects folder
    this.validateProjectDir(projectDir);

    // Check if server already exists
    if (this.servers.has(projectId)) {
      const existing = this.servers.get(projectId)!;
      if (existing.status === 'ready') {
        return { port: existing.port, url: `http://localhost:${existing.port}` };
      }
      // Stop existing failed/stopped server
      await this.stopDevServer(projectId);
    }

    try {
      const port = await this.findAvailablePort(emitLog);

      emitLog?.('info', `Allocated port ${port}`);

      // Check if package.json exists
      const fs = await import('fs/promises');
      const packageJsonPath = path.join(projectDir, 'package.json');
      let hasPackageJson = false;

      try {
        await fs.access(packageJsonPath);
        hasPackageJson = true;
      } catch {
        // No package.json - check for static site
      }

      // Check for static website (index.html without package.json or with no dev script)
      const indexHtmlPath = path.join(projectDir, 'index.html');
      let hasIndexHtml = false;
      try {
        await fs.access(indexHtmlPath);
        hasIndexHtml = true;
      } catch {
        // No index.html
      }

      // Determine if this is a static site
      let isStaticSite = false;
      if (!hasPackageJson && hasIndexHtml) {
        isStaticSite = true;
        emitLog?.('info', 'Detected: Static website (no package.json, has index.html)');
      } else if (hasPackageJson) {
        // Check if package.json has a dev script
        try {
          const pkgContent = await fs.readFile(packageJsonPath, 'utf-8');
          const pkg = JSON.parse(pkgContent);
          if (!pkg.scripts?.dev && !pkg.scripts?.start && hasIndexHtml) {
            isStaticSite = true;
            emitLog?.('info', 'Detected: Static website (no dev/start script, has index.html)');
          }
        } catch {
          // Ignore parse errors
        }
      }

      // If static site, use serve or http-server
      if (isStaticSite) {
        return await this.startStaticServer(projectId, projectDir, port, emitLog, emitStatus);
      }

      if (!hasPackageJson) {
        throw new Error('No package.json or index.html found in project directory');
      }

      // Ensure local dev environment is configured (.env, SQLite schema for Prisma)
      await this.ensureLocalDevEnvironment(projectDir, fs, emitLog);

      // Check if node_modules already exists (skip npm install if so)
      const nodeModulesPath = path.join(projectDir, 'node_modules');
      let hasNodeModules = false;
      try {
        await fs.access(nodeModulesPath);
        hasNodeModules = true;
        emitLog?.('info', 'node_modules exists, skipping npm install');
      } catch {
        emitLog?.('info', 'node_modules not found, will run npm install');
      }

      if (!hasNodeModules) {
        emitStatus?.('installing', 'Installing dependencies...');

        // Run npm install only if node_modules doesn't exist
        emitLog?.('info', 'Running npm install...');
        await new Promise<void>((resolve, reject) => {
          emitLog?.('info', `Spawning: npm install in ${projectDir}`);

        const installProcess = spawn('npm', ['install'], {
          cwd: projectDir,
          shell: true,  // Required on Windows to find npm
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, NODE_ENV: 'development' },
          windowsHide: true,
        });

        let installOutput = '';

        installProcess.stdout?.on('data', (data) => {
          const output = data.toString();
          installOutput += output;
          emitLog?.('info', output.trim());
        });

        installProcess.stderr?.on('data', (data) => {
          const output = data.toString();
          emitLog?.('warning', output.trim());
        });

        installProcess.on('close', (code) => {
          if (code === 0) {
            emitLog?.('success', '✓ Dependencies installed');
            resolve();
          } else {
            reject(new Error(`npm install failed with code ${code}`));
          }
        });

        installProcess.on('error', (err) => {
          reject(new Error(`Failed to run npm install: ${err.message}`));
        });
        });
      } // end of if (!hasNodeModules)

      // Check for Prisma and run database setup if needed
      const prismaSchemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
      let hasPrisma = false;
      try {
        await fs.access(prismaSchemaPath);
        hasPrisma = true;
      } catch {
        // No Prisma schema
      }

      if (hasPrisma) {
        // Check if Prisma client is generated
        const prismaClientPath = path.join(projectDir, 'node_modules', '.prisma', 'client');
        let hasPrismaClient = false;
        try {
          await fs.access(prismaClientPath);
          hasPrismaClient = true;
        } catch {
          // Prisma client not generated
        }

        if (!hasPrismaClient) {
          emitStatus?.('database', 'Setting up database...');
          emitLog?.('info', 'Prisma schema detected, running database setup...');

          const { exec } = await import('child_process');
          const { promisify } = await import('util');
          const execAsync = promisify(exec);

          // Load .env.local manually for cross-platform compatibility (no dotenv-cli dependency)
          const prismaEnv: NodeJS.ProcessEnv = { ...process.env, FORCE_COLOR: '0' };
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
                  if ((value.startsWith('"') && value.endsWith('"')) ||
                      (value.startsWith("'") && value.endsWith("'"))) {
                    value = value.slice(1, -1);
                  }
                  prismaEnv[key] = value;
                }
              }
            }
            emitLog?.('info', `Loaded env vars from .env.local`);
          } catch {
            emitLog?.('info', 'No .env.local found, using default environment');
          }

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
        } else {
          emitLog?.('info', 'Prisma client already generated');
        }
      }

      // Start dev server
      emitStatus?.('starting', 'Starting development server...');
      emitLog?.('info', `Starting dev server on port ${port}...`);

      // Read package.json to detect project type and available scripts
      let isNextJs = false;
      let isVite = false;
      let hasDevScript = false;
      let hasStartScript = false;
      let hasMainFile = false;
      let mainFile = 'index.js';
      let hasNextBuild = false;

      try {
        const pkgContent = await fs.readFile(packageJsonPath, 'utf-8');
        const pkg = JSON.parse(pkgContent);
        isNextJs = !!pkg.dependencies?.next || !!pkg.devDependencies?.next;
        isVite = !!pkg.dependencies?.vite || !!pkg.devDependencies?.vite;
        hasDevScript = !!pkg.scripts?.dev;
        hasStartScript = !!pkg.scripts?.start;
        hasMainFile = !!pkg.main;
        mainFile = pkg.main || 'index.js';
        emitLog?.('info', `Detected: ${isNextJs ? 'Next.js' : isVite ? 'Vite' : 'Node.js'} project`);
        emitLog?.('info', `Scripts: dev=${hasDevScript}, start=${hasStartScript}, main=${mainFile}`);
      } catch {
        // Ignore
      }

      // Check if Next.js has a complete production build
      // Requires both BUILD_ID (build started) and prerender-manifest.json (build completed)
      let hasMiddleware = false;
      if (isNextJs) {
        // Check if project has middleware (requires production mode to avoid Edge Runtime eval issues)
        try {
          const middlewareTsPath = path.join(projectDir, 'middleware.ts');
          const middlewareJsPath = path.join(projectDir, 'middleware.js');
          await fs.access(middlewareTsPath).catch(() => fs.access(middlewareJsPath));
          hasMiddleware = true;
          emitLog?.('info', 'Project has middleware - will force production mode to avoid Edge Runtime eval issues');
        } catch {
          // No middleware
        }

        try {
          const nextDir = path.join(projectDir, '.next');
          const buildIdPath = path.join(nextDir, 'BUILD_ID');
          const prerenderManifestPath = path.join(nextDir, 'prerender-manifest.json');
          const routesManifestPath = path.join(nextDir, 'routes-manifest.json');

          // Check all required build artifacts exist
          await fs.access(buildIdPath);
          await fs.access(prerenderManifestPath);
          await fs.access(routesManifestPath);

          // Also check export-detail.json if it exists (for static exports)
          const exportDetailPath = path.join(nextDir, 'export-detail.json');
          try {
            const exportDetailContent = await fs.readFile(exportDetailPath, 'utf-8');
            const exportDetail = JSON.parse(exportDetailContent);
            if (exportDetail.success === false) {
              emitLog?.('warning', 'Build export failed (export-detail.json success=false) - will use dev server');
              hasNextBuild = false;
            } else {
              hasNextBuild = true;
              emitLog?.('info', 'Found complete .next production build - will use production server');
            }
          } catch {
            // No export-detail.json is fine for non-static builds
            hasNextBuild = true;
            emitLog?.('info', 'Found complete .next production build - will use production server');
          }
        } catch {
          emitLog?.('info', 'No complete production build (missing required artifacts) - will use dev server');
          hasNextBuild = false;
        }

        // For projects with middleware but no production build, we need to build first
        if (hasMiddleware && !hasNextBuild) {
          emitLog?.('info', 'Middleware detected but no production build - creating production build...');
          emitStatus?.('building', 'Building for production (middleware requires production mode)...');

          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Clean any corrupted .next directory
            const nextDir = path.join(projectDir, '.next');
            try {
              await fs.rm(nextDir, { recursive: true, force: true });
              emitLog?.('info', 'Cleaned .next directory');
            } catch {
              // Directory may not exist
            }

            // Build with production mode
            const { stdout, stderr } = await execAsync('npx next build', {
              cwd: projectDir,
              timeout: 180000, // 3 minute timeout
              maxBuffer: 20 * 1024 * 1024,
              env: { ...process.env, NODE_ENV: 'production' },
            });

            emitLog?.('info', 'Build output: ' + stdout.slice(-500));
            if (stderr && !stderr.includes('ExperimentalWarning')) {
              emitLog?.('warning', 'Build stderr: ' + stderr.slice(-300));
            }

            hasNextBuild = true;
            emitLog?.('success', '✓ Production build complete');
          } catch (buildError) {
            const errorMsg = buildError instanceof Error ? buildError.message : String(buildError);
            emitLog?.('error', `Production build failed: ${errorMsg}`);
            throw new Error(`Cannot start server: Middleware requires production build which failed: ${errorMsg}`);
          }
        }
      }

      // Build the command based on project type and available scripts
      let devCommand: string = 'npm';
      let devArgs: string[] = ['run', 'dev'];

      if (isNextJs) {
        // Force production mode for projects with middleware (avoids Edge Runtime eval issues)
        const shouldUseProductionMode = hasNextBuild && (hasStartScript || hasMiddleware);
        if (shouldUseProductionMode) {
          // Use production server for pre-built Next.js apps or when middleware requires it
          devArgs = hasStartScript
            ? ['run', 'start', '--', '-p', port.toString()]
            : ['exec', 'next', 'start', '-p', port.toString()];
          emitLog?.('info', `Using production mode${hasMiddleware ? ' (required for middleware)' : ''}`);
        } else {
          // Next.js dev mode: use npm run dev -- -p PORT or npx next dev -p PORT
          devArgs = hasDevScript ? ['run', 'dev', '--', '-p', port.toString()] : ['exec', 'next', 'dev', '-p', port.toString()];
        }
      } else if (isVite) {
        // Vite: use --port flag
        devArgs = hasDevScript ? ['run', 'dev', '--', '--port', port.toString()] : ['exec', 'vite', '--port', port.toString()];
      } else if (hasDevScript) {
        // Has a dev script - use it
        devArgs = ['run', 'dev'];
      } else if (hasStartScript) {
        // Fall back to start script
        devArgs = ['run', 'start'];
        emitLog?.('info', 'No dev script found, using start script');
      } else {
        // No scripts - try to run main file directly with node
        emitLog?.('info', `No dev/start scripts found, running: node ${mainFile}`);
        devCommand = 'node';
        devArgs = [mainFile];
      }

      // Filter out any undefined/null/empty args and ensure all are strings
      devArgs = devArgs.filter(arg => arg !== undefined && arg !== null && arg !== '').map(String);

      // Determine if we're running production or development mode
      const isProductionMode = hasNextBuild && hasStartScript;
      emitLog?.('info', `Running: ${devCommand} ${devArgs.join(' ')} (mode: ${isProductionMode ? 'production' : 'development'})`);

      // Load project env files: .env first, then .env.local (which overrides)
      // This matches Next.js env loading order for local development
      let projectEnv: Record<string, string> = {};

      const parseEnvFile = (content: string): Record<string, string> => {
        const vars: Record<string, string> = {};
        content.split('\n').forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...valueParts] = trimmed.split('=');
            if (key && valueParts.length > 0) {
              let value = valueParts.join('=');
              if ((value.startsWith('"') && value.endsWith('"')) ||
                  (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
              }
              vars[key.trim()] = value;
            }
          }
        });
        return vars;
      };

      // First load .env (base configuration)
      try {
        const envPath = path.join(projectDir, '.env');
        const envContent = await fs.readFile(envPath, 'utf-8');
        projectEnv = { ...projectEnv, ...parseEnvFile(envContent) };
        emitLog?.('info', `Loaded env vars from .env`);
      } catch {
        // No .env file - that's OK
      }

      // Then load .env.local which overrides (local development - SQLite)
      try {
        const envLocalPath = path.join(projectDir, '.env.local');
        const envLocalContent = await fs.readFile(envLocalPath, 'utf-8');
        const localVars = parseEnvFile(envLocalContent);
        projectEnv = { ...projectEnv, ...localVars };
        emitLog?.('info', `Loaded env vars from .env.local (overrides .env)`);
      } catch {
        // No .env.local file - that's OK
      }

      emitLog?.('info', `Total project env vars loaded: ${Object.keys(projectEnv).length}`);

      // Spawn the dev server process with shell: true (required on Windows)
      const devProcess = spawn(devCommand, devArgs, {
        cwd: projectDir,
        shell: true,  // Required on Windows to find npm/npx
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          ...projectEnv, // Project's .env takes precedence
          PORT: String(port),
          NODE_ENV: isProductionMode ? 'production' : 'development',
          BROWSER: 'none', // Don't auto-open browser
          MAIN_PLATFORM_URL: 'http://localhost:3000', // For Epic FHIR proxy
        },
        windowsHide: true, // Hide console window on Windows
      });

      // Log process PID for debugging
      emitLog?.('info', `Dev server process started with PID: ${devProcess.pid}`);

      const server: DevServer = {
        projectId,
        process: devProcess,
        port,
        status: 'starting',
        startTime: new Date(),
        lastActivity: new Date(),
        type: isNextJs ? 'nextjs' : isVite ? 'vite' : 'node',
      };

      this.servers.set(projectId, server);

      // Listen to output
      devProcess.stdout?.on('data', (data) => {
        const output = data.toString();
        emitLog?.('info', output.trim());

        // Detect when server is ready (various frameworks)
        const readyPatterns = [
          'Ready',
          'ready',
          'started',
          'Local:',           // Vite
          'localhost:',       // Generic
          'compiled',         // Next.js
          'Server running',
          'Listening on',
          '➜',               // Vite arrow
        ];
        if (readyPatterns.some(p => output.includes(p))) {
          server.status = 'ready';
          server.lastActivity = new Date();
        }
      });

      devProcess.stderr?.on('data', (data) => {
        const output = data.toString();
        // Filter out noise
        if (!output.includes('ExperimentalWarning') && !output.includes('DeprecationWarning')) {
          emitLog?.('warning', output.trim());
        }
      });

      devProcess.on('error', (err) => {
        emitLog?.('error', `Process error: ${err.message}`);
        server.status = 'error';
        this.servers.delete(projectId);
      });

      devProcess.on('close', (code) => {
        emitLog?.('info', `Dev server stopped with code ${code}`);
        server.status = 'stopped';
        this.servers.delete(projectId);
      });

      // Wait for port to be ready OR server status to become ready
      try {
        emitLog?.('info', `Waiting for server to become ready on port ${port}...`);

        // Track if process exits with an error (non-zero code)
        let processError: Error | null = null;
        let processStderr: string[] = [];

        // Capture stderr for better error messages
        devProcess.stderr?.on('data', (data) => {
          const output = data.toString().trim();
          if (output && !output.includes('ExperimentalWarning') && !output.includes('DeprecationWarning')) {
            processStderr.push(output);
            // Keep only last 10 lines
            if (processStderr.length > 10) processStderr.shift();
          }
        });

        devProcess.once('close', (code) => {
          if (code !== 0 && code !== null && server.status !== 'ready') {
            const stderrSummary = processStderr.length > 0 ? ` - ${processStderr.slice(-3).join(' | ')}` : '';
            processError = new Error(`Process exited with code ${code}${stderrSummary}`);
          }
        });
        devProcess.once('error', (err) => {
          processError = new Error(`Process error: ${err.message}`);
        });

        // Create a promise that resolves when server.status becomes 'ready' (from stdout detection)
        const statusReadyPromise = new Promise<void>((resolve) => {
          const checkStatus = () => {
            if (server.status === 'ready') {
              resolve();
            } else if (processError) {
              // Don't keep checking if process errored
              return;
            } else {
              setTimeout(checkStatus, 500);
            }
          };
          checkStatus();
        });

        // Race between: port becoming available OR status becoming ready
        // We don't race against process exit because on Windows the shell may exit
        // while the actual server continues running
        await Promise.race([
          this.waitForPort(port, 90000, emitLog),
          statusReadyPromise,
        ]);

        // Check if there was a process error during startup
        if (processError && server.status !== 'ready') {
          throw processError;
        }

        server.status = 'ready';
        emitLog?.('success', `✓ Development server ready on http://localhost:${port}`);
        emitStatus?.('ready');

        return { port, url: `http://localhost:${port}` };
      } catch (error) {
        // Log process status for debugging
        emitLog?.('error', `Server process status: killed=${devProcess.killed}, exitCode=${devProcess.exitCode}`);
        const errorMsg = error instanceof Error ? error.message : String(error);
        throw new Error(`Server failed to start: ${errorMsg || 'Unknown error (check terminal logs)'}`);
      }

    } catch (error) {
      emitLog?.('error', `Failed to start dev server: ${error instanceof Error ? error.message : 'Unknown error'}`);
      emitStatus?.('error', error instanceof Error ? error.message : 'Failed to start dev server');
      throw error;
    }
  }

  /**
   * Start a static file server for HTML/CSS/JS websites
   */
  private async startStaticServer(
    projectId: string,
    projectDir: string,
    port: number,
    emitLog?: (type: string, message: string) => void,
    emitStatus?: (status: string, message?: string) => void
  ): Promise<{ port: number; url: string }> {
    // Normalize path to forward slashes for Windows compatibility
    projectDir = projectDir.replace(/\\/g, '/');

    emitStatus?.('starting', 'Starting static file server...');
    emitLog?.('info', `Starting static server on port ${port}...`);

    // Use npx serve for static files (no install needed)
    const serveArgs = ['serve', '-l', String(port), '-s', '.'];

    emitLog?.('info', `Spawning: npx ${serveArgs.join(' ')}`);

    const serveProcess = spawn('npx', serveArgs, {
      cwd: projectDir,
      shell: true,  // Required on Windows to find npx
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        BROWSER: 'none',
      },
      windowsHide: true,
    });

    const server: DevServer = {
      projectId,
      process: serveProcess,
      port,
      status: 'starting',
      startTime: new Date(),
      lastActivity: new Date(),
      type: 'static',
    };

    this.servers.set(projectId, server);

    // Listen to output
    serveProcess.stdout?.on('data', (data) => {
      const output = data.toString();
      emitLog?.('info', output.trim());

      // Detect when serve is ready
      if (output.includes('Accepting connections') || output.includes('Local:') || output.includes('localhost')) {
        server.status = 'ready';
        server.lastActivity = new Date();
      }
    });

    serveProcess.stderr?.on('data', (data) => {
      const output = data.toString();
      if (!output.includes('ExperimentalWarning')) {
        emitLog?.('warning', output.trim());
      }
    });

    serveProcess.on('error', (err) => {
      emitLog?.('error', `Process error: ${err.message}`);
      server.status = 'error';
      this.servers.delete(projectId);
    });

    serveProcess.on('close', (code) => {
      emitLog?.('info', `Static server stopped with code ${code}`);
      server.status = 'stopped';
      this.servers.delete(projectId);
    });

    // Wait for port to be ready
    try {
      emitLog?.('info', `Waiting for static server on port ${port}...`);
      await this.waitForPort(port, 60000, emitLog);
      server.status = 'ready';
      emitLog?.('success', `✓ Static server ready on http://localhost:${port}`);
      emitStatus?.('ready');

      return { port, url: `http://localhost:${port}` };
    } catch (error) {
      emitLog?.('error', `Static server failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new Error(`Static server failed to start: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Stop a development server
   */
  async stopDevServer(projectId: string): Promise<void> {
    const server = this.servers.get(projectId);
    if (!server) {
      return;
    }

    const port = server.port;
    const pid = server.process?.pid;

    console.log(`[DevServer] Stopping server for ${projectId} (port: ${port}, pid: ${pid})`);

    try {
      if (this.isWindows) {
        // Windows: Use taskkill to kill the process tree
        if (pid) {
          try {
            const { execSync } = await import('child_process');
            // Kill the entire process tree using /T flag
            console.log(`[DevServer] Windows: Killing process tree for PID ${pid}`);
            execSync(`taskkill /PID ${pid} /T /F`, {
              encoding: 'utf-8',
              shell: 'cmd.exe',
              windowsHide: true,
              stdio: 'pipe',
            });
            console.log(`[DevServer] Successfully killed process tree ${pid}`);
          } catch (err) {
            console.log(`[DevServer] taskkill for PID ${pid} failed (may already be dead): ${err}`);
          }
        }

        // Also kill any process on the port (in case the child processes are orphaned)
        if (port) {
          await this.killProcessOnPort(port);
        }

        // Wait for port to be released
        await new Promise(r => setTimeout(r, 500));
      } else {
        // macOS/Linux: Use signals
        if (server.process && !server.process.killed) {
          // Create a promise that resolves when the process exits
          const exitPromise = new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              // Force kill if still alive after 3 seconds
              if (server.process && !server.process.killed) {
                console.log(`[DevServer] Force killing process ${pid}`);
                server.process.kill('SIGKILL');
              }
              resolve();
            }, 3000);

            server.process.once('exit', () => {
              clearTimeout(timeout);
              resolve();
            });
          });

          server.process.kill('SIGTERM');
          await exitPromise;
        }

        // Also kill any process still on the port (handles shell child processes)
        if (port) {
          try {
            const { exec } = await import('child_process');
            const { promisify } = await import('util');
            const execAsync = promisify(exec);

            // Kill by process group if we have a PID
            if (pid) {
              await execAsync(`kill -9 -${pid}`).catch(() => {});
            }

            // Also kill any process on the port
            await this.killProcessOnPort(port);
          } catch {
            // Ignore errors
          }
        }

        // Wait a bit for port to be fully released
        await new Promise(r => setTimeout(r, 300));
      }

      server.status = 'stopped';
      this.servers.delete(projectId);
      console.log(`[DevServer] Server for ${projectId} stopped successfully`);
    } catch (error) {
      console.error(`Error stopping dev server for ${projectId}:`, error);
      // Still remove from tracked servers even on error
      this.servers.delete(projectId);
    }
  }

  /**
   * Get dev server info
   */
  getDevServer(projectId: string): DevServer | undefined {
    return this.servers.get(projectId);
  }

  /**
   * Update last activity time
   */
  updateActivity(projectId: string): void {
    const server = this.servers.get(projectId);
    if (server) {
      server.lastActivity = new Date();
    }
  }

  /**
   * Cleanup inactive servers
   */
  private cleanupInactiveServers(): void {
    const now = Date.now();

    for (const [projectId, server] of this.servers.entries()) {
      const inactiveTime = now - server.lastActivity.getTime();

      if (inactiveTime > this.SERVER_TIMEOUT) {
        console.log(`⏰ Stopping inactive dev server for project ${projectId} (inactive for ${Math.round(inactiveTime / 60000)} minutes)`);
        this.stopDevServer(projectId);
      }
    }
  }

  /**
   * Stop all dev servers (for shutdown)
   */
  async stopAll(): Promise<void> {
    console.log(`[DevServer] Stopping all servers (${this.servers.size} tracked)`);

    // First, stop all tracked servers
    const promises = Array.from(this.servers.keys()).map(projectId =>
      this.stopDevServer(projectId)
    );
    await Promise.all(promises);

    // Force kill any orphaned processes on preview ports (both Windows and Unix)
    console.log('[DevServer] Cleaning up orphaned processes on preview ports...');
    for (let port = this.MIN_PORT; port <= this.MIN_PORT + 20; port++) {
      await this.killProcessOnPort(port);
    }

    // Wait for ports to be released
    await new Promise(r => setTimeout(r, 1000));
  }

  /**
   * Get all active servers
   */
  getAllServers(): Map<string, DevServer> {
    return new Map(this.servers);
  }
}

// Global singleton to survive Next.js hot-reload
const globalForDevServer = globalThis as unknown as {
  devServerManager: DevServerManager | undefined;
};

export const devServerManager = globalForDevServer.devServerManager ?? new DevServerManager();

if (process.env.NODE_ENV !== 'production') {
  globalForDevServer.devServerManager = devServerManager;
}
