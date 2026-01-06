import { NextRequest, NextResponse } from 'next/server';
import { saveScreenshot } from '@/lib/bug-tracker';

// POST - Upload screenshot
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bugId: string }> }
) {
  try {
    const { bugId } = await params;
    const body = await request.json();
    const { projectId, screenshotData, annotations } = body;

    if (!projectId || !screenshotData) {
      return NextResponse.json(
        { error: 'Project ID and screenshot data are required' },
        { status: 400 }
      );
    }

    const screenshot = await saveScreenshot(
      projectId,
      bugId,
      screenshotData,
      annotations
    );

    if (!screenshot) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(screenshot);
  } catch (error) {
    console.error('Failed to upload screenshot:', error);
    return NextResponse.json(
      { error: 'Failed to upload screenshot' },
      { status: 500 }
    );
  }
}
