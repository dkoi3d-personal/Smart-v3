/**
 * API Route: Get/Set Coding Directory Configuration
 *
 * Allows users to configure the base directory where their coding projects are located.
 * This makes the platform portable across different machines.
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { clearConfigCache } from '@/lib/project-paths';
import { resetProjectCache } from '@/app/api/projects/route';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'platform-config.json');

interface PlatformConfig {
  codingDirectory: string | null;
  configuredAt: string | null;
}

async function loadConfig(): Promise<PlatformConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {
      codingDirectory: null,
      configuredAt: null,
    };
  }
}

async function saveConfig(config: PlatformConfig): Promise<void> {
  const configDir = path.dirname(CONFIG_FILE);
  await fs.mkdir(configDir, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

function getDefaultDirectory(): string {
  const homeDir = os.homedir();
  return path.join(homeDir, 'coding', 'ai-projects');
}

export async function GET() {
  const config = await loadConfig();
  const defaultDir = getDefaultDirectory();

  // Check if the configured directory exists
  let directoryExists = false;
  const activeDirectory = config.codingDirectory || defaultDir;

  try {
    await fs.access(activeDirectory);
    directoryExists = true;
  } catch {
    directoryExists = false;
  }

  return NextResponse.json({
    codingDirectory: config.codingDirectory,
    defaultDirectory: defaultDir,
    activeDirectory,
    directoryExists,
    configuredAt: config.configuredAt,
    isConfigured: !!config.codingDirectory,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { codingDirectory } = body;

    if (!codingDirectory) {
      return NextResponse.json(
        { error: 'codingDirectory is required' },
        { status: 400 }
      );
    }

    // Expand ~ to home directory
    let expandedPath = codingDirectory;
    if (expandedPath.startsWith('~')) {
      expandedPath = path.join(os.homedir(), expandedPath.slice(1));
    }

    // Normalize the path
    expandedPath = path.resolve(expandedPath);

    // Check if directory exists
    try {
      const stats = await fs.stat(expandedPath);
      if (!stats.isDirectory()) {
        return NextResponse.json(
          { error: 'Path is not a directory' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'Directory does not exist' },
        { status: 400 }
      );
    }

    // Save the config
    const config: PlatformConfig = {
      codingDirectory: expandedPath,
      configuredAt: new Date().toISOString(),
    };
    await saveConfig(config);

    // Clear stale projects data since we're changing directories
    const projectsFile = path.join(process.cwd(), 'data', 'projects.json');
    const deletedFile = path.join(process.cwd(), 'data', 'deleted-projects.json');

    try {
      await fs.writeFile(projectsFile, '[]', 'utf-8');
      console.log('Cleared projects.json for new coding directory');
    } catch {
      // File might not exist
    }

    try {
      await fs.writeFile(deletedFile, '[]', 'utf-8');
      console.log('Cleared deleted-projects.json for new coding directory');
    } catch {
      // File might not exist
    }

    // Clear caches so they reload with new config
    clearConfigCache();
    resetProjectCache();

    return NextResponse.json({
      success: true,
      codingDirectory: expandedPath,
      configuredAt: config.configuredAt,
    });
  } catch (error) {
    console.error('Error saving coding directory config:', error);
    return NextResponse.json(
      { error: 'Failed to save configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    // Reset to default
    const config: PlatformConfig = {
      codingDirectory: null,
      configuredAt: null,
    };
    await saveConfig(config);

    // Clear stale projects data
    const projectsFile = path.join(process.cwd(), 'data', 'projects.json');
    const deletedFile = path.join(process.cwd(), 'data', 'deleted-projects.json');

    try {
      await fs.writeFile(projectsFile, '[]', 'utf-8');
    } catch {
      // File might not exist
    }

    try {
      await fs.writeFile(deletedFile, '[]', 'utf-8');
    } catch {
      // File might not exist
    }

    // Clear caches so they reload with new config
    clearConfigCache();
    resetProjectCache();

    return NextResponse.json({
      success: true,
      message: 'Reset to default directory',
      defaultDirectory: getDefaultDirectory(),
    });
  } catch (error) {
    console.error('Error resetting coding directory config:', error);
    return NextResponse.json(
      { error: 'Failed to reset configuration' },
      { status: 500 }
    );
  }
}
