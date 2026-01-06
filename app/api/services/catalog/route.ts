/**
 * Service Catalog API
 *
 * GET - Retrieve the full service catalog
 * PATCH - Update service settings (enable/disable, set default)
 * POST - Add a new service
 * DELETE - Remove a service
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadServiceCatalog,
  saveServiceCatalog,
  upsertApiService,
  upsertMcpServer,
  upsertLlmProvider,
  upsertIntegration,
  removeService,
  ServiceCatalog,
  ApiService,
  McpServerConfig,
  LlmProvider,
  ExternalIntegration,
} from '@/lib/services/service-catalog';
import { mcpManager } from '@/lib/services/mcp-manager';

// ============================================================================
// GET - Retrieve catalog
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const catalog = loadServiceCatalog();

    // Enrich MCP servers with runtime status
    const mcpServers = catalog.mcpServers.map(server => {
      const instance = mcpManager.getServer(server.id);
      return {
        ...server,
        status: instance?.status || 'stopped',
      };
    });

    return NextResponse.json({
      ...catalog,
      mcpServers,
    });
  } catch (error) {
    console.error('[Service Catalog API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to load service catalog' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH - Update service settings
// ============================================================================

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { type, id, enabled, isDefault } = body;

    if (!type || !id) {
      return NextResponse.json(
        { error: 'type and id are required' },
        { status: 400 }
      );
    }

    const catalog = loadServiceCatalog();

    switch (type) {
      case 'api': {
        const api = catalog.apis.find(a => a.id === id);
        if (!api) {
          return NextResponse.json({ error: 'API not found' }, { status: 404 });
        }
        if (enabled !== undefined) api.enabled = enabled;
        break;
      }

      case 'mcp': {
        const server = catalog.mcpServers.find(s => s.id === id);
        if (!server) {
          return NextResponse.json({ error: 'MCP server not found' }, { status: 404 });
        }
        if (enabled !== undefined) server.enabled = enabled;
        break;
      }

      case 'llm': {
        const provider = catalog.llmProviders.find(p => p.id === id);
        if (!provider) {
          return NextResponse.json({ error: 'LLM provider not found' }, { status: 404 });
        }
        if (enabled !== undefined) provider.enabled = enabled;
        if (isDefault) {
          // Clear other defaults first
          catalog.llmProviders.forEach(p => p.isDefault = false);
          provider.isDefault = true;
        }
        break;
      }

      case 'integration': {
        const integration = catalog.externalIntegrations?.find(i => i.id === id);
        if (!integration) {
          return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }
        if (enabled !== undefined) integration.enabled = enabled;
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    saveServiceCatalog(catalog);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Service Catalog API] PATCH error:', error);
    return NextResponse.json(
      { error: 'Failed to update service' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Add new service
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { type, service } = body;

    if (!type || !service) {
      return NextResponse.json(
        { error: 'type and service are required' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'api':
        upsertApiService(service as ApiService);
        break;

      case 'mcp':
        upsertMcpServer(service as McpServerConfig);
        break;

      case 'llm':
        upsertLlmProvider(service as LlmProvider);
        break;

      case 'integration':
        upsertIntegration(service as ExternalIntegration);
        break;

      default:
        return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Service Catalog API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to add service' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Remove service
// ============================================================================

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'api' | 'mcp' | 'llm' | 'integration' | null;
    const id = searchParams.get('id');

    if (!type || !id) {
      return NextResponse.json(
        { error: 'type and id query params are required' },
        { status: 400 }
      );
    }

    const removed = removeService(id, type);

    if (!removed) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Service Catalog API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to remove service' },
      { status: 500 }
    );
  }
}
