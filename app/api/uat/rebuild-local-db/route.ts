/**
 * Rebuild Local Database API
 *
 * POST /api/uat/rebuild-local-db
 * Rebuilds the local SQLite database from prisma schema and seeds it
 */

import { NextRequest, NextResponse } from 'next/server';
import { exec, execSync } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { getProjectDir } from '@/lib/project-paths';

const execAsync = promisify(exec);

// Kill processes on dev ports (Windows)
function killDevPortProcesses(onLog: (log: string) => void): void {
  if (process.platform !== 'win32') return;

  try {
    const result = execSync('netstat -ano | findstr :50', { encoding: 'utf-8', windowsHide: true });
    const pidsToKill = new Set<string>();

    for (const line of result.split('\n')) {
      const match = line.match(/:50(\d{2})\s.*LISTENING\s+(\d+)/);
      if (match && match[2] && match[2] !== '0') {
        pidsToKill.add(match[2]);
      }
    }

    for (const pid of pidsToKill) {
      try {
        execSync(`taskkill /PID ${pid} /F /T`, { windowsHide: true, stdio: 'pipe' });
        onLog(`Killed process ${pid}`);
      } catch { /* ignore */ }
    }
  } catch { /* no processes */ }
}

// Run a command with DATABASE_URL set for SQLite
async function runCommand(
  command: string,
  projectDir: string,
  onLog: (log: string) => void,
  timeout: number = 60000
): Promise<{ success: boolean; output?: string; error?: string }> {
  onLog(`$ ${command}`);

  // Prisma resolves paths relative to schema.prisma location (prisma/)
  // So ./dev.db means prisma/dev.db from project root
  const databaseUrl = `file:./dev.db`;
  onLog(`DATABASE_URL=${databaseUrl}`);

  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: projectDir,
      timeout,
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        FORCE_COLOR: '0',
      },
      maxBuffer: 10 * 1024 * 1024,
      windowsHide: true,
    });

    if (stdout) {
      stdout.split('\n').filter(Boolean).forEach(line => onLog(line));
    }
    if (stderr && !stderr.includes('ExperimentalWarning')) {
      stderr.split('\n').filter(Boolean).forEach(line => onLog(`[warn] ${line}`));
    }

    return { success: true, output: stdout };
  } catch (error: any) {
    if (error.stdout) {
      error.stdout.split('\n').filter(Boolean).forEach((line: string) => onLog(line));
    }
    if (error.stderr) {
      error.stderr.split('\n').filter(Boolean).forEach((line: string) => onLog(`[err] ${line}`));
    }
    return { success: false, error: error.stderr || error.message };
  }
}

