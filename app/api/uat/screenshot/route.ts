import { NextRequest, NextResponse } from 'next/server';
import { resolveProjectPath } from '@/lib/project-path-resolver';
import * as fs from 'fs/promises';
import * as path from 'path';

// POST: Save a screenshot
export async function POST(request: NextRequest) {
  try {
    const { projectId, imageData, bugId, description } = await request.json();

    if (!projectId || !imageData) {
      return NextResponse.json({ error: 'Project ID and image data required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Create screenshots directory
    const screenshotsDir = path.join(projectDir, '.uat', 'screenshots');
    await fs.mkdir(screenshotsDir, { recursive: true });

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = bugId
      ? `bug-${bugId}-${timestamp}.png`
      : `screenshot-${timestamp}.png`;

    // Remove base64 header if present
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');

    // Save the image
    const filePath = path.join(screenshotsDir, filename);
    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));

    // Save metadata
    const metadataPath = path.join(screenshotsDir, 'screenshots.json');
    let metadata: any[] = [];
    try {
      const existing = await fs.readFile(metadataPath, 'utf-8');
      metadata = JSON.parse(existing);
    } catch {
      // No existing metadata
    }

    metadata.push({
      id: `ss-${Date.now()}`,
      filename,
      path: filePath,
      bugId,
      description,
      createdAt: new Date().toISOString(),
    });

    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return NextResponse.json({
      success: true,
      filename,
      path: filePath,
      message: 'Screenshot saved',
    });
  } catch (error) {
    console.error('Screenshot save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save screenshot' },
      { status: 500 }
    );
  }
}

// GET: List screenshots for a project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const bugId = searchParams.get('bugId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);
    const metadataPath = path.join(projectDir, '.uat', 'screenshots', 'screenshots.json');

    try {
      const content = await fs.readFile(metadataPath, 'utf-8');
      let screenshots = JSON.parse(content);

      // Filter by bugId if provided
      if (bugId) {
        screenshots = screenshots.filter((ss: any) => ss.bugId === bugId);
      }

      return NextResponse.json({
        success: true,
        screenshots,
      });
    } catch {
      return NextResponse.json({
        success: true,
        screenshots: [],
      });
    }
  } catch (error) {
    console.error('Screenshot list error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list screenshots' },
      { status: 500 }
    );
  }
}
