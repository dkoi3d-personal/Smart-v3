/**
 * React Hook for Multi-Project WebSocket Connection
 * Allows subscribing to events from multiple projects simultaneously
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AgentType, AgentStatus } from '@/lib/agents/types';

interface ProjectEvent {
  projectId: string;
  type: string;
  data: any;
  timestamp: Date;
}

interface UseMultiProjectWebSocketOptions {
  autoConnect?: boolean;
  projectIds?: string[];
}

interface UseMultiProjectWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  connect: () => void;
  disconnect: () => void;
  subscribeToProject: (projectId: string) => void;
  unsubscribeFromProject: (projectId: string) => void;
  subscribeToAll: () => void;
  emit: (event: string, data: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
  subscribedProjects: Set<string>;
}

// Singleton socket instance for multi-project support
let multiProjectSocket: Socket | null = null;
let multiProjectConnected = false;
let multiProjectConnecting = false;
const subscribedProjectIds = new Set<string>();
const multiProjectListeners = new Map<string, Set<Function>>();
const multiProjectConnectionCallbacks = new Set<(connected: boolean) => void>();

export function useMultiProjectWebSocket(
  options: UseMultiProjectWebSocketOptions = {}
): UseMultiProjectWebSocketReturn {
  const { autoConnect = true, projectIds = [] } = options;

  const [connected, setConnected] = useState(multiProjectConnected);
  const [subscribedProjects, setSubscribedProjects] = useState(new Set(subscribedProjectIds));

  // Register connection callback
  useEffect(() => {
    const callback = (connected: boolean) => setConnected(connected);
    multiProjectConnectionCallbacks.add(callback);
    return () => {
      multiProjectConnectionCallbacks.delete(callback);
    };
  }, []);

  // Sync subscribed projects
  useEffect(() => {
    setSubscribedProjects(new Set(subscribedProjectIds));
  }, [subscribedProjectIds.size]);

  const connect = useCallback(() => {
    if (multiProjectSocket?.connected || multiProjectConnecting) {
      return;
    }

    multiProjectConnecting = true;

    const url = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3000';
    const socket = io(url, {
      path: '/api/ws',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 10000,
    });

    socket.on('connect', () => {
      console.log('✅ Multi-project WebSocket connected:', socket.id);
      multiProjectConnected = true;
      multiProjectConnecting = false;

      // Notify all components
      multiProjectConnectionCallbacks.forEach((cb) => cb(true));

      // Re-subscribe to all projects
      subscribedProjectIds.forEach((projectId) => {
        socket.emit('join-project', projectId);
        console.log(`🔗 Re-joined project room: ${projectId}`);
      });
    });

    socket.on('disconnect', () => {
      console.log('❌ Multi-project WebSocket disconnected');
      multiProjectConnected = false;
      multiProjectConnecting = false;
      multiProjectConnectionCallbacks.forEach((cb) => cb(false));
    });

    socket.on('connect_error', (error) => {
      console.warn('Multi-project WebSocket connection failed:', error.message);
      multiProjectConnected = false;
      multiProjectConnecting = false;
      multiProjectConnectionCallbacks.forEach((cb) => cb(false));
    });

    // Re-attach all listeners
    multiProjectListeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        socket.on(event, handler as any);
      });
    });

    multiProjectSocket = socket;
  }, []);

  const disconnect = useCallback(() => {
    if (multiProjectSocket) {
      // Leave all project rooms
      subscribedProjectIds.forEach((projectId) => {
        multiProjectSocket!.emit('leave-project', projectId);
      });
      subscribedProjectIds.clear();

      multiProjectSocket.disconnect();
      multiProjectSocket = null;
      multiProjectConnected = false;
      multiProjectConnecting = false;

      multiProjectConnectionCallbacks.forEach((cb) => cb(false));
    }
  }, []);

  const subscribeToProject = useCallback((projectId: string) => {
    if (!subscribedProjectIds.has(projectId)) {
      subscribedProjectIds.add(projectId);
      setSubscribedProjects(new Set(subscribedProjectIds));

      if (multiProjectSocket?.connected) {
        multiProjectSocket.emit('join-project', projectId);
        console.log(`🔗 Joined project room: ${projectId}`);
      }
    }
  }, []);

  const unsubscribeFromProject = useCallback((projectId: string) => {
    if (subscribedProjectIds.has(projectId)) {
      subscribedProjectIds.delete(projectId);
      setSubscribedProjects(new Set(subscribedProjectIds));

      if (multiProjectSocket?.connected) {
        multiProjectSocket.emit('leave-project', projectId);
        console.log(`🔌 Left project room: ${projectId}`);
      }
    }
  }, []);

  const subscribeToAll = useCallback(async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const data = await response.json();
        const projects = data.projects || [];
        projects.forEach((project: any) => {
          subscribeToProject(project.projectId);
        });
      }
    } catch (error) {
      console.error('Failed to fetch projects for subscription:', error);
    }
  }, [subscribeToProject]);

  const emit = useCallback((event: string, data: any) => {
    if (multiProjectSocket?.connected) {
      multiProjectSocket.emit(event, data);
    } else {
      console.warn('Cannot emit: Multi-project WebSocket not connected');
    }
  }, []);

  const on = useCallback((event: string, handler: (data: any) => void) => {
    if (!multiProjectListeners.has(event)) {
      multiProjectListeners.set(event, new Set());
    }
    multiProjectListeners.get(event)!.add(handler);

    if (multiProjectSocket) {
      multiProjectSocket.on(event, handler);
    }
  }, []);

  const off = useCallback((event: string, handler: (data: any) => void) => {
    const handlers = multiProjectListeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        multiProjectListeners.delete(event);
      }
    }

    if (multiProjectSocket) {
      multiProjectSocket.off(event, handler);
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect && !multiProjectSocket) {
      connect();
    }
  }, [autoConnect, connect]);

  // Subscribe to initial project IDs
  useEffect(() => {
    projectIds.forEach((projectId) => {
      subscribeToProject(projectId);
    });
  }, [projectIds, subscribeToProject]);

  return {
    socket: multiProjectSocket,
    connected,
    connect,
    disconnect,
    subscribeToProject,
    unsubscribeFromProject,
    subscribeToAll,
    emit,
    on,
    off,
    subscribedProjects,
  };
}
