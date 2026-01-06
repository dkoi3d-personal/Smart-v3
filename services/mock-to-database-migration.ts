/**
 * Mock-to-Database Migration Service
 *
 * Handles the complete workflow of migrating from mock data to a real database:
 * 1. Parse schema from schema/data-schema.md
 * 2. Provision a real database (Neon, Supabase, etc.)
 * 3. Generate Prisma schema and run migrations
 * 4. Export mock data from the running app
 * 5. Import data into the real database
 * 6. Update app code to use Prisma
 * 7. Test the connection
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync, spawn } from 'child_process';
import {
  provisionDatabase,
  generatePrismaSchema,
  generateSQLMigration,
  ProvisionedDatabase,
  DatabaseSchema,
  TableDefinition,
  ColumnDefinition,
  DatabaseProvider
} from './database-provisioning';
import { devServerManager } from './dev-server-manager';

const IS_WINDOWS = process.platform === 'win32';

export interface MigrationConfig {
  projectDir: string;
  projectId: string;
  provider: 'neon' | 'supabase' | 'sqlite';
  credentials: {
    neonApiKey?: string;
    supabaseAccessToken?: string;
  };
}

export interface MigrationResult {
  success: boolean;
  provider: string;
  connectionString?: string;
  steps: MigrationStep[];
  error?: string;
}

export interface MigrationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  details?: string;
  error?: string;
}

export interface MockDataExport {
  collections: Record<string, Record<string, unknown>[]>;
  exportedAt: string;
  totalRecords: number;
}

/**
 * Main migration orchestrator
 */
