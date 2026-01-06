/**
 * Database Provisioning Service
 *
 * Handles provisioning databases for generated projects:
 * - Neon (Serverless Postgres)
 * - Supabase (Postgres + Auth + Realtime)
 * - AWS RDS (Managed Postgres/MySQL)
 * - SQLite (Local development)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type DatabaseProvider = 'sqlite' | 'neon' | 'supabase' | 'aws-rds' | 'azure';
export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite';

export interface DatabaseConfig {
  provider: DatabaseProvider;
  type: DatabaseType;
  name: string;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface ProvisionedDatabase {
  provider: DatabaseProvider;
  type: DatabaseType;
  connectionString: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  // Provider-specific
  projectId?: string;  // Neon project ID
  branchId?: string;   // Neon branch ID
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  rdsInstanceId?: string;
}

export interface DatabaseSchema {
  tables: TableDefinition[];
}

export interface TableDefinition {
  name: string;
  columns: ColumnDefinition[];
  indexes?: string[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  primaryKey?: boolean;
  unique?: boolean;
  nullable?: boolean;
  default?: string;
  references?: {
    table: string;
    column: string;
  };
}

/**
 * Provision a new database based on provider
 */
export async function provisionDatabase(
  projectId: string,
  provider: DatabaseProvider,
  dbName: string,
  credentials: {
    neonApiKey?: string;
    supabaseAccessToken?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
    azureSubscriptionId?: string;
    azureResourceGroup?: string;
    azureTenantId?: string;
    azureClientId?: string;
    azureClientSecret?: string;
    azureLocation?: string;
  }
): Promise<ProvisionedDatabase> {
  switch (provider) {
    case 'sqlite':
      return provisionSQLite(projectId, dbName);
    case 'neon':
      if (!credentials.neonApiKey) throw new Error('Neon API key required');
      return provisionNeon(dbName, credentials.neonApiKey);
    case 'supabase':
      if (!credentials.supabaseAccessToken) throw new Error('Supabase access token required');
      return provisionSupabase(dbName, credentials.supabaseAccessToken);
    case 'aws-rds':
      if (!credentials.awsAccessKeyId || !credentials.awsSecretAccessKey) {
        throw new Error('AWS credentials required');
      }
      return provisionRDS(dbName, {
        accessKeyId: credentials.awsAccessKeyId,
        secretAccessKey: credentials.awsSecretAccessKey,
        region: credentials.awsRegion || 'us-east-1',
      });
    case 'azure':
      if (!credentials.azureSubscriptionId) {
        throw new Error('Azure subscription ID required');
      }
      return provisionAzurePostgres(dbName, {
        subscriptionId: credentials.azureSubscriptionId,
        resourceGroup: credentials.azureResourceGroup || 'ai-platform-databases',
        tenantId: credentials.azureTenantId,
        clientId: credentials.azureClientId,
        clientSecret: credentials.azureClientSecret,
        location: credentials.azureLocation,
      });
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Provision SQLite database (local development)
 */
async function provisionSQLite(projectId: string, dbName: string): Promise<ProvisionedDatabase> {
  const dbPath = `./prisma/${dbName}.db`;

  return {
    provider: 'sqlite',
    type: 'sqlite',
    connectionString: `file:${dbPath}`,
    host: 'localhost',
    port: 0,
    database: dbName,
    username: '',
    password: '',
    ssl: false,
  };
}

/**
 * Provision Neon serverless Postgres database
 */
async function provisionNeon(dbName: string, apiKey: string): Promise<ProvisionedDatabase> {
  // First, get the user's organization ID
  const userResponse = await fetch('https://console.neon.tech/api/v2/users/me', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (!userResponse.ok) {
    const error = await userResponse.text();
    throw new Error(`Failed to get Neon user info: ${error}`);
  }

  const userData = await userResponse.json();

  // Get the org_id from the user's orgs - use the first one or personal org
  let orgId: string | undefined;

  // Try to get orgs list
  const orgsResponse = await fetch('https://console.neon.tech/api/v2/users/me/organizations', {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
    },
  });

  if (orgsResponse.ok) {
    const orgsData = await orgsResponse.json();
    // Use the first organization
    if (orgsData.organizations && orgsData.organizations.length > 0) {
      orgId = orgsData.organizations[0].id;
    }
  }

  if (!orgId) {
    throw new Error('No Neon organization found. Please create an organization at console.neon.tech');
  }

  // Create a new Neon project with org_id
  const createProjectResponse = await fetch('https://console.neon.tech/api/v2/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project: {
        name: dbName,
        region_id: 'aws-us-east-1',
        pg_version: 16,
        org_id: orgId,
      },
    }),
  });

  if (!createProjectResponse.ok) {
    const error = await createProjectResponse.text();
    throw new Error(`Failed to create Neon project: ${error}`);
  }

  const projectData = await createProjectResponse.json();
  const project = projectData.project;
  const connectionUri = projectData.connection_uris?.[0];

  if (!connectionUri) {
    throw new Error('No connection URI returned from Neon');
  }

  // Parse connection string
  const connUrl = new URL(connectionUri.connection_uri);

  return {
    provider: 'neon',
    type: 'postgresql',
    connectionString: connectionUri.connection_uri,
    host: connUrl.hostname,
    port: parseInt(connUrl.port) || 5432,
    database: connUrl.pathname.slice(1),
    username: connUrl.username,
    password: connUrl.password,
    ssl: true,
    projectId: project.id,
    branchId: projectData.branch?.id,
  };
}

