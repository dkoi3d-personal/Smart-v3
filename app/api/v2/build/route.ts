/**
 * Build API Endpoint
 * Executes the build phase for a project
 */

import { NextRequest, NextResponse } from 'next/server';
import { claudeCodeService, Task } from '@/services/claude-code-service';
import * as fs from 'fs/promises';
import path from 'path';
import { getProjectDir } from '@/lib/project-paths';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    // Find project directory OUTSIDE of ai-dev-platform-v2
    const projectDir = getProjectDir(projectId);

    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Load project metadata and tasks
    const projectMeta = JSON.parse(
      await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8')
    );

    let tasks: Task[] = [];
    try {
      tasks = JSON.parse(
        await fs.readFile(path.join(projectDir, 'tasks.json'), 'utf-8')
      );
    } catch {
      // No tasks file, will create tasks during build
    }

    // Load plan if exists
    let plan = '';
    try {
      plan = await fs.readFile(path.join(projectDir, 'plan.md'), 'utf-8');
    } catch {
      // No plan, will work from requirements
    }

    // Update status to building
    projectMeta.status = 'building';
    projectMeta.updatedAt = new Date().toISOString();
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );

    // Build the prompt
    const buildPrompt = `
Project: ${projectMeta.name}

Requirements:
${projectMeta.requirements}

${plan ? `Plan:\n${plan}\n` : ''}

Please implement this project. Create all necessary files, install dependencies, and ensure the code compiles.
`;

    // Run build phase (non-streaming for this endpoint)
    let buildOutput = '';

    for await (const event of claudeCodeService.runStream({
      projectId,
      requirements: buildPrompt,
      workingDirectory: projectDir,
      mode: 'build',
      tasks,
    })) {
      if (event.type === 'text') {
        buildOutput += event.content;
      }
    }

    // Update project status
    projectMeta.status = 'completed';
    projectMeta.updatedAt = new Date().toISOString();
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );

    // Save build output
    await fs.writeFile(
      path.join(projectDir, 'build-output.md'),
      buildOutput
    );

    return NextResponse.json({
      success: true,
      projectId,
      status: 'completed',
      output: buildOutput,
    });

  } catch (error) {
    console.error('Build error:', error);
    return NextResponse.json(
      { error: 'Failed to build project', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
