/**
 * Project Persistence - Save/load project state to disk
 */

import { promises as fs } from 'fs';
import path from 'path';
import type { DevelopmentState, Epic, Story, AgentMessage, TestSuite, SecurityReport } from './agents/types';

export interface BuildMetrics {
  filesCreated: number;
  filesModified: number;
  commandsRun: number;
  toolCalls?: number;
  linesOfCode?: number;
  iterations?: number;
  elapsedTime?: number;
  startTime?: string;
  endTime?: string;
  duration?: number;
  phase?: string;
  devMode?: boolean; // True if built in dev mode (skipped production build)
}

export interface TestingMetrics {
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  passRate: number;
  coverage?: number;
  duration: number;
  storiesTested: number;
  storiesPassed: number;
  testFiles: string[];
  seenTaskIds: string[];
}

export interface SecurityMetrics {
  score: number;
  grade?: string;
  rating?: string;
  riskLevel?: string;
  findings?: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
  };
  owasp?: Record<string, number>;
  breakdown: {
    sast: number;
    secrets: number;
    dependencies: number;
  };
  vulnerabilities: any[];
  recommendations?: string[];
  scanDuration?: number;
  categories?: Record<string, number>;
}

export interface DoraMetrics {
  deploymentFrequency: number;
  leadTimeForChanges: number;
  changeFailureRate: number;
  meanTimeToRecovery: number;
  dfRating?: string;
  ltRating?: string;
  cfrRating?: string;
  mttrRating?: string;
}

export interface ProjectState {
  projectId: string;
  requirements: string;
  config: any;
  epics: Epic[];
  stories: Story[];
  messages: AgentMessage[];
  testResults?: TestSuite;
  securityReport?: any;
  deployment?: any;
  status: string;
  progress: number;
  errors: string[];
  // Build type - quick (simple-builder) or complex (multi-agent)
  buildType?: 'quick' | 'complex';
  createdAt: string;
  updatedAt: string;
  // Build metrics for resume functionality
  buildMetrics?: BuildMetrics;
  testingMetrics?: TestingMetrics;
  securityMetrics?: SecurityMetrics;
  doraMetrics?: DoraMetrics;
  // File changes tracking
  fileChanges?: Array<{
    path: string;
    type: 'created' | 'modified' | 'deleted';
    timestamp: string;
  }>;
  // Agent states for resume
  agentStates?: Record<string, {
    status: string;
    lastTask?: string;
    completedTasks?: string[];
  }>;
  // Tasks for multi-agent workflow
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    epic_id?: string;
    files?: string[];
    result?: string;
  }>;
}

/**
 * Save full project state to project directory
 */
export async function saveProjectState(projectDir: string, state: Partial<ProjectState>) {
  try {
    const stateFile = path.join(projectDir, 'project-state.json');

    // Ensure project directory exists
    await fs.mkdir(projectDir, { recursive: true });

    // Load existing state if it exists
    let existingState: ProjectState | null = null;
    try {
      const data = await fs.readFile(stateFile, 'utf-8');
      existingState = JSON.parse(data);
    } catch (error) {
      // File doesn't exist yet, that's okay
    }

    // Merge with existing state
    const mergedState: ProjectState = {
      ...(existingState || {}),
      ...state,
      updatedAt: new Date().toISOString(),
    } as ProjectState;

    // Write to disk
    await fs.writeFile(stateFile, JSON.stringify(mergedState, null, 2), 'utf-8');
    console.log(`💾 Saved project state to ${stateFile}`);

    return mergedState;
  } catch (error) {
    console.error('❌ Failed to save project state:', error);
    throw error;
  }
}

/**
 * Load project state from project directory
 */
export async function loadProjectState(projectDir: string): Promise<ProjectState | null> {
  try {
    const stateFile = path.join(projectDir, 'project-state.json');
    const data = await fs.readFile(stateFile, 'utf-8');
    const state = JSON.parse(data);
    console.log(`✅ Loaded project state from ${stateFile}`);
    return state;
  } catch (error) {
    console.log(`ℹ️ No existing project state found at ${projectDir}`);
    return null;
  }
}

