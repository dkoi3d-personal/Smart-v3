/**
 * Credential Type API
 * Get or update a specific credential type
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCredential,
  setCredential,
  deleteCredential,
  CREDENTIAL_CONFIGS,
  CredentialType,
} from '@/lib/credentials-store';

export const dynamic = 'force-dynamic';

/**
 * GET /api/credentials/[type]
 * Check if a specific credential is configured
 * Use ?reveal=true to get actual values (for viewing in settings)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type: typeParam } = await params;
    const type = typeParam as CredentialType;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';
    const reveal = searchParams.get('reveal') === 'true';

    const config = CREDENTIAL_CONFIGS.find(c => c.type === type);
    if (!config) {
      return NextResponse.json(
        { error: `Invalid credential type: ${type}` },
        { status: 400 }
      );
    }

    const cred = await getCredential(type, userId);

    // Return masked values for display (show that values exist without exposing them)
    let maskedValues: Record<string, string> | null = null;
    let actualValues: Record<string, string> | null = null;

    if (cred) {
      maskedValues = {};
      for (const key of Object.keys(cred)) {
        const value = cred[key];
        if (value.length > 8) {
          maskedValues[key] = value.slice(0, 4) + '****' + value.slice(-4);
        } else {
          maskedValues[key] = '****';
        }
      }

      // Only return actual values if explicitly requested
      if (reveal) {
        actualValues = cred;
      }
    }

    return NextResponse.json({
      type,
      configured: cred !== null,
      config,
      maskedValues,
      ...(reveal && actualValues ? { values: actualValues } : {}),
    });
  } catch (error) {
    console.error('Error getting credential:', error);
    return NextResponse.json(
      { error: 'Failed to get credential' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/credentials/[type]
 * Update a specific credential
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type: typeParam } = await params;
    const type = typeParam as CredentialType;
    const body = await request.json();
    const { values, userId = 'default' } = body;

    const config = CREDENTIAL_CONFIGS.find(c => c.type === type);
    if (!config) {
      return NextResponse.json(
        { error: `Invalid credential type: ${type}` },
        { status: 400 }
      );
    }

    if (!values) {
      return NextResponse.json(
        { error: 'Values are required' },
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

    await setCredential(type, values, userId);

    return NextResponse.json({
      success: true,
      type,
      message: `${config.label} credentials updated successfully`,
    });
  } catch (error) {
    console.error('Error updating credential:', error);
    return NextResponse.json(
      { error: 'Failed to update credential' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/credentials/[type]
 * Remove a specific credential
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  try {
    const { type: typeParam } = await params;
    const type = typeParam as CredentialType;
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || 'default';

    await deleteCredential(type, userId);

    return NextResponse.json({
      success: true,
      type,
      message: 'Credential removed successfully',
    });
  } catch (error) {
    console.error('Error deleting credential:', error);
    return NextResponse.json(
      { error: 'Failed to delete credential' },
      { status: 500 }
    );
  }
}
