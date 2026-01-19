/**
 * Figma Design Extraction API - Complete Visual + Workflow Extraction
 *
 * Extracts EVERYTHING needed to build pixel-perfect UI:
 * - Frame images (PNG exports of each screen)
 * - Detailed style tokens (colors, typography, spacing, effects)
 * - Screen structure and workflow
 * - UI patterns and CRUD actions
 * - Data model inference
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFigmaToken } from '@/lib/figma/config-store';

// ============================================================================
// Types
// ============================================================================

interface StyleToken {
  colors: Record<string, string>;
  typography: {
    fonts: string[];
    sizes: Record<string, { size: string; lineHeight: string; weight: number }>;
  };
  spacing: string[];
  borderRadius: string[];
  shadows: string[];
  borders: string[];
}

interface ScreenAnalysis {
  id: string;
  name: string;
  route: string;
  isAuth: boolean;
  hasTable: boolean;
  hasList: boolean;
  hasForm: boolean;
  buttons: string[];
  inputFields: string[];
  textContent: string[];
  navigatesTo: string[];
  sharedComponents: string[];
  inferredActions: ('CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'SUBMIT')[];
  // Visual data
  imageUrl?: string;
  dimensions?: { width: number; height: number };
  styles?: Partial<StyleToken>;
}

interface DataEntity {
  name: string;
  fields: string[];
  relationships?: string[];
}

interface IconInfo {
  id: string;
  name: string;
  fileName: string;  // Sanitized filename (e.g., "icon-home.svg" or "illustration-healthy-plate.png")
  svgUrl?: string;   // Figma CDN URL for SVG or PNG
  size: { width: number; height: number };
  category?: string; // Extracted from parent name if available
  contextLabel?: string; // Text label from parent/sibling nodes (e.g., "Healthy Eating Plate")
  contextPath?: string;  // Full path of parent containers (e.g., "Learn Tab > Resources > Healthy Eating Card")
  isIllustration?: boolean; // true if larger than typical icon size (> 64px)
  imageRef?: string; // Figma imageRef for IMAGE fills - indicates this needs PNG export, not SVG
  description?: string; // Human-readable description of what this icon visually shows (IMPORTANT for PO/coders to understand icon content)
}

interface FigmaDesignContext {
  name: string;
  description: string;
  layout: {
    type: string;
    structure: string[];
    responsive: boolean;
  };
  colors: Record<string, string | undefined>;
  typography: {
    headingFont?: string;
    bodyFont?: string;
    sizes: string[];
  };
  components: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  // Enhanced workflow data
  screens: ScreenAnalysis[];
  authFlow: string[];
  mainWorkflow: string[];
  sharedNavigation: string[];
  dataModel: Record<string, DataEntity>;
  // Visual design data
  styleTokens: StyleToken;
  frameImages: Record<string, string>; // frameId -> imageUrl
  icons: IconInfo[];                   // Extracted icons as SVG
  iconSvgUrls: Record<string, string>; // iconId -> svgUrl
  requirements: string;
}

// ============================================================================
// URL Parsing
// ============================================================================

function parseFigmaUrl(url: string): { fileId: string; nodeId?: string } | null {
  try {
    const urlObj = new URL(url);
    const pathMatch = urlObj.pathname.match(/\/(file|design)\/([a-zA-Z0-9]+)/);
    if (!pathMatch) return null;

    const fileId = pathMatch[2];
    const rawNodeId = urlObj.searchParams.get('node-id');
    const nodeId = rawNodeId ? rawNodeId.replace(/-/g, ':') : undefined;

    return { fileId, nodeId };
  } catch {
    return null;
  }
}

/**
 * Sanitize a string for use as a filename
 * Removes invalid chars, replaces spaces with dashes, cleans up
 */
function sanitizeFileName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\/\\:*?"<>|]/g, '') // Remove invalid filename chars
    .replace(/\s+/g, '-')           // Replace spaces with dashes
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .replace(/^-|-$/g, '')          // Remove leading/trailing dashes
    || 'untitled';                  // Fallback if empty
}

// ============================================================================
// Image Export - Get PNG URLs for each frame
// ============================================================================

async function exportFrameImages(
  fileId: string,
  frameIds: string[],
  token: string
): Promise<Record<string, string>> {
  if (frameIds.length === 0) return {};

  const allImages: Record<string, string> = {};
  const BATCH_SIZE = 50; // Figma API can handle ~50 IDs per request safely

  console.log(`[Figma] Exporting ${frameIds.length} frame images in batches of ${BATCH_SIZE}...`);

  // Process in batches to avoid 414 URI Too Long errors
  for (let i = 0; i < frameIds.length; i += BATCH_SIZE) {
    const batch = frameIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(frameIds.length / BATCH_SIZE);

    try {
      const idsParam = batch.join(',');
      const imageApiUrl = `https://api.figma.com/v1/images/${fileId}?ids=${encodeURIComponent(idsParam)}&format=png&scale=2`;

      console.log(`[Figma] Batch ${batchNum}/${totalBatches}: ${batch.length} frames...`);

      const response = await fetch(imageApiUrl, {
        headers: { 'X-Figma-Token': token },
      });

      if (!response.ok) {
        console.error(`[Figma] Batch ${batchNum} failed:`, response.status);
        continue; // Continue with other batches
      }

      const data = await response.json();

      if (data.err) {
        console.error(`[Figma] Batch ${batchNum} error:`, data.err);
        continue;
      }

      // Merge batch results
      Object.assign(allImages, data.images || {});
    } catch (error) {
      console.error(`[Figma] Batch ${batchNum} error:`, error);
      continue;
    }
  }

  console.log(`[Figma] Got ${Object.keys(allImages).length} image URLs total`);
  return allImages;
}

// ============================================================================
// Icon Detection and Export - With Context Mapping
// ============================================================================

/**
 * Extract text content from a node and its children (for context detection)
 */
function extractTextFromNode(node: Record<string, unknown>, maxDepth = 3, currentDepth = 0): string[] {
  if (currentDepth > maxDepth) return [];

  const texts: string[] = [];
  const nodeType = node.type as string;

  if (nodeType === 'TEXT' && node.characters) {
    const text = (node.characters as string).trim();
    // Only include meaningful text (not single chars, not too long)
    if (text.length > 2 && text.length < 100) {
      texts.push(text);
    }
  }

  const children = node.children as Record<string, unknown>[] | undefined;
  if (children && Array.isArray(children)) {
    for (const child of children) {
      texts.push(...extractTextFromNode(child, maxDepth, currentDepth + 1));
    }
  }

  return texts;
}

/**
 * Find the best context label for an icon by looking at sibling and parent text nodes
 */
