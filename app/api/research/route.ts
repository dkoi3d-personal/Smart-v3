/**
 * Research API
 * Thin wrapper around the research service
 */

import { NextRequest, NextResponse } from 'next/server';
import { researchCodebase } from '@/services/research-service';

export async function POST(request: NextRequest) {
  try {
    const { projectDir, question, previousMessages } = await request.json();

    if (!projectDir || !question) {
      return NextResponse.json(
        { error: 'projectDir and question are required' },
        { status: 400 }
      );
    }

    const result = await researchCodebase(
      projectDir,
      question,
      previousMessages || []
    );

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Research API] Error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific errors
    if (message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process research request', details: message },
      { status: 500 }
    );
  }
}