/**
 * Append a message to project state
 */
export async function appendMessage(projectDir: string, message: AgentMessage) {
  try {
    const state = await loadProjectState(projectDir);
    const messages = state?.messages || [];

    // Check for duplicates
    if (messages.some(m => m.id === message.id)) {
      console.log(`⚠️ Duplicate message ${message.id}, skipping`);
      return;
    }

    messages.push(message);

    await saveProjectState(projectDir, {
      ...state,
      messages,
    });
  } catch (error) {
    console.error('❌ Failed to append message:', error);
  }
}

/**
 * Update epics in project state AND save to backlog structure
 */
export async function updateEpics(projectDir: string, epics: Epic[]) {
  try {
    // Update main project state
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      epics,
    });

    // Save to backlog structure
    const backlogDir = path.join(projectDir, 'backlog');
    const epicsDir = path.join(backlogDir, 'epics');
    await fs.mkdir(epicsDir, { recursive: true });

    // Save each epic to its own file
    for (const epic of epics) {
      const epicFile = path.join(epicsDir, `${epic.id}.json`);
      await fs.writeFile(epicFile, JSON.stringify(epic, null, 2), 'utf-8');
    }

    console.log(`📋 Saved ${epics.length} epics to ${epicsDir}`);
  } catch (error) {
    console.error('❌ Failed to update epics:', error);
  }
}

/**
 * Update stories in project state AND save to backlog structure
 */
export async function updateStories(projectDir: string, stories: Story[]) {
  try {
    // Update main project state
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      stories,
    });

    // Save to backlog structure
    const backlogDir = path.join(projectDir, 'backlog');
    const storiesDir = path.join(backlogDir, 'stories');
    await fs.mkdir(storiesDir, { recursive: true });

    // Save each story to its own file
    for (const story of stories) {
      const storyFile = path.join(storiesDir, `${story.id}.json`);
      await fs.writeFile(storyFile, JSON.stringify(story, null, 2), 'utf-8');
    }

    console.log(`📝 Saved ${stories.length} stories to ${storiesDir}`);
  } catch (error) {
    console.error('❌ Failed to update stories:', error);
  }
}

/**
 * Load epics from backlog structure
 */
export async function loadEpics(projectDir: string): Promise<Epic[]> {
  try {
    const epicsDir = path.join(projectDir, 'backlog', 'epics');
    const files = await fs.readdir(epicsDir);
    const epics: Epic[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const epicFile = path.join(epicsDir, file);
        const data = await fs.readFile(epicFile, 'utf-8');
        epics.push(JSON.parse(data));
      }
    }

    console.log(`✅ Loaded ${epics.length} epics from backlog`);
    return epics;
  } catch (error) {
    console.log('ℹ️ No epics found in backlog structure');
    return [];
  }
}

/**
 * Load stories from backlog structure
 */
export async function loadStories(projectDir: string): Promise<Story[]> {
  try {
    const storiesDir = path.join(projectDir, 'backlog', 'stories');
    const files = await fs.readdir(storiesDir);
    const stories: Story[] = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        const storyFile = path.join(storiesDir, file);
        const data = await fs.readFile(storyFile, 'utf-8');
        stories.push(JSON.parse(data));
      }
    }

    console.log(`✅ Loaded ${stories.length} stories from backlog`);
    return stories;
  } catch (error) {
    console.log('ℹ️ No stories found in backlog structure');
    return [];
  }
}

/**
 * Update a single story in the backlog
 */
