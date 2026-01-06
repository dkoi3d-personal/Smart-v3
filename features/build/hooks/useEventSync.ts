/**
 * Event Sync Hook
 *
 * Bridges WebSocket events to the Zustand store.
 * Call this once at the page level to set up event subscriptions.
 */

import { useEffect, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useBuildPageStore } from '../stores/useBuildPageStore';
import type {
  StoryUpdateEvent,
  CodeChangeEvent,
  TestResultEvent,
  SecurityAlertEvent,
  AgentStatusEvent,
  AgentMessageEvent,
  WorkflowStatusEvent,
} from '@/lib/websocket/events';
import type { Task, AgentMessage, FileChange, BuildPhase } from '../types';

interface UseEventSyncOptions {
  projectId: string;
  enabled?: boolean;
}

/**
 * Hook to sync WebSocket events to the Zustand store
 */
export function useEventSync({ projectId, enabled = true }: UseEventSyncOptions) {
  const { on, off, connected } = useWebSocket({ projectId, autoConnect: enabled });
  const isSetup = useRef(false);

  // Get store actions
  const {
    updateTask,
    addTask,
    addAgentMessage,
    addFileChange,
    updateAgentStatus,
    setPhase,
    setConnectionStatus,
    setLastHeartbeat,
    updateTestingMetrics,
    setError,
    setIsStreaming,
  } = useBuildPageStore();

  useEffect(() => {
    if (!enabled || isSetup.current) return;
    isSetup.current = true;

    // -------------------------------------------------------------------------
    // Story/Task Events
    // -------------------------------------------------------------------------
    const handleStoryUpdate = (data: StoryUpdateEvent) => {
      const existingTasks = useBuildPageStore.getState().tasks;
      const exists = existingTasks.some((t) => t.id === data.id);

      if (exists) {
        updateTask(data.id, {
          status: data.status as Task['status'],
          assignedTo: data.assignedAgent as any,
        });
      } else {
        // Create a new task from the event
        addTask({
          id: data.id,
          title: `Story ${data.id}`,
          description: '',
          status: data.status as Task['status'],
          priority: 'medium',
          epicId: '',
          storyPoints: 0,
        });
      }
    };

    // -------------------------------------------------------------------------
    // Agent Message Events
    // -------------------------------------------------------------------------
    const handleAgentMessage = (data: AgentMessageEvent) => {
      const message: AgentMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentRole: data.agentType as any,
        agentName: getAgentName(data.agentType),
        type: data.type === 'error' ? 'error' : 'chat',
        content: data.content,
        timestamp: new Date().toISOString(),
      };
      addAgentMessage(message);
    };

    // -------------------------------------------------------------------------
    // Agent Status Events
    // -------------------------------------------------------------------------
    const handleAgentStatus = (data: AgentStatusEvent) => {
      updateAgentStatus(data.agentId, data.status);

      // If agent is working, we're streaming
      if (data.status === 'working' || data.status === 'thinking') {
        setIsStreaming(true);
      }
    };

    // -------------------------------------------------------------------------
    // Code Change Events
    // -------------------------------------------------------------------------
    const handleCodeChange = (data: CodeChangeEvent) => {
      const change: FileChange = {
        path: data.file,
        action: data.action === 'created' ? 'write' : data.action === 'modified' ? 'edit' : 'delete',
        timestamp: new Date(),
      };
      addFileChange(change);
    };

    // -------------------------------------------------------------------------
    // Test Result Events
    // -------------------------------------------------------------------------
    const handleTestResult = (data: TestResultEvent) => {
      updateTestingMetrics({
        totalTests: data.passed + data.failed,
        passed: data.passed,
        failed: data.failed,
        coverage: data.coverage.lines,
      });
    };

    // -------------------------------------------------------------------------
    // Workflow Status Events
    // -------------------------------------------------------------------------
    const handleWorkflowStatus = (data: WorkflowStatusEvent) => {
      const phaseMap: Record<string, BuildPhase> = {
        idle: 'stopped',
        planning: 'planned',
        developing: 'building',
        testing: 'building',
        deploying: 'building',
        completed: 'completed',
        error: 'error',
      };
      setPhase(phaseMap[data.status] || 'loading');

      if (data.status === 'completed' || data.status === 'error' || data.status === 'idle') {
        setIsStreaming(false);
      }
    };

    // -------------------------------------------------------------------------
    // Connection Events
    // -------------------------------------------------------------------------
    const handleConnect = () => {
      setConnectionStatus('connected');
      setLastHeartbeat(Date.now());
    };

    const handleDisconnect = () => {
      setConnectionStatus('disconnected');
    };

    const handleHeartbeat = () => {
      setLastHeartbeat(Date.now());
    };

    // -------------------------------------------------------------------------
    // Error Events
    // -------------------------------------------------------------------------
    const handleError = (data: { message: string }) => {
      setError(data.message);
    };

    // -------------------------------------------------------------------------
    // Subscribe to Events
    // -------------------------------------------------------------------------
    on('story:update', handleStoryUpdate);
    on('agent:message', handleAgentMessage);
    on('agent:status', handleAgentStatus);
    on('code:change', handleCodeChange);
    on('test:result', handleTestResult);
    on('workflow:status', handleWorkflowStatus);
    on('connected', handleConnect);
    on('disconnect', handleDisconnect);
    on('heartbeat', handleHeartbeat);
    on('error', handleError);

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------
    return () => {
      off('story:update', handleStoryUpdate);
      off('agent:message', handleAgentMessage);
      off('agent:status', handleAgentStatus);
      off('code:change', handleCodeChange);
      off('test:result', handleTestResult);
      off('workflow:status', handleWorkflowStatus);
      off('connected', handleConnect);
      off('disconnect', handleDisconnect);
      off('heartbeat', handleHeartbeat);
      off('error', handleError);
      isSetup.current = false;
    };
  }, [enabled, on, off, updateTask, addTask, addAgentMessage, addFileChange, updateAgentStatus, setPhase, setConnectionStatus, setLastHeartbeat, updateTestingMetrics, setError, setIsStreaming]);

  return { connected };
}

// -------------------------------------------------------------------------
// Helper Functions
// -------------------------------------------------------------------------

function getAgentName(agentType: string): string {
  const names: Record<string, string> = {
    product_owner: 'Product Owner',
    coder: 'Coder',
    tester: 'Tester',
    security: 'Security',
    coordinator: 'Coordinator',
    supervisor: 'Supervisor',
  };
  return names[agentType] || agentType;
}
