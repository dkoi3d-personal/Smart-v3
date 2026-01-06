/**
 * MCP Server Stop API
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

    const success = await mcpManager.stopServer(serverId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to stop server' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      status: 'stopped',
      message: `MCP server ${serverId} stopped`,
    });
  } catch (error) {
    console.error(`[MCP API] Stop error:`, error);
    return NextResponse.json(
      { error: 'Failed to stop server' },
      { status: 500 }
    );
  }
}
