/**
 * SSE Stream Sync Hook
 *
 * Connects to SSE endpoint and syncs events to the Zustand store.
 * Use this when connecting via /api/v2/stream endpoint.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useBuildPageStore } from '../stores/useBuildPageStore';
import type { Task, AgentMessage, FileChange, Epic } from '../types';

interface UseSSESyncOptions {
  projectId: string;
  autoConnect?: boolean;
}

interface UseSSESyncReturn {
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

/**
 * Hook to connect to SSE stream and sync to Zustand store
 */
export function useSSESync({ projectId, autoConnect = false }: UseSSESyncOptions): UseSSESyncReturn {
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get store actions
  const {
    setTasks,
    addTask,
    updateTask,
    setEpics,
    addEpic,
    addAgentMessage,
    addFileChange,
    updateAgentStatus,
    setPhase,
    setConnectionStatus,
    setLastHeartbeat,
    setIsStreaming,
    setError,
    setFoundationComplete,
    updateTestingMetrics,
    updateBuildMetrics,
  } = useBuildPageStore();

  const handleEvent = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data);
      const eventType = (event as any).type || 'message';

      // Update heartbeat on any event
      setLastHeartbeat(Date.now());

      switch (eventType) {
        // -----------------------------------------------------------------------
        // Task Events
        // -----------------------------------------------------------------------
        case 'task:created':
        case 'story:created':
          addTask(normalizeTask(data));
          break;

        case 'task:updated':
        case 'story:updated':
          updateTask(data.id || data.taskId || data.storyId, normalizeTaskUpdate(data));
          break;

        case 'tasks:loaded':
        case 'stories:loaded':
          if (Array.isArray(data.tasks || data.stories)) {
            setTasks((data.tasks || data.stories).map(normalizeTask));
          }
          break;

        // -----------------------------------------------------------------------
        // Epic Events
        // -----------------------------------------------------------------------
        case 'epic:created':
          addEpic(normalizeEpic(data));
          break;

        case 'epics:loaded':
          if (Array.isArray(data.epics)) {
            setEpics(data.epics.map(normalizeEpic));
          }
          break;

        // -----------------------------------------------------------------------
        // Agent Events
        // -----------------------------------------------------------------------
        case 'agent:message':
          addAgentMessage(normalizeAgentMessage(data));
          break;

        case 'agent:status':
          updateAgentStatus(data.agentId, data.status);
          if (data.status === 'working' || data.status === 'thinking') {
            setIsStreaming(true);
          }
          break;

        case 'agent:complete':
          updateAgentStatus(data.agentId, 'completed');
          break;

        // -----------------------------------------------------------------------
        // File Events
        // -----------------------------------------------------------------------
        case 'file:created':
        case 'file:modified':
        case 'file:deleted':
          addFileChange({
            path: data.path || data.file,
            action: eventType === 'file:created' ? 'write' : eventType === 'file:modified' ? 'edit' : 'delete',
            timestamp: new Date(),
          });
          break;

        // -----------------------------------------------------------------------
        // Phase/Status Events
        // -----------------------------------------------------------------------
        case 'phase:changed':
          setPhase(data.phase);
          break;

        case 'workflow:started':
          setPhase('building');
          setIsStreaming(true);
          break;

        case 'workflow:complete':
        case 'workflow:completed':
          setPhase('completed');
          setIsStreaming(false);
          break;

        case 'workflow:error':
          setPhase('error');
          setError(data.error || data.message);
          setIsStreaming(false);
          break;

        case 'foundation:complete':
          setFoundationComplete(true);
          break;

        // -----------------------------------------------------------------------
        // Metrics Events
        // -----------------------------------------------------------------------
        case 'test:result':
        case 'testing:update':
          updateTestingMetrics({
            totalTests: data.total || data.totalTests,
            passed: data.passed,
            failed: data.failed,
            coverage: data.coverage,
          });
          break;

        case 'build:metrics':
          updateBuildMetrics(data);
          break;

        // -----------------------------------------------------------------------
        // Connection Events
        // -----------------------------------------------------------------------
        case 'heartbeat':
        case 'ping':
          setLastHeartbeat(Date.now());
          break;

        case 'connected':
          setConnectionStatus('connected');
          break;

        // -----------------------------------------------------------------------
        // Default: Try to handle as generic message
        // -----------------------------------------------------------------------
        default:
          // If data has content, treat as agent message
          if (data.content && (data.agentId || data.agentType)) {
            addAgentMessage(normalizeAgentMessage(data));
          }
          // If data has tasks array, update tasks
          else if (data.tasks && Array.isArray(data.tasks)) {
            setTasks(data.tasks.map(normalizeTask));
          }
          break;
      }
    } catch (err) {
      console.warn('[SSESync] Failed to parse event:', err);
    }
  }, [addTask, updateTask, setTasks, addEpic, setEpics, addAgentMessage, updateAgentStatus, addFileChange, setPhase, setIsStreaming, setError, setConnectionStatus, setLastHeartbeat, setFoundationComplete, updateTestingMetrics, updateBuildMetrics]);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const url = `/api/v2/stream?projectId=${projectId}`;
    const eventSource = new EventSource(url);

    eventSource.onopen = () => {
      console.log('[SSESync] Connected to stream');
      setConnectionStatus('connected');
      setLastHeartbeat(Date.now());
    };

    eventSource.onmessage = handleEvent;

    // Listen for specific event types
    const eventTypes = [
      'task:created', 'task:updated', 'tasks:loaded',
      'story:created', 'story:updated', 'stories:loaded',
      'epic:created', 'epics:loaded',
      'agent:message', 'agent:status', 'agent:complete',
      'file:created', 'file:modified', 'file:deleted',
      'phase:changed', 'workflow:started', 'workflow:complete', 'workflow:error',
      'foundation:complete',
      'test:result', 'testing:update', 'build:metrics',
      'heartbeat', 'ping', 'connected',
    ];

    eventTypes.forEach((type) => {
      eventSource.addEventListener(type, handleEvent);
    });

    eventSource.onerror = (err) => {
      console.warn('[SSESync] Connection error, will retry...');
      setConnectionStatus('reconnecting');

      // Auto-reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        if (eventSourceRef.current === eventSource) {
          connect();
        }
      }, 3000);
    };

    eventSourceRef.current = eventSource;
  }, [projectId, handleEvent, setConnectionStatus, setLastHeartbeat]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, [setConnectionStatus]);

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && projectId) {
      connect();
    }
    return () => {
      disconnect();
    };
  }, [autoConnect, projectId, connect, disconnect]);

  return {
    connect,
    disconnect,
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  };
}

