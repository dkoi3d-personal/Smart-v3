/**
 * Mock Google Analytics Data API - Status & Documentation
 *
 * GET - Returns API status and usage documentation
 */

import { NextResponse } from 'next/server';
import { DIMENSIONS, METRICS } from '@/lib/mock/ga-data-generator';

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: 'Mock Google Analytics Data API',
    description: 'A mock implementation of the GA4 Data API for testing and development',
    version: 'v1beta',
    status: 'active',
    baseUrl: '/api/mock-ga/v1beta',

    availableDimensions: DIMENSIONS.map(d => ({
      apiName: d.apiName,
      uiName: d.uiName,
      category: d.category,
    })),

    availableMetrics: METRICS.map(m => ({
      apiName: m.apiName,
      uiName: m.uiName,
      category: m.category,
      type: m.type,
    })),

    endpoints: {
      metadata: {
        method: 'GET',
        path: '/api/mock-ga/v1beta/properties/{propertyId}/metadata',
        description: 'Returns metadata for dimensions and metrics',
      },
      runReport: {
        method: 'POST',
        path: '/api/mock-ga/v1beta/properties/{propertyId}:runReport',
        description: 'Returns a customized report of your Google Analytics event data',
        exampleBody: {
          dimensions: [{ name: 'country' }, { name: 'deviceCategory' }],
          metrics: [{ name: 'activeUsers' }, { name: 'sessions' }],
          dateRanges: [{ startDate: '2024-01-01', endDate: '2024-01-31' }],
          limit: 10,
        },
      },
      runRealtimeReport: {
        method: 'POST',
        path: '/api/mock-ga/v1beta/properties/{propertyId}:runRealtimeReport',
        description: 'Returns realtime event data for your property',
        exampleBody: {
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }],
          limit: 10,
        },
      },
      runPivotReport: {
        method: 'POST',
        path: '/api/mock-ga/v1beta/properties/{propertyId}:runPivotReport',
        description: 'Returns a customized pivot report',
        exampleBody: {
          dimensions: [{ name: 'country' }, { name: 'browser' }],
          metrics: [{ name: 'sessions' }],
          pivots: [{ fieldNames: ['country'], limit: 5 }],
        },
      },
      batchRunReports: {
        method: 'POST',
        path: '/api/mock-ga/v1beta/properties/{propertyId}:batchRunReports',
        description: 'Returns multiple reports in a batch',
        exampleBody: {
          requests: [
            { dimensions: [{ name: 'country' }], metrics: [{ name: 'activeUsers' }] },
            { dimensions: [{ name: 'browser' }], metrics: [{ name: 'sessions' }] },
          ],
        },
      },
      checkCompatibility: {
        method: 'POST',
        path: '/api/mock-ga/v1beta/properties/{propertyId}:checkCompatibility',
        description: 'Checks if dimensions and metrics are compatible',
        exampleBody: {
          dimensions: [{ name: 'country' }],
          metrics: [{ name: 'activeUsers' }, { name: 'totalRevenue' }],
        },
      },
    },

    usage: {
      notes: [
        'Replace {propertyId} with any numeric value (e.g., 123456789)',
        'All POST endpoints accept optional dimensions and metrics arrays',
        'Responses contain realistic mock data with random values',
        'Use this API for testing GA4 integrations without needing real credentials',
      ],
      exampleCurl: `curl -X POST 'http://localhost:3000/api/mock-ga/v1beta/properties/123456789:runReport' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "dimensions": [{"name": "country"}],
    "metrics": [{"name": "activeUsers"}, {"name": "sessions"}],
    "limit": 5
  }'`,
    },
  });
}
