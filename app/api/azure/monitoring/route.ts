/**
 * Azure Monitoring API
 * GET /api/azure/monitoring - Get monitoring metrics and health status
 */

import { NextRequest, NextResponse } from 'next/server';
import { azureMonitoringService } from '@/services/azure-monitoring';
import { hasAzureCredentials } from '@/services/azure-infrastructure';

export async function GET(request: NextRequest) {
  try {
    // Check if Azure credentials are configured
    if (!await hasAzureCredentials()) {
      return NextResponse.json(
        { error: 'Azure credentials not configured' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const resourceGroupName = searchParams.get('resourceGroup');
    const appInsightsName = searchParams.get('appInsights');
    const action = searchParams.get('action');
    const timeRange = (searchParams.get('timeRange') || '24h') as '1h' | '6h' | '24h' | '7d';

    if (!resourceGroupName || !appInsightsName) {
      return NextResponse.json(
        { error: 'Missing required parameters: resourceGroup, appInsights' },
        { status: 400 }
      );
    }

    // Get metrics
    if (action === 'metrics') {
      const metrics = await azureMonitoringService.getMetrics(
        resourceGroupName,
        appInsightsName,
        timeRange
      );
      return NextResponse.json(metrics);
    }

    // Get health status
    if (action === 'health') {
      const health = await azureMonitoringService.getHealthStatus(
        resourceGroupName,
        appInsightsName
      );
      return NextResponse.json(health);
    }

    // Get dashboard URL
    if (action === 'dashboard') {
      const dashboardUrl = azureMonitoringService.getDashboardUrl(
        resourceGroupName,
        appInsightsName
      );
      return NextResponse.json({ dashboardUrl });
    }

    // Default: return both metrics and health
    const [metrics, health] = await Promise.all([
      azureMonitoringService.getMetrics(resourceGroupName, appInsightsName, timeRange),
      azureMonitoringService.getHealthStatus(resourceGroupName, appInsightsName),
    ]);

    const dashboardUrl = azureMonitoringService.getDashboardUrl(
      resourceGroupName,
      appInsightsName
    );

    return NextResponse.json({
      metrics,
      health,
      dashboardUrl,
    });
  } catch (error: any) {
    console.error('Error fetching monitoring data:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch monitoring data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceGroupName = searchParams.get('resourceGroup');
    const appInsightsName = searchParams.get('appInsights');
    const workspaceName = searchParams.get('workspace');

    if (!resourceGroupName || !appInsightsName) {
      return NextResponse.json(
        { error: 'Missing required parameters: resourceGroup, appInsights' },
        { status: 400 }
      );
    }

    const result = await azureMonitoringService.deleteMonitoringResources(
      resourceGroupName,
      appInsightsName,
      workspaceName || undefined
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting monitoring resources:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete monitoring resources' },
      { status: 500 }
    );
  }
}
