/**
 * Azure Database Management API
 *
 * GET /api/database/azure - List deployed Azure PostgreSQL servers
 * POST /api/database/azure/test - Test database connection
 * GET /api/database/azure/metrics - Get database metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  listAzurePostgresServers,
  testDatabaseConnection,
  getAzurePostgresMetrics,
} from '@/services/database-provisioning';
import { loadDatabaseCredentials } from '@/lib/credentials-store';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const action = searchParams.get('action');
  const serverName = searchParams.get('serverName');
  const resourceGroup = searchParams.get('resourceGroup');

  try {
    const credentials = await loadDatabaseCredentials();

    // Check for Azure credentials
    const azureCredentials = credentials as any;
    if (!azureCredentials.azureSubscriptionId) {
      return NextResponse.json(
        { error: 'Azure credentials not configured. Add them in Settings.' },
        { status: 400 }
      );
    }

    // Get metrics for a specific server
    if (action === 'metrics' && serverName && resourceGroup) {
      const metrics = await getAzurePostgresMetrics(serverName, resourceGroup, {
        subscriptionId: azureCredentials.azureSubscriptionId,
        tenantId: azureCredentials.azureTenantId,
        clientId: azureCredentials.azureClientId,
        clientSecret: azureCredentials.azureClientSecret,
      });

      return NextResponse.json({ metrics });
    }

    // List all servers
    const { servers } = await listAzurePostgresServers({
      subscriptionId: azureCredentials.azureSubscriptionId,
      resourceGroup: azureCredentials.azureResourceGroup,
      tenantId: azureCredentials.azureTenantId,
      clientId: azureCredentials.azureClientId,
      clientSecret: azureCredentials.azureClientSecret,
    });

    return NextResponse.json({ servers });
  } catch (error) {
    console.error('Failed to list Azure databases:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list databases' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, connectionString, serverName, resourceGroup, database, username, password } = body;

    if (action === 'test') {
      // Test connection
      let connStr = connectionString;

      // If no connection string provided, construct from server details
      if (!connStr && serverName) {
        const credentials = await loadDatabaseCredentials();
        const azureCredentials = credentials as any;

        if (password) {
          connStr = `postgresql://${username || 'pgadmin'}:${encodeURIComponent(password)}@${serverName}.postgres.database.azure.com:5432/${database || 'postgres'}?sslmode=require`;
        } else {
          return NextResponse.json(
            { error: 'Password required to test connection' },
            { status: 400 }
          );
        }
      }

      if (!connStr) {
        return NextResponse.json(
          { error: 'Connection string or server details required' },
          { status: 400 }
        );
      }

      const result = await testDatabaseConnection(connStr);
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Database action failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Action failed' },
      { status: 500 }
    );
  }
}
