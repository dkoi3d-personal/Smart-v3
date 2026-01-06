/**
 * API Route: Generate Specific Diagram
 * POST /api/architecture/[projectId]/diagram
 *
 * Generates a specific type of architecture diagram on demand
 * Supports custom project paths for cloned repositories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createArchitectureService } from '@/services/architecture-service';
import type { DiagramType } from '@/lib/architecture/types';
import { resolveProjectPath } from '@/lib/project-path-resolver';

interface RouteContext {
  params: Promise<{ projectId: string }>;
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { projectId } = await context.params;
    const body = await request.json();
    const { type, projectPath: requestedPath } = body as { type: DiagramType; projectPath?: string };

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (!type) {
      return NextResponse.json(
        { error: 'Diagram type is required' },
        { status: 400 }
      );
    }

    const validTypes: DiagramType[] = [
      'system-overview',
      'component-diagram',
      'sequence-diagram',
      'data-flow',
      'deployment-diagram',
      'entity-relationship',
      'class-diagram',
      'api-flow',
    ];

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid diagram type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Use requested path, stored path, or computed path
    const projectPath = await resolveProjectPath(projectId, requestedPath);

    const service = createArchitectureService({
      projectId,
      projectPath,
      projectName: projectId,
    });

    const diagram = await service.generateDiagram(type);

    return NextResponse.json({ diagram });
  } catch (error) {
    console.error('Diagram generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
