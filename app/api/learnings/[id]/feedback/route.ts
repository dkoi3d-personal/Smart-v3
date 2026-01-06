/**
 * Learning Feedback API
 *
 * POST /api/learnings/[id]/feedback - Mark as helpful or not helpful
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearningStore } from '@/services/memory/learning-store';

const store = getLearningStore();

// POST /api/learnings/[id]/feedback
export async function POST(
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

  try {
    const body = await request.json();
    const { helpful } = body;

    if (typeof helpful !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required field: helpful (boolean)' },
        { status: 400 }
      );
    }

    if (helpful) {
      store.markHelpful(learningId);
    } else {
      store.markNotHelpful(learningId);
    }

    const updated = store.get(learningId);

    return NextResponse.json({
      message: helpful ? 'Marked as helpful' : 'Marked as not helpful',
      learning: updated,
    });
  } catch (error) {
    console.error('Error recording feedback:', error);
    return NextResponse.json(
      { error: 'Failed to record feedback' },
      { status: 500 }
    );
  }
}
