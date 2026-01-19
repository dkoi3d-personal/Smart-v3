/**
 * Workflow Recording API
 *
 * POST - Start recording a workflow using Computer Use
 * Streams progress via SSE
 */

import { NextRequest } from 'next/server';
import { computerUseService } from '@/services/uat/computer-use-service';
import { browserService } from '@/services/uat/browser-service';
import { EMPLOYERS_BRAND } from '@/services/uat/types';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max for recording

/**
 * POST - Start recording a workflow
 *
 * Body: {
 *   projectId: string,
 *   startUrl: string,
 *   task: string,
 *   priority?: 'critical' | 'high' | 'medium' | 'low',
 *   brandConfig?: BrandConfig
 * }
 */
export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;
      const sessionId = `record-${Date.now()}`;

      const send = (event: string, data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          isClosed = true;
        }
      };

      const close = () => {
        if (!isClosed) {
          isClosed = true;
          controller.close();
        }
      };

      try {
        const body = await request.json();
        const { projectId, startUrl, task, priority, brandConfig } = body;

        if (!projectId || !startUrl || !task) {
          send('error', { error: 'Missing required fields: projectId, startUrl, task' });
          close();
          return;
        }

        send('status', { status: 'starting', sessionId });

        // Create browser page
        await browserService.createPage(sessionId, { width: 1920, height: 1080 });
        send('status', { status: 'browser_ready' });

        // Start recording with Computer Use
        const generator = computerUseService.recordWorkflow({
          sessionId,
          projectId,
          startUrl,
          task,
          priority: priority || 'medium',
          brand: brandConfig || EMPLOYERS_BRAND,
          maxSteps: 50,
        });

        for await (const event of generator) {
          switch (event.type) {
            case 'step':
              send('step', event.data);
              break;

            case 'screenshot':
              send('screenshot', { screenshot: event.data.screenshot });
              break;

            case 'thinking':
              send('thinking', { text: event.data.text });
              break;

            case 'complete':
              send('complete', { workflow: event.data.workflow });
              break;

            case 'error':
              send('error', { error: event.data.error });
              break;
          }
        }

        send('status', { status: 'done' });

      } catch (error) {
        send('error', {
          error: error instanceof Error ? error.message : 'Recording failed',
        });
      } finally {
        // Cleanup
        try {
          await browserService.closePage(sessionId);
        } catch { }
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
