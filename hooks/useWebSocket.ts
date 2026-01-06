/**
 * React Hook for WebSocket Connection - Singleton Pattern
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { WSEvent, WSEventType } from '@/lib/websocket/events';

interface UseWebSocketOptions {
  projectId?: string;
  autoConnect?: boolean;
}

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
}

// Singleton socket instance shared across all hook instances
let globalSocket: Socket | null = null;
let globalConnected = false;
let isConnecting = false;
let currentProjectId: string | null = null;
const globalListeners = new Map<string, Set<Function>>();
const connectionCallbacks = new Set<(connected: boolean) => void>();

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
  const { projectId, autoConnect = true } = options;

  const [connected, setConnected] = useState(globalConnected);
  const projectIdRef = useRef(projectId);

  // Update projectId ref when it changes
  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // Register/unregister connection callback
  useEffect(() => {
    const callback = (connected: boolean) => setConnected(connected);
    connectionCallbacks.add(callback);
    return () => {
      connectionCallbacks.delete(callback);
    };
  }, []);

  const connect = useCallback(() => {
    // Prevent multiple concurrent connection attempts
    if (globalSocket?.connected || isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    isConnecting = true;

    const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const socket = io(url, {
      path: '/api/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 3,
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket.id);
      globalConnected = true;
      isConnecting = false;

      // Notify all components
      connectionCallbacks.forEach(cb => cb(true));

      // Join project room if specified and not already in one
      if (projectIdRef.current && projectIdRef.current !== currentProjectId) {
        console.log(`Joining project room on connect: ${projectIdRef.current}`);
        socket.emit('join-project', projectIdRef.current);
        currentProjectId = projectIdRef.current;
      }
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      globalConnected = false;
      isConnecting = false;

      // Notify all components
      connectionCallbacks.forEach(cb => cb(false));
    });

    socket.on('connect_error', (error) => {
      console.warn('WebSocket connection failed');
      globalConnected = false;
      isConnecting = false;

      // Notify all components
      connectionCallbacks.forEach(cb => cb(false));
    });

    // Re-attach all listeners
    globalListeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        socket.on(event, handler as any);
      });
    });

    globalSocket = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (globalSocket) {
      if (projectIdRef.current) {
        globalSocket.emit('leave-project', projectIdRef.current);
      }
      globalSocket.disconnect();
      globalSocket = null;
      globalConnected = false;
      isConnecting = false;

      // Notify all components
      connectionCallbacks.forEach(cb => cb(false));
    }
  }, []);

  const emit = useCallback((event: string, data: any) => {
    if (globalSocket?.connected) {
      globalSocket.emit(event, data);
    } else {
      console.warn('Cannot emit: WebSocket not connected');
    }
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    // Store handler reference
    if (!globalListeners.has(event)) {
      globalListeners.set(event, new Set());
    }
    globalListeners.get(event)!.add(handler);

    // Attach to socket if connected
    if (globalSocket) {
      globalSocket.on(event, handler);
    }
  }, []);

  const off = useCallback((event: string, handler: (data: any) => void) => {
    // Remove handler reference
    const handlers = globalListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        globalListeners.delete(event);
      }
    }

    // Detach from socket if connected
    if (globalSocket) {
      globalSocket.off(event, handler);
    }
  }, []);

  // Auto-connect on mount if enabled (only if not already connected)
  useEffect(() => {
    if (autoConnect && !globalSocket) {
      connect();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoConnect]);

  // Handle project changes - only join room if it's different from current
  useEffect(() => {
    if (globalSocket?.connected && projectId && projectId !== currentProjectId) {
      // Leave old room if exists
      if (currentProjectId) {
        console.log(`Leaving project room: ${currentProjectId}`);
        globalSocket.emit('leave-project', currentProjectId);
      }

      // Join new room
      console.log(`Joining project room: ${projectId}`);
      globalSocket.emit('join-project', projectId);
      currentProjectId = projectId;
    }
  }, [projectId]);

  return {
    socket: globalSocket,
    connected,
    connect,
    disconnect,
    emit,
    on,
    off,
  };
}
