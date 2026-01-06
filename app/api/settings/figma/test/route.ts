/**
 * Figma Token Test API
 *
 * Tests the configured Figma token by making API calls.
 */

import { NextResponse } from 'next/server';
import { getFigmaToken, validateFigmaToken } from '@/lib/figma/config-store';

/**
 * POST /api/settings/figma/test
 * Test the currently configured Figma token
 */
export async function POST() {
  try {
    const token = await getFigmaToken();

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'No Figma token configured',
        help: 'Add a token in Settings > Integrations > Figma',
      });
    }

    // Validate the token
    const validation = await validateFigmaToken(token);

    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: validation.error || 'Token validation failed',
      });
    }

    // Try to list recent files to verify full access
    const filesResponse = await fetch('https://api.figma.com/v1/me/files?page_size=1', {
      headers: {
        'X-Figma-Token': token,
      },
    });

    let recentFile = null;
    if (filesResponse.ok) {
      const filesData = await filesResponse.json();
      if (filesData.files && filesData.files.length > 0) {
        recentFile = {
          name: filesData.files[0].name,
          key: filesData.files[0].key,
          thumbnail: filesData.files[0].thumbnail_url,
        };
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Figma connection successful!',
      user: {
        email: validation.email,
      },
      recentFile,
      capabilities: {
        readFiles: true,
        listFiles: filesResponse.ok,
      },
    });
  } catch (error) {
    console.error('Figma test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Test failed',
    });
  }
}
