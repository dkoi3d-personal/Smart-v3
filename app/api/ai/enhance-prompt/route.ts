/**
 * AI Prompt Enhancement API
 * Uses the unified AI service to expand and improve build prompts
 */

import { NextRequest, NextResponse } from 'next/server';
import { AIService } from '@/services/ai-service';

export async function POST(request: NextRequest) {
  try {
    const { prompt, projectContext } = await request.json();

    if (!prompt || prompt.trim().length === 0) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    if (!AIService.isAvailable()) {
      return NextResponse.json(
        { error: 'No AI providers configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY.' },
        { status: 503 }
      );
    }

    const enhancedPrompt = await AIService.enhancePrompt(prompt, projectContext);

    return NextResponse.json({
      enhancedPrompt,
      originalPrompt: prompt,
      providers: AIService.getProviders(),
    });

  } catch (error: unknown) {
    console.error('[AI Enhance] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to enhance prompt', details: message },
      { status: 500 }
    );
  }
}

// Also expose a GET endpoint to check availability
export async function GET() {
  return NextResponse.json({
    available: AIService.isAvailable(),
    providers: AIService.getProviders(),
  });
}
