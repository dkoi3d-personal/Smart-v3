/**
 * Design Systems API - List and Create
 *
 * GET /api/design-systems - List all design systems
 * POST /api/design-systems - Create a new design system
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getAllDesignSystems,
  getDesignSystemsList,
  createDesignSystem,
} from '@/lib/design-systems';
import type { CreateDesignSystemInput } from '@/lib/design-systems';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const full = searchParams.get('full') === 'true';

    if (full) {
      // Return full design system objects
      const systems = await getAllDesignSystems();
      return NextResponse.json(systems);
    } else {
      // Return lightweight list
      const list = await getDesignSystemsList();
      return NextResponse.json(list);
    }
  } catch (error) {
    console.error('[API] Failed to get design systems:', error);
    return NextResponse.json(
      { error: 'Failed to get design systems' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CreateDesignSystemInput;

    if (!body.name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const designSystem = await createDesignSystem(body);
    return NextResponse.json(designSystem, { status: 201 });
  } catch (error) {
    console.error('[API] Failed to create design system:', error);
    return NextResponse.json(
      { error: 'Failed to create design system' },
      { status: 500 }
    );
  }
}
