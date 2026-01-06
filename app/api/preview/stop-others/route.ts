import { NextRequest, NextResponse } from 'next/server';
import { devServerManager } from '@/services/dev-server-manager';

export async function POST(request: NextRequest) {
  try {
    const { currentProjectId } = await request.json();

    if (!currentProjectId) {
      return NextResponse.json(
        { error: 'Current project ID is required' },
        { status: 400 }
      );
    }

    // Get all running servers and stop any that aren't the current project
    const servers = devServerManager.getAllServers();
    const stoppedServers: string[] = [];

    for (const [projectId] of servers) {
      if (projectId !== currentProjectId) {
        await devServerManager.stopDevServer(projectId);
        stoppedServers.push(projectId);
        console.log(`[Preview] Stopped server for ${projectId} (switching to ${currentProjectId})`);
      }
    }

    return NextResponse.json({
      success: true,
      stoppedServers,
      message: `Stopped ${stoppedServers.length} other server(s)`,
    });
  } catch (error) {
    console.error('Stop others error:', error);
    return NextResponse.json(
      { error: 'Failed to stop other servers' },
      { status: 500 }
    );
  }
}
