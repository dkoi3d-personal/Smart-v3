/**
 * Epic Backend Services Authentication
 * Uses JWT client assertion - no user login needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { promises as fs, existsSync, writeFileSync } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { getCredential } from '@/lib/credentials-store';
import { tokenStore, EPIC_SANDBOX, getValidToken } from '../route';

// Token file path (same as main route uses)
const TOKEN_FILE = path.join(process.cwd(), '.epic-token.json');

// Private key location - supports both root and data/keys locations
const PRIVATE_KEY_PATHS = [
  path.join(process.cwd(), '.epic-private-key.pem'),  // Root location (preferred)
  path.join(process.cwd(), 'data', 'keys', 'epic-private.pem'),  // Legacy location
];

/**
 * POST /api/epic/backend-auth
 * Get access token using backend services (JWT) authentication
 */
export async function POST(request: NextRequest) {
  try {
    const epicCreds = await getCredential('epic');
    if (!epicCreds?.clientId) {
      return NextResponse.json(
        { error: 'Epic credentials not configured' },
        { status: 400 }
      );
    }

    // Read private key - try multiple locations
    let privateKeyPem: string | null = null;
    let keyPath: string | null = null;

    for (const tryPath of PRIVATE_KEY_PATHS) {
      try {
        privateKeyPem = await fs.readFile(tryPath, 'utf-8');
        keyPath = tryPath;
        console.log(`[Epic Backend Auth] Found private key at: ${tryPath}`);
        break;
      } catch (err) {
        // Try next path
      }
    }

    if (!privateKeyPem) {
      console.error('[Epic Backend Auth] Private key not found in any location:', PRIVATE_KEY_PATHS);
      return NextResponse.json(
        { error: 'Private key not found. Upload .epic-private-key.pem to project root.' },
        { status: 400 }
      );
    }

    // Use Node.js crypto to handle both PKCS1 and PKCS8 formats
    // crypto.createPrivateKey automatically detects the format
    let privateKey: crypto.KeyObject;
    try {
      privateKey = crypto.createPrivateKey(privateKeyPem);
      console.log('[Epic Backend Auth] Private key loaded successfully');
    } catch (err: any) {
      console.error('[Epic Backend Auth] Failed to parse private key:', err.message);
      return NextResponse.json(
        { error: 'Invalid private key format', details: err.message },
        { status: 400 }
      );
    }

    // Create JWT client assertion
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();

    console.log('[Epic Backend Auth] Creating JWT with:', {
      iss: epicCreds.clientId,
      sub: epicCreds.clientId,
      aud: EPIC_SANDBOX.tokenUrl,
      iat: now,
      nbf: now,
      exp: now + 300,
      jti,
    });

    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS384', typ: 'JWT' })
      .setIssuer(epicCreds.clientId)
      .setSubject(epicCreds.clientId)
      .setAudience(EPIC_SANDBOX.tokenUrl)
      .setIssuedAt(now)
      .setNotBefore(now)  // nbf claim - required by some OAuth servers
      .setExpirationTime(now + 300) // 5 minutes
      .setJti(jti)
      .sign(privateKey);

    // Exchange JWT for access token
    const tokenResponse = await fetch(EPIC_SANDBOX.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Epic Backend Auth] Token request failed:', errorText);
      return NextResponse.json(
        { error: 'Token request failed', details: errorText },
        { status: tokenResponse.status }
      );
    }

    const tokens = await tokenResponse.json();

    const tokenData = {
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      tokenType: tokens.token_type || 'Bearer',
    };

    // Store token in BOTH memory and file (for consistency with getValidToken)
    tokenStore.set('backend', tokenData);

    // Also save to file so getValidToken() can find it
    try {
      writeFileSync(TOKEN_FILE, JSON.stringify(tokenData, null, 2));
      console.log('[Epic Backend Auth] Token saved to file');
    } catch (e) {
      console.warn('[Epic Backend Auth] Could not save token to file:', e);
    }

    console.log('[Epic Backend Auth] Successfully authenticated!');

    return NextResponse.json({
      success: true,
      expiresIn: tokens.expires_in,
      scope: tokens.scope,
    });
  } catch (error: any) {
    console.error('[Epic Backend Auth] Error:', error);
    return NextResponse.json(
      { error: 'Backend authentication failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * GET /api/epic/backend-auth
 * Check backend auth status
 */
export async function GET() {
  // Check both memory and file for token (getValidToken handles both)
  const token = await getValidToken();

  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const isValid = new Date(token.expiresAt) > new Date();

  return NextResponse.json({
    authenticated: isValid,
    expiresAt: token.expiresAt,
  });
}
