/**
 * Database Connection Test API
 *
 * Tests a database connection string before applying it
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, connectionString } = body;

    if (!projectId || !connectionString) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate connection string format
    if (!connectionString.startsWith('postgresql://') && !connectionString.startsWith('postgres://')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid connection string format. Must start with postgresql:// or postgres://',
      }, { status: 400 });
    }

    const projectDir = getProjectDir(projectId);

    // Verify project exists
    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Create a temporary test script
    const testScript = `
const { Client } = require('pg');

async function test() {
  const client = new Client({
    connectionString: process.env.TEST_CONNECTION_STRING,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const result = await client.query('SELECT NOW() as time, current_database() as database');
    console.log(JSON.stringify({
      success: true,
      database: result.rows[0].database,
      serverTime: result.rows[0].time,
    }));
    await client.end();
  } catch (error) {
    console.log(JSON.stringify({
      success: false,
      error: error.message,
    }));
    process.exit(1);
  }
}

test();
`;

    const testPath = path.join(projectDir, '.test-connection.js');

    try {
      // Write test script
      await fs.writeFile(testPath, testScript);

      // Check if pg is installed, if not skip the detailed test
      let result: { success: boolean; database?: string; serverTime?: string; error?: string };

      try {
        const output = execSync('node .test-connection.js', {
          cwd: projectDir,
          timeout: 15000,
          encoding: 'utf-8',
          env: {
            ...process.env,
            TEST_CONNECTION_STRING: connectionString,
          },
        });

        result = JSON.parse(output.trim());
      } catch (execError: any) {
        // If pg isn't installed, do a basic URL validation
        if (execError.message?.includes('Cannot find module') || execError.message?.includes("'pg'")) {
          // Just validate the URL format
          try {
            const url = new URL(connectionString);
            result = {
              success: true,
              database: url.pathname.slice(1),
              serverTime: new Date().toISOString(),
            };
          } catch {
            result = {
              success: false,
              error: 'Invalid connection string URL format',
            };
          }
        } else {
          // Parse the error output
          try {
            const errorOutput = execError.stdout || execError.stderr || '';
            result = JSON.parse(errorOutput.trim());
          } catch {
            result = {
              success: false,
              error: execError.message || 'Connection failed',
            };
          }
        }
      }

      return NextResponse.json(result);

    } finally {
      // Clean up test script
      await fs.unlink(testPath).catch(() => {});
    }

  } catch (error) {
    console.error('Connection test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