function findIconContext(
  parentNode: Record<string, unknown> | null,
  iconNode: Record<string, unknown>,
  ancestorPath: string[]
): { label: string | undefined; path: string } {
  const path = ancestorPath.join(' > ');

  if (!parentNode) {
    return { label: undefined, path };
  }

  const siblings = parentNode.children as Record<string, unknown>[] | undefined;
  if (!siblings) {
    return { label: undefined, path };
  }

  // First, look for TEXT nodes that are siblings of the icon
  const siblingTexts: string[] = [];
  for (const sibling of siblings) {
    if (sibling.id === iconNode.id) continue; // Skip the icon itself
    const texts = extractTextFromNode(sibling, 2);
    siblingTexts.push(...texts);
  }

  // Find the best label - prefer shorter, title-like text
  let bestLabel: string | undefined;
  for (const text of siblingTexts) {
    // Skip very generic text
    const lower = text.toLowerCase();
    if (lower === 'view' || lower === 'more' || lower === 'see all' || lower === 'learn more') continue;

    // Prefer text that looks like a title (starts with capital, reasonable length)
    if (!bestLabel || (text.length < bestLabel.length && text.length >= 3)) {
      bestLabel = text;
    }
  }

  // If no sibling text found, try to extract context from parent name
  if (!bestLabel) {
    const parentName = parentNode.name as string;
    if (parentName) {
      const cleanParentName = parentName
        .replace(/[-_]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      // Use parent name if it's meaningful (not generic like "Frame", "Group", "Container")
      const genericNames = ['frame', 'group', 'container', 'wrapper', 'box', 'row', 'column', 'stack', 'view'];
      if (!genericNames.includes(cleanParentName.toLowerCase())) {
        bestLabel = cleanParentName;
      }
    }
  }

  return { label: bestLabel, path };
}

/**
 * Generate a semantic filename from the icon's actual name (prioritized) and context
 * IMPORTANT: We now prioritize the actual Figma node name over context path to avoid misleading filenames
 */
function generateSemanticFileName(contextLabel: string | undefined, nodeName: string, nodeId: string, contextPath?: string): string {
  // First, try to use the actual node name (most accurate representation of what the icon IS)
  // This fixes issues like "Apple" icon being named "illustration-ios-learn-tab-program-overview.svg"
  const cleanNodeName = nodeName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  // Check if node name is meaningful (not generic like "vector", "group", "frame", etc.)
  const genericNames = ['vector', 'group', 'frame', 'rectangle', 'ellipse', 'path', 'shape', 'icon', 'instance', 'component', 'mask', 'clip'];
  const isGenericNodeName = genericNames.some(g => cleanNodeName === g || cleanNodeName.startsWith(`${g}-`));

  if (cleanNodeName.length >= 2 && !isGenericNodeName) {
    // Use actual node name - this is what the icon ACTUALLY shows
    return cleanNodeName.startsWith('icon') ? `${cleanNodeName}.svg` : `icon-${cleanNodeName}.svg`;
  }

  // Fallback: If node name is generic, try context label
  if (contextLabel) {
    const cleanContext = contextLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);

    if (cleanContext.length >= 3) {
      return `icon-${cleanContext}.svg`;
    }
  }

  // Last resort: use node ID
  return `icon-${nodeId.replace(':', '-')}.svg`;
}

/**
 * Generate a human-readable description of what an icon visually shows
 * This helps PO/coders understand icon content without having to view each image
 */
function generateIconDescription(nodeName: string, contextLabel?: string, contextPath?: string, isIllustration?: boolean): string {
  const type = isIllustration ? 'Illustration' : 'Icon';

  // Clean up the node name for readability
  const cleanName = nodeName
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Build description parts
  const parts: string[] = [];

  // Add the actual visual content (what the icon SHOWS)
  parts.push(`${type} showing: "${cleanName}"`);

  // Add context if different from name and meaningful
  if (contextLabel && contextLabel.toLowerCase() !== cleanName.toLowerCase()) {
    parts.push(`Label: "${contextLabel}"`);
  }

  // Add location context
  if (contextPath) {
    parts.push(`Location: ${contextPath}`);
  }

  return parts.join(' | ');
}

/**
 * Detect icons in the Figma node tree with context mapping
 * Icons are identified by:
 * - VECTOR nodes (pure vector graphics)
 * - Small INSTANCE or COMPONENT nodes (< 64x64)
 * - Nodes with names containing "icon", "Icon", "ico-", "ic_"
 * - Nodes inside containers named "Icons", "Iconography", etc.
 *
 * Context is captured by:
 * - Looking at sibling TEXT nodes
 * - Extracting text from parent container
 * - Building a path of ancestor node names
 */
