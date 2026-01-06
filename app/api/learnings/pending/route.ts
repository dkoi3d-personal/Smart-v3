/**
 * Pending Learnings API
 *
 * GET    /api/learnings/pending - List pending learnings
 * POST   /api/learnings/pending - Add a pending learning
 * DELETE /api/learnings/pending - Clear pending learnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingLearningsService, PendingLearning } from '@/services/memory/pending-learnings';
import { getLearningStore } from '@/services/memory/learning-store';

const pendingService = getPendingLearningsService();
const learningStore = getLearningStore();

// GET /api/learnings/pending
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const status = searchParams.get('status') as PendingLearning['status'] | null;
  const source = searchParams.get('source') as PendingLearning['source'] | null;
  const minConfidence = searchParams.get('minConfidence');
  const limit = parseInt(searchParams.get('limit') || '50');

  const learnings = pendingService.getAll({
    status: status || undefined,
    source: source || undefined,
    minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
    limit,
  });

  const stats = pendingService.getStats();

  return NextResponse.json({
    learnings,
    stats,
    count: learnings.length,
  });
}

// POST /api/learnings/pending - Add a new pending learning
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.description || !body.type || !body.category) {
      return NextResponse.json(
        { error: 'Missing required fields: title, description, type, category' },
        { status: 400 }
      );
    }

    const learning = {
      type: body.type,
      category: body.category,
      title: body.title,
      description: body.description,
      solution: body.solution,
      severity: body.severity || 'info',
      library: body.library,
      libraryVersion: body.libraryVersion,
      tags: body.tags || [],
      projectName: body.projectName,
      errorPattern: body.errorPattern,
      codeExample: body.codeExample,
    };

    const pending = pendingService.add(
      learning,
      body.source || 'manual',
      body.confidence ?? 0.5,
      body.sourceContext
    );

    return NextResponse.json(
      { pendingId: pending.pendingId, message: 'Pending learning added', learning: pending },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error adding pending learning:', error);
    return NextResponse.json(
      { error: 'Failed to add pending learning' },
      { status: 500 }
    );
  }
}

// DELETE /api/learnings/pending - Clear pending learnings
export async function DELETE(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get('status') as PendingLearning['status'] | null;

  const removed = pendingService.clear(status || undefined);

  return NextResponse.json({
    removed,
    message: `Cleared ${removed} pending learnings`,
  });
}
