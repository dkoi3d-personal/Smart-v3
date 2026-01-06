/**
 * Credentials API
 * Manages secure storage and retrieval of API keys and credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCredential,
  setCredential,
  deleteCredential,
  getCredentialStatus,
  CREDENTIAL_CONFIGS,
  CredentialType,
} from '@/lib/credentials-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/credentials
 * Get credential status (which credentials are configured)
 * Does NOT return actual credential values for security
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const type = searchParams.get('type') as CredentialType | null;

    // If specific type requested, check if it exists (don't return values)
    if (type) {
      const cred = await getCredential(type, userId);
      return NextResponse.json({
        type,
        configured: cred !== null,
        config: CREDENTIAL_CONFIGS.find(c => c.type === type),
      });
    }

    // Return status of all credential types
    const status = await getCredentialStatus(userId);
    return NextResponse.json({
      status,
      configs: CREDENTIAL_CONFIGS,
    });
  } catch (error) {
    console.error('Error getting credentials:', error);
    return NextResponse.json(
      { error: 'Failed to get credential status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/credentials
 * Save a new credential
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, values, userId = 'default' } = body;

    if (!type || !values) {
      return NextResponse.json(
        { error: 'Type and values are required' },
        { status: 400 }
      );
    }

    // Validate credential type
    const config = CREDENTIAL_CONFIGS.find(c => c.type === type);
    if (!config) {
      return NextResponse.json(
        { error: `Invalid credential type: ${type}` },
        { status: 400 }
      );
    }

    // Validate required fields
    for (const field of config.fields) {
      if (field.required && !values[field.key]) {
        return NextResponse.json(
          { error: `Missing required field: ${field.label}` },
          { status: 400 }
        );
      }
    }

    // Save credential
    await setCredential(type, values, userId);

    return NextResponse.json({
      success: true,
      type,
      message: `${config.label} credentials saved successfully`,
    });
  } catch (error) {
    console.error('Error saving credentials:', error);
    return NextResponse.json(
      { error: 'Failed to save credentials' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/credentials
 * Remove a credential
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as CredentialType;
    const userId = searchParams.get('userId') || 'default';

    if (!type) {
      return NextResponse.json(
        { error: 'Type is required' },
        { status: 400 }
      );
    }

    await deleteCredential(type, userId);

    return NextResponse.json({
      success: true,
      type,
      message: 'Credential removed successfully',
    });
  } catch (error) {
    console.error('Error deleting credentials:', error);
    return NextResponse.json(
      { error: 'Failed to delete credentials' },
      { status: 500 }
    );
  }
}