/**
 * Provision Supabase project
 */
async function provisionSupabase(dbName: string, accessToken: string): Promise<ProvisionedDatabase> {
  // Create a new Supabase project
  const createProjectResponse = await fetch('https://api.supabase.com/v1/projects', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: dbName,
      organization_id: '', // Will need to be fetched first
      region: 'us-east-1',
      plan: 'free',
      db_pass: generatePassword(),
    }),
  });

  if (!createProjectResponse.ok) {
    const error = await createProjectResponse.text();
    throw new Error(`Failed to create Supabase project: ${error}`);
  }

  const project = await createProjectResponse.json();

  // Wait for project to be ready
  await waitForSupabaseProject(project.id, accessToken);

  // Get connection details
  const connectionResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/database/connection-string`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  const connectionData = await connectionResponse.json();
  const connUrl = new URL(connectionData.uri);

  return {
    provider: 'supabase',
    type: 'postgresql',
    connectionString: connectionData.uri,
    host: connUrl.hostname,
    port: parseInt(connUrl.port) || 5432,
    database: connUrl.pathname.slice(1),
    username: connUrl.username,
    password: connUrl.password,
    ssl: true,
    projectId: project.id,
    supabaseUrl: `https://${project.id}.supabase.co`,
    supabaseAnonKey: project.anon_key,
  };
}

/**
 * Wait for Supabase project to be ready
 */
async function waitForSupabaseProject(projectId: string, accessToken: string, maxWaitMs = 120000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectId}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    const project = await response.json();

    if (project.status === 'ACTIVE_HEALTHY') {
      return;
    }

    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Timeout waiting for Supabase project to be ready');
}

/**
 * Provision AWS RDS instance
 */
async function provisionRDS(
  dbName: string,
  awsCredentials: { accessKeyId: string; secretAccessKey: string; region: string }
): Promise<ProvisionedDatabase> {
  // For RDS, we'll generate Terraform config and apply it
  // This is more complex and requires Terraform to be installed

  const password = generatePassword();
  const instanceId = `${dbName}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  // We'll use AWS SDK directly for this
  const { RDSClient, CreateDBInstanceCommand, DescribeDBInstancesCommand } = await import('@aws-sdk/client-rds');

  const rdsClient = new RDSClient({
    region: awsCredentials.region,
    credentials: {
      accessKeyId: awsCredentials.accessKeyId,
      secretAccessKey: awsCredentials.secretAccessKey,
    },
  });

  // Create RDS instance
  await rdsClient.send(new CreateDBInstanceCommand({
    DBInstanceIdentifier: instanceId,
    DBInstanceClass: 'db.t3.micro',
    Engine: 'postgres',
    EngineVersion: '16',
    MasterUsername: 'postgres',
    MasterUserPassword: password,
    AllocatedStorage: 20,
    DBName: dbName.replace(/[^a-zA-Z0-9_]/g, '_'),
    PubliclyAccessible: true,
    StorageType: 'gp2',
    BackupRetentionPeriod: 7,
    MultiAZ: false,
    Tags: [
      { Key: 'ManagedBy', Value: 'ai-dev-platform' },
      { Key: 'Project', Value: dbName },
    ],
  }));

  // Wait for instance to be available
  let endpoint: string | undefined;
  let port: number = 5432;

  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));

    const describeResponse = await rdsClient.send(new DescribeDBInstancesCommand({
      DBInstanceIdentifier: instanceId,
    }));

    const instance = describeResponse.DBInstances?.[0];
    if (instance?.DBInstanceStatus === 'available' && instance.Endpoint) {
      endpoint = instance.Endpoint.Address;
      port = instance.Endpoint.Port || 5432;
      break;
    }
  }

  if (!endpoint) {
    throw new Error('Timeout waiting for RDS instance to be available');
  }

  const connectionString = `postgresql://postgres:${password}@${endpoint}:${port}/${dbName.replace(/[^a-zA-Z0-9_]/g, '_')}?sslmode=require`;

  return {
    provider: 'aws-rds',
    type: 'postgresql',
    connectionString,
    host: endpoint,
    port,
    database: dbName.replace(/[^a-zA-Z0-9_]/g, '_'),
    username: 'postgres',
    password,
    ssl: true,
    rdsInstanceId: instanceId,
  };
}

