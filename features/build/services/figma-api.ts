/**
 * Figma API Service
 *
 * Handles Figma design extraction, context saving, and frame downloads.
 * Used by both new Figma builds (from /) and Figma iterations (from /build).
 */

export interface IconInfo {
  id: string;
  name: string;
  fileName: string;
  svgUrl?: string;
  size: { width: number; height: number };
  category?: string;
  contextLabel?: string;
  contextPath?: string;
  isIllustration?: boolean;
  description?: string; // Human-readable description of what the icon visually shows
}

export interface FigmaDesignContext {
  name: string;
  description?: string;
  requirements?: string;
  sourceUrl?: string;
  figmaFileId?: string;
  figmaNodeId?: string;
  colors?: Record<string, string>;
  typography?: {
    headingFont?: string;
    bodyFont?: string;
    sizes?: string[];
  };
  components?: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  screens?: Array<{
    id: string;
    name: string;
    route?: string;
  }>;
  frameImages?: Record<string, string>;
  styleTokens?: Record<string, unknown>;
  icons?: IconInfo[];
  iconSvgUrls?: Record<string, string>;
}

export interface FigmaExtractionResult {
  success: boolean;
  designContext?: FigmaDesignContext;
  error?: string;
}

export interface FigmaSaveResult {
  success: boolean;
  savedTo?: string;
  error?: string;
}

export interface FigmaDownloadResult {
  success: boolean;
  downloadedCount: number;
  error?: string;
}

/**
 * Extract design context from a Figma URL
 */
export async function extractFigmaDesign(figmaUrl: string): Promise<FigmaExtractionResult> {
  try {
    const response = await fetch('/api/figma/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ figmaUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Failed to extract Figma design (${response.status})`,
      };
    }

    const data = await response.json();
    return {
      success: true,
      designContext: data.designContext,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error extracting Figma design',
    };
  }
}

/**
 * Save Figma design context to project directory
 * This is critical - agents read figma-context.json to get colors, typography, etc.
 */
export async function saveFigmaContext(
  projectId: string,
  designContext: FigmaDesignContext,
  projectDirectory?: string
): Promise<FigmaSaveResult> {
  try {
    const response = await fetch('/api/figma/save-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectDirectory, designContext }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || 'Failed to save Figma context',
      };
    }

    const data = await response.json();
    return {
      success: true,
      savedTo: data.savedTo,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error saving Figma context',
    };
  }
}

/**
 * Download Figma frame images and icons to project directory
 */
export async function downloadFigmaFrames(
  projectId: string,
  screens: FigmaDesignContext['screens'],
  frameImages: Record<string, string>,
  projectDirectory?: string,
  icons?: IconInfo[],
  iconSvgUrls?: Record<string, string>
): Promise<FigmaDownloadResult> {
  try {
    const response = await fetch('/api/figma/download-frames', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, projectDirectory, screens, frameImages, icons, iconSvgUrls }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        downloadedCount: 0,
        error: errorData.error || 'Failed to download frame images',
      };
    }

    const data = await response.json();
    return {
      success: true,
      downloadedCount: data.downloadedCount || 0,
    };
  } catch (err) {
    return {
      success: false,
      downloadedCount: 0,
      error: err instanceof Error ? err.message : 'Unknown error downloading frames',
    };
  }
}

/**
 * Full Figma setup for builds on existing projects
 * Extracts design, saves context, downloads frames
 */
export async function setupFigmaForBuild(
  projectId: string,
  figmaUrl: string,
  projectDirectory?: string
): Promise<{
  success: boolean;
  designContext?: FigmaDesignContext;
  error?: string;
}> {
  // Step 1: Extract design
  const extractResult = await extractFigmaDesign(figmaUrl);
  if (!extractResult.success || !extractResult.designContext) {
    return { success: false, error: extractResult.error };
  }

  const designContext = extractResult.designContext;

  // Step 2: Save context to project directory - THIS IS CRITICAL
  console.log('[Figma] Saving context to', projectDirectory);
  const saveResult = await saveFigmaContext(projectId, designContext, projectDirectory);
  if (!saveResult.success) {
    console.error('[Figma] FAILED to save context:', saveResult.error);
    // This IS fatal - PO needs figma-context.json to work
    return { success: false, error: `Failed to save Figma context: ${saveResult.error}` };
  }
  console.log('[Figma] Context saved to:', saveResult.savedTo);

  // Step 3: Download frame images and icons if available
  const hasFrames = designContext.frameImages && Object.keys(designContext.frameImages).length > 0;
  const hasIcons = designContext.icons && designContext.icons.length > 0;

  if (hasFrames || hasIcons) {
    console.log('[Figma] Downloading frames/icons...');
    const downloadResult = await downloadFigmaFrames(
      projectId,
      designContext.screens,
      designContext.frameImages || {},
      projectDirectory,
      designContext.icons,
      designContext.iconSvgUrls
    );
    if (!downloadResult.success) {
      console.error('[Figma] FAILED to download frames/icons:', downloadResult.error);
      // This IS fatal - PO needs reference images
      return { success: false, error: `Failed to download frames: ${downloadResult.error}` };
    }
    console.log('[Figma] Downloaded', downloadResult.downloadedCount, 'frames/icons');
  }

  return {
    success: true,
    designContext,
  };
}
