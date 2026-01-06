/**
 * Project Path Resolver
 *
 * Resolves project paths from stored metadata or falls back to computed paths.
 * This supports custom project paths for cloned repositories.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { getProjectsBaseDir } from '@/lib/project-paths';

/**
 * Get the stored project directory from project metadata files
 */
export async function getStoredProjectPath(projectId: string): Promise<string | null> {
  try {
    // Try to read from the data/projects.json first
    const dataProjectsPath = path.join(process.cwd(), 'data', 'projects.json');
    try {
      const data = await fs.readFile(dataProjectsPath, 'utf-8');
      const projects = JSON.parse(data);
      const project = projects.find((p: any) => p.projectId === projectId);
      if (project?.projectDirectory) {
        return project.projectDirectory;
      }
    } catch {
      // data/projects.json doesn't exist, try projects/projects.json
    }

    // Fall back to projects/projects.json
    const projectsPath = path.join(process.cwd(), 'projects', 'projects.json');
    const data = await fs.readFile(projectsPath, 'utf-8');
    const projects = JSON.parse(data);
    const project = projects.find((p: any) => p.projectId === projectId);
    if (project?.projectDirectory) {
      return project.projectDirectory;
    }
  } catch {
    // No stored project data
  }
  return null;
}

/**
 * Get the project path (from stored metadata or computed default)
 * Priority:
 * 1. Explicitly provided path (if passed)
 * 2. Stored projectDirectory from project metadata
 * 3. Default computed path (getProjectsBaseDir + projectId)
 */
export async function resolveProjectPath(
  projectId: string,
  explicitPath?: string
): Promise<string> {
  if (explicitPath) {
    return explicitPath;
  }

  const storedPath = await getStoredProjectPath(projectId);
  if (storedPath) {
    return storedPath;
  }

  return path.join(getProjectsBaseDir(), projectId);
}

export default {
  getStoredProjectPath,
  resolveProjectPath,
};
