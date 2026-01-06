'use client';

import { useCallback, useRef } from 'react';
import type {
  AgentMessage,
  Task,
  Epic,
  BuildLog,
  FileChange,
  TestingMetrics,
  SecurityMetrics,
  DoraMetrics,
  BuildMetrics,
} from '../types';
import { DEFAULT_TESTING_METRICS, MAX_RECONNECT_ATTEMPTS } from '../constants';

export interface UseBuildStreamOptions {
  projectId: string;
  useMultiAgent?: boolean;
  parallelCoders?: number;
  batchMode?: boolean;
  batchSize?: number;
  requirements?: string;
  onPhaseChange?: (phase: string) => void;
  onStreamingChange?: (isStreaming: boolean) => void;
  onConnectionStatusChange?: (status: 'connected' | 'disconnected' | 'reconnecting') => void;
  onError?: (error: string | null) => void;
  onAgentMessagesChange?: (updater: (prev: AgentMessage[]) => AgentMessage[]) => void;
  onAgentStatusesChange?: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  onBuildLogsChange?: (updater: (prev: BuildLog[]) => BuildLog[]) => void;
  onFileChangesChange?: (updater: (prev: FileChange[]) => FileChange[]) => void;
  onTasksChange?: (updater: (prev: Task[]) => Task[]) => void;
  onEpicsChange?: (updater: (prev: Epic[]) => Epic[]) => void;
  onFileContentsChange?: (updater: (prev: Map<string, string>) => Map<string, string>) => void;
  onTestingMetricsChange?: (updater: (prev: TestingMetrics) => TestingMetrics) => void;
  onSecurityMetricsChange?: (updater: (prev: SecurityMetrics) => SecurityMetrics) => void;
  onDoraMetricsChange?: (updater: (prev: DoraMetrics) => DoraMetrics) => void;
  onBuildMetricsChange?: (updater: (prev: BuildMetrics) => BuildMetrics) => void;
  onFoundationComplete?: () => void;
  onPreviewKeyChange?: () => void;
  fetchFiles?: () => void;
}

export interface UseBuildStreamReturn {
  startBuild: () => Promise<void>;
  stopBuild: () => Promise<void>;
  abortControllerRef: React.MutableRefObject<AbortController | null>;
}

