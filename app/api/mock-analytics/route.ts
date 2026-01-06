/**
 * Mock Analytics - Summary API
 *
 * GET - Get summary of all mock analytics data
 * DELETE - Clear all mock analytics data
 */

import { NextResponse } from 'next/server';

// Note: These are the same arrays used in the event and pageview routes
// In a real implementation, you'd use a shared store or database

export async function GET(): Promise<NextResponse> {
  // Fetch data from sub-endpoints
  const eventsRes = await fetch(new URL('/api/mock-analytics/event', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'));
  const pageviewsRes = await fetch(new URL('/api/mock-analytics/pageview', process.env.NEXT_PUBLIC_URL || 'http://localhost:3000'));

  let events = { count: 0, events: [] };
  let pageviews = { count: 0, pageviews: [] };

  try {
    events = await eventsRes.json();
    pageviews = await pageviewsRes.json();
  } catch (e) {
    // Endpoints might not be available during build
  }

  return NextResponse.json({
    service: 'Mock Analytics',
    description: 'A test analytics service that mimics Google Analytics patterns',
    status: 'active',
    stats: {
      totalEvents: events.count || 0,
      totalPageviews: pageviews.count || 0,
    },
    endpoints: {
      events: '/api/mock-analytics/event',
      pageviews: '/api/mock-analytics/pageview',
    },
    usage: {
      trackEvent: {
        method: 'POST',
        url: '/api/mock-analytics/event',
        body: {
          action: 'click',
          category: 'button',
          label: 'signup',
          analyticsId: 'MOCK-12345',
        },
      },
      trackPageview: {
        method: 'POST',
        url: '/api/mock-analytics/pageview',
        body: {
          url: '/dashboard',
          analyticsId: 'MOCK-12345',
        },
      },
    },
  });
}
