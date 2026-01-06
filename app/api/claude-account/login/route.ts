/**
 * Claude Account Login API (Streaming)
 *
 * POST - Start login process, streams progress back
 * Supports: login, switch (logout + login)
 */

import { NextRequest } from 'next/server';
import { claudeAccountService } from '@/services/claude-account-service';

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  // Check if this is a switch account request via URL param or body
  let isSwitch = false;

  // First check URL param
  const url = new URL(request.url);
  if (url.searchParams.get('action') === 'switch') {
    isSwitch = true;
  }

  // Then try body
  if (!isSwitch) {
    try {
      const text = await request.text();
      if (text) {
        const body = JSON.parse(text);
        isSwitch = body.action === 'switch';
      }
    } catch {
      // No body or invalid JSON, default to regular login
    }
  }

  console.log('[Claude Login API] isSwitch:', isSwitch);

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: any) => {
        console.log('[Claude Login API] Sending:', data.type, data.message?.slice(0, 50));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // Send immediate acknowledgment
        sendEvent({
          type: 'info',
          message: isSwitch ? 'Starting account switch...' : 'Starting login...',
        });

        // Use switchAccount or regular login based on request
        const loginFlow = isSwitch
          ? claudeAccountService.switchAccount()
          : claudeAccountService.login();

        for await (const progress of loginFlow) {
          sendEvent(progress);

          // If we got a URL, give some extra time for user to complete login
          if (progress.type === 'url') {
            sendEvent({
              type: 'info',
              message: 'Waiting for you to complete login in browser...',
            });
          }
        }

        // Final status check
        const status = await claudeAccountService.getStatus();
        sendEvent({
          type: status.isLoggedIn ? 'success' : 'error',
          message: status.isLoggedIn
            ? `Logged in as ${status.email || 'Claude user'}`
            : 'Login may have failed. Please check and try again.',
          status,
        });
      } catch (error: any) {
        sendEvent({
          type: 'error',
          message: error.message || 'Login failed',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