function detectIcons(
  node: Record<string, unknown>,
  icons: IconInfo[],
  parentCategory?: string,
  depth = 0,
  maxDepth = 15,
  parentNode: Record<string, unknown> | null = null,
  ancestorPath: string[] = [],
  debugStats?: { nodesChecked: number; vectorNodes: number; instanceNodes: number; imageFills: number; potentialIcons: number }
): void {
  if (depth > maxDepth) return;

  const nodeType = node.type as string;
  const nodeName = (node.name as string) || '';
  const nodeId = node.id as string;
  const bounds = node.absoluteBoundingBox as { width?: number; height?: number; x?: number; y?: number } | undefined;

  // Track debug stats
  if (debugStats) {
    debugStats.nodesChecked++;
    if (nodeType === 'VECTOR' || nodeType === 'BOOLEAN_OPERATION') debugStats.vectorNodes++;
    if (nodeType === 'INSTANCE' || nodeType === 'COMPONENT') debugStats.instanceNodes++;
    // Check for image fills
    const nodeFills = node.fills as Array<{ type?: string }> | undefined;
    if (nodeFills && Array.isArray(nodeFills) && nodeFills.some(f => f.type === 'IMAGE')) {
      debugStats.imageFills++;
    }
  }

  // Build ancestor path for context (skip generic names)
  const genericNames = ['frame', 'group', 'container', 'wrapper', 'box', 'row', 'column', 'stack', 'view', 'component', 'instance'];
  const isGenericName = genericNames.includes(nodeName.toLowerCase().split(/[\s_-]/)[0]);
  const currentPath = isGenericName ? ancestorPath : [...ancestorPath, nodeName].slice(-5); // Keep last 5 meaningful ancestors

  // Check if this container suggests icons
  const lowerName = nodeName.toLowerCase();
  const isIconContainer = lowerName.includes('icon') ||
                          lowerName.includes('iconography') ||
                          lowerName === 'icons';

  // Determine category from parent or current container
  const category = isIconContainer ? nodeName : parentCategory;

  // Check if this node is an icon or illustration
  // Includes: icon, ic_, ic-, ico-, ico_, io_, fi_ (Feather icons), fa- (FontAwesome), mdi- (Material Design Icons)
  const isIconByName = lowerName.includes('icon') ||
                       lowerName.startsWith('ic_') ||
                       lowerName.startsWith('ic-') ||
                       lowerName.startsWith('ico-') ||
                       lowerName.startsWith('ico_') ||
                       lowerName.startsWith('io_') ||
                       lowerName.startsWith('io-') ||
                       lowerName.startsWith('fi_') ||
                       lowerName.startsWith('fi-') ||
                       lowerName.startsWith('fa-') ||
                       lowerName.startsWith('fa_') ||
                       lowerName.startsWith('mdi-') ||
                       lowerName.startsWith('mdi_');

  // Check if named like an illustration (img, image, illustration, graphic, card image, clippath, etc.)
  const isIllustrationByName = lowerName.includes('illustration') ||
                               lowerName.includes('img') ||
                               lowerName.includes('image') ||
                               lowerName.includes('graphic') ||
                               lowerName.includes('picture') ||
                               lowerName.includes('artwork') ||
                               lowerName.includes('asset') ||
                               lowerName.includes('visual') ||
                               lowerName.includes('plate') ||
                               lowerName.includes('diagram') ||
                               lowerName.includes('clippath') ||
                               lowerName.includes('clip-path') ||
                               lowerName.includes('clip_path') ||
                               lowerName.includes('mask');

  // Icon size: 8-64px (typical UI icons)
  const isIconSize = bounds && bounds.width && bounds.height &&
                     bounds.width <= 64 && bounds.height <= 64 &&
                     bounds.width >= 8 && bounds.height >= 8;

  // Illustration size: 64-400px (card illustrations, decorative graphics, larger assets)
  const isIllustrationSize = bounds && bounds.width && bounds.height &&
                             ((bounds.width > 64 && bounds.width <= 400) ||
                              (bounds.height > 64 && bounds.height <= 400)) &&
                             bounds.width >= 16 && bounds.height >= 16;

  // Larger tolerance for IMAGE fills (photos can be bigger in cards)
  const isImageIllustrationSize = bounds && bounds.width && bounds.height &&
                                  ((bounds.width > 40 && bounds.width <= 600) ||
                                   (bounds.height > 40 && bounds.height <= 600)) &&
                                  bounds.width >= 16 && bounds.height >= 16;

  const isVectorType = nodeType === 'VECTOR' || nodeType === 'BOOLEAN_OPERATION';
  const isComponentType = nodeType === 'INSTANCE' || nodeType === 'COMPONENT';
  const isGroupType = nodeType === 'GROUP' || nodeType === 'FRAME';
  const isRectangleType = nodeType === 'RECTANGLE' || nodeType === 'ELLIPSE';

  // Check if node has image fill (common for illustrations pasted as images)
  const fills = node.fills as Array<{ type?: string; imageRef?: string }> | undefined;
  const hasImageFill = fills && Array.isArray(fills) && fills.some(f => f.type === 'IMAGE' && f.imageRef);
  const imageRef = hasImageFill ? fills?.find(f => f.type === 'IMAGE' && f.imageRef)?.imageRef : undefined;

  // Identify as icon if:
  // 1. It's a VECTOR type and icon-sized
  // 2. It's named like an icon AND is a vector/component/group/frame
  // 3. It's inside an icon container AND is icon-sized
  const isIcon = (isVectorType && isIconSize) ||
                 (isIconByName && (isVectorType || isComponentType || isGroupType)) ||
                 (parentCategory && isIconSize && (isVectorType || isComponentType));

  // Check if name suggests a card or feature image container
  const isCardImageByName = lowerName.includes('card') ||
                            lowerName.includes('feature') ||
                            lowerName.includes('resource') ||
                            lowerName.includes('thumbnail') ||
                            lowerName.includes('hero') ||
                            lowerName.includes('food') ||
                            lowerName.includes('meal') ||
                            lowerName.includes('recipe') ||
                            lowerName.includes('photo') ||
                            lowerName.includes('banner') ||
                            lowerName.includes('program') ||
                            lowerName.includes('library') ||
                            lowerName.includes('tutorial') ||
                            lowerName.includes('mission') ||
                            lowerName.includes('overview');

  // Identify as illustration if:
  // 1. It's named like an illustration AND is illustration-sized
  // 2. It's a component/group that's illustration-sized (and not icon-named)
  // 3. It's a FRAME/GROUP named like a card image and is illustration-sized
  // 4. It has an image fill (photo) and is image-illustration-sized (larger tolerance for photos)
  // 5. It's a VECTOR at illustration size (larger vector graphics like 120x120 icons)
  const isIllustration = (isIllustrationByName && isIllustrationSize && (isVectorType || isComponentType || isGroupType)) ||
                         (isIllustrationSize && isComponentType && !isIconByName) ||
                         (isIllustrationSize && isGroupType && (isIllustrationByName || isCardImageByName)) ||
                         (hasImageFill && isImageIllustrationSize) ||
                         (isVectorType && isIllustrationSize);

  if ((isIcon || isIllustration) && bounds) {
    if (debugStats) debugStats.potentialIcons++;
    // Find context from parent/sibling nodes
    const { label: contextLabel, path: contextPath } = findIconContext(parentNode, node, currentPath);

    // Generate semantic filename based on ACTUAL icon name (prioritized) and context
    // This fixes the bug where "Apple" icon was named "illustration-ios-learn-tab-program-overview.svg"
    let fileName = generateSemanticFileName(contextLabel, nodeName, nodeId, contextPath);

    // Ensure correct prefix for illustrations
    if (isIllustration && fileName.startsWith('icon-')) {
      fileName = fileName.replace('icon-', 'illustration-');
    } else if (isIllustration && !fileName.startsWith('illustration-')) {
      fileName = `illustration-${fileName.replace(/^(icon-|illustration-)/, '')}`;
    }

    // Generate human-readable description
    // This is CRITICAL for PO/coders to understand what the icon actually shows
    const description = generateIconDescription(nodeName, contextLabel, contextPath, isIllustration);

    // Avoid duplicates (by ID and by filename to prevent overwrites)
    const existingById = icons.find(i => i.id === nodeId);
    const existingByName = icons.find(i => i.fileName === fileName);

    if (!existingById) {
      // If filename already exists, make it unique
      let finalFileName = fileName;

      // Use .png extension for IMAGE fills (photos), .svg for vectors
      const extension = hasImageFill ? '.png' : '.svg';
      finalFileName = finalFileName.replace('.svg', extension);

      if (existingByName) {
        const base = finalFileName.replace(extension, '');
        finalFileName = `${base}-${nodeId.replace(':', '-').slice(0, 8)}${extension}`;
      }

      icons.push({
        id: nodeId,
        name: nodeName,
        fileName: finalFileName,
        size: {
          width: Math.round(bounds.width || 24),
          height: Math.round(bounds.height || 24)
        },
        category: category || undefined,
        contextLabel,
        contextPath: contextPath || undefined,
        isIllustration: isIllustration || undefined,
        imageRef: imageRef || undefined,
        // NEW: Include human-readable description to help PO/coders understand icon content
        description,
      });
    }
  }

  // Recurse into children
  const children = node.children as Record<string, unknown>[] | undefined;
  if (children && Array.isArray(children)) {
    for (const child of children) {
      detectIcons(child, icons, category, depth + 1, maxDepth, node, currentPath, debugStats);
    }
  }
}

/**
 * Export icons/illustrations via Figma API
 * @param format - 'svg' for vector graphics, 'png' for photos/images
 */
async function exportIconImages(
  fileId: string,
  iconIds: string[],
  token: string,
  format: 'svg' | 'png' = 'svg'
): Promise<Record<string, string>> {
  if (iconIds.length === 0) return {};

  const allImages: Record<string, string> = {};
  const BATCH_SIZE = 50;

  console.log(`[Figma] Exporting ${iconIds.length} icons as ${format.toUpperCase()} in batches of ${BATCH_SIZE}...`);

  for (let i = 0; i < iconIds.length; i += BATCH_SIZE) {
    const batch = iconIds.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(iconIds.length / BATCH_SIZE);

    try {
      const idsParam = batch.join(',');
      // Export as specified format (svg or png)
      // For PNG, use scale=2 for retina quality
      const scaleParam = format === 'png' ? '&scale=2' : '';
      const apiUrl = `https://api.figma.com/v1/images/${fileId}?ids=${encodeURIComponent(idsParam)}&format=${format}${scaleParam}`;

      console.log(`[Figma] ${format.toUpperCase()} batch ${batchNum}/${totalBatches}: ${batch.length} icons...`);

      const response = await fetch(apiUrl, {
        headers: { 'X-Figma-Token': token },
      });

      if (!response.ok) {
        console.error(`[Figma] ${format.toUpperCase()} batch ${batchNum} failed:`, response.status);
        continue;
      }

      const data = await response.json();

      if (data.err) {
        console.error(`[Figma] ${format.toUpperCase()} batch ${batchNum} error:`, data.err);
        continue;
      }

      Object.assign(allImages, data.images || {});
    } catch (error) {
      console.error(`[Figma] ${format.toUpperCase()} batch ${batchNum} error:`, error);
      continue;
    }
  }

  console.log(`[Figma] Got ${Object.keys(allImages).length} ${format.toUpperCase()} URLs`);
  return allImages;
}

// Backwards compatible wrapper
async function exportIconSvgs(
  fileId: string,
  iconIds: string[],
  token: string
): Promise<Record<string, string>> {
  return exportIconImages(fileId, iconIds, token, 'svg');
}

// ============================================================================
// Detailed Style Extraction
// ============================================================================

