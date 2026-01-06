/**
 * Azure Logs API
 * GET /api/azure/logs?type=app|database&resourceGroup=xxx&appName=xxx
 * Fetches live logs from Azure resources
 */

import { NextRequest, NextResponse } from 'next/server';
import { loadAzureCredentials } from '@/services/azure-infrastructure';
import { WebSiteManagementClient } from '@azure/arm-appservice';
import { ClientSecretCredential } from '@azure/identity';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get('type'); // 'app' or 'database'
  const resourceGroup = searchParams.get('resourceGroup');
  const appName = searchParams.get('appName');
  const serverName = searchParams.get('serverName');
  const lines = parseInt(searchParams.get('lines') || '100');

  try {
    const creds = await loadAzureCredentials();
    if (!creds) {
      return NextResponse.json(
        { error: 'Azure credentials not configured' },
        { status: 401 }
      );
    }

    const credential = new ClientSecretCredential(
      creds.tenantId,
      creds.clientId,
      creds.clientSecret
    );

    if (type === 'app' && resourceGroup && appName) {
      // Fetch App Service logs
      const webClient = new WebSiteManagementClient(credential, creds.subscriptionId);

      try {
        // Get recent logs from the app
        // First, try to get the log stream URL
        const publishingCredentials = await webClient.webApps.beginListPublishingCredentialsAndWait(
          resourceGroup,
          appName
        );

        const kuduUrl = `https://${appName}.scm.azurewebsites.net`;
        const username = publishingCredentials.publishingUserName || '';
        const password = publishingCredentials.publishingPassword || '';

        // Fetch recent logs from Kudu API
        const logsResponse = await fetch(`${kuduUrl}/api/logs/docker`, {
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
          },
        });

        if (logsResponse.ok) {
          const logFiles = await logsResponse.json();

          // Get the most recent log file
          if (logFiles && logFiles.length > 0) {
            // Sort by lastUpdated descending
            const sortedLogs = logFiles.sort((a: any, b: any) =>
              new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
            );

            // Fetch content of the most recent log
            const recentLog = sortedLogs[0];
            const logContentResponse = await fetch(recentLog.href, {
              headers: {
                'Authorization': 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
              },
            });

            if (logContentResponse.ok) {
              const logContent = await logContentResponse.text();
              const logLines = logContent.split('\n').filter(Boolean).slice(-lines);

              return NextResponse.json({
                success: true,
                type: 'app',
                logs: logLines,
                source: recentLog.name,
                lastUpdated: recentLog.lastUpdated,
              });
            }
          }
        }

        // Fallback: try to get deployment logs
        const deployments = await webClient.webApps.listDeployments(resourceGroup, appName);
        const deploymentLogs: string[] = [];

        for await (const deployment of deployments) {
          if (deployment.message) {
            deploymentLogs.push(`[${deployment.endTime || deployment.startTime}] ${deployment.message}`);
          }
          if (deploymentLogs.length >= lines) break;
        }

        if (deploymentLogs.length > 0) {
          return NextResponse.json({
            success: true,
            type: 'app',
            logs: deploymentLogs,
            source: 'deployments',
          });
        }

        return NextResponse.json({
          success: true,
          type: 'app',
          logs: ['No recent logs available. Enable Application Logging in Azure Portal for more details.'],
          source: 'none',
        });

      } catch (error: any) {
        console.error('Failed to fetch app logs:', error);
        return NextResponse.json({
          success: false,
          error: error.message || 'Failed to fetch app logs',
          logs: [],
        });
      }
    }

    if (type === 'database' && serverName) {
      // For PostgreSQL, we'd need to use Azure Monitor or the PostgreSQL management API
      // This is more complex and requires additional setup
      return NextResponse.json({
        success: true,
        type: 'database',
        logs: [
          'Database logs require Azure Monitor integration.',
          'Enable "log_statement" and "log_duration" in PostgreSQL server parameters.',
          'View logs in Azure Portal → PostgreSQL Server → Server logs',
        ],
        source: 'info',
      });
    }

    return NextResponse.json(
      { error: 'Invalid parameters. Provide type=app with resourceGroup and appName, or type=database with serverName' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('Azure logs error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
