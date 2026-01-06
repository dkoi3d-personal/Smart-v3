/**
 * Project Scanner Service
 * Scans project directories and extracts file structure information
 */

import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

export interface FileInfo {
  path: string;
  type: 'file' | 'directory';
  size?: number;
  extension?: string;
}

export interface ProjectStructure {
  files: FileInfo[];
  summary: string;
  totalFiles: number;
  totalDirectories: number;
}

// Patterns to ignore when scanning
const IGNORE_PATTERNS = [
  'node_modules', '.git', '.next', 'dist', 'build',
  '.cache', 'coverage', '.turbo', '.vercel', '__pycache__',
  '.pytest_cache', 'venv', '.venv', 'env'
];

// Code file extensions we care about
const CODE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.py', '.go', '.rs'];

/**
 * Recursively scan a directory for files
 */
export async function scanDirectory(
  dir: string,
  baseDir: string,
  options: {
    depth?: number;
    maxDepth?: number;
    includeHidden?: boolean;
  } = {}
): Promise<FileInfo[]> {
  const { depth = 0, maxDepth = 4, includeHidden = false } = options;

  if (depth > maxDepth) return [];

  const files: FileInfo[] = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // Skip ignored patterns
      if (IGNORE_PATTERNS.includes(entry.name)) continue;

      // Skip hidden files unless explicitly included
      if (!includeHidden && entry.name.startsWith('.') && entry.name !== '.env.example') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        files.push({ path: relativePath, type: 'directory' });
        const subFiles = await scanDirectory(fullPath, baseDir, {
          depth: depth + 1,
          maxDepth,
          includeHidden,
        });
        files.push(...subFiles);
      } else {
        try {
          const stats = await stat(fullPath);
          const extension = path.extname(entry.name);
          files.push({
            path: relativePath,
            type: 'file',
            size: stats.size,
            extension,
          });
        } catch {
          files.push({
            path: relativePath,
            type: 'file',
            extension: path.extname(entry.name),
          });
        }
      }
    }
  } catch (error) {
    console.error(`[ProjectScanner] Error scanning ${dir}:`, error);
  }

  return files;
}

/**
 * Build a summary of the project structure
 */
export function buildStructureSummary(files: FileInfo[]): string {
  const filesByDir: Record<string, string[]> = {};

  for (const file of files.filter(f => f.type === 'file')) {
    const dir = path.dirname(file.path) || '.';
    if (!filesByDir[dir]) filesByDir[dir] = [];
    filesByDir[dir].push(path.basename(file.path));
  }

  let summary = 'Project Structure:\n';
  const sortedDirs = Object.keys(filesByDir).sort();

  for (const dir of sortedDirs) {
    const fileList = filesByDir[dir];
    if (fileList.length <= 5) {
      summary += `${dir}/: ${fileList.join(', ')}\n`;
    } else {
      summary += `${dir}/: ${fileList.slice(0, 5).join(', ')} (+${fileList.length - 5} more)\n`;
    }
  }

  return summary;
}

/**
 * Get full project structure with summary
 */
export async function getProjectStructure(
  projectDir: string,
  options?: { maxDepth?: number }
): Promise<ProjectStructure> {
  const files = await scanDirectory(projectDir, projectDir, options);
  const summary = buildStructureSummary(files);

  return {
    files,
    summary,
    totalFiles: files.filter(f => f.type === 'file').length,
    totalDirectories: files.filter(f => f.type === 'directory').length,
  };
}

/**
 * Find files matching specific patterns
 */
export function findFilesByPatterns(
  files: FileInfo[],
  patterns: string[]
): FileInfo[] {
  return files.filter(f => {
    if (f.type !== 'file') return false;
    const pathLower = f.path.toLowerCase();
    return patterns.some(pattern => pathLower.includes(pattern.toLowerCase()));
  });
}

/**
 * Read multiple files and return their contents
 */
export async function readFiles(
  projectDir: string,
  filePaths: string[],
  options: { maxFileSize?: number } = {}
): Promise<{ path: string; content: string }[]> {
  const { maxFileSize = 50000 } = options; // 50KB default
  const results: { path: string; content: string }[] = [];

  for (const filePath of filePaths) {
    try {
      const fullPath = path.join(projectDir, filePath);
      const stats = await stat(fullPath);

      if (stats.size > maxFileSize) {
        console.log(`[ProjectScanner] Skipping ${filePath} - too large (${stats.size} bytes)`);
        continue;
      }

      const content = await readFile(fullPath, 'utf-8');
      results.push({ path: filePath, content });
    } catch (error) {
      console.error(`[ProjectScanner] Error reading ${filePath}:`, error);
    }
  }

  return results;
}

/**
 * Check if a file is a code file based on extension
 */
export function isCodeFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return CODE_EXTENSIONS.includes(ext);
}
