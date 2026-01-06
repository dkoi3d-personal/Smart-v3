/**
 * Database Provisioning API
 *
 * POST /api/database/provision
 * Provisions a new database for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  provisionDatabase,
  setupPrismaInProject,
  updatePrismaSchemaForPostgres,
  checkExistingPrismaSchema,
  type DatabaseProvider,
  type ProvisionedDatabase,
} from '@/services/database-provisioning';
import {
  generateSchemaFromRequirements,
  requiresDatabase,
  suggestDatabaseProvider,
  schemaTemplates,
} from '@/services/schema-generator';
import { getProjectDir } from '@/lib/project-paths';
import { loadDatabaseCredentials } from '@/lib/credentials-store';
import { updateDatabaseConfig } from '@/lib/infrastructure-config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

import {
  applyMigrations,
  type MigrationStrategy,
} from '@/lib/database/migration-service';

/**
 * Push Prisma schema to the production database and optionally seed it
 *
 * For first-time provisioning (isFirstTime=true), uses push-force since there's no data
 * For subsequent deploys, uses safe migrations
 */
async function pushSchemaToDatabase(
  projectDir: string,
  connectionString: string,
  options: {
    isFirstTime?: boolean;
    strategy?: MigrationStrategy;
    seed?: boolean;
  } = {}
): Promise<{ pushed: boolean; seeded: boolean; error?: string; warnings?: string[] }> {
  const { isFirstTime = true, strategy, seed = true } = options;

  // For first-time setup, use push-force (no existing data to lose)
  // For subsequent deploys, default to safe migration
  const migrationStrategy: MigrationStrategy = strategy || (isFirstTime ? 'push-force' : 'migrate');

  console.log(`[Database Provision] Applying schema with '${migrationStrategy}' strategy...`);

  const result = await applyMigrations(
    projectDir,
    connectionString,
    migrationStrategy,
    {
      seed,
      force: isFirstTime // Auto-confirm for first-time setup
    }
  );

  return {
    pushed: result.success,
    seeded: result.success && seed,
    error: result.error,
    warnings: result.warnings,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectId,
      projectDirectory,
      provider,
      requirements,
      schemaTemplate,
      customSchema,
      dbName,
      location,
      // Migration options
      migrationStrategy, // 'migrate' | 'push-safe' | 'push-force' | 'reset' | 'none'
      isFirstTime = true, // true for first provisioning, false for re-deploys
      seedDatabase = true, // whether to run seed after schema push
    } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Use provided projectDirectory or derive from projectId
    const projectDir = projectDirectory || getProjectDir(projectId);

    // Verify project exists
    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Determine database provider
    const dbProvider: DatabaseProvider = provider || suggestDatabaseProvider(requirements || '');

    // Load credentials
    const credentials = await loadDatabaseCredentials();

    // Validate credentials for the provider
    if (dbProvider === 'neon' && !credentials.neonApiKey) {
      return NextResponse.json(
        { error: 'Neon API key not configured. Add it in Settings.' },
        { status: 400 }
      );
    }
    if (dbProvider === 'supabase' && !credentials.supabaseAccessToken) {
      return NextResponse.json(
        { error: 'Supabase access token not configured. Add it in Settings.' },
        { status: 400 }
      );
    }
    if (dbProvider === 'aws-rds' && (!credentials.awsAccessKeyId || !credentials.awsSecretAccessKey)) {
      return NextResponse.json(
        { error: 'AWS credentials not configured. Add them in Settings.' },
        { status: 400 }
      );
    }
    if (dbProvider === 'azure' && !(credentials as any).azureSubscriptionId) {
      return NextResponse.json(
        { error: 'Azure credentials not configured. Add them in Settings.' },
        { status: 400 }
      );
    }

    // Check if an existing Prisma schema exists
    const existingSchema = await checkExistingPrismaSchema(projectDir);

    // Provision the database
    console.log(`[Database Provision] Starting ${dbProvider} provisioning...`);
    console.log(`[Database Provision] Project: ${projectId}, Directory: ${projectDir}`);

    const databaseName = dbName || projectId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    console.log(`[Database Provision] Database name: ${databaseName}`);

    const database = await provisionDatabase(projectId, dbProvider, databaseName, {
      neonApiKey: credentials.neonApiKey,
      supabaseAccessToken: credentials.supabaseAccessToken,
      awsAccessKeyId: credentials.awsAccessKeyId,
      awsSecretAccessKey: credentials.awsSecretAccessKey,
      awsRegion: credentials.awsRegion,
      azureSubscriptionId: (credentials as any).azureSubscriptionId,
      azureResourceGroup: (credentials as any).azureResourceGroup,
      azureTenantId: (credentials as any).azureTenantId,
      azureClientId: (credentials as any).azureClientId,
      azureClientSecret: (credentials as any).azureClientSecret,
      azureLocation: location,
    });

    // If existing schema exists, just update the provider/connection string
    // This preserves existing models (like Lead, User, etc.)
    if (existingSchema.exists && existingSchema.modelCount && existingSchema.modelCount > 0) {
      await updatePrismaSchemaForPostgres(projectDir, database);

      // Save database config to project (legacy .database.json)
      const dbConfigPath = path.join(projectDir, '.database.json');
      await fs.writeFile(dbConfigPath, JSON.stringify({
        provider: database.provider,
        type: database.type,
        projectId: database.projectId,
        host: database.host,
        port: database.port,
        database: database.database,
        connectionString: database.connectionString, // Include connection string!
        ssl: database.ssl,
        supabaseUrl: database.supabaseUrl,
        rdsInstanceId: database.rdsInstanceId,
        provisionedAt: new Date().toISOString(),
      }, null, 2), 'utf-8');

      // Save to infrastructure config
      try {
        await updateDatabaseConfig(projectDir, projectId, {
          provider: database.provider as 'azure' | 'neon' | 'supabase' | 'aws-rds' | 'sqlite',
          type: database.type as 'postgresql' | 'mysql' | 'sqlite',
          host: database.host,
          port: database.port,
          database: database.database,
          ssl: database.ssl,
          resourceId: database.projectId,
          provisionedAt: new Date().toISOString(),
        }, location || 'eastus2');
        console.log('[Database Provision] Infrastructure config updated');
      } catch (infraError) {
        console.warn('[Database Provision] Could not update infrastructure config:', infraError);
      }

      // Push schema to production database (for cloud providers)
      // Existing models = not first time, use safe migration by default
      let schemaPushResult: { pushed: boolean; seeded: boolean; error?: string; warnings?: string[] } = { pushed: false, seeded: false };
      if (dbProvider !== 'sqlite' && database.connectionString) {
        console.log('[Database Provision] Pushing schema to production database...');
        schemaPushResult = await pushSchemaToDatabase(projectDir, database.connectionString, {
          isFirstTime: false, // Existing schema means existing data
          strategy: migrationStrategy,
          seed: seedDatabase,
        });
      }

      return NextResponse.json({
        success: true,
        database: {
          provider: database.provider,
          type: database.type,
          host: database.host,
          port: database.port,
          database: database.database,
          supabaseUrl: database.supabaseUrl,
        },
        existingModelsPreserved: true,
        models: existingSchema.models,
        schemaPushed: schemaPushResult.pushed,
        databaseSeeded: schemaPushResult.seeded,
        message: `Database provisioned with ${dbProvider}. Existing models preserved: ${existingSchema.models?.join(', ')}${schemaPushResult.pushed ? '. Schema pushed to database.' : ''}${schemaPushResult.seeded ? ' Database seeded.' : ''}`,
      });
    }

    // Generate or use provided schema for new projects
    let schema;
    if (customSchema) {
      schema = customSchema;
    } else if (schemaTemplate && schemaTemplates[schemaTemplate as keyof typeof schemaTemplates]) {
      schema = {
        tables: schemaTemplates[schemaTemplate as keyof typeof schemaTemplates](),
      };
    } else if (requirements) {
      schema = await generateSchemaFromRequirements({
        requirements,
        projectType: 'fullstack',
      });
    } else {
      // Default minimal schema
      schema = {
        tables: schemaTemplates.authentication(),
      };
    }

    // Setup Prisma in the project with new schema
    await setupPrismaInProject(projectDir, database, schema);

    // Save database config to project (legacy .database.json)
    const dbConfigPath2 = path.join(projectDir, '.database.json');
    await fs.writeFile(dbConfigPath2, JSON.stringify({
      provider: database.provider,
      type: database.type,
      projectId: database.projectId,
      host: database.host,
      port: database.port,
      database: database.database,
      connectionString: database.connectionString, // Include connection string!
      ssl: database.ssl,
      supabaseUrl: database.supabaseUrl,
      rdsInstanceId: database.rdsInstanceId,
      provisionedAt: new Date().toISOString(),
    }, null, 2), 'utf-8');

    // Save to infrastructure config
    try {
      await updateDatabaseConfig(projectDir, projectId, {
        provider: database.provider as 'azure' | 'neon' | 'supabase' | 'aws-rds' | 'sqlite',
        type: database.type as 'postgresql' | 'mysql' | 'sqlite',
        host: database.host,
        port: database.port,
        database: database.database,
        ssl: database.ssl,
        resourceId: database.projectId,
        provisionedAt: new Date().toISOString(),
      }, location || 'eastus2');
      console.log('[Database Provision] Infrastructure config updated');
    } catch (infraError) {
      console.warn('[Database Provision] Could not update infrastructure config:', infraError);
    }

    // Push schema to production database (for cloud providers)
    // New project = first time, can use push-force safely
    let schemaPushResult: { pushed: boolean; seeded: boolean; error?: string; warnings?: string[] } = { pushed: false, seeded: false };
    if (dbProvider !== 'sqlite' && database.connectionString) {
      console.log('[Database Provision] Pushing schema to production database...');
      schemaPushResult = await pushSchemaToDatabase(projectDir, database.connectionString, {
        isFirstTime: isFirstTime, // Use the provided value (defaults to true for new projects)
        strategy: migrationStrategy,
        seed: seedDatabase,
      });
    }

    return NextResponse.json({
      success: true,
      database: {
        provider: database.provider,
        type: database.type,
        host: database.host,
        port: database.port,
        database: database.database,
        supabaseUrl: database.supabaseUrl,
      },
      schema: {
        tables: schema.tables.map((t: any) => t.name),
      },
      schemaPushed: schemaPushResult.pushed,
      databaseSeeded: schemaPushResult.seeded,
      message: `Database provisioned successfully with ${dbProvider}${schemaPushResult.pushed ? '. Schema pushed to database.' : ''}${schemaPushResult.seeded ? ' Database seeded.' : ''}`,
    });

  } catch (error) {
    console.error('Database provisioning failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to provision database' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/database/provision?projectId=xxx
 * Get database status for a project
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectId = searchParams.get('projectId');

  if (!projectId) {
    return NextResponse.json(
      { error: 'Project ID is required' },
      { status: 400 }
    );
  }

  const projectDir = getProjectDir(projectId);

  try {
    const dbConfigPath = path.join(projectDir, '.database.json');
    const dbConfig = JSON.parse(await fs.readFile(dbConfigPath, 'utf-8'));

    return NextResponse.json({
      hasDatabase: true,
      ...dbConfig,
    });
  } catch {
    return NextResponse.json({
      hasDatabase: false,
    });
  }
}
