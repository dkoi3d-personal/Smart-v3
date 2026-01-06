import { NextRequest, NextResponse } from 'next/server';
import { deploymentService } from '@/services/deployment-service';
import { getProjectDir } from '@/lib/project-paths';

/**
 * Test deployment endpoint
 * POST /api/deploy/test
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Get project directory OUTSIDE ai-dev-platform-v2
    const projectDirectory = getProjectDir(projectId);

    console.log(`🧪 Testing deployment for project: ${projectId}`);

    // Run deployment
    const result = await deploymentService.deploy({
      projectId,
      projectName: projectId,
      projectDirectory,
      environment: 'dev',
    });

    console.log(
      result.success
        ? `✅ Test deployment succeeded: ${result.url}`
        : `❌ Test deployment failed: ${result.error}`
    );

    return NextResponse.json({
      success: result.success,
      deploymentId: result.deploymentId,
      url: result.url,
      projectAnalysis: {
        type: result.projectAnalysis.type,
        framework: result.projectAnalysis.framework,
        hasDatabase: result.projectAnalysis.hasDatabase,
        databases: result.projectAnalysis.databases,
        buildCommand: result.projectAnalysis.buildCommand,
        startCommand: result.projectAnalysis.startCommand,
        port: result.projectAnalysis.port,
      },
      buildLogs: result.buildResult.logs,
      deploymentLogs: result.logs,
      error: result.error,
    });
  } catch (error) {
    console.error('❌ Deployment test failed:', error);
    return NextResponse.json(
      {
        error: 'Deployment test failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
