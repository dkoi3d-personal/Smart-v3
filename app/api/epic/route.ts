/**
 * Epic FHIR API Routes
 * Supports Backend OAuth 2.0 with JWT for automatic token management
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCredential } from '@/lib/credentials-store';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// CORS headers for generated apps
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Epic sandbox endpoints
const EPIC_SANDBOX = {
  fhirBaseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  tokenUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token',
  authorizeUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/authorize',
};

// In-memory token store for OAuth flows (user and backend tokens)
interface TokenStoreEntry {
  accessToken: string;
  expiresAt: string;
  patientId?: string;
}

const tokenStore = new Map<string, TokenStoreEntry>();

// Test patients (validated for Epic sandbox)
const TEST_PATIENTS = [
  { name: 'Camila Lopez', fhirId: 'erXuFYUfucBZaryVksYEcMg3', dob: '1987-09-12', gender: 'female', notes: 'Full clinical data - conditions, meds, labs' },
  { name: 'Theodore Mychart', fhirId: 'e63wRTbPfr1p8UW81d8Seiw3', dob: '1948-07-07', gender: 'male', notes: 'MyChart/portal testing' },
  { name: 'Derrick Lin', fhirId: 'eq081-VQEgP8drUUqCWzHfw3', dob: '1973-06-03', gender: 'male', notes: 'Basic demographics' },
];

// Token storage
const TOKEN_FILE = path.join(process.cwd(), '.epic-token.json');
const PRIVATE_KEY_FILE = path.join(process.cwd(), '.epic-private-key.pem');
const EPIC_CONFIG_FILE = path.join(process.cwd(), 'data', 'epic-config.json');

// Load Epic config from file as fallback
function loadEpicConfig(): { clientId?: string; environment?: string } | null {
  try {
    if (fs.existsSync(EPIC_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(EPIC_CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Epic] Failed to load epic-config.json:', e);
  }
  return null;
}

interface TokenData {
  accessToken: string;
  expiresAt: string;
  tokenType?: string;
}

declare global {
  var epicTokenCache: TokenData | null | undefined;
}

// ============ Token Storage Functions ============

function loadToken(): TokenData | null {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      if (new Date(data.expiresAt) > new Date()) {
        return data;
      }
    }
  } catch (e) {
    console.error('[Epic] Failed to load token:', e);
  }
  return null;
}

function saveToken(token: TokenData): void {
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(token, null, 2));
    globalThis.epicTokenCache = token;
  } catch (e) {
    console.error('[Epic] Failed to save token:', e);
  }
}

function clearToken(): void {
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    globalThis.epicTokenCache = null;
  } catch (e) {
    console.error('[Epic] Failed to clear token:', e);
  }
}

// ============ JWT Backend OAuth Functions ============

function loadPrivateKey(): string | null {
  try {
    if (fs.existsSync(PRIVATE_KEY_FILE)) {
      return fs.readFileSync(PRIVATE_KEY_FILE, 'utf-8');
    }
  } catch (e) {
    console.error('[Epic] Failed to load private key:', e);
  }
  return null;
}

function savePrivateKey(key: string): void {
  try {
    fs.writeFileSync(PRIVATE_KEY_FILE, key, { mode: 0o600 });
  } catch (e) {
    console.error('[Epic] Failed to save private key:', e);
  }
}

function hasPrivateKey(): boolean {
  return fs.existsSync(PRIVATE_KEY_FILE);
}

/**
 * Generate a signed JWT for Backend OAuth
 */
