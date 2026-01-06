/**
 * Epic Setup Route
 *
 * Configures Epic credentials from the config file or request body.
 */

import { NextRequest, NextResponse } from 'next/server';
import { setCredential, getCredential } from '@/lib/credentials-store';
import { promises as fs } from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'data', 'epic-config.json');

/**
 * POST /api/epic/setup
 * Set up Epic credentials
 */
export async function POST(request: NextRequest) {
  try {
    let config: any;

    // Try to get config from request body first
    try {
      const body = await request.json();
      if (body.clientId) {
        config = body;
      }
    } catch {
      // No body, try config file
    }

    // Fall back to config file
    if (!config) {
      try {
        const fileContent = await fs.readFile(CONFIG_FILE, 'utf-8');
        config = JSON.parse(fileContent);
      } catch {
        return NextResponse.json(
          { error: 'No configuration provided and no config file found' },
          { status: 400 }
        );
      }
    }

    if (!config.clientId) {
      return NextResponse.json(
        { error: 'Client ID is required' },
        { status: 400 }
      );
    }

    // Save to credentials store
    await setCredential('epic', {
      clientId: config.clientId,
      environment: config.environment || 'sandbox',
      scopes: config.scopes || 'patient/Patient.read patient/Observation.read openid fhirUser',
      productionFhirUrl: config.productionFhirUrl || '',
    });

    console.log(`[Epic Setup] Configured Epic with Client ID: ${config.clientId.substring(0, 8)}...`);

    return NextResponse.json({
      success: true,
      message: 'Epic credentials configured successfully',
      environment: config.environment || 'sandbox',
      clientId: `${config.clientId.substring(0, 8)}...${config.clientId.substring(config.clientId.length - 4)}`,
    });
  } catch (error: any) {
    console.error('[Epic Setup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to configure Epic', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/epic/setup
 * Check current Epic configuration
 */
export async function GET() {
  try {
    const creds = await getCredential('epic');

    if (!creds?.clientId) {
      // Check if config file exists
      let configFileExists = false;
      try {
        await fs.access(CONFIG_FILE);
        configFileExists = true;
      } catch {
        // File doesn't exist
      }

      return NextResponse.json({
        configured: false,
        configFileExists,
        message: configFileExists
          ? 'Config file found. POST to /api/epic/setup to load it.'
          : 'No Epic credentials configured',
      });
    }

    return NextResponse.json({
      configured: true,
      environment: creds.environment || 'sandbox',
      clientId: `${creds.clientId.substring(0, 8)}...`,
      hasScopes: !!creds.scopes,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to check configuration', details: error.message },
      { status: 500 }
    );
  }
}