function rgbaToHex(r: number, g: number, b: number, a?: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 1) {
    return `${hex}${toHex(a)}`;
  }
  return hex;
}

function extractDetailedStyles(node: Record<string, unknown>): StyleToken {
  const colors: Record<string, string> = {};
  const fonts = new Set<string>();
  const sizes: Record<string, { size: string; lineHeight: string; weight: number }> = {};
  const spacingSet = new Set<string>();
  const radiusSet = new Set<string>();
  const shadowSet = new Set<string>();
  const borderSet = new Set<string>();

  function traverse(n: Record<string, unknown>, depth = 0) {
    if (depth > 12) return;

    // Extract fills (colors)
    const fills = n.fills as Array<{ type: string; color?: { r: number; g: number; b: number }; opacity?: number }> | undefined;
    if (fills && Array.isArray(fills)) {
      for (const fill of fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const hex = rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.opacity);
          const name = (n.name as string) || 'color';
          // Use descriptive name or generate from context
          const colorKey = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
          colors[colorKey] = hex;
        }
      }
    }

    // Extract background color
    const bgColor = n.backgroundColor as { r: number; g: number; b: number; a?: number } | undefined;
    if (bgColor) {
      colors['background'] = rgbaToHex(bgColor.r, bgColor.g, bgColor.b, bgColor.a);
    }

    // Extract typography
    const style = n.style as Record<string, unknown> | undefined;
    if (style && n.type === 'TEXT') {
      const fontFamily = style.fontFamily as string;
      const fontSize = style.fontSize as number;
      const fontWeight = style.fontWeight as number;
      const lineHeight = style.lineHeightPx as number;

      if (fontFamily) fonts.add(fontFamily);

      if (fontSize) {
        const sizeKey = `text-${Math.round(fontSize)}`;
        sizes[sizeKey] = {
          size: `${fontSize}px`,
          lineHeight: lineHeight ? `${Math.round(lineHeight)}px` : '1.5',
          weight: fontWeight || 400,
        };
      }
    }

    // Extract spacing from padding/itemSpacing
    const paddingLeft = n.paddingLeft as number;
    const paddingRight = n.paddingRight as number;
    const paddingTop = n.paddingTop as number;
    const paddingBottom = n.paddingBottom as number;
    const itemSpacing = n.itemSpacing as number;

    [paddingLeft, paddingRight, paddingTop, paddingBottom, itemSpacing].forEach(v => {
      if (v && v > 0) spacingSet.add(`${v}px`);
    });

    // Extract border radius
    const cornerRadius = n.cornerRadius as number;
    const topLeftRadius = n.topLeftRadius as number;
    if (cornerRadius && cornerRadius > 0) radiusSet.add(`${cornerRadius}px`);
    if (topLeftRadius && topLeftRadius > 0) radiusSet.add(`${topLeftRadius}px`);

    // Extract effects (shadows)
    const effects = n.effects as Array<{
      type: string;
      color?: { r: number; g: number; b: number; a: number };
      offset?: { x: number; y: number };
      radius?: number;
      spread?: number;
      visible?: boolean;
    }> | undefined;

    if (effects && Array.isArray(effects)) {
      for (const effect of effects) {
        if (effect.visible !== false && effect.type === 'DROP_SHADOW' && effect.color) {
          const { r, g, b, a } = effect.color;
          const x = effect.offset?.x || 0;
          const y = effect.offset?.y || 0;
          const blur = effect.radius || 0;
          const spread = effect.spread || 0;
          shadowSet.add(`${x}px ${y}px ${blur}px ${spread}px rgba(${Math.round(r*255)},${Math.round(g*255)},${Math.round(b*255)},${a.toFixed(2)})`);
        }
      }
    }

    // Extract strokes (borders)
    const strokes = n.strokes as Array<{ type: string; color?: { r: number; g: number; b: number } }> | undefined;
    const strokeWeight = n.strokeWeight as number;
    if (strokes && strokes.length > 0 && strokeWeight) {
      const stroke = strokes[0];
      if (stroke.color) {
        const hex = rgbaToHex(stroke.color.r, stroke.color.g, stroke.color.b);
        borderSet.add(`${strokeWeight}px solid ${hex}`);
      }
    }

    // Recurse into children
    const children = n.children as Array<Record<string, unknown>> | undefined;
    if (children && Array.isArray(children)) {
      for (const child of children) {
        traverse(child, depth + 1);
      }
    }
  }

  traverse(node);

  return {
    colors,
    typography: {
      fonts: Array.from(fonts),
      sizes,
    },
    spacing: Array.from(spacingSet).sort((a, b) => parseFloat(a) - parseFloat(b)),
    borderRadius: Array.from(radiusSet).sort((a, b) => parseFloat(a) - parseFloat(b)),
    shadows: Array.from(shadowSet),
    borders: Array.from(borderSet),
  };
}

function mergeStyleTokens(tokens: StyleToken[]): StyleToken {
  const merged: StyleToken = {
    colors: {},
    typography: { fonts: [], sizes: {} },
    spacing: [],
    borderRadius: [],
    shadows: [],
    borders: [],
  };

  const fonts = new Set<string>();
  const spacing = new Set<string>();
  const radius = new Set<string>();
  const shadows = new Set<string>();
  const borders = new Set<string>();

  for (const token of tokens) {
    Object.assign(merged.colors, token.colors);
    token.typography.fonts.forEach(f => fonts.add(f));
    Object.assign(merged.typography.sizes, token.typography.sizes);
    token.spacing.forEach(s => spacing.add(s));
    token.borderRadius.forEach(r => radius.add(r));
    token.shadows.forEach(s => shadows.add(s));
    token.borders.forEach(b => borders.add(b));
  }

  merged.typography.fonts = Array.from(fonts);
  merged.spacing = Array.from(spacing).sort((a, b) => parseFloat(a) - parseFloat(b));
  merged.borderRadius = Array.from(radius).sort((a, b) => parseFloat(a) - parseFloat(b));
  merged.shadows = Array.from(shadows);
  merged.borders = Array.from(borders);

  return merged;
}

// ============================================================================
// Screen Analysis
// ============================================================================