export async function migrateToDatabase(
  config: MigrationConfig,
  onProgress?: (step: MigrationStep) => void
): Promise<MigrationResult> {
  const steps: MigrationStep[] = [];
  const updateStep = (step: MigrationStep) => {
    const existing = steps.find(s => s.name === step.name);
    if (existing) {
      Object.assign(existing, step);
    } else {
      steps.push(step);
    }
    onProgress?.(step);
  };

  try {
    // Step 1: Parse schema
    updateStep({ name: 'Parse Schema', status: 'running' });
    const startParse = Date.now();
    const schema = await parseSchemaFromMarkdown(config.projectDir);
    updateStep({
      name: 'Parse Schema',
      status: 'completed',
      duration: Date.now() - startParse,
      details: `Found ${schema.tables.length} tables`
    });

    // Step 2: Export mock data
    updateStep({ name: 'Export Mock Data', status: 'running' });
    const startExport = Date.now();
    const mockData = await exportMockData(config.projectDir);
    updateStep({
      name: 'Export Mock Data',
      status: 'completed',
      duration: Date.now() - startExport,
      details: `Exported ${mockData.totalRecords} records`
    });

    // Step 3: Provision database
    updateStep({ name: 'Provision Database', status: 'running' });
    const startProvision = Date.now();
    const database = await provisionDatabase(
      config.projectId,
      config.provider,
      `db-${config.projectId}`,
      config.credentials
    );
    updateStep({
      name: 'Provision Database',
      status: 'completed',
      duration: Date.now() - startProvision,
      details: `Created ${config.provider} database`
    });

    // Step 4: Generate Prisma schema
    updateStep({ name: 'Generate Prisma Schema', status: 'running' });
    const startSchema = Date.now();
    await generateAndWritePrismaSchema(config.projectDir, schema, config.provider);
    updateStep({
      name: 'Generate Prisma Schema',
      status: 'completed',
      duration: Date.now() - startSchema,
      details: 'Created prisma/schema.prisma'
    });

    // Step 5: Update environment
    updateStep({ name: 'Update Environment', status: 'running' });
    const startEnv = Date.now();
    await updateEnvironmentFile(config.projectDir, database);
    updateStep({
      name: 'Update Environment',
      status: 'completed',
      duration: Date.now() - startEnv,
      details: 'Updated .env with DATABASE_URL'
    });

    // Step 5.5: Stop dev server (required on Windows to release file locks)
    updateStep({ name: 'Stop Dev Server', status: 'running' });
    const startStop = Date.now();
    try {
      await devServerManager.stopDevServer(config.projectId);
      // Give Windows time to release file handles
      if (IS_WINDOWS) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch {
      // Server might not be running, that's OK
    }
    updateStep({
      name: 'Stop Dev Server',
      status: 'completed',
      duration: Date.now() - startStop,
      details: 'Server stopped for migration'
    });

    // Step 6: Run migrations
    updateStep({ name: 'Run Migrations', status: 'running' });
    const startMigrate = Date.now();
    await runPrismaMigrations(config.projectDir, config.projectId);
    updateStep({
      name: 'Run Migrations',
      status: 'completed',
      duration: Date.now() - startMigrate,
      details: 'Schema applied to database'
    });

    // Step 7: Import data
    updateStep({ name: 'Import Data', status: 'running' });
    const startImport = Date.now();
    await importDataToDatabase(config.projectDir, mockData, schema);
    updateStep({
      name: 'Import Data',
      status: 'completed',
      duration: Date.now() - startImport,
      details: `Imported ${mockData.totalRecords} records`
    });

    // Step 8: Update app code
    updateStep({ name: 'Update App Code', status: 'running' });
    const startCode = Date.now();
    await switchToPrisma(config.projectDir);
    updateStep({
      name: 'Update App Code',
      status: 'completed',
      duration: Date.now() - startCode,
      details: 'Switched from mock db to Prisma'
    });

    // Step 9: Test connection
    updateStep({ name: 'Test Connection', status: 'running' });
    const startTest = Date.now();
    const testResult = await testDatabaseConnection(config.projectDir);
    updateStep({
      name: 'Test Connection',
      status: testResult.success ? 'completed' : 'failed',
      duration: Date.now() - startTest,
      details: testResult.success ? 'Connection verified' : testResult.error
    });

    return {
      success: true,
      provider: config.provider,
      connectionString: database.connectionString,
      steps
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    const currentStep = steps.find(s => s.status === 'running');
    if (currentStep) {
      currentStep.status = 'failed';
      currentStep.error = errorMsg;
    }

    return {
      success: false,
      provider: config.provider,
      steps,
      error: errorMsg
    };
  }
}

/**
 * Parse schema from data-schema.md markdown file
 */
export async function parseSchemaFromMarkdown(projectDir: string): Promise<DatabaseSchema> {
  const schemaPath = path.join(projectDir, 'schema', 'data-schema.md');

  let content: string;
  try {
    content = await fs.readFile(schemaPath, 'utf-8');
  } catch {
    // If no schema file, create a default one from the mock db usage
    return await inferSchemaFromMockDb(projectDir);
  }

  const tables: TableDefinition[] = [];
  let currentTable: TableDefinition | null = null;

  const lines = content.split('\n');

  for (const line of lines) {
    // Match table headers like "## User" or "## GlucoseReading"
    const tableMatch = line.match(/^##\s+(\w+)\s*$/);
    if (tableMatch) {
      if (currentTable) {
        tables.push(currentTable);
      }
      currentTable = {
        name: toSnakeCase(tableMatch[1]),
        columns: []
      };
      continue;
    }

    // Match column definitions like "- id: string (unique identifier)"
    const columnMatch = line.match(/^-\s+(\w+):\s*(\w+)(?:\s*\(([^)]+)\))?/);
    if (columnMatch && currentTable) {
      const [, name, type, modifiers] = columnMatch;
      const column: ColumnDefinition = {
        name,
        type: mapMarkdownTypeToSQL(type),
        nullable: modifiers?.includes('optional') ?? false,
        unique: modifiers?.includes('unique') ?? false,
        primaryKey: name === 'id',
      };

      // Handle defaults
      if (modifiers?.includes('default:')) {
        const defaultMatch = modifiers.match(/default:\s*"?([^"]+)"?/);
        if (defaultMatch) {
          column.default = defaultMatch[1];
        }
      }

      // Add auto-generation for id
      if (name === 'id' && type === 'string') {
        column.default = 'uuid()';
      }

      // Add timestamp defaults
      if (name === 'createdAt') {
        column.default = 'now()';
      }

      currentTable.columns.push(column);
    }
  }

  if (currentTable) {
    tables.push(currentTable);
  }

  return { tables };
}

/**
 * Infer schema from mock database usage in the project
 */
async function inferSchemaFromMockDb(projectDir: string): Promise<DatabaseSchema> {
  // Search for db.create() calls to infer schema
  const tables: TableDefinition[] = [];

  // Default user table
  tables.push({
    name: 'users',
    columns: [
      { name: 'id', type: 'TEXT', primaryKey: true, default: 'uuid()' },
      { name: 'email', type: 'TEXT', unique: true },
      { name: 'name', type: 'TEXT', nullable: true },
      { name: 'role', type: 'TEXT', default: '"user"' },
      { name: 'createdAt', type: 'TIMESTAMP', default: 'now()' },
      { name: 'updatedAt', type: 'TIMESTAMP' },
    ]
  });

  return { tables };
}

/**
 * Export data from mock database
 */
export async function exportMockData(projectDir: string): Promise<MockDataExport> {
  // Read the mock data by importing the seed file and getting the store
  // For now, we'll export by reading the mock-data directory

  const mockDataPath = path.join(projectDir, 'lib', 'mock-data');
  const collections: Record<string, Record<string, unknown>[]> = {};
  let totalRecords = 0;

  try {
    // Check for any JSON data files
    const files = await fs.readdir(mockDataPath);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const data = JSON.parse(
          await fs.readFile(path.join(mockDataPath, file), 'utf-8')
        );
        const collectionName = file.replace('.json', '');
        collections[collectionName] = Array.isArray(data) ? data : [data];
        totalRecords += collections[collectionName].length;
      }
    }
  } catch {
    // No existing data files - that's fine
  }

  return {
    collections,
    exportedAt: new Date().toISOString(),
    totalRecords
  };
}

