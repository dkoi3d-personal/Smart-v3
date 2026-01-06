/**
 * Database Catalog - Registry of available database options for projects
 *
 * Supports HIPAA-compliant and standard database configurations.
 * The infra agent uses this catalog to provision Azure resources.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type DatabaseEngine = 'postgresql' | 'mysql' | 'sqlserver' | 'cosmosdb' | 'sqlite';
export type ComplianceLevel = 'hipaa' | 'standard' | 'development';
export type AzureTier = 'burstable' | 'general-purpose' | 'memory-optimized' | 'serverless';

export interface DatabasePricing {
  tier: AzureTier;
  estimatedMonthlyCost: string;
  computeSize: string;
  storage: string;
  description: string;
}

export interface HipaaSettings {
  /** Require SSL/TLS for all connections */
  requireSecureTransport: boolean;
  /** Enable Transparent Data Encryption */
  encryptionAtRest: boolean;
  /** Use Customer Managed Keys (requires Key Vault) */
  customerManagedKeys: boolean;
  /** Enable audit logging */
  auditLogging: boolean;
  /** Audit log retention in days */
  auditLogRetentionDays: number;
  /** Enable pgAudit extension (PostgreSQL only) */
  pgAudit: boolean;
  /** Use private endpoint (no public access) */
  privateEndpoint: boolean;
  /** Minimum TLS version */
  minTlsVersion: 'TLS1_2' | 'TLS1_3';
  /** Enable Azure AD authentication */
  azureAdAuth: boolean;
  /** Enable geo-redundant backups */
  geoRedundantBackup: boolean;
  /** Backup retention in days (HIPAA requires 6+ years for some data) */
  backupRetentionDays: number;
  /** Additional PostgreSQL parameters for HIPAA */
  postgresParams?: Record<string, string>;
}

export interface LocalDevConfig {
  /** Docker image to use for local development */
  dockerImage: string;
  /** Default port for local container */
  defaultPort: number;
  /** Environment variables for container */
  environment: Record<string, string>;
  /** Docker compose service configuration */
  composeConfig: {
    volumes?: string[];
    healthcheck?: {
      test: string;
      interval: string;
      timeout: string;
      retries: number;
    };
  };
}

export interface AzureDeployConfig {
  /** Azure resource type */
  resourceType: string;
  /** Terraform resource name */
  terraformResource: string;
  /** Bicep resource type */
  bicepResource: string;
  /** Required Azure resource providers */
  requiredProviders: string[];
  /** SKU options by tier */
  skuOptions: Record<AzureTier, string>;
  /** Azure regions where this is available */
  availableRegions: string[];
  /** Additional Azure-specific settings */
  azureSettings: Record<string, any>;
}

export interface DatabaseOption {
  id: string;
  name: string;
  engine: DatabaseEngine;
  description: string;
  /** Compliance levels this database supports */
  supportedCompliance: ComplianceLevel[];
  /** Is this recommended for HIPAA workloads? */
  hipaaRecommended: boolean;
  /** Pricing tiers available */
  pricing: DatabasePricing[];
  /** HIPAA-specific configuration */
  hipaaConfig: HipaaSettings;
  /** Standard (non-HIPAA) configuration */
  standardConfig: Partial<HipaaSettings>;
  /** Local development configuration */
  localDev: LocalDevConfig;
  /** Azure deployment configuration */
  azureDeploy: AzureDeployConfig;
  /** ORM/client recommendations */
  recommendedOrm: string[];
  /** Connection string template */
  connectionStringTemplate: {
    local: string;
    azure: string;
  };
  /** Features and limitations */
  features: string[];
  limitations: string[];
  /** Tags for filtering */
  tags: string[];
  /** Is this option enabled/available */
  enabled: boolean;
  /** Sort order in dropdown */
  sortOrder: number;
}

export interface DatabaseCatalog {
  version: string;
  lastUpdated: string;
  databases: DatabaseOption[];
  /** Default database for new projects */
  defaultDatabaseId: string;
  /** Default compliance level */
  defaultComplianceLevel: ComplianceLevel;
}

// ============================================================================
// CATALOG LOADER
// ============================================================================

const CATALOG_PATH = path.join(process.cwd(), 'data', 'database-catalog.json');

