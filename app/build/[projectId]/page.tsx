'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Code2,
  CheckCircle,
  Circle,
  Loader2,
  FileCode,
  Terminal,
  ArrowLeft,
  Home,
  Play,
  Clock,
  AlertCircle,
  Monitor,
  FolderTree,
  RefreshCw,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Square,
  Send,
  Wrench,
  MessageSquare,
  Bot,
  Shield,
  TestTube,
  Users,
  Kanban,
  LayoutGrid,
  ListTree,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Hash,
  User,
  Target,
  CheckSquare,
  Edit3,
  Plus,
  Lightbulb,
  Settings,
  FileText,
  Zap,
  Command,
  BookOpen,
  GitBranch,
  Key,
  Check,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Info,
  RotateCcw,
  Save,
  Sliders,
  Heart,
  Stethoscope,
  Activity,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Cloud,
  Pause,
  Wifi,
  WifiOff,
  Rocket,
  Globe,
  Paintbrush,
  ClipboardList,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { ArchitecturePanel } from '@/components/panels/ArchitecturePanel';
import { EpicCapabilitiesExplorer } from '@/components/epic/EpicCapabilitiesExplorer';
import { cn } from '@/lib/utils';
import { BuildingStateOverlay } from '@/components/BuildingStateOverlay';
import { PreBuildQuestionnaire, PreBuildAnswers } from '@/components/healthcare/PreBuildQuestionnaire';
import { ComplexBuildModal } from '@/components/ComplexBuildModal';
import { useProjectStore } from '@/stores/project-store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { DesignSystemSelector } from '@/components/design-system/DesignSystemSelector';
import {
  SecurityTab,
  TestingTab,
  SettingsTab,
  BuildTab,
  DevelopmentTab,
  ComplianceTab,
  DeployTab,
  AuditTab,
  UATTab,
  ProjectWorkspace,
  IteratePage,
  StoryDetailModal,
  BuildPageHeader,
} from '@/features/build/components';
import type { IterationState, OverviewMode } from '@/features/build/types';
import { useUIState, useSettingsState, usePreviewServer, useSSESync } from '@/features/build/hooks';
import {
  useBuildPageStore,
  usePhase,
  useTasks,
  useEpics,
  useAgentMessages,
  useIsStreaming,
  useError,
  useConnectionStatus,
  useHasCheckpoint,
  useBuildMetrics,
  useTestingMetrics,
  useSecurityMetrics,
  useAgentStatuses,
  useBuildLogs,
  useFileContents,
  useIsIterating,
  useIsFixing,
  useIsResearching,
  useResearchSuggestions,
  useOverviewMode,
  useUserPrompt,
} from '@/features/build/stores';
import {
  startNewBuildOnExistingProject,
  buildExistingProjectRequirements,
  buildFigmaExistingProjectRequirements,
  setupFigmaForBuild,
} from '@/features/build/services';
import type {
  Epic,
  Task,
  AgentMessage,
  ResearchSuggestion,
  FileChange,
  BuildLog,
  BuildMetrics,
  DoraMetrics,
  SecurityMetrics,
  TestingMetrics,
  TreeNode,
  BuildPhase,
  QuickSettings,
  MainTab,
  PreviewStatus,
  ConnectionStatus,
  CheckpointInfo,
} from '@/features/build/types';
import {
  AGENT_COLORS,
  AGENT_BG_COLORS,
  AGENT_ICONS,
  KANBAN_COLUMNS,
  DEFAULT_BUILD_METRICS,
  DEFAULT_TESTING_METRICS,
  DEFAULT_SECURITY_METRICS,
  DEFAULT_DORA_METRICS,
  DEFAULT_QUICK_SETTINGS,
  MAX_RECONNECT_ATTEMPTS,
} from '@/features/build/constants';
export default function BuildPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const projectId = params.projectId as string;

  // Complex Build from Quick Build state
  const [showComplexBuildModal, setShowComplexBuildModal] = useState(false);
  const [complexBuildContext, setComplexBuildContext] = useState<{
    projectId: string;
    originalRequirements: string;
    generatedPrompt: string;
    filesCreated: string[];
    databaseConfig?: { provider: string; schemaTemplate: string } | null;
  } | null>(null);

  // ===========================================================================
  // Core state from Zustand store (replacing local useState)
  // ===========================================================================
  const phase = usePhase();
  const tasks = useTasks();
  const epics = useEpics();
  const agentMessages = useAgentMessages();
  const isStreaming = useIsStreaming();
  const error = useError();
  const connectionStatus = useConnectionStatus();
  const hasCheckpoint = useHasCheckpoint();
  const agentStatuses = useAgentStatuses();
  const buildMetrics = useBuildMetrics();
  const testingMetrics = useTestingMetrics();
  const securityMetrics = useSecurityMetrics();
  const buildLogs = useBuildLogs();
  const fileContents = useFileContents();
  const isIterating = useIsIterating();
  const isFixing = useIsFixing();
  const isResearching = useIsResearching();
  const researchSuggestions = useResearchSuggestions();
  const overviewMode = useOverviewMode();
  const userPrompt = useUserPrompt();

  // Get store actions for updates
  const {
    setPhase,
    setTasks,
    addTask,
    updateTask,
    setEpics,
    addEpic,
    setAgentMessages,
    addAgentMessage,
    setIsStreaming,
    setError,
    setConnectionStatus,
    setHasCheckpoint,
    setCheckpointInfo,
    setAgentStatuses,
    updateAgentStatus,
    setBuildMetrics,
    setTestingMetrics,
    setSecurityMetrics,
    setBuildLogs,
    addBuildLog: storeAddBuildLog,
    setFileContents,
    updateFileContent,
    setIsIterating,
    setIsFixing,
    setIsResearching,
    setResearchSuggestions,
    addResearchSuggestion,
    setOverviewMode,
    setUserPrompt,
    setProjectName,
    setProjectDirectory,
    setRequirements,
    setFoundationComplete,
    setFileChanges,
    addFileChange,
    setLastHeartbeat,
    setReconnectAttempt,
    resetStore,
  } = useBuildPageStore();

  // Reset store when projectId changes (switching projects)
  useEffect(() => {
    resetStore();
  }, [projectId, resetStore]);

  // Local state that's NOT in the store (specific to this page)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null);
  const [iterationRequest, setIterationRequest] = useState<string | null>(null);

  // Connection resilience state (reconnectTimeoutRef is local, rest from store)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Read additional state from store
  const projectName = useBuildPageStore((state) => state.projectName);
  const projectDirectory = useBuildPageStore((state) => state.projectDirectory);
  const requirements = useBuildPageStore((state) => state.requirements);
  const reconnectAttempt = useBuildPageStore((state) => state.reconnectAttempt);
  const lastHeartbeat = useBuildPageStore((state) => state.lastHeartbeat);
  const checkpointInfo = useBuildPageStore((state) => state.checkpointInfo);
  const foundationComplete = useBuildPageStore((state) => state.foundationComplete);

  // UI state (from useUIState hook)
  const {
    mainTab,
    setMainTab,
    taskBoardView,
    setTaskBoardView,
    expandedEpics,
    setExpandedEpics,
    toggleEpic,
    epicSortBy,
    setEpicSortBy,
    epicSortDir,
    setEpicSortDir,
    selectedStory,
    setSelectedStory,
    selectedFile,
    setSelectedFile,
    expandedFolders,
    setExpandedFolders,
    toggleFolder,
    showResearchPanel,
    setShowResearchPanel,
    showEpicExplorer,
    setShowEpicExplorer,
    settingsTab,
    setSettingsTab,
  } = useUIState({
    initialTab: (searchParams.get('tab') as any) || 'build',
  });

  // Sync tab from URL when navigating between projects
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    if (tabFromUrl) {
      setMainTab(tabFromUrl as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, searchParams.get('tab')]);

  // File contents now from store; useMultiAgent is local config
  const useMultiAgent = useBuildPageStore((state) => state.useMultiAgent);
  const setUseMultiAgent = useBuildPageStore((state) => state.setUseMultiAgent);

  // Git repository configuration
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [isCloningRepo, setIsCloningRepo] = useState(false);
  const [gitCloneError, setGitCloneError] = useState<string | null>(null);

  // Settings state (from useSettingsState hook)
  const {
    parallelCoders,
    setParallelCoders,
    batchMode,
    setBatchMode,
    batchSize,
    setBatchSize,
    agentConfigs,
    setAgentConfigs,
    quickSettings,
    setQuickSettings,
    savingSettings,
    settingsSuccess,
    setSettingsSuccess,
    loadAgentConfig,
    saveQuickSettings,
  } = useSettingsState();

  // Preview state (from usePreviewServer hook)
  const {
    previewUrl,
    previewKey,
    previewStatus,
    previewError,
    startDevServer,
    stopDevServer,
    refreshPreview,
    setPreviewKey,
    setPreviewUrl,
    setPreviewStatus,
    setPreviewError,
  } = usePreviewServer({
    projectId,
    onLog: (msg, type) => {
      if (type === 'error') console.error(msg);
      else console.log(msg);
    },
  });
  // foundationComplete now from store

  // Pre-scaffold state (local - specific to initial build flow)
  const isScaffolding = useBuildPageStore((state) => state.isScaffolding);
  const setIsScaffolding = useBuildPageStore((state) => state.setIsScaffolding);
  const scaffoldStatus = useBuildPageStore((state) => state.scaffoldStatus);
  const setScaffoldStatus = useBuildPageStore((state) => state.setScaffoldStatus);
  const scaffoldMessage = useBuildPageStore((state) => state.scaffoldMessage);
  const setScaffoldMessage = useBuildPageStore((state) => state.setScaffoldMessage);
  const isProjectScaffolded = useBuildPageStore((state) => state.isProjectScaffolded);
  const setIsProjectScaffolded = useBuildPageStore((state) => state.setIsProjectScaffolded);

  // Build state - userPrompt, isIterating, isFixing, overviewMode now from store selectors
  const fixerMessages = useBuildPageStore((state) => state.fixerMessages);
  const setFixerMessages = useBuildPageStore((state) => state.setFixerMessages);
  // Track current build number (for history)
  const [currentBuildNumber, setCurrentBuildNumber] = useState<number>(1);
  // Track if project has existing builds (for iterate mode UI)
  const [hasExistingBuilds, setHasExistingBuilds] = useState<boolean>(false);

  // Research state - isResearching, researchSuggestions now from store selectors

  // Healthcare mode state
  const [isHealthcareMode, setIsHealthcareMode] = useState(false);
  const [showPreBuildQuestionnaire, setShowPreBuildQuestionnaire] = useState(false);
  const [healthcareSettings, setHealthcareSettings] = useState<PreBuildAnswers | null>(null);

  // Quick Command state
  const [quickCommand, setQuickCommand] = useState('');
  const [isRunningQuickCommand, setIsRunningQuickCommand] = useState(false);
  const [quickCommandOutput, setQuickCommandOutput] = useState<string[]>([]);

  // Build output state - buildLogs, buildMetrics, testingMetrics, securityMetrics now from store selectors

  // DevSecOps Metrics - doraMetrics is local (not frequently updated via events)
  const doraMetrics = useBuildPageStore((state) => state.doraMetrics);
  const setDoraMetrics = useBuildPageStore((state) => state.setDoraMetrics);

  const terminalRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const buildLogRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messageIdCounter = useRef(0);

  // WebSocket connection for real-time updates from background builds
  const { connected: wsConnected, on: wsOn, off: wsOff } = useWebSocket({
    projectId,
    autoConnect: true
  });

  // =========================================================================
  // Zustand Store Integration
  // =========================================================================
  // SSE sync populates the store from server events
  // All state now read directly from store - no bidirectional sync needed
  const { connect: connectSSE, disconnect: disconnectSSE } = useSSESync({
    projectId,
    autoConnect: false, // We'll connect manually when streaming starts
  });

  // Check if project has package.json or HTML files (for static sites)
  const hasPackageJson = Array.from(fileContents.keys()).some(f => f === 'package.json' || f.endsWith('/package.json'));
  const hasIndexHtml = Array.from(fileContents.keys()).some(f => f === 'index.html' || f.endsWith('/index.html'));
  const hasAnyHtml = Array.from(fileContents.keys()).some(f => f.endsWith('.html'));
  const firstHtmlFile = Array.from(fileContents.keys()).find(f => f === 'index.html' || f.endsWith('/index.html')) ||
                        Array.from(fileContents.keys()).find(f => f.endsWith('.html'));
  const canPreview = hasIndexHtml || hasAnyHtml || fileContents.size > 0;
  const canServe = hasPackageJson || hasIndexHtml;

  // loadAgentConfig is now provided by useSettingsState hook

  // Load agent mode config (healthcare vs default)
  const loadAgentModeConfig = async () => {
    try {
      const response = await fetch('/api/config/agent-mode');
      if (response.ok) {
        const config = await response.json();
        setIsHealthcareMode(config.mode === 'healthcare');
        if (config.healthcareSettings) {
          setHealthcareSettings({
            includeEpicAPIs: config.healthcareSettings.includeEpicAPIs ?? true,
            includeTestPatients: config.healthcareSettings.includeTestPatients ?? true,
            includeFHIRExamples: config.healthcareSettings.includeFHIRExamples ?? true,
            complianceLevel: config.healthcareSettings.complianceLevel ?? 'hipaa',
            appType: 'clinical',
            dataTypes: ['patient-demographics', 'conditions', 'medications'],
          });
        }
        console.log(`🏥 Agent mode: ${config.mode}`);
      }
    } catch (err) {
      console.error('Failed to load agent mode config:', err);
    }
  };

  // Check for existing checkpoint on mount
  const checkForCheckpoint = useCallback(async () => {
    try {
      const response = await fetch(`/api/v2/multi-agent/resume?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.hasCheckpoint && data.checkpoint) {
          setHasCheckpoint(true);
          setCheckpointInfo({
            phase: data.checkpoint.phase,
            taskCount: data.checkpoint.taskCount,
            timestamp: data.checkpoint.timestamp,
          });
          console.log('[Build] Checkpoint found:', data.checkpoint);
        }
      }
    } catch (err) {
      console.log('[Build] No checkpoint found or error checking:', err);
    }
  }, [projectId]);

  // Load project and agent config on mount
  // Check if project is already scaffolded on load
  const checkScaffoldStatus = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/scaffold`);
      if (res.ok) {
        const data = await res.json();
        if (!data.needsScaffolding) {
          setIsProjectScaffolded(true);
          setScaffoldStatus('done');
          setFoundationComplete(true);
        }
      }
    } catch {
      // Ignore errors, scaffold check is optional
    }
  };

  useEffect(() => {
    loadProject();
    loadAgentConfig();
    checkForCheckpoint();
    loadAgentModeConfig();
    checkScaffoldStatus();
  }, [projectId]);

  // Load build history when projectDirectory becomes available
  useEffect(() => {
    if (!projectDirectory) return;

    const loadBuildHistory = async () => {
      try {
        const response = await fetch(`/api/build-history?projectId=${projectId}&projectDirectory=${encodeURIComponent(projectDirectory)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.currentBuild) {
            setCurrentBuildNumber(data.currentBuild.buildNumber);
            console.log('[Build] Loaded build history:', { buildNumber: data.currentBuild.buildNumber });
          }
          // Check if project has existing builds (for iterate mode UI)
          // Project has existing builds if: API says so OR there's more than 1 build OR current build > 1
          const hasBuilds = data.isExistingProject ||
            (data.builds && data.builds.length > 1) ||
            (data.currentBuild && data.currentBuild.buildNumber > 1);
          setHasExistingBuilds(hasBuilds);
          console.log('[Build] Has existing builds:', hasBuilds);
        }
      } catch (err) {
        console.log('[Build] No build history found');
      }
    };

    loadBuildHistory();
  }, [projectDirectory, projectId]);

  // Check for Complex Build from Quick Build
  useEffect(() => {
    const fromQuickBuild = searchParams.get('fromQuickBuild');
    if (fromQuickBuild === 'true') {
      const storedContext = sessionStorage.getItem('complexBuildFromQuickBuild');
      if (storedContext) {
        try {
          const context = JSON.parse(storedContext);
          setComplexBuildContext(context);
          setShowComplexBuildModal(true);
          // Clear sessionStorage after loading
          sessionStorage.removeItem('complexBuildFromQuickBuild');
          // Clear the URL param without reload
          window.history.replaceState({}, '', `/build/${projectId}`);
        } catch (e) {
          console.error('Failed to parse complex build context:', e);
        }
      }
    }
  }, [searchParams, projectId]);

  // WebSocket listeners for real-time updates from background builds
  useEffect(() => {
    if (!wsConnected) return;

    const handleAgentStatus = (data: any) => {
      // Only handle events for this project
      if (data.projectId && data.projectId !== projectId) return;

      setAgentStatuses(prev => {
        const updated = new Map(prev);
        updated.set(data.role || data.type, data.status);
        if (data.agentId && data.agentId !== data.role) {
          updated.set(data.agentId, data.status);
        }
        return updated;
      });

      // If an agent is working, we're building
      if (data.status === 'working' && phase !== 'building') {
        setPhase('building');
      }
    };

    const handleAgentMessage = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;

      // Use the original message ID for deduplication (SSE and WebSocket send the same message)
      const messageId = data.id || `ws-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      setAgentMessages(prev => {
        // Check if message already exists (prevents duplicates from SSE + WebSocket)
        if (prev.some(m => m.id === messageId)) {
          return prev; // Skip duplicate
        }
        return [...prev, {
          id: messageId,
          agentRole: data.agentRole || data.role || 'coordinator',
          agentName: data.agentName || data.role || 'Agent',
          type: data.type || 'action',
          content: data.content,
          toolName: data.toolName,
          timestamp: data.timestamp || new Date().toISOString(),
          instanceNumber: data.instanceNumber,
          storyId: data.storyId, // Preserve storyId for filtering in story detail modal
        }];
      });
    };

    const handleWorkflowCompleted = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;

      console.log('📡 WebSocket: workflow:completed received');
      setPhase('completed');
      // Reload full project state to get final metrics
      loadProject();
    };

    const handleWorkflowError = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;

      console.log('📡 WebSocket: workflow:error received', data.error);
      setPhase('error');
      setError(data.error || 'Workflow failed');
    };

    const handleWorkflowStopped = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;

      console.log('📡 WebSocket: workflow:stopped received');
      setPhase('planned');
      setIsStreaming(false);
      // Clear agent statuses
      setAgentStatuses(new Map());
    };

    const handleTaskUpdate = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      console.log('📋 [Kanban] task:update (WebSocket):', { id: data.id, status: data.status, assignedTo: data.assignedTo });

      // Status priority: higher = more progressed (prevent downgrades)
      // 'failed' has same priority as 'done'/'completed' since it's a terminal state
      const STATUS_PRIORITY_WS: Record<string, number> = {
        'backlog': 0, 'pending': 0, 'in_progress': 1, 'testing': 2, 'done': 3, 'completed': 3, 'failed': 3,
      };

      // Valid "downgrade" transitions that are actually forward progress (retry cycles)
      const isValidRetryTransition = (from: string, to: string): boolean => {
        // failed → in_progress: coder fixing a failed story
        // failed → backlog: story returned for re-planning
        if (from === 'failed' && (to === 'in_progress' || to === 'backlog')) return true;
        return false;
      };

      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === data.id);
        if (existingIndex === -1) {
          // Task doesn't exist - create it (upsert behavior)
          console.log('📋 [Kanban] task:update - Task not found, creating:', data.id);
          const newTask = {
            id: data.id,
            title: data.title || 'Untitled Task',
            description: data.description || '',
            status: data.status || 'backlog',
            epicId: data.epicId,
            storyPoints: data.storyPoints,
            priority: data.priority || 'medium',
            acceptanceCriteria: data.acceptanceCriteria || [],
            assignedTo: data.assignedTo,
          };
          return [...prev, newTask];
        }
        // Check if this would be a downgrade
        const currentStatus = prev[existingIndex].status;
        const newStatus = data.status || currentStatus;
        const currentPriority = STATUS_PRIORITY_WS[currentStatus] ?? 0;
        const newPriority = STATUS_PRIORITY_WS[newStatus] ?? 0;
        // Allow retry transitions (failed → in_progress/backlog)
        if (newPriority < currentPriority) {
          if (isValidRetryTransition(currentStatus, newStatus)) {
            console.log('📋 [Kanban] task:update RETRY CYCLE:', { id: data.id, from: currentStatus, to: newStatus, reason: 'valid retry transition (failed story being fixed)' });
          } else {
            console.log('📋 [Kanban] task:update BLOCKED (downgrade):', { id: data.id, from: currentStatus, to: newStatus });
            return prev; // Don't allow downgrade
          }
        }
        // Task exists - update all fields
        console.log('📋 [Kanban] task:update - Updating task:', data.id, currentStatus, '->', newStatus);
        return prev.map(task =>
          task.id === data.id
            ? { ...task, ...data, epicId: data.epicId ?? task.epicId }
            : task
        );
      });
    };

    // Handle workflow started - set phase to building
    const handleWorkflowStarted = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      console.log('📡 WebSocket: workflow:started received');
      setPhase('building');
    };

    // Handle epics created - APPEND to existing epics (preserve history)
    const handleEpicsCreated = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      console.log('📡 WebSocket: epics:created received', data);
      const newEpics = Array.isArray(data) ? data : data.epics || [];
      setEpics(prev => {
        // Merge: add new epics that don't already exist
        const existingIds = new Set(prev.map(e => e.id));
        const uniqueNewEpics = newEpics.filter((e: any) => !existingIds.has(e.id));
        if (uniqueNewEpics.length > 0) {
          console.log('📚 Adding', uniqueNewEpics.length, 'new epics to existing', prev.length);
          return [...prev, ...uniqueNewEpics];
        }
        return prev;
      });
    };

    // Handle stories/tasks created - APPEND to existing tasks (preserve history)
    const handleStoriesCreated = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      console.log('📡 WebSocket: stories:created received', data);
      const stories = Array.isArray(data) ? data : data.stories || [];
      const tasksFromStories = stories.map((s: any) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        status: s.status || 'pending',
        epicId: s.epicId,
        storyPoints: s.storyPoints,
        priority: s.priority,
        acceptanceCriteria: s.acceptanceCriteria || s.acceptance_criteria || [],
      }));
      setTasks(prev => {
        // Merge: add new tasks that don't already exist
        const existingIds = new Set(prev.map(t => t.id));
        const uniqueNewTasks = tasksFromStories.filter((t: any) => !existingIds.has(t.id));
        if (uniqueNewTasks.length > 0) {
          console.log('📋 Adding', uniqueNewTasks.length, 'new tasks to existing', prev.length);
          return [...prev, ...uniqueNewTasks];
        }
        return prev;
      });
    };

    // Handle story started - set status to in_progress
    const handleStoryStarted = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      const taskId = data.storyId || data.id;
      // GUARD: Don't create tasks with undefined ID - this was causing all messages to appear in one story
      if (!taskId) {
        console.warn('📋 [Kanban] story:started - SKIPPED: missing taskId in event data:', data);
        return;
      }
      console.log('📋 [Kanban] story:started - setting in_progress:', taskId, 'agent:', data.agentId);
      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === taskId);
        if (existingIndex === -1) {
          // Story doesn't exist yet - create it
          console.log('📋 [Kanban] story:started - Story not found, creating:', taskId);
          return [...prev, {
            id: taskId,
            title: data.storyTitle || data.title || 'Story',
            description: data.description || '',
            status: 'in_progress',
            epicId: data.epicId,
            storyPoints: data.storyPoints,
            priority: data.priority || 'medium',
            acceptanceCriteria: [],
            assignedTo: data.agentId,
          }];
        }
        return prev.map(task =>
          task.id === taskId ? { ...task, status: 'in_progress', assignedTo: data.agentId } : task
        );
      });
    };

    // Handle story completed - set status to completed
    const handleStoryCompleted = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      const taskId = data.storyId || data.id;
      if (!taskId) {
        console.warn('📋 [Kanban] story:completed - SKIPPED: missing taskId in event data:', data);
        return;
      }
      console.log('📋 [Kanban] story:completed - setting completed:', taskId);
      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === taskId);
        if (existingIndex === -1) {
          // Story doesn't exist yet - create it as completed
          console.log('📋 [Kanban] story:completed - Story not found, creating as completed:', taskId);
          return [...prev, {
            id: taskId,
            title: data.storyTitle || data.title || 'Story',
            description: data.description || '',
            status: 'completed',
            epicId: data.epicId,
            storyPoints: data.storyPoints,
            priority: data.priority || 'medium',
            acceptanceCriteria: [],
          }];
        }
        return prev.map(task =>
          task.id === taskId ? { ...task, status: 'completed' } : task
        );
      });
    };

    // Handle story failed - set status to failed
    const handleStoryFailed = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      const taskId = data.storyId || data.id;
      if (!taskId) {
        console.warn('📋 [Kanban] story:failed - SKIPPED: missing taskId in event data:', data);
        return;
      }
      console.log('📋 [Kanban] story:failed - setting failed:', taskId, 'error:', data.error);
      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === taskId);
        if (existingIndex === -1) {
          // Story doesn't exist yet - create it as failed
          console.log('📋 [Kanban] story:failed - Story not found, creating as failed:', taskId);
          return [...prev, {
            id: taskId,
            title: data.storyTitle || data.title || 'Story',
            description: data.description || '',
            status: 'failed',
            epicId: data.epicId,
            storyPoints: data.storyPoints,
            priority: data.priority || 'medium',
            acceptanceCriteria: [],
            error: data.error,
          }];
        }
        return prev.map(task =>
          task.id === taskId ? { ...task, status: 'failed', error: data.error } : task
        );
      });
    };

    // Handle story testing - set status to testing
    const handleStoryTesting = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      const taskId = data.storyId || data.id;
      if (!taskId) {
        console.warn('📋 [Kanban] story:testing - SKIPPED: missing taskId in event data:', data);
        return;
      }
      console.log('📋 [Kanban] story:testing - setting testing:', taskId);
      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === taskId);
        if (existingIndex === -1) {
          // Story doesn't exist yet - create it in testing
          console.log('📋 [Kanban] story:testing - Story not found, creating in testing:', taskId);
          return [...prev, {
            id: taskId,
            title: data.storyTitle || data.title || 'Story',
            description: data.description || '',
            status: 'testing',
            epicId: data.epicId,
            storyPoints: data.storyPoints,
            priority: data.priority || 'medium',
            acceptanceCriteria: [],
            assignedTo: 'tester',
          }];
        }
        return prev.map(task =>
          task.id === taskId ? { ...task, status: 'testing', assignedTo: 'tester' } : task
        );
      });
    };

    // Handle generic story updates
    const handleStoryUpdated = (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      const taskId = data.storyId || data.id;
      if (!taskId) {
        console.warn('📋 [Kanban] story:updated - SKIPPED: missing taskId in event data:', data);
        return;
      }
      console.log('📋 [Kanban] story:updated:', taskId, 'status:', data.status);
      setTasks(prev => {
        const existingIndex = prev.findIndex(t => t.id === taskId);
        if (existingIndex === -1) {
          // Story doesn't exist yet - create it
          console.log('📋 [Kanban] story:updated - Story not found, creating:', taskId);
          return [...prev, {
            id: taskId,
            title: data.storyTitle || data.title || 'Story',
            description: data.description || '',
            status: data.status || 'backlog',
            epicId: data.epicId,
            storyPoints: data.storyPoints,
            priority: data.priority || 'medium',
            acceptanceCriteria: data.acceptanceCriteria || [],
            assignedTo: data.assignedTo,
          }];
        }
        return prev.map(task =>
          task.id === taskId ? { ...task, ...data } : task
        );
      });
    };

    // Handle code changes - refresh files
    const handleCodeChanged = async (data: any) => {
      if (data.projectId && data.projectId !== projectId) return;
      // Trigger a file refresh directly
      try {
        const response = await fetch(`/api/projects/${projectId}/files`);
        if (response.ok) {
          const fileData = await response.json();
          const files = fileData.files || [];
          const newContents = new Map<string, string>();
          files.forEach((f: any) => newContents.set(f.path, f.content));
          setFileContents(newContents);
        }
      } catch (err) {
        console.error('Failed to fetch files on code change:', err);
      }
    };

    wsOn('agent:status', handleAgentStatus);
    wsOn('agent:message', handleAgentMessage);
    wsOn('workflow:started', handleWorkflowStarted);
    wsOn('workflow:completed', handleWorkflowCompleted);
    wsOn('workflow:error', handleWorkflowError);
    wsOn('workflow:stopped', handleWorkflowStopped);
    wsOn('task:update', handleTaskUpdate);
    wsOn('epics:created', handleEpicsCreated);
    wsOn('stories:created', handleStoriesCreated);
    wsOn('story:started', handleStoryStarted);
    wsOn('story:completed', handleStoryCompleted);
    wsOn('story:failed', handleStoryFailed);
    wsOn('story:testing', handleStoryTesting);
    wsOn('story:updated', handleStoryUpdated);
    wsOn('code:changed', handleCodeChanged);

    return () => {
      wsOff('agent:status', handleAgentStatus);
      wsOff('agent:message', handleAgentMessage);
      wsOff('workflow:started', handleWorkflowStarted);
      wsOff('workflow:completed', handleWorkflowCompleted);
      wsOff('workflow:error', handleWorkflowError);
      wsOff('workflow:stopped', handleWorkflowStopped);
      wsOff('task:update', handleTaskUpdate);
      wsOff('epics:created', handleEpicsCreated);
      wsOff('stories:created', handleStoriesCreated);
      wsOff('story:started', handleStoryStarted);
      wsOff('story:completed', handleStoryCompleted);
      wsOff('story:failed', handleStoryFailed);
      wsOff('story:testing', handleStoryTesting);
      wsOff('story:updated', handleStoryUpdated);
      wsOff('code:changed', handleCodeChanged);
    };
  }, [wsConnected, wsOn, wsOff, projectId, phase]);

  // Poll for project status when not actively streaming (fallback for sync)
  useEffect(() => {
    // Only poll when we're not actively streaming (SSE handles updates during builds we started)
    if (isStreaming) return;

    const pollProjectStatus = async () => {
      try {
        const response = await fetch(`/api/projects/${projectId}/state`);
        if (response.ok) {
          const data = await response.json();
          const state = data.state;
          if (state) {
            // Update phase based on server status
            if (state.status === 'completed' && phase !== 'completed') {
              setPhase('completed');
              loadProject(); // Load full state
            } else if (state.status === 'error' && phase !== 'error') {
              setPhase('error');
            } else if (['planning', 'developing', 'testing', 'deploying'].includes(state.status) && phase !== 'building') {
              setPhase('building');
            }
            // Update progress if different
            if (state.progress !== undefined && state.progress > 0) {
              setBuildMetrics(prev => ({
                ...prev,
                elapsedTime: state.buildMetrics?.elapsedTime || prev.elapsedTime,
              }));
            }
          }
        }
      } catch (err) {
        // Ignore polling errors
      }
    };

    // Poll every 5 seconds
    const interval = setInterval(pollProjectStatus, 5000);
    // Also poll immediately on mount
    pollProjectStatus();

    return () => clearInterval(interval);
  }, [projectId, isStreaming, phase]);

  // Auto-scroll agent terminals when new messages arrive
  useEffect(() => {
    // Scroll each agent's terminal to bottom
    terminalRefs.current.forEach((el) => {
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    });
  }, [agentMessages]);

  // Auto-scroll build logs (only if user is near bottom)
  useEffect(() => {
    if (buildLogRef.current) {
      const el = buildLogRef.current;
      // Only auto-scroll if user is within 100px of the bottom (not manually scrolled up)
      const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      if (isNearBottom) {
        setTimeout(() => {
          if (buildLogRef.current) {
            buildLogRef.current.scrollTop = buildLogRef.current.scrollHeight;
          }
        }, 10);
      }
    }
  }, [buildLogs]);

  // Update elapsed time during build
  useEffect(() => {
    if (phase === 'building' && buildMetrics.startTime > 0) {
      const interval = setInterval(() => {
        setBuildMetrics(prev => ({
          ...prev,
          elapsedTime: Date.now() - prev.startTime,
        }));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, buildMetrics.startTime]);

  // Helper to add build log
  const addBuildLog = useCallback((type: BuildLog['type'], message: string, detail?: string) => {
    setBuildLogs(prev => [...prev, {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      detail,
      timestamp: new Date(),
    }]);
  }, []);

  // Fetch files immediately when phase changes, then poll during builds
  useEffect(() => {
    if (phase === 'building' || phase === 'completed') {
      // Fetch immediately on phase change
      fetchFiles();
      // Only poll during active builds (not needed for completed projects after initial load)
      if (phase === 'building') {
        const interval = setInterval(fetchFiles, 5000);
        return () => clearInterval(interval);
      }
    }
  }, [phase, projectId]);

  // Track if we've attempted to start preview for this build/session
  const previewAttemptedRef = useRef(false);

  // Reset preview attempt flag when phase changes to building OR when projectId changes
  useEffect(() => {
    // Reset when starting a new build
    if (phase === 'building') {
      previewAttemptedRef.current = false;
      setPreviewStatus('idle');
      setPreviewUrl(null);
      setPreviewError(null);
    }
  }, [phase]);

  // Auto-switch to "build" tab (kanban) when streaming starts
  // This ensures users see the kanban board instead of the iterate input during a build
  useEffect(() => {
    if (isStreaming && mainTab === 'plan') {
      console.log('[Build] Auto-switching to build tab (kanban) as streaming started');
      setMainTab('build');
    }
  }, [isStreaming, mainTab, setMainTab]);

  // Reset stale building state - if phase is 'building' but nothing is streaming,
  // reset to 'planned' so user can start a new build (handles stale state from failed builds)
  useEffect(() => {
    if (phase === 'building' && !isStreaming) {
      // Wait a short delay to avoid race conditions during startup
      const timeout = setTimeout(() => {
        // The effect cleanup will clear this timeout if phase/isStreaming change
        // So if we reach here, the conditions still hold
        console.log('[Build] Resetting stale building state to planned');
        setPhase('planned');
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [phase, isStreaming]);

  const loadProject = async () => {
    try {
      // First check if project has an active orchestrator (is currently running)
      const projectResponse = await fetch(`/api/projects/${projectId}`);
      console.log('[loadProject] Fetched /api/projects/' + projectId, { ok: projectResponse.ok });
      if (projectResponse.ok) {
        const projectData = await projectResponse.json();
        console.log('[loadProject] Project data:', {
          hasOrchestrator: !!projectData.orchestratorState,
          projectDirectory: projectData.projectDirectory,
          name: projectData.config?.name
        });

        // ALWAYS set projectDirectory if available from this API
        if (projectData.projectDirectory) {
          setProjectDirectory(projectData.projectDirectory);
          console.log('[loadProject] Set projectDirectory:', projectData.projectDirectory);
        }

        // Set hasExistingBuilds early for GitHub/existing projects to prevent column flash
        if (projectData.source === 'github' || projectData.gitUrl) {
          setHasExistingBuilds(true);
          console.log('📦 GitHub project detected - using iterate mode (4 columns)');
        }

        // If there's an active orchestrator, the project is running - set building phase
        if (projectData.orchestratorState) {
          console.log('🔄 Project has active orchestrator - resuming live view');
          setPhase('building');
          setProjectName(projectData.config?.name || projectData.orchestratorState?.config?.name || projectId);
          setRequirements(projectData.requirements || '');
          if (projectData.projectDirectory) {
            setProjectDirectory(projectData.projectDirectory);
          }

          // Load current state from orchestrator
          const orchState = projectData.orchestratorState;
          if (orchState.epics?.length > 0) {
            setEpics(orchState.epics);
          }
          if (orchState.stories?.length > 0) {
            // Map stories to tasks format
            const tasksFromStories = orchState.stories.map((s: any) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              status: s.status,
              epicId: s.epicId,
              storyPoints: s.storyPoints,
              priority: s.priority,
              acceptanceCriteria: s.acceptanceCriteria || s.acceptance_criteria || [],
              assignedTo: s.assignedTo || s.assigned_to,
            }));
            setTasks(tasksFromStories);
          }
          if (orchState.agents?.length > 0) {
            // Update agent statuses
            const statusMap = new Map<string, string>();
            orchState.agents.forEach((agent: any) => {
              statusMap.set(agent.type, agent.status);
            });
            setAgentStatuses(statusMap);
          }

          // Load code files from orchestrator state
          if (orchState.codeFiles?.length > 0) {
            const newContents = new Map<string, string>();
            orchState.codeFiles.forEach((f: any) => {
              newContents.set(f.path, f.content || '');
            });
            setFileContents(newContents);
            console.log('📁 Loaded', orchState.codeFiles.length, 'files from orchestrator');
          }

          // Load messages from orchestrator
          if (orchState.messages?.length > 0) {
            const mappedMessages = orchState.messages.map((m: any) => ({
              id: m.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              agentRole: m.agentType || m.role || 'coordinator',
              agentName: m.agentName || m.agentType || 'Agent',
              type: m.type || 'action',
              content: m.content,
              toolName: m.toolName,
              timestamp: m.timestamp || new Date().toISOString(),
              instanceNumber: m.instanceNumber,
              storyId: m.storyId, // Preserve storyId for filtering in story detail modal
            }));
            setAgentMessages(mappedMessages);
            console.log('💬 Loaded', mappedMessages.length, 'messages from orchestrator');
          }

          // Set build metrics with startTime so elapsed counter works
          setBuildMetrics(prev => ({
            ...prev,
            startTime: Date.now() - (orchState.progress || 0) * 1000, // Estimate start time
            filesCreated: orchState.codeFiles?.length || 0,
          }));

          // Fetch files from disk as well (might have more than orchestrator state)
          fetchFiles();

          console.log('✅ Reconnected to running project');
          return; // Don't continue loading - WebSocket will handle live updates
        }
      }

      // No active orchestrator - try to load persisted project state
      const stateResponse = await fetch(`/api/projects/${projectId}/state`);
      if (stateResponse.ok) {
        const stateData = await stateResponse.json();
        const state = stateData.state;

        if (state) {
          // Don't set projectName yet - will get it from projects list below which has the full name
          // setProjectName(state.config?.name || projectId) - this often has truncated names
          setRequirements(state.requirements || '');

          // Load tasks if available - ensure acceptanceCriteria is mapped
          if (state.tasks && state.tasks.length > 0) {
            const mappedTasks = state.tasks.map((t: any) => ({
              ...t,
              acceptanceCriteria: t.acceptanceCriteria || t.acceptance_criteria || [],
            }));
            setTasks(mappedTasks);
            console.log('📋 Loaded tasks from state:', mappedTasks.length, 'tasks');
          } else {
            console.log('ℹ️ No tasks in state to load');
          }

          // Load epics if available
          if (state.epics && state.epics.length > 0) {
            setEpics(state.epics);
            console.log('📚 Loaded epics from state:', state.epics.length, 'epics');
          } else {
            console.log('ℹ️ No epics in state to load');
          }

          // Load testing metrics if available
          if (state.testingMetrics) {
            setTestingMetrics({
              ...state.testingMetrics,
              // Ensure seenTaskIds is restored to prevent double counting
              seenTaskIds: state.testingMetrics.seenTaskIds || [],
            });
            console.log('📊 Loaded testing metrics from state:', state.testingMetrics);
          }

          // Load security metrics if available
          if (state.securityMetrics) {
            setSecurityMetrics(state.securityMetrics);
            console.log('🔒 Loaded security metrics from state:', state.securityMetrics);
          }

          // Load DORA metrics if available
          if (state.doraMetrics) {
            setDoraMetrics(state.doraMetrics);
            console.log('📈 Loaded DORA metrics from state:', state.doraMetrics);
          }

          // Load build metrics if available
          if (state.buildMetrics) {
            const savedElapsedTime = state.buildMetrics.elapsedTime || 0;
            // For in-progress builds, reconstruct startTime so the timer works
            // For completed builds, startTime doesn't matter since we just show final elapsedTime
            const shouldRestoreTimer = state.status !== 'completed' && savedElapsedTime > 0;
            setBuildMetrics(prev => ({
              ...prev,
              startTime: shouldRestoreTimer ? Date.now() - savedElapsedTime : prev.startTime,
              filesCreated: state.buildMetrics.filesCreated || 0,
              filesModified: state.buildMetrics.filesModified || 0,
              commandsRun: state.buildMetrics.commandsRun || 0,
              toolCalls: state.buildMetrics.toolCalls || 0,
              linesOfCode: state.buildMetrics.linesOfCode || 0,
              iterations: state.buildMetrics.iterations || 0,
              elapsedTime: savedElapsedTime,
            }));
            console.log('🔧 Loaded build metrics from state:', state.buildMetrics);
          }

          // Load agent messages if available
          if (state.messages && state.messages.length > 0) {
            setAgentMessages(state.messages.map((m: any) => ({
              id: m.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              agentRole: m.agentType || m.agentRole || 'coordinator',
              agentName: m.agentName || m.agentType || 'Agent',
              type: m.type || 'action',
              content: m.content,
              toolName: m.toolName,
              timestamp: m.timestamp || new Date().toISOString(),
              instanceNumber: m.instanceNumber,
              storyId: m.storyId, // Preserve storyId for filtering in story detail modal
            })));
          }

          // Set phase based on status
          if (state.status === 'completed') {
            setPhase('completed');
          } else if (state.status === 'error') {
            setPhase('planned');
          } else if (['planning', 'developing', 'testing', 'deploying'].includes(state.status) || state.progress > 0) {
            // Project is actively running
            setPhase('building');
          } else {
            setPhase('planned');
          }

          console.log('✅ Loaded project state for resume', { status: state.status });

          // Try to get project directory and name from projects API
          // (state may not have name/requirements, so also load from projects list)
          try {
            const projectsResponse = await fetch('/api/projects');
            if (projectsResponse.ok) {
              const projectsData = await projectsResponse.json();
              const project = projectsData.projects?.find((p: any) => p.projectId === projectId);
              if (project) {
                if (project.projectDirectory) {
                  setProjectDirectory(project.projectDirectory);
                  console.log('📁 Loaded project directory:', project.projectDirectory);
                }
                // Set hasExistingBuilds early for GitHub/existing projects to prevent column flash
                if (project.source === 'github' || project.gitUrl) {
                  setHasExistingBuilds(true);
                  console.log('📦 GitHub project detected - using iterate mode (4 columns)');
                }
                // Load project name from config.name (that's where it's stored in projects.json)
                // Always use projects list name as source of truth
                const projectNameFromList = project.config?.name || project.name;
                if (projectNameFromList) {
                  setProjectName(projectNameFromList);
                  console.log('📝 Loaded project name from projects list:', projectNameFromList);
                } else {
                  // Fallback to projectId only if no name in projects list
                  setProjectName(projectId);
                }
                // Load requirements if we don't have them from state
                if (project.requirements && !state.requirements) {
                  setRequirements(project.requirements);
                  // Also set userPrompt so the Start Build button works
                  setUserPrompt(project.requirements);
                  console.log('📝 Loaded requirements from projects list:', project.requirements.slice(0, 50) + '...');
                }
                // Load deployment URL if available
                if (project.deploymentUrl) {
                  setDeploymentUrl(project.deploymentUrl);
                  console.log('🌐 Loaded deployment URL:', project.deploymentUrl);
                }
              } else {
                // Project not found in list - fallback to state name or projectId
                setProjectName(state.config?.name || projectId);
              }
            } else {
              // Projects API failed - fallback to state name or projectId
              setProjectName(state.config?.name || projectId);
            }
          } catch {
            // Ignore errors fetching project data, fallback to state name or projectId
            setProjectName(state.config?.name || projectId);
          }

          return;
        }
      }

      // Fallback to session API
      const response = await fetch(`/api/v2/session?projectId=${projectId}`);
      if (response.ok) {
        const data = await response.json();
        setProjectName(data.name || projectId);
        setRequirements(data.requirements || '');
        setUserPrompt(data.requirements || ''); // Also set userPrompt for Start Build button
        setPhase(data.status === 'completed' ? 'completed' : 'planned');
      } else {
        setPhase('planned');
      }

      // IMPORTANT: For new projects, fetch projectDirectory from projects list
      // This is needed because new projects don't have state yet but DO have projectDirectory
      try {
        const projectsResponse = await fetch('/api/projects');
        if (projectsResponse.ok) {
          const projectsData = await projectsResponse.json();
          const project = projectsData.projects?.find((p: any) => p.projectId === projectId);
          if (project) {
            if (project.projectDirectory) {
              setProjectDirectory(project.projectDirectory);
              console.log('📁 Loaded project directory from projects list:', project.projectDirectory);
            }
            // Also set name and requirements from projects list if not set from session
            if (project.config?.name) {
              setProjectName(project.config.name);
            }
            if (project.requirements) {
              setRequirements(project.requirements);
              setUserPrompt(project.requirements);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch project directory:', err);
      }

      // Load full project state (tasks, epics, metrics)
      await loadProjectStateFromFiles();
    } catch (err) {
      console.error('Failed to load project:', err);
      setPhase('planned');
    }
  };

  // Load full project state from persisted files
  const loadProjectStateFromFiles = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/state`);
      if (!response.ok) {
        console.log('[Build] No persisted state found');
        return;
      }

      const data = await response.json();
      if (!data.success || !data.state) {
        console.log('[Build] No state in response');
        return;
      }

      const state = data.state;
      console.log('[Build] Loading persisted state:', {
        tasks: state.tasks?.length || 0,
        epics: state.epics?.length || 0,
        hasTestingMetrics: !!state.testingMetrics,
        hasBuildMetrics: !!state.buildMetrics,
        hasSecurityMetrics: !!state.securityMetrics,
      });

      // Load tasks
      if (state.tasks && state.tasks.length > 0) {
        const loadedTasks = state.tasks.map((t: any) => ({
          id: t.id,
          title: t.title,
          description: t.description,
          status: t.status || 'backlog',
          assignedTo: t.assignedTo || t.assigned_to,
          files: t.files || [],
          result: t.result,
          acceptanceCriteria: t.acceptanceCriteria || t.acceptance_criteria || [],
          storyPoints: t.storyPoints || t.story_points || 3,
          priority: t.priority || 'medium',
          epicId: t.epicId || t.epic_id,
        }));
        setTasks(loadedTasks);
        console.log('[Build] Loaded tasks:', loadedTasks.length);
      }

      // Load epics
      if (state.epics && state.epics.length > 0) {
        const loadedEpics = state.epics.map((e: any) => ({
          id: e.id,
          projectId: projectId,
          title: e.title,
          description: e.description,
          priority: e.priority || 'medium',
          status: e.status || 'pending',
          stories: e.stories || [],
          createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        }));
        setEpics(loadedEpics);
        console.log('[Build] Loaded epics:', loadedEpics.length);
      }

      // Load build metrics
      if (state.buildMetrics) {
        setBuildMetrics(prev => ({
          ...prev,
          filesCreated: state.buildMetrics.filesCreated || 0,
          filesModified: state.buildMetrics.filesModified || 0,
          commandsRun: state.buildMetrics.commandsRun || 0,
          toolCalls: state.buildMetrics.toolCalls || 0,
          linesOfCode: state.buildMetrics.linesOfCode || 0,
          iterations: state.buildMetrics.iterations || 0,
          elapsedTime: state.buildMetrics.elapsedTime || state.buildMetrics.duration || 0,
          startTime: state.buildMetrics.startTime ? new Date(state.buildMetrics.startTime).getTime() : 0,
        }));
        console.log('[Build] Loaded build metrics');
      }

      // Load testing metrics
      if (state.testingMetrics) {
        setTestingMetrics(prev => ({
          ...prev,
          totalTests: state.testingMetrics.totalTests || 0,
          passed: state.testingMetrics.passed || 0,
          failed: state.testingMetrics.failed || 0,
          skipped: state.testingMetrics.skipped || 0,
          passRate: state.testingMetrics.passRate || 0,
          coverage: state.testingMetrics.coverage,
          duration: state.testingMetrics.duration || 0,
          storiesTested: state.testingMetrics.storiesTested || 0,
          storiesPassed: state.testingMetrics.storiesPassed || 0,
          testFiles: state.testingMetrics.testFiles || [],
          seenTaskIds: state.testingMetrics.seenTaskIds || [],
        }));
        console.log('[Build] Loaded testing metrics');
      }

      // Load security metrics
      if (state.securityMetrics) {
        setSecurityMetrics(prev => ({
          ...prev,
          score: state.securityMetrics.score || prev.score,
          grade: state.securityMetrics.grade || prev.grade,
          riskLevel: state.securityMetrics.riskLevel || prev.riskLevel,
          findings: {
            critical: state.securityMetrics.findings?.critical || 0,
            high: state.securityMetrics.findings?.high || 0,
            medium: state.securityMetrics.findings?.medium || 0,
            low: state.securityMetrics.findings?.low || 0,
            total: state.securityMetrics.findings?.total ||
              ((state.securityMetrics.findings?.critical || 0) +
               (state.securityMetrics.findings?.high || 0) +
               (state.securityMetrics.findings?.medium || 0) +
               (state.securityMetrics.findings?.low || 0)),
          },
          breakdown: state.securityMetrics.breakdown || prev.breakdown,
          vulnerabilities: state.securityMetrics.vulnerabilities || prev.vulnerabilities,
        }));
        console.log('[Build] Loaded security metrics');
      }

      // Load DORA metrics
      if (state.doraMetrics) {
        setDoraMetrics(prev => ({
          ...prev,
          deploymentFrequency: state.doraMetrics.deploymentFrequency || 0,
          leadTimeForChanges: state.doraMetrics.leadTimeForChanges || 0,
          changeFailureRate: state.doraMetrics.changeFailureRate || 0,
          meanTimeToRecovery: state.doraMetrics.meanTimeToRecovery || 0,
          dfRating: state.doraMetrics.dfRating || 'low',
          ltRating: state.doraMetrics.ltRating || 'low',
          cfrRating: state.doraMetrics.cfrRating || 'elite',
          mttrRating: state.doraMetrics.mttrRating || 'elite',
        }));
        console.log('[Build] Loaded DORA metrics');
      }

      // Update phase based on loaded state
      if (state.status === 'completed') {
        setPhase('completed');
      } else if (state.tasks && state.tasks.length > 0) {
        const allDone = state.tasks.every((t: any) => t.status === 'done' || t.status === 'completed');
        if (allDone) {
          setPhase('completed');
        }
      }

    } catch (err) {
      console.error('[Build] Failed to load project state:', err);
    }
  };

  const fetchFiles = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/files`);
      if (response.ok) {
        const data = await response.json();
        const files = data.files || [];
        // Store file paths - content is fetched on demand when selected
        const newContents = new Map<string, string>();
        files.forEach((f: any) => {
          // If we already have content, preserve it
          if (fileContents.has(f.path)) {
            newContents.set(f.path, fileContents.get(f.path)!);
          } else {
            // Mark as needing content (empty string placeholder)
            newContents.set(f.path, '');
          }
        });
        setFileContents(newContents);
        if (!selectedFile && files.length > 0) {
          setSelectedFile(files[0].path);
        }
      }
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, [projectId, selectedFile, fileContents]);

  // Fetch file content when a file is selected
  const fetchFileContent = useCallback(async (filePath: string) => {
    if (!filePath || !projectId) return;

    // Check if we already have the content
    const existingContent = fileContents.get(filePath);
    if (existingContent && existingContent.length > 0) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/files?path=${encodeURIComponent(filePath)}`);
      if (response.ok) {
        const data = await response.json();
        if (data.content) {
          setFileContents(prev => {
            const updated = new Map(prev);
            updated.set(filePath, data.content);
            return updated;
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch file content:', err);
    }
  }, [projectId, fileContents, setFileContents]);

  // Fetch content when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      fetchFileContent(selectedFile);
    }
  }, [selectedFile, fetchFileContent]);

  // startDevServer and stopDevServer are now provided by usePreviewServer hook

  // Stop dev server when navigating away from this project or unmounting
  useEffect(() => {
    // Stop ALL other project servers when this project loads (ensure clean slate)
    fetch('/api/preview/stop-others', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentProjectId: projectId }),
    }).catch(() => {});

    return () => {
      // Stop this project's server when navigating away
      fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      }).catch(() => {});
    };
  }, [projectId]);

  // Auto-start dev server when build completes AND we have a package.json (npm projects)
  // Preview shows in the embedded iframe - never opens external browser
  // Must wait for files to be loaded (fileContents.size > 0) before checking hasPackageJson
  useEffect(() => {
    // Log state for debugging
    console.log('🔍 [Preview Auto-Start Check]', {
      phase,
      filesLoaded: fileContents.size,
      hasPackageJson,
      previewStatus,
      attempted: previewAttemptedRef.current,
    });

    const shouldStart =
      phase === 'completed' &&
      fileContents.size > 0 &&  // Ensure files are loaded before checking hasPackageJson
      hasPackageJson &&
      previewStatus === 'idle' &&
      !previewAttemptedRef.current;

    if (shouldStart) {
      previewAttemptedRef.current = true;
      console.log('🚀 Auto-starting preview server (embedded only)...', { phase, hasPackageJson, previewStatus, filesLoaded: fileContents.size });
      // Start with a small delay to ensure all state updates have settled
      const timer = setTimeout(() => {
        console.log('🎬 [Preview] Calling startDevServer now...');
        startDevServer();
      }, 800);
      return () => clearTimeout(timer);
    }

    // If preview failed, allow retry when conditions are met again
    if (previewStatus === 'error' && phase === 'completed' && hasPackageJson) {
      console.log('⚠️ [Preview] Previous attempt failed, allowing manual retry');
    }
  }, [phase, fileContents.size, hasPackageJson, previewStatus, startDevServer]);

  // Save all metrics to project state when build completes or metrics update significantly
  // This ensures we can resume with all stats intact after push/pull from git
  useEffect(() => {
    const saveProjectState = async () => {
      if (phase !== 'completed' && phase !== 'building') return;

      try {
        await fetch(`/api/projects/${projectId}/state`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: phase,
            progress: phase === 'completed' ? 100 : 50,
            buildMetrics: {
              filesCreated: buildMetrics.filesCreated,
              filesModified: buildMetrics.filesModified,
              commandsRun: buildMetrics.commandsRun,
              toolCalls: buildMetrics.toolCalls,
              linesOfCode: buildMetrics.linesOfCode,
              iterations: buildMetrics.iterations,
              elapsedTime: buildMetrics.elapsedTime,
            },
            testingMetrics: {
              totalTests: testingMetrics.totalTests,
              passed: testingMetrics.passed,
              failed: testingMetrics.failed,
              skipped: testingMetrics.skipped,
              passRate: testingMetrics.passRate,
              coverage: testingMetrics.coverage,
              duration: testingMetrics.duration,
              storiesTested: testingMetrics.storiesTested,
              storiesPassed: testingMetrics.storiesPassed,
              testFiles: testingMetrics.testFiles,
              seenTaskIds: testingMetrics.seenTaskIds, // Prevent double counting on resume
            },
            securityMetrics: {
              score: securityMetrics.score,
              grade: securityMetrics.grade,
              riskLevel: securityMetrics.riskLevel,
              findings: securityMetrics.findings,
              owasp: securityMetrics.owasp,
              breakdown: securityMetrics.breakdown,
              vulnerabilities: securityMetrics.vulnerabilities,
              recommendations: securityMetrics.recommendations,
              scanDuration: securityMetrics.scanDuration,
              categories: securityMetrics.categories,
            },
            doraMetrics: {
              deploymentFrequency: doraMetrics.deploymentFrequency,
              leadTimeForChanges: doraMetrics.leadTimeForChanges,
              changeFailureRate: doraMetrics.changeFailureRate,
              meanTimeToRecovery: doraMetrics.meanTimeToRecovery,
              dfRating: doraMetrics.dfRating,
              ltRating: doraMetrics.ltRating,
              cfrRating: doraMetrics.cfrRating,
              mttrRating: doraMetrics.mttrRating,
            },
            tasks: tasks,
            epics: epics,
          }),
        });
        console.log('💾 Project state saved for resume functionality', {
          tasksCount: tasks.length,
          epicsCount: epics.length,
          phase,
          taskIds: tasks.map(t => t.id).slice(0, 5), // First 5 for debugging
          epicIds: epics.map(e => e.id).slice(0, 5),
        });
      } catch (err) {
        console.error('Failed to save project state:', err);
      }
    };

    // Only save when phase is completed OR when we have significant metrics during building
    if (phase === 'completed') {
      // Add a small delay to ensure all React state updates have flushed
      // This is critical for iteration mode where epics/tasks may still be updating
      const timer = setTimeout(saveProjectState, 500);
      return () => clearTimeout(timer);
    } else if (phase === 'building' && testingMetrics.totalTests > 0) {
      // Save periodically during build when we have test results
      const timer = setTimeout(saveProjectState, 5000);
      return () => clearTimeout(timer);
    }
  }, [phase, projectId, buildMetrics, testingMetrics, securityMetrics, doraMetrics, tasks, epics]);

  const generateMessageId = () => {
    messageIdCounter.current += 1;
    return `msg-${Date.now()}-${messageIdCounter.current}-${Math.random().toString(36).substring(2, 9)}`;
  };

  // IMPORTANT: handleStreamEvent must be defined BEFORE startBuild to avoid stale closure issues
  const handleStreamEvent = useCallback((eventType: string, data: any) => {
    switch (eventType) {
      case 'agent:message':
        setAgentMessages(prev => {
          // Check if this is an update to an existing streaming message
          const existingIndex = prev.findIndex(m => m.id === data.id);
          if (existingIndex >= 0) {
            // Update existing message (streaming update)
            const updated = [...prev];
            updated[existingIndex] = {
              ...updated[existingIndex],
              content: data.content,
              timestamp: data.timestamp || new Date().toISOString(),
              storyId: data.storyId || updated[existingIndex].storyId, // Preserve storyId on updates
            };
            return updated;
          }
          // Add new message
          return [...prev, {
            id: data.id || generateMessageId(),
            agentRole: data.agentRole,
            agentName: data.agentName,
            type: data.type,
            content: data.content,
            toolName: data.toolName,
            timestamp: data.timestamp || new Date().toISOString(),
            instanceNumber: data.instanceNumber, // Pass through instance number for parallel agents
            storyId: data.storyId, // Preserve storyId for filtering in story detail modal
          }];
        });
        break;

      case 'agent:status':
        setAgentStatuses(prev => {
          const updated = new Map(prev);
          // Track the base role status
          updated.set(data.role, data.status);
          // Also track individual coder IDs (coder-1, coder-2, etc.)
          if (data.agentId && data.agentId !== data.role) {
            updated.set(data.agentId, data.status);
          }
          return updated;
        });
        if (data.status === 'working') {
          const agentLabel = data.agentId && data.agentId !== data.role ? data.agentId : data.role;
          setBuildLogs(prev => [...prev, {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'info',
            message: `Agent started: ${agentLabel}`,
            timestamp: new Date(),
          }]);
        } else if (data.status === 'done' || data.status === 'completed') {
          const agentLabel = data.agentId && data.agentId !== data.role ? data.agentId : data.role;
          setBuildLogs(prev => [...prev, {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'success',
            message: `Agent finished: ${agentLabel}`,
            timestamp: new Date(),
          }]);
        }
        break;

      case 'file:changed':
        setFileChanges(prev => [...prev, { path: data.path, action: data.action, timestamp: new Date() }]);
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'file',
          message: `${data.action === 'write' ? 'Created' : data.action === 'edit' ? 'Modified' : data.action} file`,
          detail: data.path,
          timestamp: new Date(),
        }]);
        // Immediately update file contents if content is included in event (for instant preview)
        if (data.content && data.path) {
          setFileContents(prev => {
            const next = new Map(prev);
            next.set(data.path, data.content);
            return next;
          });
          // Auto-refresh preview when index.html changes
          if (data.path === 'index.html' || data.path.endsWith('/index.html')) {
            setPreviewKey(k => k + 1);
          }
        }
        // Also fetch all files for completeness
        fetchFiles();
        break;

      case 'command:start':
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'command',
          message: 'Running command',
          detail: data.command,
          timestamp: new Date(),
        }]);
        break;

      case 'command:complete':
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'success',
          message: 'Command completed',
          detail: data.output?.substring(0, 200),
          timestamp: new Date(),
        }]);
        break;

      case 'command:error':
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'error',
          message: 'Command failed',
          detail: data.error,
          timestamp: new Date(),
        }]);
        break;

      case 'task:created':
        console.log('📋 [Kanban] task:created received:', { id: data.id, title: data.title, status: data.status, iterationId: data.iterationId });
        // GUARD: Don't create tasks with undefined ID
        if (!data.id) {
          console.warn('📋 [Kanban] task:created SKIPPED: missing id in event data:', data);
          break;
        }
        setTasks(prev => {
          if (prev.some(t => t.id === data.id)) {
            console.log('📋 [Kanban] task:created SKIPPED (duplicate):', data.id);
            return prev;
          }
          const newTask = { ...data, status: data.status || 'backlog' };
          console.log('📋 [Kanban] task:created ADDED:', { id: newTask.id, status: newTask.status, iterationId: newTask.iterationId });
          return [...prev, newTask];
        });
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'info',
          message: 'Task created',
          detail: data.title,
          timestamp: new Date(),
        }]);
        break;

      case 'task:updated':
        console.log('📋 [Kanban] task:updated (SSE):', { id: data.id, title: data.title, status: data.status, assignedTo: data.assignedTo, epicId: data.epicId });
        // GUARD: Don't process updates with undefined ID
        if (!data.id) {
          console.warn('📋 [Kanban] task:updated SKIPPED: missing id in event data:', data);
          break;
        }
        // Status priority: higher = more progressed (prevent downgrades)
        // 'failed' has same priority as 'done'/'completed' since it's a terminal state
        const STATUS_PRIORITY_SSE: Record<string, number> = {
          'backlog': 0, 'pending': 0, 'in_progress': 1, 'testing': 2, 'done': 3, 'completed': 3, 'failed': 3,
        };
        // Valid "downgrade" transitions that are actually forward progress (retry cycles)
        const isValidRetryTransitionSSE = (from: string, to: string): boolean => {
          // failed → in_progress: coder fixing a failed story
          // failed → backlog: story returned for re-planning
          if (from === 'failed' && (to === 'in_progress' || to === 'backlog')) return true;
          return false;
        };
        setTasks(prev => {
          const existingIndex = prev.findIndex(t => t.id === data.id);
          if (existingIndex === -1) {
            // Task doesn't exist - create it (upsert behavior)
            console.log('📋 [Kanban] task:updated - Task not found, creating:', data.id, 'iterationId:', data.iterationId);
            const newTask = {
              id: data.id,
              title: data.title || 'Untitled Task',
              description: data.description || '',
              status: data.status || 'backlog',
              epicId: data.epicId,
              storyPoints: data.storyPoints,
              priority: data.priority || 'medium',
              acceptanceCriteria: data.acceptanceCriteria || [],
              assignedTo: data.assignedTo,
              iterationId: data.iterationId,
            };
            return [...prev, newTask];
          }
          // Check if this would be a downgrade
          const currentStatus = prev[existingIndex].status;
          const newStatus = data.status || currentStatus;
          const currentPriority = STATUS_PRIORITY_SSE[currentStatus] ?? 0;
          const newPriority = STATUS_PRIORITY_SSE[newStatus] ?? 0;
          // Allow retry transitions (failed → in_progress/backlog)
          if (newPriority < currentPriority) {
            if (isValidRetryTransitionSSE(currentStatus, newStatus)) {
              console.log('📋 [Kanban] task:updated RETRY CYCLE:', { id: data.id, from: currentStatus, to: newStatus, reason: 'valid retry transition (failed story being fixed)' });
            } else {
              console.log('📋 [Kanban] task:updated BLOCKED (downgrade):', { id: data.id, from: currentStatus, to: newStatus });
              return prev; // Don't allow downgrade
            }
          }
          // Task exists - update all fields
          console.log('📋 [Kanban] task:updated APPLIED:', { id: data.id, oldStatus: currentStatus, newStatus: newStatus, epicId: prev[existingIndex].epicId });
          return prev.map(t => {
            if (t.id !== data.id) return t;
            return {
              ...t,
              ...data,
              // Preserve epicId if the update didn't include it (backwards compatibility)
              epicId: data.epicId ?? t.epicId,
            };
          });
        });
        if (data.status === 'completed' || data.status === 'done') {
          setBuildLogs(prev => [...prev, {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'success',
            message: 'Task completed',
            detail: data.title,
            timestamp: new Date(),
          }]);
        }
        break;

      case 'epic:created':
        console.log('📚 [Epic] Created:', { id: data.id, title: data.title });
        setEpics(prev => {
          if (prev.some(e => e.id === data.id)) {
            console.log('📚 [Epic] SKIPPED (duplicate):', data.id);
            return prev;
          }
          console.log('📚 [Epic] ADDED:', data.id);
          return [...prev, {
            ...data,
            status: data.status || 'pending',
            stories: data.stories || [],
            priority: data.priority || 'medium',
          }];
        });
        break;

      case 'story:created':
        // Stories are also created as tasks, but we add extra info
        console.log('📖 [Story] Created:', { id: data.id, title: data.title, epicId: data.epicId });
        // GUARD: Don't create stories with undefined ID
        if (!data.id) {
          console.warn('📖 [Story] SKIPPED: missing id in event data:', data);
          break;
        }
        setTasks(prev => {
          if (prev.some(t => t.id === data.id)) {
            console.log('📖 [Story] SKIPPED (duplicate):', data.id);
            return prev;
          }
          console.log('📖 [Story] ADDED to tasks:', data.id);
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
        // Update epic with story reference
        if (data.epicId) {
          setEpics(prev => prev.map(e =>
            e.id === data.epicId
              ? { ...e, stories: [...e.stories, data.id] }
              : e
          ));
        }
        break;

      case 'foundation:complete':
        // Foundation/setup story is complete - enable early preview!
        console.log('🏗️ [Foundation] Complete! Preview can now be started.', data);
        setFoundationComplete(true);
        // Trigger a file refresh to detect package.json - the auto-start useEffect will handle starting preview
        fetchFiles();
        break;

      // Legacy single-agent format
      case 'text':
        setAgentMessages(prev => [...prev, {
          id: generateMessageId(),
          agentRole: 'coder',
          agentName: 'Coder',
          type: 'chat',
          content: data.content,
          timestamp: new Date().toISOString(),
        }]);
        break;

      case 'tool:use':
        setAgentMessages(prev => [...prev, {
          id: generateMessageId(),
          agentRole: 'coder',
          agentName: 'Coder',
          type: 'action',
          content: `Using ${data.tool}...`,
          toolName: data.tool,
          timestamp: new Date().toISOString(),
        }]);
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'tool',
          message: `Using tool: ${data.tool}`,
          detail: typeof data.input === 'object' ? JSON.stringify(data.input).substring(0, 100) : undefined,
          timestamp: new Date(),
        }]);
        break;

      case 'tool:result':
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'success',
          message: `Tool result: ${data.tool}`,
          detail: data.result?.substring(0, 150),
          timestamp: new Date(),
        }]);
        break;

      case 'thinking':
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'info',
          message: 'Thinking',
          detail: data.content?.substring(0, 100),
          timestamp: new Date(),
        }]);
        break;

      case 'complete':
      case 'done':
        setPhase('completed');
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'success',
          message: 'Build completed successfully!',
          timestamp: new Date(),
        }]);
        break;

      case 'error':
        setAgentMessages(prev => [...prev, {
          id: generateMessageId(),
          agentRole: 'coordinator',
          agentName: 'System',
          type: 'error',
          content: data.message,
          timestamp: new Date().toISOString(),
        }]);
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'error',
          message: 'Error',
          detail: data.message,
          timestamp: new Date(),
        }]);
        break;

      case 'metrics':
        setBuildMetrics(data);
        // Update DORA metrics based on build metrics
        if (data.startTime && data.elapsedTime) {
          const elapsedSeconds = data.elapsedTime / 1000;
          const hoursElapsed = Math.max(elapsedSeconds / 3600, 0.01);
          setDoraMetrics(prev => ({
            ...prev,
            leadTimeForChanges: elapsedSeconds,
            deploymentFrequency: 1 / hoursElapsed,
            ltRating: elapsedSeconds < 60 ? 'elite' : elapsedSeconds < 300 ? 'high' : elapsedSeconds < 900 ? 'medium' : 'low',
            dfRating: hoursElapsed < 1 ? 'elite' : hoursElapsed < 24 ? 'high' : 'medium',
          }));
        }
        break;

      case 'connected':
        if (data.startTime) {
          setBuildMetrics(prev => ({ ...prev, startTime: data.startTime }));
        }
        break;

      // Security scan results
      case 'security:report':
        // Calculate finding counts from summary
        const criticalCount = data.summary?.criticalFindings ?? 0;
        const highCount = data.summary?.highFindings ?? 0;
        const mediumCount = data.summary?.mediumFindings ?? 0;
        const lowCount = data.summary?.lowFindings ?? 0;
        const totalCount = criticalCount + highCount + mediumCount + lowCount;

        // Transform recommendations from objects to strings if needed
        const recs = (data.recommendations || []).map((r: any) =>
          typeof r === 'string' ? r : `[${r.priority?.toUpperCase() || 'INFO'}] ${r.title}: ${r.description}`
        );

        // Transform categories from array to Record<string, number> if needed
        const cats: Record<string, number> = {};
        if (Array.isArray(data.categories)) {
          for (const c of data.categories) {
            cats[c.name] = c.count;
          }
        } else if (data.categories && typeof data.categories === 'object') {
          Object.assign(cats, data.categories);
        }

        console.log('[Security] Report received:', {
          score: data.score,
          grade: data.grade,
          findings: totalCount,
          vulns: data.vulnerabilities?.length || 0,
        });

        setSecurityMetrics({
          score: data.score ?? 100,
          grade: data.grade ?? 'A',
          riskLevel: data.riskLevel ?? 'low',
          findings: {
            critical: criticalCount,
            high: highCount,
            medium: mediumCount,
            low: lowCount,
            total: totalCount,
          },
          owasp: data.owaspCompliance || data.owasp || {},
          breakdown: {
            sast: data.breakdown?.sast ?? 100,
            secrets: data.breakdown?.secrets ?? 100,
            dependencies: data.breakdown?.dependencies ?? 100,
          },
          vulnerabilities: data.vulnerabilities || [],
          summary: data.summary,
          recommendations: recs,
          categories: cats,
          scanDuration: data.scanDuration,
        });
        // Also update the project store so DevSecOpsDashboard can display findings
        // Transform categories to the expected array format for SecurityReport
        const categoriesArray = Array.isArray(data.categories)
          ? data.categories
          : Object.entries(cats).map(([name, count]) => ({
              name,
              count,
              severity: 'medium' as const, // Default severity when not provided
            }));
        useProjectStore.getState().setSecurityReport({
          score: data.score ?? 100,
          grade: data.grade ?? 'A',
          riskLevel: data.riskLevel ?? 'low',
          vulnerabilities: data.vulnerabilities || [],
          owaspCompliance: data.owaspCompliance || data.owasp || {},
          breakdown: data.breakdown || { sast: 100, secrets: 100, dependencies: 100 },
          summary: data.summary,
          categories: categoriesArray,
          recommendations: recs,
          scanDate: data.scanDate || new Date().toISOString(),
          scanDuration: data.scanDuration,
        });
        break;

      // Individual security alert
      case 'security:alert':
        setSecurityMetrics(prev => ({
          ...prev,
          vulnerabilities: [...prev.vulnerabilities, {
            severity: data.severity,
            file: data.file,
            line: data.line,
            type: data.vulnerability_type,
            description: data.description,
            remediation: data.remediation,
            owasp: data.owasp,
            cwe: data.cwe,
          }],
          findings: {
            ...prev.findings,
            [data.severity]: prev.findings[data.severity as keyof typeof prev.findings] + 1,
            total: prev.findings.total + 1,
          },
        }));
        break;

      // Test results from tester agent
      case 'test:results':
        console.log('🧪🧪🧪 [handleStreamEvent] test:results CASE HIT! data:', data);
        // Map the emitted field names to our metrics structure
        // Enhanced format includes: coverage_breakdown, individual_tests, failed_test_details, duration
        const totalTests = typeof data.total_tests === 'number' ? data.total_tests : (data.total || 0);
        const passedTests = typeof data.passed_tests === 'number' ? data.passed_tests : 0;
        const failedTests = typeof data.failed_tests === 'number' ? data.failed_tests : 0;
        const skippedTests = typeof data.skipped_tests === 'number' ? data.skipped_tests : 0;
        const testsPassed = data.passed === true;
        const wasSkipped = data.skipped === true;
        const taskId = data.task_id || '';
        const testDuration = typeof data.duration === 'number' ? data.duration : 0;

        // Parse enhanced coverage breakdown
        const coverageBreakdown = data.coverage_breakdown ? {
          lines: data.coverage_breakdown.lines || 0,
          statements: data.coverage_breakdown.statements || 0,
          functions: data.coverage_breakdown.functions || 0,
          branches: data.coverage_breakdown.branches || 0,
        } : undefined;

        // Parse individual tests
        const individualTests = Array.isArray(data.individual_tests)
          ? data.individual_tests.map((t: any, idx: number) => ({
              id: `${taskId}-test-${idx}`,
              name: t.name || 'Unknown test',
              fullName: t.fullName || t.name || 'Unknown test',
              status: t.status || 'passed',
              duration: t.duration || 0,
              file: t.file || '',
              error: t.error,
              stackTrace: t.stackTrace,
              ancestorTitles: t.ancestorTitles || [],
            }))
          : [];

        // Parse failed test details
        const failedTestDetails = Array.isArray(data.failed_test_details)
          ? data.failed_test_details.map((t: any) => ({
              name: t.name || 'Unknown test',
              file: t.file || '',
              error: t.error || 'Unknown error',
              stackTrace: t.stackTrace,
            }))
          : [];

        console.log('🧪 [Test Results] Parsed:', { totalTests, passedTests, failedTests, skippedTests, testsPassed, taskId, coverageBreakdown });

        // Update testing metrics with enhanced data
        setTestingMetrics(prev => {
          const seenTasks = new Set(prev.seenTaskIds || []);
          const isNewStory = taskId && !seenTasks.has(taskId);

          if (isNewStory) {
            seenTasks.add(taskId);
          }

          // Merge individual tests (append new ones)
          const existingTestIds = new Set((prev.individualTests || []).map(t => t.id));
          const newIndividualTests = [
            ...(prev.individualTests || []),
            ...individualTests.filter((t: any) => !existingTestIds.has(t.id))
          ];

          // Merge failed test details
          const newFailedDetails = [
            ...(prev.failedTestDetails || []),
            ...failedTestDetails.filter((t: any) =>
              !(prev.failedTestDetails || []).some(e => e.name === t.name && e.file === t.file)
            )
          ];

          // Calculate performance metrics
          const allDurations = newIndividualTests.map(t => ({ name: t.name, duration: t.duration, file: t.file }));
          const sortedByDuration = [...allDurations].sort((a, b) => b.duration - a.duration);
          const totalDuration = testDuration || allDurations.reduce((sum, t) => sum + t.duration, 0);
          const avgDuration = allDurations.length > 0 ? totalDuration / allDurations.length : 0;

          const performance = {
            averageDuration: avgDuration,
            slowestTests: sortedByDuration.slice(0, 5),
            fastestTests: [...sortedByDuration].reverse().slice(0, 5),
            totalDuration,
            testsPerSecond: totalDuration > 0 ? (allDurations.length / (totalDuration / 1000)) : 0,
          };

          // Build file results map
          const fileResultsMap = new Map<string, any>();
          for (const test of newIndividualTests) {
            if (!test.file) continue;
            const existing = fileResultsMap.get(test.file) || {
              path: test.file,
              passed: 0,
              failed: 0,
              skipped: 0,
              duration: 0,
              tests: [],
            };
            existing.tests.push(test);
            existing.duration += test.duration;
            if (test.status === 'passed') existing.passed++;
            else if (test.status === 'failed') existing.failed++;
            else if (test.status === 'skipped') existing.skipped++;
            fileResultsMap.set(test.file, existing);
          }

          const fileResults = Array.from(fileResultsMap.values()).map(f => ({
            ...f,
            status: f.failed > 0 ? 'failed' : f.passed > 0 && f.skipped > 0 ? 'mixed' : 'passed',
          }));

          const newMetrics = {
            ...prev,
            seenTaskIds: Array.from(seenTasks),
            totalTests: totalTests,
            passed: passedTests,
            failed: failedTests,
            skipped: skippedTests || (wasSkipped ? prev.skipped + (isNewStory ? 1 : 0) : prev.skipped),
            passRate: totalTests > 0 ? (passedTests / totalTests) * 100 : prev.passRate,
            coverage: data.coverage || prev.coverage,
            duration: testDuration || prev.duration,
            storiesTested: isNewStory ? prev.storiesTested + 1 : prev.storiesTested,
            storiesPassed: isNewStory && testsPassed ? prev.storiesPassed + 1 : prev.storiesPassed,
            testFiles: data.testFile && !prev.testFiles.includes(data.testFile)
              ? [...prev.testFiles, data.testFile]
              : prev.testFiles,
            // Enhanced metrics
            coverageBreakdown: coverageBreakdown || prev.coverageBreakdown,
            individualTests: newIndividualTests,
            fileResults,
            performance,
            failedTestDetails: newFailedDetails,
            lastRunTimestamp: new Date().toISOString(),
          };

          console.log('🧪 [Test Results] Updated with rich metrics:', {
            totalTests: newMetrics.totalTests,
            individualTestCount: newMetrics.individualTests?.length,
            fileResultCount: newMetrics.fileResults?.length,
            failedDetailCount: newMetrics.failedTestDetails?.length,
          });

          // Sync to project store with enhanced coverage
          const cb = newMetrics.coverageBreakdown;
          useProjectStore.getState().setTestResults({
            name: 'Test Suite',
            tests: [],
            coverage: cb ? {
              lines: cb.lines,
              statements: cb.statements,
              functions: cb.functions,
              branches: cb.branches,
            } : {
              lines: newMetrics.coverage || 0,
              statements: newMetrics.coverage || 0,
              functions: newMetrics.coverage || 0,
              branches: newMetrics.coverage || 0,
            },
            totalDuration: newMetrics.duration || 0,
            passed: newMetrics.passed,
            failed: newMetrics.failed,
            skipped: newMetrics.skipped,
          });

          // Store per-story test results
          if (taskId && isNewStory) {
            useProjectStore.getState().addTestSuite(taskId, {
              name: data.task_title || taskId,
              tests: individualTests,
              coverage: cb ? {
                lines: cb.lines,
                statements: cb.statements,
                functions: cb.functions,
                branches: cb.branches,
              } : {
                lines: data.coverage || 0,
                statements: data.coverage || 0,
                functions: data.coverage || 0,
                branches: data.coverage || 0,
              },
              totalDuration: testDuration,
              passed: passedTests,
              failed: failedTests,
              skipped: skippedTests,
            });
          }

          return newMetrics;
        });

        // Update DORA change failure rate
        if (totalTests > 0) {
          setDoraMetrics(prev => {
            const newFailRate = (failedTests / totalTests) * 100;
            return {
              ...prev,
              changeFailureRate: newFailRate,
              cfrRating: newFailRate < 5 ? 'elite' : newFailRate < 15 ? 'high' : newFailRate < 30 ? 'medium' : 'low',
            };
          });
        }

        // Log to build output
        setBuildLogs(prev => [...prev, {
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: testsPassed ? 'success' : 'error',
          message: wasSkipped
            ? `Tests Skipped: ${data.task_title || 'Story'}`
            : `Test Results: ${passedTests}/${totalTests} passed${failedTests > 0 ? ` (${failedTests} failed)` : ''}`,
          detail: data.task_title || data.summary,
          timestamp: new Date(),
        }]);
        break;

      case 'heartbeat':
        // Update last heartbeat timestamp for connection monitoring
        setLastHeartbeat(data.timestamp || Date.now());
        setConnectionStatus('connected');
        break;
    }
  }, []);

  // Pre-scaffold the project with just Next.js + Tailwind (no components)
  const preScaffoldProject = useCallback(async () => {
    if (isScaffolding) return;

    setIsScaffolding(true);
    setScaffoldStatus('checking');
    setScaffoldMessage('Checking project status...');

    try {
      // First check if scaffold is needed
      const checkRes = await fetch(`/api/projects/${projectId}/scaffold`);
      const checkData = await checkRes.json();

      if (!checkData.needsScaffolding) {
        setScaffoldStatus('done');
        setScaffoldMessage('Project already scaffolded');
        setIsProjectScaffolded(true);
        setFoundationComplete(true);
        return;
      }

      // Show estimated time
      setScaffoldMessage(checkData.templateReady
        ? 'Scaffolding project (~30 seconds)...'
        : 'First run - building template (~2-3 minutes)...');
      setScaffoldStatus('scaffolding');

      // Run scaffold
      const res = await fetch(`/api/projects/${projectId}/scaffold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectName: projectId }),
      });

      const result = await res.json();

      if (result.success) {
        setScaffoldStatus('done');
        setScaffoldMessage(`Scaffolded in ${result.duration?.toFixed(1) || '?'}s`);
        setIsProjectScaffolded(true);
        setFoundationComplete(true);

        // Add to build logs
        setBuildLogs(prev => [...prev, {
          id: `scaffold-${Date.now()}`,
          type: 'success',
          message: 'Project scaffolded successfully',
          detail: `Next.js 14 + TypeScript + Tailwind + Prisma 5.x ready (${result.duration?.toFixed(1)}s)`,
          timestamp: new Date(),
        }]);
      } else {
        setScaffoldStatus('error');
        setScaffoldMessage(result.message || 'Scaffold failed');
      }
    } catch (err: any) {
      setScaffoldStatus('error');
      setScaffoldMessage(err.message || 'Scaffold error');
    } finally {
      setIsScaffolding(false);
    }
  }, [projectId, isScaffolding]);

  const startBuild = useCallback(async () => {
    console.log('[Build Page] startBuild called', { isStreaming, projectDirectory, phase });
    if (isStreaming) {
      console.log('[Build Page] Already streaming, returning');
      return;
    }
    if (!projectDirectory) {
      console.error('Cannot start build: projectDirectory not set');
      return;
    }

    setIsStreaming(true);
    setPhase('building');
    setError(null);
    setAgentMessages([]);
    setBuildLogs([]);
    setFileChanges([]);

    // Reset heartbeat timer and reconnect attempts to prevent false timeout detection
    setLastHeartbeat(Date.now());
    setReconnectAttempt(0);
    setConnectionStatus('connected');

    // Cleanup old build artifacts FIRST (archives and deletes stale files)
    addBuildLog('info', 'Cleaning up old build artifacts...');
    try {
      const cleanupResponse = await fetch('/api/build-history/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDirectory }),
      });
      if (!cleanupResponse.ok) {
        console.warn('Cleanup failed, continuing anyway');
      }
    } catch (err) {
      console.warn('Cleanup error:', err);
    }

    // Add initial build log
    addBuildLog('info', 'Build started', `Project: ${projectId}`);
    console.log(`🚀 Starting build with ${parallelCoders} parallel coder(s), batchMode: ${batchMode}`);

    // Initialize agent statuses and reset epics/tasks
    const initialStatuses = new Map<string, string>();
    ['product_owner', 'coder', 'tester', 'security'].forEach(role => {
      initialStatuses.set(role, 'idle');
    });
    setAgentStatuses(initialStatuses);
    setEpics([]);
    setTasks([]);

    // Reset testing metrics to prevent accumulation from previous builds
    setTestingMetrics({
      totalTests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      passRate: 0,
      coverage: undefined,
      duration: 0,
      storiesTested: 0,
      storiesPassed: 0,
      testFiles: [],
      seenTaskIds: [],
    });

    abortControllerRef.current = new AbortController();

    try {
      const sessionRes = await fetch(`/api/v2/session?projectId=${projectId}`);

      // Safely parse session response - fallback to defaults if not JSON
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
          coderConfig: {
            parallelCoders,
            batchMode,
            batchSize,
          },
          // Skip foundation stories if project was pre-scaffolded
          skipFoundation: isProjectScaffolded,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = ''; // MUST be outside the while loop to persist across chunks

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            // Debug: log all event types
            if (currentEventType === 'test:results') {
              console.log('🔥 [SSE] test:results event type detected');
            }
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Debug: log test:results data
              if (currentEventType === 'test:results') {
                console.log('🔥 [SSE] test:results DATA:', data);
              }
              handleStreamEvent(currentEventType, data);
            } catch (e) {
              console.error('SSE parse error:', e);
            }
          }
        }
      }

      setPhase('completed');
      setConnectionStatus('connected');
      setReconnectAttempt(0);
      fetchFiles();
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;

      // Check if this is a network error that might be recoverable
      const isNetworkError = err instanceof TypeError ||
        (err instanceof Error && (
          err.message.includes('network') ||
          err.message.includes('fetch') ||
          err.message.includes('connection') ||
          err.message.includes('ECONNRESET')
        ));

      if (isNetworkError && reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
        setConnectionStatus('reconnecting');
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000); // Exponential backoff, max 30s
        console.log(`[Build] Connection lost, reconnecting in ${delay}ms (attempt ${reconnectAttempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        setError(`Connection lost. Reconnecting in ${Math.round(delay / 1000)}s... (${reconnectAttempt + 1}/${MAX_RECONNECT_ATTEMPTS})`);

        // Clear any existing reconnect timeout before scheduling a new one
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }

        // Schedule reconnection
        reconnectTimeoutRef.current = setTimeout(() => {
          setReconnectAttempt(prev => prev + 1);
          setError(null);
          // The startBuild function will be re-invoked through a useEffect
        }, delay);
      } else {
        // Non-recoverable error or max attempts reached
        setConnectionStatus('disconnected');
        setError(err instanceof Error ? err.message : 'Stream failed. Max reconnection attempts reached.');
        setPhase('error');
      }
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, projectDirectory, isStreaming, useMultiAgent, requirements, addBuildLog, handleStreamEvent, reconnectAttempt]);

  const stopBuild = useCallback(async () => {
    // First abort client-side connection immediately
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // Clear any pending reconnection
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Set stopped state immediately to block all UI interactions
    setIsStreaming(false);
    setConnectionStatus('disconnected');
    setReconnectAttempt(0);
    setPhase('stopped');

    addBuildLog('info', '🛑 Stopping all agents...');

    // Call backend to stop all agents and services
    try {
      // First save a checkpoint so we can resume later
      const pauseResponse = await fetch('/api/v2/multi-agent/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements,
          agents: ['product_owner', 'coder', 'tester', 'security'],
        }),
      });
      const pauseData = await pauseResponse.json();
      if (pauseData.success) {
        setHasCheckpoint(true);
        addBuildLog('info', `Checkpoint saved at phase: ${pauseData.phase}`);
      }

      // Now fully stop the workflow
      const response = await fetch(`/api/workflow/${projectId}/stop`, {
        method: 'POST',
      });
      const data = await response.json();
      if (data.success) {
        addBuildLog('success', '⏹️ All agents stopped. Use Resume to continue.');
      } else {
        addBuildLog('warning', data.error || 'Workflow may not have fully stopped');
      }
    } catch (error) {
      console.error('Failed to stop workflow:', error);
      addBuildLog('error', 'Failed to stop backend workflow');
    }
  }, [projectId, requirements, addBuildLog]);

  // Cleanup on unmount - abort any active connections and clear timeouts
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Auto-start build when navigated with ?autoStart=true (new project flow)
  const autoStartTriggered = useRef(false);
  useEffect(() => {
    const autoStart = searchParams.get('autoStart');
    if (autoStart === 'true' && !autoStartTriggered.current && projectDirectory && !isStreaming && phase === 'planned') {
      autoStartTriggered.current = true;
      // Clear the URL param without reload
      window.history.replaceState({}, '', `/build/${projectId}`);
      // Small delay to ensure all state is ready
      setTimeout(() => {
        console.log('[Build] Auto-starting build from new project flow');
        startBuild();
      }, 500);
    }
  }, [searchParams, projectDirectory, isStreaming, phase, projectId, startBuild]);

  // Handler for starting complex build from Quick Build modal
  const handleComplexBuildStart = useCallback((prompt: string) => {
    // Set the requirements first
    setRequirements(prompt);
    setShowComplexBuildModal(false);
    // Trigger the build by updating state that will be used by startBuild
    // We need to call startBuild after state updates
    setTimeout(() => {
      startBuild();
    }, 50);
  }, [startBuild]);

  // Heartbeat monitoring - detect stale connections
  useEffect(() => {
    if (!isStreaming || phase === 'completed' || phase === 'error') return;

    const heartbeatTimeout = 45000; // 45 seconds (3 missed heartbeats at 15s intervals)

    const checkHeartbeat = () => {
      const timeSinceLastHeartbeat = Date.now() - lastHeartbeat;
      if (timeSinceLastHeartbeat > heartbeatTimeout) {
        console.log(`[Build] Heartbeat timeout - last heartbeat was ${Math.round(timeSinceLastHeartbeat / 1000)}s ago`);
        setConnectionStatus('disconnected');

        // Trigger reconnection if we haven't exceeded max attempts
        if (reconnectAttempt < MAX_RECONNECT_ATTEMPTS) {
          // Clear any existing reconnect timeout before setting a new one
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }

          setConnectionStatus('reconnecting');
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
          setError(`Connection timeout. Reconnecting in ${Math.round(delay / 1000)}s...`);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempt(prev => prev + 1);
            setError(null);
            resumeFromCheckpoint();
          }, delay);
        }
      }
    };

    const interval = setInterval(checkHeartbeat, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, [isStreaming, phase, lastHeartbeat, reconnectAttempt]);

  // Resume from checkpoint after connection loss
  const resumeFromCheckpoint = useCallback(async () => {
    if (!projectDirectory) {
      setError('Cannot resume: project directory not found');
      return;
    }

    setPhase('building');
    setError(null);
    setConnectionStatus('reconnecting');
    setIsStreaming(true);
    setHasCheckpoint(false); // Clear checkpoint flag since we're resuming
    setCheckpointInfo(null);
    setLastHeartbeat(Date.now()); // Reset heartbeat timer

    try {
      const response = await fetch('/api/v2/multi-agent/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      setConnectionStatus('connected');
      setReconnectAttempt(0);

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

      setPhase('completed');
      fetchFiles();
    } catch (err) {
      setConnectionStatus('disconnected');
      setError(err instanceof Error ? err.message : 'Resume failed');
      setPhase('error');
    } finally {
      setIsStreaming(false);
    }
  }, [projectId, projectDirectory, handleStreamEvent]);

  // Pause build - saves checkpoint and stops agents gracefully
  const pauseBuild = useCallback(async () => {
    if (!isStreaming) return;

    setPhase('paused');
    addBuildLog('info', 'Pausing build and saving checkpoint...');

    try {
      const response = await fetch('/api/v2/multi-agent/pause', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          requirements,
          agents: ['product_owner', 'coder', 'tester', 'security'],
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        setIsStreaming(false);
        setConnectionStatus('disconnected');
        addBuildLog('success', `Build paused at phase: ${data.phase || 'unknown'}`);
      } else {
        throw new Error(data.error || 'Failed to pause build');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pause build');
      addBuildLog('error', err instanceof Error ? err.message : 'Failed to pause build');
    }
  }, [isStreaming, projectId, requirements, addBuildLog]);

  // Send new build request on existing project - archives current build and starts fresh
  // Uses clean-slate architecture: each build is a fresh start with stories archived
  const sendNewBuild = useCallback(async (prompt: string) => {
    console.log('[sendNewBuild] Called with:', { prompt: prompt?.slice(0, 50), isIterating, projectDirectory });
    if (isIterating) {
      console.log('[sendNewBuild] Already iterating, returning');
      return;
    }
    if (!prompt.trim()) {
      console.log('[sendNewBuild] Prompt is empty, returning');
      return;
    }
    if (!projectDirectory) {
      console.error('[sendNewBuild] projectDirectory not set! Cannot start build.');
      return;
    }

    setIsIterating(true);
    setUserPrompt('');
    setPhase('building');
    setIterationRequest(prompt);

    // Fresh log view for this build
    setAgentMessages([{
      id: generateMessageId(),
      agentRole: 'coordinator',
      agentName: 'You',
      type: 'chat',
      content: prompt,
      timestamp: new Date().toISOString(),
    }]);

    // Clear existing stories for fresh build
    setTasks([]);
    setEpics([]);

    addBuildLog('info', `New build request: ${prompt.slice(0, 100)}...`);

    // Ensure preview is running
    if (previewStatus !== 'ready' && previewStatus !== 'starting') {
      console.log('🎬 [Build] Starting preview server...');
      addBuildLog('info', 'Starting preview server...');
      try {
        const previewRes = await fetch('/api/preview/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });
        if (previewRes.ok) {
          const previewData = await previewRes.json();
          setPreviewUrl(previewData.url || `http://localhost:${previewData.port}`);
          setPreviewStatus('ready');
          addBuildLog('success', `Preview started at ${previewData.url || `http://localhost:${previewData.port}`}`);
        }
      } catch (previewErr) {
        console.error('Failed to start preview:', previewErr);
      }
    }

    try {
      console.log('🔄 [Build] Starting new build on existing project');

      // Start new build - this archives current state and starts fresh
      const { response, buildNumber } = await startNewBuildOnExistingProject(
        projectId,
        projectDirectory,
        prompt,
        { parallelCoders, batchMode, batchSize }
      );
      setCurrentBuildNumber(buildNumber);

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
            } catch {}
          }
        }
      }

      // Refresh files after build completes
      await fetchFiles();

      // Restart preview server to show changes
      addBuildLog('info', 'Restarting preview with updated code...');
      try {
        if (previewStatus === 'ready' || previewStatus === 'starting') {
          await fetch(`/api/preview/${projectId}`, { method: 'DELETE' });
          setPreviewStatus('stopped');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setPreviewStatus('starting');
        const previewRes = await fetch('/api/preview/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ projectId }),
        });

        if (previewRes.ok) {
          const previewData = await previewRes.json();
          setPreviewUrl(previewData.url || `http://localhost:${previewData.port}`);
          setPreviewStatus('ready');
          setPreviewKey(k => k + 1);
          addBuildLog('success', `Preview restarted at ${previewData.url || `http://localhost:${previewData.port}`}`);
        }
      } catch (previewErr) {
        setPreviewStatus('error');
        addBuildLog('error', `Preview restart failed: ${previewErr instanceof Error ? previewErr.message : 'Unknown error'}`);
      }

      setPhase('completed');
      addBuildLog('success', 'Build completed successfully!');

    } catch (err) {
      setAgentMessages(prev => [...prev, {
        id: generateMessageId(),
        agentRole: 'coordinator',
        agentName: 'System',
        type: 'error',
        content: `Error: ${err instanceof Error ? err.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      }]);
      setPhase('error');
      addBuildLog('error', `Build failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsIterating(false);
    }
  }, [projectId, projectDirectory, isIterating, previewStatus, parallelCoders, batchMode, batchSize, handleStreamEvent, addBuildLog, fetchFiles]);

  // Send Figma-based build on existing project - archives current build and starts fresh
  const sendFigmaBuild = useCallback(async (figmaUrl: string, context: string) => {
    if (isIterating || isStreaming || !figmaUrl.trim() || !projectDirectory) return;

    addBuildLog('info', 'Cleaning up old build artifacts...');

    try {
      // STEP 1: Cleanup old build artifacts FIRST (deletes stale figma-context, figma-frames, etc.)
      const cleanupResponse = await fetch('/api/build-history/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectDirectory }),
      });
      if (!cleanupResponse.ok) {
        const err = await cleanupResponse.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to cleanup old build artifacts');
      }
      addBuildLog('success', 'Cleaned up old build artifacts');

      addBuildLog('info', 'Extracting Figma design...');

      // STEP 2: Extract, save context, download frames (now with clean slate)
      const figmaResult = await setupFigmaForBuild(projectId, figmaUrl, projectDirectory);

      if (!figmaResult.success || !figmaResult.designContext) {
        throw new Error(figmaResult.error || 'Failed to extract Figma design');
      }

      const designContext = figmaResult.designContext;
      addBuildLog('success', `Extracted design: ${designContext.name || 'Untitled'}`);
      addBuildLog('success', 'Saved Figma design context for agents');

      // Build requirements for existing project
      const figmaRequirements = buildFigmaExistingProjectRequirements(
        designContext.name || 'Untitled',
        designContext.requirements || 'Implement the design as shown in the Figma file.',
        context
      );

      addBuildLog('info', 'Starting Figma build - PO will review project and create stories...');
      setRequirements(figmaRequirements);
      setIsProjectScaffolded(true);

      // Setup build state - fresh start
      setIsStreaming(true);
      setPhase('building');
      setError(null);
      setAgentMessages([]);
      setBuildLogs([]);
      setFileChanges([]);
      setLastHeartbeat(Date.now());
      setReconnectAttempt(0);
      setConnectionStatus('connected');

      addBuildLog('info', 'Build started from Figma design', `Project: ${projectId}`);

      const initialStatuses = new Map<string, string>();
      ['product_owner', 'coder', 'tester', 'security'].forEach(role => {
        initialStatuses.set(role, 'idle');
      });
      setAgentStatuses(initialStatuses);
      setEpics([]);
      setTasks([]);

      setTestingMetrics({
        totalTests: 0, passed: 0, failed: 0, skipped: 0,
        passRate: 0, coverage: undefined, duration: 0,
        storiesTested: 0, storiesPassed: 0, testFiles: [], seenTaskIds: [],
      });

      abortControllerRef.current = new AbortController();

      // Start new build on existing project
      const { response, buildNumber } = await startNewBuildOnExistingProject(
        projectId,
        projectDirectory,
        figmaRequirements,
        { parallelCoders, batchMode, batchSize }
      );
      setCurrentBuildNumber(buildNumber);

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

      setPhase('completed');
      setConnectionStatus('connected');
      setReconnectAttempt(0);
      fetchFiles();
      setIsStreaming(false);

    } catch (err) {
      addBuildLog('error', `Figma build failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
      setAgentMessages(prev => [...prev, {
        id: generateMessageId(),
        agentRole: 'coordinator',
        agentName: 'System',
        type: 'error',
        content: `Figma build error: ${err instanceof Error ? err.message : 'Unknown'}`,
        timestamp: new Date().toISOString(),
      }]);
      setPhase('error');
      setIsStreaming(false);
    }
  }, [projectId, projectDirectory, isIterating, isStreaming, parallelCoders, batchMode, batchSize, handleStreamEvent, addBuildLog, fetchFiles]);

  // Send a quick command (no multi-agent workflow, just direct Claude execution)
  const sendQuickCommand = useCallback(async (command: string) => {
    if (isRunningQuickCommand || !command.trim()) return;
    setIsRunningQuickCommand(true);
    setQuickCommand('');
    setQuickCommandOutput([`> ${command}`, '']);

    addBuildLog('info', `Quick command: ${command.slice(0, 80)}${command.length > 80 ? '...' : ''}`);

    try {
      const response = await fetch('/api/v2/quick-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, command }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEventType = line.slice(7).trim();
            continue;
          }
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              switch (currentEventType) {
                case 'text':
                  setQuickCommandOutput(prev => [...prev, data.content]);
                  break;
                case 'tool:call':
                  setQuickCommandOutput(prev => [...prev, `[Tool] ${data.name}`]);
                  addBuildLog('tool', `${data.name}`);
                  break;
                case 'tool:result':
                  if (data.result) {
                    setQuickCommandOutput(prev => [...prev, `  → ${data.result.slice(0, 200)}`]);
                  }
                  break;
                case 'file:changed':
                  addBuildLog('file', `File ${data.action}: ${data.path || 'updated'}`);
                  fetchFiles(); // Refresh file list
                  break;
                case 'error':
                  setQuickCommandOutput(prev => [...prev, `Error: ${data.message}`]);
                  addBuildLog('error', data.message);
                  break;
                case 'complete':
                  addBuildLog('success', 'Quick command completed');
                  break;
              }
            } catch {}
          }
        }
      }

      // Refresh files after command
      await fetchFiles();
      setQuickCommandOutput(prev => [...prev, '', '✓ Done']);

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setQuickCommandOutput(prev => [...prev, `Error: ${errMsg}`]);
      addBuildLog('error', `Quick command failed: ${errMsg}`);
    } finally {
      setIsRunningQuickCommand(false);
    }
  }, [projectId, isRunningQuickCommand, addBuildLog, fetchFiles]);

  // Run the Fixer agent to diagnose and fix errors
  const runFixer = useCallback(async (errorContext?: string) => {
    if (isFixing) return;
    setIsFixing(true);
    setFixerMessages([]);

    // Add a message to show fixer is starting
    const startMessage: AgentMessage = {
      id: generateMessageId(),
      agentRole: 'fixer',
      agentName: 'Fixer',
      type: 'thinking',
      content: 'Starting diagnostic scan...',
      timestamp: new Date().toISOString(),
    };
    setFixerMessages([startMessage]);
    setAgentMessages(prev => [...prev, startMessage]);

    addBuildLog('info', 'Fixer agent starting diagnostic scan...');

    try {
      const response = await fetch('/api/v2/fixer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, errorContext }),
      });

      if (!response.body) throw new Error('No response body');

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
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.agentRole === 'fixer') {
                const messageId = data.id || generateMessageId();
                const message: AgentMessage = {
                  id: messageId,
                  agentRole: 'fixer',
                  agentName: 'Fixer',
                  type: data.type || 'chat',
                  content: data.content || '',
                  toolName: data.toolName,
                  timestamp: data.timestamp || new Date().toISOString(),
                };
                setFixerMessages(prev => {
                  if (prev.some(m => m.id === messageId)) return prev;
                  return [...prev, message];
                });
                setAgentMessages(prev => {
                  if (prev.some(m => m.id === messageId)) return prev;
                  return [...prev, message];
                });

                // Add to build log
                if (data.type === 'result') {
                  addBuildLog('success', `Fixer: ${data.content?.slice(0, 100) || 'Action completed'}`);
                } else if (data.toolName) {
                  addBuildLog('tool', `Fixer using ${data.toolName}`);
                }
              }

              // Handle fix reported
              if (line.includes('fix:reported')) {
                addBuildLog('success', `Fix applied: ${data.fix_applied || 'Issue resolved'}`);
              }

              // Handle file changes from fixer
              if (line.includes('file:changed')) {
                setFileChanges(prev => [...prev, {
                  path: data.path,
                  action: data.action,
                  timestamp: new Date(),
                }]);
                addBuildLog('file', `${data.action}: ${data.path}`);
                await fetchFiles();
              }

            } catch {}
          }
        }
      }

      addBuildLog('success', 'Fixer agent completed');

      // Refresh files and preview
      await fetchFiles();
      if (previewStatus === 'ready') setPreviewKey(k => k + 1);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addBuildLog('error', `Fixer error: ${errorMsg}`);
      setAgentMessages(prev => [...prev, {
        id: generateMessageId(),
        agentRole: 'fixer',
        agentName: 'Fixer',
        type: 'error',
        content: `Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsFixing(false);
    }
  }, [projectId, isFixing, previewStatus, addBuildLog, fetchFiles]);

  // Run the Research agent to analyze project and suggest enhancements
  const runResearch = useCallback(async () => {
    if (isResearching) return;
    setIsResearching(true);
    setResearchSuggestions([]);
    setShowResearchPanel(true);

    // Add a message to show research is starting
    const startMessage: AgentMessage = {
      id: generateMessageId(),
      agentRole: 'researcher',
      agentName: 'Researcher',
      type: 'thinking',
      content: 'Analyzing your project for potential enhancements...',
      timestamp: new Date().toISOString(),
    };
    setAgentMessages(prev => [...prev, startMessage]);
    addBuildLog('info', 'Research agent analyzing project...');

    try {
      const response = await fetch('/api/v2/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, requirements }),
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

              // Handle suggestion events
              if (currentEventType === 'suggestion') {
                const suggestion: ResearchSuggestion = {
                  id: data.id || `sug-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  category: data.category,
                  title: data.title,
                  description: data.description,
                  priority: data.priority,
                  effort: data.effort,
                  impact: data.impact,
                  implementationHint: data.implementation_hint,
                };
                setResearchSuggestions(prev => [...prev, suggestion]);
                addBuildLog('info', `Suggestion: ${data.title}`);
              }

              // Handle agent messages
              if (currentEventType === 'agent:message' && data.agentRole === 'researcher') {
                const messageId = data.id || generateMessageId();
                const message: AgentMessage = {
                  id: messageId,
                  agentRole: 'researcher',
                  agentName: 'Researcher',
                  type: data.type || 'chat',
                  content: data.content || '',
                  toolName: data.toolName,
                  timestamp: data.timestamp || new Date().toISOString(),
                };
                setAgentMessages(prev => {
                  // Prevent duplicates
                  if (prev.some(m => m.id === messageId)) return prev;
                  return [...prev, message];
                });
              }

              // Handle completion
              if (currentEventType === 'complete') {
                addBuildLog('success', `Research complete: ${data.totalSuggestions || researchSuggestions.length} suggestions`);
              }

            } catch {}
          }
        }
      }

      addBuildLog('success', 'Research analysis complete');

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addBuildLog('error', `Research error: ${errorMsg}`);
      setAgentMessages(prev => [...prev, {
        id: generateMessageId(),
        agentRole: 'researcher',
        agentName: 'Researcher',
        type: 'error',
        content: `Error: ${errorMsg}`,
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setIsResearching(false);
    }
  }, [projectId, isResearching, requirements, addBuildLog]);

  // Add suggestion to backlog - sends to PO as iteration
  const addSuggestionToBacklog = useCallback(async (suggestion: ResearchSuggestion) => {
    const prompt = `
Add the following enhancement to the project:

**${suggestion.title}**
Category: ${suggestion.category}
Priority: ${suggestion.priority}
Effort: ${suggestion.effort}

Description: ${suggestion.description}

Impact: ${suggestion.impact}

${suggestion.implementationHint ? `Implementation Hint: ${suggestion.implementationHint}` : ''}
`.trim();

    // Use sendNewBuild to route through the PO
    await sendNewBuild(prompt);

    // Remove suggestion from list after adding to backlog
    setResearchSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
  }, [sendNewBuild]);

  // Build file tree
  const buildTree = (files: string[]): TreeNode[] => {
    const root: TreeNode[] = [];
    const folderMap = new Map<string, TreeNode>();

    files.forEach(filePath => {
      const parts = filePath.replace(/\\/g, '/').split('/').filter(p => p);
      let currentLevel = root;
      let currentPath = '';

      parts.forEach((part, index) => {
        currentPath += (currentPath ? '/' : '') + part;
        const isFile = index === parts.length - 1;

        if (isFile) {
          currentLevel.push({ name: part, path: filePath, type: 'file' });
        } else {
          let folder = folderMap.get(currentPath);
          if (!folder) {
            folder = { name: part, path: currentPath, type: 'folder', children: [] };
            folderMap.set(currentPath, folder);
            currentLevel.push(folder);
          }
          currentLevel = folder.children!;
        }
      });
    });

    return root;
  };

  // toggleFolder is now provided by useUIState hook

  const renderTreeNode = (node: TreeNode, depth: number = 0) => {
    const isFolder = node.type === 'folder';
    const isExpanded = expandedFolders.has(node.path);
    const isSelected = node.path === selectedFile;

    return (
      <div key={node.path}>
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 text-xs cursor-pointer hover:bg-muted/80',
            isSelected && 'bg-primary/10 font-medium'
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onClick={() => isFolder ? toggleFolder(node.path) : setSelectedFile(node.path)}
        >
          {isFolder ? (
            <>
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {isExpanded ? <FolderOpen className="h-3 w-3 text-blue-500" /> : <Folder className="h-3 w-3 text-blue-500" />}
            </>
          ) : (
            <>
              <span className="w-3" />
              <File className="h-3 w-3 text-muted-foreground" />
            </>
          )}
          <span className="truncate">{node.name}</span>
        </div>
        {isFolder && isExpanded && node.children?.map(child => renderTreeNode(child, depth + 1))}
      </div>
    );
  };

  // Map task status to kanban column
  const getKanbanStatus = (status: string): string => {
    if (status === 'pending' || status === 'backlog') return 'backlog';
    if (status === 'in_progress') return 'in_progress';
    if (status === 'testing') return 'testing';
    if (status === 'completed' || status === 'done') return 'done';
    return 'backlog';
  };

  const tree = buildTree(Array.from(fileContents.keys()));
  const currentFileContent = selectedFile ? fileContents.get(selectedFile) : null;

  // Render agent message
  const renderAgentMessage = (msg: AgentMessage) => {
    const Icon = AGENT_ICONS[msg.agentRole] || Bot;
    const colorClass = AGENT_COLORS[msg.agentRole] || 'text-gray-500';
    const bgClass = AGENT_BG_COLORS[msg.agentRole] || 'bg-gray-500/10';

    // Build display name with instance number for parallel agents (e.g., "Coder 1", "Tester 2")
    const displayName = msg.instanceNumber
      ? `${msg.agentName} ${msg.instanceNumber}`
      : msg.agentName;

    return (
      <div key={msg.id} className={cn('flex gap-2 p-2 border-b border-muted/30', bgClass)}>
        <div className={cn('mt-0.5 p-1 rounded', colorClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-xs font-semibold', colorClass)}>{displayName}</span>
            {msg.toolName && (
              <Badge variant="outline" className="text-[10px] h-4 px-1">{msg.toolName}</Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className={cn(
            'text-xs whitespace-pre-wrap break-words',
            msg.type === 'error' && 'text-red-500',
            msg.type === 'thinking' && 'text-muted-foreground italic',
            msg.type === 'result' && 'font-mono text-[11px] bg-black/20 p-1.5 rounded mt-1'
          )}>
            {msg.content}
          </div>
        </div>
      </div>
    );
  };

  // Get epic by id
  const getEpicById = (epicId?: string) => epics.find(e => e.id === epicId);

  // Render task card (story card) - clickable to open details
  const renderTaskCard = (task: Task) => {
    const epic = getEpicById(task.epicId);
    const isActive = task.status === 'in_progress';
    const isDone = task.status === 'done' || task.status === 'completed';
    const isFailed = task.status === 'failed';
    const isTesting = task.status === 'testing';

    // Get log count for this task - only count messages with matching storyId
    // FIXED: Require both storyId and task.id to be defined to prevent undefined === undefined matches
    const logCount = agentMessages.filter(m => m.storyId !== undefined && task.id !== undefined && m.storyId === task.id).length;

    // Status-based styling
    const getStatusStyles = () => {
      if (isFailed) return 'border-red-500/50 bg-gradient-to-br from-red-500/5 to-transparent';
      if (isDone) return 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-transparent';
      if (isActive) return 'border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-transparent shadow-lg shadow-blue-500/10';
      if (isTesting) return 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent';
      return 'border-border/50 hover:border-border';
    };

    return (
      <div
        key={task.id}
        className={cn(
          'group relative bg-card border rounded-xl p-3.5 transition-all duration-200 cursor-pointer',
          'hover:shadow-xl hover:scale-[1.02] hover:-translate-y-0.5',
          getStatusStyles()
        )}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedStory(task);
        }}
      >
        {/* Active indicator pulse */}
        {isActive && (
          <div className="absolute top-3 right-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500" />
            </span>
          </div>
        )}

        {/* Done checkmark */}
        {isDone && (
          <div className="absolute top-3 right-3">
            <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
            </div>
          </div>
        )}

        {/* Failed indicator */}
        {isFailed && (
          <div className="absolute top-3 right-3">
            <div className="h-5 w-5 rounded-full bg-red-500/20 flex items-center justify-center">
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            </div>
          </div>
        )}

        {/* Testing indicator */}
        {isTesting && (
          <div className="absolute top-3 right-3">
            <div className="h-5 w-5 rounded-full bg-amber-500/20 flex items-center justify-center">
              <TestTube className="h-3.5 w-3.5 text-amber-400" />
            </div>
          </div>
        )}

        {/* Epic label */}
        {epic && (
          <div className="flex items-center gap-1.5 mb-2.5">
            <div className="h-1 w-1 rounded-full bg-orange-400" />
            <span className="text-[10px] font-medium text-orange-400/80 truncate">{epic.title}</span>
          </div>
        )}

        {/* Title */}
        <h4 className="text-sm font-semibold leading-snug line-clamp-2 pr-6 mb-2">{task.title}</h4>

        {/* Priority & Points row */}
        <div className="flex items-center gap-2 mb-2.5">
          {task.priority && (
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
              task.priority === 'high' && 'bg-red-500/15 text-red-400',
              task.priority === 'medium' && 'bg-amber-500/15 text-amber-400',
              task.priority === 'low' && 'bg-emerald-500/15 text-emerald-400',
            )}>
              {task.priority}
            </span>
          )}
          {task.storyPoints && (
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              {task.storyPoints} pts
            </span>
          )}
        </div>

        {/* Description preview */}
        {task.description && (
          <p className="text-[11px] text-muted-foreground/80 line-clamp-2 mb-3 leading-relaxed">{task.description}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2.5 border-t border-border/30">
          {/* Acceptance criteria */}
          {task.acceptanceCriteria && task.acceptanceCriteria.length > 0 ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CheckSquare className="h-3 w-3 text-blue-400/70" />
              <span>{task.acceptanceCriteria.length} criteria</span>
            </div>
          ) : <span />}

          {/* Agent assignment with log count */}
          {task.assignedTo && (
            <div className="flex items-center gap-2">
              {logCount > 0 && (
                <div className={cn(
                  'flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded',
                  isActive ? 'bg-blue-500/15 text-blue-400' : 'bg-muted/50 text-muted-foreground'
                )}>
                  <Terminal className="h-2.5 w-2.5" />
                  <span className="font-medium">{logCount}</span>
                </div>
              )}
              <div className={cn(
                'flex items-center gap-1 text-[10px]',
                isActive ? 'text-blue-400' : 'text-muted-foreground'
              )}>
                <Code2 className="h-3 w-3" />
                <span className="font-medium">{task.assignedTo}</span>
              </div>
            </div>
          )}
        </div>

        {/* Hover hint */}
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-b-xl flex items-end justify-center pb-1">
          <span className="text-[9px] text-muted-foreground/60">Click for details</span>
        </div>
      </div>
    );
  };

  // State for project context modal
  const [showProjectContext, setShowProjectContext] = useState(false);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editedProjectName, setEditedProjectName] = useState('');
  const [isSavingProjectName, setIsSavingProjectName] = useState(false);

  const handleEditProjectName = () => {
    setEditedProjectName(projectName || projectId);
    setIsEditingProjectName(true);
  };

  const handleSaveProjectName = async () => {
    if (!editedProjectName.trim()) return;
    setIsSavingProjectName(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          config: { name: editedProjectName.trim() },
        }),
      });
      if (res.ok) {
        setProjectName(editedProjectName.trim());
        setIsEditingProjectName(false);
      }
    } catch (error) {
      console.error('Failed to save project name:', error);
    } finally {
      setIsSavingProjectName(false);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Project Context Modal */}
      <Dialog open={showProjectContext} onOpenChange={(open) => {
        setShowProjectContext(open);
        if (!open) setIsEditingProjectName(false);
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="h-5 w-5 text-primary" />
              {isEditingProjectName ? (
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    value={editedProjectName}
                    onChange={(e) => setEditedProjectName(e.target.value)}
                    className="h-8 text-base font-semibold"
                    placeholder="Project name"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveProjectName();
                      if (e.key === 'Escape') setIsEditingProjectName(false);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleSaveProjectName}
                    disabled={isSavingProjectName || !editedProjectName.trim()}
                    className="h-8 px-2"
                  >
                    {isSavingProjectName ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsEditingProjectName(false)}
                    disabled={isSavingProjectName}
                    className="h-8 px-2"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </div>
              ) : (
                <>
                  {projectName || projectId}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleEditProjectName}
                    className="h-6 w-6 p-0 ml-1"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </Button>
                </>
              )}
            </DialogTitle>
            <DialogDescription>Full project context and requirements</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0 max-h-[75vh]">
            <div className="space-y-4 pr-4">
              <div>
                <h4 className="text-sm font-semibold mb-2">Project ID</h4>
                <code className="text-xs bg-muted px-2 py-1 rounded">{projectId}</code>
              </div>
              {iterationRequest && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 text-primary">Current Iteration Request</h4>
                  <div className="text-sm whitespace-pre-wrap bg-primary/5 p-3 rounded-lg border border-primary/20 max-h-[40vh] overflow-auto">
                    {iterationRequest}
                  </div>
                </div>
              )}
              <div>
                <h4 className="text-sm font-semibold mb-2">Original Requirements</h4>
                <div className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg max-h-[50vh] overflow-auto">
                  {requirements || 'No requirements specified'}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Status</h4>
                <Badge variant={phase === 'completed' ? 'default' : phase === 'error' ? 'destructive' : 'secondary'}>
                  {phase.charAt(0).toUpperCase() + phase.slice(1)}
                </Badge>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* New Unified Header with Tabs */}
      <BuildPageHeader
        projectId={projectId}
        projectName={projectName}
        phase={phase}
        deploymentUrl={deploymentUrl}
        mainTab={mainTab}
        onMainTabChange={setMainTab}
        isIterateMode={hasExistingBuilds}
        agentStatuses={agentStatuses}
        wsConnected={wsConnected}
        isIterating={isIterating}
        isResearching={isResearching}
        isFixing={isFixing}
        onShowProjectContext={() => setShowProjectContext(true)}
      />

      {/* Build Controls removed - Start Build is in the main workspace area */}

      {phase === 'paused' && !isStreaming && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 border-b bg-yellow-500/5">
          <Badge variant="outline" className="border-yellow-500 text-yellow-400">
            <Pause className="h-3 w-3 mr-1" />
            Paused
          </Badge>
          <Button size="sm" onClick={resumeFromCheckpoint}>
            <Play className="h-4 w-4 mr-2" />
            Resume
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setPhase('planned')}>
            <Square className="h-4 w-4 mr-2" />
            Cancel
          </Button>
        </div>
      )}

      {isStreaming && connectionStatus === 'reconnecting' && (
        <div className="flex items-center justify-center gap-2 px-4 py-1 border-b bg-yellow-500/10">
          <RefreshCw className="h-3 w-3 animate-spin text-yellow-500" />
          <span className="text-xs text-yellow-500">Reconnecting...</span>
        </div>
      )}

      {/* Main Content - Tabbed Layout */}
      <div className="flex-1 overflow-hidden p-4">
        {hasExistingBuilds ? (
          /* Iterate Mode - For projects with existing builds, show the iterate/summary page */
          <IteratePage
            projectId={projectId}
            projectName={projectName}
            projectDirectory={projectDirectory}
            phase={phase}
            tasks={tasks}
            epics={epics}
            buildMetrics={buildMetrics}
            testingMetrics={testingMetrics}
            securityMetrics={securityMetrics}
            iterationState={null}
            overviewMode={overviewMode}
            isIterating={isIterating}
            isFixing={isFixing}
            isStreaming={isStreaming}
            userPrompt={userPrompt}
            iterationRequest={iterationRequest}
            currentIterationId={undefined}
            isResearching={isResearching}
            researchSuggestions={researchSuggestions}
            mainTab={mainTab}
            taskBoardView={taskBoardView}
            expandedEpics={expandedEpics}
            selectedFile={selectedFile}
            hasCheckpoint={hasCheckpoint}
            tree={tree}
            fileContents={fileContents}
            currentFileContent={currentFileContent || ''}
            previewStatus={previewStatus}
            previewUrl={previewUrl}
            previewKey={previewKey}
            previewError={previewError}
            hasPackageJson={hasPackageJson}
            firstHtmlFile={firstHtmlFile}
            agentStatuses={agentStatuses}
            agentMessages={agentMessages}
            buildLogs={buildLogs}
            error={error}
            connectionStatus={connectionStatus}
            deploymentUrl={deploymentUrl}
            healthcareSettings={healthcareSettings ? {
              complianceLevel: healthcareSettings.complianceLevel,
              appType: healthcareSettings.appType,
              dataTypes: healthcareSettings.dataTypes,
            } : null}
            databaseConfig={complexBuildContext?.databaseConfig ? {
              provider: complexBuildContext.databaseConfig.provider,
              schemaTemplate: complexBuildContext.databaseConfig.schemaTemplate,
            } : null}
            gitRepoUrl={gitRepoUrl}
            gitBranch={gitBranch}
            isCloningRepo={isCloningRepo}
            gitCloneError={gitCloneError}
            quickSettings={quickSettings}
            onGitRepoUrlChange={setGitRepoUrl}
            onGitBranchChange={setGitBranch}
            onIsCloningChange={setIsCloningRepo}
            onQuickSettingsChange={setQuickSettings}
            onGitCloneErrorChange={setGitCloneError}
            onMainTabChange={setMainTab}
            onTaskBoardViewChange={setTaskBoardView}
            onExpandedEpicsChange={setExpandedEpics}
            onPhaseChange={setPhase}
            onUserPromptChange={setUserPrompt}
            onSelectedStoryChange={setSelectedStory}
            onShowEpicExplorerChange={setShowEpicExplorer}
            onOverviewModeChange={setOverviewMode}
            onSecurityMetricsChange={setSecurityMetrics}
            onPreviewKeyChange={setPreviewKey}
            onDeploymentUrlChange={setDeploymentUrl}
            onResume={resumeFromCheckpoint}
            onPause={pauseBuild}
            onStop={stopBuild}
            onSendIteration={sendNewBuild}
            onSendFigmaIteration={sendFigmaBuild}
            onRunResearch={runResearch}
            onAddSuggestionToBacklog={addSuggestionToBacklog}
            onRunFixer={runFixer}
            onFetchFiles={fetchFiles}
            onStartDevServer={startDevServer}
            onStopDevServer={stopDevServer}
            onAddLog={addBuildLog}
            renderTaskCard={renderTaskCard}
            renderTreeNode={renderTreeNode}
            buildLogRef={buildLogRef}
            terminalRefs={terminalRefs}
          />
        ) : (
          /* Build Mode - For new builds */
          <div className="h-full flex">
            {/* Main Tabs Content */}
            <div className="flex-1 overflow-hidden">
              <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as any)} className="h-full flex flex-col">
                {/* Build Tab - Kanban Board with 4 columns */}
                <TabsContent value="build" className="flex-1 m-0 overflow-hidden">
            <BuildTab
              projectId={projectId}
              taskBoardView={taskBoardView}
              expandedEpics={expandedEpics}
              onTaskBoardViewChange={setTaskBoardView}
              onExpandedEpicsChange={setExpandedEpics}
              onPhaseChange={setPhase}
              onUserPromptChange={setUserPrompt}
              onSelectedStoryChange={setSelectedStory}
              onOverviewModeChange={setOverviewMode}
              onResume={resumeFromCheckpoint}
              onPause={pauseBuild}
              onStop={stopBuild}
              renderTaskCard={renderTaskCard}
            />
          </TabsContent>

          {/* Plan Tab - Iteration Planning */}
          <TabsContent value="plan" className="flex-1 m-0 overflow-hidden">
            <ProjectWorkspace
              projectId={projectId}
              projectDir={projectDirectory || ''}
              projectName={projectName || projectId}
              tasks={tasks}
              epics={epics}
              iterationState={null}
              buildMetrics={buildMetrics}
              testingMetrics={testingMetrics}
              securityMetrics={securityMetrics}
              isBuilding={isIterating || isStreaming}
              userPrompt={userPrompt}
              researchSuggestions={researchSuggestions}
              isResearching={isResearching}
              onUserPromptChange={setUserPrompt}
              onStartBuild={(req) => sendNewBuild(req)}
              onStartFigmaBuild={sendFigmaBuild}
              onRunResearch={runResearch}
              onAddSuggestionToBacklog={addSuggestionToBacklog}
              onShowEpicExplorer={() => setShowEpicExplorer(true)}
              onSelectStory={setSelectedStory}
              lastBuildPrompt={iterationRequest || undefined}
              onShowProjectContext={() => setShowProjectContext(true)}
            />
          </TabsContent>

          {/* Development Tab */}
          <TabsContent value="development" className="flex-1 m-0 overflow-hidden">
            <DevelopmentTab
              projectId={projectId}
              projectName={projectName}
              tree={tree}
              selectedFile={selectedFile}
              currentFileContent={currentFileContent}
              onFetchFiles={fetchFiles}
              renderTreeNode={renderTreeNode}
              previewStatus={previewStatus}
              previewUrl={previewUrl}
              previewKey={previewKey}
              previewError={previewError}
              hasPackageJson={hasPackageJson}
              firstHtmlFile={firstHtmlFile}
              onStartDevServer={startDevServer}
              onStopDevServer={stopDevServer}
              onPreviewKeyChange={setPreviewKey}
              buildLogRef={buildLogRef}
              onRunFixer={runFixer}
              onResumeFromCheckpoint={resumeFromCheckpoint}
              terminalRef={(el) => { if (el) terminalRefs.current.set('main', el); }}
            />
          </TabsContent>

          {/* Testing Tab */}
          <TabsContent value="testing" className="flex-1 m-0 overflow-hidden">
            <TestingTab
              terminalRef={(el) => { if (el) terminalRefs.current.set('tester', el); }}
            />
          </TabsContent>

          {/* Security Tab */}
          <TabsContent value="security" className="flex-1 m-0 overflow-hidden">
            <SecurityTab
              projectId={projectId}
              onSecurityMetricsChange={setSecurityMetrics}
              onAddLog={addBuildLog}
              terminalRef={(el) => { if (el) terminalRefs.current.set('security', el); }}
            />
          </TabsContent>

          {/* Compliance Tab - Healthcare HIPAA Compliance */}
          <TabsContent value="compliance" className="flex-1 m-0 overflow-hidden">
            <ComplianceTab
              projectId={projectId}
              projectPath={projectDirectory}
              onFileOpen={(file, line) => {
                console.log(`Open file: ${file}:${line}`);
                setMainTab('development');
              }}
            />
          </TabsContent>

          {/* Architecture Tab */}
          <TabsContent value="architecture" className="flex-1 m-0 overflow-hidden">
            <Card className="h-full border-2">
              <ArchitecturePanel projectId={projectId} projectPath={projectDirectory} />
            </Card>
          </TabsContent>

          {/* Deploy Tab */}
          <TabsContent value="deploy" className="flex-1 m-0 overflow-hidden">
            <Card className="h-full border-2 bg-gradient-to-br from-background to-orange-950/10">
              <DeployTab
                projectId={projectId}
                projectName={projectName || projectId}
                projectDirectory={projectDirectory || ''}
                buildStatus={phase}
                initialDeploymentUrl={deploymentUrl}
                healthcareSettings={healthcareSettings ? {
                  complianceLevel: healthcareSettings.complianceLevel,
                  appType: healthcareSettings.appType,
                  dataTypes: healthcareSettings.dataTypes,
                } : null}
                databaseConfig={complexBuildContext?.databaseConfig ? {
                  provider: complexBuildContext.databaseConfig.provider,
                  schemaTemplate: complexBuildContext.databaseConfig.schemaTemplate,
                } : null}
                onDeployComplete={(url) => {
                  setDeploymentUrl(url);
                  // Save to project persistence
                  fetch('/api/projects', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      projectId,
                      deploymentUrl: url,
                    }),
                  }).catch(console.error);
                }}
              />
            </Card>
          </TabsContent>

          {/* Audit Tab */}
          <TabsContent value="audit" className="flex-1 m-0 overflow-auto">
            <AuditTab projectId={projectId} />
          </TabsContent>

          {/* UAT Tab - User Acceptance Testing */}
          <TabsContent value="uat" className="flex-1 m-0 overflow-hidden">
            <UATTab projectId={projectId} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="flex-1 m-0 overflow-auto">
            <SettingsTab
              projectId={projectId}
              projectName={projectName}
              gitRepoUrl={gitRepoUrl}
              gitBranch={gitBranch}
              isCloningRepo={isCloningRepo}
              gitCloneError={gitCloneError}
              quickSettings={quickSettings}
              onGitRepoUrlChange={setGitRepoUrl}
              onGitBranchChange={setGitBranch}
              onIsCloningChange={setIsCloningRepo}
              onQuickSettingsChange={setQuickSettings}
              onGitCloneErrorChange={setGitCloneError}
            />
          </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </div>

      {/* Story Detail Modal */}
      {selectedStory && (
        <StoryDetailModal
          story={selectedStory}
          onClose={() => setSelectedStory(null)}
          agentMessages={agentMessages}
          epics={epics}
        />
      )}

      {/* Epic Healthcare API Explorer Dialog */}
      <Dialog open={showEpicExplorer} onOpenChange={setShowEpicExplorer}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-red-500" />
              Epic Healthcare API Explorer
            </DialogTitle>
            <DialogDescription>
              Browse 59 available Epic FHIR APIs. Click on app ideas to add them to your project requirements.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            <EpicCapabilitiesExplorer
              onSelectIdea={(idea, resources) => {
                const prompt = `Add a ${idea.toLowerCase()} feature using Epic FHIR APIs. Use the ${resources.join(', ')} resource${resources.length > 1 ? 's' : ''}.`;
                setUserPrompt(prompt);
                setShowEpicExplorer(false);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Pre-Build Healthcare Questionnaire */}
      <PreBuildQuestionnaire
        open={showPreBuildQuestionnaire}
        onClose={() => setShowPreBuildQuestionnaire(false)}
        onConfirm={(answers) => {
          setHealthcareSettings(answers);
          setShowPreBuildQuestionnaire(false);
          // Save the updated settings to the backend
          fetch('/api/config/agent-mode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              mode: 'healthcare',
              healthcareSettings: {
                includeEpicAPIs: answers.includeEpicAPIs,
                includeTestPatients: answers.includeTestPatients,
                includeFHIRExamples: answers.includeFHIRExamples,
                complianceLevel: answers.complianceLevel,
                ehrPlatform: 'epic',
              },
            }),
          }).then(() => {
            // Start the build after saving settings
            startBuild();
          }).catch(err => {
            console.error('Failed to save healthcare settings:', err);
            // Start build anyway
            startBuild();
          });
        }}
        initialSettings={healthcareSettings || undefined}
      />

      {/* Complex Build from Quick Build Modal */}
      <ComplexBuildModal
        open={showComplexBuildModal}
        onOpenChange={setShowComplexBuildModal}
        context={complexBuildContext}
        onStartBuild={handleComplexBuildStart}
      />
    </div>
  );
}
