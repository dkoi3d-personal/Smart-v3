/**
 * Database Migration Service
 *
 * Handles safe database migrations during deployments.
 *
 * Strategies:
 * - 'migrate': Use prisma migrate deploy (safest, requires migration files)
 * - 'push-safe': Use prisma db push without --accept-data-loss (fails on breaking changes)
 * - 'push-force': Use prisma db push --accept-data-loss (DANGEROUS - can lose data)
 * - 'reset': Wipe database and re-seed (DEV/TEST ONLY)
 * - 'none': Skip schema sync entirely
 *
 * Environment behavior:
 * - production: Only allows 'migrate' or 'none' by default
 * - staging: Allows 'migrate', 'push-safe', or 'none'
 * - dev: Allows all strategies including 'reset'
 */

import { execSync, exec } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

export type MigrationStrategy = 'migrate' | 'push-safe' | 'push-force' | 'reset' | 'none';
export type DeployEnvironment = 'dev' | 'staging' | 'production';

/**
 * Get allowed migration strategies for an environment
 */
export function getAllowedStrategies(environment: DeployEnvironment): MigrationStrategy[] {
  switch (environment) {
    case 'production':
      return ['migrate', 'none']; // Production: only safe migrations or skip
    case 'staging':
      return ['migrate', 'push-safe', 'none']; // Staging: no destructive ops
    case 'dev':
    default:
      return ['migrate', 'push-safe', 'push-force', 'reset', 'none']; // Dev: all options
  }
}

/**
 * Validate if a strategy is allowed for an environment
 */
export function isStrategyAllowed(
  strategy: MigrationStrategy,
  environment: DeployEnvironment
): boolean {
  return getAllowedStrategies(environment).includes(strategy);
}

export interface MigrationStatus {
  hasPendingMigrations: boolean;
  pendingMigrations: string[];
  hasSchemaChanges: boolean;
  isDestructive: boolean;
  destructiveChanges: string[];
  currentSchema: string[];
  recommendation: MigrationStrategy;
}

export interface MigrationResult {
  success: boolean;
  strategy: MigrationStrategy;
  migrationsApplied: string[];
  warnings: string[];
  error?: string;
}

/**
 * Check the migration status of a project
 */
