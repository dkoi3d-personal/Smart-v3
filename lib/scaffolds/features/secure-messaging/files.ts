/**
 * Secure Messaging Template - Files
 */

import { TemplateFile } from '../types';

export const secureMessagingFiles: TemplateFile[] = [
  // ============================================================
  // LIB - Messaging Types & Socket
  // ============================================================
  {
    path: 'lib/messaging/types.ts',
    type: 'lib',
    content: `/**
 * Messaging Types
 */

export type ParticipantRole = 'patient' | 'provider' | 'care_team' | 'admin';

export interface Participant {
  id: string;
  conversationId: string;
  userId: number;
  role: ParticipantRole;
  joinedAt: Date;
  user?: {
    id: number;
    name: string;
    email: string;
    avatar?: string;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: number;
  content: string;
  createdAt: Date;
  readAt?: Date;
  sender?: {
    id: number;
    name: string;
    avatar?: string;
  };
}

export interface Conversation {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  participants: Participant[];
  messages?: Message[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface TypingStatus {
  conversationId: string;
  userId: number;
  userName: string;
  isTyping: boolean;
}

export interface PresenceStatus {
  userId: number;
  isOnline: boolean;
  lastSeen?: Date;
}

// WebSocket Events
export interface MessageNewEvent {
  type: 'message:new';
  message: Message;
}

export interface MessageReadEvent {
  type: 'message:read';
  conversationId: string;
  messageIds: string[];
  readBy: number;
}

export interface TypingEvent {
  type: 'typing:start' | 'typing:stop';
  conversationId: string;
  userId: number;
  userName: string;
}

export interface PresenceEvent {
  type: 'presence:update';
  userId: number;
  isOnline: boolean;
}

export type SocketEvent = MessageNewEvent | MessageReadEvent | TypingEvent | PresenceEvent;
`,
  },
  {
    path: 'lib/messaging/socket.ts',
    type: 'lib',
    content: `/**
 * Messaging WebSocket Client
 */

import { io, Socket } from 'socket.io-client';
import { Message, TypingStatus, PresenceStatus, SocketEvent } from './types';

type MessageHandler = (message: Message) => void;
type TypingHandler = (status: TypingStatus) => void;
type PresenceHandler = (status: PresenceStatus) => void;
type ReadHandler = (data: { conversationId: string; messageIds: string[]; readBy: number }) => void;

class MessagingSocket {
  private socket: Socket | null = null;
  private messageHandlers: Set<MessageHandler> = new Set();
  private typingHandlers: Set<TypingHandler> = new Set();
  private presenceHandlers: Set<PresenceHandler> = new Set();
  private readHandlers: Set<ReadHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  /**
   * Connect to WebSocket server
   */
  connect(userId: number, authToken: string): void {
    if (this.socket?.connected) return;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';

    this.socket = io(socketUrl, {
      path: '/api/socket',
      auth: { token: authToken },
      query: { userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupEventListeners();
  }

  /**
   * Set up socket event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Messaging] Connected');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[Messaging] Disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      console.error('[Messaging] Connection error:', error);
      this.reconnectAttempts++;
    });

    // Message events
    this.socket.on('message:new', (message: Message) => {
      this.messageHandlers.forEach(handler => handler(message));
    });

    this.socket.on('message:read', (data: { conversationId: string; messageIds: string[]; readBy: number }) => {
      this.readHandlers.forEach(handler => handler(data));
    });

    // Typing events
    this.socket.on('typing:start', (data: { conversationId: string; userId: number; userName: string }) => {
      this.typingHandlers.forEach(handler =>
        handler({ ...data, isTyping: true })
      );
    });

    this.socket.on('typing:stop', (data: { conversationId: string; userId: number; userName: string }) => {
      this.typingHandlers.forEach(handler =>
        handler({ ...data, isTyping: false })
      );
    });

    // Presence events
    this.socket.on('presence:update', (data: PresenceStatus) => {
      this.presenceHandlers.forEach(handler => handler(data));
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Join a conversation room
   */
  joinConversation(conversationId: string): void {
    this.socket?.emit('conversation:join', { conversationId });
  }

  /**
   * Leave a conversation room
   */
  leaveConversation(conversationId: string): void {
    this.socket?.emit('conversation:leave', { conversationId });
  }

  /**
   * Send a message
   */
  sendMessage(conversationId: string, content: string): void {
    this.socket?.emit('message:send', { conversationId, content });
  }

  /**
   * Mark messages as read
   */
  markAsRead(conversationId: string, messageIds: string[]): void {
    this.socket?.emit('message:read', { conversationId, messageIds });
  }

  /**
   * Start typing indicator
   */
  startTyping(conversationId: string): void {
    this.socket?.emit('typing:start', { conversationId });
  }

  /**
   * Stop typing indicator
   */
  stopTyping(conversationId: string): void {
    this.socket?.emit('typing:stop', { conversationId });
  }

  /**
   * Subscribe to new messages
   */
  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  /**
   * Subscribe to typing status
   */
  onTyping(handler: TypingHandler): () => void {
    this.typingHandlers.add(handler);
    return () => this.typingHandlers.delete(handler);
  }

  /**
   * Subscribe to presence updates
   */
  onPresence(handler: PresenceHandler): () => void {
    this.presenceHandlers.add(handler);
    return () => this.presenceHandlers.delete(handler);
  }

  /**
   * Subscribe to read receipts
   */
  onRead(handler: ReadHandler): () => void {
    this.readHandlers.add(handler);
    return () => this.readHandlers.delete(handler);
  }

  /**
   * Check if connected
   */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

// Singleton instance
export const messagingSocket = new MessagingSocket();
`,
  },

  // ============================================================
  // API ROUTES
  // ============================================================
  {
    path: 'app/api/messages/route.ts',
    type: 'api',
    content: `/**
 * Conversations API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { auditLog } from '@/lib/audit/logger';

// GET - List user's conversations
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: { userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    // Add unread counts
    const conversationsWithUnread = await Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conv.id,
            senderId: { not: userId },
            readAt: null,
          },
        });
        return {
          ...conv,
          lastMessage: conv.messages[0] || null,
          unreadCount,
        };
      })
    );

    return NextResponse.json(conversationsWithUnread);
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    );
  }
}

// POST - Create new conversation
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { participantIds, initialMessage } = body;

    if (!participantIds?.length) {
      return NextResponse.json(
        { error: 'At least one participant required' },
        { status: 400 }
      );
    }

    // Create conversation with participants
    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId, role: 'patient' },
            ...participantIds.map((id: number) => ({
              userId: id,
              role: 'provider',
            })),
          ],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    // Add initial message if provided
    if (initialMessage) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: userId,
          content: initialMessage,
        },
      });
    }

    await auditLog({
      userId,
      userEmail: session.user.email || undefined,
      action: 'CREATE',
      resourceType: 'Conversation',
      resourceId: conversation.id,
      phiAccessed: true,
    });

    return NextResponse.json(conversation, { status: 201 });
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create conversation' },
      { status: 500 }
    );
  }
}
`,
  },
  {
    path: 'app/api/messages/[conversationId]/route.ts',
    type: 'api',
    content: `/**
 * Single Conversation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { auditLog } from '@/lib/audit/logger';

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

// GET - Fetch messages for conversation
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { conversationId } = await context.params;
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50');
    const before = searchParams.get('before');

    // Verify user is participant
    const participant = await prisma.participant.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        ...(before && { createdAt: { lt: new Date(before) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    await auditLog({
      userId,
      userEmail: session.user.email || undefined,
      action: 'VIEW',
      resourceType: 'Message',
      resourceId: conversationId,
      phiAccessed: true,
    });

    return NextResponse.json(messages.reverse());
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

// POST - Send message
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { conversationId } = await context.params;
    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: 'Message content required' },
        { status: 400 }
      );
    }

    // Verify user is participant
    const participant = await prisma.participant.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: content.trim(),
      },
      include: {
        sender: {
          select: { id: true, name: true },
        },
      },
    });

    // Update conversation timestamp
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    await auditLog({
      userId,
      userEmail: session.user.email || undefined,
      action: 'CREATE',
      resourceType: 'Message',
      resourceId: message.id,
      phiAccessed: true,
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    );
  }
}
`,
  },
  {
    path: 'app/api/messages/[conversationId]/read/route.ts',
    type: 'api',
    content: `/**
 * Mark Messages as Read API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

// PATCH - Mark messages as read
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const { conversationId } = await context.params;
    const body = await request.json();
    const { messageIds } = body;

    // Verify user is participant
    const participant = await prisma.participant.findFirst({
      where: { conversationId, userId },
    });

    if (!participant) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 });
    }

    // Mark messages as read (only messages not sent by user)
    const result = await prisma.message.updateMany({
      where: {
        id: { in: messageIds },
        conversationId,
        senderId: { not: userId },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return NextResponse.json({ updated: result.count });
  } catch (error) {
    console.error('[Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to mark as read' },
      { status: 500 }
    );
  }
}
`,
  },

  // ============================================================
  // HOOKS
  // ============================================================
  {
    path: 'hooks/useConversation.ts',
    type: 'hook',
    content: `/**
 * Conversation Hook - Real-time messaging
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { messagingSocket } from '@/lib/messaging/socket';
import { Message, TypingStatus } from '@/lib/messaging/types';

interface UseConversationOptions {
  conversationId: string;
  userId: number;
  authToken: string;
}

interface UseConversationResult {
  messages: Message[];
  loading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  markAsRead: (messageIds: string[]) => void;
  typingUsers: string[];
  startTyping: () => void;
  stopTyping: () => void;
  loadMore: () => Promise<void>;
  hasMore: boolean;
}

export function useConversation({
  conversationId,
  userId,
  authToken,
}: UseConversationOptions): UseConversationResult {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Connect to socket and join conversation
  useEffect(() => {
    messagingSocket.connect(userId, authToken);
    messagingSocket.joinConversation(conversationId);

    return () => {
      messagingSocket.leaveConversation(conversationId);
    };
  }, [conversationId, userId, authToken]);

  // Load initial messages
  useEffect(() => {
    async function loadMessages() {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(\`/api/messages/\${conversationId}\`);
        if (!response.ok) throw new Error('Failed to load messages');

        const data = await response.json();
        setMessages(data);
        setHasMore(data.length >= 50);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to load messages'));
      } finally {
        setLoading(false);
      }
    }

    loadMessages();
  }, [conversationId]);

  // Subscribe to new messages
  useEffect(() => {
    const unsubscribe = messagingSocket.onMessage((message) => {
      if (message.conversationId === conversationId) {
        setMessages((prev) => [...prev, message]);
      }
    });

    return unsubscribe;
  }, [conversationId]);

  // Subscribe to typing status
  useEffect(() => {
    const unsubscribe = messagingSocket.onTyping((status: TypingStatus) => {
      if (status.conversationId !== conversationId) return;
      if (status.userId === userId) return;

      setTypingUsers((prev) => {
        if (status.isTyping) {
          return prev.includes(status.userName) ? prev : [...prev, status.userName];
        } else {
          return prev.filter((name) => name !== status.userName);
        }
      });
    });

    return unsubscribe;
  }, [conversationId, userId]);

  // Subscribe to read receipts
  useEffect(() => {
    const unsubscribe = messagingSocket.onRead((data) => {
      if (data.conversationId !== conversationId) return;

      setMessages((prev) =>
        prev.map((msg) =>
          data.messageIds.includes(msg.id)
            ? { ...msg, readAt: new Date() }
            : msg
        )
      );
    });

    return unsubscribe;
  }, [conversationId]);

  // Send message
  const sendMessage = useCallback(async (content: string) => {
    try {
      const response = await fetch(\`/api/messages/\${conversationId}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      const message = await response.json();
      setMessages((prev) => [...prev, message]);

      // Also emit via socket for real-time delivery
      messagingSocket.sendMessage(conversationId, content);
    } catch (err) {
      throw err;
    }
  }, [conversationId]);

  // Mark as read
  const markAsRead = useCallback((messageIds: string[]) => {
    fetch(\`/api/messages/\${conversationId}/read\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageIds }),
    });

    messagingSocket.markAsRead(conversationId, messageIds);
  }, [conversationId]);

  // Typing indicators
  const startTyping = useCallback(() => {
    messagingSocket.startTyping(conversationId);

    // Auto-stop after 3 seconds
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      messagingSocket.stopTyping(conversationId);
    }, 3000);
  }, [conversationId]);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    messagingSocket.stopTyping(conversationId);
  }, [conversationId]);

  // Load more messages
  const loadMore = useCallback(async () => {
    if (!hasMore || messages.length === 0) return;

    const oldestMessage = messages[0];
    const response = await fetch(
      \`/api/messages/\${conversationId}?before=\${oldestMessage.createdAt}\`
    );

    if (response.ok) {
      const olderMessages = await response.json();
      setMessages((prev) => [...olderMessages, ...prev]);
      setHasMore(olderMessages.length >= 50);
    }
  }, [conversationId, messages, hasMore]);

  return {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    typingUsers,
    startTyping,
    stopTyping,
    loadMore,
    hasMore,
  };
}
`,
  },
  {
    path: 'hooks/useConversations.ts',
    type: 'hook',
    content: `/**
 * Conversations List Hook
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Conversation } from '@/lib/messaging/types';
import { messagingSocket } from '@/lib/messaging/socket';

interface UseConversationsResult {
  conversations: Conversation[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  createConversation: (participantIds: number[], initialMessage?: string) => Promise<Conversation>;
}

export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/messages');
      if (!response.ok) throw new Error('Failed to load conversations');

      const data = await response.json();
      setConversations(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load conversations'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Update conversation when new message arrives
  useEffect(() => {
    const unsubscribe = messagingSocket.onMessage((message) => {
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === message.conversationId
            ? {
                ...conv,
                lastMessage: message,
                updatedAt: new Date(),
                unreadCount: (conv.unreadCount || 0) + 1,
              }
            : conv
        ).sort((a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
      );
    });

    return unsubscribe;
  }, []);

  const createConversation = useCallback(async (
    participantIds: number[],
    initialMessage?: string
  ): Promise<Conversation> => {
    const response = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantIds, initialMessage }),
    });

    if (!response.ok) throw new Error('Failed to create conversation');

    const conversation = await response.json();
    setConversations((prev) => [conversation, ...prev]);
    return conversation;
  }, []);

  return {
    conversations,
    loading,
    error,
    refetch: fetchConversations,
    createConversation,
  };
}
`,
  },

  // ============================================================
  // COMPONENTS
  // ============================================================
  {
    path: 'components/messaging/ChatWindow.tsx',
    type: 'component',
    content: `/**
 * Chat Window Component
 */

'use client';

import { useRef, useEffect } from 'react';
import { Message } from '@/lib/messaging/types';
import { format } from 'date-fns';

interface ChatWindowProps {
  messages: Message[];
  currentUserId: number;
  loading?: boolean;
  typingUsers?: string[];
  onLoadMore?: () => void;
  hasMore?: boolean;
}

export function ChatWindow({
  messages,
  currentUserId,
  loading,
  typingUsers = [],
  onLoadMore,
  hasMore,
}: ChatWindowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // Infinite scroll for loading more
  const handleScroll = () => {
    if (!containerRef.current || !hasMore || loading) return;

    if (containerRef.current.scrollTop === 0) {
      onLoadMore?.();
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 space-y-4"
    >
      {hasMore && (
        <button
          onClick={onLoadMore}
          className="w-full text-center text-sm text-blue-600 hover:underline"
        >
          Load earlier messages
        </button>
      )}

      {messages.map((message, index) => {
        const isOwn = message.senderId === currentUserId;
        const showDate =
          index === 0 ||
          new Date(message.createdAt).toDateString() !==
            new Date(messages[index - 1].createdAt).toDateString();

        return (
          <div key={message.id}>
            {showDate && (
              <div className="text-center text-xs text-gray-500 my-4">
                {format(new Date(message.createdAt), 'MMMM d, yyyy')}
              </div>
            )}

            <div className={\`flex \${isOwn ? 'justify-end' : 'justify-start'}\`}>
              <div
                className={\`max-w-[70%] rounded-lg px-4 py-2 \${
                  isOwn
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900'
                }\`}
              >
                {!isOwn && message.sender && (
                  <p className="text-xs font-medium text-gray-500 mb-1">
                    {message.sender.name}
                  </p>
                )}
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <div className={\`flex items-center justify-end gap-1 mt-1 \${
                  isOwn ? 'text-blue-100' : 'text-gray-400'
                }\`}>
                  <span className="text-xs">
                    {format(new Date(message.createdAt), 'h:mm a')}
                  </span>
                  {isOwn && (
                    <span className="text-xs">
                      {message.readAt ? '✓✓' : '✓'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {typingUsers.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <div className="flex gap-1">
            <span className="animate-bounce">•</span>
            <span className="animate-bounce" style={{ animationDelay: '0.1s' }}>•</span>
            <span className="animate-bounce" style={{ animationDelay: '0.2s' }}>•</span>
          </div>
          <span>
            {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing
          </span>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
`,
  },
  {
    path: 'components/messaging/MessageInput.tsx',
    type: 'component',
    content: `/**
 * Message Input Component
 */

'use client';

import { useState, useRef, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (content: string) => Promise<void>;
  onTyping?: () => void;
  onStopTyping?: () => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({
  onSend,
  onTyping,
  onStopTyping,
  disabled,
  placeholder = 'Type a message...',
}: MessageInputProps) {
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!content.trim() || sending) return;

    setSending(true);
    try {
      await onSend(content.trim());
      setContent('');
      onStopTyping?.();
      textareaRef.current?.focus();
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleChange = (value: string) => {
    setContent(value);
    if (value.trim()) {
      onTyping?.();
    } else {
      onStopTyping?.();
    }
  };

  return (
    <div className="border-t bg-white p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          style={{ maxHeight: '120px' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = Math.min(target.scrollHeight, 120) + 'px';
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || sending || disabled}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            'Send'
          )}
        </button>
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'components/messaging/ConversationList.tsx',
    type: 'component',
    content: `/**
 * Conversation List Component
 */

'use client';

import { Conversation } from '@/lib/messaging/types';
import { formatDistanceToNow } from 'date-fns';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId?: string;
  onSelect: (conversation: Conversation) => void;
  currentUserId: number;
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  currentUserId,
}: ConversationListProps) {
  if (conversations.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        No conversations yet
      </div>
    );
  }

  return (
    <ul className="divide-y">
      {conversations.map((conversation) => {
        const isSelected = conversation.id === selectedId;
        const otherParticipants = conversation.participants
          .filter((p) => p.userId !== currentUserId)
          .map((p) => p.user?.name || 'Unknown')
          .join(', ');

        const lastMessage = conversation.lastMessage;
        const hasUnread = (conversation.unreadCount || 0) > 0;

        return (
          <li
            key={conversation.id}
            onClick={() => onSelect(conversation)}
            className={\`p-4 cursor-pointer hover:bg-gray-50 \${
              isSelected ? 'bg-blue-50' : ''
            }\`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className={\`font-medium truncate \${hasUnread ? 'text-black' : 'text-gray-700'}\`}>
                  {otherParticipants || 'New Conversation'}
                </p>
                {lastMessage && (
                  <p className={\`text-sm truncate mt-1 \${
                    hasUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
                  }\`}>
                    {lastMessage.senderId === currentUserId ? 'You: ' : ''}
                    {lastMessage.content}
                  </p>
                )}
              </div>
              <div className="ml-2 flex flex-col items-end">
                <span className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
                </span>
                {hasUnread && (
                  <span className="mt-1 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-blue-600 rounded-full">
                    {conversation.unreadCount}
                  </span>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
`,
  },
  {
    path: 'components/messaging/TypingIndicator.tsx',
    type: 'component',
    content: `/**
 * Typing Indicator Component
 */

'use client';

interface TypingIndicatorProps {
  users: string[];
}

export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const text = users.length === 1
    ? \`\${users[0]} is typing\`
    : users.length === 2
    ? \`\${users[0]} and \${users[1]} are typing\`
    : \`\${users[0]} and \${users.length - 1} others are typing\`;

  return (
    <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-500">
      <div className="flex gap-1">
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
        <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
      </div>
      <span>{text}</span>
    </div>
  );
}
`,
  },

  // ============================================================
  // PAGES
  // ============================================================
  {
    path: 'app/messages/page.tsx',
    type: 'page',
    content: `/**
 * Messages Page - Conversation List
 */

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useConversations } from '@/hooks/useConversations';
import { ConversationList } from '@/components/messaging/ConversationList';
import { Conversation } from '@/lib/messaging/types';

export default function MessagesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { conversations, loading, error } = useConversations();
  const [showNewChat, setShowNewChat] = useState(false);

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view messages</p>
      </div>
    );
  }

  const userId = parseInt(session.user.id);

  const handleSelect = (conversation: Conversation) => {
    router.push(\`/messages/\${conversation.id}\`);
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
        <button
          onClick={() => setShowNewChat(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Message
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="text-red-600 p-4 bg-red-50 rounded">
          Failed to load conversations
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <ConversationList
            conversations={conversations}
            onSelect={handleSelect}
            currentUserId={userId}
          />
        </div>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'app/messages/[conversationId]/page.tsx',
    type: 'page',
    content: `/**
 * Conversation Page - Chat View
 */

'use client';

import { use } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useConversation } from '@/hooks/useConversation';
import { ChatWindow } from '@/components/messaging/ChatWindow';
import { MessageInput } from '@/components/messaging/MessageInput';

interface ConversationPageProps {
  params: Promise<{ conversationId: string }>;
}

export default function ConversationPage({ params }: ConversationPageProps) {
  const { conversationId } = use(params);
  const { data: session } = useSession();

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Please sign in to view messages</p>
      </div>
    );
  }

  const userId = parseInt(session.user.id);
  // In production, get auth token from session
  const authToken = 'demo-token';

  const {
    messages,
    loading,
    error,
    sendMessage,
    markAsRead,
    typingUsers,
    startTyping,
    stopTyping,
    loadMore,
    hasMore,
  } = useConversation({ conversationId, userId, authToken });

  // Mark messages as read when viewing
  const unreadMessages = messages
    .filter((m) => m.senderId !== userId && !m.readAt)
    .map((m) => m.id);

  if (unreadMessages.length > 0) {
    markAsRead(unreadMessages);
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 p-4 bg-red-50 rounded">
          Failed to load conversation
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-white px-4 py-3 flex items-center gap-4">
        <Link
          href="/messages"
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back
        </Link>
        <h1 className="font-semibold">Conversation</h1>
      </div>

      {/* Chat Window */}
      <ChatWindow
        messages={messages}
        currentUserId={userId}
        loading={loading}
        typingUsers={typingUsers}
        onLoadMore={loadMore}
        hasMore={hasMore}
      />

      {/* Message Input */}
      <MessageInput
        onSend={sendMessage}
        onTyping={startTyping}
        onStopTyping={stopTyping}
      />
    </div>
  );
}
`,
  },
];
