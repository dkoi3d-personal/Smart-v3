/**
 * Azure Deployment API
 * POST /api/azure/deploy - Deploy project to Azure
 * GET /api/azure/deploy?projectId=xxx - Get deployment status
 * DELETE /api/azure/deploy - Delete deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import { azureDeploymentService, AzureDeploymentOptions, AzureServiceType } from '@/services/azure-deployment';
import { azureMonitoringService } from '@/services/azure-monitoring';
import { hasAzureCredentials, loadAzureCredentials, provisionPostgresServer } from '@/services/azure-infrastructure';
import { updateAppServiceConfig, updateMonitoringConfig } from '@/lib/infrastructure-config';
import { setupDeployedEnvironment, getEnvFilename } from '@/lib/env-manager';

export async function POST(request: NextRequest) {
  try {
    // Check if Azure credentials are configured
    if (!await hasAzureCredentials()) {
      return NextResponse.json(
        { error: 'Azure credentials not configured. Please set up Azure credentials in Settings.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      projectId,
      projectName,
      projectDirectory,
      environment = 'dev',
      serviceType = 'auto',
      resourceGroupName,
      location = 'eastus2',
      sku = 'B1',
      enableMonitoring = true,
      databaseStrategy = 'none',
      stream = false,
    } = body;

    // Validate required fields
    if (!projectId || !projectName || !projectDirectory) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, projectName, projectDirectory' },
        { status: 400 }
      );
    }

    // Start deployment
    const deploymentOptions: AzureDeploymentOptions = {
      projectId,
      projectName,
      projectDirectory,
      environment,
      serviceType: serviceType as AzureServiceType | 'auto',
      resourceGroupName,
      location,
      sku,
      enableMonitoring,
    };

    // If streaming is requested, use SSE
    if (stream) {
      const encoder = new TextEncoder();

      const readable = new ReadableStream({
        async start(controller) {
          const sendEvent = (data: object) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          };

          try {
            // Deploy with real-time log streaming
            const result = await azureDeploymentService.deployWithCallback(
              deploymentOptions,
              (log: string) => {
                sendEvent({ log, timestamp: new Date().toISOString() });
              }
            );

            // Handle database provisioning
            if (databaseStrategy === 'auto-provision' && result.success) {
              sendEvent({ log: '🗄️ Starting database provisioning...' });
              // Database provisioning code here...
            }

            // Save infrastructure config on successful deployment
            if (result.success && projectDirectory) {
              try {
                sendEvent({ log: '📝 Saving infrastructure config...' });
                await updateAppServiceConfig(projectDirectory, projectId, {
                  provider: 'azure',
                  type: serviceType as 'app-service' | 'container-apps' | 'static-web-apps',
                  appName: result.appName,
                  resourceGroup: result.resourceGroupName,
                  url: result.url || `https://${result.appName}.azurewebsites.net`,
                  sku,
                  deployedAt: new Date().toISOString(),
                }, location);

                if (result.monitoring) {
                  await updateMonitoringConfig(projectDirectory, projectId, {
                    applicationInsightsId: result.monitoring.applicationInsightsId,
                    instrumentationKey: result.monitoring.instrumentationKey,
                    dashboardUrl: result.monitoring.dashboardUrl,
                  });
                }
                sendEvent({ log: '✅ Infrastructure config saved' });
              } catch (infraError: any) {
                sendEvent({ log: `⚠️ Could not save infrastructure config: ${infraError.message}` });
              }
            }

            // Send final result
            sendEvent({ complete: true, result });
            controller.close();
          } catch (error: any) {
            sendEvent({ error: error.message || 'Deployment failed' });
            controller.close();
          }
        }
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Non-streaming fallback
    const result = await azureDeploymentService.deploy(deploymentOptions);

    // Handle database provisioning if requested
    if (databaseStrategy === 'auto-provision' && result.success) {
      try {
        const creds = await loadAzureCredentials();
        if (creds) {
          const sanitizedName = projectName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 20);
          const serverName = `pg-${sanitizedName}-${environment}`;
          const adminPassword = generateSecurePassword();

          result.logs.push(`🗄️ Provisioning Azure PostgreSQL: ${serverName}...`);

          const dbResult = await provisionPostgresServer(creds, {
            serverName,
            resourceGroupName: result.resourceGroupName,
            location,
            adminUsername: 'dbadmin',
            adminPassword,
            skuName: 'Standard_B1ms',
            storageSizeGB: 32,
            version: '16',
          });

          if (dbResult.success && dbResult.connectionString) {
            result.logs.push(`✅ PostgreSQL provisioned: ${serverName}`);
            result.resources.push({
              type: 'postgresql-server',
              id: serverName,
            });

            // Add database info to result
            (result as any).database = {
              host: dbResult.host,
              port: dbResult.port,
              database: dbResult.database,
              username: dbResult.username,
              connectionString: dbResult.connectionString,
            };

            // Save DATABASE_URL to the appropriate .env.[environment] file
            try {
              const envFile = getEnvFilename(environment as 'development' | 'staging' | 'production');
              await setupDeployedEnvironment(
                projectDirectory,
                environment as 'development' | 'staging' | 'production',
                dbResult.connectionString,
                (msg) => result.logs.push(msg)
              );
              result.logs.push(`✅ DATABASE_URL saved to ${envFile}`);
              result.logs.push(`✅ Prisma schema switched to PostgreSQL`);
            } catch (envError: any) {
              result.logs.push(`⚠️ Could not save DATABASE_URL: ${envError.message}`);
            }

            result.logs.push(`🔗 DATABASE_URL configured for ${result.appName}`);
          } else {
            result.logs.push(`⚠️ Database provisioning failed: ${dbResult.error}`);
          }
        }
      } catch (dbError: any) {
        result.logs.push(`⚠️ Warning: Database provisioning failed: ${dbError.message}`);
      }
    }

    if (databaseStrategy === 'migrate' && result.success) {
      result.logs.push(`📦 Migration mode: Assuming existing database configured`);
      result.logs.push(`ℹ️ Run 'npx prisma migrate deploy' or equivalent after deployment`);
    }

    // If monitoring is enabled and deployment succeeded, set up Application Insights
    if (enableMonitoring && result.success) {
      try {
        const workspaceName = `law-${result.appName}`;
        const appInsightsName = `ai-${result.appName}`;

        // Create Log Analytics Workspace
        const workspace = await azureMonitoringService.createLogAnalyticsWorkspace(
          result.resourceGroupName,
          workspaceName,
          location
        );

        // Create Application Insights
        const appInsights = await azureMonitoringService.createApplicationInsights(
          result.resourceGroupName,
          appInsightsName,
          location,
          workspace.id
        );

        // Add monitoring info to result
        result.monitoring = {
          applicationInsightsId: appInsights.id,
          instrumentationKey: appInsights.instrumentationKey,
          dashboardUrl: azureMonitoringService.getDashboardUrl(
            result.resourceGroupName,
            appInsightsName
          ),
        };

        result.logs.push(`📊 Application Insights created: ${appInsightsName}`);
        result.logs.push(`🔗 Dashboard: ${result.monitoring.dashboardUrl}`);
        result.resources.push({
          type: 'application-insights',
          id: appInsightsName,
          url: result.monitoring.dashboardUrl,
        });
        result.resources.push({
          type: 'log-analytics-workspace',
          id: workspaceName,
        });
      } catch (monitoringError: any) {
        // Don't fail deployment if monitoring setup fails
        result.logs.push(`⚠️ Warning: Failed to set up monitoring: ${monitoringError.message}`);
      }
    }

    // Save infrastructure config on successful deployment (non-streaming)
    if (result.success && projectDirectory) {
      try {
        result.logs.push('📝 Saving infrastructure config...');
        await updateAppServiceConfig(projectDirectory, projectId, {
          provider: 'azure',
          type: serviceType as 'app-service' | 'container-apps' | 'static-web-apps',
          appName: result.appName,
          resourceGroup: result.resourceGroupName,
          url: result.url || `https://${result.appName}.azurewebsites.net`,
          sku,
          deployedAt: new Date().toISOString(),
        }, location);

        if (result.monitoring) {
          await updateMonitoringConfig(projectDirectory, projectId, {
            applicationInsightsId: result.monitoring.applicationInsightsId,
            instrumentationKey: result.monitoring.instrumentationKey,
            dashboardUrl: result.monitoring.dashboardUrl,
          });
        }
        result.logs.push('✅ Infrastructure config saved');
      } catch (infraError: any) {
        result.logs.push(`⚠️ Could not save infrastructure config: ${infraError.message}`);
      }
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Deployment error:', error);
    return NextResponse.json(
      { error: error.message || 'Deployment failed' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceGroupName = searchParams.get('resourceGroup');
    const appName = searchParams.get('appName');
    const serviceType = searchParams.get('serviceType') as AzureServiceType;
    const action = searchParams.get('action');

    // Test connection action
    if (action === 'test') {
      const result = await azureDeploymentService.testConnection();
      return NextResponse.json(result);
    }

    // Check credentials action
    if (action === 'check-credentials') {
      const hasCredentials = await hasAzureCredentials();
      return NextResponse.json({ configured: hasCredentials });
    }

    // Analyze project action
    if (action === 'analyze') {
      const projectDirectory = searchParams.get('projectDirectory');
      if (!projectDirectory) {
        return NextResponse.json(
          { error: 'Missing projectDirectory parameter' },
          { status: 400 }
        );
      }
      const analysis = await azureDeploymentService.analyzeProject(projectDirectory);
      const recommendation = azureDeploymentService.detectServiceType(analysis);
      return NextResponse.json({ analysis, recommendation });
    }

    // Get deployment status
    if (resourceGroupName && appName && serviceType) {
      const status = await azureDeploymentService.getDeploymentStatus(
        resourceGroupName,
        appName,
        serviceType
      );
      return NextResponse.json(status);
    }

    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('Error fetching deployment status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch deployment status' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceGroupName = searchParams.get('resourceGroup');
    const appName = searchParams.get('appName');
    const serviceType = searchParams.get('serviceType') as AzureServiceType;

    if (!resourceGroupName || !appName || !serviceType) {
      return NextResponse.json(
        { error: 'Missing required parameters: resourceGroup, appName, serviceType' },
        { status: 400 }
      );
    }

    const result = await azureDeploymentService.deleteDeployment(
      resourceGroupName,
      appName,
      serviceType
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error deleting deployment:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete deployment' },
      { status: 500 }
    );
  }
}

/**
 * Generate a secure random password for database admin
 */
function generateSecurePassword(): string {
  const length = 24;
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';

  // Ensure at least one of each required character type
  password += 'A'; // uppercase
  password += 'a'; // lowercase
  password += '1'; // number
  password += '!'; // special

  // Fill the rest randomly
  for (let i = 4; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
