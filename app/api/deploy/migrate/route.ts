/**
 * Deployment Migration API
 *
 * GET /api/deploy/migrate?projectDirectory=xxx
 * - Check schema migration status for deployment
 *
 * POST /api/deploy/migrate
 * - Apply schema migrations during deployment
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkMigrationStatus,
  applyMigrations,
  getAllowedStrategies,
  isStrategyAllowed,
  type MigrationStrategy,
  type DeployEnvironment,
} from '@/lib/database/migration-service';
import { loadInfrastructureConfig } from '@/lib/infrastructure-config';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * GET - Check migration status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const projectDirectory = searchParams.get('projectDirectory');
  const environment = (searchParams.get('environment') || 'dev') as DeployEnvironment;

  if (!projectDirectory) {
    return NextResponse.json(
      { error: 'projectDirectory is required' },
      { status: 400 }
    );
  }

  try {
    // Get connection string from .env
    let connectionString: string | null = null;
    const envPath = path.join(projectDirectory, '.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (dbUrlMatch) {
        connectionString = dbUrlMatch[1];
      }
    } catch {
      // .env not found
    }

    if (!connectionString) {
      return NextResponse.json({
        error: 'No database connection string found. Check .env file.',
        hasDatabase: false,
      }, { status: 400 });
    }

    const status = await checkMigrationStatus(projectDirectory, connectionString);
    const allowedStrategies = getAllowedStrategies(environment);

    return NextResponse.json({
      ...status,
      environment,
      allowedStrategies,
      strategyDescriptions: {
        'migrate': 'Apply committed migrations (safest, requires migration files)',
        'push-safe': 'Sync schema - fails if changes would lose data',
        'push-force': 'Force sync schema - may lose data (requires confirmation)',
        'reset': 'Wipe database and re-seed (DEV/TEST only, requires confirmation)',
        'none': 'Skip schema sync - database may be out of sync',
      },
    });
  } catch (error: any) {
    console.error('Failed to check migration status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check migration status' },
      { status: 500 }
    );
  }
}

/**
 * POST - Apply migrations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      projectDirectory,
      strategy = 'migrate',
      environment = 'dev',
      seed = false,
      force = false,
    } = body;

    if (!projectDirectory) {
      return NextResponse.json(
        { error: 'projectDirectory is required' },
        { status: 400 }
      );
    }

    // Validate strategy is allowed for environment
    if (!isStrategyAllowed(strategy as MigrationStrategy, environment as DeployEnvironment)) {
      return NextResponse.json({
        error: `Strategy '${strategy}' is not allowed in '${environment}' environment`,
        allowedStrategies: getAllowedStrategies(environment as DeployEnvironment),
      }, { status: 400 });
    }

    // Get connection string
    let connectionString: string | null = null;
    const envPath = path.join(projectDirectory, '.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\n]+)["']?/);
      if (dbUrlMatch) {
        connectionString = dbUrlMatch[1];
      }
    } catch {
      // .env not found
    }

    if (!connectionString) {
      return NextResponse.json({
        error: 'No database connection string found in .env',
      }, { status: 400 });
    }

    // Require explicit confirmation for destructive operations
    if ((strategy === 'push-force' || strategy === 'reset') && !force) {
      return NextResponse.json({
        error: `Strategy '${strategy}' requires explicit confirmation. Set force=true to proceed.`,
        requiresConfirmation: true,
        warning: strategy === 'reset'
          ? 'This will DELETE ALL DATA and re-seed the database!'
          : 'This may cause data loss if schema changes are destructive.',
      }, { status: 400 });
    }

    console.log(`[Migration API] Applying '${strategy}' strategy to ${projectDirectory}`);
    const result = await applyMigrations(
      projectDirectory,
      connectionString,
      strategy as MigrationStrategy,
      { seed, force }
    );

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Migration failed:', error);
    return NextResponse.json(
      { error: error.message || 'Migration failed' },
      { status: 500 }
    );
  }
}
