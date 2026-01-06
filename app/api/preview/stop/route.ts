import { NextRequest, NextResponse } from 'next/server';
import { devServerManager } from '@/services/dev-server-manager';

export async function POST(request: NextRequest) {
  try {
    const { projectId } = await request.json();

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    await devServerManager.stopDevServer(projectId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Preview stop error:', error);
    return NextResponse.json(
      { error: 'Failed to stop preview' },
      { status: 500 }
    );
  }
}
