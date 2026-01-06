/**
 * Parallel Testing API
 *
 * POST /api/testing/parallel
 * Runs multiple test agents in parallel based on settings
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  ParallelTestingService,
  createParallelTestingService,
  TestTask,
  TestResult
} from '@/services/parallel-testing-service';
import { getProjectDir } from '@/lib/project-paths';
import { loadAgentConfig } from '@/lib/agent-config-store';
import * as fs from 'fs/promises';
import * as path from 'path';

export const maxDuration = 300; // 5 minutes max

/**
 * POST /api/testing/parallel
 * Run parallel tests for a project
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const safeEnqueue = (data: string) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(data));
        } catch (err) {
          isClosed = true;
        }
      };

      const safeClose = () => {
        isClosed = true;
        controller.close();
      };

      const sendEvent = (type: string, data: any) => {
        safeEnqueue(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      };

      try {
        const body = await request.json();
        const { projectId, stories } = body;

        if (!projectId) {
          sendEvent('error', { message: 'Project ID is required' });
          safeClose();
          return;
        }

        const projectDir = getProjectDir(projectId);

        // Verify project exists
        try {
          await fs.access(projectDir);
        } catch {
          sendEvent('error', { message: 'Project not found' });
          safeClose();
          return;
        }

        // Load agent config to get parallel tester count
        const config = await loadAgentConfig();
        const parallelTesters = config.quickSettings.parallelTesters || 3;

        sendEvent('config', { parallelTesters, totalStories: stories?.length || 0 });

        // Create parallel testing service
        const testingService = await createParallelTestingService(projectDir);

        // Set up event listeners for streaming updates
        testingService.on('testing:started', (data) => sendEvent('started', data));
        testingService.on('batch:started', (data) => sendEvent('batch_started', data));
        testingService.on('test:started', (data) => sendEvent('test_started', data));
        testingService.on('test:progress', (data) => sendEvent('test_progress', data));
        testingService.on('test:completed', (data) => sendEvent('test_completed', data));
        testingService.on('test:failed', (data) => sendEvent('test_failed', data));
        testingService.on('batch:completed', (data) => sendEvent('batch_completed', data));
        testingService.on('testing:completed', (data) => sendEvent('completed', data));

        // If stories provided, add them as tasks
        if (stories && stories.length > 0) {
          const tasks: TestTask[] = stories.map((story: { id: string; title: string; testFiles?: string[] }) => ({
            id: `test-${story.id}`,
            storyId: story.id,
            storyTitle: story.title,
            testFiles: story.testFiles || [],
            status: 'pending' as const,
          }));

          testingService.addTasks(tasks);
        } else {
          // Auto-discover stories from .agile-stories.json
          try {
            const storiesPath = path.join(projectDir, '.agile-stories.json');
            const storiesData = await fs.readFile(storiesPath, 'utf-8');
            const allStories = JSON.parse(storiesData);

            // Filter stories that need testing
            const testableStories = allStories.filter((s: any) =>
              s.status === 'testing' || s.status === 'done' || s.status === 'completed'
            );

            if (testableStories.length === 0) {
              sendEvent('info', { message: 'No stories found that need testing' });
            } else {
              const tasks: TestTask[] = testableStories.map((story: any) => ({
                id: `test-${story.id}`,
                storyId: story.id,
                storyTitle: story.title,
                testFiles: [],
                status: 'pending' as const,
              }));

              testingService.addTasks(tasks);
            }
          } catch {
            sendEvent('info', { message: 'No .agile-stories.json found, please provide stories array' });
          }
        }

        // Run all tests in parallel
        const results = await testingService.runAll();

        // Write combined results to file
        const resultsPath = path.join(projectDir, '.parallel-test-results.json');
        await fs.writeFile(resultsPath, JSON.stringify({
          timestamp: new Date().toISOString(),
          parallelTesters,
          results,
          summary: {
            total: results.length,
            passed: results.filter(r => r.passed).length,
            failed: results.filter(r => !r.passed).length,
            totalTests: results.reduce((sum, r) => sum + r.totalTests, 0),
            totalPassed: results.reduce((sum, r) => sum + r.passedTests, 0),
            totalFailed: results.reduce((sum, r) => sum + r.failedTests, 0),
          }
        }, null, 2), 'utf-8');

        sendEvent('results', { results, resultsFile: '.parallel-test-results.json' });
        safeEnqueue(`data: ${JSON.stringify({ done: true })}\n\n`);
        safeClose();

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        sendEvent('error', { message: errorMessage });
        safeClose();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}

/**
 * GET /api/testing/parallel?projectId=xxx
 * Get parallel testing configuration and status
 */
export async function GET(request: NextRequest) {
  try {
    const projectId = request.nextUrl.searchParams.get('projectId');
    const config = await loadAgentConfig();

    const response: any = {
      parallelTesters: config.quickSettings.parallelTesters || 3,
      requireTests: config.quickSettings.requireTests,
      minCoverage: config.quickSettings.minCoverage || 0,
    };

    // If projectId provided, try to load latest results
    if (projectId) {
      const projectDir = getProjectDir(projectId);

      try {
        const resultsPath = path.join(projectDir, '.parallel-test-results.json');
        const resultsData = await fs.readFile(resultsPath, 'utf-8');
        response.latestResults = JSON.parse(resultsData);
      } catch {
        response.latestResults = null;
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get testing configuration' },
      { status: 500 }
    );
  }
}
