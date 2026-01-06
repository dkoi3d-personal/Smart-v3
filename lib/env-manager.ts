/**
 * Environment Manager
 * Handles switching between local (SQLite) and deployed (PostgreSQL) environments.
 *
 * File structure:
 * - .env.example      - Template (committed to git) with SQLite for local dev
 * - .env.local        - Local overrides (gitignored) - SQLite DATABASE_URL
 * - .env.development  - Dev server PostgreSQL URL (saved after deploy)
 * - .env.staging      - Staging PostgreSQL URL (saved after deploy)
 * - .env.production   - Production PostgreSQL URL (saved after deploy)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export type Environment = 'local' | 'development' | 'staging' | 'production';

interface EnvConfig {
  DATABASE_URL: string;
  [key: string]: string;
}

/**
 * Get the .env filename for an environment
 */
export function getEnvFilename(environment: Environment): string {
  switch (environment) {
    case 'local':
      return '.env.local';
    case 'development':
      return '.env.development';
    case 'staging':
      return '.env.staging';
    case 'production':
      return '.env.production';
    default:
      return '.env.local';
  }
}

/**
 * Parse a .env file into key-value pairs
 */
export function parseEnvFile(content: string): Record<string, string> {
  const vars: Record<string, string> = {};
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

    if (key) {
      vars[key] = value;
    }
  }

  return vars;
}

/**
 * Serialize env vars to .env file format
 */
export function serializeEnvFile(vars: Record<string, string>): string {
  const lines: string[] = [
    `# Auto-generated environment file`,
    `# Generated at: ${new Date().toISOString()}`,
    '',
  ];

  for (const [key, value] of Object.entries(vars)) {
    // Quote values that contain spaces or special characters
    const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
    const formattedValue = needsQuotes ? `"${value}"` : value;
    lines.push(`${key}=${formattedValue}`);
  }

  return lines.join('\n') + '\n';
}

/**
 * Load environment variables from a specific environment file
 */
export async function loadEnvFile(
  projectDir: string,
  environment: Environment
): Promise<Record<string, string> | null> {
  const filename = getEnvFilename(environment);
  const envPath = path.join(projectDir, filename);

  try {
    const content = await fs.readFile(envPath, 'utf-8');
    return parseEnvFile(content);
  } catch {
    return null;
  }
}

/**
 * Save environment variables to a specific environment file
 */
export async function saveEnvFile(
  projectDir: string,
  environment: Environment,
  vars: Record<string, string>,
  merge: boolean = true
): Promise<void> {
  const filename = getEnvFilename(environment);
  const envPath = path.join(projectDir, filename);

  let finalVars = { ...vars };

  // Merge with existing if requested
  if (merge) {
    const existing = await loadEnvFile(projectDir, environment);
    if (existing) {
      finalVars = { ...existing, ...vars };
    }
  }

  await fs.writeFile(envPath, serializeEnvFile(finalVars), 'utf-8');
}

/**
 * Save DATABASE_URL for a deployed environment
 */
export async function saveDatabaseUrl(
  projectDir: string,
  environment: Environment,
  databaseUrl: string
): Promise<void> {
  await saveEnvFile(projectDir, environment, {
    DATABASE_URL: databaseUrl,
  }, true);
}

/**
 * Switch Prisma schema provider between SQLite and PostgreSQL
 */
