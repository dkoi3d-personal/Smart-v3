/**
 * Project Stats API - Analyze codebase for file counts, LOC, etc.
 * Used for cloned git projects to initialize metrics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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

// Directories to skip
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

interface FileStats {
  totalFiles: number;
  codeFiles: number;
  totalLines: number;
  codeLines: number;
  testFiles: number;
  byExtension: Record<string, { files: number; lines: number }>;
  largestFiles: Array<{ path: string; lines: number }>;
}

async function analyzeDirectory(dir: string, baseDir: string, stats: FileStats): Promise<void> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (SKIP_DIRS.has(entry.name)) continue;
        await analyzeDirectory(fullPath, baseDir, stats);
      } else if (entry.isFile()) {
        // Skip large generated files
        if (SKIP_FILES.has(entry.name)) continue;

        stats.totalFiles++;

        const ext = path.extname(entry.name).toLowerCase();
        const isCodeFile = CODE_EXTENSIONS.has(ext) || CONFIG_FILES.has(entry.name);

        if (isCodeFile) {
          stats.codeFiles++;

          // Check if it's a test file
          const isTest = entry.name.includes('.test.') ||
                         entry.name.includes('.spec.') ||
                         entry.name.includes('_test.') ||
                         relativePath.includes('__tests__') ||
                         relativePath.includes('/tests/') ||
                         relativePath.includes('/test/') ||
                         relativePath.includes('\\tests\\') ||
                         relativePath.includes('\\test\\');
          if (isTest) {
            stats.testFiles++;
          }

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            const lines = content.split('\n').length;
            stats.totalLines += lines;
            stats.codeLines += lines;

            // Track by extension
            if (!stats.byExtension[ext]) {
              stats.byExtension[ext] = { files: 0, lines: 0 };
            }
            stats.byExtension[ext].files++;
            stats.byExtension[ext].lines += lines;

            // Track largest files
            stats.largestFiles.push({ path: relativePath, lines });
          } catch {
            // Can't read file, skip
          }
        }
      }
    }
  } catch {
    // Directory read error, skip
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const projectDir = searchParams.get('directory');

    if (!projectDir) {
      return NextResponse.json({ error: 'Project directory required' }, { status: 400 });
    }

    // Verify directory exists
    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json({ error: 'Directory not found' }, { status: 404 });
    }

    const stats: FileStats = {
      totalFiles: 0,
      codeFiles: 0,
      totalLines: 0,
      codeLines: 0,
      testFiles: 0,
      byExtension: {},
      largestFiles: [],
    };

    await analyzeDirectory(projectDir, projectDir, stats);

    // Sort and limit largest files
    stats.largestFiles.sort((a, b) => b.lines - a.lines);
    stats.largestFiles = stats.largestFiles.slice(0, 10);

    // Sort extensions by line count
    const sortedExtensions = Object.entries(stats.byExtension)
      .sort((a, b) => b[1].lines - a[1].lines)
      .reduce((acc, [ext, data]) => {
        acc[ext] = data;
        return acc;
      }, {} as Record<string, { files: number; lines: number }>);
    stats.byExtension = sortedExtensions;

    return NextResponse.json({
      success: true,
      projectId,
      stats,
      summary: {
        filesCreated: stats.codeFiles,
        linesOfCode: stats.codeLines,
        testFiles: stats.testFiles,
        totalFiles: stats.totalFiles,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to analyze project';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