/**
 * Provision Azure PostgreSQL Flexible Server
 * Uses Azure Resource Manager REST API
 */
async function provisionAzurePostgres(
  dbName: string,
  azureCredentials: {
    subscriptionId: string;
    resourceGroup?: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
    location?: string;
  }
): Promise<ProvisionedDatabase> {
  console.log('[Azure PostgreSQL] Starting provisioning...');
  const password = generatePassword();
  const serverName = `${dbName.toLowerCase().replace(/[^a-z0-9]/g, '')}-${Date.now()}`.slice(0, 60);
  const resourceGroup = azureCredentials.resourceGroup || 'ai-platform-databases';
  const location = azureCredentials.location || 'eastus2'; // Default to eastus2 if not specified

  console.log(`[Azure PostgreSQL] Server name: ${serverName}`);
  console.log(`[Azure PostgreSQL] Resource group: ${resourceGroup}`);
  console.log(`[Azure PostgreSQL] Location: ${location}`);

  // Get access token
  let accessToken: string;

  if (azureCredentials.tenantId && azureCredentials.clientId && azureCredentials.clientSecret) {
    console.log('[Azure PostgreSQL] Using service principal authentication...');
    // Use service principal authentication
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${azureCredentials.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: azureCredentials.clientId,
          client_secret: azureCredentials.clientSecret,
          scope: 'https://management.azure.com/.default',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      throw new Error(`Failed to get Azure access token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
  } else {
    // Try to use Azure CLI credentials
    const { execSync } = await import('child_process');
    try {
      accessToken = execSync('az account get-access-token --query accessToken -o tsv', {
        encoding: 'utf-8',
      }).trim();
    } catch {
      throw new Error('Azure credentials not configured. Either set service principal credentials or login via Azure CLI.');
    }
  }

  // Ensure resource group exists
  const rgResponse = await fetch(
    `https://management.azure.com/subscriptions/${azureCredentials.subscriptionId}/resourceGroups/${resourceGroup}?api-version=2021-04-01`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location,
        tags: { ManagedBy: 'ai-dev-platform' },
      }),
    }
  );

  if (!rgResponse.ok && rgResponse.status !== 409) {
    const error = await rgResponse.text();
    throw new Error(`Failed to ensure resource group: ${error}`);
  }

  // Create PostgreSQL Flexible Server
  const serverResponse = await fetch(
    `https://management.azure.com/subscriptions/${azureCredentials.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${serverName}?api-version=2022-12-01`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location,
        sku: {
          name: 'Standard_B1ms',
          tier: 'Burstable',
        },
        properties: {
          version: '16',
          administratorLogin: 'pgadmin',
          administratorLoginPassword: password,
          storage: {
            storageSizeGB: 32,
          },
          backup: {
            backupRetentionDays: 7,
            geoRedundantBackup: 'Disabled',
          },
          network: {
            publicNetworkAccess: 'Enabled',
          },
          highAvailability: {
            mode: 'Disabled',
          },
        },
        tags: {
          ManagedBy: 'ai-dev-platform',
          Project: dbName,
        },
      }),
    }
  );

  if (!serverResponse.ok) {
    const error = await serverResponse.text();
    throw new Error(`Failed to create Azure PostgreSQL server: ${error}`);
  }

  // Wait for server to be provisioned
  console.log('[Azure PostgreSQL] Waiting for server to be provisioned...');
  let serverHost: string | undefined;
  for (let i = 0; i < 60; i++) {
    await new Promise(resolve => setTimeout(resolve, 10000));

    console.log(`[Azure PostgreSQL] Polling status (attempt ${i + 1}/60)...`);

    const statusResponse = await fetch(
      `https://management.azure.com/subscriptions/${azureCredentials.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${serverName}?api-version=2022-12-01`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (statusResponse.ok) {
      const serverData = await statusResponse.json();
      const state = serverData.properties?.state;
      console.log(`[Azure PostgreSQL] Server state: ${state}`);

      if (state === 'Ready' && serverData.properties?.fullyQualifiedDomainName) {
        serverHost = serverData.properties.fullyQualifiedDomainName;
        console.log(`[Azure PostgreSQL] Server ready: ${serverHost}`);
        break;
      } else if (state === 'Failed') {
        // Check for provisioning failure
        const errorMessage = serverData.properties?.message || 'Unknown provisioning error';
        console.error(`[Azure PostgreSQL] Provisioning failed: ${errorMessage}`);
        throw new Error(`Azure PostgreSQL provisioning failed: ${errorMessage}`);
      }
    } else {
      const errorText = await statusResponse.text();
      console.error(`[Azure PostgreSQL] Status check failed: ${errorText}`);
    }
  }

  if (!serverHost) {
    throw new Error('Timeout waiting for Azure PostgreSQL server to be ready (10 minutes exceeded)');
  }

  // Create firewall rule to allow all Azure services and external access (for demo)
  await fetch(
    `https://management.azure.com/subscriptions/${azureCredentials.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${serverName}/firewallRules/AllowAll?api-version=2022-12-01`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          startIpAddress: '0.0.0.0',
          endIpAddress: '255.255.255.255',
        },
      }),
    }
  );

  // Create the database
  // Database names must start with a letter or underscore, not a number
  let sanitizedDbName = dbName.replace(/[^a-zA-Z0-9_]/g, '_');
  // If name starts with a number, prefix with 'db_'
  if (/^[0-9]/.test(sanitizedDbName)) {
    sanitizedDbName = 'db_' + sanitizedDbName;
  }
  await fetch(
    `https://management.azure.com/subscriptions/${azureCredentials.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${serverName}/databases/${sanitizedDbName}?api-version=2022-12-01`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          charset: 'UTF8',
          collation: 'en_US.utf8',
        },
      }),
    }
  );

  const connectionString = `postgresql://pgadmin:${encodeURIComponent(password)}@${serverHost}:5432/${sanitizedDbName}?sslmode=require`;

  return {
    provider: 'azure',
    type: 'postgresql',
    connectionString,
    host: serverHost,
    port: 5432,
    database: sanitizedDbName,
    username: 'pgadmin',
    password,
    ssl: true,
    projectId: serverName,
  };
}

