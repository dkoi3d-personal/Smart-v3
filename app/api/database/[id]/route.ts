import { NextRequest, NextResponse } from 'next/server';
import {
  loadDatabaseConfig,
  updateDatabaseConnection,
  deleteDatabaseConnection,
  getDecryptedConnectionString,
} from '@/lib/database-config';

// GET - Get specific connection details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await loadDatabaseConfig();
    const connection = config.connections.find(c => c.id === id);

    if (!connection) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    // Check if reveal parameter is set
    const reveal = request.nextUrl.searchParams.get('reveal') === 'true';

    if (reveal) {
      const connectionString = await getDecryptedConnectionString(connection);
      return NextResponse.json({
        ...connection,
        connectionString,
        password: '********', // Still hide password directly
      });
    }

    return NextResponse.json({
      ...connection,
      password: connection.password ? '********' : undefined,
      connectionString: connection.connectionString ? '********' : undefined,
    });
  } catch (error) {
    console.error('Failed to get database connection:', error);
    return NextResponse.json(
      { error: 'Failed to get database connection' },
      { status: 500 }
    );
  }
}

// PUT - Update connection
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const updated = await updateDatabaseConnection(id, body);

    if (!updated) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...updated,
      password: updated.password ? '********' : undefined,
      connectionString: updated.connectionString ? '********' : undefined,
    });
  } catch (error) {
    console.error('Failed to update database connection:', error);
    return NextResponse.json(
      { error: 'Failed to update database connection' },
      { status: 500 }
    );
  }
}

// DELETE - Remove connection
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const deleted = await deleteDatabaseConnection(id);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Connection not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete database connection:', error);
    return NextResponse.json(
      { error: 'Failed to delete database connection' },
      { status: 500 }
    );
  }
}
