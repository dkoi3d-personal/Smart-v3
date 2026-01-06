/**
 * Download Figma frame images AND icons to project directory
 *
 * Takes frame image URLs from the extract API and downloads them to figma-frames/
 * Takes icon SVG URLs and downloads them to figma-icons/
 */

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

interface ScreenData {
  id: string;
  name: string;
  imageUrl?: string;
}

interface IconData {
  id: string;
  name: string;
  fileName: string;
  svgUrl?: string;
  size: { width: number; height: number };
  category?: string;
  contextLabel?: string;  // Text label from parent/sibling (e.g., "Healthy Eating Plate")
  contextPath?: string;   // Path of ancestor containers
  isIllustration?: boolean; // true if larger than typical icon size (> 64px)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, projectDirectory, screens, frameImages, icons, iconSvgUrls } = body;

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

    // Create figma-frames directory
    const figmaFramesDir = path.join(projectDir, 'figma-frames');
    await fs.mkdir(figmaFramesDir, { recursive: true });

    const savedPaths: Record<string, string> = {};
    let downloadedCount = 0;

    console.log(`[Figma Download] Starting download of ${Object.keys(frameImages || {}).length} frames to ${figmaFramesDir}`);

    // Sanitize filename: remove special chars, replace spaces with dashes, clean up
    const sanitizeFileName = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[\/\\:*?"<>|]/g, '') // Remove invalid filename chars
        .replace(/\s+/g, '-')           // Replace spaces with dashes
        .replace(/-+/g, '-')            // Collapse multiple dashes
        .replace(/^-|-$/g, '')          // Remove leading/trailing dashes
        || 'untitled';                  // Fallback if empty
    };

    // Download each frame image
    for (const [frameId, imageUrl] of Object.entries(frameImages || {})) {
      if (!imageUrl || typeof imageUrl !== 'string') continue;

      try {
        // Find screen name for this frame
        const screen = (screens as ScreenData[])?.find(s => s.id === frameId);
        const baseName = screen ? sanitizeFileName(screen.name) : `frame-${frameId.replace(':', '-')}`;
        const fileName = `${baseName}.png`;

        const filePath = path.join(figmaFramesDir, fileName);

        // Download image
        const response = await fetch(imageUrl);
        if (!response.ok) {
          console.error(`[Figma Download] Failed to download ${frameId}: ${response.status}`);
          continue;
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        await fs.writeFile(filePath, buffer);

        savedPaths[frameId] = `figma-frames/${fileName}`;
        downloadedCount++;
        console.log(`[Figma Download] Saved: ${fileName}`);
      } catch (error) {
        console.error(`[Figma Download] Error downloading ${frameId}:`, error);
      }
    }

    console.log(`[Figma Download] Complete: ${downloadedCount} frame images saved`);

    // Download icons as SVG to public/figma-icons so Next.js can serve them
    let iconDownloadedCount = 0;
    const savedIconPaths: Record<string, string> = {};

    if (icons && Array.isArray(icons) && icons.length > 0) {
      // IMPORTANT: Save to public/figma-icons so Next.js serves them at /figma-icons/*
      const figmaIconsDir = path.join(projectDir, 'public', 'figma-icons');
      await fs.mkdir(figmaIconsDir, { recursive: true });

      console.log(`[Figma Download] Starting download of ${icons.length} icons to ${figmaIconsDir}`);

      for (const icon of icons as IconData[]) {
        // Get URL from iconSvgUrls map or from icon itself
        const imageUrl = iconSvgUrls?.[icon.id] || icon.svgUrl;
        if (!imageUrl) continue;

        try {
          const filePath = path.join(figmaIconsDir, icon.fileName);
          const isPng = icon.fileName.toLowerCase().endsWith('.png');

          // Download the image
          const response = await fetch(imageUrl);
          if (!response.ok) {
            console.error(`[Figma Download] Failed to download icon ${icon.name}: ${response.status}`);
            continue;
          }

          if (isPng) {
            // PNG files are binary - use arrayBuffer
            const buffer = Buffer.from(await response.arrayBuffer());
            await fs.writeFile(filePath, buffer);
          } else {
            // SVG files are text - use text()
            const svgContent = await response.text();
            await fs.writeFile(filePath, svgContent, 'utf-8');
          }

          savedIconPaths[icon.id] = `figma-icons/${icon.fileName}`;
          iconDownloadedCount++;
        } catch (error) {
          console.error(`[Figma Download] Error downloading icon ${icon.name}:`, error);
        }
      }

      // Create icon manifest for easy reference with context mappings
      const savedIcons = (icons as IconData[]).filter(i => savedIconPaths[i.id]);
      const illustrationCount = savedIcons.filter(i => i.isIllustration).length;
      const iconManifest = {
        generatedAt: new Date().toISOString(),
        iconCount: iconDownloadedCount - illustrationCount,
        illustrationCount: illustrationCount,
        description: 'Icons and illustrations extracted from Figma. Icons are small UI elements (8-64px). Illustrations are larger card/feature images (64-200px). Use contextLabel to find the right asset for each component.',
        icons: savedIcons.map(icon => ({
          name: icon.name,
          fileName: icon.fileName,
          path: savedIconPaths[icon.id],
          size: icon.size,
          category: icon.category,
          contextLabel: icon.contextLabel,  // The component/card this icon belongs to
          contextPath: icon.contextPath,    // Full path for disambiguation
          isIllustration: icon.isIllustration || false,
        })),
        // Create a quick lookup map: contextLabel -> fileName
        contextToIcon: Object.fromEntries(
          savedIcons
            .filter(i => i.contextLabel)
            .map(icon => [icon.contextLabel, icon.fileName])
        ),
      };
      await fs.writeFile(
        path.join(figmaIconsDir, 'icon-manifest.json'),
        JSON.stringify(iconManifest, null, 2)
      );

      console.log(`[Figma Download] Complete: ${iconDownloadedCount} icons saved`);
    }

    return NextResponse.json({
      success: true,
      downloadedCount,
      iconDownloadedCount,
      savedPaths,
      savedIconPaths,
      directory: figmaFramesDir,
    });

  } catch (error) {
    console.error('[Figma Download] Error:', error);
    return NextResponse.json({
      error: 'Failed to download frame images',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