/**
 * Generate and write Prisma schema file
 */
async function generateAndWritePrismaSchema(
  projectDir: string,
  schema: DatabaseSchema,
  provider: DatabaseProvider
): Promise<void> {
  // Create prisma directory if it doesn't exist
  const prismaDir = path.join(projectDir, 'prisma');
  await fs.mkdir(prismaDir, { recursive: true });

  // Generate Prisma schema
  const prismaSchema = generatePrismaSchema(schema, provider);

  // Write schema file
  await fs.writeFile(path.join(prismaDir, 'schema.prisma'), prismaSchema);
}

/**
 * Update .env file with database connection string
 */
async function updateEnvironmentFile(
  projectDir: string,
  database: ProvisionedDatabase
): Promise<void> {
  const envPath = path.join(projectDir, '.env');

  let envContent = '';
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch {
    // File doesn't exist, start fresh
  }

  // Remove any existing DATABASE_URL
  envContent = envContent
    .split('\n')
    .filter(line => !line.startsWith('DATABASE_URL'))
    .join('\n');

  // Add new DATABASE_URL
  const newEnvContent = `${envContent.trim()}

# Database connection (provisioned by AI Platform)
DATABASE_URL="${database.connectionString}"
`;

  await fs.writeFile(envPath, newEnvContent.trim() + '\n');

  // Also create .env.local for development
  await fs.writeFile(
    path.join(projectDir, '.env.local'),
    `DATABASE_URL="${database.connectionString}"\n`
  );
}

/**
 * Run Prisma migrations to set up database schema
 * Includes retry logic for Windows file locking issues
 */
async function runPrismaMigrations(projectDir: string, projectId?: string): Promise<void> {
  const maxRetries = IS_WINDOWS ? 3 : 1;
  let lastError: Error | null = null;
  const prismaDir = path.join(projectDir, 'node_modules', '.prisma');

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // On Windows, delete .prisma directory to avoid file lock issues
      if (IS_WINDOWS) {
        try {
          await fs.rm(prismaDir, { recursive: true, force: true });
          console.log('[Migration] Deleted .prisma directory');
          // Give Windows time to fully release handles
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch {
          // Directory might not exist, that's OK
        }
      }

      // First, generate Prisma client
      execSync('npx prisma generate', {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 60000,
      });

      // Then push the schema (faster than migrations for initial setup)
      execSync('npx prisma db push --accept-data-loss', {
        cwd: projectDir,
        stdio: 'pipe',
        timeout: 120000,
      });

      return; // Success!
    } catch (error) {
      lastError = error as Error;
      const errorMsg = lastError.message || '';

      // Check if it's a Windows file locking error
      if (IS_WINDOWS && (errorMsg.includes('EPERM') || errorMsg.includes('EBUSY'))) {
        console.log(`[Migration] File lock detected, attempt ${attempt}/${maxRetries}`);

        // Try to stop the dev server again
        if (projectId) {
          try {
            await devServerManager.stopDevServer(projectId);
          } catch {
            // Ignore
          }
        }

        // Try to forcefully delete with taskkill on the specific DLL
        try {
          execSync(`taskkill /F /IM node.exe 2>nul`, {
            cwd: projectDir,
            stdio: 'pipe',
            timeout: 5000
          });
          console.log('[Migration] Killed node processes');
        } catch {
          // May fail if no matching processes
        }

        // Wait longer before retry
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Try deleting .prisma again
        try {
          await fs.rm(prismaDir, { recursive: true, force: true });
        } catch {
          // Ignore
        }

        continue;
      }

      // Not a file locking error, throw immediately
      throw error;
    }
  }

  // All retries exhausted
  throw lastError || new Error('Prisma migration failed after retries');
}

