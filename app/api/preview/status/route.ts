import { NextRequest, NextResponse } from 'next/server';
import { devServerManager } from '@/services/dev-server-manager';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const server = devServerManager.getDevServer(projectId);

    if (!server) {
      return NextResponse.json({
        status: 'not_found',
        error: 'No dev server found for this project',
      });
    }

    // Update activity timestamp when status is checked
    devServerManager.updateActivity(projectId);

    return NextResponse.json({
      status: server.status,
      url: server.status === 'ready' ? `http://localhost:${server.port}` : null,
      port: server.port,
      type: server.type,
      error: server.status === 'error' ? 'Server failed to start' : null,
    });
  } catch (error) {
    console.error('Preview status error:', error);
    return NextResponse.json(
      { error: 'Failed to get preview status' },
      { status: 500 }
    );
  }
}
