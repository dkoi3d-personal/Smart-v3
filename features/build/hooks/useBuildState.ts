'use client';

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import type {
  BuildPhase,
  Epic,
  Task,
  AgentMessage,
  FileChange,
  BuildLog,
  BuildMetrics,
  DoraMetrics,
  SecurityMetrics,
  TestingMetrics,
  ResearchSuggestion,
  QuickSettings,
  IterationState,
  OverviewMode,
} from '../types';
import {
  DEFAULT_BUILD_METRICS,
  DEFAULT_TESTING_METRICS,
  DEFAULT_QUICK_SETTINGS,
  DEFAULT_SECURITY_METRICS,
  DEFAULT_DORA_METRICS,
} from '../constants';

export interface BuildStateConfig {
  projectId: string;
}

export function useBuildState({ projectId }: BuildStateConfig) {
  // Core state
  const [phase, setPhase] = useState<BuildPhase>('loading');
  const [projectName, setProjectName] = useState('');
  const [projectDirectory, setProjectDirectory] = useState<string | undefined>();
  const [requirements, setRequirements] = useState('');
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [iterationRequest, setIterationRequest] = useState<string | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [fileChanges, setFileChanges] = useState<FileChange[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Map<string, string>>(new Map());

  // Build output state
  const [buildLogs, setBuildLogs] = useState<BuildLog[]>([]);
  const [buildMetrics, setBuildMetrics] = useState<BuildMetrics>(DEFAULT_BUILD_METRICS);

  // Metrics
  const [doraMetrics, setDoraMetrics] = useState<DoraMetrics>(DEFAULT_DORA_METRICS);
  const [securityMetrics, setSecurityMetrics] = useState<SecurityMetrics>(DEFAULT_SECURITY_METRICS);
  const [testingMetrics, setTestingMetrics] = useState<TestingMetrics>(DEFAULT_TESTING_METRICS);

  // Settings
  const [quickSettings, setQuickSettings] = useState<QuickSettings>(DEFAULT_QUICK_SETTINGS);
  const [agentConfigs, setAgentConfigs] = useState<Record<string, unknown>>({});
  const [parallelCoders, setParallelCoders] = useState(1);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(3);
  const [useMultiAgent, setUseMultiAgent] = useState(true);

  // Research state
  const [isResearching, setIsResearching] = useState(false);
  const [researchSuggestions, setResearchSuggestions] = useState<ResearchSuggestion[]>([]);

  // Iteration state
  const [iterationState, setIterationState] = useState<IterationState | null>(null);
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('summary');

  // All stories belong to current build (clean-slate architecture)
  const originalStories = useMemo(() => tasks, [tasks]);

  // No separate iteration stories with clean-slate architecture
  const currentIterationStories = useMemo(() => tasks, [tasks]);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdCounter = useRef(0);

  // Add a build log entry
  const addBuildLog = useCallback(
    (type: BuildLog['type'], message: string, detail?: string) => {
      setBuildLogs((prev) => [
        ...prev,
        {
          id: `log-${Date.now()}-${Math.random()}`,
          type,
          message,
          detail,
          timestamp: new Date(),
        },
      ]);
    },
    []
  );

  // Add an agent message
  const addAgentMessage = useCallback((message: Omit<AgentMessage, 'id'>) => {
    const id = `msg-${Date.now()}-${messageIdCounter.current++}`;
    setAgentMessages((prev) => [...prev, { ...message, id }]);
  }, []);

  // Update a task's status
  const updateTaskStatus = useCallback((taskId: string, status: Task['status']) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task))
    );
  }, []);

  // Load project data
  const loadProject = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) throw new Error('Failed to load project');

      const project = await response.json();

      setProjectName(project.projectName || project.config?.name || 'Untitled');
      setProjectDirectory(project.projectDir);
      setRequirements(project.requirements || project.config?.requirements || '');
      setDeploymentUrl(project.deploymentUrl || null);

      if (project.epics) setEpics(project.epics);
      if (project.stories) setTasks(project.stories);
      if (project.messages) setAgentMessages(project.messages);

      // Determine phase
      if (project.status === 'completed') {
        setPhase('completed');
      } else if (project.status === 'building') {
        setPhase('building');
      } else if (project.status === 'error') {
        setPhase('error');
        setError(project.error || 'Unknown error');
      } else if (project.epics?.length > 0 || project.stories?.length > 0) {
        setPhase('planned');
      } else {
        setPhase('planned');
      }
    } catch (err) {
      console.error('Failed to load project:', err);
      setPhase('error');
      setError(err instanceof Error ? err.message : 'Failed to load project');
    }
  }, [projectId]);

  // Load agent configuration
  const loadAgentConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/agent-config');
      if (response.ok) {
        const config = await response.json();
        if (config.quickSettings) {
          setParallelCoders(config.quickSettings.parallelCoders || 1);
          setBatchMode(false);
          setQuickSettings((prev) => ({
            ...prev,
            ...config.quickSettings,
          }));
        }
        if (config.agents) {
          setAgentConfigs(config.agents);
        }
      }
    } catch (err) {
      console.error('Failed to load agent config:', err);
    }
  }, []);

  // Load iteration state - deprecated with clean-slate architecture
  // Build history is now managed via .build-history/ folder
  const loadIterationState = useCallback(async (_projectDir: string) => {
    // No-op: iteration state is no longer used
    // Build history is now loaded via HistorySidebar from /api/build-history
  }, []);

  // Cancel current build
  const cancelBuild = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
    setPhase('stopped');
    addBuildLog('warning', 'Build cancelled by user');
  }, [addBuildLog]);

  // Reset state for new build
  const resetForNewBuild = useCallback(() => {
    setAgentMessages([]);
    setBuildLogs([]);
    setBuildMetrics(DEFAULT_BUILD_METRICS);
    setError(null);
    setIsStreaming(false);
  }, []);

  return {
    // Core state
    phase,
    setPhase,
    projectName,
    setProjectName,
    projectDirectory,
    requirements,
    setRequirements,
    deploymentUrl,
    setDeploymentUrl,
    iterationRequest,
    setIterationRequest,
    epics,
    setEpics,
    tasks,
    setTasks,
    agentMessages,
    setAgentMessages,
    fileChanges,
    setFileChanges,
    isStreaming,
    setIsStreaming,
    error,
    setError,
    agentStatuses,
    setAgentStatuses,

    // Build output
    buildLogs,
    setBuildLogs,
    buildMetrics,
    setBuildMetrics,

    // Metrics
    doraMetrics,
    setDoraMetrics,
    securityMetrics,
    setSecurityMetrics,
    testingMetrics,
    setTestingMetrics,

    // Settings
    quickSettings,
    setQuickSettings,
    agentConfigs,
    setAgentConfigs,
    parallelCoders,
    setParallelCoders,
    batchMode,
    setBatchMode,
    batchSize,
    setBatchSize,
    useMultiAgent,
    setUseMultiAgent,

    // Research
    isResearching,
    setIsResearching,
    researchSuggestions,
    setResearchSuggestions,

    // Iteration
    iterationState,
    setIterationState,
    overviewMode,
    setOverviewMode,
    originalStories,
    currentIterationStories,

    // Refs
    abortControllerRef,

    // Actions
    addBuildLog,
    addAgentMessage,
    updateTaskStatus,
    loadProject,
    loadAgentConfig,
    loadIterationState,
    cancelBuild,
    resetForNewBuild,
  };
}
