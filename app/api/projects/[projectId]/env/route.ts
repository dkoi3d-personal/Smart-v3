import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// Sensitive keys that should always be masked
const SENSITIVE_PATTERNS = [
  'SECRET', 'PASSWORD', 'KEY', 'TOKEN', 'CREDENTIAL', 'AUTH', 'PRIVATE', 'API_KEY'
];

// Environment-specific defaults for database URLs
type EnvType = 'local' | 'dev' | 'staging' | 'production';

// Provisioned database info from .database.json
interface ProvisionedDatabaseConfig {
  provider: string;
  type: string;
  host?: string;
  port?: number;
  database?: string;
  connectionString?: string;
  ssl?: boolean;
}

function getDefaultDatabaseUrl(env: EnvType, projectName: string, provisionedDb?: ProvisionedDatabaseConfig | null): string {
  // Local always uses SQLite
  if (env === 'local') {
    return 'file:./dev.db';
  }

  // If we have a provisioned database, use its connection string for all cloud environments
  if (provisionedDb?.connectionString) {
    return provisionedDb.connectionString;
  }

  // If we have host/database components but no connection string, construct it
  if (provisionedDb?.host && provisionedDb?.database) {
    const port = provisionedDb.port || 5432;
    const ssl = provisionedDb.ssl !== false ? '?sslmode=require' : '';
    // Note: credentials need to be filled in by user
    return `postgresql://<user>:<password>@${provisionedDb.host}:${port}/${provisionedDb.database}${ssl}`;
  }

  // Fallback to placeholder (not yet provisioned)
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 20) || 'app';
  return `(not provisioned) postgresql://${sanitizedName}-${env}.postgres.database.azure.com`;
}

function getDefaultEnvVars(env: EnvType, projectName: string, provisionedDb?: ProvisionedDatabaseConfig | null): Record<string, string> {
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const baseUrl = env === 'local'
    ? 'http://localhost:3000'
    : env === 'production'
      ? `https://${sanitizedName}.azurewebsites.net`
      : `https://${sanitizedName}-${env}.azurewebsites.net`;

  return {
    DATABASE_URL: getDefaultDatabaseUrl(env, projectName, provisionedDb),
    NEXT_PUBLIC_API_URL: baseUrl,
    NODE_ENV: env === 'local' || env === 'dev' ? 'development' : env === 'staging' ? 'staging' : 'production',
    NEXTAUTH_URL: baseUrl,
  };
}

function shouldMask(key: string): boolean {
  const upperKey = key.toUpperCase();
  return SENSITIVE_PATTERNS.some(pattern => upperKey.includes(pattern));
}

