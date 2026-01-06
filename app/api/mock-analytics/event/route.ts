/**
 * Mock Analytics - Event Tracking API
 *
 * This endpoint mimics Google Analytics event tracking for testing purposes.
 * POST - Track an event
 * GET - Retrieve all tracked events
 */

import { NextRequest, NextResponse } from 'next/server';

// In-memory store for demo (events persist until server restart)
const events: Array<{
  id: string;
  action: string;
  category: string;
  label?: string;
  analyticsId: string;
  timestamp: string;
}> = [];

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { action, category, label, analyticsId } = body;

    if (!action || !category) {
      return NextResponse.json(
        { error: 'action and category are required' },
        { status: 400 }
      );
    }

    const event = {
      id: crypto.randomUUID(),
      action,
      category,
      label,
      analyticsId: analyticsId || 'unknown',
      timestamp: new Date().toISOString(),
    };

    events.push(event);

    // Keep only last 100 events
    if (events.length > 100) {
      events.shift();
    }

    console.log('[MockAnalytics] Event tracked:', event);

    return NextResponse.json({
      success: true,
      eventId: event.id,
      message: 'Event tracked successfully',
    });
  } catch (error) {
    console.error('[MockAnalytics] Event error:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    events,
    count: events.length,
    message: 'Mock Analytics - Events',
  });
}
