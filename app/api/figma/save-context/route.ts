/**
 * Save Figma design context to project directory
 *
 * This saves the extracted Figma context so agents can read it during builds.
 * Without this, agents don't get access to colors, typography, components, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, projectDirectory, designContext } = body;

    if (!designContext) {
      return NextResponse.json({ error: 'designContext is required' }, { status: 400 });
    }

    // Accept projectDirectory directly (for iterations) OR look up from projects.json
    let projectDir: string | null = projectDirectory || null;

    if (!projectDir && projectId) {
      // Fallback: Get project directory from projects.json
      const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
      try {
        const projectsData = await fs.readFile(projectsPath, 'utf-8');
        const projects = JSON.parse(projectsData);
        const project = projects.projects?.find((p: any) => p.projectId === projectId);
        projectDir = project?.projectDirectory;
      } catch {
        // Projects file doesn't exist or is invalid
      }
    }

    if (!projectDir) {
      return NextResponse.json({ error: 'Project directory not found. Provide projectDirectory or valid projectId.' }, { status: 404 });
    }

    // Split large context to keep files under 256KB (Claude CLI Read tool limit)
    const screens = designContext.screens || [];
    const screensSize = JSON.stringify(screens).length;

    // Save screens separately if they're large (>50KB)
    if (screensSize > 50000) {
      const screensPath = path.join(projectDir, 'figma-screens.json');
      await fs.writeFile(screensPath, JSON.stringify({
        description: 'Detailed screen data extracted from Figma. Referenced by figma-context.json.',
        screenCount: screens.length,
        screens,
      }, null, 2));
      console.log(`[Figma] Saved ${screens.length} screens to ${screensPath} (${Math.round(screensSize / 1024)}KB)`);

      // Replace screens array with summary in main context
      designContext.screens = screens.map((s: any) => ({
        id: s.id,
        name: s.name,
        route: s.route,
        isAuth: s.isAuth,
        hasTable: s.hasTable,
        hasList: s.hasList,
        hasForm: s.hasForm,
        inferredActions: s.inferredActions,
        // Note: full details in figma-screens.json
      }));
      designContext._screensFile = 'figma-screens.json';
    }

    // Save figma-context.json - this is what agents read
    const figmaContextPath = path.join(projectDir, 'figma-context.json');
    await fs.writeFile(figmaContextPath, JSON.stringify(designContext, null, 2));

    const contextSize = JSON.stringify(designContext).length;
    console.log(`[Figma] Saved design context to ${figmaContextPath} (${Math.round(contextSize / 1024)}KB)`);

    // Also update project.json with Figma info if it exists
    try {
      const projectJsonPath = path.join(projectDir, 'project.json');
      let projectJson: any = {};

      try {
        const existingData = await fs.readFile(projectJsonPath, 'utf-8');
        projectJson = JSON.parse(existingData);
      } catch {
        // project.json doesn't exist, create new
        projectJson = { projectId };
      }

      // Add/update Figma fields
      projectJson.figmaContext = designContext;
      projectJson.source = 'figma';
      projectJson.figmaUrl = designContext.figmaUrl || projectJson.figmaUrl;
      projectJson.figmaFileId = designContext.figmaFileId || projectJson.figmaFileId;
      projectJson.figmaNodeId = designContext.figmaNodeId || projectJson.figmaNodeId;
      projectJson.updatedAt = new Date().toISOString();

      await fs.writeFile(projectJsonPath, JSON.stringify(projectJson, null, 2));
      console.log(`[Figma] Updated project.json with Figma context`);
    } catch (projectJsonError) {
      console.warn(`[Figma] Could not update project.json:`, projectJsonError);
      // Non-fatal - figma-context.json is the main file agents read
    }

    return NextResponse.json({
      success: true,
      savedTo: figmaContextPath,
    });

  } catch (error) {
    console.error('[Figma] Error saving context:', error);
    return NextResponse.json({
      error: 'Failed to save Figma context',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