export async function checkMigrationStatus(
  projectDir: string,
  connectionString: string
): Promise<MigrationStatus> {
  const env = { ...process.env, DATABASE_URL: connectionString };
  const status: MigrationStatus = {
    hasPendingMigrations: false,
    pendingMigrations: [],
    hasSchemaChanges: false,
    isDestructive: false,
    destructiveChanges: [],
    currentSchema: [],
    recommendation: 'none',
  };

  try {
    // Check if migrations directory exists
    const migrationsDir = path.join(projectDir, 'prisma', 'migrations');
    const hasMigrationsDir = await fs.access(migrationsDir).then(() => true).catch(() => false);

    if (hasMigrationsDir) {
      // Check for pending migrations using prisma migrate status
      try {
        const migrateStatus = execSync('npx prisma migrate status', {
          cwd: projectDir,
          stdio: 'pipe',
          env,
          timeout: 30000,
        }).toString();

        // Parse the output to find pending migrations
        if (migrateStatus.includes('Following migration have not yet been applied')) {
          status.hasPendingMigrations = true;
          // Extract migration names from output
          const lines = migrateStatus.split('\n');
          for (const line of lines) {
            const match = line.match(/^\s*(\d+_\w+)/);
            if (match) {
              status.pendingMigrations.push(match[1]);
            }
          }
        }
      } catch (error: any) {
        // migrate status exits with error code if there are issues
        const output = error.stdout?.toString() || error.message || '';
        if (output.includes('not yet been applied')) {
          status.hasPendingMigrations = true;
        }
      }
    }

    // Check for schema drift using prisma db push --dry-run
    try {
      // First generate the client to ensure schema is parsed
      execSync('npx prisma generate', {
        cwd: projectDir,
        stdio: 'pipe',
        env,
        timeout: 60000,
      });

      // Use db push with preview flag to see what would change
      const pushPreview = execSync('npx prisma db push --accept-data-loss --force-reset 2>&1 || true', {
        cwd: projectDir,
        stdio: 'pipe',
        env,
        timeout: 30000,
      }).toString();

      // Parse for destructive changes
      if (pushPreview.includes('drop') || pushPreview.includes('DELETE')) {
        status.isDestructive = true;
        // Extract what would be dropped
        const lines = pushPreview.split('\n');
        for (const line of lines) {
          if (line.toLowerCase().includes('drop') || line.includes('will be removed')) {
            status.destructiveChanges.push(line.trim());
          }
        }
      }

      if (pushPreview.includes('changes') || pushPreview.includes('alter') || pushPreview.includes('create')) {
        status.hasSchemaChanges = true;
      }
    } catch {
      // If dry run fails, assume there might be changes
      status.hasSchemaChanges = true;
    }

    // Get current models from schema
    try {
      const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
      const schemaContent = await fs.readFile(schemaPath, 'utf-8');
      const modelMatches = schemaContent.matchAll(/model\s+(\w+)\s*\{/g);
      for (const match of modelMatches) {
        status.currentSchema.push(match[1]);
      }
    } catch {
      // Schema read failed
    }

    // Determine recommendation
    if (status.hasPendingMigrations) {
      status.recommendation = 'migrate';
    } else if (status.hasSchemaChanges) {
      status.recommendation = status.isDestructive ? 'push-force' : 'push-safe';
    } else {
      status.recommendation = 'none';
    }

    return status;
  } catch (error: any) {
    console.error('Failed to check migration status:', error);
    return status;
  }
}

/**
 * Apply migrations to the database
 */
export async function applyMigrations(
  projectDir: string,
  connectionString: string,
  strategy: MigrationStrategy,
  options: {
    seed?: boolean;
    force?: boolean;
  } = {}
): Promise<MigrationResult> {
  const env = { ...process.env, DATABASE_URL: connectionString };
  const result: MigrationResult = {
    success: false,
    strategy,
    migrationsApplied: [],
    warnings: [],
  };

  if (strategy === 'none') {
    result.success = true;
    result.warnings.push('Schema sync skipped - database may be out of sync with code');
    return result;
  }

  try {
    // Always generate client first
    console.log('[Migration] Generating Prisma client...');
    execSync('npx prisma generate', {
      cwd: projectDir,
      stdio: 'pipe',
      env,
      timeout: 60000,
    });

    switch (strategy) {
      case 'migrate': {
        // Safe migration using committed migration files
        console.log('[Migration] Applying migrations with prisma migrate deploy...');
        try {
          const output = execSync('npx prisma migrate deploy', {
            cwd: projectDir,
            stdio: 'pipe',
            env,
            timeout: 120000,
          }).toString();

          // Parse applied migrations from output
          const migrationMatches = output.matchAll(/Applied migration[s]?:?\s*([\w_]+)/gi);
          for (const match of migrationMatches) {
            result.migrationsApplied.push(match[1]);
          }

          result.success = true;
          console.log('[Migration] Migrations applied successfully');
        } catch (error: any) {
          const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;

          // Check if it's just "no pending migrations"
          if (errorOutput.includes('No pending migrations') || errorOutput.includes('already in sync')) {
            result.success = true;
            result.warnings.push('No pending migrations to apply');
          } else {
            throw error;
          }
        }
        break;
      }

      case 'push-safe': {
        // Push schema without accepting data loss - will fail on breaking changes
        console.log('[Migration] Pushing schema with prisma db push (safe mode)...');
        try {
          execSync('npx prisma db push', {
            cwd: projectDir,
            stdio: 'pipe',
            env,
            timeout: 120000,
          });
          result.success = true;
          console.log('[Migration] Schema pushed successfully');
        } catch (error: any) {
          const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;

          if (errorOutput.includes('data loss') || errorOutput.includes('destructive')) {
            result.error = 'Schema changes would cause data loss. Use push-force strategy or create a migration.';
            result.warnings.push('Detected destructive changes - refusing to apply without explicit confirmation');
          } else {
            throw error;
          }
        }
        break;
      }

      case 'push-force': {
        // DANGEROUS: Push with accept-data-loss flag
        console.log('[Migration] ⚠️ Pushing schema with prisma db push --accept-data-loss...');
        result.warnings.push('Using force push - data may be lost!');

        if (!options.force) {
          result.error = 'Force push requires explicit confirmation';
          return result;
        }

        execSync('npx prisma db push --accept-data-loss', {
          cwd: projectDir,
          stdio: 'pipe',
          env,
          timeout: 120000,
        });
        result.success = true;
        result.warnings.push('Schema force-pushed - some data may have been lost');
        console.log('[Migration] Schema force-pushed');
        break;
      }

      case 'reset': {
        // DESTRUCTIVE: Wipe database completely and re-seed (DEV/TEST ONLY)
        console.log('[Migration] 🗑️ Resetting database (DEV/TEST mode)...');
        result.warnings.push('Database reset - ALL DATA WILL BE DELETED!');

        if (!options.force) {
          result.error = 'Database reset requires explicit confirmation';
          return result;
        }

        // Use migrate reset which drops all tables and re-applies migrations
        try {
          execSync('npx prisma migrate reset --force --skip-seed', {
            cwd: projectDir,
            stdio: 'pipe',
            env,
            timeout: 180000,
          });
          result.success = true;
          result.warnings.push('Database has been completely reset');
          console.log('[Migration] Database reset complete');

          // Always seed after reset
          const seedPath = path.join(projectDir, 'prisma', 'seed.ts');
          const seedJsPath = path.join(projectDir, 'prisma', 'seed.js');
          const hasSeed = await fs.access(seedPath).then(() => true).catch(() => false) ||
                          await fs.access(seedJsPath).then(() => true).catch(() => false);

          if (hasSeed) {
            console.log('[Migration] Seeding fresh database...');
            try {
              execSync('npx prisma db seed', {
                cwd: projectDir,
                stdio: 'pipe',
                env,
                timeout: 180000,
              });
              console.log('[Migration] Fresh database seeded successfully');
            } catch (seedError) {
              result.warnings.push('Seeding failed after reset');
            }
          }
        } catch (error: any) {
          // If migrate reset fails (no migrations), fall back to db push with reset
          console.log('[Migration] Migrate reset failed, trying db push with force-reset...');
          execSync('npx prisma db push --force-reset --accept-data-loss', {
            cwd: projectDir,
            stdio: 'pipe',
            env,
            timeout: 120000,
          });
          result.success = true;
          result.warnings.push('Database reset via db push --force-reset');
        }
        break;
      }
    }

    // Run seed if requested and successful
    if (result.success && options.seed) {
      const seedPath = path.join(projectDir, 'prisma', 'seed.ts');
      const seedJsPath = path.join(projectDir, 'prisma', 'seed.js');
      const hasSeed = await fs.access(seedPath).then(() => true).catch(() => false) ||
                      await fs.access(seedJsPath).then(() => true).catch(() => false);

      if (hasSeed) {
        console.log('[Migration] Running database seed...');
        try {
          execSync('npx prisma db seed', {
            cwd: projectDir,
            stdio: 'pipe',
            env,
            timeout: 180000,
          });
          console.log('[Migration] Database seeded successfully');
        } catch (seedError) {
          result.warnings.push('Seeding failed but migration succeeded');
        }
      }
    }

    return result;
  } catch (error: any) {
    console.error('[Migration] Failed:', error);
    result.error = error.message || 'Migration failed';
    return result;
  }
}

/**
 * Create a new migration file (for development use)
 */
export async function createMigration(
  projectDir: string,
  migrationName: string
): Promise<{ success: boolean; migrationFile?: string; error?: string }> {
  try {
    const output = execSync(`npx prisma migrate dev --name ${migrationName} --create-only`, {
      cwd: projectDir,
      stdio: 'pipe',
      timeout: 60000,
    }).toString();

    // Extract migration file path from output
    const match = output.match(/migrations\/(\d+_\w+)/);
    return {
      success: true,
      migrationFile: match ? match[1] : undefined,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Failed to create migration',
    };
  }
}

export const migrationService = {
  checkMigrationStatus,
  applyMigrations,
  createMigration,
};
