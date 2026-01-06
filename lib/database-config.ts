/**
 * Database Configuration and Integration System
 *
 * Supports multiple database types:
 * - PostgreSQL (Supabase, Neon, AWS RDS)
 * - MongoDB (Atlas, self-hosted)
 * - MySQL (PlanetScale, AWS RDS)
 * - SQLite (local development)
 * - Redis (caching)
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { encryptData, decryptData } from './credentials-store';

export type DatabaseType = 'postgresql' | 'mongodb' | 'mysql' | 'sqlite' | 'redis';
export type DatabaseProvider =
  | 'supabase'
  | 'neon'
  | 'planetscale'
  | 'mongodb-atlas'
  | 'aws-rds'
  | 'local'
  | 'custom';

export interface DatabaseColumn {
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

export interface DatabaseTable {
  name: string;
  columns: DatabaseColumn[];
  indexes?: string[];
}

export interface DatabaseSchema {
  tables: DatabaseTable[];
  version: string;
  createdAt: string;
  updatedAt: string;
}

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  provider: DatabaseProvider;
  host: string;
  port: number;
  database: string;
  username?: string;
  password?: string;  // Encrypted
  ssl?: boolean;
  connectionString?: string;  // Encrypted - alternative to individual fields
  poolSize?: number;
  createdAt: string;
  lastConnected?: string;
  status: 'connected' | 'disconnected' | 'error';
}

export interface DatabaseConfig {
  connections: DatabaseConnection[];
  activeConnectionId?: string;
  schemas: Record<string, DatabaseSchema>;  // keyed by connection ID
}

// Default ports for each database type
export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  postgresql: 5432,
  mongodb: 27017,
  mysql: 3306,
  sqlite: 0,
  redis: 6379,
};

// Common column types per database
export const COLUMN_TYPES: Record<DatabaseType, string[]> = {
  postgresql: [
    'SERIAL', 'BIGSERIAL', 'INTEGER', 'BIGINT', 'SMALLINT',
    'TEXT', 'VARCHAR(255)', 'CHAR(1)',
    'BOOLEAN',
    'TIMESTAMP', 'TIMESTAMPTZ', 'DATE', 'TIME',
    'UUID',
    'JSON', 'JSONB',
    'DECIMAL', 'NUMERIC', 'REAL', 'DOUBLE PRECISION',
    'BYTEA',
  ],
  mongodb: [
    'String', 'Number', 'Boolean', 'Date', 'ObjectId',
    'Array', 'Object', 'Buffer', 'Mixed',
  ],
  mysql: [
    'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
    'VARCHAR(255)', 'TEXT', 'CHAR(1)',
    'BOOLEAN',
    'DATETIME', 'TIMESTAMP', 'DATE', 'TIME',
    'JSON',
    'DECIMAL', 'FLOAT', 'DOUBLE',
    'BLOB',
  ],
  sqlite: [
    'INTEGER', 'TEXT', 'REAL', 'BLOB', 'NULL',
  ],
  redis: ['string', 'list', 'set', 'hash', 'zset'],
};

const CONFIG_FILE = path.join(process.cwd(), 'data', 'database-config.json');

/**
 * Load database configuration
 */
export async function loadDatabaseConfig(): Promise<DatabaseConfig> {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf-8');
    return JSON.parse(data) as DatabaseConfig;
  } catch {
    return {
      connections: [],
      schemas: {},
    };
  }
}

/**
 * Save database configuration
 */
