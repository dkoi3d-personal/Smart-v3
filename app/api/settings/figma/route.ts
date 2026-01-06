/**
 * Figma Settings API
 *
 * Manages Figma API token configuration.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadFigmaConfig,
  saveFigmaConfig,
  validateFigmaToken,
  getFigmaToken,
} from '@/lib/figma/config-store';

/**
 * GET /api/settings/figma
 * Get current Figma configuration status
 */
export async function GET() {
  try {
    const config = await loadFigmaConfig();
    const hasEnvToken = !!process.env.FIGMA_PERSONAL_ACCESS_TOKEN;

    return NextResponse.json({
      configured: config.enabled && !!config.token,
      hasEnvToken,
      lastValidated: config.lastValidated,
      accountEmail: config.accountEmail,
      // Don't expose the actual token
      tokenMasked: config.token
        ? `${config.token.substring(0, 8)}...${config.token.substring(config.token.length - 4)}`
        : null,
    });
  } catch (error) {
    console.error('Error loading Figma config:', error);
    return NextResponse.json(
      { error: 'Failed to load Figma configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/settings/figma
 * Save Figma API token
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token?.trim()) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    // Validate the token
    const validation = await validateFigmaToken(token.trim());

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Invalid Figma token',
          details: validation.error,
        },
        { status: 400 }
      );
    }

    // Save the token
    const config = await saveFigmaConfig({
      token: token.trim(),
      enabled: true,
      lastValidated: new Date().toISOString(),
      accountEmail: validation.email,
    });

    return NextResponse.json({
      success: true,
      configured: true,
      accountEmail: config.accountEmail,
      lastValidated: config.lastValidated,
    });
  } catch (error) {
    console.error('Error saving Figma config:', error);
    return NextResponse.json(
      { error: 'Failed to save Figma configuration' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/settings/figma
 * Remove Figma API token
 */
export async function DELETE() {
  try {
    await saveFigmaConfig({
      token: null,
      enabled: false,
      lastValidated: null,
      accountEmail: undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting Figma config:', error);
    return NextResponse.json(
      { error: 'Failed to delete Figma configuration' },
      { status: 500 }
    );
  }
}
