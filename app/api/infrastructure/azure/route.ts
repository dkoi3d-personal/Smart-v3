/**
 * Azure Infrastructure API
 *
 * Endpoints for provisioning and managing Azure resources.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadAzureCredentials,
  hasAzureCredentials,
  provisionPostgresServer,
  deletePostgresServer,
  listPostgresServers,
  getPostgresConnectionInfo,
} from '@/services/azure-infrastructure';
import crypto from 'crypto';

// Generate a secure random password
function generatePassword(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  const bytes = crypto.randomBytes(24);
  let password = '';
  for (let i = 0; i < 24; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  // Check credentials
  const hasCredentials = await hasAzureCredentials();
  if (!hasCredentials) {
    return NextResponse.json({
      error: 'Azure credentials not configured',
      message: 'Please configure Azure credentials in Settings > Credentials',
    }, { status: 401 });
  }

  const creds = await loadAzureCredentials();
  if (!creds) {
    return NextResponse.json({ error: 'Failed to load credentials' }, { status: 500 });
  }

  try {
    switch (action) {
      case 'status':
        return NextResponse.json({
          configured: true,
          subscriptionId: creds.subscriptionId,
        });

      case 'list-postgres':
        const servers = await listPostgresServers(creds);
        return NextResponse.json({ servers });

      case 'get-connection':
        const resourceGroup = searchParams.get('resourceGroup');
        const serverName = searchParams.get('serverName');
        if (!resourceGroup || !serverName) {
          return NextResponse.json({ error: 'Missing resourceGroup or serverName' }, { status: 400 });
        }
        const connInfo = await getPostgresConnectionInfo(creds, resourceGroup, serverName);
        return NextResponse.json(connInfo || { error: 'Server not found' });

      default:
        return NextResponse.json({
          configured: true,
          message: 'Azure Infrastructure API',
          actions: ['status', 'list-postgres', 'get-connection'],
        });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  // Check credentials
  const hasCredentials = await hasAzureCredentials();
  if (!hasCredentials) {
    return NextResponse.json({
      error: 'Azure credentials not configured',
      message: 'Please configure Azure credentials in Settings > Credentials',
    }, { status: 401 });
  }

  const creds = await loadAzureCredentials();
  if (!creds) {
    return NextResponse.json({ error: 'Failed to load credentials' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'provision-postgres': {
        const {
          serverName,
          resourceGroupName = 'ai-dev-platform-rg',
          location = 'eastus',
          adminUsername = 'pgadmin',
          adminPassword,
          skuName = 'Standard_B1ms',
          storageSizeGB = 32,
        } = body;

        if (!serverName) {
          return NextResponse.json({ error: 'serverName is required' }, { status: 400 });
        }

        // Generate password if not provided
        const password = adminPassword || generatePassword();

        const result = await provisionPostgresServer(creds, {
          serverName,
          resourceGroupName,
          location,
          adminUsername,
          adminPassword: password,
          skuName,
          storageSizeGB,
        });

        return NextResponse.json(result);
      }

      case 'delete-postgres': {
        const { serverName, resourceGroupName } = body;
        if (!serverName || !resourceGroupName) {
          return NextResponse.json({ error: 'serverName and resourceGroupName are required' }, { status: 400 });
        }

        const result = await deletePostgresServer(creds, resourceGroupName, serverName);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json({
          error: 'Unknown action',
          availableActions: ['provision-postgres', 'delete-postgres'],
        }, { status: 400 });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