/**
 * Generate Prisma schema from table definitions
 */
export function generatePrismaSchema(schema: DatabaseSchema, provider: DatabaseProvider): string {
  const datasourceProvider = provider === 'sqlite' ? 'sqlite' : 'postgresql';

  let prismaSchema = `// Generated by AI Dev Platform
// This is your Prisma schema file

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "${datasourceProvider}"
  url      = env("DATABASE_URL")
}

`;

  for (const table of schema.tables) {
    const modelName = toPascalCase(table.name);
    prismaSchema += `model ${modelName} {\n`;

    for (const col of table.columns) {
      let line = `  ${col.name} `;
      line += mapToPrismaType(col.type);

      if (col.nullable) line += '?';
      if (col.primaryKey) line += ' @id';
      if (col.unique && !col.primaryKey) line += ' @unique';
      if (col.default) {
        if (col.default === 'autoincrement()') {
          line += ' @default(autoincrement())';
        } else if (col.default === 'now()') {
          line += ' @default(now())';
        } else if (col.default === 'uuid()') {
          line += ' @default(uuid())';
        } else {
          line += ` @default(${col.default})`;
        }
      }

      prismaSchema += line + '\n';
    }

    // Add timestamps if not present
    const hasCreatedAt = table.columns.some(c => c.name === 'createdAt' || c.name === 'created_at');
    const hasUpdatedAt = table.columns.some(c => c.name === 'updatedAt' || c.name === 'updated_at');

    if (!hasCreatedAt) {
      prismaSchema += `  createdAt DateTime @default(now())\n`;
    }
    if (!hasUpdatedAt) {
      prismaSchema += `  updatedAt DateTime @updatedAt\n`;
    }

    prismaSchema += `\n  @@map("${table.name}")\n}\n\n`;
  }

  return prismaSchema;
}

/**
 * Generate SQL migration from schema
 */