export async function updateStory(projectDir: string, storyId: string, updates: Partial<Story>) {
  try {
    const storyFile = path.join(projectDir, 'backlog', 'stories', `${storyId}.json`);

    // Load existing story
    const data = await fs.readFile(storyFile, 'utf-8');
    const story = JSON.parse(data);

    // Merge updates
    const updatedStory = {
      ...story,
      ...updates,
      updatedAt: new Date(),
    };

    // Save back
    await fs.writeFile(storyFile, JSON.stringify(updatedStory, null, 2), 'utf-8');
    console.log(`✅ Updated story ${storyId}`);

    return updatedStory;
  } catch (error) {
    console.error(`❌ Failed to update story ${storyId}:`, error);
  }
}

/**
 * Update a single epic in the backlog
 */
export async function updateEpic(projectDir: string, epicId: string, updates: Partial<Epic>) {
  try {
    const epicFile = path.join(projectDir, 'backlog', 'epics', `${epicId}.json`);

    // Load existing epic
    const data = await fs.readFile(epicFile, 'utf-8');
    const epic = JSON.parse(data);

    // Merge updates
    const updatedEpic = {
      ...epic,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    // Save back
    await fs.writeFile(epicFile, JSON.stringify(updatedEpic, null, 2), 'utf-8');
    console.log(`✅ Updated epic ${epicId} - status: ${updatedEpic.status}`);

    return updatedEpic;
  } catch (error) {
    console.error(`❌ Failed to update epic ${epicId}:`, error);
  }
}

/**
 * Create backlog index/summary file
 */
export async function createBacklogIndex(projectDir: string) {
  try {
    const epics = await loadEpics(projectDir);
    const stories = await loadStories(projectDir);

    // Group stories by epic
    const epicMap = new Map<string, { epic: Epic; stories: Story[] }>();

    for (const epic of epics) {
      epicMap.set(epic.id, { epic, stories: [] });
    }

    for (const story of stories) {
      const epicData = epicMap.get(story.epicId);
      if (epicData) {
        epicData.stories.push(story);
      }
    }

    // Create backlog index
    const backlogIndex = {
      summary: {
        totalEpics: epics.length,
        totalStories: stories.length,
        completedStories: stories.filter(s => s.status === 'done').length,
        inProgressStories: stories.filter(s => s.status === 'in_progress').length,
        backlogStories: stories.filter(s => s.status === 'backlog').length,
      },
      epics: Array.from(epicMap.values()).map(({ epic, stories }) => ({
        id: epic.id,
        title: epic.title,
        description: epic.description,
        priority: epic.priority,
        status: epic.status,
        storyCount: stories.length,
        completedStories: stories.filter(s => s.status === 'done').length,
        stories: stories.map(s => ({
          id: s.id,
          title: s.title,
          status: s.status,
          priority: s.priority,
          storyPoints: s.storyPoints,
          progress: s.progress,
        })),
      })),
      generatedAt: new Date().toISOString(),
    };

    const indexFile = path.join(projectDir, 'backlog', 'backlog-index.json');
    await fs.writeFile(indexFile, JSON.stringify(backlogIndex, null, 2), 'utf-8');

    console.log(`📊 Created backlog index at ${indexFile}`);
    return backlogIndex;
  } catch (error) {
    console.error('❌ Failed to create backlog index:', error);
  }
}

/**
 * Update test results in project state
 */
export async function updateTestResults(projectDir: string, testResults: TestSuite) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      testResults,
    });
  } catch (error) {
    console.error('❌ Failed to update test results:', error);
  }
}

/**
 * Update security report in project state
 */
export async function updateSecurityReport(projectDir: string, securityReport: any) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      securityReport,
    });
  } catch (error) {
    console.error('❌ Failed to update security report:', error);
  }
}

/**
 * Update project status and progress
 */
export async function updateProjectProgress(projectDir: string, status: string, progress: number) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      status,
      progress,
    });
  } catch (error) {
    console.error('❌ Failed to update project progress:', error);
  }
}

/**
 * Update build metrics
 */
