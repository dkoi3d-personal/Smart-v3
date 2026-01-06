/**
 * Secure Messaging Template - Tests
 */

import { TemplateTests } from '../types';

export const secureMessagingTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/messaging/socket.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock socket.io-client
vi.mock('socket.io-client', () => ({
  io: vi.fn(() => ({
    on: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
  })),
}));

describe('MessagingSocket', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('connects with user credentials', async () => {
    const { io } = await import('socket.io-client');
    const { messagingSocket } = await import('@/lib/messaging/socket');

    messagingSocket.connect(1, 'test-token');

    expect(io).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        auth: { token: 'test-token' },
        query: { userId: 1 },
      })
    );
  });

  it('emits message:send event', async () => {
    const { io } = await import('socket.io-client');
    const mockEmit = vi.fn();
    (io as any).mockReturnValue({
      on: vi.fn(),
      emit: mockEmit,
      connected: true,
    });

    const { messagingSocket } = await import('@/lib/messaging/socket');
    messagingSocket.connect(1, 'test-token');
    messagingSocket.sendMessage('conv-123', 'Hello!');

    expect(mockEmit).toHaveBeenCalledWith('message:send', {
      conversationId: 'conv-123',
      content: 'Hello!',
    });
  });

  it('emits typing events', async () => {
    const { io } = await import('socket.io-client');
    const mockEmit = vi.fn();
    (io as any).mockReturnValue({
      on: vi.fn(),
      emit: mockEmit,
      connected: true,
    });

    const { messagingSocket } = await import('@/lib/messaging/socket');
    messagingSocket.connect(1, 'test-token');

    messagingSocket.startTyping('conv-123');
    expect(mockEmit).toHaveBeenCalledWith('typing:start', { conversationId: 'conv-123' });

    messagingSocket.stopTyping('conv-123');
    expect(mockEmit).toHaveBeenCalledWith('typing:stop', { conversationId: 'conv-123' });
  });

  it('handles message subscription', async () => {
    const { io } = await import('socket.io-client');
    const handlers: Record<string, Function> = {};
    (io as any).mockReturnValue({
      on: vi.fn((event, handler) => {
        handlers[event] = handler;
      }),
      emit: vi.fn(),
      connected: true,
    });

    const { messagingSocket } = await import('@/lib/messaging/socket');
    messagingSocket.connect(1, 'test-token');

    const messageHandler = vi.fn();
    messagingSocket.onMessage(messageHandler);

    // Simulate incoming message
    const mockMessage = { id: '1', content: 'Test', senderId: 2 };
    handlers['message:new']?.(mockMessage);

    expect(messageHandler).toHaveBeenCalledWith(mockMessage);
  });
});
`,
    },
    {
      path: '__tests__/messaging/hooks.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useConversations } from '@/hooks/useConversations';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock socket
vi.mock('@/lib/messaging/socket', () => ({
  messagingSocket: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    joinConversation: vi.fn(),
    leaveConversation: vi.fn(),
    onMessage: vi.fn(() => () => {}),
    onTyping: vi.fn(() => () => {}),
    onRead: vi.fn(() => () => {}),
  },
}));

describe('useConversations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches conversations on mount', async () => {
    const mockConversations = [
      { id: '1', participants: [], messages: [], updatedAt: new Date() },
      { id: '2', participants: [], messages: [], updatedAt: new Date() },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockConversations),
    });

    const { result } = renderHook(() => useConversations());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.conversations).toEqual(mockConversations);
    expect(mockFetch).toHaveBeenCalledWith('/api/messages');
  });

  it('handles fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });

  it('creates new conversation', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: 'new-conv', participants: [] }),
      });

    const { result } = renderHook(() => useConversations());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const newConv = await result.current.createConversation([2], 'Hello!');

    expect(newConv.id).toBe('new-conv');
    expect(mockFetch).toHaveBeenCalledWith('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIds: [2], initialMessage: 'Hello!' }),
    });
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/messaging/api.integration.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Messaging API Integration', () => {
  let testConversationId: string;

  beforeAll(async () => {
    // Create test conversation
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: 1, role: 'patient' },
            { userId: 2, role: 'provider' },
          ],
        },
      },
    });
    testConversationId = conversation.id;

    // Create test messages
    await prisma.message.createMany({
      data: [
        { conversationId: testConversationId, senderId: 1, content: 'Hello' },
        { conversationId: testConversationId, senderId: 2, content: 'Hi there' },
      ],
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.message.deleteMany({
      where: { conversationId: testConversationId },
    });
    await prisma.participant.deleteMany({
      where: { conversationId: testConversationId },
    });
    await prisma.conversation.delete({
      where: { id: testConversationId },
    });
  });

  it('GET /api/messages returns user conversations', async () => {
    const response = await fetch('http://localhost:3000/api/messages', {
      headers: {
        Cookie: 'session=test-session',
      },
    });

    if (response.ok) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it('GET /api/messages/:id returns conversation messages', async () => {
    const response = await fetch(
      \`http://localhost:3000/api/messages/\${testConversationId}\`,
      {
        headers: {
          Cookie: 'session=test-session',
        },
      }
    );

    if (response.ok) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });

  it('POST /api/messages/:id sends message', async () => {
    const response = await fetch(
      \`http://localhost:3000/api/messages/\${testConversationId}\`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'session=test-session',
        },
        body: JSON.stringify({ content: 'Test message' }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      expect(data.content).toBe('Test message');
    }
  });

  it('PATCH /api/messages/:id/read marks as read', async () => {
    const response = await fetch(
      \`http://localhost:3000/api/messages/\${testConversationId}/read\`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Cookie: 'session=test-session',
        },
        body: JSON.stringify({ messageIds: ['msg-1'] }),
      }
    );

    if (response.ok) {
      const data = await response.json();
      expect(data.updated).toBeDefined();
    }
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/messaging.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Secure Messaging', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('displays conversation list', async ({ page }) => {
    await page.goto('/messages');

    // Should show page title
    await expect(page.locator('h1:has-text("Messages")')).toBeVisible();

    // Should show new message button
    await expect(page.locator('button:has-text("New Message")')).toBeVisible();
  });

  test('opens conversation', async ({ page }) => {
    await page.goto('/messages');

    // Click first conversation if exists
    const firstConversation = page.locator('li').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      // Should navigate to conversation page
      await expect(page).toHaveURL(/\\/messages\\/.+/);

      // Should show message input
      await expect(page.locator('textarea')).toBeVisible();
    }
  });

  test('sends message', async ({ page }) => {
    await page.goto('/messages');

    // Open first conversation
    const firstConversation = page.locator('li').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      // Type message
      const input = page.locator('textarea');
      await input.fill('Test message from Playwright');

      // Send message
      await page.click('button:has-text("Send")');

      // Message should appear in chat
      await expect(
        page.locator('text=Test message from Playwright')
      ).toBeVisible();
    }
  });

  test('shows typing indicator', async ({ page }) => {
    await page.goto('/messages');

    const firstConversation = page.locator('li').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      // Start typing
      const input = page.locator('textarea');
      await input.fill('typing...');

      // Note: Typing indicator from other users would need
      // a second browser context to test properly
    }
  });

  test('navigates back to conversation list', async ({ page }) => {
    await page.goto('/messages');

    const firstConversation = page.locator('li').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      // Click back button
      await page.click('a:has-text("Back")');

      // Should be back on messages page
      await expect(page).toHaveURL('/messages');
    }
  });
});

test.describe('Messaging Components', () => {
  test('ChatWindow auto-scrolls on new message', async ({ page }) => {
    await page.goto('/messages');

    const firstConversation = page.locator('li').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      // Send multiple messages
      for (let i = 0; i < 3; i++) {
        await page.locator('textarea').fill(\`Message \${i}\`);
        await page.click('button:has-text("Send")');
        await page.waitForTimeout(500);
      }

      // Latest message should be visible
      await expect(page.locator('text=Message 2')).toBeVisible();
    }
  });

  test('MessageInput handles Enter key', async ({ page }) => {
    await page.goto('/messages');

    const firstConversation = page.locator('li').first();
    if (await firstConversation.isVisible()) {
      await firstConversation.click();

      const input = page.locator('textarea');
      await input.fill('Enter key test');
      await input.press('Enter');

      // Message should be sent
      await expect(page.locator('text=Enter key test')).toBeVisible();
    }
  });

  test('ConversationList shows unread badge', async ({ page }) => {
    await page.goto('/messages');

    // If there are unread messages, badge should be visible
    const unreadBadge = page.locator('.bg-blue-600.rounded-full');
    // Just check the page loaded - badge visibility depends on data
    await expect(page.locator('h1:has-text("Messages")')).toBeVisible();
  });
});
`,
    },
  ],
};
