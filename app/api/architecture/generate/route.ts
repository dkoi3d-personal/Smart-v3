/**
 * API Route: Generate Architecture Documentation
 * POST /api/architecture/generate
 *
 * Generates comprehensive architecture documentation for a project
 * Supports custom project paths for cloned repositories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createArchitectureService } from '@/services/architecture-service';
import * as path from 'path';
import { resolveProjectPath } from '@/lib/project-path-resolver';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, projectPath: requestedPath } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Resolve project path (uses stored path if available, or defaults to computed path)
    const projectPath = await resolveProjectPath(projectId, requestedPath);

    console.log(`📐 Generating architecture for project: ${projectId} at path: ${projectPath}`);

    // Create encoder for streaming
    const encoder = new TextEncoder();

    // Create readable stream for progress updates
    const stream = new ReadableStream({
      async start(controller) {
        let isClosed = false;

        const safeEnqueue = (data: string) => {
          if (isClosed) return;
          try {
            controller.enqueue(encoder.encode(data));
          } catch { isClosed = true; }
        };

        const safeClose = () => {
          isClosed = true;
          controller.close();
        };

        try {
          const service = createArchitectureService({
            projectId,
            projectPath,
            projectName: projectId,
            onProgress: (status) => {
              safeEnqueue(JSON.stringify({ type: 'progress', status }) + '\n');
            },
          });

          const overview = await service.generateFullDocumentation();

          // Save the documentation
          const fs = await import('fs').then(m => m.promises);
          const docsPath = path.join(projectPath, '.architecture');

          try {
            await fs.mkdir(docsPath, { recursive: true });
            await fs.writeFile(
              path.join(docsPath, 'overview.json'),
              JSON.stringify(overview, null, 2)
            );
          } catch (saveError) {
            console.warn('Could not save architecture docs:', saveError);
          }

          // Send complete response
          safeEnqueue(JSON.stringify({ type: 'complete', overview }) + '\n');
          safeClose();
        } catch (error) {
          safeEnqueue(
            JSON.stringify({
              type: 'error',
              message: error instanceof Error ? error.message : 'Unknown error',
            }) + '\n'
          );
          safeClose();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Architecture generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