export function generateSQLMigration(schema: DatabaseSchema, provider: DatabaseProvider): string {
  let sql = `-- Migration generated by AI Dev Platform
-- Provider: ${provider}
-- Generated: ${new Date().toISOString()}

`;

  for (const table of schema.tables) {
    sql += `CREATE TABLE IF NOT EXISTS "${table.name}" (\n`;

    const columnDefs: string[] = [];

    for (const col of table.columns) {
      let def = `  "${col.name}" ${mapToSQLType(col.type, provider)}`;
      if (col.primaryKey) {
        def += provider === 'sqlite' ? ' PRIMARY KEY' : ' PRIMARY KEY';
      }
      if (col.unique && !col.primaryKey) def += ' UNIQUE';
      if (!col.nullable && !col.primaryKey) def += ' NOT NULL';
      if (col.default) {
        if (col.default === 'autoincrement()') {
          // Handled by SERIAL in postgres or AUTOINCREMENT in sqlite
        } else if (col.default === 'now()') {
          def += provider === 'sqlite' ? " DEFAULT (datetime('now'))" : ' DEFAULT NOW()';
        } else if (col.default === 'uuid()') {
          def += provider === 'sqlite' ? '' : ' DEFAULT gen_random_uuid()';
        } else {
          def += ` DEFAULT ${col.default}`;
        }
      }
      columnDefs.push(def);
    }

    // Add timestamps
    const hasCreatedAt = table.columns.some(c => c.name === 'createdAt' || c.name === 'created_at');
    const hasUpdatedAt = table.columns.some(c => c.name === 'updatedAt' || c.name === 'updated_at');

    if (!hasCreatedAt) {
      columnDefs.push(provider === 'sqlite'
        ? `  "createdAt" TEXT DEFAULT (datetime('now'))`
        : `  "createdAt" TIMESTAMP DEFAULT NOW()`);
    }
    if (!hasUpdatedAt) {
      columnDefs.push(provider === 'sqlite'
        ? `  "updatedAt" TEXT DEFAULT (datetime('now'))`
        : `  "updatedAt" TIMESTAMP DEFAULT NOW()`);
    }

    sql += columnDefs.join(',\n');
    sql += '\n);\n\n';

    // Add indexes
    if (table.indexes) {
      for (const idx of table.indexes) {
        sql += `CREATE INDEX IF NOT EXISTS "idx_${table.name}_${idx}" ON "${table.name}"("${idx}");\n`;
      }
      sql += '\n';
    }
  }

  return sql;
}

/**
 * Setup Prisma in a project
 */
export async function setupPrismaInProject(
  projectDir: string,
  database: ProvisionedDatabase,
  schema: DatabaseSchema
): Promise<void> {
  const prismaDir = path.join(projectDir, 'prisma');
  await fs.mkdir(prismaDir, { recursive: true });

  // Generate and write Prisma schema
  const prismaSchema = generatePrismaSchema(schema, database.provider);
  await fs.writeFile(path.join(prismaDir, 'schema.prisma'), prismaSchema, 'utf-8');

  // Update .env file with DATABASE_URL
  const envPath = path.join(projectDir, '.env');
  let envContent = '';
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  // Add or update DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${database.connectionString}"`);
  } else {
    envContent += `\nDATABASE_URL="${database.connectionString}"\n`;
  }

  // Add Supabase keys if applicable
  if (database.supabaseUrl) {
    if (!envContent.includes('NEXT_PUBLIC_SUPABASE_URL=')) {
      envContent += `NEXT_PUBLIC_SUPABASE_URL="${database.supabaseUrl}"\n`;
    }
    if (!envContent.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY=') && database.supabaseAnonKey) {
      envContent += `NEXT_PUBLIC_SUPABASE_ANON_KEY="${database.supabaseAnonKey}"\n`;
    }
  }

  await fs.writeFile(envPath, envContent.trim() + '\n', 'utf-8');

  // Update package.json to add Prisma
  const packageJsonPath = path.join(projectDir, 'package.json');
  try {
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));

    packageJson.dependencies = packageJson.dependencies || {};
    packageJson.devDependencies = packageJson.devDependencies || {};

    packageJson.dependencies['@prisma/client'] = '^5.22.0';
    packageJson.devDependencies['prisma'] = '^5.22.0';

    // Add Supabase client if using Supabase
    if (database.provider === 'supabase') {
      packageJson.dependencies['@supabase/supabase-js'] = '^2.45.0';
    }

    // Add scripts for Prisma
    packageJson.scripts = packageJson.scripts || {};
    packageJson.scripts['db:generate'] = 'prisma generate';
    packageJson.scripts['db:push'] = 'prisma db push';
    packageJson.scripts['db:migrate'] = 'prisma migrate dev';
    packageJson.scripts['db:studio'] = 'prisma studio';
    packageJson.scripts['postinstall'] = 'prisma generate';

    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to update package.json:', error);
  }

  // Create a db.ts utility file
  const libDir = path.join(projectDir, 'lib');
  await fs.mkdir(libDir, { recursive: true });

  const dbUtilContent = `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
`;

  await fs.writeFile(path.join(libDir, 'db.ts'), dbUtilContent, 'utf-8');

  // If using Supabase, also create a Supabase client
  if (database.provider === 'supabase') {
    const supabaseClientContent = `import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default supabase;
`;
    await fs.writeFile(path.join(libDir, 'supabase.ts'), supabaseClientContent, 'utf-8');
  }
}

