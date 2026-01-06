/**
 * MCP Server Start API
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/services/mcp-manager';

interface RouteParams {
  params: Promise<{ serverId: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { serverId } = await params;

    // Initialize manager if needed
    await mcpManager.initialize();

    const success = await mcpManager.startServer(serverId);

    if (!success) {
      const server = mcpManager.getServer(serverId);
      return NextResponse.json(
        { error: server?.error || 'Failed to start server' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'running',
      message: `MCP server ${serverId} started`,
    });
  } catch (error) {
    console.error(`[MCP API] Start error:`, error);
    return NextResponse.json(
      { error: 'Failed to start server' },
      { status: 500 }
    );
  }
}
