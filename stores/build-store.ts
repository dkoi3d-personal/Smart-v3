/**
 * Build Store v2
 * Simplified state management for the new 2-mode workflow
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  files?: string[];
  result?: string;
}

export interface FileChange {
  path: string;
  action: 'write' | 'edit' | 'delete';
  timestamp: Date;
}

export interface CommandExecution {
  command: string;
  output?: string;
  status: 'running' | 'completed' | 'failed';
  timestamp: Date;
}

export interface StreamMessage {
  id: string;
  type: 'text' | 'tool' | 'error' | 'system';
  content: string;
  toolName?: string;
  timestamp: Date;
}

export type BuildPhase = 'idle' | 'planning' | 'building' | 'completed' | 'error';

interface BuildStore {
  // Project state
  projectId: string | null;
  projectName: string;
  requirements: string;
  plan: string;
  phase: BuildPhase;

  // Tasks
  tasks: Task[];

  // Real-time state
  messages: StreamMessage[];
  fileChanges: FileChange[];
  commands: CommandExecution[];
  isStreaming: boolean;

  // Error handling
  error: string | null;

  // Actions
  setProject: (projectId: string, projectName: string, requirements: string) => void;
  setPhase: (phase: BuildPhase) => void;
  setPlan: (plan: string) => void;
  setRequirements: (requirements: string) => void;

  // Task actions
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setTasks: (tasks: Task[]) => void;

  // Stream actions
  addMessage: (message: Omit<StreamMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setStreaming: (isStreaming: boolean) => void;

  // File/command tracking
  addFileChange: (change: Omit<FileChange, 'timestamp'>) => void;
  addCommand: (command: string) => void;
  updateCommand: (command: string, output: string, status: 'completed' | 'failed') => void;

  // Error handling
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

const initialState = {
  projectId: null,
  projectName: '',
  requirements: '',
  plan: '',
  phase: 'idle' as BuildPhase,
  tasks: [],
  messages: [],
  fileChanges: [],
  commands: [],
  isStreaming: false,
  error: null,
};

export const useBuildStore = create<BuildStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      setProject: (projectId, projectName, requirements) =>
        set({
          projectId,
          projectName,
          requirements,
          phase: 'idle',
          error: null,
        }),

      setPhase: (phase) => set({ phase }),

      setPlan: (plan) => set({ plan }),

      setRequirements: (requirements) => set({ requirements }),

      // Task actions
      addTask: (task) =>
        set((state) => {
          // Prevent duplicates
          if (state.tasks.some((t) => t.id === task.id)) {
            return state;
          }
          return { tasks: [...state.tasks, task] };
        }),

      updateTask: (taskId, updates) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === taskId ? { ...t, ...updates } : t
          ),
        })),

      setTasks: (tasks) => set({ tasks }),

      // Stream actions
      addMessage: (message) =>
        set((state) => ({
          messages: [
            ...state.messages,
            {
              ...message,
              id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
            },
          ],
        })),

      clearMessages: () => set({ messages: [] }),

      setStreaming: (isStreaming) => set({ isStreaming }),

      // File/command tracking
      addFileChange: (change) =>
        set((state) => ({
          fileChanges: [
            ...state.fileChanges,
            { ...change, timestamp: new Date() },
          ],
        })),

      addCommand: (command) =>
        set((state) => ({
          commands: [
            ...state.commands,
            { command, status: 'running', timestamp: new Date() },
          ],
        })),

      updateCommand: (command, output, status) =>
        set((state) => ({
          commands: state.commands.map((c) =>
            c.command === command && c.status === 'running'
              ? { ...c, output, status }
              : c
          ),
        })),

      setError: (error) => set({ error, phase: error ? 'error' : get().phase }),

      reset: () => set(initialState),
    }),
    { name: 'build-store' }
  )
);

/**
 * Custom hook to connect to SSE stream
 */
export function useStreamConnection() {
  const {
    projectId,
    addMessage,
    addTask,
    updateTask,
    addFileChange,
    addCommand,
    updateCommand,
    setStreaming,
    setPhase,
    setError,
  } = useBuildStore();

  const connect = async (mode: 'plan' | 'build', requirements?: string) => {
    if (!projectId) {
      setError('No project ID set');
      return;
    }

    setStreaming(true);
    setPhase(mode === 'plan' ? 'planning' : 'building');
    setError(null);

    try {
      const response = await fetch('/api/v2/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          mode,
          requirements,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              handleStreamEvent(data);
            } catch {
              // Invalid JSON, skip
            }
          }
        }
      }

      setPhase('completed');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Stream connection failed');
      setPhase('error');
    } finally {
      setStreaming(false);
    }
  };

  const handleStreamEvent = (data: any) => {
    // Handle different event types based on the data structure
    if (data.content !== undefined && !data.tool && !data.message) {
      addMessage({ type: 'text', content: data.content });
    } else if (data.tool) {
      addMessage({
        type: 'tool',
        content: `${data.tool}: ${JSON.stringify(data.input || data.result || '')}`,
        toolName: data.tool,
      });
    } else if (data.message) {
      addMessage({ type: 'system', content: data.message });
    } else if (data.error || data.message?.includes('error')) {
      addMessage({ type: 'error', content: data.error || data.message });
    }

    // Handle task events
    if (data.id && data.title && data.status) {
      const existingTask = useBuildStore.getState().tasks.find(t => t.id === data.id);
      if (existingTask) {
        updateTask(data.id, data);
      } else {
        addTask(data);
      }
    }

    // Handle file changes
    if (data.path && data.action) {
      addFileChange({ path: data.path, action: data.action });
    }

    // Handle commands
    if (data.command) {
      if (data.output !== undefined) {
        updateCommand(data.command, data.output, data.status || 'completed');
      } else {
        addCommand(data.command);
      }
    }
  };

  return { connect };
}
