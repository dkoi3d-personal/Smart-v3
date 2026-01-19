/**
 * Sync Design System from Figma
 *
 * POST /api/design-systems/[id]/sync
 *
 * Re-fetches design tokens from the stored Figma source URL
 * and updates the design system with the latest tokens.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getFigmaToken } from '@/lib/figma/config-store';
import { getDesignSystemById } from '@/lib/design-systems';
import type { DesignSystem, DesignTokens } from '@/lib/design-systems/types';

// =============================================================================
// Token Extraction (same as import-figma)
// =============================================================================

function rgbaToHex(r: number, g: number, b: number, a?: number): string {
  const toHex = (n: number) => Math.round(n * 255).toString(16).padStart(2, '0');
  const hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  if (a !== undefined && a < 1) {
    return `${hex}${toHex(a)}`;
  }
  return hex;
}

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

    const fills = n.fills as Array<{ type: string; color?: { r: number; g: number; b: number }; opacity?: number }> | undefined;
    if (fills && Array.isArray(fills)) {
      for (const fill of fills) {
        if (fill.type === 'SOLID' && fill.color) {
          const hex = rgbaToHex(fill.color.r, fill.color.g, fill.color.b, fill.opacity);
          const colorKey = nodeName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'color';
          colors[colorKey] = hex;
        }
      }
    }

    const bgColor = n.backgroundColor as { r: number; g: number; b: number; a?: number } | undefined;
    if (bgColor) {
      colors['background'] = rgbaToHex(bgColor.r, bgColor.g, bgColor.b, bgColor.a);
    }

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

    const paddingLeft = n.paddingLeft as number;
    const paddingRight = n.paddingRight as number;
    const paddingTop = n.paddingTop as number;
    const paddingBottom = n.paddingBottom as number;
    const itemSpacing = n.itemSpacing as number;

    [paddingLeft, paddingRight, paddingTop, paddingBottom, itemSpacing].forEach(v => {
      if (v && v > 0) spacingSet.add(`${v}px`);
    });

    const cornerRadius = n.cornerRadius as number;
    if (cornerRadius && cornerRadius > 0) radiusSet.add(`${cornerRadius}px`);

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

    const strokes = n.strokes as Array<{ type: string; color?: { r: number; g: number; b: number } }> | undefined;
    const strokeWeight = n.strokeWeight as number;
    if (strokes && strokes.length > 0 && strokeWeight) {
      const stroke = strokes[0];
      if (stroke.color) {
        const hex = rgbaToHex(stroke.color.r, stroke.color.g, stroke.color.b);
        borderSet.add(`${strokeWeight}px solid ${hex}`);
      }
    }

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

function convertToDesignSystemTokens(figmaTokens: FigmaStyleToken): DesignTokens {
  const colors = figmaTokens.colors;

  const findColor = (keys: string[]): string => {
    for (const key of keys) {
      const found = Object.entries(colors).find(([k]) =>
        k.toLowerCase().includes(key.toLowerCase())
      );
      if (found) return found[1];
    }
    return '';
  };

  const primary = findColor(['primary', 'brand', 'main', 'blue']) || Object.values(colors)[0] || '#003e7e';
  const background = findColor(['background', 'bg', 'surface']) || '#ffffff';
  const foreground = findColor(['foreground', 'text', 'content']) || '#000000';

  const fonts = figmaTokens.typography.fonts;
  const sansFont = fonts.find(f => !f.toLowerCase().includes('mono')) || 'Inter';
  const monoFont = fonts.find(f => f.toLowerCase().includes('mono')) || 'monospace';

  const fontSizes: Record<string, { size: string; lineHeight: string; letterSpacing?: string }> = {};
  for (const [key, value] of Object.entries(figmaTokens.typography.sizes)) {
    fontSizes[key] = {
      size: value.size,
      lineHeight: value.lineHeight,
    };
  }

  const radii = figmaTokens.borderRadius;

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
      custom: colors,
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

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // Get existing design system
    const designSystem = await getDesignSystemById(id);
    if (!designSystem) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    // Check if it has a Figma source
    if (!designSystem.figmaSource) {
      return NextResponse.json(
        { error: 'This design system was not imported from Figma and cannot be synced' },
        { status: 400 }
      );
    }

    const { fileId, nodeId, url } = designSystem.figmaSource;

    // Get Figma token
    const figmaToken = await getFigmaToken();
    if (!figmaToken) {
      return NextResponse.json(
        { error: 'Figma token not configured' },
        { status: 401 }
      );
    }

    console.log(`[SyncFigma] Syncing design system ${id} from Figma: ${fileId}${nodeId ? ` node ${nodeId}` : ''}`);

    // Fetch from Figma API
    let figmaData: Record<string, unknown>;
    let fileName: string;

    if (nodeId) {
      const nodeUrl = `https://api.figma.com/v1/files/${fileId}/nodes?ids=${encodeURIComponent(nodeId)}`;
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
      const nodeContent = nodeData.nodes?.[nodeId];

      if (!nodeContent) {
        return NextResponse.json(
          { error: 'Node not found in Figma file' },
          { status: 404 }
        );
      }

      figmaData = nodeContent.document;
      fileName = nodeContent.document?.name || fileName;
    } else {
      const response = await fetch(`https://api.figma.com/v1/files/${fileId}`, {
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

    console.log(`[SyncFigma] Extracting tokens from: ${fileName}`);

    // Extract and convert tokens
    const figmaTokens = extractStyleTokens(figmaData);
    const tokens = convertToDesignSystemTokens(figmaTokens);

    const tokenCount = {
      colors: Object.keys(figmaTokens.colors).length,
      fonts: figmaTokens.typography.fonts.length,
      fontSizes: Object.keys(figmaTokens.typography.sizes).length,
      spacing: figmaTokens.spacing.length,
      radii: figmaTokens.borderRadius.length,
      shadows: figmaTokens.shadows.length,
    };

    // Update design system
    const now = new Date().toISOString();
    const updated: DesignSystem = {
      ...designSystem,
      tokens,
      updatedAt: now,
      figmaSource: {
        ...designSystem.figmaSource,
        fileName,
        lastSyncedAt: now,
      },
    };

    // Save to file
    const filePath = path.join(DESIGN_SYSTEMS_DIR, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(updated, null, 2));

    console.log(`[SyncFigma] Synced design system: ${id}`);

    return NextResponse.json({
      success: true,
      designSystem: {
        id: updated.id,
        name: updated.name,
        figmaSource: updated.figmaSource,
      },
      tokenCount,
      message: `Design system "${updated.name}" synced successfully from Figma`,
    });

  } catch (error) {
    console.error('[SyncFigma] Error:', error);
    return NextResponse.json(
      { error: 'Failed to sync design system from Figma', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
