/**
 * Project Store - Global state management for project data
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  DevelopmentState,
  Epic,
  Story,
  CodeFile,
  TestSuite,
  SecurityReport,
  DeploymentStatus,
  ClarificationRequest,
  AgentMessage,
  ProjectConfig,
} from '@/lib/agents/types';

interface ProjectStore {
  // State
  project: DevelopmentState | null;
  currentProjectId: string | null;
  epics: Epic[];
  stories: Story[];
  testSuites: Map<string, TestSuite>; // Map of storyId -> TestSuite

  // Actions
  createProject: (config: ProjectConfig, projectId?: string) => void;
  loadProject: (projectId: string) => void;
  updateProjectStatus: (status: DevelopmentState['status']) => void;
  setRequirements: (requirements: string) => void;

  // Epics
  addEpic: (epic: Epic) => void;
  updateEpic: (epicId: string, updates: Partial<Epic>) => void;
  removeEpic: (epicId: string) => void;

  // Stories
  addStory: (story: Story) => void;
  updateStory: (storyId: string, updates: Partial<Story>) => void;
  moveStory: (storyId: string, newStatus: Story['status']) => void;
  removeStory: (storyId: string) => void;
  setCurrentStory: (storyId: string | null) => void;

  // Code Files
  addCodeFile: (file: CodeFile) => void;
  updateCodeFile: (path: string, content: string) => void;
  removeCodeFile: (path: string) => void;
  getCodeFile: (path: string) => CodeFile | undefined;

  // Test Results
  setTestResults: (results: TestSuite) => void;
  addTestSuite: (storyId: string, results: TestSuite) => void;
  updateTestSuite: (storyId: string, updates: Partial<TestSuite>) => void;
  removeTestSuite: (storyId: string) => void;

  // Security
  setSecurityReport: (report: SecurityReport) => void;

  // Deployment
  setDeploymentStatus: (status: DeploymentStatus) => void;
  updateDeploymentStep: (stepId: string, updates: any) => void;

  // Clarifications
  addClarification: (clarification: ClarificationRequest) => void;
  respondToClarification: (clarificationId: string, response: string) => void;

  // Messages
  addMessage: (message: AgentMessage) => void;

  // Errors
  addError: (error: string) => void;
  clearErrors: () => void;

  // Reset
  resetProject: () => void;
}

export const useProjectStore = create<ProjectStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        project: null,
        currentProjectId: null,
        epics: [],
        stories: [],
        testSuites: new Map(),

        // Project actions
        createProject: (config, providedProjectId) =>
          set((state) => {
            const projectId = providedProjectId || `proj-${Date.now()}`;
            const newProject: DevelopmentState = {
              projectId,
              config,
              requirements: '',
              epics: [],
              stories: [],
              agents: [],
              codeFiles: new Map(),
              clarifications: [],
              messages: [],
              errors: [],
              status: 'idle',
              progress: 0,
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            return {
              project: newProject,
              currentProjectId: projectId,
            };
          }),

        loadProject: (projectId) =>
          set((state) => {
            // Clear stories and epics from the previous project to prevent cross-project leakage
            // Only clear if we're actually switching to a different project
            if (state.currentProjectId && state.currentProjectId !== projectId) {
              console.log(`🔄 Switching project from ${state.currentProjectId} to ${projectId} - clearing stories and epics`);
              return {
                currentProjectId: projectId,
                epics: [],
                stories: [],
                testSuites: new Map(),
                project: null, // Will be loaded fresh
              };
            }
            return {
              currentProjectId: projectId,
            };
          }),

        updateProjectStatus: (status) =>
          set((state) => ({
            project: state.project
              ? { ...state.project, status, updatedAt: new Date() }
              : null,
          })),

        setRequirements: (requirements) =>
          set((state) => ({
            project: state.project
              ? { ...state.project, requirements, updatedAt: new Date() }
              : null,
          })),

        // Epic actions
        addEpic: (epic) =>
          set((state) => {
            // Validate project ownership - epic must belong to current project
            if (state.currentProjectId && epic.projectId && epic.projectId !== state.currentProjectId) {
              console.warn(`Epic ${epic.id} belongs to project ${epic.projectId}, but current project is ${state.currentProjectId}. Ignoring.`);
              return state;
            }

            // Check if epic already exists to prevent duplicates
            const epicExists = state.epics.some((e) => e.id === epic.id);

            if (epicExists) {
              console.warn(`Duplicate epic detected and ignored: ${epic.id}`);
              return state;
            }

            // Ensure projectId is set on the epic
            const epicWithProjectId = {
              ...epic,
              projectId: epic.projectId || state.currentProjectId || state.project?.projectId || '',
            };

            return {
              epics: [...state.epics, epicWithProjectId],
              project: state.project
                ? {
                    ...state.project,
                    epics: [...state.project.epics, epicWithProjectId],
                    updatedAt: new Date(),
                  }
                : null,
            };
          }),

        updateEpic: (epicId, updates) =>
          set((state) => ({
            epics: state.epics.map((e) =>
              e.id === epicId ? { ...e, ...updates } : e
            ),
            project: state.project
              ? {
                  ...state.project,
                  epics: state.project.epics.map((e) =>
                    e.id === epicId ? { ...e, ...updates } : e
                  ),
                  updatedAt: new Date(),
                }
              : null,
          })),

        removeEpic: (epicId) =>
          set((state) => ({
            epics: state.epics.filter((e) => e.id !== epicId),
            project: state.project
              ? {
                  ...state.project,
                  epics: state.project.epics.filter((e) => e.id !== epicId),
                  updatedAt: new Date(),
                }
              : null,
          })),

        // Story actions
        addStory: (story) =>
          set((state) => {
            // Validate project ownership - story must belong to current project
            if (state.currentProjectId && story.projectId && story.projectId !== state.currentProjectId) {
              console.warn(`Story ${story.id} belongs to project ${story.projectId}, but current project is ${state.currentProjectId}. Ignoring.`);
              return state;
            }

            // Check if story already exists by ID
            const storyExistsById = state.stories.some((s) => s.id === story.id);
            if (storyExistsById) {
              console.warn(`Duplicate story (by ID) detected and ignored: ${story.id}`);
              return state;
            }

            // Also check by title + epicId to catch semantic duplicates
            const storyExistsByTitle = state.stories.some(
              (s) => s.epicId === story.epicId && s.title === story.title
            );
            if (storyExistsByTitle) {
              console.warn(`Duplicate story (by title) detected and ignored: ${story.title}`);
              return state;
            }

            // Ensure projectId is set on the story
            const storyWithProjectId = {
              ...story,
              projectId: story.projectId || state.currentProjectId || state.project?.projectId || '',
            };

            return {
              stories: [...state.stories, storyWithProjectId],
              project: state.project
                ? {
                    ...state.project,
                    stories: [...state.project.stories, storyWithProjectId],
                    updatedAt: new Date(),
                  }
                : null,
            };
          }),

        updateStory: (storyId, updates) =>
          set((state) => ({
            stories: state.stories.map((s) =>
              s.id === storyId ? { ...s, ...updates, updatedAt: new Date() } : s
            ),
            project: state.project
              ? {
                  ...state.project,
                  stories: state.project.stories.map((s) =>
                    s.id === storyId ? { ...s, ...updates, updatedAt: new Date() } : s
                  ),
                  updatedAt: new Date(),
                }
              : null,
          })),

        moveStory: (storyId, newStatus) =>
          set((state) => ({
            stories: state.stories.map((s) =>
              s.id === storyId ? { ...s, status: newStatus, updatedAt: new Date() } : s
            ),
            project: state.project
              ? {
                  ...state.project,
                  stories: state.project.stories.map((s) =>
                    s.id === storyId ? { ...s, status: newStatus, updatedAt: new Date() } : s
                  ),
                  updatedAt: new Date(),
                }
              : null,
          })),

        removeStory: (storyId) =>
          set((state) => ({
            stories: state.stories.filter((s) => s.id !== storyId),
            project: state.project
              ? {
                  ...state.project,
                  stories: state.project.stories.filter((s) => s.id !== storyId),
                  updatedAt: new Date(),
                }
              : null,
          })),

        setCurrentStory: (storyId) =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  currentStory: storyId
                    ? state.project.stories.find((s) => s.id === storyId)
                    : undefined,
                  updatedAt: new Date(),
                }
              : null,
          })),

        // Code file actions
        addCodeFile: (file) =>
          set((state) => {
            if (!state.project) return state;

            const newCodeFiles = new Map(state.project.codeFiles);
            newCodeFiles.set(file.path, file);

            return {
              project: {
                ...state.project,
                codeFiles: newCodeFiles,
                updatedAt: new Date(),
              },
            };
          }),

        updateCodeFile: (path, content) =>
          set((state) => {
            if (!state.project) return state;

            const newCodeFiles = new Map(state.project.codeFiles);
            const existingFile = newCodeFiles.get(path);

            if (existingFile) {
              newCodeFiles.set(path, {
                ...existingFile,
                content,
                modified: true,
                lastModified: new Date(),
              });
            }

            return {
              project: {
                ...state.project,
                codeFiles: newCodeFiles,
                updatedAt: new Date(),
              },
            };
          }),

        removeCodeFile: (path) =>
          set((state) => {
            if (!state.project) return state;

            const newCodeFiles = new Map(state.project.codeFiles);
            newCodeFiles.delete(path);

            return {
              project: {
                ...state.project,
                codeFiles: newCodeFiles,
                updatedAt: new Date(),
              },
            };
          }),

        getCodeFile: (path) => {
          const state = get();
          return state.project?.codeFiles.get(path);
        },

        // Test results - REPLACES previous results entirely (no accumulation)
        // This is the authoritative source for test metrics
        setTestResults: (results) =>
          set((state) => {
            // Log for debugging test result updates
            console.log('📊 Setting test results:', {
              passed: results.passed,
              failed: results.failed,
              skipped: results.skipped,
              total: (results.passed || 0) + (results.failed || 0) + (results.skipped || 0),
            });

            return {
              project: state.project
                ? {
                    ...state.project,
                    testResults: results,
                    updatedAt: new Date(),
                  }
                : null,
            };
          }),

        addTestSuite: (storyId, results) =>
          set((state) => {
            const newTestSuites = new Map(state.testSuites);
            newTestSuites.set(storyId, results);
            return { testSuites: newTestSuites };
          }),

        updateTestSuite: (storyId, updates) =>
          set((state) => {
            const newTestSuites = new Map(state.testSuites);
            const existing = newTestSuites.get(storyId);
            if (existing) {
              newTestSuites.set(storyId, { ...existing, ...updates });
            }
            return { testSuites: newTestSuites };
          }),

        removeTestSuite: (storyId) =>
          set((state) => {
            const newTestSuites = new Map(state.testSuites);
            newTestSuites.delete(storyId);
            return { testSuites: newTestSuites };
          }),

        // Security
        setSecurityReport: (report) =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  securityReport: report,
                  updatedAt: new Date(),
                }
              : null,
          })),

        // Deployment
        setDeploymentStatus: (status) =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  deployment: status,
                  updatedAt: new Date(),
                }
              : null,
          })),

        updateDeploymentStep: (stepId, updates) =>
          set((state) => {
            if (!state.project?.deployment) return state;

            return {
              project: {
                ...state.project,
                deployment: {
                  ...state.project.deployment,
                  steps: state.project.deployment.steps.map((step) =>
                    step.id === stepId ? { ...step, ...updates } : step
                  ),
                },
                updatedAt: new Date(),
              },
            };
          }),

        // Clarifications
        addClarification: (clarification) =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  clarifications: [...state.project.clarifications, clarification],
                  updatedAt: new Date(),
                }
              : null,
          })),

        respondToClarification: (clarificationId, response) =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  clarifications: state.project.clarifications.map((c) =>
                    c.id === clarificationId
                      ? { ...c, response, respondedAt: new Date() }
                      : c
                  ),
                  updatedAt: new Date(),
                }
              : null,
          })),

        // Messages
        addMessage: (message) =>
          set((state) => {
            if (!state.project) return { project: null };

            // Check if message already exists to prevent duplicates
            const messageExists = state.project.messages.some(
              (m) => m.id === message.id
            );

            if (messageExists) {
              console.warn(`Duplicate message detected and ignored: ${message.id}`);
              return state;
            }

            return {
              project: {
                ...state.project,
                messages: [...state.project.messages, message],
                updatedAt: new Date(),
              },
            };
          }),

        // Errors
        addError: (error) =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  errors: [...state.project.errors, error],
                  updatedAt: new Date(),
                }
              : null,
          })),

        clearErrors: () =>
          set((state) => ({
            project: state.project
              ? {
                  ...state.project,
                  errors: [],
                  updatedAt: new Date(),
                }
              : null,
          })),

        // Reset
        resetProject: () =>
          set({
            project: null,
            currentProjectId: null,
            epics: [],
            stories: [],
            testSuites: new Map(),
          }),
      }),
      {
        name: 'project-storage',
        partialize: (state) => ({
          currentProjectId: state.currentProjectId,
          // Don't persist entire project to avoid localStorage size limits
          // In production, would sync with backend
        }),
      }
    )
  )
);
