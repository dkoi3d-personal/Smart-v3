/**
 * Migration Generation API
 *
 * POST /api/deploy/migrate/generate
 * Auto-generates Prisma migration files for schema changes
 *
 * This is designed for non-technical users - they don't need to run
 * terminal commands locally. The platform handles migration creation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Generate a descriptive migration name from schema changes
 */
function generateMigrationName(schemaPath: string): string {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');

  // Try to detect what changed by reading the schema
  // For now, use a generic name with timestamp
  return `auto_${timestamp}_schema_update`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectDirectory, migrationName } = body;

    if (!projectDirectory) {
      return NextResponse.json(
        { error: 'projectDirectory is required' },
        { status: 400 }
      );
    }

    // Verify project exists
    try {
      await fs.access(projectDirectory);
    } catch {
      return NextResponse.json(
        { error: 'Project directory not found' },
        { status: 404 }
      );
    }

    // Check if schema.prisma exists
    const schemaPath = path.join(projectDirectory, 'prisma', 'schema.prisma');
    try {
      await fs.access(schemaPath);
    } catch {
      return NextResponse.json(
        { error: 'No Prisma schema found in project' },
        { status: 400 }
      );
    }

    // Generate migration name if not provided
    const name = migrationName || generateMigrationName(schemaPath);
    const safeName = name.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();

    console.log(`[Migration Generate] Creating migration '${safeName}' for ${projectDirectory}`);

    // Get DATABASE_URL from .env for the migration
    let env = { ...process.env };
    const envPath = path.join(projectDirectory, '.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (dbUrlMatch) {
        env.DATABASE_URL = dbUrlMatch[1];
      }
    } catch {
      // .env not found - migrations might still work for SQLite
    }

    try {
      // First, generate the Prisma client to ensure schema is valid
      console.log('[Migration Generate] Validating schema...');
      execSync('npx prisma generate', {
        cwd: projectDirectory,
        stdio: 'pipe',
        env,
        timeout: 60000,
      });

      // Create the migration using prisma migrate dev with --create-only
      // This creates the migration file without applying it
      console.log('[Migration Generate] Creating migration file...');
      const output = execSync(`npx prisma migrate dev --name ${safeName} --create-only`, {
        cwd: projectDirectory,
        stdio: 'pipe',
        env,
        timeout: 120000,
      }).toString();

      console.log('[Migration Generate] Migration created successfully');

      // Extract migration name from output
      const migrationMatch = output.match(/migrations[\/\\](\d+_\w+)/);
      const createdMigration = migrationMatch ? migrationMatch[1] : safeName;

      // Read the migrations directory to get the list of migrations
      const migrationsDir = path.join(projectDirectory, 'prisma', 'migrations');
      let migrations: string[] = [];
      try {
        const entries = await fs.readdir(migrationsDir);
        migrations = entries.filter(e => /^\d+_/.test(e)).sort();
      } catch {
        // No migrations dir yet
      }

      return NextResponse.json({
        success: true,
        migration: createdMigration,
        allMigrations: migrations,
        message: `Migration '${createdMigration}' created successfully. Ready to deploy.`,
      });

    } catch (error: any) {
      const errorOutput = error.stdout?.toString() || error.stderr?.toString() || error.message;

      // Check for common issues
      if (errorOutput.includes('No pending migrations')) {
        return NextResponse.json({
          success: true,
          migration: null,
          message: 'Schema is already in sync - no migration needed.',
        });
      }

      if (errorOutput.includes('already in sync')) {
        return NextResponse.json({
          success: true,
          migration: null,
          message: 'Database schema is already in sync.',
        });
      }

      console.error('[Migration Generate] Failed:', errorOutput);
      return NextResponse.json(
        {
          error: 'Failed to create migration',
          details: errorOutput,
        },
        { status: 500 }
      );
    }

  } catch (error: any) {
    console.error('[Migration Generate] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate migration' },
      { status: 500 }
    );
  }
}