function parseEnvFile(content: string): { key: string; value: string; masked: boolean }[] {
  const variables: { key: string; value: string; masked: boolean }[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const key = trimmed.substring(0, eqIndex).trim();
    let value = trimmed.substring(eqIndex + 1).trim();

    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!key || !value) continue;

    const masked = shouldMask(key);
    variables.push({
      key,
      value: masked ? '••••••••' : value,
      masked,
    });
  }

  return variables;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);

    // Get directory from query param or look up in projects.json
    let projectDir = searchParams.get('directory');
    let projectName = 'app';

    // Fallback: Load project to get directory and name
    try {
      const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
      const projectsData = await fs.readFile(projectsPath, 'utf-8');
      const projects = JSON.parse(projectsData);
      const project = projects.find((p: any) => p.id === projectId || p.projectId === projectId);
      if (project) {
        if (!projectDir) {
          projectDir = project.directory || project.projectDirectory;
        }
        projectName = project.config?.name || project.name || projectId.slice(0, 8);
      }
    } catch {
      // projects.json doesn't exist or can't be read
    }

    if (!projectDir) {
      return NextResponse.json({ error: 'Project directory not found' }, { status: 404 });
    }

    // Check if project has Prisma (needs DATABASE_URL)
    let hasPrisma = false;
    try {
      await fs.access(path.join(projectDir, 'prisma', 'schema.prisma'));
      hasPrisma = true;
    } catch {
      // No prisma
    }

    // Load provisioned database config if it exists
    let provisionedDb: ProvisionedDatabaseConfig | null = null;
    try {
      const dbConfigPath = path.join(projectDir, '.database.json');
      const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8');
      provisionedDb = JSON.parse(dbConfigContent);
    } catch {
      // No provisioned database yet
    }

    // Define env files per environment
    const envFilesByEnv = {
      base: ['.env', '.env.local'],
      local: ['.env', '.env.local'],
      dev: ['.env', '.env.local', '.env.development', '.env.development.local'],
      staging: ['.env', '.env.local', '.env.staging', '.env.staging.local'],
      production: ['.env', '.env.local', '.env.production', '.env.production.local'],
    };

    // Load base variables first
    const baseVariables: Map<string, { key: string; value: string; masked: boolean; source: string }> = new Map();
    for (const envFile of envFilesByEnv.base) {
      const envPath = path.join(projectDir, envFile);
      try {
        const content = await fs.readFile(envPath, 'utf-8');
        const vars = parseEnvFile(content);
        for (const v of vars) {
          baseVariables.set(v.key, { ...v, source: envFile });
        }
      } catch {
        // File doesn't exist
      }
    }

    // Load per-environment overrides from files
    const perEnvOverrides: { [env: string]: Map<string, string> } = {
      local: new Map(),
      dev: new Map(),
      staging: new Map(),
      production: new Map(),
    };

    for (const env of ['dev', 'staging', 'production'] as const) {
      const envSpecificFiles = envFilesByEnv[env].filter(f => !envFilesByEnv.base.includes(f));
      for (const envFile of envSpecificFiles) {
        const envPath = path.join(projectDir, envFile);
        try {
          const content = await fs.readFile(envPath, 'utf-8');
          const vars = parseEnvFile(content);
          for (const v of vars) {
            const rawValue = content.split('\n')
              .find(line => line.startsWith(v.key + '='))
              ?.split('=').slice(1).join('=').trim() || v.value;
            perEnvOverrides[env].set(v.key, shouldMask(v.key) ? '••••••••' : rawValue.replace(/^["']|["']$/g, ''));
          }
        } catch {
          // File doesn't exist
        }
      }
    }

    // Generate defaults for expected env variables if not found
    const expectedVars = ['DATABASE_URL', 'NEXT_PUBLIC_API_URL', 'NODE_ENV', 'NEXTAUTH_URL'];
    const environments: EnvType[] = ['local', 'dev', 'staging', 'production'];

    // Combine into final structure with perEnv values for all environments
    const allVariables: {
      key: string;
      value: string;
      masked: boolean;
      source: string;
      isDefault?: boolean;
      perEnv?: { local?: string; dev?: string; staging?: string; production?: string };
    }[] = [];

    // Add variables from files
    for (const [key, baseVar] of baseVariables) {
      const perEnv: { local?: string; dev?: string; staging?: string; production?: string } = {};

      // For each environment, use file value or generate default
      for (const env of environments) {
        if (perEnvOverrides[env].has(key)) {
          perEnv[env] = perEnvOverrides[env].get(key)!;
        } else if (expectedVars.includes(key)) {
          // Generate default for this key/env combo (use provisioned DB if available)
          const defaults = getDefaultEnvVars(env, projectName, provisionedDb);
          if (defaults[key]) {
            perEnv[env] = defaults[key];
          }
        }
      }

      allVariables.push({
        ...baseVar,
        perEnv: Object.keys(perEnv).length > 0 ? perEnv : undefined,
      });
    }

    // Add env-specific variables not in base
    for (const env of environments) {
      for (const [key, value] of perEnvOverrides[env]) {
        if (!baseVariables.has(key)) {
          const perEnv: { local?: string; dev?: string; staging?: string; production?: string } = { [env]: value };

          // Also add defaults for other environments
          for (const otherEnv of environments) {
            if (otherEnv !== env && expectedVars.includes(key)) {
              const defaults = getDefaultEnvVars(otherEnv, projectName, provisionedDb);
              if (defaults[key]) {
                perEnv[otherEnv] = defaults[key];
              }
            }
          }

          allVariables.push({
            key,
            value,
            masked: shouldMask(key),
            source: `.env.${env}`,
            perEnv,
          });
        }
      }
    }

    // If no env files exist but project has Prisma, add expected defaults
    if (allVariables.length === 0 && hasPrisma) {
      for (const key of expectedVars) {
        const perEnv: { local?: string; dev?: string; staging?: string; production?: string } = {};
        for (const env of environments) {
          const defaults = getDefaultEnvVars(env, projectName, provisionedDb);
          if (defaults[key]) {
            perEnv[env] = defaults[key];
          }
        }

        allVariables.push({
          key,
          value: getDefaultEnvVars('local', projectName, provisionedDb)[key] || '',
          masked: false,
          source: provisionedDb ? '.database.json' : 'default',
          isDefault: !provisionedDb,
          perEnv,
        });
      }
    }

    // Check if .env file DATABASE_URL differs from provisioned database
    let envNeedsSync = false;
    if (provisionedDb?.connectionString) {
      const currentDbUrl = baseVariables.get('DATABASE_URL')?.value;
      // Check if current value is SQLite or doesn't match provisioned
      if (currentDbUrl && (
        currentDbUrl.startsWith('file:') ||
        currentDbUrl === '••••••••' || // masked
        !currentDbUrl.includes(provisionedDb.host || '')
      )) {
        envNeedsSync = true;
      }
    }

    return NextResponse.json({
      variables: allVariables,
      sources: Object.values(envFilesByEnv).flat().filter((f, i, arr) => arr.indexOf(f) === i),
      hasPrisma,
      projectName,
      hasProvisionedDatabase: !!provisionedDb,
      provisionedDatabase: provisionedDb ? {
        provider: provisionedDb.provider,
        host: provisionedDb.host,
        database: provisionedDb.database,
      } : null,
      envNeedsSync, // true if .env file should be synced from provisioned database
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to load environment variables' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/[projectId]/env
 * Sync .env files with provisioned database configuration
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);

    // Get directory from query param or look up in projects.json
    let projectDir = searchParams.get('directory');

    // Fallback: Load project to get directory
    try {
      const projectsPath = path.join(process.cwd(), 'data', 'projects.json');
      const projectsData = await fs.readFile(projectsPath, 'utf-8');
      const projects = JSON.parse(projectsData);
      const project = projects.find((p: any) => p.id === projectId || p.projectId === projectId);
      if (project && !projectDir) {
        projectDir = project.directory || project.projectDirectory;
      }
    } catch {
      // projects.json doesn't exist or can't be read
    }

    if (!projectDir) {
      return NextResponse.json({ error: 'Project directory not found' }, { status: 404 });
    }

    // Load provisioned database config
    let provisionedDb: ProvisionedDatabaseConfig | null = null;
    try {
      const dbConfigPath = path.join(projectDir, '.database.json');
      const dbConfigContent = await fs.readFile(dbConfigPath, 'utf-8');
      provisionedDb = JSON.parse(dbConfigContent);
    } catch {
      return NextResponse.json({ error: 'No provisioned database found' }, { status: 400 });
    }

    if (!provisionedDb?.connectionString) {
      return NextResponse.json({
        error: 'Database config missing connection string. Database may need to be re-provisioned.'
      }, { status: 400 });
    }

    // Update .env file
    const envPath = path.join(projectDir, '.env');
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      // File doesn't exist, create it
    }

    // Replace or add DATABASE_URL
    if (envContent.includes('DATABASE_URL=')) {
      envContent = envContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${provisionedDb.connectionString}"`);
    } else {
      envContent += `\nDATABASE_URL="${provisionedDb.connectionString}"\n`;
    }

    await fs.writeFile(envPath, envContent.trim() + '\n', 'utf-8');

    // Also update .env.local if it exists and has DATABASE_URL
    const envLocalPath = path.join(projectDir, '.env.local');
    try {
      let envLocalContent = await fs.readFile(envLocalPath, 'utf-8');
      if (envLocalContent.includes('DATABASE_URL=')) {
        envLocalContent = envLocalContent.replace(/DATABASE_URL=.*/g, `DATABASE_URL="${provisionedDb.connectionString}"`);
        await fs.writeFile(envLocalPath, envLocalContent.trim() + '\n', 'utf-8');
      }
    } catch {
      // File doesn't exist, that's fine
    }

    // Update Prisma schema to use PostgreSQL if it's using SQLite
    const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
    try {
      let schemaContent = await fs.readFile(schemaPath, 'utf-8');
      if (schemaContent.includes('provider = "sqlite"')) {
        schemaContent = schemaContent.replace(
          /provider\s*=\s*["']sqlite["']/g,
          'provider = "postgresql"'
        );
        await fs.writeFile(schemaPath, schemaContent, 'utf-8');
      }
    } catch {
      // No prisma schema, that's fine
    }

    return NextResponse.json({
      success: true,
      message: 'Environment files synced with provisioned database',
      provider: provisionedDb.provider,
      host: provisionedDb.host,
      database: provisionedDb.database,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to sync environment files' },
      { status: 500 }
    );
  }
}
