/**
 * Infrastructure Config API
 * GET /api/infrastructure/config?projectDirectory=xxx
 * Returns the .infrastructure.json for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadInfrastructureConfig } from '@/lib/infrastructure-config';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectDirectory = searchParams.get('projectDirectory');

  if (!projectDirectory) {
    return NextResponse.json(
      { error: 'projectDirectory is required' },
      { status: 400 }
    );
  }

  try {
    const config = await loadInfrastructureConfig(projectDirectory);

    if (!config) {
      return NextResponse.json(
        { exists: false },
        { status: 200 }
      );
    }

    return NextResponse.json({
      exists: true,
      config,
    });
  } catch (error) {
    console.error('Failed to load infrastructure config:', error);
    return NextResponse.json(
      { error: 'Failed to load infrastructure config' },
      { status: 500 }
    );
  }
}
