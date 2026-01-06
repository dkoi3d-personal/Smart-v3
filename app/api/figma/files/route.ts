/**
 * Figma Files API
 *
 * Lists the user's Figma files and projects.
 *
 * Note: The Figma REST API doesn't have a "recent files" endpoint.
 * You must know team/project IDs to list files programmatically.
 * See: https://forum.figma.com/t/figma-oauth-api-list-all-files/39482
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFigmaToken } from '@/lib/figma/config-store';

export interface FigmaFile {
  key: string;
  name: string;
  thumbnail_url: string;
  last_modified: string;
}

export interface FigmaProject {
  id: string;
  name: string;
  files: FigmaFile[];
}

export interface FigmaTeam {
  id: string;
  name: string;
}

/**
 * GET /api/figma/files
 * List user's Figma files
 *
 * Query params:
 * - type: 'status' | 'team' | 'project'
 * - teamId: string (required if type=team)
 * - projectId: string (required if type=project)
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getFigmaToken();

    if (!token) {
      return NextResponse.json({
        error: 'Figma token not configured',
        settingsUrl: '/settings',
      }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'status';
    const teamId = searchParams.get('teamId');
    const projectId = searchParams.get('projectId');

    // Get user info first
    const meResponse = await fetch('https://api.figma.com/v1/me', {
      headers: { 'X-Figma-Token': token },
    });

    if (!meResponse.ok) {
      return NextResponse.json({
        error: 'Invalid Figma token',
      }, { status: 401 });
    }

    const meData = await meResponse.json();

    // If team ID provided, get projects for that team
    if (type === 'team' && teamId) {
      const projectsResponse = await fetch(`https://api.figma.com/v1/teams/${teamId}/projects`, {
        headers: { 'X-Figma-Token': token },
      });

      if (!projectsResponse.ok) {
        const errorData = await projectsResponse.json().catch(() => ({}));
        return NextResponse.json({
          error: errorData.message || 'Failed to fetch team projects. You may not have access to this team.',
          user: { email: meData.email, handle: meData.handle },
        }, { status: projectsResponse.status });
      }

      const projectsData = await projectsResponse.json();

      // Fetch files for each project
      const projectsWithFiles: FigmaProject[] = [];
      for (const project of (projectsData.projects || []).slice(0, 5)) {
        try {
          const filesResponse = await fetch(`https://api.figma.com/v1/projects/${project.id}/files`, {
            headers: { 'X-Figma-Token': token },
          });
          if (filesResponse.ok) {
            const filesData = await filesResponse.json();
            projectsWithFiles.push({
              id: project.id,
              name: project.name,
              files: filesData.files || [],
            });
          }
        } catch {
          // Skip projects we can't fetch
        }
      }

      // Flatten all files from all projects
      const allFiles: FigmaFile[] = projectsWithFiles.flatMap(p => p.files);

      return NextResponse.json({
        type: 'team',
        teamId,
        user: { email: meData.email, handle: meData.handle, img_url: meData.img_url },
        projects: projectsWithFiles,
        files: allFiles,
      });
    }

    // If project ID provided, get files for that project
    if (type === 'project' && projectId) {
      const projectResponse = await fetch(`https://api.figma.com/v1/projects/${projectId}/files`, {
        headers: { 'X-Figma-Token': token },
      });

      if (!projectResponse.ok) {
        const errorData = await projectResponse.json().catch(() => ({}));
        return NextResponse.json({
          error: errorData.message || 'Failed to fetch project files. You may not have access to this project.',
          user: { email: meData.email, handle: meData.handle },
        }, { status: projectResponse.status });
      }

      const projectData = await projectResponse.json();

      return NextResponse.json({
        type: 'project',
        projectId,
        user: { email: meData.email, handle: meData.handle, img_url: meData.img_url },
        files: projectData.files || [],
      });
    }

    // Default: Return user info and explain the API limitation
    // The Figma API doesn't support listing all user files directly
    return NextResponse.json({
      type: 'status',
      user: {
        email: meData.email,
        handle: meData.handle,
        img_url: meData.img_url,
      },
      files: [],
      message: 'Figma API limitation: Cannot list files without a team or project ID. Please paste a Figma URL directly.',
      help: 'To browse files, provide a teamId or projectId query parameter. You can find these in your Figma URLs.',
    });

  } catch (error) {
    console.error('Figma files error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch Figma files',
    }, { status: 500 });
  }
}
