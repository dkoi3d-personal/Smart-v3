/**
 * MCP Test API
 *
 * Tests that MCP configuration is working correctly.
 */

import { NextResponse } from 'next/server';
import { loadMcpConfig } from '@/lib/mcp-config-store';
import { getFigmaToken } from '@/lib/figma/config-store';
import * as fs from 'fs';
import * as path from 'path';

export async function GET() {
  const results: {
    mcpConfigExists: boolean;
    mcpConfigPath: string;
    mcpSettings: any;
    figmaToken: { available: boolean; masked?: string };
    figmaMcpConfigured: boolean;
    errors: string[];
  } = {
    mcpConfigExists: false,
    mcpConfigPath: '',
    mcpSettings: null,
    figmaToken: { available: false },
    figmaMcpConfigured: false,
    errors: [],
  };

  try {
    // Check .mcp.json exists
    const mcpConfigPath = path.join(process.cwd(), '.mcp.json');
    results.mcpConfigPath = mcpConfigPath;
    results.mcpConfigExists = fs.existsSync(mcpConfigPath);

    if (results.mcpConfigExists) {
      const mcpJson = JSON.parse(fs.readFileSync(mcpConfigPath, 'utf-8'));
      results.figmaMcpConfigured = !!mcpJson.mcpServers?.figma;
    }

    // Check MCP settings from our store
    const mcpConfig = await loadMcpConfig();
    results.mcpSettings = mcpConfig;

    // Check Figma token
    const figmaToken = await getFigmaToken();
    if (figmaToken) {
      results.figmaToken = {
        available: true,
        masked: figmaToken.slice(0, 8) + '...' + figmaToken.slice(-4),
      };
    }

    // Validate configuration
    if (mcpConfig.figmaMcpEnabled && !figmaToken) {
      results.errors.push('Figma MCP is enabled but no Figma token is configured');
    }

    if (mcpConfig.figmaMcpEnabled && !results.figmaMcpConfigured) {
      results.errors.push('Figma MCP is enabled but Figma server is not in .mcp.json');
    }

    return NextResponse.json({
      success: results.errors.length === 0,
      ...results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        ...results,
      },
      { status: 500 }
    );
  }
}
