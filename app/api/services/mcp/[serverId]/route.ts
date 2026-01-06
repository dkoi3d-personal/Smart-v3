/**
 * MCP Server Control API
 *
 * POST /api/services/mcp/[serverId]/start - Start an MCP server
 * POST /api/services/mcp/[serverId]/stop - Stop an MCP server
 * GET /api/services/mcp/[serverId] - Get server status
 */

import { NextRequest, NextResponse } from 'next/server';
import { mcpManager } from '@/lib/services/mcp-manager';
import { loadServiceCatalog } from '@/lib/services/service-catalog';

interface RouteParams {
  params: Promise<{ serverId: string }>;
}

// ============================================================================
// GET - Server status
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { serverId } = await params;

    // Initialize manager if needed
    await mcpManager.initialize();

    const server = mcpManager.getServer(serverId);

    if (!server) {
      // Check if it exists in catalog but not loaded
      const catalog = loadServiceCatalog();
      const configServer = catalog.mcpServers.find(s => s.id === serverId);

      if (configServer) {
        return NextResponse.json({
          id: serverId,
          name: configServer.name,
          status: 'stopped',
          enabled: configServer.enabled,
          tools: configServer.tools,
        });
      }

      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      id: serverId,
      name: server.config.name,
      status: server.status,
      enabled: server.config.enabled,
      tools: server.tools,
      startedAt: server.startedAt,
      error: server.error,
    });
  } catch (error) {
    console.error(`[MCP API] GET ${(await params).serverId} error:`, error);
    return NextResponse.json(
      { error: 'Failed to get server status' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Start/Stop server
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const { serverId } = await params;
    const url = new URL(request.url);
    const action = url.pathname.split('/').pop(); // 'start' or 'stop'

    // Initialize manager if needed
    await mcpManager.initialize();

    if (action === 'start') {
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
    }

    if (action === 'stop') {
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
    }

    return NextResponse.json(
      { error: 'Invalid action. Use /start or /stop' },
      { status: 400 }
    );
  } catch (error) {
    console.error(`[MCP API] POST error:`, error);
    return NextResponse.json(
      { error: 'Failed to control server' },
      { status: 500 }
    );
  }
}
