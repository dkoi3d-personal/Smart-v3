/**
 * Design Systems Config API
 *
 * GET /api/design-systems/config - Get configuration (default, project overrides)
 * PUT /api/design-systems/config - Update configuration
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getConfig,
  setDefaultDesignSystemId,
  setProjectDesignSystem,
  getDesignSystemById,
} from '@/lib/design-systems';

export async function GET(): Promise<NextResponse> {
  try {
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[API] Failed to get design system config:', error);
    return NextResponse.json(
      { error: 'Failed to get configuration' },
      { status: 500 }
    );
  }
}

interface ConfigUpdateBody {
  defaultDesignSystemId?: string;
  projectOverride?: {
    projectId: string;
    designSystemId: string | null;
  };
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as ConfigUpdateBody;

    // Update default design system
    if (body.defaultDesignSystemId !== undefined) {
      // Verify the design system exists
      const ds = await getDesignSystemById(body.defaultDesignSystemId);
      if (!ds) {
        return NextResponse.json(
          { error: 'Design system not found' },
          { status: 404 }
        );
      }

      await setDefaultDesignSystemId(body.defaultDesignSystemId);
    }

    // Update project override
    if (body.projectOverride) {
      const { projectId, designSystemId } = body.projectOverride;

      // If setting (not clearing), verify the design system exists
      if (designSystemId !== null) {
        const ds = await getDesignSystemById(designSystemId);
        if (!ds) {
          return NextResponse.json(
            { error: 'Design system not found' },
            { status: 404 }
          );
        }
      }

      await setProjectDesignSystem(projectId, designSystemId);
    }

    // Return updated config
    const config = await getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[API] Failed to update design system config:', error);
    return NextResponse.json(
      { error: 'Failed to update configuration' },
      { status: 500 }
    );
  }
}
