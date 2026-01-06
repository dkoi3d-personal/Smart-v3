import { NextResponse } from 'next/server';
import { awsDeploymentService } from '@/services/aws-deployment';

export async function GET() {
  try {
    const result = await awsDeploymentService.testConnection();

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
