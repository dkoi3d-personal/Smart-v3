/**
 * Design Systems Upload API
 *
 * POST /api/design-systems/upload - Upload a design system file
 *
 * Supports:
 * - JSON files (.json)
 * - Markdown files (.md)
 * - ZIP packages (.zip)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createDesignSystem } from '@/lib/design-systems';
import { parseDesignSystemFile, validateParsedDesignSystem } from '@/lib/design-systems/parsers';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const validExtensions = ['.json', '.md', '.markdown', '.zip'];
    const hasValidExtension = validExtensions.some((ext) => fileName.endsWith(ext));

    if (!hasValidExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Supported: JSON, Markdown, ZIP' },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB' },
        { status: 400 }
      );
    }

    // Read file content
    let content: string | Buffer;
    if (fileName.endsWith('.zip')) {
      const arrayBuffer = await file.arrayBuffer();
      content = Buffer.from(arrayBuffer);
    } else {
      content = await file.text();
    }

    // Parse the file
    const parsed = await parseDesignSystemFile(file.name, content);

    // Validate
    const errors = validateParsedDesignSystem(parsed);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 }
      );
    }

    // Create the design system
    const designSystem = await createDesignSystem({
      name: parsed.name,
      description: parsed.description,
      version: parsed.version,
      tokens: parsed.tokens,
      components: parsed.components,
      guidelines: parsed.guidelines,
      examples: parsed.examples,
    });

    return NextResponse.json({
      success: true,
      designSystem,
      warnings: parsed.warnings,
    }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Failed to upload design system:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to process file' },
      { status: 500 }
    );
  }
}