export async function switchPrismaProvider(
  projectDir: string,
  provider: 'sqlite' | 'postgresql',
  log?: (message: string) => void
): Promise<boolean> {
  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');

  try {
    await fs.access(schemaPath);
  } catch {
    log?.('No Prisma schema found');
    return false;
  }

  let schema = await fs.readFile(schemaPath, 'utf-8');
  const currentProvider = schema.includes('provider = "sqlite"') ? 'sqlite' :
                          schema.includes('provider = "postgresql"') ? 'postgresql' : null;

  if (currentProvider === provider) {
    log?.(`Schema already uses ${provider}`);
    return true;
  }

  if (provider === 'sqlite') {
    // Switch to SQLite
    schema = schema.replace(/provider\s*=\s*["']postgresql["']/g, 'provider = "sqlite"');
    // Remove PostgreSQL-specific features
    schema = schema.replace(/@db\.\w+(\([^)]*\))?/g, '');
    log?.('Switched schema to SQLite');
  } else {
    // Switch to PostgreSQL
    schema = schema.replace(/provider\s*=\s*["']sqlite["']/g, 'provider = "postgresql"');
    log?.('Switched schema to PostgreSQL');
  }

  await fs.writeFile(schemaPath, schema, 'utf-8');
  return true;
}

/**
 * Setup local development environment
 * - Creates .env.local with SQLite DATABASE_URL
 * - Switches Prisma schema to SQLite
 */
export async function setupLocalEnvironment(
  projectDir: string,
  log?: (message: string) => void
): Promise<void> {
  // 1. Create .env.local if it doesn't exist
  const envLocalPath = path.join(projectDir, '.env.local');
  const envExamplePath = path.join(projectDir, '.env.example');

  try {
    await fs.access(envLocalPath);
    log?.('.env.local already exists');
  } catch {
    // Try to copy from .env.example
    try {
      await fs.access(envExamplePath);
      const example = await fs.readFile(envExamplePath, 'utf-8');
      await fs.writeFile(envLocalPath, example, 'utf-8');
      log?.('Created .env.local from .env.example');
    } catch {
      // Create minimal .env.local with SQLite - path relative to schema.prisma
      await fs.writeFile(envLocalPath, serializeEnvFile({
        DATABASE_URL: 'file:./dev.db',
      }), 'utf-8');
      log?.('Created minimal .env.local with SQLite');
    }
  }

  // 2. Ensure .env.local has SQLite DATABASE_URL (path relative to schema.prisma)
  const envVars = await loadEnvFile(projectDir, 'local');
  if (envVars && (!envVars.DATABASE_URL || envVars.DATABASE_URL.includes('postgresql'))) {
    await saveEnvFile(projectDir, 'local', {
      ...envVars,
      DATABASE_URL: 'file:./dev.db',
    }, false);
    log?.('Updated .env.local with SQLite DATABASE_URL');
  }

  // 3. Switch Prisma to SQLite
  await switchPrismaProvider(projectDir, 'sqlite', log);
}

/**
 * Setup deployed environment
 * - Saves DATABASE_URL to .env.[environment]
 * - Switches Prisma schema to PostgreSQL
 */
export async function setupDeployedEnvironment(
  projectDir: string,
  environment: Environment,
  databaseUrl: string,
  log?: (message: string) => void
): Promise<void> {
  if (environment === 'local') {
    throw new Error('Cannot setup deployed environment for local');
  }

  // 1. Save DATABASE_URL to environment file
  await saveDatabaseUrl(projectDir, environment, databaseUrl);
  log?.(`Saved DATABASE_URL to ${getEnvFilename(environment)}`);

  // 2. Switch Prisma to PostgreSQL
  await switchPrismaProvider(projectDir, 'postgresql', log);
}

/**
 * Get DATABASE_URL for a specific environment
 */
export async function getDatabaseUrl(
  projectDir: string,
  environment: Environment
): Promise<string | null> {
  const envVars = await loadEnvFile(projectDir, environment);
  return envVars?.DATABASE_URL || null;
}

/**
 * Check which environments have DATABASE_URL configured
 */
export async function getConfiguredEnvironments(
  projectDir: string
): Promise<{ environment: Environment; hasUrl: boolean; isPostgres: boolean }[]> {
  const environments: Environment[] = ['local', 'development', 'staging', 'production'];
  const results: { environment: Environment; hasUrl: boolean; isPostgres: boolean }[] = [];

  for (const env of environments) {
    const url = await getDatabaseUrl(projectDir, env);
    results.push({
      environment: env,
      hasUrl: !!url,
      isPostgres: url?.includes('postgresql') || url?.includes('postgres') || false,
    });
  }

  return results;
}
