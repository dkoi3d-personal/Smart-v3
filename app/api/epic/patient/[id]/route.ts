/**
 * Epic Patient Data API
 */

import { NextRequest, NextResponse } from 'next/server';
import { EPIC_SANDBOX, getValidToken } from '../../route';

// CORS headers for generated apps
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/epic/patient/[id]
 * Fetch patient data from Epic FHIR
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    console.log(`[Epic Patient] Fetching patient: ${id}`);

    // Get valid token (auto-refreshes Backend OAuth if needed)
    const tokenData = await getValidToken();

    if (!tokenData) {
      return NextResponse.json(
        { error: 'Not authenticated. Connect to Epic first.' },
        { status: 401, headers: corsHeaders }
      );
    }

    const token = tokenData.accessToken;

    const response = await fetch(
      `${EPIC_SANDBOX.fhirBaseUrl}/Patient/${id}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/fhir+json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Epic Patient] Fetch failed:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to fetch patient', details: errorText },
        { status: response.status, headers: corsHeaders }
      );
    }

    const patient = await response.json();
    console.log(`[Epic Patient] Successfully fetched: ${patient.name?.[0]?.family || 'Unknown'}`);

    return NextResponse.json(patient, { headers: corsHeaders });
  } catch (error: any) {
    console.error('[Epic Patient] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch patient', details: error.message },
      { status: 500, headers: corsHeaders }
    );
  }
}