function generateJWT(clientId: string, privateKey: string): string {
  const now = Math.floor(Date.now() / 1000);
  const jti = crypto.randomUUID();

  // JWT Header (no kid - Epic doesn't require it for single-key apps)
  const header = {
    alg: 'RS384',
    typ: 'JWT',
  };

  // JWT Payload
  const payload = {
    iss: clientId,
    sub: clientId,
    aud: EPIC_SANDBOX.tokenUrl,
    jti: jti,
    exp: now + 300, // 5 minutes
    iat: now,
    nbf: now,
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // Sign with RS384
  const sign = crypto.createSign('RSA-SHA384');
  sign.update(signingInput);
  const signature = sign.sign(privateKey);
  const encodedSignature = base64UrlEncode(signature);

  return `${signingInput}.${encodedSignature}`;
}

/**
 * Exchange JWT for access token using Backend OAuth
 */
async function getBackendToken(clientId: string, privateKey: string): Promise<TokenData> {
  const jwt = generateJWT(clientId, privateKey);

  console.log('[Epic] Requesting backend token...');

  // Don't request specific scopes - let Epic grant what's configured in the app
  // Epic will return whatever scopes the app is registered for

  const response = await fetch(EPIC_SANDBOX.tokenUrl, {
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

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Epic] Token request failed:', response.status, errorText);
    throw new Error(`Token request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log('[Epic] Backend token received, expires in', data.expires_in, 'seconds');

  const tokenData: TokenData = {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + (data.expires_in * 1000)).toISOString(),
    tokenType: data.token_type,
  };

  saveToken(tokenData);
  return tokenData;
}

/**
 * Get a valid token, refreshing via JWT if needed
 */
async function getValidToken(): Promise<TokenData | null> {
  // Check cached token
  if (globalThis.epicTokenCache && new Date(globalThis.epicTokenCache.expiresAt) > new Date()) {
    return globalThis.epicTokenCache;
  }

  // Check file token
  const fileToken = loadToken();
  if (fileToken) {
    globalThis.epicTokenCache = fileToken;
    return fileToken;
  }

  // Try to get new token via Backend OAuth
  // First try credentials store, then fall back to epic-config.json
  let epicCreds = await getCredential('epic');
  if (!epicCreds?.clientId) {
    const epicConfig = loadEpicConfig();
    if (epicConfig?.clientId) {
      epicCreds = { clientId: epicConfig.clientId, environment: epicConfig.environment || 'sandbox' };
    }
  }

  const privateKey = loadPrivateKey();

  if (epicCreds?.clientId && privateKey) {
    try {
      console.log('[Epic] Attempting Backend OAuth with clientId:', epicCreds.clientId.substring(0, 8) + '...');
      return await getBackendToken(epicCreds.clientId, privateKey);
    } catch (e) {
      console.error('[Epic] Failed to refresh token:', e);
    }
  }

  return null;
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// ============ API Routes ============

/**
 * GET /api/epic - Check connection status
 */
export async function GET() {
  try {
    // Check credentials store first, then epic-config.json
    let epicCreds = await getCredential('epic');
    if (!epicCreds?.clientId) {
      const epicConfig = loadEpicConfig();
      if (epicConfig?.clientId) {
        epicCreds = { clientId: epicConfig.clientId, environment: epicConfig.environment || 'sandbox' };
      }
    }

    const hasEpicCreds = !!epicCreds?.clientId;
    const hasKey = hasPrivateKey();
    const token = await getValidToken();
    const isConnected = !!token;

    return NextResponse.json({
      configured: hasEpicCreds,
      hasPrivateKey: hasKey,
      connected: isConnected,
      environment: epicCreds?.environment || 'sandbox',
      clientId: hasEpicCreds ? epicCreds?.clientId?.substring(0, 8) + '...' : null,
      endpoints: { fhirBaseUrl: EPIC_SANDBOX.fhirBaseUrl, tokenUrl: EPIC_SANDBOX.tokenUrl },
      tokenInfo: isConnected ? {
        expiresAt: token.expiresAt,
        tokenType: token.tokenType,
      } : null,
      sandbox: { testPatients: TEST_PATIENTS },
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Epic API] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

/**
 * POST /api/epic - Setup Backend OAuth (save private key)
 */
export async function POST(request: NextRequest) {
  try {
    const { privateKey, clientId } = await request.json();

    if (!privateKey) {
      return NextResponse.json({ error: 'Private key is required' }, { status: 400, headers: corsHeaders });
    }

    // Validate private key format
    if (!privateKey.includes('-----BEGIN') || !privateKey.includes('PRIVATE KEY-----')) {
      return NextResponse.json({
        error: 'Invalid private key format. Must be PEM format starting with -----BEGIN PRIVATE KEY----- or -----BEGIN RSA PRIVATE KEY-----'
      }, { status: 400, headers: corsHeaders });
    }

    // Save private key
    savePrivateKey(privateKey);

    // If clientId provided, try to get a token immediately
    if (clientId) {
      try {
        const token = await getBackendToken(clientId, privateKey);
        return NextResponse.json({
          success: true,
          message: 'Backend OAuth configured successfully',
          connected: true,
          tokenInfo: { expiresAt: token.expiresAt }
        }, { headers: corsHeaders });
      } catch (e: any) {
        return NextResponse.json({
          success: true,
          message: 'Private key saved, but token request failed: ' + e.message,
          connected: false
        }, { headers: corsHeaders });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Private key saved. Configure Client ID in Epic settings to complete setup.'
    }, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Epic OAuth] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

/**
 * PUT /api/epic - Set token manually (fallback for Try It tokens)
 */
export async function PUT(request: NextRequest) {
  try {
    const { token, expiresIn } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token is required' }, { status: 400, headers: corsHeaders });
    }

    // Default to 5 minutes for Epic sandbox tokens (they expire quickly!)
    const tokenData: TokenData = {
      accessToken: token,
      expiresAt: new Date(Date.now() + ((expiresIn || 300) * 1000)).toISOString(),
      tokenType: 'Bearer',
    };
    saveToken(tokenData);

    console.log('[Epic API] Manual token saved, expires at:', tokenData.expiresAt);

    return NextResponse.json({
      success: true,
      message: 'Token configured',
      expiresAt: tokenData.expiresAt,
      warning: 'Epic sandbox tokens expire in ~5 minutes. Test quickly!'
    }, { headers: corsHeaders });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}

/**
 * DELETE /api/epic - Disconnect and clear tokens
 */
export async function DELETE() {
  clearToken();
  return NextResponse.json({ success: true }, { headers: corsHeaders });
}

// Export for FHIR proxy and other Epic routes
export { EPIC_SANDBOX, getValidToken, tokenStore };
