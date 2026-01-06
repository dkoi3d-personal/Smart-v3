/**
 * Generic Epic FHIR API Proxy
 * Auto-refreshes tokens using Backend OAuth JWT when needed
 */

import { NextRequest, NextResponse } from 'next/server';
import { getValidToken, EPIC_SANDBOX } from '../../route';

// CORS headers for generated apps
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;

    // Get valid token (auto-refreshes if Backend OAuth is configured)
    const tokenData = await getValidToken();

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Not authenticated. Configure Epic Backend OAuth or paste a Bearer token in Settings.' },
        { status: 401, headers: corsHeaders }
      );
    }

    // Build FHIR URL
    const fhirPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = searchParams
      ? `${EPIC_SANDBOX.fhirBaseUrl}/${fhirPath}?${searchParams}`
      : `${EPIC_SANDBOX.fhirBaseUrl}/${fhirPath}`;

    console.log(`[Epic FHIR] GET ${fhirPath}${searchParams ? '?' + searchParams : ''}`);
    console.log(`[Epic FHIR] Full URL: ${url}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Accept': 'application/fhir+json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Epic FHIR] Error:', response.status, errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Token expired or invalid. Please refresh the page to get a new token.' },
          { status: 401, headers: corsHeaders }
        );
      }

      if (response.status === 403) {
        // Parse OperationOutcome for better error messages
        let details = errorText;
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.issue?.[0]?.diagnostics) {
            details = errorJson.issue[0].diagnostics;
          } else if (errorJson.issue?.[0]?.details?.text) {
            details = errorJson.issue[0].details.text;
          }
        } catch { /* keep original errorText */ }

        console.error('[Epic FHIR] 403 Forbidden - This usually means:');
        console.error('  1. The app scopes in Epic App Orchard do not include this resource');
        console.error('  2. Backend Services apps may need different configuration for patient data');
        console.error('  Details:', details);

        return NextResponse.json(
          {
            error: 'Access forbidden. Your Epic app may not have the required FHIR scopes configured.',
            details,
            hint: 'Check your app configuration in Epic App Orchard. Backend Services apps need system/*.read scopes.'
          },
          { status: 403, headers: corsHeaders }
        );
      }

      return NextResponse.json(
        { error: `Epic FHIR API error: ${response.status}`, details: errorText },
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Epic FHIR] Exception:', error);
    return NextResponse.json(
      { error: 'Failed to call Epic FHIR API', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;

    const tokenData = await getValidToken();

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Not authenticated. Configure Epic Backend OAuth or paste a Bearer token in Settings.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const fhirPath = path.join('/');
    const searchParams = request.nextUrl.searchParams.toString();
    const url = searchParams
      ? `${EPIC_SANDBOX.fhirBaseUrl}/${fhirPath}?${searchParams}`
      : `${EPIC_SANDBOX.fhirBaseUrl}/${fhirPath}`;

    console.log(`[Epic FHIR] POST ${fhirPath}`);

    let body: string | undefined;
    const contentType = request.headers.get('content-type');
    if (contentType?.includes('application/json') || contentType?.includes('application/fhir+json')) {
      body = JSON.stringify(await request.json());
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.accessToken}`,
        'Accept': 'application/fhir+json',
        'Content-Type': 'application/fhir+json',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Epic FHIR] POST Error:', response.status, errorText);
      return NextResponse.json(
        { error: `Epic FHIR API error: ${response.status}`, details: errorText },
        { status: response.status, headers: corsHeaders }
      );
    }

    const data = await response.json();
    return NextResponse.json(data, { headers: corsHeaders });

  } catch (error: any) {
    console.error('[Epic FHIR] POST Exception:', error);
    return NextResponse.json(
      { error: 'Failed to call Epic FHIR API', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
