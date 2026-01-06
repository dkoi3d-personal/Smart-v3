/**
 * Platform Stats API - Aggregate stats across all projects
 *
 * GET /api/platform-stats - Get lifetime platform statistics
 */

import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getLearningStore } from '@/services/memory/learning-store';

interface ProjectData {
  projectId: string;
  projectDirectory?: string;
  status?: string;
  createdAt?: string;
  buildType?: string;
}

// File extensions to count as code
const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
  '.c', '.cpp', '.h', '.hpp', '.cs',
  '.php', '.swift', '.m', '.mm',
  '.vue', '.svelte', '.astro',
  '.css', '.scss', '.sass', '.less',
  '.html', '.htm',
  '.sql', '.graphql', '.prisma',
  '.sh', '.bash', '.zsh', '.fish',
]);

// Directories to skip
const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', 'dist', 'build', 'out',
  '.turbo', '.cache', 'coverage', '.nyc_output',
  '__pycache__', '.pytest_cache', 'venv', '.venv',
  'vendor', 'target', 'bin', 'obj',
  '.audit', '.architecture', 'figma-frames', 'backlog',
]);

// Files to skip
const SKIP_FILES = new Set([
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'figma-context.json', 'project-state.json', 'session-state.json',
  '.iteration-state.json', 'tasks.json',
]);

// Count individual test cases in a file
function countTestCases(content: string): number {
  let count = 0;

  // Match it(), test(), it.each(), test.each() - common test patterns
  const itMatches = content.match(/\bit\s*\(/g) || [];
  const testMatches = content.match(/\btest\s*\(/g) || [];
  const itEachMatches = content.match(/\bit\.each\s*\(/g) || [];
  const testEachMatches = content.match(/\btest\.each\s*\(/g) || [];

  count += itMatches.length;
  count += testMatches.length;
  count += itEachMatches.length;
  count += testEachMatches.length;

  return count;
}

async function countLinesInDirectory(dir: string): Promise<{ files: number; lines: number; tests: number }> {
  let files = 0;
  let lines = 0;
  let tests = 0;

  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const subStats = await countLinesInDirectory(fullPath);
        files += subStats.files;
        lines += subStats.lines;
        tests += subStats.tests;
      } else if (entry.isFile()) {
        if (SKIP_FILES.has(entry.name)) continue;

        const ext = path.extname(entry.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          files++;

          try {
            const content = await fs.readFile(fullPath, 'utf-8');
            lines += content.split('\n').length;

            // Check if test file and count individual test cases
            const isTestFile = entry.name.includes('.test.') ||
                               entry.name.includes('.spec.') ||
                               entry.name.includes('_test.') ||
                               fullPath.includes('__tests__') ||
                               fullPath.includes('/tests/') ||
                               fullPath.includes('\\tests\\');

            if (isTestFile) {
              tests += countTestCases(content);
            }
          } catch {
            // Skip unreadable files
          }
        }
      }
    }
  } catch {
    // Skip inaccessible directories
  }

  return { files, lines, tests };
}

export async function GET() {
  try {
    // Load projects
    const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
    let projects: ProjectData[] = [];

    try {
      const data = await fs.readFile(projectsPath, 'utf-8');
      projects = JSON.parse(data);
    } catch {
      // No projects file yet
    }

    // Calculate project stats
    const totalProjects = projects.length;
    const completedProjects = projects.filter(p => p.status === 'completed' || p.status === 'deployed').length;
    const activeProjects = projects.filter(p => ['building', 'planning', 'testing'].includes(p.status || '')).length;

    // Count code across all projects
    let totalFiles = 0;
    let totalLines = 0;
    let totalTests = 0;

    for (const project of projects) {
      if (project.projectDirectory) {
        try {
          await fs.access(project.projectDirectory);
          const stats = await countLinesInDirectory(project.projectDirectory);
          totalFiles += stats.files;
          totalLines += stats.lines;
          totalTests += stats.tests;
        } catch {
          // Project directory doesn't exist
        }
      }
    }

    // Get learnings stats
    let learningsCount = 0;
    try {
      const store = getLearningStore();
      const learningStats = store.getStats();
      learningsCount = learningStats.total || 0;
    } catch {
      // Learning store not available
    }

    // Calculate build types
    const buildTypes = {
      quick: projects.filter(p => p.buildType === 'quick').length,
      complex: projects.filter(p => p.buildType === 'complex').length,
      uat: projects.filter(p => p.buildType === 'uat').length,
    };

    // Get first project date for "since" calculation
    const sortedByDate = projects
      .filter(p => p.createdAt)
      .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
    const firstProjectDate = sortedByDate[0]?.createdAt;

    return NextResponse.json({
      success: true,
      stats: {
        // Main metrics
        totalProjects,
        completedProjects,
        activeProjects,
        totalLinesOfCode: totalLines,
        totalFiles,
        totalTests,
        learningsCount,

        // Breakdown
        buildTypes,

        // Meta
        firstProjectDate,
        calculatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to calculate platform stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to calculate stats',
      stats: {
        totalProjects: 0,
        completedProjects: 0,
        activeProjects: 0,
        totalLinesOfCode: 0,
        totalFiles: 0,
        totalTests: 0,
        learningsCount: 0,
        buildTypes: { quick: 0, complex: 0, uat: 0 },
      },
    });
  }
}
