import { NextRequest, NextResponse } from 'next/server';
import {
  loadBug,
  updateBug,
  deleteBug,
  addComment,
  verifyBug,
  closeBug,
} from '@/lib/bug-tracker';

// GET - Get specific bug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bugId: string }> }
) {
  try {
    const { bugId } = await params;
    const projectId = request.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const bug = await loadBug(projectId, bugId);

    if (!bug) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(bug);
  } catch (error) {
    console.error('Failed to load bug:', error);
    return NextResponse.json(
      { error: 'Failed to load bug' },
      { status: 500 }
    );
  }
}

// PUT - Update bug
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ bugId: string }> }
) {
  try {
    const { bugId } = await params;
    const body = await request.json();
    const { projectId, action, ...updates } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    let result;

    // Handle special actions
    switch (action) {
      case 'verify':
        result = await verifyBug(projectId, bugId, updates.verifiedBy || 'unknown');
        break;
      case 'close':
        result = await closeBug(projectId, bugId, updates.reason);
        break;
      case 'comment':
        result = await addComment(projectId, bugId, {
          authorId: updates.authorId || 'unknown',
          authorName: updates.authorName || 'Unknown',
          authorRole: updates.authorRole || 'user',
          content: updates.content,
          isClaudeResponse: updates.isClaudeResponse,
        });
        break;
      default:
        result = await updateBug(projectId, bugId, updates);
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Bug not found or action failed' },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to update bug:', error);
    return NextResponse.json(
      { error: 'Failed to update bug' },
      { status: 500 }
    );
  }
}

// DELETE - Delete bug
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ bugId: string }> }
) {
  try {
    const { bugId } = await params;
    const projectId = request.nextUrl.searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteBug(projectId, bugId);

    if (!deleted) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete bug:', error);
    return NextResponse.json(
      { error: 'Failed to delete bug' },
      { status: 500 }
    );
  }
}
