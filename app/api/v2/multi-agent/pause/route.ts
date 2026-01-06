/**
 * Multi-Agent Pause API
 * Pauses a build and saves a checkpoint for later resume
 */

import { NextRequest, NextResponse } from 'next/server';
import { multiAgentService, AgentRole } from '@/services/multi-agent-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    projectId,
    requirements,
    agents = ['product_owner', 'coder', 'tester', 'security'],
  } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  try {
    const result = await multiAgentService.pauseSession(
      projectId,
      requirements || '',
      agents as AgentRole[]
    );

    if (result.success) {
      return NextResponse.json({
        success: true,
        checkpointPath: result.checkpointPath,
        phase: 'paused',
        message: 'Build paused and checkpoint saved',
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'No active session to pause',
      });
    }
  } catch (error) {
    console.error('[Pause API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to pause build' },
      { status: 500 }
    );
  }
}

// GET endpoint to check session status
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  const status = multiAgentService.getSessionStatus(projectId);

  return NextResponse.json(status);
}