export async function updateBuildMetrics(projectDir: string, buildMetrics: Partial<BuildMetrics>) {
  try {
    const state = await loadProjectState(projectDir);
    const existingMetrics = state?.buildMetrics || {
      filesCreated: 0,
      filesModified: 0,
      commandsRun: 0,
    };

    await saveProjectState(projectDir, {
      ...state,
      buildMetrics: {
        ...existingMetrics,
        ...buildMetrics,
      },
    });
    console.log('📊 Updated build metrics');
  } catch (error) {
    console.error('❌ Failed to update build metrics:', error);
  }
}

/**
 * Update testing metrics
 */
export async function updateTestingMetrics(projectDir: string, testingMetrics: TestingMetrics) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      testingMetrics,
    });
    console.log('🧪 Updated testing metrics:', {
      total: testingMetrics.totalTests,
      passed: testingMetrics.passed,
      failed: testingMetrics.failed,
    });
  } catch (error) {
    console.error('❌ Failed to update testing metrics:', error);
  }
}

/**
 * Update security metrics
 */
export async function updateSecurityMetrics(projectDir: string, securityMetrics: SecurityMetrics) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      securityMetrics,
    });
    console.log('🔒 Updated security metrics:', {
      score: securityMetrics.score,
      rating: securityMetrics.rating,
    });
  } catch (error) {
    console.error('❌ Failed to update security metrics:', error);
  }
}

/**
 * Update DORA metrics
 */
export async function updateDoraMetrics(projectDir: string, doraMetrics: DoraMetrics) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      doraMetrics,
    });
    console.log('📈 Updated DORA metrics');
  } catch (error) {
    console.error('❌ Failed to update DORA metrics:', error);
  }
}

/**
 * Update tasks for multi-agent workflow
 */
export async function updateTasks(projectDir: string, tasks: ProjectState['tasks']) {
  try {
    const state = await loadProjectState(projectDir);
    await saveProjectState(projectDir, {
      ...state,
      tasks,
    });
    console.log(`📋 Updated ${tasks?.length || 0} tasks`);
  } catch (error) {
    console.error('❌ Failed to update tasks:', error);
  }
}

/**
 * Add a file change record
 */
export async function addFileChange(
  projectDir: string,
  filePath: string,
  type: 'created' | 'modified' | 'deleted'
) {
  try {
    const state = await loadProjectState(projectDir);
    const fileChanges = state?.fileChanges || [];

    // Check if file already tracked, update type if so
    const existingIndex = fileChanges.findIndex(f => f.path === filePath);
    if (existingIndex >= 0) {
      fileChanges[existingIndex] = {
        path: filePath,
        type,
        timestamp: new Date().toISOString(),
      };
    } else {
      fileChanges.push({
        path: filePath,
        type,
        timestamp: new Date().toISOString(),
      });
    }

    await saveProjectState(projectDir, {
      ...state,
      fileChanges,
    });
  } catch (error) {
    console.error('❌ Failed to add file change:', error);
  }
}

/**
 * Update agent state for resume functionality
 */
export async function updateAgentState(
  projectDir: string,
  agentType: string,
  agentState: { status: string; lastTask?: string; completedTasks?: string[] }
) {
  try {
    const state = await loadProjectState(projectDir);
    const agentStates = state?.agentStates || {};

    agentStates[agentType] = {
      ...agentStates[agentType],
      ...agentState,
    };

    await saveProjectState(projectDir, {
      ...state,
      agentStates,
    });
  } catch (error) {
    console.error('❌ Failed to update agent state:', error);
  }
}

/**
 * Load full project state for resume - combines all sources
 */
