/**
 * UAT Bug Analysis API
 * Analyzes a bug report and suggests a fix using Claude
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { projectId, bug } = await request.json();

    if (!projectId || !bug) {
      return NextResponse.json(
        { error: 'Project ID and bug details are required' },
        { status: 400 }
      );
    }

    const projectDir = getProjectDir(projectId);

    // Read relevant source files to understand the codebase
    let sourceContext = '';
    try {
      // Try to read main page file
      const possibleFiles = [
        'app/page.tsx',
        'src/app/page.tsx',
        'pages/index.tsx',
        'src/pages/index.tsx',
        'app/globals.css',
        'src/app/globals.css',
      ];

      for (const file of possibleFiles) {
        try {
          const content = await fs.readFile(path.join(projectDir, file), 'utf-8');
          sourceContext += `\n--- ${file} ---\n${content.substring(0, 3000)}\n`;
        } catch {
          // File doesn't exist, skip
        }
      }
    } catch {
      // Ignore errors reading files
    }

    // Generate analysis based on bug report
    const analysis = generateBugAnalysis(bug, sourceContext);

    return NextResponse.json({
      success: true,
      analysis,
      suggestedFiles: identifyRelevantFiles(bug),
    });

  } catch (error) {
    console.error('Bug analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze bug', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

function generateBugAnalysis(bug: any, sourceContext: string): string {
  const { title, description, steps, expected, actual } = bug;

  let analysis = `## Bug Analysis: ${title}\n\n`;
  analysis += `### Problem\n${description}\n\n`;
  analysis += `### Expected Behavior\n${expected}\n\n`;
  analysis += `### Actual Behavior\n${actual}\n\n`;
  analysis += `### Steps to Reproduce\n${steps}\n\n`;

  // Analyze the bug type
  const bugType = identifyBugType(bug);
  analysis += `### Bug Type\n${bugType}\n\n`;

  // Suggest fix approach
  analysis += `### Suggested Fix Approach\n`;

  if (bugType.includes('UI') || bugType.includes('styling')) {
    analysis += `- Check CSS/Tailwind classes in the affected component\n`;
    analysis += `- Verify color values, spacing, and layout properties\n`;
    analysis += `- Look for missing or incorrect class names\n`;
  } else if (bugType.includes('functional')) {
    analysis += `- Check event handlers and click/submit logic\n`;
    analysis += `- Verify state management and data flow\n`;
    analysis += `- Look for incorrect conditions or missing validation\n`;
  } else if (bugType.includes('logic')) {
    analysis += `- Review calculation logic and data transformations\n`;
    analysis += `- Check for off-by-one errors or incorrect operators\n`;
    analysis += `- Verify state updates are happening correctly\n`;
  }

  analysis += `\n### Files to Check\n`;
  const files = identifyRelevantFiles(bug);
  files.forEach(f => {
    analysis += `- ${f}\n`;
  });

  return analysis;
}

function identifyBugType(bug: any): string {
  const desc = `${bug.title} ${bug.description} ${bug.actual}`.toLowerCase();

  if (desc.includes('color') || desc.includes('style') || desc.includes('css') ||
      desc.includes('layout') || desc.includes('display') || desc.includes('font')) {
    return 'UI/Styling Bug';
  }
  if (desc.includes('click') || desc.includes('button') || desc.includes('submit') ||
      desc.includes('form') || desc.includes('input') || desc.includes('work')) {
    return 'Functional Bug';
  }
  if (desc.includes('calculation') || desc.includes('count') || desc.includes('total') ||
      desc.includes('wrong') || desc.includes('incorrect')) {
    return 'Logic Bug';
  }
  return 'General Bug';
}

function identifyRelevantFiles(bug: any): string[] {
  const files: string[] = [];
  const desc = `${bug.title} ${bug.description}`.toLowerCase();

  // Always include main page
  files.push('app/page.tsx');

  // Add CSS if styling related
  if (desc.includes('color') || desc.includes('style') || desc.includes('css') ||
      desc.includes('layout') || desc.includes('font') || desc.includes('size')) {
    files.push('app/globals.css');
  }

  return files;
}