export function useBuildStream({
  projectId,
  useMultiAgent = true,
  parallelCoders = 1,
  batchMode = false,
  batchSize = 3,
  requirements = '',
  onPhaseChange,
  onStreamingChange,
  onConnectionStatusChange,
  onError,
  onAgentMessagesChange,
  onAgentStatusesChange,
  onBuildLogsChange,
  onFileChangesChange,
  onTasksChange,
  onEpicsChange,
  onFileContentsChange,
  onTestingMetricsChange,
  onSecurityMetricsChange,
  onDoraMetricsChange,
  onBuildMetricsChange,
  onFoundationComplete,
  onPreviewKeyChange,
  fetchFiles,
}: UseBuildStreamOptions): UseBuildStreamReturn {
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdCounter = useRef(0);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isStreamingRef = useRef(false);

  const generateMessageId = useCallback(() => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}-${Math.random().toString(36).substring(2, 9)}`;
  }, []);

  const addBuildLog = useCallback((type: BuildLog['type'], message: string, detail?: string) => {
    onBuildLogsChange?.(prev => [
      ...prev,
      {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        message,
        detail,
        timestamp: new Date(),
      },
    ]);
  }, [onBuildLogsChange]);

  const handleStreamEvent = useCallback((eventType: string, data: any) => {
    switch (eventType) {
      case 'agent:message':
        onAgentMessagesChange?.(prev => {
          const existingIndex = prev.findIndex(m => m.id === data.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              content: data.content,
              timestamp: data.timestamp || new Date().toISOString(),
            };
            return updated;
          }
          return [...prev, {
            id: data.id || generateMessageId(),
            agentRole: data.agentRole,
            agentName: data.agentName,
            type: data.type,
            content: data.content,
            toolName: data.toolName,
            timestamp: data.timestamp || new Date().toISOString(),
            instanceNumber: data.instanceNumber,
          }];
        });
        break;

      case 'agent:status':
        onAgentStatusesChange?.(prev => {
          const updated = new Map(prev);
          updated.set(data.role, data.status);
          if (data.agentId && data.agentId !== data.role) {
            updated.set(data.agentId, data.status);
          }
          return updated;
        });
        if (data.status === 'working') {
          const agentLabel = data.agentId && data.agentId !== data.role ? data.agentId : data.role;
          addBuildLog('info', `Agent started: ${agentLabel}`);
        } else if (data.status === 'done' || data.status === 'completed') {
          const agentLabel = data.agentId && data.agentId !== data.role ? data.agentId : data.role;
          addBuildLog('success', `Agent finished: ${agentLabel}`);
        }
        break;

      case 'file:changed':
        onFileChangesChange?.(prev => [...prev, { path: data.path, action: data.action, timestamp: new Date() }]);
        addBuildLog('file', `${data.action === 'write' ? 'Created' : data.action === 'edit' ? 'Modified' : data.action} file`, data.path);
        if (data.content && data.path) {
          onFileContentsChange?.(prev => {
            const next = new Map(prev);
            next.set(data.path, data.content);
            return next;
          });
          if (data.path === 'index.html' || data.path.endsWith('/index.html')) {
            onPreviewKeyChange?.();
          }
        }
        fetchFiles?.();
        break;

      case 'command:start':
        addBuildLog('command', 'Running command', data.command);
        break;

      case 'command:complete':
        addBuildLog('success', 'Command completed', data.output?.substring(0, 200));
        break;

      case 'command:error':
        addBuildLog('error', 'Command failed', data.error);
        break;

      case 'task:created':
        onTasksChange?.(prev => {
          if (prev.some(t => t.id === data.id)) return prev;
          return [...prev, { ...data, status: data.status || 'backlog' }];
        });
        addBuildLog('info', 'Task created', data.title);
        break;

      case 'task:updated':
        onTasksChange?.(prev => {
          const found = prev.find(t => t.id === data.id);
          if (!found) return prev;
          return prev.map(t => {
            if (t.id !== data.id) return t;
            return { ...t, ...data, epicId: data.epicId ?? t.epicId };
          });
        });
        if (data.status === 'completed' || data.status === 'done') {
          addBuildLog('success', 'Task completed', data.title);
        }
        break;

      case 'epic:created':
        onEpicsChange?.(prev => {
          if (prev.some(e => e.id === data.id)) return prev;
          return [...prev, {
            ...data,
            status: data.status || 'pending',
            stories: data.stories || [],
            priority: data.priority || 'medium',
          }];
        });
        break;

      case 'story:created':
        onTasksChange?.(prev => {
          if (prev.some(t => t.id === data.id)) return prev;
          return [...prev, {
            id: data.id,
            title: data.title,
            description: data.description,
            status: 'backlog',
            priority: data.priority,
            storyPoints: data.storyPoints,
            epicId: data.epicId,
            acceptanceCriteria: data.acceptanceCriteria,
          }];
        });
        if (data.epicId) {
          onEpicsChange?.(prev => prev.map(e =>
            e.id === data.epicId
              ? { ...e, stories: [...e.stories, data.id] }
              : e
          ));
        }
        break;

      case 'foundation:complete':
        onFoundationComplete?.();
        fetchFiles?.();
        break;

      case 'test:results':
        if (data.results) {
          onTestingMetricsChange?.(prev => ({
            ...prev,
            totalTests: (prev.totalTests || 0) + (data.results.total || 0),
            passed: (prev.passed || 0) + (data.results.passed || 0),
            failed: (prev.failed || 0) + (data.results.failed || 0),
            skipped: (prev.skipped || 0) + (data.results.skipped || 0),
            passRate: data.results.total > 0
              ? Math.round(((prev.passed || 0) + (data.results.passed || 0)) / ((prev.totalTests || 0) + (data.results.total || 0)) * 100)
              : prev.passRate,
            duration: (prev.duration || 0) + (data.results.duration || 0),
          }));
        }
        break;

      case 'security:results':
        if (data.results) {
          onSecurityMetricsChange?.(prev => ({
            ...prev,
            score: data.results.score ?? prev.score,
            grade: data.results.grade ?? prev.grade,
            riskLevel: data.results.riskLevel ?? prev.riskLevel,
            findings: data.results.findings ?? prev.findings,
            vulnerabilities: data.results.vulnerabilities ?? prev.vulnerabilities,
          }));
        }
        break;

      case 'metrics:update':
        if (data.build) {
          onBuildMetricsChange?.(prev => ({
            ...prev,
            ...data.build,
          }));
        }
        if (data.dora) {
          onDoraMetricsChange?.(prev => ({
            ...prev,
            ...data.dora,
          }));
        }
        break;

      // Legacy single-agent format
      case 'text':
        onAgentMessagesChange?.(prev => [...prev, {
          id: generateMessageId(),
          agentRole: 'coder',
          agentName: 'Coder',
          type: 'chat',
          content: data.content,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case 'tool:use':
        onAgentMessagesChange?.(prev => [...prev, {
          id: generateMessageId(),
          agentRole: 'coder',
          agentName: 'Coder',
          type: 'action',
          content: `Using ${data.tool}...`,
          toolName: data.tool,
          timestamp: new Date().toISOString(),
        }]);
        addBuildLog('tool', `Using tool: ${data.tool}`, typeof data.input === 'object' ? JSON.stringify(data.input).substring(0, 100) : undefined);
        break;

      case 'tool:result':
        addBuildLog('success', `Tool result: ${data.tool}`, data.result?.substring(0, 150));
        break;

      case 'thinking':
        addBuildLog('info', 'Thinking', data.content?.substring(0, 100));
        break;

      case 'error':
        addBuildLog('error', 'Error', data.message || data.error);
        break;

      case 'complete':
        onPhaseChange?.('completed');
        break;
    }
  }, [
    generateMessageId,
    addBuildLog,
    onAgentMessagesChange,
    onAgentStatusesChange,
    onFileChangesChange,
    onFileContentsChange,
    onTasksChange,
    onEpicsChange,
    onTestingMetricsChange,
    onSecurityMetricsChange,
    onDoraMetricsChange,
    onBuildMetricsChange,
    onFoundationComplete,
    onPreviewKeyChange,
    onPhaseChange,
    fetchFiles,
  ]);

  const startBuild = useCallback(async () => {
    if (isStreamingRef.current) return;

    isStreamingRef.current = true;
    onStreamingChange?.(true);
    onPhaseChange?.('building');
    onError?.(null);
    onAgentMessagesChange?.(() => []);
    onBuildLogsChange?.(() => []);
    onFileChangesChange?.(() => []);

    addBuildLog('info', 'Build started', `Project: ${projectId}`);

    // Initialize agent statuses
    const initialStatuses = new Map<string, string>();
    ['product_owner', 'coder', 'tester', 'security'].forEach(role => {
      initialStatuses.set(role, 'idle');
    });
    onAgentStatusesChange?.(() => initialStatuses);
    onEpicsChange?.(() => []);
    onTasksChange?.(() => []);
    onTestingMetricsChange?.(() => DEFAULT_TESTING_METRICS);

    abortControllerRef.current = new AbortController();

    try {
      const sessionRes = await fetch(`/api/v2/session?projectId=${projectId}`);
      let sessionData: { requirements?: string } = {};
      const sessionContentType = sessionRes.headers.get('content-type');
      if (sessionRes.ok && sessionContentType?.includes('application/json')) {
        sessionData = await sessionRes.json();
      }

      const reqs = sessionData.requirements || requirements || 'Build the application';
      const endpoint = useMultiAgent ? '/api/v2/multi-agent' : '/api/v2/stream';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements: reqs,
          mode: 'build',
          agents: ['product_owner', 'coder', 'tester', 'security'],
          coderConfig: { parallelCoders, batchMode, batchSize },
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(currentEventType, data);
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }
      }

      onPhaseChange?.('completed');
      onConnectionStatusChange?.('connected');
      reconnectAttemptRef.current = 0;
      fetchFiles?.();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      const isNetworkError = err instanceof TypeError ||
        (err instanceof Error && (
          err.message.includes('network') ||
          err.message.includes('fetch') ||
          err.message.includes('connection') ||
          err.message.includes('ECONNRESET')
        ));

      if (isNetworkError && reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
        onConnectionStatusChange?.('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
        onError?.(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectAttemptRef.current + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptRef.current += 1;
          onError?.(null);
        }, delay);
      } else {
        onConnectionStatusChange?.('disconnected');
        onError?.(err instanceof Error ? err.message : 'Stream failed. Max reconnection attempts reached.');
        onPhaseChange?.('error');
      }
    } finally {
      isStreamingRef.current = false;
      onStreamingChange?.(false);
    }
  }, [
    projectId,
    useMultiAgent,
    parallelCoders,
    batchMode,
    batchSize,
    requirements,
    addBuildLog,
    handleStreamEvent,
    onPhaseChange,
    onStreamingChange,
    onConnectionStatusChange,
    onError,
    onAgentMessagesChange,
    onAgentStatusesChange,
    onBuildLogsChange,
    onFileChangesChange,
    onTasksChange,
    onEpicsChange,
    onTestingMetricsChange,
    fetchFiles,
  ]);

  const stopBuild = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    isStreamingRef.current = false;
    onStreamingChange?.(false);
    onConnectionStatusChange?.('disconnected');
    reconnectAttemptRef.current = 0;
    onPhaseChange?.('stopped');

    addBuildLog('info', 'Stopping all agents...');

    try {
      await fetch('/api/v2/multi-agent/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements,
          agents: ['product_owner', 'coder', 'tester', 'security'],
        }),
      });

      const response = await fetch(`/api/workflow/${projectId}/stop`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        addBuildLog('success', 'All agents stopped. Use Resume to continue.');
      } else {
        addBuildLog('warning', data.error || 'Workflow may not have fully stopped');
      }
    } catch (error) {
      console.error('Failed to stop workflow:', error);
      addBuildLog('error', 'Failed to stop backend workflow');
    }
  }, [projectId, requirements, addBuildLog, onStreamingChange, onConnectionStatusChange, onPhaseChange]);

  return {
    startBuild,
    stopBuild,
    abortControllerRef,
  };
}
