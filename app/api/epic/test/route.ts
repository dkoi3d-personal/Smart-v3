/**
 * Epic API Test Endpoint
 * Directly hit Epic FHIR APIs with a token from Try It or Backend OAuth
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const EPIC_FHIR_BASE = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';
const EPIC_TOKEN_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2/token';
const TOKEN_FILE = path.join(process.cwd(), '.epic-token.json');
const PRIVATE_KEY_FILE = path.join(process.cwd(), '.epic-private-key.pem');
const EPIC_CONFIG_FILE = path.join(process.cwd(), 'data', 'epic-config.json');

// Load token from file
function loadToken(): { token: string | null; expired: boolean; expiresAt?: string } {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      const data = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
      const isExpired = new Date(data.expiresAt) <= new Date();
      return {
        token: data.accessToken,
        expired: isExpired,
        expiresAt: data.expiresAt
      };
    }
  } catch (e) {
    console.error('[Epic Test] Failed to load token:', e);
  }
  return { token: null, expired: false };
}

// Load Epic config
function loadEpicConfig(): { clientId?: string } | null {
  try {
    if (fs.existsSync(EPIC_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(EPIC_CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('[Epic Test] Failed to load config:', e);
  }
  return null;
}

// Load private key
function loadPrivateKey(): string | null {
  try {
    if (fs.existsSync(PRIVATE_KEY_FILE)) {
      return fs.readFileSync(PRIVATE_KEY_FILE, 'utf-8');
    }
  } catch (e) {
    console.error('[Epic Test] Failed to load private key:', e);
  }
  return null;
}

// Save token
function saveToken(accessToken: string, expiresIn: number) {
  const data = {
    accessToken,
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    tokenType: 'Bearer'
  };
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
}

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Try to get token via Backend OAuth
async function tryBackendOAuth(): Promise<{ token: string | null; error?: string }> {
  const config = loadEpicConfig();
  const privateKey = loadPrivateKey();

  if (!config?.clientId) {
    return { token: null, error: 'No client ID configured' };
  }
  if (!privateKey) {
    return { token: null, error: 'No private key found' };
  }

  console.log('[Epic Test] Attempting Backend OAuth with client:', config.clientId.substring(0, 8) + '...');

  try {
    // Build JWT
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'RS384', typ: 'JWT' };
    const payload = {
      iss: config.clientId,
      sub: config.clientId,
      aud: EPIC_TOKEN_URL,
      jti: crypto.randomUUID(),
      exp: now + 300,
      iat: now,
      nbf: now,
    };

    const encodedHeader = base64UrlEncode(Buffer.from(JSON.stringify(header)));
    const encodedPayload = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const sign = crypto.createSign('RSA-SHA384');
    sign.update(signingInput);
    const signature = sign.sign(privateKey);
    const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

    // Exchange JWT for token
    const response = await fetch(EPIC_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_assertion_type: 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
        client_assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Epic Test] Backend OAuth failed:', response.status, errText);
      return { token: null, error: `Backend OAuth failed: ${response.status} - ${errText}` };
    }

    const data = await response.json();
    console.log('[Epic Test] Backend OAuth success, expires in:', data.expires_in);
    saveToken(data.access_token, data.expires_in);
    return { token: data.access_token };
  } catch (e: any) {
    console.error('[Epic Test] Backend OAuth error:', e);
    return { token: null, error: e.message };
  }
}

/**
 * GET /api/epic/test - Debug Backend OAuth
 */
export async function GET() {
  const config = loadEpicConfig();
  const privateKey = loadPrivateKey();
  const tokenFile = loadToken();

  const debug = {
    hasConfig: !!config,
    clientId: config?.clientId ? config.clientId.substring(0, 8) + '...' : null,
    hasPrivateKey: !!privateKey,
    privateKeyLength: privateKey?.length || 0,
    hasTokenFile: !!tokenFile.token,
    tokenExpired: tokenFile.expired,
  };

  // Try Backend OAuth
  const oauth = await tryBackendOAuth();

  return NextResponse.json({
    debug,
    backendOAuth: {
      success: !!oauth.token,
      error: oauth.error,
      tokenPreview: oauth.token ? oauth.token.substring(0, 20) + '...' : null,
    }
  });
}

/**
 * POST /api/epic/test
 * Test Epic APIs directly with a Bearer token or Backend OAuth
 */
export async function POST(request: NextRequest) {
  try {
    const { token: providedToken, endpoint, patientId } = await request.json();

    // Use provided token or load from file
    let token = providedToken;
    let tokenWarning: string | undefined;
    let backendOAuthError: string | undefined;

    if (!token) {
      const stored = loadToken();
      token = stored.token;
      if (stored.expired) {
        tokenWarning = `Token expired at ${stored.expiresAt}. Trying Backend OAuth...`;
        token = null; // Force Backend OAuth
      }
    }

    // Try Backend OAuth if no valid token
    if (!token) {
      console.log('[Epic Test] No token found, trying Backend OAuth...');
      const oauth = await tryBackendOAuth();
      if (oauth.token) {
        token = oauth.token;
        tokenWarning = undefined; // Clear warning since we got a fresh token
      } else {
        backendOAuthError = oauth.error;
      }
    }

    if (!token) {
      return NextResponse.json(
        {
          error: 'No token available',
          details: backendOAuthError || 'Configure Backend OAuth or paste a token manually',
          hint: 'Go to Epic settings and either configure Backend OAuth with your private key, or paste a sandbox token'
        },
        { status: 400 }
      );
    }

    // Build the URL
    let url = EPIC_FHIR_BASE;
    if (endpoint) {
      // If endpoint already has full path, use as-is, otherwise append to base
      if (endpoint.startsWith('http')) {
        url = endpoint;
      } else {
        url = `${EPIC_FHIR_BASE}/${endpoint}`;
      }
    } else if (patientId) {
      url = `${EPIC_FHIR_BASE}/Patient/${patientId}`;
    } else {
      // Default: fetch a known test patient (Camila Lopez)
      url = `${EPIC_FHIR_BASE}/Patient/erXuFYUfucBZaryVksYEcMg3`;
    }

    console.log(`[Epic Test] Calling: ${url}`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Epic Test] Error response:', response.status, errorText);

      let errorMessage = `Epic API error ${response.status}`;
      let hint = '';

      // Add helpful context for common errors
      if (response.status === 401) {
        hint = 'Token expired or invalid. Epic sandbox tokens only last ~5 minutes.';
      } else if (response.status === 400) {
        hint = 'Check token format or endpoint';
      } else if (response.status === 403) {
        hint = 'Token may not have access to this resource';
      }

      // Try to parse error details
      let details = errorText;
      try {
        const parsed = JSON.parse(errorText);
        if (parsed.error_description) {
          details = parsed.error_description;
        } else if (parsed.issue?.[0]?.diagnostics) {
          details = parsed.issue[0].diagnostics;
        }
      } catch {}

      return NextResponse.json(
        {
          error: errorMessage,
          details,
          hint,
          warning: tokenWarning,
          endpoint: url
        },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Add warning to successful response if token was expired
    if (tokenWarning) {
      return NextResponse.json({ ...data, _tokenWarning: tokenWarning });
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error('[Epic Test] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