function analyzeScreen(frame: Record<string, unknown>): ScreenAnalysis {
  const texts: string[] = [];
  const buttons: string[] = [];
  const inputs: string[] = [];
  const navigatesTo: string[] = [];
  let hasTable = false;
  let hasList = false;
  let hasForm = false;
  const sharedComponents: string[] = [];
  const inferredActions: ScreenAnalysis['inferredActions'] = [];

  function traverse(node: Record<string, unknown>, depth = 0) {
    if (depth > 15) return;

    const nodeName = (node.name as string) || '';
    const nameLower = nodeName.toLowerCase();
    const nodeType = node.type as string;

    if (nodeType === 'TEXT' && node.characters) {
      const text = node.characters as string;
      if (text.length > 1 && text.length < 100) {
        texts.push(text);
      }
    }

    if (node.transitionNodeID) {
      navigatesTo.push(node.transitionNodeID as string);
    }

    if (nameLower.includes('button') || nameLower.includes('btn') || nameLower.includes('cta') ||
        nameLower.includes('submit') || nameLower.includes('save') || nameLower.includes('cancel') ||
        nameLower.includes('add') || nameLower.includes('edit') || nameLower.includes('delete') ||
        nameLower.includes('verify') || nameLower.includes('confirm')) {
      const buttonText = (node.characters as string) || nodeName;
      if (buttonText) buttons.push(buttonText);
    }

    if (nameLower.includes('input') || nameLower.includes('field') || nameLower.includes('textbox') ||
        nameLower.includes('search') || nameLower.includes('password') || nameLower.includes('email') ||
        nameLower.includes('username')) {
      inputs.push(nodeName);
    }

    if (nameLower.includes('table') || nameLower.includes('row') || nameLower.includes('grid') ||
        nameLower.includes('column') || nameLower.includes('header')) {
      hasTable = true;
    }

    if (nameLower.includes('list') || nameLower.includes('card') || nameLower.includes('item')) {
      hasList = true;
    }

    if (nameLower.includes('form')) {
      hasForm = true;
    }

    if (nameLower.includes('navigation') || nameLower.includes('sidebar') || nameLower.includes('nav')) {
      if (!sharedComponents.includes('Navigation')) sharedComponents.push('Navigation');
    }
    if (nameLower.includes('header') || nameLower.includes('topbar')) {
      if (!sharedComponents.includes('Header')) sharedComponents.push('Header');
    }

    const text = ((node.characters as string) || '').toLowerCase();
    if (text.includes('add') || text.includes('create') || text.includes('new')) {
      if (!inferredActions.includes('CREATE')) inferredActions.push('CREATE');
    }
    if (text.includes('edit') || text.includes('update') || text.includes('modify')) {
      if (!inferredActions.includes('UPDATE')) inferredActions.push('UPDATE');
    }
    if (text.includes('delete') || text.includes('remove')) {
      if (!inferredActions.includes('DELETE')) inferredActions.push('DELETE');
    }
    if (text.includes('view') || text.includes('details') || text.includes('list')) {
      if (!inferredActions.includes('READ')) inferredActions.push('READ');
    }
    if (text.includes('submit') || text.includes('save') || text.includes('confirm') || text.includes('verify')) {
      if (!inferredActions.includes('SUBMIT')) inferredActions.push('SUBMIT');
    }

    const children = node.children as Array<Record<string, unknown>> | undefined;
    if (children && Array.isArray(children)) {
      for (const child of children) {
        traverse(child, depth + 1);
      }
    }
  }

  traverse(frame);

  if (inputs.length >= 2) hasForm = true;

  const frameName = (frame.name as string) || '';
  const frameNameLower = frameName.toLowerCase();
  const allText = texts.join(' ').toLowerCase();
  const isAuth = frameNameLower.includes('login') || frameNameLower.includes('sign') ||
                 frameNameLower.includes('enter') || frameNameLower.includes('auth') ||
                 allText.includes('sign in') || allText.includes('password') ||
                 allText.includes('username') || allText.includes('credentials');

  const route = '/' + frameName.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

  // Get frame dimensions
  const boundingBox = frame.absoluteBoundingBox as { width?: number; height?: number; x?: number; y?: number } | undefined;
  const size = frame.size as { x?: number; y?: number } | undefined;
  const width = boundingBox?.width || size?.x;
  const height = boundingBox?.height || size?.y;

  // Extract styles for this frame
  const styles = extractDetailedStyles(frame);

  return {
    id: frame.id as string,
    name: frameName,
    route,
    isAuth,
    hasTable,
    hasList,
    hasForm,
    buttons: [...new Set(buttons)].slice(0, 20),
    inputFields: [...new Set(inputs)].slice(0, 20),
    textContent: [...new Set(texts)].slice(0, 100),
    navigatesTo: [...new Set(navigatesTo)],
    sharedComponents: [...new Set(sharedComponents)],
    inferredActions,
    dimensions: width && height ? { width, height } : undefined,
    styles,
  };
}

// ============================================================================
// Shared Navigation Detection
// ============================================================================

function findSharedNavigation(screens: ScreenAnalysis[]): string[] {
  const textCounts: Map<string, number> = new Map();

  for (const screen of screens) {
    const uniqueTexts = new Set(screen.textContent);
    for (const text of uniqueTexts) {
      textCounts.set(text, (textCounts.get(text) || 0) + 1);
    }
  }

  const navItems: string[] = [];
  for (const [text, count] of textCounts) {
    if (count >= 3 && text.length > 3 && text.length < 50) {
      navItems.push(text);
    }
  }

  return navItems.slice(0, 40);
}

// ============================================================================
// Data Model Inference
// ============================================================================

function inferDataModel(screens: ScreenAnalysis[]): Record<string, DataEntity> {
  const allText = screens.flatMap(s => s.textContent).join(' ').toLowerCase();
  const model: Record<string, DataEntity> = {};

  model['User'] = {
    name: 'User',
    fields: ['id', 'username', 'email', 'passwordHash', 'role', 'facilityId', 'createdAt', 'updatedAt'],
    relationships: ['Facility'],
  };

  if (allText.includes('patient') || allText.includes('mrn')) {
    model['Patient'] = {
      name: 'Patient',
      fields: ['id', 'firstName', 'lastName', 'dateOfBirth', 'mrn', 'allergies', 'createdAt'],
      relationships: ['Order', 'Prescription'],
    };
  }

  if (allText.includes('medication') || allText.includes('drug') || allText.includes('ndc')) {
    model['Medication'] = {
      name: 'Medication',
      fields: ['id', 'name', 'genericName', 'dosage', 'form', 'ndc', 'manufacturer', 'controlledSubstance'],
      relationships: ['InventoryItem', 'Prescription'],
    };
  }

  if (allText.includes('order') || allText.includes('queue')) {
    model['Order'] = {
      name: 'Order',
      fields: ['id', 'patientId', 'prescriptionId', 'status', 'priority', 'assignedTo', 'createdAt', 'updatedAt'],
      relationships: ['Patient', 'Prescription', 'User', 'Dispensation', 'SafetyCheck'],
    };
  }

  if (allText.includes('prescription') || allText.includes('rx') || allText.includes('prescribed')) {
    model['Prescription'] = {
      name: 'Prescription',
      fields: ['id', 'patientId', 'medicationId', 'dosage', 'frequency', 'route', 'prescriberId', 'status', 'createdAt'],
      relationships: ['Patient', 'Medication', 'Order'],
    };
  }

  if (allText.includes('inventory') || allText.includes('stock') || allText.includes('lot')) {
    model['InventoryItem'] = {
      name: 'InventoryItem',
      fields: ['id', 'medicationId', 'quantity', 'lotNumber', 'expirationDate', 'location', 'status'],
      relationships: ['Medication'],
    };
  }

  if (allText.includes('dispense') || allText.includes('dispensing') || allText.includes('dispensed')) {
    model['Dispensation'] = {
      name: 'Dispensation',
      fields: ['id', 'orderId', 'pharmacistId', 'dispensedAt', 'verifiedBy', 'labelPrinted', 'notes'],
      relationships: ['Order', 'User'],
    };
  }

  if (allText.includes('compound') || allText.includes('preparation') || allText.includes('sterile')) {
    model['CompoundFormula'] = {
      name: 'CompoundFormula',
      fields: ['id', 'name', 'ingredients', 'instructions', 'beyondUseDate', 'sterileRequired', 'preparedBy', 'verifiedBy'],
      relationships: ['Order', 'User'],
    };
  }

  if (allText.includes('safety') || allText.includes('check') || allText.includes('verify') || allText.includes('5 rights')) {
    model['SafetyCheck'] = {
      name: 'SafetyCheck',
      fields: ['id', 'orderId', 'checkType', 'status', 'checkedBy', 'notes', 'checkedAt'],
      relationships: ['Order', 'User'],
    };
  }

  if (allText.includes('facility') || allText.includes('hospital') || allText.includes('center')) {
    model['Facility'] = {
      name: 'Facility',
      fields: ['id', 'name', 'type', 'address', 'specialties', 'phone'],
      relationships: ['User'],
    };
  }

  if (allText.includes('product') || allText.includes('catalog')) {
    model['Product'] = {
      name: 'Product',
      fields: ['id', 'name', 'description', 'price', 'sku', 'category', 'inStock'],
      relationships: ['Category', 'OrderItem'],
    };
  }

  if (allText.includes('cart') || allText.includes('checkout')) {
    model['Cart'] = {
      name: 'Cart',
      fields: ['id', 'userId', 'items', 'total', 'createdAt'],
      relationships: ['User', 'CartItem'],
    };
  }

  return model;
}