/**
 * Delete a provisioned database
 */
export async function deleteProvisionedDatabase(
  database: ProvisionedDatabase,
  credentials: {
    neonApiKey?: string;
    supabaseAccessToken?: string;
    awsAccessKeyId?: string;
    awsSecretAccessKey?: string;
    awsRegion?: string;
  }
): Promise<void> {
  switch (database.provider) {
    case 'sqlite':
      // SQLite files are deleted with the project
      return;

    case 'neon':
      if (database.projectId && credentials.neonApiKey) {
        await fetch(`https://console.neon.tech/api/v2/projects/${database.projectId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${credentials.neonApiKey}`,
          },
        });
      }
      break;

    case 'supabase':
      if (database.projectId && credentials.supabaseAccessToken) {
        await fetch(`https://api.supabase.com/v1/projects/${database.projectId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${credentials.supabaseAccessToken}`,
          },
        });
      }
      break;

    case 'aws-rds':
      if (database.rdsInstanceId && credentials.awsAccessKeyId && credentials.awsSecretAccessKey) {
        const { RDSClient, DeleteDBInstanceCommand } = await import('@aws-sdk/client-rds');

        const rdsClient = new RDSClient({
          region: credentials.awsRegion || 'us-east-1',
          credentials: {
            accessKeyId: credentials.awsAccessKeyId,
            secretAccessKey: credentials.awsSecretAccessKey,
          },
        });

        await rdsClient.send(new DeleteDBInstanceCommand({
          DBInstanceIdentifier: database.rdsInstanceId,
          SkipFinalSnapshot: true,
          DeleteAutomatedBackups: true,
        }));
      }
      break;
  }
}

