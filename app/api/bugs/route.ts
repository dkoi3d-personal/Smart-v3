import { NextRequest, NextResponse } from 'next/server';
import { loadProjectBugs, createBug, getBugStats } from '@/lib/bug-tracker';

// GET - List bugs for a project
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    const statsOnly = request.nextUrl.searchParams.get('stats') === 'true';

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    if (statsOnly) {
      const stats = await getBugStats(projectId);
      return NextResponse.json(stats);
    }

    const bugs = await loadProjectBugs(projectId);
    const stats = await getBugStats(projectId);

    return NextResponse.json({
      bugs,
      stats,
      total: bugs.length,
    });
  } catch (error) {
    console.error('Failed to load bugs:', error);
    return NextResponse.json(
      { error: 'Failed to load bugs' },
      { status: 500 }
    );
  }
}

// POST - Create new bug
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      projectId,
      title,
      description,
      stepsToReproduce,
      expectedBehavior,
      actualBehavior,
      severity,
      category,
      reportedBy,
      reportedByName,
      screenshots,
      environment,
      tags,
    } = body;

    if (!projectId || !title || !description) {
      return NextResponse.json(
        { error: 'Project ID, title, and description are required' },
        { status: 400 }
      );
    }

    const bug = await createBug({
      projectId,
      title,
      description,
      stepsToReproduce: stepsToReproduce || [],
      expectedBehavior: expectedBehavior || '',
      actualBehavior: actualBehavior || '',
      severity: severity || 'medium',
      category: category || 'functionality',
      status: 'open',
      reportedBy: reportedBy || 'anonymous',
      reportedByName: reportedByName || 'Anonymous User',
      screenshots: screenshots || [],
      environment: environment || {},
      tags: tags || [],
    });

    return NextResponse.json(bug);
  } catch (error) {
    console.error('Failed to create bug:', error);
    return NextResponse.json(
      { error: 'Failed to create bug' },
      { status: 500 }
    );
  }
}