// ============================================================================
// Requirements Generation - Now includes visual specs
// ============================================================================

function generateRequirements(
  appName: string,
  screens: ScreenAnalysis[],
  authFlow: string[],
  mainWorkflow: string[],
  sharedNavigation: string[],
  dataModel: Record<string, DataEntity>,
  styleTokens: StyleToken,
  frameImages: Record<string, string>,
): string {
  const parts: string[] = [];

  parts.push(`# ${appName} - Pixel-Perfect Build from Figma`);
  parts.push('');
  parts.push('## CRITICAL: Visual Fidelity');
  parts.push('**You MUST match the Figma design exactly.** Reference images are provided for each screen.');
  parts.push('Use the exact colors, spacing, typography, and layout from the design.');
  parts.push('');

  // Frame Images Reference
  if (Object.keys(frameImages).length > 0) {
    parts.push('## Design Reference Images');
    parts.push('Each screen has a reference image. Build the UI to match these exactly:');
    parts.push('');
    for (const screen of screens) {
      if (frameImages[screen.id]) {
        parts.push(`- **${screen.name}** (${screen.route}): See \`figma-frames/${sanitizeFileName(screen.name)}.png\``);
      }
    }
    parts.push('');
  }

  // Design Tokens
  parts.push('## Design Tokens (Use Exactly)');
  parts.push('');

  // Colors
  parts.push('### Colors');
  parts.push('```css');
  parts.push(':root {');
  const colorEntries = Object.entries(styleTokens.colors).slice(0, 30);
  for (const [name, value] of colorEntries) {
    parts.push(`  --color-${name}: ${value};`);
  }
  parts.push('}');
  parts.push('```');
  parts.push('');

  // Typography
  if (styleTokens.typography.fonts.length > 0) {
    parts.push('### Typography');
    parts.push(`**Fonts:** ${styleTokens.typography.fonts.join(', ')}`);
    parts.push('');
    parts.push('**Sizes:**');
    for (const [name, spec] of Object.entries(styleTokens.typography.sizes).slice(0, 15)) {
      parts.push(`- ${name}: ${spec.size} / ${spec.lineHeight} / weight ${spec.weight}`);
    }
    parts.push('');
  }

  // Spacing
  if (styleTokens.spacing.length > 0) {
    parts.push('### Spacing Scale');
    parts.push(`Use these spacing values: ${styleTokens.spacing.slice(0, 15).join(', ')}`);
    parts.push('');
  }

  // Border Radius
  if (styleTokens.borderRadius.length > 0) {
    parts.push('### Border Radius');
    parts.push(`Use these radii: ${styleTokens.borderRadius.join(', ')}`);
    parts.push('');
  }

  // Shadows
  if (styleTokens.shadows.length > 0) {
    parts.push('### Shadows');
    for (const shadow of styleTokens.shadows.slice(0, 5)) {
      parts.push(`- \`${shadow}\``);
    }
    parts.push('');
  }

  parts.push('---');
  parts.push('');

  // Authentication Flow
  if (authFlow.length > 0) {
    parts.push('## Authentication Flow');
    parts.push('Build a multi-step authentication:');
    authFlow.forEach((screen, i) => {
      const screenData = screens.find(s => s.name === screen);
      const imagePath = screenData ? `figma-frames/${sanitizeFileName(screen)}.png` : '';
      parts.push(`${i + 1}. **${screen}** (${screenData?.route || '/'}) - Match design: \`${imagePath}\``);
    });
    parts.push('');
    parts.push('- Protect all non-auth routes');
    parts.push('- Use NextAuth.js or equivalent');
    parts.push('');
  }

  // Shared Layout
  if (sharedNavigation.length > 0) {
    parts.push('## Shared Dashboard Layout');
    parts.push('All main screens share this layout (visible in all non-auth screen images):');
    parts.push('- **Sidebar Navigation** - Match the exact styling, spacing, and icons');
    parts.push('- **Header** - Match search bar, user menu, notifications');
    parts.push('- Create `DashboardLayout` component wrapping protected pages');
    parts.push('');
    parts.push('Navigation items found in design:');
    sharedNavigation.slice(0, 20).forEach(item => parts.push(`- ${item}`));
    parts.push('');
  }

  // Screen-by-Screen with Visual Specs
  parts.push('## Screen-by-Screen Requirements');
  parts.push('');

  for (const screen of screens) {
    if (screen.isAuth) continue;

    parts.push(`### ${screen.name} (${screen.route})`);
    parts.push('');

    // Reference image
    if (frameImages[screen.id]) {
      parts.push(`**Reference:** \`figma-frames/${sanitizeFileName(screen.name)}.png\``);
    }

    // Dimensions
    if (screen.dimensions) {
      parts.push(`**Design Size:** ${screen.dimensions.width}x${screen.dimensions.height}`);
    }

    // UI Patterns
    const patterns: string[] = [];
    if (screen.hasTable) patterns.push('data table');
    if (screen.hasList) patterns.push('card/list');
    if (screen.hasForm) patterns.push('form');
    if (patterns.length > 0) {
      parts.push(`**UI Pattern:** ${patterns.join(', ')}`);
    }

    // Actions
    if (screen.inferredActions.length > 0) {
      parts.push(`**Actions:** ${screen.inferredActions.join(', ')}`);
    }

    // Buttons
    const meaningfulButtons = screen.buttons.filter(b =>
      !b.toLowerCase().includes('button') && !b.toLowerCase().includes('primitive') && b.length > 2
    );
    if (meaningfulButtons.length > 0) {
      parts.push(`**Buttons:** ${meaningfulButtons.slice(0, 8).join(', ')}`);
    }

    parts.push('');
  }

  // Data Model
  if (Object.keys(dataModel).length > 0) {
    parts.push('## Data Model (Prisma)');
    parts.push('```prisma');
    for (const [name, entity] of Object.entries(dataModel)) {
      parts.push(`model ${name} {`);
      for (const field of entity.fields) {
        const type = inferFieldType(field);
        parts.push(`  ${field} ${type}`);
      }
      parts.push('}');
      parts.push('');
    }
    parts.push('```');
    parts.push('');
  }

  // Workflow
  if (mainWorkflow.length > 1) {
    parts.push('## Workflow');
    parts.push('```');
    parts.push(mainWorkflow.join(' → '));
    parts.push('```');
    parts.push('Implement status transitions between screens.');
    parts.push('');
  }

  // Technical Requirements
  parts.push('## Technical Stack');
  parts.push('- Next.js 14 App Router + TypeScript');
  parts.push('- Tailwind CSS (configure with design tokens above)');
  parts.push('- Prisma + SQLite');
  parts.push('- Server Actions for mutations');
  parts.push('');

  return parts.join('\n');
}

function inferFieldType(field: string): string {
  const lower = field.toLowerCase();

  if (lower === 'id') return 'String @id @default(cuid())';
  if (lower.includes('id') && lower !== 'id') return 'String';
  if (lower.includes('at') || lower.includes('date')) return 'DateTime @default(now())';
  if (lower.includes('email')) return 'String @unique';
  if (lower.includes('password')) return 'String';
  if (lower.includes('quantity') || lower.includes('count') || lower.includes('number')) return 'Int @default(0)';
  if (lower.includes('price') || lower.includes('total') || lower.includes('amount')) return 'Float @default(0)';
  if (lower.includes('is') || lower.includes('has') || lower.includes('enabled') || lower.includes('required')) return 'Boolean @default(false)';
  if (lower.includes('status') || lower.includes('type') || lower.includes('role')) return 'String';

  return 'String?';
}