export async function loadFullProjectState(projectDir: string): Promise<ProjectState | null> {
  try {
    // Load main state from project-state.json
    let state = await loadProjectState(projectDir);

    // If no project-state.json, try to create one from project.json (legacy)
    if (!state) {
      try {
        const projectFile = path.join(projectDir, 'project.json');
        const projectData = await fs.readFile(projectFile, 'utf-8');
        const projectJson = JSON.parse(projectData);

        // Create initial state from project.json
        state = {
          projectId: projectJson.projectId || path.basename(projectDir),
          requirements: projectJson.requirements || '',
          config: {
            name: projectJson.name || projectJson.projectId || path.basename(projectDir),
            description: projectJson.requirements?.substring(0, 100) || '',
            techStack: ['next.js', 'typescript', 'tailwind'],
            requirements: projectJson.requirements || '',
            targetPlatform: 'web' as const,
            deployment: {
              provider: 'aws' as const,
              region: 'us-east-1',
              environment: 'dev' as const,
            },
          },
          epics: [],
          stories: [],
          messages: [],
          status: projectJson.status || 'idle',
          progress: projectJson.progress || 0,
          errors: [],
          createdAt: projectJson.createdAt || new Date().toISOString(),
          updatedAt: projectJson.updatedAt || new Date().toISOString(),
        };
        console.log('📂 Created state from project.json');
      } catch {
        console.log('ℹ️ No project.json found either');
        return null;
      }
    }

    // Ensure config exists
    if (!state.config && state.requirements) {
      state.config = {
        name: state.projectId || path.basename(projectDir),
        description: state.requirements?.substring(0, 100) || '',
        techStack: ['next.js', 'typescript', 'tailwind'],
        requirements: state.requirements || '',
        targetPlatform: 'web' as const,
        deployment: {
          provider: 'aws' as const,
          region: 'us-east-1',
          environment: 'dev' as const,
        },
      };
    }

    // Load epics and stories from backlog if not in state
    if (!state.epics || state.epics.length === 0) {
      state.epics = await loadEpics(projectDir);
    }
    if (!state.stories || state.stories.length === 0) {
      state.stories = await loadStories(projectDir);
    }

    // Load tasks - .agile-stories.json is the SOURCE OF TRUTH for tasks/epics
    // It's committed to git and always correct, while project-state.json may have stale data
    let loadedFromAgileStories = false;

    try {
      const agileStoriesFile = path.join(projectDir, '.agile-stories.json');
      const agileStoriesData = await fs.readFile(agileStoriesFile, 'utf-8');
      const agileStories = JSON.parse(agileStoriesData);

      // ALWAYS use epics from .agile-stories.json (source of truth)
      if (agileStories.epics && agileStories.epics.length > 0) {
        state.epics = agileStories.epics;
      }

      // ALWAYS use tasks from .agile-stories.json (source of truth)
      // This overrides any stale tasks from project-state.json
      if (agileStories.tasks && agileStories.tasks.length > 0) {
        state.tasks = agileStories.tasks.map((t: any) => ({
          ...t,
          acceptanceCriteria: t.acceptanceCriteria || t.acceptance_criteria || [],
          storyPoints: t.storyPoints || t.story_points,
          epicId: t.epicId || t.epic_id,
          assignedTo: t.assignedTo || t.assigned_to,
        }));
        loadedFromAgileStories = true;
        console.log(`📂 Loaded ${state.tasks?.length ?? 0} tasks from .agile-stories.json (source of truth)`);
      }
    } catch {
      // No .agile-stories.json file, try fallbacks
    }

    // Fallback: if no .agile-stories.json, try legacy .agent-stories.json
    if (!loadedFromAgileStories) {
      try {
        const agentStoriesFile = path.join(projectDir, '.agent-stories.json');
        const agentStoriesData = await fs.readFile(agentStoriesFile, 'utf-8');
        const agentStories = JSON.parse(agentStoriesData);

        if (agentStories.epics && agentStories.epics.length > 0 && (!state.epics || state.epics.length === 0)) {
          state.epics = agentStories.epics;
        }

        if (agentStories.tasks && agentStories.tasks.length > 0 && (!state.tasks || state.tasks.length === 0)) {
          state.tasks = agentStories.tasks.map((t: any) => ({
            ...t,
            acceptanceCriteria: t.acceptanceCriteria || t.acceptance_criteria || [],
            storyPoints: t.storyPoints || t.story_points,
            epicId: t.epicId || t.epic_id,
            assignedTo: t.assignedTo || t.assigned_to,
          }));
          loadedFromAgileStories = true;
          console.log('📂 Loaded tasks/epics from legacy .agent-stories.json');
        }
      } catch {
        // No legacy stories file
      }
    }

    // Final fallback: if still no tasks, try tasks.json
    if (!state.tasks || state.tasks.length === 0) {
      try {
        const tasksFile = path.join(projectDir, 'tasks.json');
        const tasksData = await fs.readFile(tasksFile, 'utf-8');
        const parsed = JSON.parse(tasksData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          state.tasks = parsed;
          console.log(`📂 Loaded ${state.tasks.length} tasks from tasks.json (fallback)`);
        }
      } catch {
        // No tasks.json file
      }
    }

    // Load session state if available
    try {
      const sessionFile = path.join(projectDir, 'session-state.json');
      const sessionData = await fs.readFile(sessionFile, 'utf-8');
      const session = JSON.parse(sessionData);
      // Merge session messages if not already in state
      if (session.messages && session.messages.length > 0) {
        const existingIds = new Set((state.messages || []).map(m => m.id));
        const newMessages = session.messages.filter((m: any) => !existingIds.has(m.id));
        state.messages = [...(state.messages || []), ...newMessages];
      }
    } catch {
      // No session file
    }

    // Fix inconsistency: if project status is 'completed', ensure all tasks/epics are marked complete
    if (state.status === 'completed') {
      if (state.tasks && state.tasks.length > 0) {
        let tasksFixed = 0;
        state.tasks = state.tasks.map((task: any) => {
          if (task.status !== 'completed' && task.status !== 'done') {
            tasksFixed++;
            return { ...task, status: 'completed' };
          }
          return task;
        });
        if (tasksFixed > 0) {
          console.log(`🔧 Auto-fixed ${tasksFixed} task statuses to match project completion`);
        }
      }
      if (state.epics && state.epics.length > 0) {
        state.epics = state.epics.map((epic: any) => {
          if (epic.status !== 'completed' && epic.status !== 'done') {
            return { ...epic, status: 'completed' };
          }
          return epic;
        });
      }
    }

    console.log('✅ Loaded full project state:', {
      epics: state.epics?.length || 0,
      stories: state.stories?.length || 0,
      tasks: state.tasks?.length || 0,
      messages: state.messages?.length || 0,
      hasTestingMetrics: !!state.testingMetrics,
      hasBuildMetrics: !!state.buildMetrics,
    });

    return state;
  } catch (error) {
    console.error('❌ Failed to load full project state:', error);
    return null;
  }
}

