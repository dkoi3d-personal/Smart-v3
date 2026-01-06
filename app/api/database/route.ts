import { NextRequest, NextResponse } from 'next/server';
import {
  loadDatabaseConfig,
  addDatabaseConnection,
  DatabaseConnection,
} from '@/lib/database-config';

// GET - List all database connections
export async function GET() {
  try {
    const config = await loadDatabaseConfig();

    // Return connections without sensitive data
    const sanitizedConnections = config.connections.map(conn => ({
      ...conn,
      password: conn.password ? '********' : undefined,
      connectionString: conn.connectionString ? '********' : undefined,
    }));

    return NextResponse.json({
      connections: sanitizedConnections,
      activeConnectionId: config.activeConnectionId,
      schemas: config.schemas,
    });
  } catch (error) {
    console.error('Failed to load database config:', error);
    return NextResponse.json(
      { error: 'Failed to load database configuration' },
      { status: 500 }
    );
  }
}

// POST - Add new database connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name,
      type,
      provider,
      host,
      port,
      database,
      username,
      password,
      ssl,
      connectionString,
      poolSize,
    } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    const connection = await addDatabaseConnection({
      name,
      type,
      provider: provider || 'custom',
      host: host || 'localhost',
      port: port || 5432,
      database: database || '',
      username,
      password,
      ssl: ssl || false,
      connectionString,
      poolSize: poolSize || 10,
    });

    // Return without sensitive data
    const sanitized: Partial<DatabaseConnection> = {
      ...connection,
      password: connection.password ? '********' : undefined,
      connectionString: connection.connectionString ? '********' : undefined,
    };

    return NextResponse.json(sanitized);
  } catch (error) {
    console.error('Failed to add database connection:', error);
    return NextResponse.json(
      { error: 'Failed to add database connection' },
      { status: 500 }
    );
  }
}
