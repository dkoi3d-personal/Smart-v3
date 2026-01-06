import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { resolveProjectPath } from '@/lib/project-path-resolver';

/**
 * Tree node structure for file explorer
 */
interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: TreeNode[];
}

/**
 * Validate that a project ID doesn't contain dangerous characters
 */
function validateProjectId(projectId: string): { valid: boolean; error?: string } {
  if (projectId.includes('..')) {
    return { valid: false, error: 'Invalid project ID format' };
  }
  return { valid: true };
}

/**
 * Validate that a file path doesn't escape the project directory
 */
function validateFilePath(filePath: string): { valid: boolean; error?: string } {
  if (filePath.includes('..')) {
    return { valid: false, error: 'Invalid file path' };
  }
  return { valid: true };
}

/**
 * Get file tree or individual file content from a project directory
 *
 * Query params:
 * - path: If provided, returns the content of that specific file
 *         If not provided, returns the full file tree structure
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path');

    // Validate the project ID
    const validation = validateProjectId(projectId);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Resolve the project path (handles custom paths from cloned repos)
    const projectDir = await resolveProjectPath(projectId);

    // Check if project directory exists
    try {
      await fs.access(projectDir);
    } catch {
      console.log(`Project directory not found: ${projectDir}`);
      return NextResponse.json({ files: [], tree: [], projectDir });
    }

    // If a specific file path is requested, return its content
    if (filePath) {
      const pathValidation = validateFilePath(filePath);
      if (!pathValidation.valid) {
        return NextResponse.json(
          { error: pathValidation.error },
          { status: 400 }
        );
      }

      const fullPath = path.join(projectDir, filePath);

      // Security: Ensure the resolved path is still within the project directory
      const resolvedPath = path.resolve(fullPath);
      const resolvedProjectDir = path.resolve(projectDir);
      if (!resolvedPath.startsWith(resolvedProjectDir)) {
        return NextResponse.json(
          { error: 'Access denied' },
          { status: 403 }
        );
      }

      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const stat = await fs.stat(fullPath);
        return NextResponse.json({
          path: filePath,
          content,
          language: getLanguageFromExtension(path.extname(filePath).substring(1)),
          lastModified: stat.mtime,
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'File not found or unreadable' },
          { status: 404 }
        );
      }
    }

    // Otherwise, return the full file tree
    const tree = await buildFileTree(projectDir, projectDir);

    // Also return flat file list for backwards compatibility
    const files = await readDirRecursive(projectDir, projectDir);

    return NextResponse.json({ files, tree, projectDir });
  } catch (error) {
    console.error('Error reading project files:', error);
    return NextResponse.json(
      { error: 'Failed to read project files', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * Directories to skip when building file tree
 */
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
]);

/**
 * Dot files/folders that should be shown (not filtered out)
 */
const ALLOWED_DOT_FILES = new Set([
  '.env',
  '.env.local',
  '.env.development',
  '.env.production',
  '.env.example',
  '.env.test',
  '.gitignore',
  '.eslintrc',
  '.eslintrc.js',
  '.eslintrc.json',
  '.eslintrc.cjs',
  '.prettierrc',
  '.prettierrc.js',
  '.prettierrc.json',
  '.prettierignore',
  '.editorconfig',
  '.npmrc',
  '.nvmrc',
  '.dockerignore',
  '.babelrc',
  '.browserslistrc',
  '.build',
]);

/**
 * Build a tree structure of the directory
 */
async function buildFileTree(
  dirPath: string,
  basePath: string
): Promise<TreeNode[]> {
  const nodes: TreeNode[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    // Sort: directories first, then files, both alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    for (const entry of entries) {
      // Skip directories we don't want to traverse
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      // For dot files/folders, only show allowed ones
      if (entry.name.startsWith('.') && !ALLOWED_DOT_FILES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        const children = await buildFileTree(fullPath, basePath);
        // Only include directories that have children
        if (children.length > 0) {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'directory',
            children,
          });
        }
      } else {
        // Skip binary files and very large files
        try {
          const stat = await fs.stat(fullPath);
          // Skip files larger than 1MB
          if (stat.size > 1024 * 1024) {
            continue;
          }

          // Skip common binary extensions
          const ext = path.extname(entry.name).toLowerCase();
          if (['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.mp3', '.mp4', '.zip', '.tar', '.gz'].includes(ext)) {
            continue;
          }

          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
          });
        } catch {
          // Skip files we can't stat
        }
      }
    }
  } catch (error) {
    console.error('Error building file tree:', dirPath, error);
  }

  return nodes;
}

/**
 * Recursively read directory contents (flat list for backwards compatibility)
 */
async function readDirRecursive(
  dirPath: string,
  basePath: string
): Promise<any[]> {
  const files: any[] = [];

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip directories we don't want to traverse
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }

      // For dot files/folders, only show allowed ones
      if (entry.name.startsWith('.') && !ALLOWED_DOT_FILES.has(entry.name)) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await readDirRecursive(fullPath, basePath);
        files.push(...subFiles);
      } else {
        try {
          const stat = await fs.stat(fullPath);
          // Skip large files
          if (stat.size > 1024 * 1024) continue;

          const relativePath = path.relative(basePath, fullPath).replace(/\\/g, '/');
          const extension = path.extname(entry.name).substring(1);

          files.push({
            path: relativePath,
            language: getLanguageFromExtension(extension),
            modified: false,
            lastModified: stat.mtime,
            size: stat.size,
          });
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch (error) {
    console.error('Error reading directory:', dirPath, error);
  }

  return files;
}

/**
 * Get programming language from file extension
 */
function getLanguageFromExtension(ext: string): string {
  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    php: 'php',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'bash',
    txt: 'text',
    prisma: 'prisma',
    graphql: 'graphql',
    gql: 'graphql',
    env: 'dotenv',
  };

  return languageMap[ext.toLowerCase()] || 'text';
}
