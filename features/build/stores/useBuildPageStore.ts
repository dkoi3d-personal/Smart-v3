/**
 * Build Page Store - Zustand store for build page state
 *
 * This store manages all state for the /build/[projectId] page,
 * eliminating prop drilling and making components self-contained.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Epic,
  Task,
  AgentMessage,
  FileChange,
  BuildLog,
  BuildMetrics,
  DoraMetrics,
  SecurityMetrics,
  TestingMetrics,
  BuildPhase,
  ConnectionStatus,
  CheckpointInfo,
  IterationState,
  OverviewMode,
  ResearchSuggestion,
} from '@/features/build/types';
import {
  DEFAULT_BUILD_METRICS,
  DEFAULT_TESTING_METRICS,
  DEFAULT_SECURITY_METRICS,
  DEFAULT_DORA_METRICS,
} from '@/features/build/constants';
import type { PreBuildAnswers } from '@/components/healthcare/PreBuildQuestionnaire';

// ============================================================================
// Types
// ============================================================================

interface ComplexBuildContext {
  projectId: string;
  originalRequirements: string;
  generatedPrompt: string;
  filesCreated: string[];
  databaseConfig?: { provider: string; schemaTemplate: string } | null;
}

// ============================================================================
// Store State Interface
// ============================================================================

interface BuildPageState {
  // ---------------------------------------------------------------------------
  // Core State
  // ---------------------------------------------------------------------------
  phase: BuildPhase;
  projectName: string;
  projectDirectory: string | undefined;
  requirements: string;
  deploymentUrl: string | null;
  iterationRequest: string | null;
  epics: Epic[];
  tasks: Task[];
  agentMessages: AgentMessage[];
  fileChanges: FileChange[];
  isStreaming: boolean;
  error: string | null;
  agentStatuses: Map<string, string>;

  // ---------------------------------------------------------------------------
  // Connection State
  // ---------------------------------------------------------------------------
  connectionStatus: ConnectionStatus;
  reconnectAttempt: number;
  lastHeartbeat: number;
  hasCheckpoint: boolean;
  checkpointInfo: CheckpointInfo | null;

  // ---------------------------------------------------------------------------
  // File State
  // ---------------------------------------------------------------------------
  fileContents: Map<string, string>;
  useMultiAgent: boolean;

  // ---------------------------------------------------------------------------
  // Git State
  // ---------------------------------------------------------------------------
  gitRepoUrl: string;
  gitBranch: string;
  isCloningRepo: boolean;
  gitCloneError: string | null;

  // ---------------------------------------------------------------------------
  // Scaffold State
  // ---------------------------------------------------------------------------
  foundationComplete: boolean;
  isScaffolding: boolean;
  scaffoldStatus: 'idle' | 'checking' | 'scaffolding' | 'done' | 'error';
  scaffoldMessage: string;
  isProjectScaffolded: boolean;

  // ---------------------------------------------------------------------------
  // Iteration State
  // ---------------------------------------------------------------------------
  userPrompt: string;
  isIterating: boolean;
  isFixing: boolean;
  fixerMessages: AgentMessage[];
  iterationState: IterationState | null;
  overviewMode: OverviewMode;

  // ---------------------------------------------------------------------------
  // Research State
  // ---------------------------------------------------------------------------
  isResearching: boolean;
  researchSuggestions: ResearchSuggestion[];

  // ---------------------------------------------------------------------------
  // Healthcare State
  // ---------------------------------------------------------------------------
  isHealthcareMode: boolean;
  showPreBuildQuestionnaire: boolean;
  healthcareSettings: PreBuildAnswers | null;

  // ---------------------------------------------------------------------------
  // Command State
  // ---------------------------------------------------------------------------
  quickCommand: string;
  isRunningQuickCommand: boolean;
  quickCommandOutput: string[];

  // ---------------------------------------------------------------------------
  // Build Metrics State
  // ---------------------------------------------------------------------------
  buildLogs: BuildLog[];
  buildMetrics: BuildMetrics;
  doraMetrics: DoraMetrics;
  securityMetrics: SecurityMetrics;
  testingMetrics: TestingMetrics;

  // ---------------------------------------------------------------------------
  // Modal State
  // ---------------------------------------------------------------------------
  showComplexBuildModal: boolean;
  complexBuildContext: ComplexBuildContext | null;
}

// ============================================================================
// Store Actions Interface
// ============================================================================

interface BuildPageActions {
  // ---------------------------------------------------------------------------
  // Core Actions
  // ---------------------------------------------------------------------------
  setPhase: (phase: BuildPhase) => void;
  setProjectName: (name: string) => void;
  setProjectDirectory: (dir: string | undefined) => void;
  setRequirements: (requirements: string) => void;
  setDeploymentUrl: (url: string | null) => void;
  setIterationRequest: (request: string | null) => void;
  // These support both direct value and functional update: setEpics(newEpics) or setEpics(prev => [...prev, newEpic])
  setEpics: (epicsOrFn: Epic[] | ((prev: Epic[]) => Epic[])) => void;
  addEpic: (epic: Epic) => void;
  updateEpic: (epicId: string, updates: Partial<Epic>) => void;
  setTasks: (tasksOrFn: Task[] | ((prev: Task[]) => Task[])) => void;
  addTask: (task: Task) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  setAgentMessages: (messagesOrFn: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => void;
  addAgentMessage: (message: AgentMessage) => void;
  setFileChanges: (changesOrFn: FileChange[] | ((prev: FileChange[]) => FileChange[])) => void;
  addFileChange: (change: FileChange) => void;
  setIsStreaming: (streaming: boolean) => void;
  setError: (error: string | null) => void;
  setAgentStatuses: (statusesOrFn: Map<string, string> | ((prev: Map<string, string>) => Map<string, string>)) => void;
  updateAgentStatus: (agentId: string, status: string) => void;

  // ---------------------------------------------------------------------------
  // Connection Actions
  // ---------------------------------------------------------------------------
  setConnectionStatus: (status: ConnectionStatus) => void;
  setReconnectAttempt: (attemptOrFn: number | ((prev: number) => number)) => void;
  setLastHeartbeat: (timestamp: number) => void;
  setHasCheckpoint: (has: boolean) => void;
  setCheckpointInfo: (info: CheckpointInfo | null) => void;

  // ---------------------------------------------------------------------------
  // File Actions
  // ---------------------------------------------------------------------------
  setFileContents: (contentsOrFn: Map<string, string> | ((prev: Map<string, string>) => Map<string, string>)) => void;
  updateFileContent: (path: string, content: string) => void;
  setUseMultiAgent: (use: boolean) => void;

  // ---------------------------------------------------------------------------
  // Git Actions
  // ---------------------------------------------------------------------------
  setGitRepoUrl: (url: string) => void;
  setGitBranch: (branch: string) => void;
  setIsCloningRepo: (cloning: boolean) => void;
  setGitCloneError: (error: string | null) => void;

  // ---------------------------------------------------------------------------
  // Scaffold Actions
  // ---------------------------------------------------------------------------
  setFoundationComplete: (complete: boolean) => void;
  setIsScaffolding: (scaffolding: boolean) => void;
  setScaffoldStatus: (status: 'idle' | 'checking' | 'scaffolding' | 'done' | 'error') => void;
  setScaffoldMessage: (message: string) => void;
  setIsProjectScaffolded: (scaffolded: boolean) => void;

  // ---------------------------------------------------------------------------
  // Iteration Actions
  // ---------------------------------------------------------------------------
  setUserPrompt: (prompt: string) => void;
  setIsIterating: (iterating: boolean) => void;
  setIsFixing: (fixing: boolean) => void;
  setFixerMessages: (messagesOrFn: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) => void;
  addFixerMessage: (message: AgentMessage) => void;
  setIterationState: (state: IterationState | null) => void;
  setOverviewMode: (mode: OverviewMode) => void;

  // ---------------------------------------------------------------------------
  // Research Actions
  // ---------------------------------------------------------------------------
  setIsResearching: (researching: boolean) => void;
  setResearchSuggestions: (suggestionsOrFn: ResearchSuggestion[] | ((prev: ResearchSuggestion[]) => ResearchSuggestion[])) => void;
  addResearchSuggestion: (suggestion: ResearchSuggestion) => void;

  // ---------------------------------------------------------------------------
  // Healthcare Actions
  // ---------------------------------------------------------------------------
  setIsHealthcareMode: (mode: boolean) => void;
  setShowPreBuildQuestionnaire: (show: boolean) => void;
  setHealthcareSettings: (settings: PreBuildAnswers | null) => void;

  // ---------------------------------------------------------------------------
  // Command Actions
  // ---------------------------------------------------------------------------
  setQuickCommand: (command: string) => void;
  setIsRunningQuickCommand: (running: boolean) => void;
  setQuickCommandOutput: (output: string[]) => void;
  addQuickCommandOutput: (line: string) => void;

  // ---------------------------------------------------------------------------
  // Build Metrics Actions (support both direct value and functional update)
  // ---------------------------------------------------------------------------
  setBuildLogs: (logsOrFn: BuildLog[] | ((prev: BuildLog[]) => BuildLog[])) => void;
  addBuildLog: (log: BuildLog) => void;
  setBuildMetrics: (metricsOrFn: BuildMetrics | ((prev: BuildMetrics) => BuildMetrics)) => void;
  updateBuildMetrics: (updates: Partial<BuildMetrics>) => void;
  setDoraMetrics: (metricsOrFn: DoraMetrics | ((prev: DoraMetrics) => DoraMetrics)) => void;
  setSecurityMetrics: (metricsOrFn: SecurityMetrics | ((prev: SecurityMetrics) => SecurityMetrics)) => void;
  setTestingMetrics: (metricsOrFn: TestingMetrics | ((prev: TestingMetrics) => TestingMetrics)) => void;
  updateTestingMetrics: (updates: Partial<TestingMetrics>) => void;

  // ---------------------------------------------------------------------------
  // Modal Actions
  // ---------------------------------------------------------------------------
  setShowComplexBuildModal: (show: boolean) => void;
  setComplexBuildContext: (context: ComplexBuildContext | null) => void;

  // ---------------------------------------------------------------------------
  // Bulk Actions
  // ---------------------------------------------------------------------------
  resetStore: () => void;
  initializeForProject: (projectId: string) => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: BuildPageState = {
  // Core
  phase: 'loading',
  projectName: '',
  projectDirectory: undefined,
  requirements: '',
  deploymentUrl: null,
  iterationRequest: null,
  epics: [],
  tasks: [],
  agentMessages: [],
  fileChanges: [],
  isStreaming: false,
  error: null,
  agentStatuses: new Map(),

  // Connection
  connectionStatus: 'connected',
  reconnectAttempt: 0,
  lastHeartbeat: Date.now(),
  hasCheckpoint: false,
  checkpointInfo: null,

  // File
  fileContents: new Map(),
  useMultiAgent: true,

  // Git
  gitRepoUrl: '',
  gitBranch: 'main',
  isCloningRepo: false,
  gitCloneError: null,

  // Scaffold
  foundationComplete: false,
  isScaffolding: false,
  scaffoldStatus: 'idle',
  scaffoldMessage: '',
  isProjectScaffolded: false,

  // Iteration
  userPrompt: '',
  isIterating: false,
  isFixing: false,
  fixerMessages: [],
  iterationState: null,
  overviewMode: 'summary',

  // Research
  isResearching: false,
  researchSuggestions: [],

  // Healthcare
  isHealthcareMode: false,
  showPreBuildQuestionnaire: false,
  healthcareSettings: null,

  // Command
  quickCommand: '',
  isRunningQuickCommand: false,
  quickCommandOutput: [],

  // Build Metrics
  buildLogs: [],
  buildMetrics: DEFAULT_BUILD_METRICS,
  doraMetrics: DEFAULT_DORA_METRICS,
  securityMetrics: DEFAULT_SECURITY_METRICS,
  testingMetrics: DEFAULT_TESTING_METRICS,

  // Modal
  showComplexBuildModal: false,
  complexBuildContext: null,
};

// ============================================================================
// localStorage Backup Utilities
// ============================================================================

const STORAGE_KEY_PREFIX = 'build-page-backup';

function getStorageKey(projectId: string, type: 'tasks' | 'epics'): string {
  return `${STORAGE_KEY_PREFIX}:${projectId}:${type}`;
}

function saveToLocalStorage(projectId: string | undefined, tasks: Task[], epics: Epic[]): void {
  if (!projectId || typeof window === 'undefined') return;
  try {
    if (tasks.length > 0) {
      localStorage.setItem(getStorageKey(projectId, 'tasks'), JSON.stringify(tasks));
    }
    if (epics.length > 0) {
      localStorage.setItem(getStorageKey(projectId, 'epics'), JSON.stringify(epics));
    }
  } catch (err) {
    console.warn('[BuildStore] Failed to save to localStorage:', err);
  }
}

export function loadFromLocalStorage(projectId: string): { tasks: Task[]; epics: Epic[] } {
  if (typeof window === 'undefined') return { tasks: [], epics: [] };
  try {
    const tasksStr = localStorage.getItem(getStorageKey(projectId, 'tasks'));
    const epicsStr = localStorage.getItem(getStorageKey(projectId, 'epics'));
    return {
      tasks: tasksStr ? JSON.parse(tasksStr) : [],
      epics: epicsStr ? JSON.parse(epicsStr) : [],
    };
  } catch (err) {
    console.warn('[BuildStore] Failed to load from localStorage:', err);
    return { tasks: [], epics: [] };
  }
}

export function clearLocalStorageBackup(projectId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getStorageKey(projectId, 'tasks'));
    localStorage.removeItem(getStorageKey(projectId, 'epics'));
  } catch (err) {
    console.warn('[BuildStore] Failed to clear localStorage:', err);
  }
}

// ============================================================================
// Store Creation
// ============================================================================

export const useBuildPageStore = create<BuildPageState & BuildPageActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // -----------------------------------------------------------------------
      // Core Actions
      // -----------------------------------------------------------------------
      setPhase: (phase) => set({ phase }, false, 'setPhase'),
      setProjectName: (projectName) => set({ projectName }, false, 'setProjectName'),
      setProjectDirectory: (projectDirectory) => set({ projectDirectory }, false, 'setProjectDirectory'),
      setRequirements: (requirements) => set({ requirements }, false, 'setRequirements'),
      setDeploymentUrl: (deploymentUrl) => set({ deploymentUrl }, false, 'setDeploymentUrl'),
      setIterationRequest: (iterationRequest) => set({ iterationRequest }, false, 'setIterationRequest'),

      // Support both direct value and functional update: setEpics(newEpics) or setEpics(prev => [...prev, newEpic])
      // Also saves to localStorage as backup
      setEpics: (epicsOrFn) =>
        set(
          (state) => {
            const newEpics = typeof epicsOrFn === 'function' ? epicsOrFn(state.epics) : epicsOrFn;
            // Save to localStorage as backup (use projectDirectory as unique key)
            if (state.projectDirectory) {
              saveToLocalStorage(state.projectDirectory, state.tasks, newEpics);
            }
            return { epics: newEpics };
          },
          false,
          'setEpics'
        ),
      addEpic: (epic) =>
        set(
          (state) => {
            const newEpics = [...state.epics, epic];
            if (state.projectDirectory) {
              saveToLocalStorage(state.projectDirectory, state.tasks, newEpics);
            }
            return { epics: newEpics };
          },
          false,
          'addEpic'
        ),
      updateEpic: (epicId, updates) =>
        set(
          (state) => {
            const newEpics = state.epics.map((e) => (e.id === epicId ? { ...e, ...updates } : e));
            if (state.projectDirectory) {
              saveToLocalStorage(state.projectDirectory, state.tasks, newEpics);
            }
            return { epics: newEpics };
          },
          false,
          'updateEpic'
        ),

      // Support both direct value and functional update: setTasks(newTasks) or setTasks(prev => [...prev, newTask])
      // Also saves to localStorage as backup
      setTasks: (tasksOrFn) =>
        set(
          (state) => {
            const newTasks = typeof tasksOrFn === 'function' ? tasksOrFn(state.tasks) : tasksOrFn;
            // Save to localStorage as backup (use projectDirectory as unique key)
            if (state.projectDirectory) {
              saveToLocalStorage(state.projectDirectory, newTasks, state.epics);
            }
            return { tasks: newTasks };
          },
          false,
          'setTasks'
        ),
      addTask: (task) =>
        set(
          (state) => {
            const newTasks = [...state.tasks, task];
            if (state.projectDirectory) {
              saveToLocalStorage(state.projectDirectory, newTasks, state.epics);
            }
            return { tasks: newTasks };
          },
          false,
          'addTask'
        ),
      updateTask: (taskId, updates) =>
        set(
          (state) => {
            const newTasks = state.tasks.map((t) => (t.id === taskId ? { ...t, ...updates } : t));
            if (state.projectDirectory) {
              saveToLocalStorage(state.projectDirectory, newTasks, state.epics);
            }
            return { tasks: newTasks };
          },
          false,
          'updateTask'
        ),

      // Support both direct value and functional update
      setAgentMessages: (messagesOrFn) =>
        set(
          (state) => ({
            agentMessages: typeof messagesOrFn === 'function' ? messagesOrFn(state.agentMessages) : messagesOrFn,
          }),
          false,
          'setAgentMessages'
        ),
      addAgentMessage: (message) =>
        set((state) => ({ agentMessages: [...state.agentMessages, message] }), false, 'addAgentMessage'),

      setFileChanges: (changesOrFn) =>
        set(
          (state) => ({
            fileChanges: typeof changesOrFn === 'function' ? changesOrFn(state.fileChanges) : changesOrFn,
          }),
          false,
          'setFileChanges'
        ),
      addFileChange: (change) =>
        set((state) => ({ fileChanges: [...state.fileChanges, change] }), false, 'addFileChange'),

      setIsStreaming: (isStreaming) => set({ isStreaming }, false, 'setIsStreaming'),
      setError: (error) => set({ error }, false, 'setError'),

      // Support both direct value and functional update
      setAgentStatuses: (statusesOrFn) =>
        set(
          (state) => ({
            agentStatuses: typeof statusesOrFn === 'function' ? statusesOrFn(state.agentStatuses) : statusesOrFn,
          }),
          false,
          'setAgentStatuses'
        ),
      updateAgentStatus: (agentId, status) =>
        set(
          (state) => {
            const newStatuses = new Map(state.agentStatuses);
            newStatuses.set(agentId, status);
            return { agentStatuses: newStatuses };
          },
          false,
          'updateAgentStatus'
        ),

      // -----------------------------------------------------------------------
      // Connection Actions
      // -----------------------------------------------------------------------
      setConnectionStatus: (connectionStatus) => set({ connectionStatus }, false, 'setConnectionStatus'),
      setReconnectAttempt: (attemptOrFn) =>
        set(
          (state) => ({
            reconnectAttempt: typeof attemptOrFn === 'function' ? attemptOrFn(state.reconnectAttempt) : attemptOrFn,
          }),
          false,
          'setReconnectAttempt'
        ),
      setLastHeartbeat: (lastHeartbeat) => set({ lastHeartbeat }, false, 'setLastHeartbeat'),
      setHasCheckpoint: (hasCheckpoint) => set({ hasCheckpoint }, false, 'setHasCheckpoint'),
      setCheckpointInfo: (checkpointInfo) => set({ checkpointInfo }, false, 'setCheckpointInfo'),

      // -----------------------------------------------------------------------
      // File Actions
      // -----------------------------------------------------------------------
      // Support both direct value and functional update
      setFileContents: (contentsOrFn) =>
        set(
          (state) => ({
            fileContents: typeof contentsOrFn === 'function' ? contentsOrFn(state.fileContents) : contentsOrFn,
          }),
          false,
          'setFileContents'
        ),
      updateFileContent: (path, content) =>
        set(
          (state) => {
            const newContents = new Map(state.fileContents);
            newContents.set(path, content);
            return { fileContents: newContents };
          },
          false,
          'updateFileContent'
        ),
      setUseMultiAgent: (useMultiAgent) => set({ useMultiAgent }, false, 'setUseMultiAgent'),

      // -----------------------------------------------------------------------
      // Git Actions
      // -----------------------------------------------------------------------
      setGitRepoUrl: (gitRepoUrl) => set({ gitRepoUrl }, false, 'setGitRepoUrl'),
      setGitBranch: (gitBranch) => set({ gitBranch }, false, 'setGitBranch'),
      setIsCloningRepo: (isCloningRepo) => set({ isCloningRepo }, false, 'setIsCloningRepo'),
      setGitCloneError: (gitCloneError) => set({ gitCloneError }, false, 'setGitCloneError'),

      // -----------------------------------------------------------------------
      // Scaffold Actions
      // -----------------------------------------------------------------------
      setFoundationComplete: (foundationComplete) => set({ foundationComplete }, false, 'setFoundationComplete'),
      setIsScaffolding: (isScaffolding) => set({ isScaffolding }, false, 'setIsScaffolding'),
      setScaffoldStatus: (scaffoldStatus) => set({ scaffoldStatus }, false, 'setScaffoldStatus'),
      setScaffoldMessage: (scaffoldMessage) => set({ scaffoldMessage }, false, 'setScaffoldMessage'),
      setIsProjectScaffolded: (isProjectScaffolded) => set({ isProjectScaffolded }, false, 'setIsProjectScaffolded'),

      // -----------------------------------------------------------------------
      // Iteration Actions
      // -----------------------------------------------------------------------
      setUserPrompt: (userPrompt) => set({ userPrompt }, false, 'setUserPrompt'),
      setIsIterating: (isIterating) => set({ isIterating }, false, 'setIsIterating'),
      setIsFixing: (isFixing) => set({ isFixing }, false, 'setIsFixing'),
      setFixerMessages: (messagesOrFn) =>
        set(
          (state) => ({
            fixerMessages: typeof messagesOrFn === 'function' ? messagesOrFn(state.fixerMessages) : messagesOrFn,
          }),
          false,
          'setFixerMessages'
        ),
      addFixerMessage: (message) =>
        set((state) => ({ fixerMessages: [...state.fixerMessages, message] }), false, 'addFixerMessage'),
      setIterationState: (iterationState) => set({ iterationState }, false, 'setIterationState'),
      setOverviewMode: (overviewMode) => set({ overviewMode }, false, 'setOverviewMode'),

      // -----------------------------------------------------------------------
      // Research Actions
      // -----------------------------------------------------------------------
      setIsResearching: (isResearching) => set({ isResearching }, false, 'setIsResearching'),
      setResearchSuggestions: (suggestionsOrFn) =>
        set(
          (state) => ({
            researchSuggestions:
              typeof suggestionsOrFn === 'function' ? suggestionsOrFn(state.researchSuggestions) : suggestionsOrFn,
          }),
          false,
          'setResearchSuggestions'
        ),
      addResearchSuggestion: (suggestion) =>
        set(
          (state) => ({ researchSuggestions: [...state.researchSuggestions, suggestion] }),
          false,
          'addResearchSuggestion'
        ),

      // -----------------------------------------------------------------------
      // Healthcare Actions
      // -----------------------------------------------------------------------
      setIsHealthcareMode: (isHealthcareMode) => set({ isHealthcareMode }, false, 'setIsHealthcareMode'),
      setShowPreBuildQuestionnaire: (showPreBuildQuestionnaire) =>
        set({ showPreBuildQuestionnaire }, false, 'setShowPreBuildQuestionnaire'),
      setHealthcareSettings: (healthcareSettings) => set({ healthcareSettings }, false, 'setHealthcareSettings'),

      // -----------------------------------------------------------------------
      // Command Actions
      // -----------------------------------------------------------------------
      setQuickCommand: (quickCommand) => set({ quickCommand }, false, 'setQuickCommand'),
      setIsRunningQuickCommand: (isRunningQuickCommand) =>
        set({ isRunningQuickCommand }, false, 'setIsRunningQuickCommand'),
      setQuickCommandOutput: (quickCommandOutput) => set({ quickCommandOutput }, false, 'setQuickCommandOutput'),
      addQuickCommandOutput: (line) =>
        set((state) => ({ quickCommandOutput: [...state.quickCommandOutput, line] }), false, 'addQuickCommandOutput'),

      // -----------------------------------------------------------------------
      // Build Metrics Actions (support both direct value and functional update)
      // -----------------------------------------------------------------------
      setBuildLogs: (logsOrFn) =>
        set(
          (state) => ({
            buildLogs: typeof logsOrFn === 'function' ? logsOrFn(state.buildLogs) : logsOrFn,
          }),
          false,
          'setBuildLogs'
        ),
      addBuildLog: (log) => set((state) => ({ buildLogs: [...state.buildLogs, log] }), false, 'addBuildLog'),
      setBuildMetrics: (metricsOrFn) =>
        set(
          (state) => ({
            buildMetrics: typeof metricsOrFn === 'function' ? metricsOrFn(state.buildMetrics) : metricsOrFn,
          }),
          false,
          'setBuildMetrics'
        ),
      updateBuildMetrics: (updates) =>
        set((state) => ({ buildMetrics: { ...state.buildMetrics, ...updates } }), false, 'updateBuildMetrics'),
      setDoraMetrics: (metricsOrFn) =>
        set(
          (state) => ({
            doraMetrics: typeof metricsOrFn === 'function' ? metricsOrFn(state.doraMetrics) : metricsOrFn,
          }),
          false,
          'setDoraMetrics'
        ),
      setSecurityMetrics: (metricsOrFn) =>
        set(
          (state) => ({
            securityMetrics: typeof metricsOrFn === 'function' ? metricsOrFn(state.securityMetrics) : metricsOrFn,
          }),
          false,
          'setSecurityMetrics'
        ),
      setTestingMetrics: (metricsOrFn) =>
        set(
          (state) => ({
            testingMetrics: typeof metricsOrFn === 'function' ? metricsOrFn(state.testingMetrics) : metricsOrFn,
          }),
          false,
          'setTestingMetrics'
        ),
      updateTestingMetrics: (updates) =>
        set((state) => ({ testingMetrics: { ...state.testingMetrics, ...updates } }), false, 'updateTestingMetrics'),

      // -----------------------------------------------------------------------
      // Modal Actions
      // -----------------------------------------------------------------------
      setShowComplexBuildModal: (showComplexBuildModal) =>
        set({ showComplexBuildModal }, false, 'setShowComplexBuildModal'),
      setComplexBuildContext: (complexBuildContext) =>
        set({ complexBuildContext }, false, 'setComplexBuildContext'),

      // -----------------------------------------------------------------------
      // Bulk Actions
      // -----------------------------------------------------------------------
      resetStore: () => set(initialState, false, 'resetStore'),
      initializeForProject: (projectId) =>
        set(
          {
            ...initialState,
            phase: 'loading',
          },
          false,
          'initializeForProject'
        ),
    }),
    { name: 'build-page-store' }
  )
);

// ============================================================================
// Selector Hooks (for performance - only re-render when specific state changes)
// ============================================================================

// Core selectors
export const usePhase = () => useBuildPageStore((state) => state.phase);
export const useTasks = () => useBuildPageStore((state) => state.tasks);
export const useEpics = () => useBuildPageStore((state) => state.epics);
export const useAgentMessages = () => useBuildPageStore((state) => state.agentMessages);
export const useIsStreaming = () => useBuildPageStore((state) => state.isStreaming);

// Metrics selectors
export const useBuildMetrics = () => useBuildPageStore((state) => state.buildMetrics);
export const useTestingMetrics = () => useBuildPageStore((state) => state.testingMetrics);
export const useSecurityMetrics = () => useBuildPageStore((state) => state.securityMetrics);

// Iteration selectors
export const useIterationState = () => useBuildPageStore((state) => state.iterationState);
export const useIsIterating = () => useBuildPageStore((state) => state.isIterating);
export const useUserPrompt = () => useBuildPageStore((state) => state.userPrompt);

// Connection selectors
export const useConnectionStatus = () => useBuildPageStore((state) => state.connectionStatus);
export const useHasCheckpoint = () => useBuildPageStore((state) => state.hasCheckpoint);

// Research selectors
export const useIsResearching = () => useBuildPageStore((state) => state.isResearching);
export const useResearchSuggestions = () => useBuildPageStore((state) => state.researchSuggestions);

// Mode selectors
export const useOverviewMode = () => useBuildPageStore((state) => state.overviewMode);
export const useIsFixing = () => useBuildPageStore((state) => state.isFixing);

// Agent selectors
export const useAgentStatuses = () => useBuildPageStore((state) => state.agentStatuses);

// Build log selectors
export const useBuildLogs = () => useBuildPageStore((state) => state.buildLogs);
export const useError = () => useBuildPageStore((state) => state.error);

// File selectors
export const useFileContents = () => useBuildPageStore((state) => state.fileContents);

export default useBuildPageStore;