export async function saveDatabaseConfig(config: DatabaseConfig): Promise<void> {
  const dataDir = path.dirname(CONFIG_FILE);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Add a new database connection
 */
export async function addDatabaseConnection(
  connection: Omit<DatabaseConnection, 'id' | 'createdAt' | 'status'>
): Promise<DatabaseConnection> {
  const config = await loadDatabaseConfig();

  const newConnection: DatabaseConnection = {
    ...connection,
    id: `db-${Date.now()}`,
    createdAt: new Date().toISOString(),
    status: 'disconnected',
    // Encrypt sensitive fields
    password: connection.password ? await encryptData(connection.password) : undefined,
    connectionString: connection.connectionString ? await encryptData(connection.connectionString) : undefined,
  };

  config.connections.push(newConnection);
  await saveDatabaseConfig(config);

  return newConnection;
}

/**
 * Update a database connection
 */
export async function updateDatabaseConnection(
  id: string,
  updates: Partial<DatabaseConnection>
): Promise<DatabaseConnection | null> {
  const config = await loadDatabaseConfig();
  const index = config.connections.findIndex(c => c.id === id);

  if (index === -1) return null;

  // Encrypt sensitive fields if provided
  if (updates.password) {
    updates.password = await encryptData(updates.password);
  }
  if (updates.connectionString) {
    updates.connectionString = await encryptData(updates.connectionString);
  }

  config.connections[index] = { ...config.connections[index], ...updates };
  await saveDatabaseConfig(config);

  return config.connections[index];
}

/**
 * Delete a database connection
 */
export async function deleteDatabaseConnection(id: string): Promise<boolean> {
  const config = await loadDatabaseConfig();
  const index = config.connections.findIndex(c => c.id === id);

  if (index === -1) return false;

  config.connections.splice(index, 1);
  delete config.schemas[id];

  if (config.activeConnectionId === id) {
    config.activeConnectionId = undefined;
  }

  await saveDatabaseConfig(config);
  return true;
}

/**
 * Get decrypted connection string
 */
export async function getDecryptedConnectionString(connection: DatabaseConnection): Promise<string> {
  if (connection.connectionString) {
    return await decryptData(connection.connectionString);
  }

  // Build connection string from individual fields
  const password = connection.password ? await decryptData(connection.password) : '';

  switch (connection.type) {
    case 'postgresql':
      return `postgresql://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}${connection.ssl ? '?sslmode=require' : ''}`;
    case 'mongodb':
      return `mongodb+srv://${connection.username}:${password}@${connection.host}/${connection.database}`;
    case 'mysql':
      return `mysql://${connection.username}:${password}@${connection.host}:${connection.port}/${connection.database}`;
    case 'redis':
      return `redis://${connection.username ? `${connection.username}:${password}@` : ''}${connection.host}:${connection.port}`;
    default:
      return '';
  }
}

/**
 * Save schema for a connection
 */
export async function saveSchema(connectionId: string, schema: DatabaseSchema): Promise<void> {
  const config = await loadDatabaseConfig();
  schema.updatedAt = new Date().toISOString();
  config.schemas[connectionId] = schema;
  await saveDatabaseConfig(config);
}

/**
 * Generate Prisma schema from our schema format
 */
export function generatePrismaSchema(schema: DatabaseSchema, dbType: DatabaseType): string {
  const provider = dbType === 'mongodb' ? 'mongodb' : dbType === 'mysql' ? 'mysql' : 'postgresql';

  let prismaSchema = `// Generated by AI Dev Platform
// Database: ${provider}

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "${provider}"
  url      = env("DATABASE_URL")
}

`;

  for (const table of schema.tables) {
    prismaSchema += `model ${toPascalCase(table.name)} {\n`;

    for (const col of table.columns) {
      let line = `  ${col.name} `;
      line += mapToPrismaType(col.type, dbType);

      if (col.primaryKey) line += ' @id';
      if (col.unique) line += ' @unique';
      if (!col.nullable && !col.primaryKey) line += '';
      if (col.nullable) line += '?';
      if (col.default) line += ` @default(${col.default})`;
      if (col.type === 'SERIAL' || col.type === 'BIGSERIAL') line += ' @default(autoincrement())';
      if (col.references) {
        line += `\n  ${col.references.table.toLowerCase()} ${toPascalCase(col.references.table)} @relation(fields: [${col.name}], references: [${col.references.column}])`;
      }

      prismaSchema += line + '\n';
    }

    prismaSchema += `\n  @@map("${table.name}")\n}\n\n`;
  }

  return prismaSchema;
}

/**
 * Generate SQL migration from schema
 */
export function generateSQLMigration(schema: DatabaseSchema, dbType: DatabaseType): string {
  let sql = `-- Migration generated by AI Dev Platform
-- Database: ${dbType}
-- Generated at: ${new Date().toISOString()}

`;

  for (const table of schema.tables) {
    sql += `CREATE TABLE IF NOT EXISTS "${table.name}" (\n`;

    const columnDefs = table.columns.map(col => {
      let def = `  "${col.name}" ${col.type}`;
      if (col.primaryKey) def += ' PRIMARY KEY';
      if (col.unique && !col.primaryKey) def += ' UNIQUE';
      if (!col.nullable && !col.primaryKey) def += ' NOT NULL';
      if (col.default) def += ` DEFAULT ${col.default}`;
      return def;
    });

    sql += columnDefs.join(',\n');

    // Add foreign keys
    const fkColumns = table.columns.filter(c => c.references);
    for (const col of fkColumns) {
      sql += `,\n  FOREIGN KEY ("${col.name}") REFERENCES "${col.references!.table}"("${col.references!.column}")`;
    }

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

// Helper functions
function toPascalCase(str: string): string {
  return str
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function mapToPrismaType(sqlType: string, dbType: DatabaseType): string {
  const typeMap: Record<string, string> = {
    'SERIAL': 'Int',
    'BIGSERIAL': 'BigInt',
    'INTEGER': 'Int',
    'INT': 'Int',
    'BIGINT': 'BigInt',
    'SMALLINT': 'Int',
    'TEXT': 'String',
    'VARCHAR(255)': 'String',
    'CHAR(1)': 'String',
    'BOOLEAN': 'Boolean',
    'TIMESTAMP': 'DateTime',
    'TIMESTAMPTZ': 'DateTime',
    'DATETIME': 'DateTime',
    'DATE': 'DateTime',
    'UUID': 'String',
    'JSON': 'Json',
    'JSONB': 'Json',
    'DECIMAL': 'Decimal',
    'NUMERIC': 'Decimal',
    'REAL': 'Float',
    'FLOAT': 'Float',
    'DOUBLE PRECISION': 'Float',
    'DOUBLE': 'Float',
    'BYTEA': 'Bytes',
    'BLOB': 'Bytes',
  };

  return typeMap[sqlType.toUpperCase()] || 'String';
}

export const databaseConfig = {
  loadDatabaseConfig,
  saveDatabaseConfig,
  addDatabaseConnection,
  updateDatabaseConnection,
  deleteDatabaseConnection,
  getDecryptedConnectionString,
  saveSchema,
  generatePrismaSchema,
  generateSQLMigration,
  DEFAULT_PORTS,
  COLUMN_TYPES,
};

export default databaseConfig;
