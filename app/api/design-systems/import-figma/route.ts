/**
 * Import Design System from Figma
 *
 * POST /api/design-systems/import-figma
 *
 * Extracts design tokens from a Figma design system file and creates
 * a reusable design system that can be applied to all projects.
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { promises as fs } from 'fs';
import path from 'path';
import { getFigmaToken } from '@/lib/figma/config-store';
import type { DesignSystem, DesignTokens, ImportFigmaInput } from '@/lib/design-systems/types';
import { setDefaultDesignSystemId, getDesignSystemById } from '@/lib/design-systems';

// =============================================================================
// Types from Figma Extract
// =============================================================================

interface FigmaStyleToken {
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

interface ExtractedComponent {
  name: string;
  description: string;
  variants: string[];
  size?: { width: number; height: number };
}

// =============================================================================
// URL Parsing
// =============================================================================

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

// =============================================================================
// Token Extraction (simplified version of figma extract logic)
// =============================================================================

function rgbaToHex(r: number, g: number, b: number, a?: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 1) {
    return `${hex}${toHex(a)}`;
  }
  return hex;
}

function extractStyleTokens(node: Record<string, unknown>): FigmaStyleToken {
  const colors: Record<string, string> = {};
  const fonts = new Set<string>();
  const sizes: Record<string, { size: string; lineHeight: string; weight: number }> = {};
  const spacingSet = new Set<string>();
  const radiusSet = new Set<string>();
  const shadowSet = new Set<string>();
  const borderSet = new Set<string>();

  function traverse(n: Record<string, unknown>, depth = 0) {
    if (depth > 12) return;

    const nodeName = (n.name as string) || '';
    const nodeType = n.type as string;

    // Extract fills (colors)
    const fills = n.fills as Array<{ type: string; color?: { r: number; g: number; b: number }; opacity?: number }> | undefined;
    if (fills && Array.isArray(fills)) {
      for (const fill of fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const hex = rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.opacity);
          // Use node name as color key
          const colorKey = nodeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'color';
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
    if (style && nodeType === 'TEXT') {
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
    if (cornerRadius && cornerRadius > 0) radiusSet.add(`${cornerRadius}px`);

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

// =============================================================================
// Component Extraction
// =============================================================================

function extractComponents(node: Record<string, unknown>): ExtractedComponent[] {
  const components: ExtractedComponent[] = [];
  const componentSets = new Map<string, { name: string; variants: string[]; size?: { width: number; height: number } }>();

  function traverse(n: Record<string, unknown>, depth = 0) {
    if (depth > 15) return;

    const nodeName = (n.name as string) || '';
    const nodeType = n.type as string;
    const bounds = n.absoluteBoundingBox as { width: number; height: number } | undefined;

    // Component Sets (variant containers like "Button", "Input")
    if (nodeType === 'COMPONENT_SET') {
      const variants: string[] = [];
      const children = n.children as Array<Record<string, unknown>> | undefined;

      if (children) {
        for (const child of children) {
          if (child.type === 'COMPONENT') {
            variants.push(child.name as string);
          }
        }
      }

      componentSets.set(nodeName, {
        name: nodeName,
        variants,
        size: bounds ? { width: Math.round(bounds.width), height: Math.round(bounds.height) } : undefined,
      });
    }
    // Standalone components (not in a set)
    else if (nodeType === 'COMPONENT') {
      // Check if parent is a COMPONENT_SET - if so, skip (handled above)
      const parentName = (n as any)._parentName;
      if (!parentName || !componentSets.has(parentName)) {
        components.push({
          name: nodeName,
          description: (n.description as string) || '',
          variants: ['default'],
          size: bounds ? { width: Math.round(bounds.width), height: Math.round(bounds.height) } : undefined,
        });
      }
    }

    // Recurse into children
    const children = n.children as Array<Record<string, unknown>> | undefined;
    if (children && Array.isArray(children)) {
      for (const child of children) {
        (child as any)._parentName = nodeName;
        traverse(child, depth + 1);
      }
    }
  }

  traverse(node);

  // Convert component sets to components
  for (const [, set] of componentSets) {
    components.push({
      name: set.name,
      description: `Component with ${set.variants.length} variant(s)`,
      variants: set.variants.slice(0, 10), // Limit variants shown
      size: set.size,
    });
  }

  // Sort by name and deduplicate
  const seen = new Set<string>();
  return components
    .filter(c => {
      const key = c.name.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// =============================================================================
// Convert Figma Tokens to Design System Tokens
// =============================================================================

function convertToDesignSystemTokens(figmaTokens: FigmaStyleToken): DesignTokens {
  // Extract semantic colors from the Figma colors
  const colors = figmaTokens.colors;

  // Try to find semantic color mappings
  const findColor = (keys: string[]): string => {
    for (const key of keys) {
      const found = Object.entries(colors).find(([k]) =>
        k.toLowerCase().includes(key.toLowerCase())
      );
      if (found) return found[1];
    }
    return '';
  };

  // Analyze colors to find likely primary (most saturated non-gray)
  const colorValues = Object.values(colors);
  const uniqueColors = [...new Set(colorValues)];

  // Find the most saturated color as likely primary brand color
  const findBrandColor = (): string => {
    let bestColor = '';
    let bestSaturation = 0;

    for (const hex of uniqueColors) {
      if (!hex.startsWith('#') || hex.length < 7) continue;
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);

      // Skip very light or very dark colors
      const brightness = (r + g + b) / 3;
      if (brightness > 230 || brightness < 30) continue;

      // Calculate saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const saturation = max === 0 ? 0 : (max - min) / max;

      if (saturation > bestSaturation) {
        bestSaturation = saturation;
        bestColor = hex;
      }
    }
    return bestColor;
  };

  // Check if a color is transparent
  const isTransparent = (hex: string): boolean => {
    if (!hex || hex.length < 7) return true;
    if (hex.length === 9 && hex.slice(7).toLowerCase() === '00') return true;
    if (hex === '#00000000' || hex === 'transparent') return true;
    return false;
  };

  // Find likely background (lightest non-transparent color)
  const findBackgroundColor = (): string => {
    let lightest = '';
    let maxBrightness = 0;

    for (const hex of uniqueColors) {
      if (!hex.startsWith('#') || hex.length < 7) continue;
      if (isTransparent(hex)) continue; // Skip transparent

      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = (r + g + b) / 3;

      if (brightness > maxBrightness && brightness > 200) {
        maxBrightness = brightness;
        lightest = hex;
      }
    }
    return lightest || '#ffffff';
  };

  // Find likely foreground (darkest color)
  const findForegroundColor = (): string => {
    let darkest = '';
    let minBrightness = 255;

    for (const hex of uniqueColors) {
      if (!hex.startsWith('#') || hex.length < 7) continue;

      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      const brightness = (r + g + b) / 3;

      if (brightness < minBrightness && brightness < 80) {
        minBrightness = brightness;
        darkest = hex;
      }
    }
    return darkest || '#000000';
  };

  // Build color tokens with smarter detection
  const primary = findColor(['primary', 'brand', 'main', 'button', 'logo', 'cta']) || findBrandColor() || '#003e7e';
  const background = findColor(['background', 'bg', 'surface', 'page']) || findBackgroundColor();
  const foreground = findColor(['foreground', 'text', 'content', 'body']) || findForegroundColor();

  // Extract font families
  const fonts = figmaTokens.typography.fonts;
  const sansFont = fonts.find(f => !f.toLowerCase().includes('mono')) || 'Inter';
  const monoFont = fonts.find(f => f.toLowerCase().includes('mono')) || 'monospace';

  // Extract font sizes
  const fontSizes: Record<string, { size: string; lineHeight: string; letterSpacing?: string }> = {};
  for (const [key, value] of Object.entries(figmaTokens.typography.sizes)) {
    fontSizes[key] = {
      size: value.size,
      lineHeight: value.lineHeight,
    };
  }

  // Extract border radii
  const radii = figmaTokens.borderRadius;

  // Build shadows map
  const shadows: Record<string, string> = {};
  figmaTokens.shadows.forEach((shadow, i) => {
    shadows[i === 0 ? 'sm' : i === 1 ? 'md' : i === 2 ? 'lg' : `shadow-${i}`] = shadow;
  });

  return {
    colors: {
      background,
      foreground,
      card: findColor(['card', 'surface']) || background,
      cardForeground: findColor(['card-foreground']) || foreground,
      popover: findColor(['popover']) || background,
      popoverForeground: findColor(['popover-foreground']) || foreground,
      primary,
      primaryForeground: findColor(['primary-foreground', 'on-primary']) || '#ffffff',
      secondary: findColor(['secondary']) || '#f5f5f5',
      secondaryForeground: findColor(['secondary-foreground']) || foreground,
      muted: findColor(['muted', 'disabled']) || '#f5f5f5',
      mutedForeground: findColor(['muted-foreground']) || '#666666',
      accent: findColor(['accent', 'highlight']) || primary,
      accentForeground: findColor(['accent-foreground']) || '#ffffff',
      destructive: findColor(['destructive', 'error', 'danger', 'red']) || '#dc2626',
      destructiveForeground: '#ffffff',
      border: findColor(['border', 'divider', 'outline']) || '#e5e5e5',
      input: findColor(['input']) || '#e5e5e5',
      ring: findColor(['ring', 'focus']) || primary,
      success: findColor(['success', 'green']) || '#16a34a',
      successForeground: '#ffffff',
      warning: findColor(['warning', 'yellow', 'orange']) || '#f59e0b',
      warningForeground: '#000000',
      error: findColor(['error', 'red', 'destructive']) || '#dc2626',
      errorForeground: '#ffffff',
      info: findColor(['info', 'blue']) || '#0ea5e9',
      infoForeground: '#ffffff',
      custom: colors, // Include all extracted colors
    },
    spacing: {
      unit: 4,
      scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64],
    },
    typography: {
      fontFamily: {
        sans: sansFont,
        mono: monoFont,
        display: fonts.find(f => f.toLowerCase().includes('display')) || sansFont,
      },
      fontSize: Object.keys(fontSizes).length > 0 ? fontSizes : {
        xs: { size: '12px', lineHeight: '16px' },
        sm: { size: '14px', lineHeight: '20px' },
        base: { size: '16px', lineHeight: '24px' },
        lg: { size: '18px', lineHeight: '28px' },
        xl: { size: '20px', lineHeight: '28px' },
        '2xl': { size: '24px', lineHeight: '32px' },
        '3xl': { size: '30px', lineHeight: '36px' },
        '4xl': { size: '36px', lineHeight: '40px' },
      },
      fontWeight: {
        normal: 400,
        medium: 500,
        semibold: 600,
        bold: 700,
      },
    },
    radii: {
      none: '0',
      sm: radii[0] || '4px',
      md: radii[1] || '6px',
      lg: radii[2] || '8px',
      xl: radii[3] || '12px',
      '2xl': radii[4] || '16px',
      full: '9999px',
    },
    shadows: Object.keys(shadows).length > 0 ? shadows : {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
    },
    transitions: {
      duration: {
        fast: '150ms',
        normal: '200ms',
        slow: '300ms',
      },
      easing: {
        ease: 'ease',
        easeIn: 'ease-in',
        easeOut: 'ease-out',
        easeInOut: 'ease-in-out',
      },
    },
  };
}

// =============================================================================
// API Handler
// =============================================================================

const DATA_DIR = path.join(process.cwd(), 'data');
const DESIGN_SYSTEMS_DIR = path.join(DATA_DIR, 'design-systems');

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ImportFigmaInput;
    const { figmaUrl, name, setAsDefault, existingId } = body;

    if (!figmaUrl?.trim()) {
      return NextResponse.json(
        { error: 'Figma URL is required' },
        { status: 400 }
      );
    }

    // Parse Figma URL
    const parsedUrl = parseFigmaUrl(figmaUrl);
    if (!parsedUrl) {
      return NextResponse.json(
        { error: 'Invalid Figma URL format' },
        { status: 400 }
      );
    }

    // Get Figma token
    const figmaToken = await getFigmaToken();
    if (!figmaToken) {
      return NextResponse.json(
        { error: 'Figma token not configured. Go to Settings to add your token.' },
        { status: 401 }
      );
    }

    console.log(`[ImportFigma] Fetching design system from Figma: ${parsedUrl.fileId}${parsedUrl.nodeId ? ` node ${parsedUrl.nodeId}` : ''}`);

    // Fetch from Figma API
    let figmaData: Record<string, unknown>;
    let fileName: string;

    if (parsedUrl.nodeId) {
      const nodeUrl = `https://api.figma.com/v1/files/${parsedUrl.fileId}/nodes?ids=${encodeURIComponent(parsedUrl.nodeId)}`;
      const response = await fetch(nodeUrl, {
        headers: { 'X-Figma-Token': figmaToken },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Figma API error: ${response.status}` },
          { status: response.status }
        );
      }

      const nodeData = await response.json();
      fileName = nodeData.name || 'Figma Design System';
      const nodeContent = nodeData.nodes?.[parsedUrl.nodeId];

      if (!nodeContent) {
        return NextResponse.json(
          { error: 'Node not found in Figma file' },
          { status: 404 }
        );
      }

      figmaData = nodeContent.document;
      fileName = nodeContent.document?.name || fileName;
    } else {
      const response = await fetch(`https://api.figma.com/v1/files/${parsedUrl.fileId}`, {
        headers: { 'X-Figma-Token': figmaToken },
      });

      if (!response.ok) {
        return NextResponse.json(
          { error: `Figma API error: ${response.status}` },
          { status: response.status }
        );
      }

      figmaData = await response.json();
      fileName = (figmaData.name as string) || 'Figma Design System';
      figmaData = figmaData.document as Record<string, unknown>;
    }

    console.log(`[ImportFigma] Extracting tokens from: ${fileName}`);

    // Extract style tokens
    const figmaTokens = extractStyleTokens(figmaData);
    const tokenCount = {
      colors: Object.keys(figmaTokens.colors).length,
      fonts: figmaTokens.typography.fonts.length,
      fontSizes: Object.keys(figmaTokens.typography.sizes).length,
      spacing: figmaTokens.spacing.length,
      radii: figmaTokens.borderRadius.length,
      shadows: figmaTokens.shadows.length,
    };

    console.log(`[ImportFigma] Extracted tokens:`, tokenCount);

    // Extract components
    const extractedComponents = extractComponents(figmaData);
    console.log(`[ImportFigma] Extracted components: ${extractedComponents.length}`);

    // Convert to design system tokens
    const tokens = convertToDesignSystemTokens(figmaTokens);

    // Convert extracted components to design system component specs
    const componentSpecs: Record<string, any> = {};
    for (const comp of extractedComponents) {
      const key = comp.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
      componentSpecs[key] = {
        name: comp.name,
        description: comp.description || `${comp.name} component from Figma`,
        variants: comp.variants,
        states: ['default', 'hover', 'active', 'disabled'],
        props: {},
        usage: comp.size ? `Size: ${comp.size.width}x${comp.size.height}px` : '',
      };
    }

    // Create or update design system
    const now = new Date().toISOString();
    const dsName = name || fileName;

    let designSystem: DesignSystem;

    if (existingId) {
      // Update existing design system
      const existing = await getDesignSystemById(existingId);
      if (!existing) {
        return NextResponse.json(
          { error: 'Design system not found' },
          { status: 404 }
        );
      }

      designSystem = {
        ...existing,
        name: dsName,
        tokens,
        components: { ...existing.components, ...componentSpecs },
        updatedAt: now,
        figmaSource: {
          url: figmaUrl,
          fileId: parsedUrl.fileId,
          nodeId: parsedUrl.nodeId,
          fileName,
          lastSyncedAt: now,
        },
      };
    } else {
      // Create new design system
      const id = uuidv4();

      designSystem = {
        id,
        name: dsName,
        description: `Design system imported from Figma: ${fileName}`,
        version: '1.0.0',
        isDefault: setAsDefault || false,
        isBuiltIn: false,
        createdAt: now,
        updatedAt: now,
        tokens,
        components: componentSpecs,
        guidelines: `# ${dsName}\n\nImported from Figma on ${new Date().toLocaleDateString()}.\n\nSource: ${figmaUrl}\n\n## Components\n\n${extractedComponents.slice(0, 20).map(c => `- **${c.name}**: ${c.variants.length} variant(s)`).join('\n')}`,
        examples: [],
        source: {
          type: 'figma',
        },
        figmaSource: {
          url: figmaUrl,
          fileId: parsedUrl.fileId,
          nodeId: parsedUrl.nodeId,
          fileName,
          lastSyncedAt: now,
        },
      };
    }

    // Save to file
    const filePath = path.join(DESIGN_SYSTEMS_DIR, `${designSystem.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(designSystem, null, 2));

    // Set as default if requested
    if (setAsDefault) {
      await setDefaultDesignSystemId(designSystem.id);
      designSystem.isDefault = true;
      // Update file with isDefault flag
      await fs.writeFile(filePath, JSON.stringify(designSystem, null, 2));
    }

    console.log(`[ImportFigma] Created design system: ${designSystem.id} (${dsName}) with ${extractedComponents.length} components`);

    return NextResponse.json({
      success: true,
      designSystem: {
        id: designSystem.id,
        name: designSystem.name,
        isDefault: designSystem.isDefault,
        figmaSource: designSystem.figmaSource,
      },
      tokenCount: {
        ...tokenCount,
        components: extractedComponents.length,
      },
      message: `Design system "${dsName}" ${existingId ? 'updated' : 'created'} successfully with ${extractedComponents.length} components${setAsDefault ? ' and set as default' : ''}`,
    });

  } catch (error) {
    console.error('[ImportFigma] Error:', error);
    return NextResponse.json(
      { error: 'Failed to import design system from Figma', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
