/**
 * Mock Google Analytics Data API
 *
 * Implements the GA4 Data API endpoints for testing and development.
 * Based on: https://developers.google.com/analytics/devguides/reporting/data/v1
 *
 * Endpoints:
 * - GET  /api/mock-ga/v1beta/properties/{propertyId}/metadata
 * - POST /api/mock-ga/v1beta/properties/{propertyId}:runReport
 * - POST /api/mock-ga/v1beta/properties/{propertyId}:runRealtimeReport
 * - POST /api/mock-ga/v1beta/properties/{propertyId}:runPivotReport
 * - POST /api/mock-ga/v1beta/properties/{propertyId}:batchRunReports
 * - POST /api/mock-ga/v1beta/properties/{propertyId}:batchRunPivotReports
 * - POST /api/mock-ga/v1beta/properties/{propertyId}:checkCompatibility
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generateMetadata,
  generateRunReportResponse,
  generateRealtimeReportResponse,
  generatePivotReportResponse,
  generateBatchRunReportsResponse,
  generateCheckCompatibilityResponse,
} from '@/lib/mock/ga-data-generator';

// Simulate network latency (optional)
const SIMULATED_LATENCY_MS = 0;

async function simulateLatency() {
  if (SIMULATED_LATENCY_MS > 0) {
    await new Promise(resolve => setTimeout(resolve, SIMULATED_LATENCY_MS));
  }
}

function extractPropertyId(pathParts: string[]): string | null {
  // Look for "properties" followed by an ID
  const propsIndex = pathParts.indexOf('properties');
  if (propsIndex !== -1 && pathParts[propsIndex + 1]) {
    // Handle cases like "properties/123456:runReport"
    const idPart = pathParts[propsIndex + 1];
    const colonIndex = idPart.indexOf(':');
    if (colonIndex !== -1) {
      return idPart.substring(0, colonIndex);
    }
    return idPart;
  }
  return null;
}

function extractOperation(pathParts: string[]): string | null {
  // Look for operation suffix like ":runReport"
  for (const part of pathParts) {
    if (part.includes(':')) {
      const colonIndex = part.indexOf(':');
      return part.substring(colonIndex + 1);
    }
  }
  // Check if it's a metadata request
  if (pathParts.includes('metadata')) {
    return 'metadata';
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  await simulateLatency();

  const { path } = await params;
  const operation = extractOperation(path);
  const propertyId = extractPropertyId(path);

  console.log('[MockGA] GET request:', { path, operation, propertyId });

  // Metadata endpoint
  if (operation === 'metadata' || path.includes('metadata')) {
    const metadata = generateMetadata();
    return NextResponse.json(metadata);
  }

  return NextResponse.json(
    {
      error: {
        code: 404,
        message: `Unknown endpoint: ${path.join('/')}`,
        status: 'NOT_FOUND',
      },
    },
    { status: 404 }
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
): Promise<NextResponse> {
  await simulateLatency();

  const { path } = await params;
  const operation = extractOperation(path);
  const propertyId = extractPropertyId(path);

  console.log('[MockGA] POST request:', { path, operation, propertyId });

  let body: Record<string, unknown> = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is acceptable for some endpoints
  }

  switch (operation) {
    case 'runReport': {
      const response = generateRunReportResponse({
        dimensions: body.dimensions as { name: string }[] | undefined,
        metrics: body.metrics as { name: string }[] | undefined,
        limit: body.limit as number | undefined,
      });
      return NextResponse.json(response);
    }

    case 'runRealtimeReport': {
      const response = generateRealtimeReportResponse({
        dimensions: body.dimensions as { name: string }[] | undefined,
        metrics: body.metrics as { name: string }[] | undefined,
        limit: body.limit as number | undefined,
      });
      return NextResponse.json(response);
    }

    case 'runPivotReport': {
      const response = generatePivotReportResponse({
        dimensions: body.dimensions as { name: string }[] | undefined,
        metrics: body.metrics as { name: string }[] | undefined,
        pivots: body.pivots as Array<{ fieldNames: string[]; limit?: number }> | undefined,
      });
      return NextResponse.json(response);
    }

    case 'batchRunReports': {
      const requests = (body.requests as Array<{
        dimensions?: { name: string }[];
        metrics?: { name: string }[];
        limit?: number;
      }>) || [{}];
      const response = generateBatchRunReportsResponse(requests);
      return NextResponse.json(response);
    }

    case 'batchRunPivotReports': {
      // Similar to batchRunReports but for pivot reports
      const requests = (body.requests as Array<{
        dimensions?: { name: string }[];
        metrics?: { name: string }[];
        pivots?: Array<{ fieldNames: string[]; limit?: number }>;
      }>) || [{}];
      const response = {
        pivotReports: requests.map(req => generatePivotReportResponse(req)),
        kind: 'analyticsData#batchRunPivotReports',
      };
      return NextResponse.json(response);
    }

    case 'checkCompatibility': {
      const response = generateCheckCompatibilityResponse({
        dimensions: body.dimensions as { name: string }[] | undefined,
        metrics: body.metrics as { name: string }[] | undefined,
      });
      return NextResponse.json(response);
    }

    default:
      return NextResponse.json(
        {
          error: {
            code: 404,
            message: `Unknown operation: ${operation}`,
            status: 'NOT_FOUND',
          },
        },
        { status: 404 }
      );
  }
}
