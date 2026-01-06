/**
 * Infrastructure Configuration Manager
 *
 * Manages the .infrastructure.json file for each project, providing a
 * consistent way to store and retrieve deployment configuration.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface DatabaseConfig {
  provider: 'azure' | 'neon' | 'supabase' | 'aws-rds' | 'sqlite';
  type: 'postgresql' | 'mysql' | 'sqlite';
  host?: string;
  port?: number;
  database: string;
  ssl?: boolean;
  resourceId?: string;
  provisionedAt?: string;
}

export interface AppServiceConfig {
  provider: 'azure' | 'vercel' | 'aws';
  type: 'app-service' | 'container-apps' | 'static-web-apps' | 'lambda';
  appName: string;
  resourceGroup?: string;
  url: string;
  sku?: string;
  deployedAt?: string;
}

export interface MonitoringConfig {
  applicationInsightsId?: string;
  instrumentationKey?: string;
  dashboardUrl?: string;
}

export interface InfrastructureConfig {
  version: string;
  projectId: string;
  environment: 'dev' | 'staging' | 'production';
  region: string;
  database?: DatabaseConfig;
  appService?: AppServiceConfig;
  monitoring?: MonitoringConfig;
  createdAt: string;
  updatedAt: string;
}

const INFRA_CONFIG_FILE = '.infrastructure.json';
const CURRENT_VERSION = '1.0';

/**
 * Load infrastructure config from a project directory
 */
export async function loadInfrastructureConfig(
  projectDir: string
): Promise<InfrastructureConfig | null> {
  try {
    const configPath = path.join(projectDir, INFRA_CONFIG_FILE);
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as InfrastructureConfig;
  } catch {
    return null;
  }
}

/**
 * Save infrastructure config to a project directory
 */
export async function saveInfrastructureConfig(
  projectDir: string,
  config: InfrastructureConfig
): Promise<void> {
  const configPath = path.join(projectDir, INFRA_CONFIG_FILE);
  config.updatedAt = new Date().toISOString();
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
  console.log(`[Infrastructure] Saved config to ${configPath}`);
}

/**
 * Create a new infrastructure config
 */
export function createInfrastructureConfig(
  projectId: string,
  environment: 'dev' | 'staging' | 'production' = 'dev',
  region: string = 'eastus2'
): InfrastructureConfig {
  const now = new Date().toISOString();
  return {
    version: CURRENT_VERSION,
    projectId,
    environment,
    region,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update database configuration in infrastructure config
 */
export async function updateDatabaseConfig(
  projectDir: string,
  projectId: string,
  databaseConfig: DatabaseConfig,
  region: string = 'eastus2'
): Promise<InfrastructureConfig> {
  let config = await loadInfrastructureConfig(projectDir);

  if (!config) {
    config = createInfrastructureConfig(projectId, 'dev', region);
  }

  config.database = databaseConfig;
  config.region = region;
  await saveInfrastructureConfig(projectDir, config);

  return config;
}

/**
 * Update app service configuration in infrastructure config
 */
export async function updateAppServiceConfig(
  projectDir: string,
  projectId: string,
  appServiceConfig: AppServiceConfig,
  region: string = 'eastus2'
): Promise<InfrastructureConfig> {
  let config = await loadInfrastructureConfig(projectDir);

  if (!config) {
    config = createInfrastructureConfig(projectId, 'dev', region);
  }

  config.appService = appServiceConfig;
  config.region = region;
  await saveInfrastructureConfig(projectDir, config);

  return config;
}

/**
 * Update monitoring configuration in infrastructure config
 */
export async function updateMonitoringConfig(
  projectDir: string,
  projectId: string,
  monitoringConfig: MonitoringConfig
): Promise<InfrastructureConfig> {
  let config = await loadInfrastructureConfig(projectDir);

  if (!config) {
    config = createInfrastructureConfig(projectId);
  }

  config.monitoring = monitoringConfig;
  await saveInfrastructureConfig(projectDir, config);

  return config;
}

/**
 * Migrate from legacy .database.json to .infrastructure.json
 */
export async function migrateFromLegacyConfig(
  projectDir: string,
  projectId: string
): Promise<InfrastructureConfig | null> {
  const legacyDbPath = path.join(projectDir, '.database.json');

  try {
    const legacyContent = await fs.readFile(legacyDbPath, 'utf-8');
    const legacyDb = JSON.parse(legacyContent);

    // Create new config from legacy data
    const config = createInfrastructureConfig(projectId);
    config.database = {
      provider: legacyDb.provider || 'azure',
      type: legacyDb.type || 'postgresql',
      host: legacyDb.host,
      port: legacyDb.port || 5432,
      database: legacyDb.database,
      ssl: legacyDb.ssl,
      resourceId: legacyDb.projectId,
      provisionedAt: legacyDb.provisionedAt,
    };

    if (legacyDb.provisionedAt) {
      config.createdAt = legacyDb.provisionedAt;
    }

    await saveInfrastructureConfig(projectDir, config);
    console.log(`[Infrastructure] Migrated legacy config for ${projectId}`);

    return config;
  } catch {
    return null;
  }
}
