/**
 * Epic OAuth Callback
 * Handles both standalone launch and EHR launch from Epic's testing interface
 */

import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { getCredential } from '@/lib/credentials-store';
import { tokenStore, EPIC_SANDBOX } from '../route';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // EHR launch parameters
  const launch = searchParams.get('launch');
  const iss = searchParams.get('iss');

  const baseUrl = 'http://localhost:3000';

  console.log('[Epic Callback] Received params:', {
    code: code ? 'present' : 'missing',
    state,
    launch: launch ? 'present' : 'missing',
    iss
  });

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/settings?epicError=${encodeURIComponent(errorDescription || error)}`
    );
  }

  // If this is an EHR launch (from Epic's testing interface), handle it
  if (launch && iss) {
    console.log('[Epic Callback] EHR Launch detected, redirecting to authorize...');
    return handleEhrLaunch(request, launch, iss, baseUrl);
  }

  if (!code) {
    return NextResponse.redirect(
      `${baseUrl}/settings?epicError=${encodeURIComponent('Missing authorization code')}`
    );
  }

  try {
    const epicCreds = await getCredential('epic');
    if (!epicCreds?.clientId) {
      throw new Error('Epic credentials not found');
    }

    const redirectUri = `${baseUrl}/api/epic/callback`;

    // Check if we have a stored state (standalone launch with PKCE)
    let codeVerifier: string | undefined;
    if (state) {
      const storedState = tokenStore.get(`state:${state}`);
      if (storedState) {
        codeVerifier = storedState.accessToken;
        tokenStore.delete(`state:${state}`);
      }
    }

    // Build token request params
    const tokenParams: Record<string, string> = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: epicCreds.clientId,
    };

    // Add code_verifier only if we have it (standalone launch)
    if (codeVerifier) {
      tokenParams.code_verifier = codeVerifier;
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(EPIC_SANDBOX.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(tokenParams),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Epic Callback] Token exchange failed:', errorText);
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokens = await tokenResponse.json();
    console.log('[Epic Callback] Token response:', {
      hasAccessToken: !!tokens.access_token,
      expiresIn: tokens.expires_in,
      patient: tokens.patient,
      scope: tokens.scope
    });

    // Store tokens
    tokenStore.set('default', {
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      patientId: tokens.patient,
    });

    console.log('[Epic Callback] Successfully connected!');

    return NextResponse.redirect(`${baseUrl}/settings?epicConnected=true`);
  } catch (err: any) {
    console.error('[Epic Callback] Error:', err);
    return NextResponse.redirect(
      `${baseUrl}/settings?epicError=${encodeURIComponent(err.message)}`
    );
  }
}

/**
 * Handle EHR launch from Epic's testing interface
 */
async function handleEhrLaunch(
  request: NextRequest,
  launch: string,
  iss: string,
  baseUrl: string
): Promise<NextResponse> {
  try {
    const epicCreds = await getCredential('epic');
    if (!epicCreds?.clientId) {
      throw new Error('Epic credentials not found');
    }

    const redirectUri = `${baseUrl}/api/epic/callback`;
    const state = crypto.randomUUID();

    // Store state for verification (no PKCE for EHR launch)
    tokenStore.set(`state:${state}`, {
      accessToken: '', // No code verifier for EHR launch
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    });

    const scopes = [
      'launch',
      'openid',
      'fhirUser',
      'patient/Patient.read',
      'patient/Observation.read',
      'patient/MedicationRequest.read',
      'patient/Condition.read',
      'patient/AllergyIntolerance.read',
    ].join(' ');

    const authUrl = new URL(EPIC_SANDBOX.authorizeUrl);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', epicCreds.clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', scopes);
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('launch', launch);
    authUrl.searchParams.set('aud', iss);

    console.log('[Epic Callback] Redirecting to Epic authorize for EHR launch');

    return NextResponse.redirect(authUrl.toString());
  } catch (err: any) {
    console.error('[Epic Callback] EHR launch error:', err);
    return NextResponse.redirect(
      `${baseUrl}/settings?epicError=${encodeURIComponent(err.message)}`
    );
  }
}