// ============================================================================
// Legacy Functions (backward compatibility)
// ============================================================================

function extractLegacyComponents(node: Record<string, unknown>): Array<{ name: string; type: string }> {
  const components: Array<{ name: string; type: string }> = [];

  function extractFromNode(n: Record<string, unknown>, depth = 0) {
    if (depth > 5) return;

    const nodeType = n.type as string;
    const nodeName = n.name as string;

    if (nodeType === 'COMPONENT' || nodeType === 'INSTANCE') {
      components.push({ name: nodeName || 'Unnamed', type: nodeType.toLowerCase() });
    } else if (nodeType === 'FRAME' && nodeName) {
      components.push({ name: nodeName, type: 'section' });
    }

    const children = n.children as Array<Record<string, unknown>> | undefined;
    if (children && Array.isArray(children)) {
      for (const child of children.slice(0, 30)) {
        extractFromNode(child, depth + 1);
      }
    }
  }

  extractFromNode(node);
  return components.slice(0, 50);
}

function inferLayoutType(sections: string[]): string {
  const joined = sections.join(' ').toLowerCase();

  if (joined.includes('dashboard') || joined.includes('analytics')) return 'dashboard';
  if (joined.includes('login') || joined.includes('signin')) return 'auth';
  if (joined.includes('form') || joined.includes('input')) return 'form';
  if (joined.includes('list') || joined.includes('table')) return 'list';
  if (joined.includes('landing') || joined.includes('hero')) return 'landing';
  return 'application';
}

