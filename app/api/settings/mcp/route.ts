/**
 * MCP Settings API
 *
 * Manages MCP (Model Context Protocol) configuration for agents.
 * Controls which MCP servers are available to agents during builds.
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadMcpConfig, saveMcpConfig, type McpConfig } from '@/lib/mcp-config-store';

export async function GET() {
  try {
    const config = await loadMcpConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('[MCP Settings API] Error loading config:', error);
    return NextResponse.json(
      { error: 'Failed to load MCP configuration' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate input - only allow known MCP toggle fields
    const allowedFields = [
      'figmaMcpEnabled',
      'memoryMcpEnabled',
      'filesystemMcpEnabled',
      'githubMcpEnabled',
      'eslintMcpEnabled',
    ];

    const updates: Partial<McpConfig> = {};
    for (const field of allowedFields) {
      if (typeof body[field] === 'boolean') {
        (updates as any)[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No valid MCP settings provided' },
        { status: 400 }
      );
    }

    const config = await saveMcpConfig(updates);

    return NextResponse.json({
      success: true,
      config,
    });
  } catch (error) {
    console.error('[MCP Settings API] Error saving config:', error);
    return NextResponse.json(
      { error: 'Failed to save MCP configuration' },
      { status: 500 }
    );
  }
}
