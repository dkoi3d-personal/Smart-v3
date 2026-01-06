/**
 * Agent Configuration API
 * Manage agent settings and prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadAgentConfig,
  saveAgentConfig,
  updateQuickSettings,
  resetToDefaults,
  FullAgentConfiguration,
} from '@/lib/agent-config-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/agent-config
 * Get current agent configuration
 */
export async function GET() {
  try {
    const config = await loadAgentConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Error loading agent config:', error);
    return NextResponse.json(
      { error: 'Failed to load agent configuration' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/agent-config
 * Update agent configuration
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { quickSettings, agents } = body as Partial<FullAgentConfiguration>;

    const currentConfig = await loadAgentConfig();

    // Update quick settings if provided
    if (quickSettings) {
      currentConfig.quickSettings = { ...currentConfig.quickSettings, ...quickSettings };
    }

    // Update agent configs if provided
    if (agents) {
      for (const [role, config] of Object.entries(agents)) {
        if (currentConfig.agents[role as keyof typeof currentConfig.agents]) {
          currentConfig.agents[role as keyof typeof currentConfig.agents] = {
            ...currentConfig.agents[role as keyof typeof currentConfig.agents],
            ...config,
          };
        }
      }
    }

    await saveAgentConfig(currentConfig);

    return NextResponse.json({
      success: true,
      config: currentConfig,
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
 * POST /api/agent-config
 * Special actions (reset to defaults)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'reset') {
      const config = await resetToDefaults();
      return NextResponse.json({
        success: true,
        message: 'Configuration reset to defaults',
        config,
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
