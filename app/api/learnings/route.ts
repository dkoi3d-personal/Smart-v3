/**
 * Learnings API - List & Create
 *
 * GET  /api/learnings - List learnings
 * POST /api/learnings - Create a new learning
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLearningStore, Learning, LearningType, Severity } from '@/services/memory/learning-store';

const store = getLearningStore();

// GET /api/learnings
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Support both 'q' and 'search' params for backwards compatibility
  const query = searchParams.get('q') || searchParams.get('search');
  const category = searchParams.get('category');
  const library = searchParams.get('library');
  const type = searchParams.get('type') as LearningType | null;
  const severity = searchParams.get('severity') as Severity | null;
  const tag = searchParams.get('tag'); // New: filter by tag
  const limit = parseInt(searchParams.get('limit') || '20');
  const offset = parseInt(searchParams.get('offset') || '0');

  let learnings: Learning[];

  if (query) {
    learnings = store.search(query, limit);
  } else if (category) {
    learnings = store.getByCategory(category, limit);
  } else if (library) {
    learnings = store.getByLibrary(library, limit);
  } else if (type) {
    learnings = store.getByType(type, limit);
  } else if (tag) {
    learnings = store.getByTag(tag, limit);
  } else if (severity === 'critical') {
    learnings = store.getCritical();
  } else {
    learnings = store.getAll(offset, limit);
  }

  // Apply additional filters if provided along with primary filter
  if (learnings.length > 0) {
    if (severity && severity !== 'critical') {
      learnings = learnings.filter(l => l.severity === severity);
    }
    if (type && query) {
      // When using search, also filter by type if specified
      learnings = learnings.filter(l => l.type === type);
    }
    if (tag && query) {
      // When using search, also filter by tag if specified
      learnings = learnings.filter(l => l.tags?.includes(tag));
    }
  }

  return NextResponse.json({
    learnings,
    count: learnings.length,
    offset,
    limit,
  });
}

// POST /api/learnings
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

    // Validate type
    const validTypes: LearningType[] = [
      'gotcha', 'pattern', 'anti-pattern', 'library-issue',
      'workaround', 'best-practice', 'error-solution', 'config'
    ];
    if (!validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Validate severity
    const validSeverities: Severity[] = ['info', 'warning', 'critical'];
    if (body.severity && !validSeverities.includes(body.severity)) {
      return NextResponse.json(
        { error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
        { status: 400 }
      );
    }

    const learning = {
      type: body.type as LearningType,
      category: body.category,
      title: body.title,
      description: body.description,
      solution: body.solution,
      severity: (body.severity || 'info') as Severity,
      library: body.library,
      libraryVersion: body.libraryVersion,
      tags: body.tags || [],
      projectName: body.projectName,
      errorPattern: body.errorPattern,
      codeExample: body.codeExample,
    };

    const id = store.add(learning);

    return NextResponse.json(
      { id, message: 'Learning created', learning: { ...learning, id } },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating learning:', error);
    return NextResponse.json(
      { error: 'Failed to create learning' },
      { status: 500 }
    );
  }
}
