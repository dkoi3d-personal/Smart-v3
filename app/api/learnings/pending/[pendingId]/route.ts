/**
 * Individual Pending Learning API
 *
 * GET    /api/learnings/pending/[pendingId] - Get a specific pending learning
 * PUT    /api/learnings/pending/[pendingId] - Update a pending learning
 * DELETE /api/learnings/pending/[pendingId] - Remove a pending learning
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPendingLearningsService } from '@/services/memory/pending-learnings';
import { getLearningStore } from '@/services/memory/learning-store';

const pendingService = getPendingLearningsService();
const learningStore = getLearningStore();

interface RouteContext {
  params: Promise<{ pendingId: string }>;
}

// GET /api/learnings/pending/[pendingId]
export async function GET(request: NextRequest, context: RouteContext) {
  const { pendingId } = await context.params;
  const learning = pendingService.get(pendingId);

  if (!learning) {
    return NextResponse.json(
      { error: 'Pending learning not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ learning });
}

// PUT /api/learnings/pending/[pendingId] - Update or change status
export async function PUT(request: NextRequest, context: RouteContext) {
  const { pendingId } = await context.params;
  const body = await request.json();

  const learning = pendingService.get(pendingId);
  if (!learning) {
    return NextResponse.json(
      { error: 'Pending learning not found' },
      { status: 404 }
    );
  }

  // Handle status changes
  if (body.action) {
    switch (body.action) {
      case 'approve': {
        // Approve and save to permanent store
        const approved = pendingService.approve(pendingId);
        if (!approved) {
          return NextResponse.json(
            { error: 'Failed to approve learning' },
            { status: 500 }
          );
        }

        // Save to permanent learning store
        const savedId = learningStore.add({
          type: approved.type,
          category: approved.category,
          title: approved.title,
          description: approved.description,
          solution: approved.solution,
          severity: approved.severity,
          library: approved.library,
          libraryVersion: approved.libraryVersion,
          tags: approved.tags,
          projectName: approved.projectName,
          errorPattern: approved.errorPattern,
          codeExample: approved.codeExample,
        });

        // Remove from pending queue
        pendingService.remove(pendingId);

        return NextResponse.json({
          message: 'Learning approved and saved',
          savedId,
          learning: approved,
        });
      }

      case 'reject': {
        const rejected = pendingService.reject(pendingId);
        if (!rejected) {
          return NextResponse.json(
            { error: 'Failed to reject learning' },
            { status: 500 }
          );
        }

        // Remove from pending queue
        pendingService.remove(pendingId);

        return NextResponse.json({
          message: 'Learning rejected',
          learning: rejected,
        });
      }

      case 'merge': {
        // Merge with an existing learning
        if (!body.mergeWithId) {
          return NextResponse.json(
            { error: 'mergeWithId required for merge action' },
            { status: 400 }
          );
        }

        const merged = pendingService.markMerged(pendingId, body.mergeWithId);
        if (!merged) {
          return NextResponse.json(
            { error: 'Failed to merge learning' },
            { status: 500 }
          );
        }

        // Remove from pending queue
        pendingService.remove(pendingId);

        return NextResponse.json({
          message: 'Learning merged with existing',
          mergedWithId: body.mergeWithId,
          learning: merged,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }
  }

  // Handle field updates
  const updates: any = {};
  if (body.title) updates.title = body.title;
  if (body.description) updates.description = body.description;
  if (body.solution) updates.solution = body.solution;
  if (body.type) updates.type = body.type;
  if (body.severity) updates.severity = body.severity;
  if (body.tags) updates.tags = body.tags;
  if (body.confidence !== undefined) updates.confidence = body.confidence;

  const updated = pendingService.update(pendingId, updates);
  if (!updated) {
    return NextResponse.json(
      { error: 'Failed to update learning' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    message: 'Learning updated',
    learning: updated,
  });
}

// DELETE /api/learnings/pending/[pendingId]
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { pendingId } = await context.params;
  const removed = pendingService.remove(pendingId);

  if (!removed) {
    return NextResponse.json(
      { error: 'Pending learning not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    message: 'Pending learning removed',
    pendingId,
  });
}
