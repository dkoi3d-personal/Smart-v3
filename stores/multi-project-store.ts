/**
 * Multi-Project Store - Track multiple projects and their states simultaneously
 * This store enables viewing and monitoring all projects at once
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  DevelopmentState,
  Epic,
  Story,
  AgentMessage,
  Agent,
  AgentType,
  AgentStatus,
} from '@/lib/agents/types';

export interface SessionSummary {
  sessionId: string;
  status: 'active' | 'paused' | 'idle';
  startedAt: string;
  lastActiveAt: string;
  duration: number; // ms since started
  messageCount: number;
  currentTask?: string;
}

export interface GitSummary {
  isGitRepo: boolean;
  repoUrl?: string;
  currentBranch?: string;
  hasUncommittedChanges?: boolean;
  ahead?: number;
  behind?: number;
  lastPulledAt?: string;
}

export type BuildType = 'quick' | 'complex';

export interface ProjectSummary {
  projectId: string;
  name: string;
  requirements: string;
  status: DevelopmentState['status'];
  progress: number;
  createdAt: string;
  updatedAt: string;
  // Build type - quick prototype or complex multi-agent build
  buildType?: BuildType;
  // Quick stats
  epicCount: number;
  storyCount: number;
  storiesCompleted: number;
  // Active agent info
  activeAgent?: {
    type: AgentType;
    status: AgentStatus;
    task?: string;
  };
  // Recent activity
  recentMessages: AgentMessage[];
  // Config
  config?: {
    name?: string;
    description?: string;
    techStack?: string[];
  };
  // Session state - independent per project
  session?: SessionSummary;
  // Git state - for repo-based projects
  git?: GitSummary;
  // Project directory path
  projectDirectory?: string;
}

export interface ProjectActivity {
  projectId: string;
  timestamp: Date;
  type: 'agent_status' | 'story_update' | 'epic_update' | 'code_change' | 'test_result' | 'message' | 'workflow_event';
  agentType?: AgentType;
  content: string;
  metadata?: Record<string, any>;
}

interface MultiProjectStore {
  // All projects summaries (lightweight, for list view)
  projects: Map<string, ProjectSummary>;

  // Full project states (loaded on demand)
  projectStates: Map<string, DevelopmentState>;

  // Global activity feed across all projects
  globalActivity: ProjectActivity[];

  // Currently selected project IDs (for multi-select operations)
  selectedProjectIds: Set<string>;

  // Loading states
  isLoadingProjects: boolean;
  loadingProjectIds: Set<string>;

  // Actions
  setProjects: (projects: ProjectSummary[]) => void;
  updateProject: (projectId: string, updates: Partial<ProjectSummary>) => void;
  removeProject: (projectId: string) => void;

  // Full state management
  setProjectState: (projectId: string, state: DevelopmentState) => void;
  getProjectState: (projectId: string) => DevelopmentState | undefined;
  clearProjectState: (projectId: string) => void;

  // Activity tracking
  addActivity: (activity: ProjectActivity) => void;
  clearActivities: (projectId?: string) => void;

  // Selection
  selectProject: (projectId: string) => void;
  deselectProject: (projectId: string) => void;
  toggleProjectSelection: (projectId: string) => void;
  clearSelection: () => void;

  // Loading
  setLoadingProjects: (loading: boolean) => void;
  setProjectLoading: (projectId: string, loading: boolean) => void;

  // Agent updates for specific projects
  updateProjectAgent: (projectId: string, agentType: AgentType, status: AgentStatus, task?: string) => void;

  // Message updates for specific projects
  addProjectMessage: (projectId: string, message: AgentMessage) => void;

  // Story/Epic count updates
  updateProjectStats: (projectId: string, stats: { epicCount?: number; storyCount?: number; storiesCompleted?: number }) => void;

  // Session management
  updateProjectSession: (projectId: string, session: SessionSummary | undefined) => void;
  getActiveSessionCount: () => number;

  // Git state management
  updateProjectGit: (projectId: string, git: GitSummary | undefined) => void;

  // Bulk operations
  refreshAllProjects: () => Promise<void>;
}

const MAX_RECENT_MESSAGES = 5;
const MAX_GLOBAL_ACTIVITIES = 100;

export const useMultiProjectStore = create<MultiProjectStore>()(
  devtools(
    (set, get) => ({
      projects: new Map(),
      projectStates: new Map(),
      globalActivity: [],
      selectedProjectIds: new Set(),
      isLoadingProjects: false,
      loadingProjectIds: new Set(),

      setProjects: (projects) => {
        const projectMap = new Map<string, ProjectSummary>();
        projects.forEach((p) => {
          projectMap.set(p.projectId, p);
        });
        set({ projects: projectMap });
      },

      updateProject: (projectId, updates) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const existing = newProjects.get(projectId);
          if (existing) {
            newProjects.set(projectId, { ...existing, ...updates });
          }
          return { projects: newProjects };
        }),

      removeProject: (projectId) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          newProjects.delete(projectId);

          const newProjectStates = new Map(state.projectStates);
          newProjectStates.delete(projectId);

          const newSelectedIds = new Set(state.selectedProjectIds);
          newSelectedIds.delete(projectId);

          return {
            projects: newProjects,
            projectStates: newProjectStates,
            selectedProjectIds: newSelectedIds,
          };
        }),

      setProjectState: (projectId, projectState) =>
        set((state) => {
          const newProjectStates = new Map(state.projectStates);
          newProjectStates.set(projectId, projectState);
          return { projectStates: newProjectStates };
        }),

      getProjectState: (projectId) => {
        return get().projectStates.get(projectId);
      },

      clearProjectState: (projectId) =>
        set((state) => {
          const newProjectStates = new Map(state.projectStates);
          newProjectStates.delete(projectId);
          return { projectStates: newProjectStates };
        }),

      addActivity: (activity) =>
        set((state) => {
          const newActivity = [activity, ...state.globalActivity].slice(0, MAX_GLOBAL_ACTIVITIES);
          return { globalActivity: newActivity };
        }),

      clearActivities: (projectId) =>
        set((state) => {
          if (projectId) {
            return {
              globalActivity: state.globalActivity.filter((a) => a.projectId !== projectId),
            };
          }
          return { globalActivity: [] };
        }),

      selectProject: (projectId) =>
        set((state) => {
          const newSelected = new Set(state.selectedProjectIds);
          newSelected.add(projectId);
          return { selectedProjectIds: newSelected };
        }),

      deselectProject: (projectId) =>
        set((state) => {
          const newSelected = new Set(state.selectedProjectIds);
          newSelected.delete(projectId);
          return { selectedProjectIds: newSelected };
        }),

      toggleProjectSelection: (projectId) =>
        set((state) => {
          const newSelected = new Set(state.selectedProjectIds);
          if (newSelected.has(projectId)) {
            newSelected.delete(projectId);
          } else {
            newSelected.add(projectId);
          }
          return { selectedProjectIds: newSelected };
        }),

      clearSelection: () => set({ selectedProjectIds: new Set() }),

      setLoadingProjects: (loading) => set({ isLoadingProjects: loading }),

      setProjectLoading: (projectId, loading) =>
        set((state) => {
          const newLoadingIds = new Set(state.loadingProjectIds);
          if (loading) {
            newLoadingIds.add(projectId);
          } else {
            newLoadingIds.delete(projectId);
          }
          return { loadingProjectIds: newLoadingIds };
        }),

      updateProjectAgent: (projectId, agentType, status, task) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const existing = newProjects.get(projectId);
          if (existing) {
            newProjects.set(projectId, {
              ...existing,
              activeAgent: status === 'idle' || status === 'completed'
                ? undefined
                : { type: agentType, status, task },
              updatedAt: new Date().toISOString(),
            });
          }

          // Add to global activity
          const activity: ProjectActivity = {
            projectId,
            timestamp: new Date(),
            type: 'agent_status',
            agentType,
            content: `${agentType} agent: ${status}${task ? ` - ${task}` : ''}`,
          };

          return {
            projects: newProjects,
            globalActivity: [activity, ...state.globalActivity].slice(0, MAX_GLOBAL_ACTIVITIES),
          };
        }),

      addProjectMessage: (projectId, message) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const existing = newProjects.get(projectId);
          if (existing) {
            const recentMessages = [message, ...existing.recentMessages].slice(0, MAX_RECENT_MESSAGES);
            newProjects.set(projectId, {
              ...existing,
              recentMessages,
              updatedAt: new Date().toISOString(),
            });
          }

          // Add to global activity
          const activity: ProjectActivity = {
            projectId,
            timestamp: new Date(),
            type: 'message',
            agentType: message.agentType,
            content: message.content.substring(0, 100) + (message.content.length > 100 ? '...' : ''),
          };

          return {
            projects: newProjects,
            globalActivity: [activity, ...state.globalActivity].slice(0, MAX_GLOBAL_ACTIVITIES),
          };
        }),

      updateProjectStats: (projectId, stats) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const existing = newProjects.get(projectId);
          if (existing) {
            newProjects.set(projectId, {
              ...existing,
              ...stats,
              updatedAt: new Date().toISOString(),
            });
          }
          return { projects: newProjects };
        }),

      updateProjectSession: (projectId, session) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const existing = newProjects.get(projectId);
          if (existing) {
            newProjects.set(projectId, {
              ...existing,
              session,
              updatedAt: new Date().toISOString(),
            });
          }

          // Add session activity
          if (session) {
            const activity: ProjectActivity = {
              projectId,
              timestamp: new Date(),
              type: 'workflow_event',
              content: `Session ${session.status}: ${session.sessionId.substring(0, 8)}...`,
              metadata: { sessionId: session.sessionId, status: session.status },
            };
            return {
              projects: newProjects,
              globalActivity: [activity, ...state.globalActivity].slice(0, MAX_GLOBAL_ACTIVITIES),
            };
          }

          return { projects: newProjects };
        }),

      getActiveSessionCount: () => {
        const projects = get().projects;
        let count = 0;
        projects.forEach((p) => {
          if (p.session?.status === 'active') {
            count++;
          }
        });
        return count;
      },

      updateProjectGit: (projectId, git) =>
        set((state) => {
          const newProjects = new Map(state.projects);
          const existing = newProjects.get(projectId);
          if (existing) {
            newProjects.set(projectId, {
              ...existing,
              git,
              updatedAt: new Date().toISOString(),
            });
          }
          return { projects: newProjects };
        }),

      refreshAllProjects: async () => {
        // Only show loading state if we have no projects yet (initial load)
        const currentProjects = get().projects;
        const isInitialLoad = currentProjects.size === 0;
        if (isInitialLoad) {
          set({ isLoadingProjects: true });
        }
        try {
          const response = await fetch('/api/projects');
          if (response.ok) {
            const data = await response.json();
            const summaries: ProjectSummary[] = (data.projects || []).map((p: any) => ({
              projectId: p.projectId,
              name: p.config?.name || p.name || p.projectId,
              requirements: p.requirements || p.config?.requirements || p.config?.description || '',
              status: p.status || 'idle',
              progress: p.progress || 0,
              createdAt: p.createdAt,
              updatedAt: p.updatedAt,
              buildType: p.buildType, // Include build type for filtering
              epicCount: p.epicCount || 0,
              storyCount: p.storyCount || 0,
              storiesCompleted: p.storiesCompleted || 0,
              recentMessages: p.recentMessages || [],
              config: p.config,
              // Include session data if available
              session: p.session ? {
                sessionId: p.session.sessionId,
                status: p.session.status,
                startedAt: p.session.startedAt,
                lastActiveAt: p.session.lastActiveAt,
                duration: p.session.duration || 0,
                messageCount: p.session.messageCount || 0,
                currentTask: p.session.currentTask,
              } : undefined,
              // Include git data if available
              git: p.git ? {
                isGitRepo: p.git.isGitRepo,
                repoUrl: p.git.repoUrl,
                currentBranch: p.git.currentBranch,
                hasUncommittedChanges: p.git.hasUncommittedChanges,
                ahead: p.git.ahead,
                behind: p.git.behind,
                lastPulledAt: p.git.lastPulledAt,
              } : undefined,
              projectDirectory: p.projectDirectory,
            }));

            const projectMap = new Map<string, ProjectSummary>();
            summaries.forEach((p) => projectMap.set(p.projectId, p));
            set({ projects: projectMap });
          }
        } catch (error) {
          console.error('Failed to refresh projects:', error);
        } finally {
          set({ isLoadingProjects: false });
        }
      },
    }),
    { name: 'multi-project-store' }
  )
);
