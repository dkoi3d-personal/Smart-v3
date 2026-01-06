/**
 * Azure Infrastructure Service
 *
 * Provisions and manages Azure resources using the Azure SDK.
 * Uses Service Principal authentication with credentials from the credential store.
 */

import { ClientSecretCredential } from '@azure/identity';
import { PostgreSQLManagementFlexibleServerClient } from '@azure/arm-postgresql-flexible';
import { ResourceManagementClient } from '@azure/arm-resources';
import { getCredential } from '@/lib/credentials-store';

export interface AzureCredentials {
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface PostgresServerConfig {
  serverName: string;
  resourceGroupName: string;
  location: string;
  adminUsername: string;
  adminPassword: string;
  skuName?: string;
  storageSizeGB?: number;
  version?: string;
}

export interface ProvisionResult {
  success: boolean;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  error?: string;
}

/**
 * Load Azure credentials from the credential store
 */
export async function loadAzureCredentials(): Promise<AzureCredentials | null> {
  const creds = await getCredential('azure');
  if (!creds) {
    return null;
  }

  return {
    subscriptionId: creds.subscriptionId,
    tenantId: creds.tenantId,
    clientId: creds.clientId,
    clientSecret: creds.clientSecret,
  };
}

/**
 * Create Azure credential object for SDK authentication
 */
function createCredential(creds: AzureCredentials): ClientSecretCredential {
  return new ClientSecretCredential(
    creds.tenantId,
    creds.clientId,
    creds.clientSecret
  );
}

/**
 * Ensure a resource group exists
 */
export async function ensureResourceGroup(
  creds: AzureCredentials,
  resourceGroupName: string,
  location: string
): Promise<void> {
  const credential = createCredential(creds);
  const client = new ResourceManagementClient(credential, creds.subscriptionId);

  await client.resourceGroups.createOrUpdate(resourceGroupName, {
    location,
    tags: {
      createdBy: 'ai-dev-platform',
      managedBy: 'infrastructure-agent',
    },
  });
}

/**
 * Provision an Azure PostgreSQL Flexible Server
 */
export async function provisionPostgresServer(
  creds: AzureCredentials,
  config: PostgresServerConfig
): Promise<ProvisionResult> {
  try {
    const credential = createCredential(creds);

    // Ensure resource group exists
    await ensureResourceGroup(creds, config.resourceGroupName, config.location);

    // Create PostgreSQL client
    const pgClient = new PostgreSQLManagementFlexibleServerClient(
      credential,
      creds.subscriptionId
    );

    // Create the server
    const serverParams = {
      location: config.location,
      sku: {
        name: config.skuName || 'Standard_B1ms',
        tier: 'Burstable' as const,
      },
      administratorLogin: config.adminUsername,
      administratorLoginPassword: config.adminPassword,
      storage: {
        storageSizeGB: config.storageSizeGB || 32,
      },
      version: config.version || '16',
      backup: {
        backupRetentionDays: 7,
        geoRedundantBackup: 'Disabled' as const,
      },
      highAvailability: {
        mode: 'Disabled' as const,
      },
      tags: {
        createdBy: 'ai-dev-platform',
        managedBy: 'infrastructure-agent',
      },
    };

    console.log(`Creating PostgreSQL server: ${config.serverName}...`);

    // Create server and wait for completion
    const server = await pgClient.servers.beginCreateOrUpdateAndWait(
      config.resourceGroupName,
      config.serverName,
      serverParams
    );

    // Configure firewall to allow all Azure services and local development
    await pgClient.firewallRules.beginCreateOrUpdateAndWait(
      config.resourceGroupName,
      config.serverName,
      'AllowAllAzureServices',
      {
        startIpAddress: '0.0.0.0',
        endIpAddress: '0.0.0.0',
      }
    );

    // Allow all IPs for development (you may want to restrict this in production)
    await pgClient.firewallRules.beginCreateOrUpdateAndWait(
      config.resourceGroupName,
      config.serverName,
      'AllowAllForDev',
      {
        startIpAddress: '0.0.0.0',
        endIpAddress: '255.255.255.255',
      }
    );

    // Create a default database
    await pgClient.databases.beginCreateAndWait(
      config.resourceGroupName,
      config.serverName,
      'appdb',
      {
        charset: 'UTF8',
        collation: 'en_US.utf8',
      }
    );

    // Configure logging parameters for monitoring
    console.log(`Configuring logging for ${config.serverName}...`);
    try {
      // Enable logging of all SQL statements
      await pgClient.configurations.beginUpdateAndWait(
        config.resourceGroupName,
        config.serverName,
        'log_statement',
        { value: 'all', source: 'user-override' }
      );

      // Enable logging of statement duration
      await pgClient.configurations.beginUpdateAndWait(
        config.resourceGroupName,
        config.serverName,
        'log_duration',
        { value: 'on', source: 'user-override' }
      );

      // Log slow queries (> 1000ms)
      await pgClient.configurations.beginUpdateAndWait(
        config.resourceGroupName,
        config.serverName,
        'log_min_duration_statement',
        { value: '1000', source: 'user-override' }
      );

      console.log('Logging parameters configured successfully');
    } catch (logError) {
      // Don't fail provisioning if logging config fails
      console.warn('Could not configure logging parameters:', logError);
    }

    const host = server.fullyQualifiedDomainName || `${config.serverName}.postgres.database.azure.com`;
    const connectionString = `postgresql://${config.adminUsername}:${config.adminPassword}@${host}:5432/appdb?sslmode=require`;

    return {
      success: true,
      connectionString,
      host,
      port: 5432,
      database: 'appdb',
      username: config.adminUsername,
    };
  } catch (error: any) {
    console.error('Failed to provision PostgreSQL server:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Delete a PostgreSQL server
 */
export async function deletePostgresServer(
  creds: AzureCredentials,
  resourceGroupName: string,
  serverName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const credential = createCredential(creds);
    const pgClient = new PostgreSQLManagementFlexibleServerClient(
      credential,
      creds.subscriptionId
    );

    await pgClient.servers.beginDeleteAndWait(resourceGroupName, serverName);

    return { success: true };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * List all PostgreSQL servers in a subscription
 */
export async function listPostgresServers(
  creds: AzureCredentials
): Promise<Array<{ name: string; resourceGroup: string; location: string; state: string }>> {
  const credential = createCredential(creds);
  const pgClient = new PostgreSQLManagementFlexibleServerClient(
    credential,
    creds.subscriptionId
  );

  const servers: Array<{ name: string; resourceGroup: string; location: string; state: string }> = [];

  for await (const server of pgClient.servers.listBySubscription()) {
    // Extract resource group from the ID
    const idParts = server.id?.split('/') || [];
    const rgIndex = idParts.indexOf('resourceGroups');
    const resourceGroup = rgIndex >= 0 ? idParts[rgIndex + 1] : 'unknown';

    servers.push({
      name: server.name || 'unknown',
      resourceGroup,
      location: server.location || 'unknown',
      state: server.state || 'unknown',
    });
  }

  return servers;
}

/**
 * Get connection info for an existing PostgreSQL server
 */
export async function getPostgresConnectionInfo(
  creds: AzureCredentials,
  resourceGroupName: string,
  serverName: string
): Promise<{ host: string; port: number } | null> {
  try {
    const credential = createCredential(creds);
    const pgClient = new PostgreSQLManagementFlexibleServerClient(
      credential,
      creds.subscriptionId
    );

    const server = await pgClient.servers.get(resourceGroupName, serverName);

    if (server.fullyQualifiedDomainName) {
      return {
        host: server.fullyQualifiedDomainName,
        port: 5432,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Check if Azure credentials are configured
 */
export async function hasAzureCredentials(): Promise<boolean> {
  const creds = await loadAzureCredentials();
  return creds !== null &&
    !!creds.subscriptionId &&
    !!creds.tenantId &&
    !!creds.clientId &&
    !!creds.clientSecret;
}

export const azureInfrastructure = {
  loadAzureCredentials,
  hasAzureCredentials,
  ensureResourceGroup,
  provisionPostgresServer,
  deletePostgresServer,
  listPostgresServers,
  getPostgresConnectionInfo,
};

export default azureInfrastructure;
