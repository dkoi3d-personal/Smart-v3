/**
 * Design Systems API - Single Design System Operations
 *
 * GET /api/design-systems/[id] - Get a single design system
 * PUT /api/design-systems/[id] - Update a design system
 * DELETE /api/design-systems/[id] - Delete a design system
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDesignSystemById,
  updateDesignSystem,
  deleteDesignSystem,
} from '@/lib/design-systems';
import type { UpdateDesignSystemInput } from '@/lib/design-systems';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const designSystem = await getDesignSystemById(id);

    if (!designSystem) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(designSystem);
  } catch (error) {
    console.error('[API] Failed to get design system:', error);
    return NextResponse.json(
      { error: 'Failed to get design system' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const body = (await request.json()) as UpdateDesignSystemInput;

    const updated = await updateDesignSystem(id, body);

    if (!updated) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error('[API] Failed to update design system:', error);

    if (error.message?.includes('Cannot modify built-in')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update design system' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { id } = await params;
    const deleted = await deleteDesignSystem(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Design system not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[API] Failed to delete design system:', error);

    if (error.message?.includes('Cannot delete built-in')) {
      return NextResponse.json(
        { error: error.message },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to delete design system' },
      { status: 500 }
    );
  }
}
