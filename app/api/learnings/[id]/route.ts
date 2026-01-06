/**
 * Individual Learning API
 *
 * GET    /api/learnings/[id] - Get a learning
 * PUT    /api/learnings/[id] - Update a learning
 * DELETE /api/learnings/[id] - Delete a learning
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearningStore } from '@/services/memory/learning-store';

const store = getLearningStore();

// GET /api/learnings/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const learningId = parseInt(id);

  if (isNaN(learningId)) {
    return NextResponse.json(
      { error: 'Invalid learning ID' },
      { status: 400 }
    );
  }

  const learning = store.get(learningId);

  if (!learning) {
    return NextResponse.json(
      { error: 'Learning not found' },
      { status: 404 }
    );
  }

  return NextResponse.json(learning);
}

// PUT /api/learnings/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const learningId = parseInt(id);

  if (isNaN(learningId)) {
    return NextResponse.json(
      { error: 'Invalid learning ID' },
      { status: 400 }
    );
  }

  try {
    const body = await request.json();
    const success = store.update(learningId, body);

    if (!success) {
      return NextResponse.json(
        { error: 'Learning not found' },
        { status: 404 }
      );
    }

    const updated = store.get(learningId);
    return NextResponse.json({
      message: 'Learning updated',
      learning: updated,
    });
  } catch (error) {
    console.error('Error updating learning:', error);
    return NextResponse.json(
      { error: 'Failed to update learning' },
      { status: 500 }
    );
  }
}

// DELETE /api/learnings/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const learningId = parseInt(id);

  if (isNaN(learningId)) {
    return NextResponse.json(
      { error: 'Invalid learning ID' },
      { status: 400 }
    );
  }

  const success = store.delete(learningId);

  if (!success) {
    return NextResponse.json(
      { error: 'Learning not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ message: 'Learning deleted' });
}
