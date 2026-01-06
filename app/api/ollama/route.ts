/**
 * Ollama Status API
 *
 * GET /api/ollama - Get Ollama status and available models
 * POST /api/ollama - Pull a model
 * DELETE /api/ollama - Delete a model
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOllamaClient } from '@/lib/ollama';

export async function GET() {
  try {
    const client = getOllamaClient();
    const status = await client.getStatus();

    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        running: false,
        models: [],
        error: error instanceof Error ? error.message : 'Failed to get Ollama status',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { model, action } = await request.json();

    if (!model) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const client = getOllamaClient();

    if (action === 'pull') {
      // Start pulling the model
      // Note: This is a long-running operation, ideally handled via streaming
      await client.pullModel(model);
      return NextResponse.json({ success: true, message: `Model ${model} pulled successfully` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Operation failed' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const model = searchParams.get('model');

    if (!model) {
      return NextResponse.json({ error: 'Model name is required' }, { status: 400 });
    }

    const client = getOllamaClient();
    await client.deleteModel(model);

    return NextResponse.json({ success: true, message: `Model ${model} deleted` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Delete failed' },
      { status: 500 }
    );
  }
}
