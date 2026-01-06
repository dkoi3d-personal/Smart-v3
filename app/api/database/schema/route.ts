import { NextRequest, NextResponse } from 'next/server';
import {
  loadDatabaseConfig,
  saveSchema,
  generatePrismaSchema,
  generateSQLMigration,
  DatabaseSchema,
} from '@/lib/database-config';

// GET - Get schema for active connection
export async function GET(request: NextRequest) {
  try {
    const connectionId = request.nextUrl.searchParams.get('connectionId');
    const config = await loadDatabaseConfig();

    const id = connectionId || config.activeConnectionId;
    if (!id) {
      return NextResponse.json(
        { error: 'No connection specified or active' },
        { status: 400 }
      );
    }

    const schema = config.schemas[id];
    const connection = config.connections.find(c => c.id === id);

    return NextResponse.json({
      schema: schema || { tables: [], version: '1.0.0', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
      connectionId: id,
      connectionName: connection?.name,
      databaseType: connection?.type,
    });
  } catch (error) {
    console.error('Failed to get schema:', error);
    return NextResponse.json(
      { error: 'Failed to get schema' },
      { status: 500 }
    );
  }
}

// POST - Save or update schema
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, schema } = body;

    if (!connectionId || !schema) {
      return NextResponse.json(
        { error: 'Connection ID and schema are required' },
        { status: 400 }
      );
    }

    const config = await loadDatabaseConfig();
    const connection = config.connections.find(c => c.id === connectionId);

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    const fullSchema: DatabaseSchema = {
      tables: schema.tables || [],
      version: schema.version || '1.0.0',
      createdAt: schema.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveSchema(connectionId, fullSchema);

    return NextResponse.json({
      success: true,
      schema: fullSchema,
    });
  } catch (error) {
    console.error('Failed to save schema:', error);
    return NextResponse.json(
      { error: 'Failed to save schema' },
      { status: 500 }
    );
  }
}

// PUT - Generate migration/Prisma schema
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { connectionId, format } = body;

    if (!connectionId) {
      return NextResponse.json(
        { error: 'Connection ID is required' },
        { status: 400 }
      );
    }

    const config = await loadDatabaseConfig();
    const connection = config.connections.find(c => c.id === connectionId);
    const schema = config.schemas[connectionId];

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    if (!schema || schema.tables.length === 0) {
      return NextResponse.json(
        { error: 'No schema defined for this connection' },
        { status: 400 }
      );
    }

    let output: string;
    let filename: string;

    if (format === 'prisma') {
      output = generatePrismaSchema(schema, connection.type);
      filename = 'schema.prisma';
    } else {
      output = generateSQLMigration(schema, connection.type);
      filename = `migration_${Date.now()}.sql`;
    }

    return NextResponse.json({
      output,
      filename,
      format: format || 'sql',
    });
  } catch (error) {
    console.error('Failed to generate migration:', error);
    return NextResponse.json(
      { error: 'Failed to generate migration' },
      { status: 500 }
    );
  }
}
