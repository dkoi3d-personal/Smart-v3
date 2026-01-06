/**
 * Mock Analytics - Pageview Tracking API
 *
 * This endpoint mimics Google Analytics pageview tracking for testing purposes.
 * POST - Track a pageview
 * GET - Retrieve all tracked pageviews
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory store for demo (pageviews persist until server restart)
const pageviews: Array<{
  id: string;
  url: string;
  analyticsId: string;
  timestamp: string;
  userAgent?: string;
  referrer?: string;
}> = [];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { url, analyticsId } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'url is required' },
        { status: 400 }
      );
    }

    const pageview = {
      id: crypto.randomUUID(),
      url,
      analyticsId: analyticsId || 'unknown',
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || undefined,
      referrer: request.headers.get('referer') || undefined,
    };

    pageviews.push(pageview);

    // Keep only last 100 pageviews
    if (pageviews.length > 100) {
      pageviews.shift();
    }

    console.log('[MockAnalytics] Pageview tracked:', pageview);

    return NextResponse.json({
      success: true,
      pageviewId: pageview.id,
      message: 'Pageview tracked successfully',
    });
  } catch (error) {
    console.error('[MockAnalytics] Pageview error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    pageviews,
    count: pageviews.length,
    message: 'Mock Analytics - Pageviews',
  });
}