// ============================================================================
// Main API Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { figmaUrl } = body;

    if (!figmaUrl?.trim()) {
      return NextResponse.json({ error: 'Figma URL is required' }, { status: 400 });
    }

    const parsedUrl = parseFigmaUrl(figmaUrl);
    if (!parsedUrl) {
      return NextResponse.json({ error: 'Invalid Figma URL format.' }, { status: 400 });
    }

    const figmaToken = await getFigmaToken();
    if (!figmaToken) {
      return NextResponse.json({
        error: 'Figma Personal Access Token not configured',
        settingsUrl: '/settings'
      }, { status: 401 });
    }

    // 1. Fetch file - use node-specific endpoint if nodeId provided
    let figmaData: Record<string, unknown>;
    let fileName: string;

    if (parsedUrl.nodeId) {
      // Fetch only the specific node and its children
      console.log(`[Figma] Fetching specific node ${parsedUrl.nodeId} from file ${parsedUrl.fileId}...`);
      const nodeUrl = `https://api.figma.com/v1/files/${parsedUrl.fileId}/nodes?ids=${encodeURIComponent(parsedUrl.nodeId)}`;

      const figmaResponse = await fetch(nodeUrl, {
        headers: { 'X-Figma-Token': figmaToken },
      });

      if (!figmaResponse.ok) {
        const status = figmaResponse.status;
        if (status === 404) {
          return NextResponse.json({ error: 'Figma file or node not found.' }, { status: 404 });
        }
        if (status === 403) {
          return NextResponse.json({ error: 'Access denied to this Figma file.' }, { status: 403 });
        }
        return NextResponse.json({ error: `Figma API error: ${status}` }, { status });
      }

      const nodeData = await figmaResponse.json();
      fileName = nodeData.name || 'Figma Design';

      // Node-specific response has structure: { nodes: { "nodeId": { document: {...} } } }
      const nodeContent = nodeData.nodes?.[parsedUrl.nodeId];
      if (!nodeContent) {
        return NextResponse.json({ error: 'Specified node not found in file.' }, { status: 404 });
      }

      // Wrap in document structure for compatibility with rest of code
      figmaData = {
        name: nodeContent.document?.name || fileName,
        document: {
          children: [{
            name: 'Selected Node',
            children: [nodeContent.document] // The node itself as a frame
          }]
        }
      };
      fileName = nodeContent.document?.name || fileName;
      console.log(`[Figma] Got node: ${fileName}`);
    } else {
      // Fetch full file
      console.log(`[Figma] Fetching full file ${parsedUrl.fileId}...`);
      const figmaResponse = await fetch(`https://api.figma.com/v1/files/${parsedUrl.fileId}`, {
        headers: { 'X-Figma-Token': figmaToken },
      });

      if (!figmaResponse.ok) {
        const status = figmaResponse.status;
        if (status === 404) {
          return NextResponse.json({ error: 'Figma file not found.' }, { status: 404 });
        }
        if (status === 403) {
          return NextResponse.json({ error: 'Access denied to this Figma file.' }, { status: 403 });
        }
        return NextResponse.json({ error: `Figma API error: ${status}` }, { status });
      }

      figmaData = await figmaResponse.json();
      fileName = (figmaData.name as string) || 'Figma Design';
      console.log(`[Figma] Got full file: ${fileName}`);
    }

    // 2. Get frames - only TOP-LEVEL frames (direct children of pages) are screens
    // Nested frames (buttons, containers, etc.) are analyzed but not exported as images
    const pages = (figmaData.document as Record<string, unknown>).children as Record<string, unknown>[] || [];
    const allFrames: Record<string, unknown>[] = [];
    const frameIds: string[] = [];

    // Helper to add frame if it's a FRAME type or a RECTANGLE with image fill (screenshot)
    function addIfFrame(node: Record<string, unknown>) {
      const nodeType = node.type as string;

      if (nodeType === 'FRAME') {
        allFrames.push(node);
        frameIds.push(node.id as string);
        return;
      }

      // Also handle RECTANGLE nodes with image fills (pasted screenshots)
      if (nodeType === 'RECTANGLE' || nodeType === 'ELLIPSE') {
        const fills = node.fills as Array<{ type?: string }> | undefined;
        const hasImageFill = fills && Array.isArray(fills) && fills.some(f => f.type === 'IMAGE');
        const bounds = node.absoluteBoundingBox as { width?: number } | undefined;

        if (hasImageFill && bounds && bounds.width && bounds.width >= 500) {
          allFrames.push(node);
          frameIds.push(node.id as string);
        }
      }
    }

    // When node-id is provided, the structure is different
    // The selected node might BE a frame, or contain frames at various levels
    if (parsedUrl.nodeId) {
      // For node-specific fetch, search for frames up to 4 levels deep
      // The selected node could be a SECTION, GROUP, or FRAME containing screens
      // Also handles RECTANGLE nodes with image fills (pasted screenshots)
      function findFramesInNode(node: Record<string, unknown>, depth = 0, maxDepth = 4) {
        if (depth > maxDepth) return;

        const nodeType = node.type as string;
        const nodeName = node.name as string;
        const bounds = node.absoluteBoundingBox as { width?: number; height?: number } | undefined;

        console.log(`[Figma] Checking node at depth ${depth}: type=${nodeType}, name="${nodeName?.slice(0, 50)}"`);

        // Add if it's a FRAME (but skip very small frames which are likely components)
        if (nodeType === 'FRAME') {
          // Only add frames that look like screens (reasonably sized)
          if (!bounds || (bounds.width && bounds.width >= 200)) {
            allFrames.push(node);
            frameIds.push(node.id as string);
            console.log(`[Figma] Added frame: ${nodeName}`);
          }
        }

        // Also add RECTANGLE nodes that have image fills (pasted screenshots)
        // These are common when designers paste screenshots into Figma
        if (nodeType === 'RECTANGLE' || nodeType === 'ELLIPSE') {
          const fills = node.fills as Array<{ type?: string; imageRef?: string }> | undefined;
          const hasImageFill = fills && Array.isArray(fills) && fills.some(f => f.type === 'IMAGE');

          // Only add if it has an image fill and is screen-sized (> 500px wide)
          if (hasImageFill && bounds && bounds.width && bounds.width >= 500) {
            allFrames.push(node);
            frameIds.push(node.id as string);
            console.log(`[Figma] Added screenshot rectangle: ${nodeName} (${bounds.width}x${bounds.height})`);
          }
        }

        // Always recurse into children for SECTION, GROUP, CANVAS, FRAME containers
        if (['SECTION', 'GROUP', 'CANVAS', 'FRAME', 'COMPONENT_SET'].includes(nodeType) || depth === 0) {
          const children = node.children as Record<string, unknown>[] | undefined;
          if (children && Array.isArray(children)) {
            for (const child of children) {
              findFramesInNode(child, depth + 1, maxDepth);
            }
          }
        }
      }

      for (const page of pages) {
        findFramesInNode(page, 0);
      }
    } else {
      // Full file: get frames from pages, including inside SECTIONs
      function findFramesInPage(node: Record<string, unknown>, depth = 0) {
        if (depth > 3) return;

        const nodeType = node.type as string;

        // Add if it's a frame or screenshot
        addIfFrame(node);

        // Recurse into SECTION, GROUP containers to find nested frames
        if (['SECTION', 'GROUP', 'CANVAS'].includes(nodeType) || depth === 0) {
          const children = node.children as Record<string, unknown>[] | undefined;
          if (children && Array.isArray(children)) {
            for (const child of children) {
              findFramesInPage(child, depth + 1);
            }
          }
        }
      }

      for (const page of pages) {
        findFramesInPage(page, 0);
      }
    }

    console.log(`[Figma] Found ${allFrames.length} top-level frames`);

    // 3. Analyze all screens
    const screens: ScreenAnalysis[] = allFrames.map(frame => analyzeScreen(frame));

    // 4. Export frame images
    const frameImages = await exportFrameImages(parsedUrl.fileId, frameIds, figmaToken);

    // Add image URLs to screens
    for (const screen of screens) {
      if (frameImages[screen.id]) {
        screen.imageUrl = frameImages[screen.id];
      }
    }

    // 4b. Detect and export icons AND illustrations
    console.log(`[Figma] Detecting icons and illustrations in design...`);
    const icons: IconInfo[] = [];
    const debugStats = { nodesChecked: 0, vectorNodes: 0, instanceNodes: 0, imageFills: 0, potentialIcons: 0 };
    detectIcons(figmaData.document as Record<string, unknown>, icons, undefined, 0, 10, null, [], debugStats);
    const illustrationCount = icons.filter(i => i.isIllustration).length;
    const iconCount = icons.length - illustrationCount;
    console.log(`[Figma] Icon detection stats: ${debugStats.nodesChecked} nodes, ${debugStats.vectorNodes} VECTOR, ${debugStats.instanceNodes} INSTANCE, ${debugStats.imageFills} image fills, ${debugStats.potentialIcons} detected`);
    console.log(`[Figma] Found ${iconCount} icons and ${illustrationCount} illustrations (${icons.length} total)`);

    // Log some examples of what was found
    const sampleIcons = icons.filter(i => !i.isIllustration).slice(0, 3);
    const sampleIllustrations = icons.filter(i => i.isIllustration).slice(0, 3);
    if (sampleIcons.length > 0) {
      console.log(`[Figma] Sample icons: ${sampleIcons.map(i => `${i.fileName} (${i.size.width}x${i.size.height})`).join(', ')}`);
    }
    if (sampleIllustrations.length > 0) {
      console.log(`[Figma] Sample illustrations: ${sampleIllustrations.map(i => `${i.fileName} (${i.size.width}x${i.size.height})`).join(', ')}`);
    }

    // Export icons - separate PNG (photos with imageRef) from SVG (vectors)
    const iconsToExport = icons.slice(0, 200);
    const pngIcons = iconsToExport.filter(i => i.imageRef); // Photos need PNG
    const svgIcons = iconsToExport.filter(i => !i.imageRef); // Vectors need SVG

    console.log(`[Figma] Exporting ${svgIcons.length} vectors as SVG, ${pngIcons.length} photos as PNG`);

    // Export SVG and PNG in parallel
    const [svgUrls, pngUrls] = await Promise.all([
      svgIcons.length > 0 ? exportIconImages(parsedUrl.fileId, svgIcons.map(i => i.id), figmaToken, 'svg') : {},
      pngIcons.length > 0 ? exportIconImages(parsedUrl.fileId, pngIcons.map(i => i.id), figmaToken, 'png') : {},
    ]);

    // Merge all URLs
    const iconSvgUrls: Record<string, string> = { ...svgUrls, ...pngUrls };

    // Add URLs to icons
    for (const icon of icons) {
      if (iconSvgUrls[icon.id]) {
        icon.svgUrl = iconSvgUrls[icon.id];
      }
    }

    // 5. Extract and merge style tokens
    const allStyles = screens.map(s => s.styles).filter(Boolean) as StyleToken[];
    const styleTokens = mergeStyleTokens(allStyles);

    // Also extract from document level
    const docStyles = extractDetailedStyles(figmaData.document as Record<string, unknown>);
    const mergedTokens = mergeStyleTokens([styleTokens, docStyles]);

    // 6. Categorize screens
    const authScreens = screens.filter(s => s.isAuth);
    const mainScreens = screens.filter(s => !s.isAuth);
    const sharedNavigation = findSharedNavigation(screens);
    const dataModel = inferDataModel(screens);

    // 7. Generate requirements
    const requirements = generateRequirements(
      fileName,
      screens,
      authScreens.map(s => s.name),
      mainScreens.map(s => s.name),
      sharedNavigation,
      dataModel,
      mergedTokens,
      frameImages,
    );

    // 8. Build response
    const legacyComponents = pages.length > 0 ? extractLegacyComponents(pages[0]) : [];
    const sections = legacyComponents.filter(c => c.type === 'section').map(c => c.name);

    const designContext: FigmaDesignContext = {
      name: fileName,
      description: `Complete ${fileName} application with ${screens.length} screens`,
      layout: {
        type: inferLayoutType(sections),
        structure: sections,
        responsive: true,
      },
      colors: mergedTokens.colors,
      typography: {
        headingFont: mergedTokens.typography.fonts[0] || 'Inter',
        bodyFont: mergedTokens.typography.fonts[0] || 'Inter',
        sizes: Object.keys(mergedTokens.typography.sizes),
      },
      components: legacyComponents.slice(0, 30).map(c => ({
        name: c.name,
        type: c.type,
        description: '',
      })),
      screens,
      authFlow: authScreens.map(s => s.name),
      mainWorkflow: mainScreens.map(s => s.name),
      sharedNavigation: sharedNavigation.slice(0, 30),
      dataModel,
      styleTokens: mergedTokens,
      frameImages,
      icons,
      iconSvgUrls,
      requirements,
    };

    console.log(`[Figma] Complete: ${screens.length} screens, ${Object.keys(frameImages).length} images, ${icons.length} icons, ${Object.keys(mergedTokens.colors).length} colors`);

    return NextResponse.json({
      success: true,
      designContext: {
        ...designContext,
        sourceUrl: figmaUrl,
        figmaFileId: parsedUrl.fileId,
        figmaNodeId: parsedUrl.nodeId,
      },
      figmaUrl,
      fileId: parsedUrl.fileId,
      nodeId: parsedUrl.nodeId,
    });

  } catch (error) {
    console.error('Figma extraction error:', error);
    return NextResponse.json({
      error: 'Failed to extract design from Figma',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