// Test result file structure
interface TestResultFile {
  story_id?: string;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  coverage?: number;
}

/**
 * Aggregate test results from all .test-results-story-*.json files in a project
 * This provides accurate test counts from the actual test result files
 */
export async function aggregateTestResults(projectDir: string): Promise<{
  totalTests: number;
  passed: number;
  failed: number;
  coverage: number;
  storiesTested: number;
}> {
  const result = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    coverage: 0,
    storiesTested: 0,
  };

  try {
    const files = await fs.readdir(projectDir);
    const testResultFiles = files.filter(f =>
      f.startsWith('.test-results-story-') && f.endsWith('.json')
    );

    let totalCoverage = 0;
    let coverageCount = 0;

    for (const file of testResultFiles) {
      try {
        const filePath = path.join(projectDir, file);
        const content = await fs.readFile(filePath, 'utf-8');
        const data: TestResultFile = JSON.parse(content);

        result.totalTests += data.total_tests || 0;
        result.passed += data.passed_tests || 0;
        result.failed += data.failed_tests || 0;
        result.storiesTested++;

        if (data.coverage && data.coverage > 0) {
          totalCoverage += data.coverage;
          coverageCount++;
        }
      } catch {
        // Skip invalid JSON files
      }
    }

    // Use average coverage from stories that have coverage data
    result.coverage = coverageCount > 0 ? Math.round((totalCoverage / coverageCount) * 100) / 100 : 0;
  } catch {
    // Directory read error
  }

  return result;
}