let catalogCache: DatabaseCatalog | null = null;
let catalogLastModified: number = 0;

/**
 * Load the database catalog from disk
 */
export function loadDatabaseCatalog(): DatabaseCatalog {
  try {
    const stats = fs.statSync(CATALOG_PATH);
    if (catalogCache && stats.mtimeMs <= catalogLastModified) {
      return catalogCache;
    }

    const content = fs.readFileSync(CATALOG_PATH, 'utf-8');
    catalogCache = JSON.parse(content);
    catalogLastModified = stats.mtimeMs;
    return catalogCache!;
  } catch (error) {
    console.warn('[DatabaseCatalog] Failed to load catalog, using defaults:', error);
    return getDefaultDatabaseCatalog();
  }
}

/**
 * Save the database catalog to disk
 */
export function saveDatabaseCatalog(catalog: DatabaseCatalog): void {
  catalog.lastUpdated = new Date().toISOString();
  const dataDir = path.dirname(CATALOG_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  catalogCache = catalog;
  catalogLastModified = Date.now();
}

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Get all enabled database options
 */
export function getEnabledDatabases(): DatabaseOption[] {
  const catalog = loadDatabaseCatalog();
  return catalog.databases
    .filter(db => db.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Get databases that support HIPAA compliance
 */
export function getHipaaDatabases(): DatabaseOption[] {
  return getEnabledDatabases().filter(db =>
    db.supportedCompliance.includes('hipaa')
  );
}

/**
 * Get database by ID
 */
export function getDatabaseById(id: string): DatabaseOption | undefined {
  const catalog = loadDatabaseCatalog();
  return catalog.databases.find(db => db.id === id);
}

/**
 * Get databases by engine type
 */
export function getDatabasesByEngine(engine: DatabaseEngine): DatabaseOption[] {
  return getEnabledDatabases().filter(db => db.engine === engine);
}

/**
 * Get the default database option
 */
export function getDefaultDatabase(): DatabaseOption | undefined {
  const catalog = loadDatabaseCatalog();
  return getDatabaseById(catalog.defaultDatabaseId);
}

/**
 * Get configuration for infra agent based on compliance level
 */
export function getInfraConfig(
  databaseId: string,
  complianceLevel: ComplianceLevel
): {
  database: DatabaseOption;
  settings: Partial<HipaaSettings>;
  localDev: LocalDevConfig;
  azureDeploy: AzureDeployConfig;
} | null {
  const database = getDatabaseById(databaseId);
  if (!database) return null;

  const settings = complianceLevel === 'hipaa'
    ? database.hipaaConfig
    : database.standardConfig;

  return {
    database,
    settings,
    localDev: database.localDev,
    azureDeploy: database.azureDeploy,
  };
}

/**
 * Generate Docker Compose configuration for local development
 */
export function generateDockerCompose(databaseId: string): string {
  const database = getDatabaseById(databaseId);
  if (!database) return '';

  const { localDev } = database;
  const serviceName = database.engine === 'postgresql' ? 'postgres' : database.engine;

  let compose = `version: '3.8'
services:
  ${serviceName}:
    image: ${localDev.dockerImage}
    ports:
      - "${localDev.defaultPort}:${localDev.defaultPort}"
    environment:
`;

  for (const [key, value] of Object.entries(localDev.environment)) {
    compose += `      ${key}: "${value}"\n`;
  }

  if (localDev.composeConfig.volumes?.length) {
    compose += `    volumes:\n`;
    for (const vol of localDev.composeConfig.volumes) {
      compose += `      - ${vol}\n`;
    }
  }

  if (localDev.composeConfig.healthcheck) {
    const hc = localDev.composeConfig.healthcheck;
    compose += `    healthcheck:
      test: ${hc.test}
      interval: ${hc.interval}
      timeout: ${hc.timeout}
      retries: ${hc.retries}
`;
  }

  return compose;
}

/**
 * Generate Terraform configuration for Azure deployment
 */
export function generateTerraformConfig(
  databaseId: string,
  complianceLevel: ComplianceLevel,
  projectName: string,
  tier: AzureTier = 'burstable'
): string {
  const config = getInfraConfig(databaseId, complianceLevel);
  if (!config) return '';

  const { database, settings, azureDeploy } = config;
  const resourceName = projectName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const isHipaa = complianceLevel === 'hipaa';

  if (database.engine === 'postgresql') {
    return generatePostgresTerraform(resourceName, azureDeploy, settings as HipaaSettings, tier, isHipaa);
  }

  // Add other engines as needed
  return `# Terraform config for ${database.engine} - not yet implemented`;
}

function generatePostgresTerraform(
  resourceName: string,
  azureDeploy: AzureDeployConfig,
  settings: HipaaSettings,
  tier: AzureTier,
  isHipaa: boolean
): string {
  return `# Azure PostgreSQL Flexible Server - ${isHipaa ? 'HIPAA Compliant' : 'Standard'}
# Generated by AI Dev Platform

terraform {
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy = false
    }
  }
}

# Resource Group
resource "azurerm_resource_group" "main" {
  name     = "rg-\${var.project_name}-\${var.environment}"
  location = var.location

  tags = {
    Environment = var.environment
    Project     = var.project_name
    Compliance  = "${isHipaa ? 'HIPAA' : 'Standard'}"
    ManagedBy   = "AI-Dev-Platform"
  }
}

${isHipaa ? `# Key Vault for secrets and CMK
resource "azurerm_key_vault" "main" {
  name                = "kv-\${var.project_name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tenant_id           = data.azurerm_client_config.current.tenant_id
  sku_name            = "standard"

  purge_protection_enabled   = true
  soft_delete_retention_days = 90

  tags = azurerm_resource_group.main.tags
}

# Log Analytics Workspace for audit logs
resource "azurerm_log_analytics_workspace" "main" {
  name                = "law-\${var.project_name}"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  sku                 = "PerGB2018"
  retention_in_days   = ${settings.auditLogRetentionDays}

  tags = azurerm_resource_group.main.tags
}
` : ''}

# PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "main" {
  name                   = "psql-\${var.project_name}"
  resource_group_name    = azurerm_resource_group.main.name
  location               = azurerm_resource_group.main.location
  version                = "16"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password

  sku_name   = "${azureDeploy.skuOptions[tier]}"
  storage_mb = ${tier === 'burstable' ? '32768' : '65536'}

  backup_retention_days        = ${settings.backupRetentionDays}
  geo_redundant_backup_enabled = ${settings.geoRedundantBackup}

  ${isHipaa ? `# HIPAA: Require secure transport
  ssl_enforcement_enabled = true` : ''}

  tags = azurerm_resource_group.main.tags
}

# PostgreSQL Configuration - Security Settings
resource "azurerm_postgresql_flexible_server_configuration" "require_secure_transport" {
  name      = "require_secure_transport"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "${settings.requireSecureTransport ? 'ON' : 'OFF'}"
}

resource "azurerm_postgresql_flexible_server_configuration" "ssl_min_protocol_version" {
  name      = "ssl_min_protocol_version"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "${settings.minTlsVersion}"
}

${isHipaa ? `# HIPAA: Audit logging configuration
resource "azurerm_postgresql_flexible_server_configuration" "log_checkpoints" {
  name      = "log_checkpoints"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "ON"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_connections" {
  name      = "log_connections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "ON"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_disconnections" {
  name      = "log_disconnections"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "ON"
}

resource "azurerm_postgresql_flexible_server_configuration" "log_duration" {
  name      = "log_duration"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "ON"
}

# Enable pgAudit extension
resource "azurerm_postgresql_flexible_server_configuration" "shared_preload_libraries" {
  name      = "shared_preload_libraries"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "pgaudit"
}

resource "azurerm_postgresql_flexible_server_configuration" "pgaudit_log" {
  name      = "pgaudit.log"
  server_id = azurerm_postgresql_flexible_server.main.id
  value     = "ALL"

  depends_on = [azurerm_postgresql_flexible_server_configuration.shared_preload_libraries]
}

# Diagnostic settings for Log Analytics
resource "azurerm_monitor_diagnostic_setting" "postgres" {
  name                       = "diag-\${var.project_name}-postgres"
  target_resource_id         = azurerm_postgresql_flexible_server.main.id
  log_analytics_workspace_id = azurerm_log_analytics_workspace.main.id

  enabled_log {
    category = "PostgreSQLLogs"
  }

  metric {
    category = "AllMetrics"
    enabled  = true
  }
}
` : ''}

# Database
resource "azurerm_postgresql_flexible_server_database" "main" {
  name      = var.db_name
  server_id = azurerm_postgresql_flexible_server.main.id
  charset   = "UTF8"
  collation = "en_US.utf8"
}

# Firewall rule (configure based on deployment)
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure" {
  name             = "AllowAzureServices"
  server_id        = azurerm_postgresql_flexible_server.main.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# Variables
variable "project_name" {
  description = "Name of the project"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "location" {
  description = "Azure region"
  type        = string
  default     = "eastus2"
}

variable "db_admin_username" {
  description = "Database administrator username"
  type        = string
  sensitive   = true
}

variable "db_admin_password" {
  description = "Database administrator password"
  type        = string
  sensitive   = true
}

variable "db_name" {
  description = "Name of the database"
  type        = string
  default     = "appdb"
}

# Outputs
output "server_fqdn" {
  value = azurerm_postgresql_flexible_server.main.fqdn
}

output "connection_string" {
  value     = "postgresql://\${var.db_admin_username}:\${var.db_admin_password}@\${azurerm_postgresql_flexible_server.main.fqdn}:5432/\${var.db_name}?sslmode=require"
  sensitive = true
}

${isHipaa ? `output "key_vault_uri" {
  value = azurerm_key_vault.main.vault_uri
}

output "log_analytics_workspace_id" {
  value = azurerm_log_analytics_workspace.main.id
}
` : ''}
`;
}

// ============================================================================
// DEFAULT CATALOG
// ============================================================================

export function getDefaultDatabaseCatalog(): DatabaseCatalog {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    defaultDatabaseId: 'azure-postgresql-flexible',
    defaultComplianceLevel: 'hipaa',
    databases: [
      // ======================================================================
      // PostgreSQL Options
      // ======================================================================
      {
        id: 'azure-postgresql-flexible',
        name: 'Azure PostgreSQL Flexible Server',
        engine: 'postgresql',
        description: 'Fully managed PostgreSQL with flexible scaling. Best choice for HIPAA-compliant healthcare applications.',
        supportedCompliance: ['hipaa', 'standard', 'development'],
        hipaaRecommended: true,
        pricing: [
          {
            tier: 'burstable',
            estimatedMonthlyCost: '$15-50',
            computeSize: 'B1ms (1 vCore, 2GB RAM)',
            storage: '32GB',
            description: 'Best for dev/test and small production workloads',
          },
          {
            tier: 'general-purpose',
            estimatedMonthlyCost: '$100-300',
            computeSize: 'D2s_v3 (2 vCores, 8GB RAM)',
            storage: '64GB',
            description: 'Balanced compute and memory for production',
          },
          {
            tier: 'memory-optimized',
            estimatedMonthlyCost: '$200-500',
            computeSize: 'E2s_v3 (2 vCores, 16GB RAM)',
            storage: '128GB',
            description: 'High memory for complex queries and analytics',
          },
        ],
        hipaaConfig: {
          requireSecureTransport: true,
          encryptionAtRest: true,
          customerManagedKeys: false, // Can enable for extra security
          auditLogging: true,
          auditLogRetentionDays: 90,
          pgAudit: true,
          privateEndpoint: false, // Enable for production
          minTlsVersion: 'TLS1_2',
          azureAdAuth: true,
          geoRedundantBackup: true,
          backupRetentionDays: 35,
          postgresParams: {
            'log_checkpoints': 'ON',
            'log_connections': 'ON',
            'log_disconnections': 'ON',
            'log_duration': 'ON',
            'log_statement': 'all',
          },
        },
        standardConfig: {
          requireSecureTransport: true,
          encryptionAtRest: true,
          auditLogging: false,
          backupRetentionDays: 7,
          geoRedundantBackup: false,
          minTlsVersion: 'TLS1_2',
        },
        localDev: {
          dockerImage: 'postgres:16-alpine',
          defaultPort: 5432,
          environment: {
            POSTGRES_USER: 'devuser',
            POSTGRES_PASSWORD: 'devpassword',
            POSTGRES_DB: 'appdb',
          },
          composeConfig: {
            volumes: ['postgres_data:/var/lib/postgresql/data'],
            healthcheck: {
              test: '["CMD-SHELL", "pg_isready -U devuser -d appdb"]',
              interval: '10s',
              timeout: '5s',
              retries: 5,
            },
          },
        },
        azureDeploy: {
          resourceType: 'Microsoft.DBforPostgreSQL/flexibleServers',
          terraformResource: 'azurerm_postgresql_flexible_server',
          bicepResource: 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview',
          requiredProviders: ['Microsoft.DBforPostgreSQL'],
          skuOptions: {
            burstable: 'B_Standard_B1ms',
            'general-purpose': 'GP_Standard_D2s_v3',
            'memory-optimized': 'MO_Standard_E2s_v3',
            serverless: 'B_Standard_B1ms', // No true serverless for PostgreSQL
          },
          availableRegions: ['eastus', 'eastus2', 'westus2', 'centralus', 'northeurope', 'westeurope'],
          azureSettings: {
            version: '16',
            highAvailability: { mode: 'Disabled' }, // Enable for production
          },
        },
        recommendedOrm: ['prisma', 'drizzle', 'typeorm'],
        connectionStringTemplate: {
          local: 'postgresql://devuser:devpassword@localhost:5432/appdb',
          azure: 'postgresql://${username}:${password}@${server}.postgres.database.azure.com:5432/${database}?sslmode=require',
        },
        features: [
          'HIPAA eligible with BAA',
          'Automatic backups up to 35 days',
          'Point-in-time restore',
          'Read replicas',
          'pgAudit for compliance logging',
          'Azure AD authentication',
          'Private Link support',
          'Automatic patching',
        ],
        limitations: [
          'No true serverless option',
          'Cold start on burstable tier',
        ],
        tags: ['postgresql', 'hipaa', 'recommended', 'azure', 'managed'],
        enabled: true,
        sortOrder: 1,
      },

      // ======================================================================
      // Azure SQL Database
      // ======================================================================
      {
        id: 'azure-sql-database',
        name: 'Azure SQL Database',
        engine: 'sqlserver',
        description: 'Fully managed SQL Server with built-in intelligence. Good for .NET applications and complex T-SQL.',
        supportedCompliance: ['hipaa', 'standard', 'development'],
        hipaaRecommended: true,
        pricing: [
          {
            tier: 'serverless',
            estimatedMonthlyCost: '$5-50',
            computeSize: 'Auto-scale (0.5-2 vCores)',
            storage: '32GB',
            description: 'Pay per second, auto-pause when idle',
          },
          {
            tier: 'burstable',
            estimatedMonthlyCost: '$15-30',
            computeSize: 'Basic (5 DTUs)',
            storage: '2GB',
            description: 'Cheapest fixed option for small workloads',
          },
          {
            tier: 'general-purpose',
            estimatedMonthlyCost: '$100-400',
            computeSize: 'Standard S3 (100 DTUs)',
            storage: '250GB',
            description: 'Balanced performance for production',
          },
        ],
        hipaaConfig: {
          requireSecureTransport: true,
          encryptionAtRest: true, // TDE enabled by default
          customerManagedKeys: false,
          auditLogging: true,
          auditLogRetentionDays: 90,
          pgAudit: false, // N/A for SQL Server
          privateEndpoint: false,
          minTlsVersion: 'TLS1_2',
          azureAdAuth: true,
          geoRedundantBackup: true,
          backupRetentionDays: 35,
        },
        standardConfig: {
          requireSecureTransport: true,
          encryptionAtRest: true,
          auditLogging: false,
          backupRetentionDays: 7,
        },
        localDev: {
          dockerImage: 'mcr.microsoft.com/azure-sql-edge:latest',
          defaultPort: 1433,
          environment: {
            ACCEPT_EULA: 'Y',
            MSSQL_SA_PASSWORD: 'DevPassword123!',
            MSSQL_PID: 'Developer',
          },
          composeConfig: {
            volumes: ['sqlserver_data:/var/opt/mssql'],
            healthcheck: {
              test: '["/opt/mssql-tools/bin/sqlcmd", "-S", "localhost", "-U", "sa", "-P", "DevPassword123!", "-Q", "SELECT 1"]',
              interval: '10s',
              timeout: '5s',
              retries: 5,
            },
          },
        },
        azureDeploy: {
          resourceType: 'Microsoft.Sql/servers/databases',
          terraformResource: 'azurerm_mssql_database',
          bicepResource: 'Microsoft.Sql/servers/databases@2022-05-01-preview',
          requiredProviders: ['Microsoft.Sql'],
          skuOptions: {
            serverless: 'GP_S_Gen5_1',
            burstable: 'Basic',
            'general-purpose': 'S3',
            'memory-optimized': 'P4',
          },
          availableRegions: ['eastus', 'eastus2', 'westus2', 'centralus', 'northeurope', 'westeurope'],
          azureSettings: {
            collation: 'SQL_Latin1_General_CP1_CI_AS',
            maxSizeBytes: 34359738368, // 32GB
          },
        },
        recommendedOrm: ['prisma', 'typeorm', 'sequelize'],
        connectionStringTemplate: {
          local: 'Server=localhost,1433;Database=appdb;User Id=sa;Password=DevPassword123!;TrustServerCertificate=true',
          azure: 'Server=${server}.database.windows.net;Database=${database};User Id=${username};Password=${password};Encrypt=true;TrustServerCertificate=false',
        },
        features: [
          'HIPAA eligible with BAA',
          'Transparent Data Encryption (TDE)',
          'Always Encrypted for column-level',
          'Serverless auto-pause',
          'Automatic tuning',
          'Built-in threat detection',
          'Point-in-time restore',
        ],
        limitations: [
          'Higher cost than PostgreSQL',
          'Vendor lock-in to SQL Server',
        ],
        tags: ['sqlserver', 'hipaa', 'azure', 'managed', 'serverless'],
        enabled: true,
        sortOrder: 2,
      },

      // ======================================================================
      // Azure Cosmos DB
      // ======================================================================
      {
        id: 'azure-cosmosdb',
        name: 'Azure Cosmos DB',
        engine: 'cosmosdb',
        description: 'Globally distributed NoSQL database. Best for high-scale document storage with global replication.',
        supportedCompliance: ['hipaa', 'standard'],
        hipaaRecommended: false, // Can be HIPAA compliant but expensive
        pricing: [
          {
            tier: 'serverless',
            estimatedMonthlyCost: '$0-100+',
            computeSize: 'Pay per RU consumed',
            storage: 'Pay per GB',
            description: 'Best for sporadic, unpredictable workloads',
          },
          {
            tier: 'burstable',
            estimatedMonthlyCost: '$25-100',
            computeSize: '400 RU/s provisioned',
            storage: '5GB included',
            description: 'Minimum provisioned throughput',
          },
          {
            tier: 'general-purpose',
            estimatedMonthlyCost: '$200-1000+',
            computeSize: '4000 RU/s',
            storage: '50GB',
            description: 'Production workloads',
          },
        ],
        hipaaConfig: {
          requireSecureTransport: true,
          encryptionAtRest: true,
          customerManagedKeys: true, // Recommended for HIPAA
          auditLogging: true,
          auditLogRetentionDays: 90,
          pgAudit: false,
          privateEndpoint: true, // Recommended for HIPAA
          minTlsVersion: 'TLS1_2',
          azureAdAuth: true,
          geoRedundantBackup: true,
          backupRetentionDays: 30,
        },
        standardConfig: {
          requireSecureTransport: true,
          encryptionAtRest: true,
          auditLogging: false,
        },
        localDev: {
          dockerImage: 'mcr.microsoft.com/cosmosdb/linux/azure-cosmos-emulator:latest',
          defaultPort: 8081,
          environment: {
            AZURE_COSMOS_EMULATOR_PARTITION_COUNT: '10',
            AZURE_COSMOS_EMULATOR_ENABLE_DATA_PERSISTENCE: 'true',
          },
          composeConfig: {
            volumes: ['cosmos_data:/data'],
            healthcheck: {
              test: '["CMD", "curl", "-f", "https://localhost:8081/_explorer/emulator.pem"]',
              interval: '30s',
              timeout: '10s',
              retries: 5,
            },
          },
        },
        azureDeploy: {
          resourceType: 'Microsoft.DocumentDB/databaseAccounts',
          terraformResource: 'azurerm_cosmosdb_account',
          bicepResource: 'Microsoft.DocumentDB/databaseAccounts@2023-04-15',
          requiredProviders: ['Microsoft.DocumentDB'],
          skuOptions: {
            serverless: 'serverless',
            burstable: 'provisioned-400',
            'general-purpose': 'provisioned-4000',
            'memory-optimized': 'provisioned-10000',
          },
          availableRegions: ['eastus', 'eastus2', 'westus2', 'centralus', 'northeurope', 'westeurope'],
          azureSettings: {
            kind: 'GlobalDocumentDB',
            capabilities: [{ name: 'EnableServerless' }], // For serverless
            consistencyPolicy: { defaultConsistencyLevel: 'Session' },
          },
        },
        recommendedOrm: ['@azure/cosmos', 'mongoose-cosmos'],
        connectionStringTemplate: {
          local: 'AccountEndpoint=https://localhost:8081/;AccountKey=C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==',
          azure: 'AccountEndpoint=https://${account}.documents.azure.com:443/;AccountKey=${key}',
        },
        features: [
          'HIPAA eligible with BAA',
          'Global distribution',
          'Multiple consistency levels',
          'Serverless option',
          'Automatic indexing',
          'Multi-model (document, graph, key-value)',
        ],
        limitations: [
          'Can be expensive at scale',
          'Complex pricing model (RU/s)',
          'Local emulator has limitations',
        ],
        tags: ['nosql', 'document', 'hipaa', 'azure', 'global', 'serverless'],
        enabled: true,
        sortOrder: 3,
      },

      // ======================================================================
      // SQLite (Development Only)
      // ======================================================================
      {
        id: 'sqlite-local',
        name: 'SQLite (Local Development)',
        engine: 'sqlite',
        description: 'File-based database for local development and prototyping. Not suitable for production healthcare apps.',
        supportedCompliance: ['development'],
        hipaaRecommended: false,
        pricing: [
          {
            tier: 'burstable',
            estimatedMonthlyCost: '$0',
            computeSize: 'N/A (local file)',
            storage: 'Unlimited (local disk)',
            description: 'Free, no server required',
          },
        ],
        hipaaConfig: {
          requireSecureTransport: false,
          encryptionAtRest: false,
          customerManagedKeys: false,
          auditLogging: false,
          auditLogRetentionDays: 0,
          pgAudit: false,
          privateEndpoint: false,
          minTlsVersion: 'TLS1_2',
          azureAdAuth: false,
          geoRedundantBackup: false,
          backupRetentionDays: 0,
        },
        standardConfig: {
          requireSecureTransport: false,
          encryptionAtRest: false,
        },
        localDev: {
          dockerImage: '', // No Docker needed
          defaultPort: 0,
          environment: {},
          composeConfig: {},
        },
        azureDeploy: {
          resourceType: '', // Cannot deploy SQLite to Azure
          terraformResource: '',
          bicepResource: '',
          requiredProviders: [],
          skuOptions: {
            burstable: '',
            'general-purpose': '',
            'memory-optimized': '',
            serverless: '',
          },
          availableRegions: [],
          azureSettings: {},
        },
        recommendedOrm: ['prisma', 'drizzle', 'better-sqlite3'],
        connectionStringTemplate: {
          local: 'file:./dev.db',
          azure: '', // N/A
        },
        features: [
          'Zero configuration',
          'No server needed',
          'Fast for development',
          'Single file database',
          'Great for prototyping',
        ],
        limitations: [
          'NOT HIPAA compliant',
          'Cannot deploy to production',
          'No concurrent write support',
          'No user authentication',
        ],
        tags: ['sqlite', 'development', 'local', 'prototype'],
        enabled: true,
        sortOrder: 10,
      },
    ],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  CATALOG_PATH,
};

export default {
  loadDatabaseCatalog,
  saveDatabaseCatalog,
  getEnabledDatabases,
  getHipaaDatabases,
  getDatabaseById,
  getDatabasesByEngine,
  getDefaultDatabase,
  getInfraConfig,
  generateDockerCompose,
  generateTerraformConfig,
};
