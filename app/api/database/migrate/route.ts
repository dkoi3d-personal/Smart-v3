/**
 * Mock-to-Database Migration API
 *
 * POST /api/database/migrate - Start migration (returns result)
 * GET /api/database/migrate?projectId=xxx - SSE stream for real-time progress
 */

import { NextRequest, NextResponse } from 'next/server';
import { migrateToDatabase, MigrationStep } from '@/services/mock-to-database-migration';
import { getProjectDir } from '@/lib/project-paths';
import { loadDatabaseCredentials } from '@/lib/credentials-store';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * POST - Start migration and return result
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, provider } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }

    if (!provider || !['neon', 'supabase', 'sqlite'].includes(provider)) {
      return NextResponse.json({ error: 'Valid provider required (neon, supabase, sqlite)' }, { status: 400 });
    }

    const projectDir = getProjectDir(projectId);

    // Verify project exists
    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Load credentials from settings
    const credentials = await loadDatabaseCredentials();

    // Validate credentials for the provider
    if (provider === 'neon' && !credentials.neonApiKey) {
      return NextResponse.json({
        error: 'Neon API key not configured. Add it in Settings → Database.',
        needsCredentials: true,
        provider: 'neon'
      }, { status: 400 });
    }
    if (provider === 'supabase' && !credentials.supabaseAccessToken) {
      return NextResponse.json({
        error: 'Supabase access token not configured. Add it in Settings → Database.',
        needsCredentials: true,
        provider: 'supabase'
      }, { status: 400 });
    }

    // Run migration
    const result = await migrateToDatabase({
      projectDir,
      projectId,
      provider,
      credentials: {
        neonApiKey: credentials.neonApiKey,
        supabaseAccessToken: credentials.supabaseAccessToken,
      }
    });

    // Save migration result
    if (result.success) {
      const migrationLog = path.join(projectDir, '.migration-log.json');
      await fs.writeFile(migrationLog, JSON.stringify({
        ...result,
        migratedAt: new Date().toISOString(),
      }, null, 2));
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Database migration error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Helper to create SSE error response
 */
function createSSEErrorResponse(error: string, needsCredentials?: boolean): Response {
  const encoder = new TextEncoder();
  const errorData = JSON.stringify({ message: error, needsCredentials });
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(`event: migration-error\ndata: ${errorData}\n\n`));
      controller.close();
    }
  });
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

/**
 * GET - SSE endpoint for real-time progress updates during migration
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');
  const provider = searchParams.get('provider') as 'neon' | 'supabase' | 'sqlite';

  if (!projectId || !provider) {
    return createSSEErrorResponse('Missing projectId or provider');
  }

  const projectDir = getProjectDir(projectId);

  // Verify project exists
  try {
    await fs.access(projectDir);
  } catch {
    return createSSEErrorResponse('Project not found');
  }

  // Load credentials
  const credentials = await loadDatabaseCredentials();

  // Validate credentials
  if (provider === 'neon' && !credentials.neonApiKey) {
    return createSSEErrorResponse(
      'Neon API key not configured. Add it in Settings → Credentials.',
      true
    );
  }
  if (provider === 'supabase' && !credentials.supabaseAccessToken) {
    return createSSEErrorResponse(
      'Supabase access token not configured. Add it in Settings → Credentials.',
      true
    );
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (event: string, data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          // Stream might be closed
        }
      };

      try {
        sendEvent('start', { projectId, provider, startedAt: new Date().toISOString() });

        const result = await migrateToDatabase(
          {
            projectDir,
            projectId,
            provider,
            credentials: {
              neonApiKey: credentials.neonApiKey,
              supabaseAccessToken: credentials.supabaseAccessToken,
            }
          },
          (step: MigrationStep) => {
            sendEvent('step', step);
          }
        );

        // Save migration result
        if (result.success) {
          const migrationLog = path.join(projectDir, '.migration-log.json');
          await fs.writeFile(migrationLog, JSON.stringify({
            ...result,
            migratedAt: new Date().toISOString(),
          }, null, 2));
        }

        sendEvent('complete', result);

      } catch (error) {
        sendEvent('error', {
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
