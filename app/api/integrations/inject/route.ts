/**
 * Integration Injection API
 *
 * POST - Inject enabled integrations into a project directory
 * GET - Get injection preview (dry run)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  injectIntegrations,
  getIntegrationDependencies,
  generateEnvExample,
  getSetupInstructions,
} from '@/lib/services/integration-injector';
import { getEnabledIntegrations } from '@/lib/services/service-catalog';

// ============================================================================
// GET - Preview injection (dry run)
// ============================================================================

export async function GET(): Promise<NextResponse> {
  try {
    const integrations = getEnabledIntegrations();
    const dependencies = getIntegrationDependencies();
    const envExample = generateEnvExample();
    const setupInstructions = getSetupInstructions();

    return NextResponse.json({
      integrations: integrations.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        packages: i.packages,
        envVars: i.envVars,
        injectionsCount: i.injections.length,
      })),
      dependencies,
      envExample,
      setupInstructions,
    });
  } catch (error) {
    console.error('[Integrations API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get integration preview' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Inject integrations into project
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const {
      projectDir,
      dryRun = false,
      includeCategories,
      excludeCategories,
    } = body;

    if (!projectDir) {
      return NextResponse.json(
        { error: 'projectDir is required' },
        { status: 400 }
      );
    }

    const summary = await injectIntegrations({
      projectDir,
      dryRun,
      includeCategories,
      excludeCategories,
    });

    return NextResponse.json({
      success: summary.failedInjections === 0,
      summary,
      dependencies: getIntegrationDependencies(),
      envExample: generateEnvExample(),
    });
  } catch (error) {
    console.error('[Integrations API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to inject integrations' },
      { status: 500 }
    );
  }
}
