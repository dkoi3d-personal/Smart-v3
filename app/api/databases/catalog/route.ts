import { NextRequest, NextResponse } from 'next/server';
import databaseCatalog from '@/lib/services/database-catalog';

/**
 * GET /api/databases/catalog
 * Returns the full database catalog for the UI
 */
export async function GET(request: NextRequest) {
  try {
    const catalog = databaseCatalog.loadDatabaseCatalog();

    // Filter to only enabled databases
    const enabledDatabases = catalog.databases.filter(db => db.enabled);

    return NextResponse.json({
      version: catalog.version,
      lastUpdated: catalog.lastUpdated,
      defaultDatabaseId: catalog.defaultDatabaseId,
      defaultComplianceLevel: catalog.defaultComplianceLevel,
      databases: enabledDatabases,
    });
  } catch (error) {
    console.error('[DatabaseCatalog] Error loading catalog:', error);
    return NextResponse.json(
      { error: 'Failed to load database catalog' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/databases/catalog
 * Get infrastructure configuration for a specific database
 *
 * Body: { databaseId: string, complianceLevel: 'hipaa' | 'standard' | 'development' }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { databaseId, complianceLevel, projectName, tier } = body;

    if (!databaseId) {
      return NextResponse.json(
        { error: 'databaseId is required' },
        { status: 400 }
      );
    }

    const database = databaseCatalog.getDatabaseById(databaseId);
    if (!database) {
      return NextResponse.json(
        { error: `Database not found: ${databaseId}` },
        { status: 404 }
      );
    }

    // Get infrastructure configuration
    const infraConfig = databaseCatalog.getInfraConfig(
      databaseId,
      complianceLevel || 'hipaa'
    );

    if (!infraConfig) {
      return NextResponse.json(
        { error: 'Failed to generate infrastructure config' },
        { status: 500 }
      );
    }

    // Generate deployment configs if projectName provided
    let terraform = '';
    let dockerCompose = '';

    if (projectName) {
      terraform = databaseCatalog.generateTerraformConfig(
        databaseId,
        complianceLevel || 'hipaa',
        projectName,
        tier || 'burstable'
      );
    }

    dockerCompose = databaseCatalog.generateDockerCompose(databaseId);

    return NextResponse.json({
      database: infraConfig.database,
      settings: infraConfig.settings,
      localDev: infraConfig.localDev,
      azureDeploy: infraConfig.azureDeploy,
      generatedConfigs: {
        terraform,
        dockerCompose,
      },
    });
  } catch (error) {
    console.error('[DatabaseCatalog] Error generating config:', error);
    return NextResponse.json(
      { error: 'Failed to generate database configuration' },
      { status: 500 }
    );
  }
}
