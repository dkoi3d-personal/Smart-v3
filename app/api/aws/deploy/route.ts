import { NextRequest, NextResponse } from 'next/server';
import { awsDeploymentService, DeploymentOptions } from '@/services/aws-deployment';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      projectName,
      environment = 'dev',
      deploymentType = 'lambda',
    } = body;

    if (!projectId || !projectName) {
      return NextResponse.json(
        { error: 'projectId and projectName are required' },
        { status: 400 }
      );
    }

    const options: DeploymentOptions = {
      projectId,
      projectName: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      environment,
      deploymentType,
    };

    let result;

    switch (deploymentType) {
      case 'lambda':
        result = await awsDeploymentService.deployNextJsToLambda(options);
        break;
      case 'static':
        result = await awsDeploymentService.deployStaticSite(options);
        break;
      case 'ecs':
        result = await awsDeploymentService.deployToECS(options);
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported deployment type: ${deploymentType}` },
          { status: 400 }
        );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