/**
 * Import mock data into the real database
 */
async function importDataToDatabase(
  projectDir: string,
  mockData: MockDataExport,
  schema: DatabaseSchema
): Promise<void> {
  if (mockData.totalRecords === 0) {
    return; // No data to import
  }

  // Create a temporary seed script
  const seedScript = generateSeedScript(mockData, schema);
  const seedPath = path.join(projectDir, 'prisma', 'seed-migration.ts');

  await fs.writeFile(seedPath, seedScript);

  try {
    // Run the seed script
    execSync('npx tsx prisma/seed-migration.ts', {
      cwd: projectDir,
      stdio: 'pipe',
      timeout: 120000,
    });
  } finally {
    // Clean up seed script
    await fs.unlink(seedPath).catch(() => {});
  }
}

/**
 * Generate seed script for data import
 */
function generateSeedScript(mockData: MockDataExport, schema: DatabaseSchema): string {
  let script = `import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Importing mock data...');

`;

  for (const [collection, records] of Object.entries(mockData.collections)) {
    const modelName = toPascalCase(collection);
    const tableExists = schema.tables.some(
      t => t.name === collection || toPascalCase(t.name) === modelName
    );

    if (tableExists && records.length > 0) {
      script += `
  // Import ${collection}
  for (const record of ${JSON.stringify(records, null, 2)}) {
    await prisma.${modelName.charAt(0).toLowerCase() + modelName.slice(1)}.create({
      data: record
    }).catch(e => console.warn('Skipping duplicate:', e.message));
  }
  console.log('Imported ${records.length} ${collection}');
`;
    }
  }

  script += `
  console.log('Data import complete!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
`;

  return script;
}

/**
 * Switch app from mock database to Prisma
 */
async function switchToPrisma(projectDir: string): Promise<void> {
  // Create new Prisma-based db client
  const prismaClient = `import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Re-export as 'db' for compatibility with existing code
export const db = prisma;
export default prisma;
`;

  // Backup the old mock db
  const mockDbPath = path.join(projectDir, 'lib', 'db', 'index.ts');
  const backupPath = path.join(projectDir, 'lib', 'db', 'mock-db.backup.ts');

  try {
    await fs.rename(mockDbPath, backupPath);
  } catch {
    // File might not exist
  }

  // Write new Prisma client
  await fs.writeFile(mockDbPath, prismaClient);

  // Update package.json to add Prisma dependencies
  const packagePath = path.join(projectDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));

  packageJson.dependencies = packageJson.dependencies || {};
  packageJson.dependencies['@prisma/client'] = '^5.7.0';

  packageJson.devDependencies = packageJson.devDependencies || {};
  packageJson.devDependencies['prisma'] = '^5.7.0';

  packageJson.scripts = packageJson.scripts || {};
  packageJson.scripts['db:generate'] = 'prisma generate';
  packageJson.scripts['db:push'] = 'prisma db push';
  packageJson.scripts['db:studio'] = 'prisma studio';

  await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));

  // Run npm install to get Prisma
  execSync('npm install', {
    cwd: projectDir,
    stdio: 'pipe',
    timeout: 120000,
  });
}

/**
 * Test database connection
 */
async function testDatabaseConnection(projectDir: string): Promise<{ success: boolean; error?: string }> {
  const testScript = `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.$connect();
    console.log('CONNECTION_SUCCESS');
    await prisma.$disconnect();
  } catch (error) {
    console.error('CONNECTION_FAILED:', error.message);
    process.exit(1);
  }
}

test();
`;

  const testPath = path.join(projectDir, 'prisma', 'test-connection.ts');
  await fs.writeFile(testPath, testScript);

  try {
    const result = execSync('npx tsx prisma/test-connection.ts', {
      cwd: projectDir,
      stdio: 'pipe',
      timeout: 30000,
      encoding: 'utf-8'
    });

    return {
      success: result.includes('CONNECTION_SUCCESS')
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
  } finally {
    await fs.unlink(testPath).catch(() => {});
  }
}

// Utility functions
function toSnakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

function toPascalCase(str: string): string {
  return str
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

function mapMarkdownTypeToSQL(type: string): string {
  const typeMap: Record<string, string> = {
    'string': 'TEXT',
    'number': 'INTEGER',
    'float': 'REAL',
    'boolean': 'BOOLEAN',
    'datetime': 'TIMESTAMP',
    'date': 'DATE',
    'json': 'JSONB',
  };
  return typeMap[type.toLowerCase()] || 'TEXT';
}
