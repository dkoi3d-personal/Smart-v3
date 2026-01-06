import { NextRequest, NextResponse } from 'next/server';
import { awsDeploymentService } from '@/services/aws-deployment';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;

    const deployments = await awsDeploymentService.listDeployments(projectId);

    return NextResponse.json({ deployments });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
