/**
 * Individual Agent Configuration API
 * Update a specific agent's settings
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadAgentConfig,
  updateAgentConfig,
  AgentRole,
  DEFAULT_AGENT_CONFIGS,
} from '@/lib/agent-config-store';

export const dynamic = 'force-dynamic';

const VALID_ROLES: AgentRole[] = ['product_owner', 'coder', 'tester', 'security', 'fixer', 'researcher'];

/**
 * GET /api/agent-config/[role]
 * Get configuration for a specific agent
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role: roleParam } = await params;
    const role = roleParam as AgentRole;

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid agent role: ${role}` },
        { status: 400 }
      );
    }

    const config = await loadAgentConfig();
    const agentConfig = config.agents[role];
    const defaultConfig = DEFAULT_AGENT_CONFIGS[role];

    return NextResponse.json({
      config: agentConfig,
      defaults: defaultConfig,
      quickSettings: config.quickSettings,
    });
  } catch (error) {
    console.error('Error getting agent config:', error);
    return NextResponse.json(
      { error: 'Failed to get agent configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent-config/[role]
 * Update configuration for a specific agent
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role: roleParam } = await params;
    const role = roleParam as AgentRole;

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid agent role: ${role}` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const config = await updateAgentConfig(role, body);

    return NextResponse.json({
      success: true,
      config: config.agents[role],
    });
  } catch (error) {
    console.error('Error updating agent config:', error);
    return NextResponse.json(
      { error: 'Failed to update agent configuration' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agent-config/[role]
 * Reset a specific agent to defaults
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ role: string }> }
) {
  try {
    const { role: roleParam } = await params;
    const role = roleParam as AgentRole;

    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { error: `Invalid agent role: ${role}` },
        { status: 400 }
      );
    }

    const body = await request.json();

    if (body.action === 'reset') {
      const defaultConfig = DEFAULT_AGENT_CONFIGS[role];
      const config = await updateAgentConfig(role, defaultConfig);

      return NextResponse.json({
        success: true,
        message: `${role} reset to defaults`,
        config: config.agents[role],
      });
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error with agent config action:', error);
    return NextResponse.json(
      { error: 'Failed to perform action' },
      { status: 500 }
    );
  }
}