export async function POST(request: NextRequest) {
  const logs: string[] = [];
  const addLog = (log: string) => {
    console.log(`[rebuild] ${log}`);
    logs.push(log);
  };

  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    // Get project directory - try from projects.json first, then fallback to default path
    let projectDir: string | undefined;

    try {
      const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
      const projectsData = await fs.readFile(projectsPath, 'utf-8');
      const projects = JSON.parse(projectsData);
      const project = projects.find((p: any) => p.id === projectId || p.projectId === projectId);

      if (project) {
        projectDir = project.projectDirectory || project.directory;
      }
    } catch {
      // projects.json not found or invalid
    }

    // Fallback to default project path
    if (!projectDir) {
      projectDir = getProjectDir(projectId);
    }

    // Verify directory exists
    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json({ error: `Project directory not found: ${projectDir}` }, { status: 404 });
    }

    addLog('=== Rebuilding Local Database ===');
    addLog(`Directory: ${projectDir}`);

    // Check schema exists
    const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
    try {
      await fs.access(schemaPath);
    } catch {
      return NextResponse.json({ success: false, error: 'No Prisma schema found', logs });
    }

    // Note: Preview server should already be stopped by caller (rebuildApp)
    // Only kill stale dev port processes if any are lingering
    killDevPortProcesses(addLog);
    await new Promise(r => setTimeout(r, 500));

    // Ensure schema is SQLite
    addLog('Ensuring SQLite schema...');
    let schema = await fs.readFile(schemaPath, 'utf-8');
    if (!schema.includes('provider = "sqlite"')) {
      schema = schema.replace(/provider\s*=\s*["'](sqlite|postgresql)["']/g, 'provider = "sqlite"');
      await fs.writeFile(schemaPath, schema, 'utf-8');
      addLog('Switched schema to SQLite');
    }

    // Prisma resolves paths relative to schema.prisma (in prisma/)
    // So ./dev.db = prisma/dev.db from project root
    const sqliteUrl = `file:./dev.db`;

    // Ensure .env.local has SQLite URL
    const envLocalPath = path.join(projectDir, '.env.local');
    try {
      let envContent = await fs.readFile(envLocalPath, 'utf-8');
      if (envContent.includes('DATABASE_URL=')) {
        envContent = envContent.replace(/DATABASE_URL=["']?[^"'\r\n]+["']?/, `DATABASE_URL="${sqliteUrl}"`);
      } else {
        envContent += `\nDATABASE_URL="${sqliteUrl}"\n`;
      }
      await fs.writeFile(envLocalPath, envContent, 'utf-8');
      addLog('Updated .env.local with: ' + sqliteUrl);
    } catch {
      await fs.writeFile(envLocalPath, `# Local dev\nDATABASE_URL="${sqliteUrl}"\n`, 'utf-8');
      addLog('Created .env.local with: ' + sqliteUrl);
    }

    // Delete old database files (including wrong-path locations)
    const dbPath = path.join(projectDir, 'prisma', 'dev.db');
    const wrongDbPath = path.join(projectDir, 'prisma', 'prisma', 'dev.db');
    for (const p of [dbPath, wrongDbPath]) {
      try {
        await fs.unlink(p);
        addLog(`Deleted: ${p}`);
      } catch { /* may not exist */ }
      try {
        await fs.unlink(p + '-journal');
      } catch { /* may not exist */ }
    }
    // Remove empty prisma/prisma dir if it exists
    try {
      await fs.rmdir(path.join(projectDir, 'prisma', 'prisma'));
    } catch { /* may not exist or not empty */ }

    // Delete old Prisma client to force regeneration
    const prismaClientPath = path.join(projectDir, 'node_modules', '.prisma', 'client');
    try {
      await fs.rm(prismaClientPath, { recursive: true, force: true });
      addLog('Deleted old Prisma client');
    } catch { /* may not exist */ }

    // Delete Next.js cache to ensure clean restart
    const nextCachePath = path.join(projectDir, '.next', 'cache');
    try {
      await fs.rm(nextCachePath, { recursive: true, force: true });
      addLog('Cleared Next.js cache');
    } catch { /* may not exist */ }

    // Generate Prisma client
    addLog('Generating Prisma client...');
    let result = await runCommand('npx prisma generate', projectDir, addLog);
    if (!result.success) {
      addLog('Warning: Generate may have issues, continuing...');
    }

    // Push schema (creates database) - already generated above, just push
    addLog('Creating database and tables...');
    result = await runCommand('npx prisma db push --force-reset --accept-data-loss', projectDir, addLog);
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Failed to create database: ' + (result.error || 'unknown'),
        logs,
      });
    }

    // Verify database exists
    try {
      await fs.access(dbPath);
      addLog('Database file created');
    } catch {
      return NextResponse.json({ success: false, error: 'Database file was not created', logs });
    }

    // Seed database
    addLog('Seeding database...');
    result = await runCommand('npx prisma db seed', projectDir, addLog, 120000);
    if (!result.success) {
      addLog('Seed warning: ' + (result.error?.slice(0, 100) || 'failed'));
    } else {
      addLog('Database seeded!');
    }

    addLog('');
    addLog('=== Done ===');
    addLog('Login: admin@test.com / password123');

    // Note: Caller is responsible for restarting preview server
    // This avoids race conditions when caller also starts the preview

    return NextResponse.json({ success: true, message: 'Database rebuilt', logs });

  } catch (error: any) {
    addLog(`Error: ${error.message}`);
    return NextResponse.json({ success: false, error: error.message, logs }, { status: 500 });
  }
}