// -------------------------------------------------------------------------
// Normalizers
// -------------------------------------------------------------------------

function normalizeTask(data: any): Task {
  return {
    id: data.id || data.taskId || data.storyId,
    title: data.title || data.name || '',
    description: data.description || '',
    status: normalizeStatus(data.status),
    priority: data.priority || 'medium',
    epicId: data.epicId || '',
    storyPoints: data.storyPoints || data.story_points || 0,
    assignedTo: data.assignedTo || data.assigned_to,
    result: data.result,
    acceptanceCriteria: data.acceptanceCriteria || data.acceptance_criteria,
  };
}

function normalizeTaskUpdate(data: any): Partial<Task> {
  const update: Partial<Task> = {};
  if (data.status) update.status = normalizeStatus(data.status);
  if (data.assignedTo || data.assigned_to) update.assignedTo = data.assignedTo || data.assigned_to;
  if (data.result) update.result = data.result;
  if (data.title) update.title = data.title;
  if (data.description) update.description = data.description;
  return update;
}

function normalizeStatus(status: string): Task['status'] {
  const map: Record<string, Task['status']> = {
    pending: 'backlog',
    backlog: 'backlog',
    in_progress: 'in_progress',
    inprogress: 'in_progress',
    testing: 'testing',
    done: 'done',
    completed: 'done',
    failed: 'failed',
  };
  return map[status?.toLowerCase()] || 'backlog';
}

function normalizeEpic(data: any): Epic {
  return {
    id: data.id || data.epicId,
    title: data.title || data.name || '',
    description: data.description || '',
    priority: data.priority || 'medium',
    status: data.status === 'completed' ? 'completed' : data.status === 'in_progress' ? 'in_progress' : 'pending',
    stories: data.stories || [],
  };
}

function normalizeAgentMessage(data: any): AgentMessage {
  return {
    id: data.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    agentRole: (data.agentType || data.agent_type || data.agentRole || 'coordinator') as any,
    agentName: data.agentName || getAgentName(data.agentType || data.agentRole),
    type: data.type === 'error' ? 'error' : 'chat',
    content: data.content || data.message || '',
    timestamp: data.timestamp ? new Date(data.timestamp).toISOString() : new Date().toISOString(),
    storyId: data.storyId || data.story_id,
  };
}

function getAgentName(agentType: string): string {
  const names: Record<string, string> = {
    product_owner: 'Product Owner',
    coder: 'Coder',
    tester: 'Tester',
    security: 'Security',
    coordinator: 'Coordinator',
    supervisor: 'Supervisor',
  };
  return names[agentType] || agentType || 'Agent';
}