// Helper functions
function generatePassword(length = 24): string {
  // Only use URL-safe characters to avoid encoding issues in connection strings
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function toPascalCase(str: string): string {
  return str
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function mapToPrismaType(sqlType: string): string {
  const typeMap: Record<string, string> = {
    'id': 'Int',
    'uuid': 'String',
    'string': 'String',
    'text': 'String',
    'varchar': 'String',
    'int': 'Int',
    'integer': 'Int',
    'bigint': 'BigInt',
    'float': 'Float',
    'double': 'Float',
    'decimal': 'Decimal',
    'boolean': 'Boolean',
    'bool': 'Boolean',
    'datetime': 'DateTime',
    'timestamp': 'DateTime',
    'date': 'DateTime',
    'json': 'Json',
    'jsonb': 'Json',
  };

  return typeMap[sqlType.toLowerCase()] || 'String';
}

function mapToSQLType(type: string, provider: DatabaseProvider): string {
  if (provider === 'sqlite') {
    const sqliteMap: Record<string, string> = {
      'id': 'INTEGER',
      'uuid': 'TEXT',
      'string': 'TEXT',
      'text': 'TEXT',
      'int': 'INTEGER',
      'integer': 'INTEGER',
      'bigint': 'INTEGER',
      'float': 'REAL',
      'double': 'REAL',
      'decimal': 'REAL',
      'boolean': 'INTEGER',
      'bool': 'INTEGER',
      'datetime': 'TEXT',
      'timestamp': 'TEXT',
      'date': 'TEXT',
      'json': 'TEXT',
    };
    return sqliteMap[type.toLowerCase()] || 'TEXT';
  }

  // PostgreSQL types
  const pgMap: Record<string, string> = {
    'id': 'SERIAL',
    'uuid': 'UUID',
    'string': 'VARCHAR(255)',
    'text': 'TEXT',
    'int': 'INTEGER',
    'integer': 'INTEGER',
    'bigint': 'BIGINT',
    'float': 'REAL',
    'double': 'DOUBLE PRECISION',
    'decimal': 'DECIMAL',
    'boolean': 'BOOLEAN',
    'bool': 'BOOLEAN',
    'datetime': 'TIMESTAMP',
    'timestamp': 'TIMESTAMP',
    'date': 'DATE',
    'json': 'JSONB',
    'jsonb': 'JSONB',
  };
  return pgMap[type.toLowerCase()] || 'VARCHAR(255)';
}

/**
 * Update an existing Prisma schema to use PostgreSQL instead of SQLite
 * Preserves all existing models and only changes the datasource configuration
 */
export async function updatePrismaSchemaForPostgres(
  projectDir: string,
  database: ProvisionedDatabase
): Promise<void> {
  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');

  let schemaContent: string;
  try {
    schemaContent = await fs.readFile(schemaPath, 'utf-8');
  } catch {
    throw new Error('No existing Prisma schema found');
  }

  // Update the datasource provider from sqlite to postgresql
  let updatedSchema = schemaContent.replace(
    /provider\s*=\s*["']sqlite["']/g,
    'provider = "postgresql"'
  );

  // Update the url to use DATABASE_URL env var (should already be there, but ensure it)
  updatedSchema = updatedSchema.replace(
    /url\s*=\s*["'][^"']*["']/g,
    'url = env("DATABASE_URL")'
  );

  // If the datasource block is missing, add it
  if (!updatedSchema.includes('datasource db')) {
    const datasourceBlock = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`;
    updatedSchema = datasourceBlock + updatedSchema;
  }

  await fs.writeFile(schemaPath, updatedSchema, 'utf-8');

  // Update .env file with new DATABASE_URL
  const envPath = path.join(projectDir, '.env');
  let envContent = '';
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch {
    // File doesn't exist
  }

  // Replace or add DATABASE_URL
  if (envContent.includes('DATABASE_URL=')) {
    envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${database.connectionString}"`);
  } else {
    envContent += `\nDATABASE_URL="${database.connectionString}"\n`;
  }

  await fs.writeFile(envPath, envContent.trim() + '\n', 'utf-8');

  // Also update .env.local if it exists
  const envLocalPath = path.join(projectDir, '.env.local');
  try {
    let envLocalContent = await fs.readFile(envLocalPath, 'utf-8');
    if (envLocalContent.includes('DATABASE_URL=')) {
      envLocalContent = envLocalContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${database.connectionString}"`);
      await fs.writeFile(envLocalPath, envLocalContent.trim() + '\n', 'utf-8');
    }
  } catch {
    // File doesn't exist, that's fine
  }
}

/**
 * Check if an existing Prisma schema exists and extract info about it
 */
export async function checkExistingPrismaSchema(projectDir: string): Promise<{
  exists: boolean;
  provider?: string;
  modelCount?: number;
  models?: string[];
}> {
  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');

  try {
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');

    // Extract provider
    const providerMatch = schemaContent.match(/provider\s*=\s*["'](\w+)["']/);
    const provider = providerMatch ? providerMatch[1] : undefined;

    // Extract model names
    const modelMatches = schemaContent.matchAll(/model\s+(\w+)\s*\{/g);
    const models = Array.from(modelMatches).map(m => m[1]);

    return {
      exists: true,
      provider,
      modelCount: models.length,
      models,
    };
  } catch {
    return { exists: false };
  }
}

/**
 * List deployed Azure PostgreSQL Flexible Servers
 */
export async function listAzurePostgresServers(credentials: {
  subscriptionId: string;
  resourceGroup?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
}): Promise<{
  servers: {
    name: string;
    resourceGroup: string;
    location: string;
    state: string;
    version: string;
    host: string;
    sku: string;
    tier: string;
    storageSizeGB: number;
    databases: string[];
    createdAt?: string;
    tags?: Record<string, string>;
  }[];
}> {
  let accessToken: string;

  if (credentials.tenantId && credentials.clientId && credentials.clientSecret) {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: 'https://management.azure.com/.default',
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Azure access token');
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
  } else {
    const { execSync } = await import('child_process');
    try {
      accessToken = execSync('az account get-access-token --query accessToken -o tsv', {
        encoding: 'utf-8',
      }).trim();
    } catch {
      throw new Error('Azure credentials not configured');
    }
  }

  // List PostgreSQL Flexible Servers in the subscription (or specific resource group)
  let url = `https://management.azure.com/subscriptions/${credentials.subscriptionId}`;
  if (credentials.resourceGroup) {
    url += `/resourceGroups/${credentials.resourceGroup}`;
  }
  url += `/providers/Microsoft.DBforPostgreSQL/flexibleServers?api-version=2022-12-01`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to list Azure PostgreSQL servers: ${error}`);
  }

  const data = await response.json();
  const servers: {
    name: string;
    resourceGroup: string;
    location: string;
    state: string;
    version: string;
    host: string;
    sku: string;
    tier: string;
    storageSizeGB: number;
    databases: string[];
    createdAt?: string;
    tags?: Record<string, string>;
  }[] = [];

  for (const server of data.value || []) {
    // Extract resource group from the server ID
    const rgMatch = server.id?.match(/resourceGroups\/([^/]+)\//i);
    const resourceGroup = rgMatch ? rgMatch[1] : '';

    // Get databases for this server
    const dbUrl = `https://management.azure.com/subscriptions/${credentials.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${server.name}/databases?api-version=2022-12-01`;
    let databases: string[] = [];
    try {
      const dbResponse = await fetch(dbUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (dbResponse.ok) {
        const dbData = await dbResponse.json();
        databases = (dbData.value || [])
          .map((db: any) => db.name)
          .filter((name: string) => !['postgres', 'azure_maintenance', 'azure_sys'].includes(name));
      }
    } catch {
      // Ignore errors fetching databases
    }

    servers.push({
      name: server.name,
      resourceGroup,
      location: server.location,
      state: server.properties?.state || 'Unknown',
      version: server.properties?.version || 'Unknown',
      host: server.properties?.fullyQualifiedDomainName || '',
      sku: server.sku?.name || 'Unknown',
      tier: server.sku?.tier || 'Unknown',
      storageSizeGB: server.properties?.storage?.storageSizeGB || 0,
      databases,
      createdAt: server.properties?.earliestRestoreDate,
      tags: server.tags,
    });
  }

  return { servers };
}

/**
 * Test connection to a PostgreSQL database
 */
export async function testDatabaseConnection(connectionString: string): Promise<{
  success: boolean;
  message: string;
  latencyMs?: number;
}> {
  const startTime = Date.now();

  try {
    // Use node-postgres to test the connection
    const { Client } = await import('pg');
    const client = new Client({ connectionString });

    await client.connect();
    await client.query('SELECT 1');
    await client.end();

    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      message: 'Connection successful',
      latencyMs,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || 'Connection failed',
    };
  }
}

/**
 * Get database metrics from Azure Monitor
 */
export async function getAzurePostgresMetrics(
  serverName: string,
  resourceGroup: string,
  credentials: {
    subscriptionId: string;
    tenantId?: string;
    clientId?: string;
    clientSecret?: string;
  }
): Promise<{
  cpu: number;
  memory: number;
  storage: number;
  connections: number;
}> {
  let accessToken: string;

  if (credentials.tenantId && credentials.clientId && credentials.clientSecret) {
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${credentials.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: credentials.clientId,
          client_secret: credentials.clientSecret,
          scope: 'https://management.azure.com/.default',
        }),
      }
    );

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Azure access token');
    }

    const tokenData = await tokenResponse.json();
    accessToken = tokenData.access_token;
  } else {
    const { execSync } = await import('child_process');
    try {
      accessToken = execSync('az account get-access-token --query accessToken -o tsv', {
        encoding: 'utf-8',
      }).trim();
    } catch {
      throw new Error('Azure credentials not configured');
    }
  }

  const resourceId = `/subscriptions/${credentials.subscriptionId}/resourceGroups/${resourceGroup}/providers/Microsoft.DBforPostgreSQL/flexibleServers/${serverName}`;
  const endTime = new Date().toISOString();
  const startTime = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // Last 5 minutes

  const metrics = ['cpu_percent', 'memory_percent', 'storage_percent', 'active_connections'];
  const results: Record<string, number> = {};

  for (const metric of metrics) {
    try {
      const url = `https://management.azure.com${resourceId}/providers/microsoft.insights/metrics?api-version=2021-05-01&metricnames=${metric}&timespan=${startTime}/${endTime}&interval=PT1M`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (response.ok) {
        const data = await response.json();
        const timeseries = data.value?.[0]?.timeseries?.[0]?.data || [];
        // Get the latest value
        const latestValue = timeseries[timeseries.length - 1]?.average ?? 0;
        results[metric] = latestValue;
      }
    } catch {
      results[metric] = 0;
    }
  }

  return {
    cpu: results['cpu_percent'] || 0,
    memory: results['memory_percent'] || 0,
    storage: results['storage_percent'] || 0,
    connections: results['active_connections'] || 0,
  };
}

export default {
  provisionDatabase,
  deleteProvisionedDatabase,
  generatePrismaSchema,
  generateSQLMigration,
  setupPrismaInProject,
  updatePrismaSchemaForPostgres,
  checkExistingPrismaSchema,
  listAzurePostgresServers,
  testDatabaseConnection,
  getAzurePostgresMetrics,
};
