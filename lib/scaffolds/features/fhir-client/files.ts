/**
 * FHIR Client Template - Files
 */

import { TemplateFile } from '../types';

export const fhirClientFiles: TemplateFile[] = [
  // ============================================================
  // LIB - FHIR Client & Auth
  // ============================================================
  {
    path: 'lib/fhir/types.ts',
    type: 'lib',
    content: `/**
 * FHIR Client Types
 */

export interface FhirConfig {
  baseUrl: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scope: string[];
}

export interface FhirTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  patientId?: string;
  scope: string;
}

export interface FhirPatient {
  id: string;
  resourceType: 'Patient';
  identifier?: Array<{
    system?: string;
    value: string;
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
    text?: string;
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  address?: Array<{
    use?: string;
    line?: string[];
    city?: string;
    state?: string;
    postalCode?: string;
  }>;
  telecom?: Array<{
    system?: string;
    value?: string;
    use?: string;
  }>;
}

export interface FhirObservation {
  id: string;
  resourceType: 'Observation';
  status: string;
  category?: Array<{
    coding: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
  }>;
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  effectiveDateTime?: string;
  valueQuantity?: {
    value: number;
    unit?: string;
    system?: string;
    code?: string;
  };
  valueString?: string;
  subject: {
    reference: string;
  };
}

export interface FhirCondition {
  id: string;
  resourceType: 'Condition';
  clinicalStatus?: {
    coding: Array<{ code: string }>;
  };
  code: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  onsetDateTime?: string;
  recordedDate?: string;
}

export interface FhirMedicationRequest {
  id: string;
  resourceType: 'MedicationRequest';
  status: string;
  intent: string;
  medicationCodeableConcept?: {
    coding?: Array<{
      system?: string;
      code?: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  authoredOn?: string;
  dosageInstruction?: Array<{
    text?: string;
  }>;
}

export interface FhirBundle<T> {
  resourceType: 'Bundle';
  type: string;
  total?: number;
  entry?: Array<{
    resource: T;
  }>;
}

export interface SmartConfiguration {
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  capabilities: string[];
}
`,
  },
  {
    path: 'lib/fhir/config.ts',
    type: 'lib',
    content: `/**
 * FHIR Configuration
 */

import { FhirConfig } from './types';

export function getFhirConfig(): FhirConfig {
  const baseUrl = process.env.FHIR_BASE_URL;
  const clientId = process.env.FHIR_CLIENT_ID;
  const clientSecret = process.env.FHIR_CLIENT_SECRET;
  const redirectUri = process.env.FHIR_REDIRECT_URI || \`\${process.env.NEXT_PUBLIC_APP_URL}/api/fhir/callback\`;

  if (!baseUrl || !clientId) {
    throw new Error('FHIR_BASE_URL and FHIR_CLIENT_ID are required');
  }

  return {
    baseUrl,
    clientId,
    clientSecret,
    redirectUri,
    scope: [
      'launch/patient',
      'openid',
      'fhirUser',
      'patient/Patient.read',
      'patient/Observation.read',
      'patient/Condition.read',
      'patient/MedicationRequest.read',
      'patient/AllergyIntolerance.read',
      'patient/Immunization.read',
    ],
  };
}

// Epic Sandbox Configuration
export const EPIC_SANDBOX = {
  baseUrl: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4',
  wellKnown: 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4/.well-known/smart-configuration',
};

// Cerner Sandbox Configuration
export const CERNER_SANDBOX = {
  baseUrl: 'https://fhir-myrecord.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d',
  wellKnown: 'https://fhir-myrecord.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d/.well-known/smart-configuration',
};
`,
  },
  {
    path: 'lib/fhir/auth.ts',
    type: 'lib',
    content: `/**
 * FHIR OAuth Authentication
 */

import { cookies } from 'next/headers';
import { FhirTokens, SmartConfiguration } from './types';
import { getFhirConfig } from './config';

const TOKEN_COOKIE = 'fhir_tokens';
const STATE_COOKIE = 'fhir_state';

/**
 * Fetch SMART on FHIR configuration
 */
export async function getSmartConfiguration(baseUrl: string): Promise<SmartConfiguration> {
  const response = await fetch(\`\${baseUrl}/.well-known/smart-configuration\`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(\`Failed to fetch SMART configuration: \${response.status}\`);
  }

  return response.json();
}

/**
 * Generate OAuth authorization URL
 */
export async function getAuthorizationUrl(launch?: string): Promise<string> {
  const config = getFhirConfig();
  const smartConfig = await getSmartConfiguration(config.baseUrl);

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state,
    aud: config.baseUrl,
  });

  if (launch) {
    params.set('launch', launch);
  }

  return \`\${smartConfig.authorization_endpoint}?\${params.toString()}\`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string, state: string): Promise<FhirTokens> {
  const config = getFhirConfig();
  const smartConfig = await getSmartConfiguration(config.baseUrl);

  // Verify state
  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  if (state !== savedState) {
    throw new Error('Invalid OAuth state');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(smartConfig.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(\`Token exchange failed: \${error}\`);
  }

  const data = await response.json();

  const tokens: FhirTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    patientId: data.patient,
    scope: data.scope,
  };

  // Store tokens
  cookieStore.set(TOKEN_COOKIE, JSON.stringify(tokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7200, // 2 hours
  });

  // Clear state cookie
  cookieStore.delete(STATE_COOKIE);

  return tokens;
}

/**
 * Refresh access token
 */
export async function refreshTokens(): Promise<FhirTokens | null> {
  const config = getFhirConfig();
  const tokens = await getStoredTokens();

  if (!tokens?.refreshToken) {
    return null;
  }

  const smartConfig = await getSmartConfiguration(config.baseUrl);

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: tokens.refreshToken,
    client_id: config.clientId,
  });

  if (config.clientSecret) {
    body.set('client_secret', config.clientSecret);
  }

  const response = await fetch(smartConfig.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  const newTokens: FhirTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    patientId: tokens.patientId,
    scope: data.scope || tokens.scope,
  };

  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, JSON.stringify(newTokens), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7200,
  });

  return newTokens;
}

/**
 * Get stored tokens
 */
export async function getStoredTokens(): Promise<FhirTokens | null> {
  const cookieStore = await cookies();
  const tokenCookie = cookieStore.get(TOKEN_COOKIE);

  if (!tokenCookie) {
    return null;
  }

  try {
    return JSON.parse(tokenCookie.value);
  } catch {
    return null;
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(): Promise<string | null> {
  let tokens = await getStoredTokens();

  if (!tokens) {
    return null;
  }

  // Check if token is expired (with 5 min buffer)
  if (tokens.expiresAt < Date.now() + 300000) {
    tokens = await refreshTokens();
  }

  return tokens?.accessToken || null;
}

/**
 * Clear stored tokens (logout)
 */
export async function clearTokens(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
  cookieStore.delete(STATE_COOKIE);
}
`,
  },
  {
    path: 'lib/fhir/client.ts',
    type: 'lib',
    content: `/**
 * FHIR Client
 */

import { getValidAccessToken, getStoredTokens } from './auth';
import { getFhirConfig } from './config';
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirMedicationRequest,
  FhirBundle,
} from './types';

export class FhirClient {
  private baseUrl: string;
  private accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  /**
   * Create an authenticated client
   */
  static async create(): Promise<FhirClient | null> {
    const config = getFhirConfig();
    const accessToken = await getValidAccessToken();

    if (!accessToken) {
      return null;
    }

    return new FhirClient(config.baseUrl, accessToken);
  }

  /**
   * Make authenticated FHIR request
   */
  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = \`\${this.baseUrl}/\${path}\`;

    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: \`Bearer \${this.accessToken}\`,
        Accept: 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(\`FHIR request failed: \${response.status} \${error}\`);
    }

    return response.json();
  }

  /**
   * Get patient by ID
   */
  async getPatient(patientId?: string): Promise<FhirPatient> {
    const id = patientId || (await getStoredTokens())?.patientId;
    if (!id) {
      throw new Error('Patient ID not available');
    }
    return this.request<FhirPatient>(\`Patient/\${id}\`);
  }

  /**
   * Search patients
   */
  async searchPatients(params: {
    name?: string;
    identifier?: string;
    birthdate?: string;
  }): Promise<FhirBundle<FhirPatient>> {
    const searchParams = new URLSearchParams();
    if (params.name) searchParams.set('name', params.name);
    if (params.identifier) searchParams.set('identifier', params.identifier);
    if (params.birthdate) searchParams.set('birthdate', params.birthdate);

    return this.request<FhirBundle<FhirPatient>>(
      \`Patient?\${searchParams.toString()}\`
    );
  }

  /**
   * Get observations for patient
   */
  async getObservations(
    patientId?: string,
    options?: {
      category?: string;
      code?: string;
      date?: string;
    }
  ): Promise<FhirBundle<FhirObservation>> {
    const id = patientId || (await getStoredTokens())?.patientId;
    if (!id) {
      throw new Error('Patient ID not available');
    }

    const params = new URLSearchParams({ patient: id });
    if (options?.category) params.set('category', options.category);
    if (options?.code) params.set('code', options.code);
    if (options?.date) params.set('date', options.date);

    return this.request<FhirBundle<FhirObservation>>(
      \`Observation?\${params.toString()}\`
    );
  }

  /**
   * Get vitals for patient
   */
  async getVitals(patientId?: string): Promise<FhirBundle<FhirObservation>> {
    return this.getObservations(patientId, { category: 'vital-signs' });
  }

  /**
   * Get lab results for patient
   */
  async getLabs(patientId?: string): Promise<FhirBundle<FhirObservation>> {
    return this.getObservations(patientId, { category: 'laboratory' });
  }

  /**
   * Get conditions for patient
   */
  async getConditions(patientId?: string): Promise<FhirBundle<FhirCondition>> {
    const id = patientId || (await getStoredTokens())?.patientId;
    if (!id) {
      throw new Error('Patient ID not available');
    }

    return this.request<FhirBundle<FhirCondition>>(
      \`Condition?patient=\${id}&clinical-status=active\`
    );
  }

  /**
   * Get medications for patient
   */
  async getMedications(patientId?: string): Promise<FhirBundle<FhirMedicationRequest>> {
    const id = patientId || (await getStoredTokens())?.patientId;
    if (!id) {
      throw new Error('Patient ID not available');
    }

    return this.request<FhirBundle<FhirMedicationRequest>>(
      \`MedicationRequest?patient=\${id}&status=active\`
    );
  }

  /**
   * Get allergies for patient
   */
  async getAllergies(patientId?: string): Promise<FhirBundle<any>> {
    const id = patientId || (await getStoredTokens())?.patientId;
    if (!id) {
      throw new Error('Patient ID not available');
    }

    return this.request(\`AllergyIntolerance?patient=\${id}\`);
  }

  /**
   * Get immunizations for patient
   */
  async getImmunizations(patientId?: string): Promise<FhirBundle<any>> {
    const id = patientId || (await getStoredTokens())?.patientId;
    if (!id) {
      throw new Error('Patient ID not available');
    }

    return this.request(\`Immunization?patient=\${id}\`);
  }
}
`,
  },

  // ============================================================
  // API ROUTES
  // ============================================================
  {
    path: 'app/api/fhir/auth/route.ts',
    type: 'api',
    content: `/**
 * FHIR OAuth Authorization Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl } from '@/lib/fhir/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const launch = searchParams.get('launch') || undefined;

    const authUrl = await getAuthorizationUrl(launch);

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[FHIR Auth] Error:', error);
    return NextResponse.json(
      { error: 'Failed to start authorization' },
      { status: 500 }
    );
  }
}
`,
  },
  {
    path: 'app/api/fhir/callback/route.ts',
    type: 'api',
    content: `/**
 * FHIR OAuth Callback Endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/fhir/auth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      const errorDescription = searchParams.get('error_description') || 'Authorization denied';
      return NextResponse.redirect(
        \`\${process.env.NEXT_PUBLIC_APP_URL}/fhir/error?message=\${encodeURIComponent(errorDescription)}\`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        \`\${process.env.NEXT_PUBLIC_APP_URL}/fhir/error?message=Missing+authorization+code\`
      );
    }

    const tokens = await exchangeCodeForTokens(code, state);

    // Redirect to patient context page
    const redirectUrl = tokens.patientId
      ? \`\${process.env.NEXT_PUBLIC_APP_URL}/fhir/patient/\${tokens.patientId}\`
      : \`\${process.env.NEXT_PUBLIC_APP_URL}/fhir/dashboard\`;

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[FHIR Callback] Error:', error);
    return NextResponse.redirect(
      \`\${process.env.NEXT_PUBLIC_APP_URL}/fhir/error?message=\${encodeURIComponent('Authorization failed')}\`
    );
  }
}
`,
  },
  {
    path: 'app/api/fhir/[...path]/route.ts',
    type: 'api',
    content: `/**
 * FHIR Proxy Endpoint
 * Proxies requests to the FHIR server with authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidAccessToken } from '@/lib/fhir/auth';
import { getFhirConfig } from '@/lib/fhir/config';
import { auditLog } from '@/lib/audit/logger';

async function proxyRequest(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const accessToken = await getValidAccessToken();
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with FHIR server' },
        { status: 401 }
      );
    }

    const { path } = await context.params;
    const config = getFhirConfig();
    const fhirPath = path.join('/');
    const url = new URL(\`\${config.baseUrl}/\${fhirPath}\`);

    // Forward query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    // Forward request
    const fhirResponse = await fetch(url.toString(), {
      method: request.method,
      headers: {
        Authorization: \`Bearer \${accessToken}\`,
        Accept: 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
      body: request.method !== 'GET' ? await request.text() : undefined,
    });

    const data = await fhirResponse.json();

    // Audit log FHIR access
    const resourceType = fhirPath.split('/')[0];
    const resourceId = fhirPath.split('/')[1];
    await auditLog({
      action: request.method === 'GET' ? 'VIEW' : 'UPDATE',
      resourceType,
      resourceId,
      phiAccessed: true,
      details: { fhirPath },
    });

    return NextResponse.json(data, { status: fhirResponse.status });
  } catch (error) {
    console.error('[FHIR Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy FHIR request' },
      { status: 500 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
`,
  },

  // ============================================================
  // HOOKS
  // ============================================================
  {
    path: 'hooks/useFhir.ts',
    type: 'hook',
    content: `/**
 * FHIR React Hooks
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FhirPatient,
  FhirObservation,
  FhirCondition,
  FhirMedicationRequest,
  FhirBundle,
} from '@/lib/fhir/types';

interface UseFhirOptions {
  patientId?: string;
}

interface UseFhirResult<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

async function fetchFhir<T>(path: string): Promise<T> {
  const response = await fetch(\`/api/fhir/\${path}\`);
  if (!response.ok) {
    throw new Error(\`FHIR request failed: \${response.status}\`);
  }
  return response.json();
}

/**
 * Fetch FHIR patient data
 */
export function useFhirPatient(options?: UseFhirOptions): UseFhirResult<FhirPatient> {
  const [data, setData] = useState<FhirPatient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const path = options?.patientId
        ? \`Patient/\${options.patientId}\`
        : 'Patient';
      const patient = await fetchFhir<FhirPatient>(path);
      setData(patient);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch patient'));
    } finally {
      setLoading(false);
    }
  }, [options?.patientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Fetch FHIR observations (vitals, labs)
 */
export function useFhirObservations(
  options?: UseFhirOptions & { category?: 'vital-signs' | 'laboratory' }
): UseFhirResult<FhirObservation[]> {
  const [data, setData] = useState<FhirObservation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (options?.patientId) params.set('patient', options.patientId);
      if (options?.category) params.set('category', options.category);

      const bundle = await fetchFhir<FhirBundle<FhirObservation>>(
        \`Observation?\${params.toString()}\`
      );
      setData(bundle.entry?.map(e => e.resource) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch observations'));
    } finally {
      setLoading(false);
    }
  }, [options?.patientId, options?.category]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Fetch FHIR conditions (problem list)
 */
export function useFhirConditions(options?: UseFhirOptions): UseFhirResult<FhirCondition[]> {
  const [data, setData] = useState<FhirCondition[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ 'clinical-status': 'active' });
      if (options?.patientId) params.set('patient', options.patientId);

      const bundle = await fetchFhir<FhirBundle<FhirCondition>>(
        \`Condition?\${params.toString()}\`
      );
      setData(bundle.entry?.map(e => e.resource) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch conditions'));
    } finally {
      setLoading(false);
    }
  }, [options?.patientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Fetch FHIR medications
 */
export function useFhirMedications(options?: UseFhirOptions): UseFhirResult<FhirMedicationRequest[]> {
  const [data, setData] = useState<FhirMedicationRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ status: 'active' });
      if (options?.patientId) params.set('patient', options.patientId);

      const bundle = await fetchFhir<FhirBundle<FhirMedicationRequest>>(
        \`MedicationRequest?\${params.toString()}\`
      );
      setData(bundle.entry?.map(e => e.resource) || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch medications'));
    } finally {
      setLoading(false);
    }
  }, [options?.patientId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

/**
 * Check if connected to FHIR server
 */
export function useFhirConnection(): { connected: boolean; loading: boolean } {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkConnection() {
      try {
        const response = await fetch('/api/fhir/metadata');
        setConnected(response.ok);
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    }
    checkConnection();
  }, []);

  return { connected, loading };
}
`,
  },

  // ============================================================
  // COMPONENTS
  // ============================================================
  {
    path: 'components/fhir/PatientBanner.tsx',
    type: 'component',
    content: `/**
 * Patient Banner Component
 * Displays patient demographics in header format
 */

'use client';

import { useFhirPatient } from '@/hooks/useFhir';
import { FhirPatient } from '@/lib/fhir/types';

interface PatientBannerProps {
  patientId?: string;
  patient?: FhirPatient;
}

function getPatientName(patient: FhirPatient): string {
  const name = patient.name?.[0];
  if (!name) return 'Unknown';
  if (name.text) return name.text;
  const given = name.given?.join(' ') || '';
  const family = name.family || '';
  return \`\${given} \${family}\`.trim() || 'Unknown';
}

function getAge(birthDate?: string): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function getMRN(patient: FhirPatient): string | null {
  const mrn = patient.identifier?.find(id =>
    id.system?.includes('mrn') || id.system?.includes('medical-record')
  );
  return mrn?.value || patient.identifier?.[0]?.value || null;
}

export function PatientBanner({ patientId, patient: initialPatient }: PatientBannerProps) {
  const { data: fetchedPatient, loading, error } = useFhirPatient(
    initialPatient ? undefined : { patientId }
  );

  const patient = initialPatient || fetchedPatient;

  if (loading && !patient) {
    return (
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 animate-pulse">
        <div className="h-6 w-48 bg-blue-200 rounded" />
        <div className="h-4 w-32 bg-blue-100 rounded mt-2" />
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="bg-red-50 border-l-4 border-red-500 p-4">
        <p className="text-red-700">Failed to load patient information</p>
      </div>
    );
  }

  const name = getPatientName(patient);
  const age = getAge(patient.birthDate);
  const mrn = getMRN(patient);
  const phone = patient.telecom?.find(t => t.system === 'phone')?.value;

  return (
    <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{name}</h2>
          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
            {patient.birthDate && (
              <span>
                DOB: {new Date(patient.birthDate).toLocaleDateString()}
                {age !== null && \` (\${age} yrs)\`}
              </span>
            )}
            {patient.gender && (
              <span className="capitalize">{patient.gender}</span>
            )}
            {mrn && <span>MRN: {mrn}</span>}
          </div>
        </div>
        <div className="text-right text-sm text-gray-600">
          {phone && <p>📞 {phone}</p>}
          {patient.address?.[0] && (
            <p>
              📍 {patient.address[0].city}, {patient.address[0].state}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'components/fhir/PatientSearch.tsx',
    type: 'component',
    content: `/**
 * Patient Search Component
 */

'use client';

import { useState, useCallback } from 'react';
import { FhirPatient } from '@/lib/fhir/types';

interface PatientSearchProps {
  onSelect: (patient: FhirPatient) => void;
}

export function PatientSearch({ onSelect }: PatientSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FhirPatient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      // Check if query looks like an MRN (numeric) or name
      if (/^\\d+$/.test(query)) {
        params.set('identifier', query);
      } else {
        params.set('name', query);
      }

      const response = await fetch(\`/api/fhir/Patient?\${params.toString()}\`);
      if (!response.ok) throw new Error('Search failed');

      const bundle = await response.json();
      setResults(bundle.entry?.map((e: any) => e.resource) || []);
    } catch (err) {
      setError('Failed to search patients');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by name or MRN..."
          className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      {results.length > 0 && (
        <ul className="border rounded-lg divide-y">
          {results.map((patient) => {
            const name = patient.name?.[0];
            const displayName = name?.text ||
              \`\${name?.given?.join(' ')} \${name?.family}\`.trim() ||
              'Unknown';

            return (
              <li
                key={patient.id}
                onClick={() => onSelect(patient)}
                className="p-3 hover:bg-gray-50 cursor-pointer flex justify-between items-center"
              >
                <div>
                  <p className="font-medium">{displayName}</p>
                  <p className="text-sm text-gray-500">
                    {patient.birthDate && \`DOB: \${patient.birthDate}\`}
                    {patient.gender && \` • \${patient.gender}\`}
                  </p>
                </div>
                <span className="text-blue-600 text-sm">Select →</span>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && results.length === 0 && query && (
        <p className="text-gray-500 text-center py-4">No patients found</p>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'components/fhir/MedicationList.tsx',
    type: 'component',
    content: `/**
 * Medication List Component
 */

'use client';

import { useFhirMedications } from '@/hooks/useFhir';
import { FhirMedicationRequest } from '@/lib/fhir/types';

interface MedicationListProps {
  patientId?: string;
  medications?: FhirMedicationRequest[];
}

function getMedicationName(med: FhirMedicationRequest): string {
  const coding = med.medicationCodeableConcept?.coding?.[0];
  return (
    med.medicationCodeableConcept?.text ||
    coding?.display ||
    'Unknown Medication'
  );
}

export function MedicationList({ patientId, medications: initialMeds }: MedicationListProps) {
  const { data: fetchedMeds, loading, error } = useFhirMedications(
    initialMeds ? undefined : { patientId }
  );

  const medications = initialMeds || fetchedMeds;

  if (loading && !medications) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded">
        Failed to load medications
      </div>
    );
  }

  if (!medications?.length) {
    return (
      <div className="text-gray-500 p-4 text-center">
        No active medications
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg">Active Medications</h3>
      <ul className="divide-y border rounded-lg">
        {medications.map((med) => (
          <li key={med.id} className="p-3">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-medium">{getMedicationName(med)}</p>
                {med.dosageInstruction?.[0]?.text && (
                  <p className="text-sm text-gray-600">
                    {med.dosageInstruction[0].text}
                  </p>
                )}
              </div>
              <span className={\`text-xs px-2 py-1 rounded \${
                med.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }\`}>
                {med.status}
              </span>
            </div>
            {med.authoredOn && (
              <p className="text-xs text-gray-400 mt-1">
                Prescribed: {new Date(med.authoredOn).toLocaleDateString()}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
`,
  },
  {
    path: 'components/fhir/ConditionList.tsx',
    type: 'component',
    content: `/**
 * Condition List Component (Problem List)
 */

'use client';

import { useFhirConditions } from '@/hooks/useFhir';
import { FhirCondition } from '@/lib/fhir/types';

interface ConditionListProps {
  patientId?: string;
  conditions?: FhirCondition[];
}

function getConditionName(condition: FhirCondition): string {
  const coding = condition.code?.coding?.[0];
  return condition.code?.text || coding?.display || 'Unknown Condition';
}

function getConditionStatus(condition: FhirCondition): string {
  return condition.clinicalStatus?.coding?.[0]?.code || 'unknown';
}

export function ConditionList({ patientId, conditions: initialConditions }: ConditionListProps) {
  const { data: fetchedConditions, loading, error } = useFhirConditions(
    initialConditions ? undefined : { patientId }
  );

  const conditions = initialConditions || fetchedConditions;

  if (loading && !conditions) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded">
        Failed to load conditions
      </div>
    );
  }

  if (!conditions?.length) {
    return (
      <div className="text-gray-500 p-4 text-center">
        No active conditions
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg">Problem List</h3>
      <ul className="divide-y border rounded-lg">
        {conditions.map((condition) => {
          const status = getConditionStatus(condition);

          return (
            <li key={condition.id} className="p-3 flex justify-between items-center">
              <div>
                <p className="font-medium">{getConditionName(condition)}</p>
                {condition.onsetDateTime && (
                  <p className="text-xs text-gray-500">
                    Onset: {new Date(condition.onsetDateTime).toLocaleDateString()}
                  </p>
                )}
              </div>
              <span className={\`text-xs px-2 py-1 rounded \${
                status === 'active'
                  ? 'bg-yellow-100 text-yellow-800'
                  : status === 'resolved'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }\`}>
                {status}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
`,
  },
  {
    path: 'components/fhir/VitalsChart.tsx',
    type: 'component',
    content: `/**
 * Vitals Chart Component
 */

'use client';

import { useFhirObservations } from '@/hooks/useFhir';
import { FhirObservation } from '@/lib/fhir/types';

interface VitalsChartProps {
  patientId?: string;
  observations?: FhirObservation[];
}

interface VitalReading {
  code: string;
  display: string;
  value: number | string;
  unit: string;
  date: string;
}

function parseVitalReading(obs: FhirObservation): VitalReading | null {
  const coding = obs.code?.coding?.[0];
  if (!coding) return null;

  const value = obs.valueQuantity?.value ?? obs.valueString;
  if (value === undefined) return null;

  return {
    code: coding.code || '',
    display: coding.display || obs.code?.text || 'Unknown',
    value,
    unit: obs.valueQuantity?.unit || '',
    date: obs.effectiveDateTime || '',
  };
}

const VITAL_CODES: Record<string, string> = {
  '8310-5': 'Body Temperature',
  '8867-4': 'Heart Rate',
  '9279-1': 'Respiratory Rate',
  '85354-9': 'Blood Pressure',
  '8480-6': 'Systolic BP',
  '8462-4': 'Diastolic BP',
  '29463-7': 'Body Weight',
  '8302-2': 'Body Height',
  '39156-5': 'BMI',
  '59408-5': 'SpO2',
};

export function VitalsChart({ patientId, observations: initialObs }: VitalsChartProps) {
  const { data: fetchedObs, loading, error } = useFhirObservations(
    initialObs ? undefined : { patientId, category: 'vital-signs' }
  );

  const observations = initialObs || fetchedObs;

  if (loading && !observations) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 p-4 bg-red-50 rounded">
        Failed to load vitals
      </div>
    );
  }

  if (!observations?.length) {
    return (
      <div className="text-gray-500 p-4 text-center">
        No vital signs recorded
      </div>
    );
  }

  // Parse and group vitals by code
  const vitalsByCode = new Map<string, VitalReading[]>();
  for (const obs of observations) {
    const reading = parseVitalReading(obs);
    if (reading) {
      const existing = vitalsByCode.get(reading.code) || [];
      existing.push(reading);
      vitalsByCode.set(reading.code, existing);
    }
  }

  // Get most recent reading for each vital
  const latestVitals: VitalReading[] = [];
  vitalsByCode.forEach((readings) => {
    const sorted = readings.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    if (sorted[0]) latestVitals.push(sorted[0]);
  });

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg">Vital Signs</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {latestVitals.map((vital) => (
          <div
            key={vital.code}
            className="bg-white border rounded-lg p-4 shadow-sm"
          >
            <p className="text-sm text-gray-500">
              {VITAL_CODES[vital.code] || vital.display}
            </p>
            <p className="text-2xl font-semibold mt-1">
              {typeof vital.value === 'number'
                ? vital.value.toFixed(1)
                : vital.value}
              <span className="text-sm font-normal text-gray-500 ml-1">
                {vital.unit}
              </span>
            </p>
            {vital.date && (
              <p className="text-xs text-gray-400 mt-1">
                {new Date(vital.date).toLocaleDateString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
`,
  },

  // ============================================================
  // PAGES
  // ============================================================
  {
    path: 'app/(fhir)/fhir/error/page.tsx',
    type: 'page',
    content: `/**
 * FHIR Error Page
 */

'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function FhirErrorPage() {
  const searchParams = useSearchParams();
  const message = searchParams.get('message') || 'An error occurred';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          FHIR Connection Error
        </h1>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="space-y-3">
          <Link
            href="/api/fhir/auth"
            className="block w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </Link>
          <Link
            href="/"
            className="block w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'app/(fhir)/fhir/dashboard/page.tsx',
    type: 'page',
    content: `/**
 * FHIR Dashboard Page
 */

'use client';

import { PatientSearch } from '@/components/fhir/PatientSearch';
import { useFhirConnection } from '@/hooks/useFhir';
import { FhirPatient } from '@/lib/fhir/types';
import { useRouter } from 'next/navigation';

export default function FhirDashboardPage() {
  const router = useRouter();
  const { connected, loading } = useFhirConnection();

  const handlePatientSelect = (patient: FhirPatient) => {
    router.push(\`/fhir/patient/\${patient.id}\`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Connect to EHR</h1>
          <p className="text-gray-600 mb-6">
            Connect to your EHR system to access patient records
          </p>
          <a
            href="/api/fhir/auth"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Connect to EPIC
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Patient Records</h1>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Find a Patient</h2>
        <PatientSearch onSelect={handlePatientSelect} />
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'app/(fhir)/fhir/patient/[patientId]/page.tsx',
    type: 'page',
    content: `/**
 * Patient Detail Page
 */

'use client';

import { use } from 'react';
import { PatientBanner } from '@/components/fhir/PatientBanner';
import { VitalsChart } from '@/components/fhir/VitalsChart';
import { MedicationList } from '@/components/fhir/MedicationList';
import { ConditionList } from '@/components/fhir/ConditionList';
import Link from 'next/link';

interface PatientPageProps {
  params: Promise<{ patientId: string }>;
}

export default function PatientPage({ params }: PatientPageProps) {
  const { patientId } = use(params);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Patient Banner */}
      <PatientBanner patientId={patientId} />

      {/* Navigation */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <Link
          href="/fhir/dashboard"
          className="text-blue-600 hover:underline text-sm"
        >
          ← Back to Search
        </Link>
      </div>

      {/* Content Grid */}
      <div className="max-w-6xl mx-auto px-4 pb-8">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Vitals */}
          <div className="bg-white rounded-lg shadow p-6">
            <VitalsChart patientId={patientId} />
          </div>

          {/* Conditions */}
          <div className="bg-white rounded-lg shadow p-6">
            <ConditionList patientId={patientId} />
          </div>

          {/* Medications - Full width */}
          <div className="md:col-span-2 bg-white rounded-lg shadow p-6">
            <MedicationList patientId={patientId} />
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  },
];
