import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getGitStatus, isGitRepository } from '@/services/git-service';
import { getSession } from '@/services/session-service';
import { multiAgentService } from '@/services/multi-agent-service';
import { getProjectsBaseDir } from '@/lib/project-paths';

// In-memory storage (synced with disk for persistence)
const projects: Map<string, any> = new Map();
// Track deleted project IDs so they don't get re-discovered
const deletedProjectIds: Set<string> = new Set();
// Projects metadata stays in ai-dev-platform-v2/data/ for the app to access
// Actual project files are created dynamically based on OS
const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');
const DELETED_FILE = path.join(process.cwd(), 'data', 'deleted-projects.json');

// Load projects from disk on startup
async function loadProjects() {
  console.log(`[loadProjects] Starting...`);

  // Load deleted project IDs first
  try {
    const deletedData = await fs.readFile(DELETED_FILE, 'utf-8');
    const deletedArray = JSON.parse(deletedData);
    deletedArray.forEach((id: string) => deletedProjectIds.add(id));
    console.log(`🗑️  Loaded ${deletedProjectIds.size} deleted project IDs:`, deletedArray);
  } catch (e) {
    console.log(`[loadProjects] No deleted file yet:`, e);
  }

  // Then, try to load from the projects.json file
  try {
    const data = await fs.readFile(PROJECTS_FILE, 'utf-8');
    const projectsArray = JSON.parse(data);
    let removedCount = 0;

    for (const project of projectsArray) {
      // Skip if this project was deleted
      if (deletedProjectIds.has(project.projectId)) {
        continue;
      }

      // Check if project directory exists - if not, skip it
      const projectDir = project.projectDirectory || path.join(getProjectsBaseDir(), project.projectId);
      try {
        await fs.access(projectDir);

        // Infer buildType if not set
        if (!project.buildType) {
          try {
            await fs.access(path.join(projectDir, 'plan.md'));
            project.buildType = 'complex';
          } catch {
            try {
              const files = await fs.readdir(projectDir, { recursive: true });
              const sourceFiles = files.filter((f: any) =>
                typeof f === 'string' &&
                !f.includes('node_modules') &&
                !f.includes('.git') &&
                (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'))
              );
              project.buildType = sourceFiles.length >= 25 ? 'complex' : 'quick';
            } catch {
              project.buildType = 'quick';
            }
          }
        }

        projects.set(project.projectId, project);
      } catch {
        // Directory doesn't exist - don't add to projects map
        console.log(`🗑️  Removing project ${project.projectId} - directory not found: ${projectDir}`);
        removedCount++;
      }
    }

    console.log(`✅ Loaded ${projects.size} projects from projects.json`);
    if (removedCount > 0) {
      console.log(`🧹 Removed ${removedCount} projects with missing directories`);
      // Save the cleaned up projects list
      await saveProjects();
    }
  } catch (error) {
    // File doesn't exist yet, that's okay
    console.log('ℹ️ No existing projects.json file found');
  }

  // Then, scan the projects base directory for any projects not in the JSON
  // This discovers projects in the configured coding directory
  try {
    const baseDir = getProjectsBaseDir();
    console.log(`[loadProjects] Scanning directory: ${baseDir}`);
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    let discoveredCount = 0;

    for (const entry of entries) {
      // Skip hidden directories and common non-project folders
      if (!entry.isDirectory() || entry.name.startsWith('.') ||
          entry.name === 'node_modules' || entry.name === '__pycache__') {
        continue;
      }

      const projectId = entry.name;
      const projectDir = path.join(baseDir, projectId);

      // Skip if already in the map or was deleted
      if (projects.has(projectId) || deletedProjectIds.has(projectId)) continue;

      // Check if this directory looks like a project (has package.json, .git, or project markers)
      let isProject = false;
      try {
        // Check for common project indicators
        const projectIndicators = ['package.json', '.git', 'Cargo.toml', 'go.mod', 'requirements.txt', 'pom.xml', 'build.gradle', 'project.json', 'project-state.json'];
        for (const indicator of projectIndicators) {
          try {
            await fs.access(path.join(projectDir, indicator));
            isProject = true;
            break;
          } catch {
            // Indicator not found, try next
          }
        }
      } catch {
        // Skip if we can't access the directory
        continue;
      }

      if (isProject) {
        try {
          // Try multiple files to find project info
          let projectData: any = {};
          let requirements = '';
          let projectName = projectId;

          // Try project.json first
          try {
            const projectJsonPath = path.join(projectDir, 'project.json');
            projectData = JSON.parse(await fs.readFile(projectJsonPath, 'utf-8'));
            requirements = projectData.requirements || projectData.config?.requirements || '';
            projectName = projectData.name || projectData.config?.name || projectId;
          } catch {}

          // Try project-state.json for additional data
          try {
            const statePath = path.join(projectDir, 'project-state.json');
            const stateData = JSON.parse(await fs.readFile(statePath, 'utf-8'));
            if (!requirements) {
              requirements = stateData.requirements || stateData.config?.requirements || '';
            }
            if (projectName === projectId) {
              projectName = stateData.name || stateData.config?.name || projectId;
            }
            // Get buildType from state if not in project.json
            if (!projectData.buildType && stateData.buildType) {
              projectData.buildType = stateData.buildType;
            }
          } catch {}

          // Check if it's a git clone - use repo URL as description
          if (!requirements) {
            try {
              const gitConfigPath = path.join(projectDir, '.git', 'config');
              const gitConfig = await fs.readFile(gitConfigPath, 'utf-8');
              const urlMatch = gitConfig.match(/url = (.+)/);
              if (urlMatch) {
                requirements = `Cloned from ${urlMatch[1]}`;
              }
            } catch {}
          }

          // Infer buildType if not set - check for complex or quick build indicators
          if (!projectData.buildType) {
            try {
              // Check for plan.md (indicates complex/planned build)
              await fs.access(path.join(projectDir, 'plan.md'));
              projectData.buildType = 'complex';
            } catch {
              // Check file count - complex builds typically have more files
              try {
                const files = await fs.readdir(projectDir, { recursive: true });
                const sourceFiles = files.filter((f: any) =>
                  typeof f === 'string' &&
                  !f.includes('node_modules') &&
                  !f.includes('.git') &&
                  (f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx'))
                );
                // 25+ source files suggests a complex build
                if (sourceFiles.length >= 25) {
                  projectData.buildType = 'complex';
                }
              } catch {}
            }
          }

          // Register this project
          projects.set(projectId, {
            projectId,
            requirements,
            config: {
              name: projectName,
              description: requirements.substring(0, 100) || 'No description',
              techStack: ['next.js', 'typescript', 'tailwind'],
              requirements,
              targetPlatform: 'web' as const,
              deployment: {
                provider: 'aws' as const,
                region: 'us-east-1',
                environment: 'dev' as const,
              },
            },
            status: projectData.status || 'idle',
            progress: projectData.progress || 0,
            projectDirectory: projectDir,
            createdAt: projectData.createdAt || new Date().toISOString(),
            updatedAt: projectData.updatedAt || new Date().toISOString(),
            buildType: projectData.buildType || 'quick',
          });
          discoveredCount++;
        } catch (err) {
          // Complete failure - create minimal entry
          console.log(`⚠️ Could not load project ${projectId}:`, err);
          projects.set(projectId, {
            projectId,
            requirements: 'Unknown project',
            config: {
              name: projectId,
              description: 'Recovered project',
              techStack: ['next.js', 'typescript', 'tailwind'],
              requirements: 'Unknown project',
              targetPlatform: 'web' as const,
              deployment: {
                provider: 'aws' as const,
                region: 'us-east-1',
                environment: 'dev' as const,
              },
            },
            status: 'idle',
            progress: 0,
            projectDirectory: projectDir,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            buildType: 'quick', // Default to quick for recovered projects
          });
          discoveredCount++;
        }
      }
    }

    if (discoveredCount > 0) {
      console.log(`🔍 Discovered ${discoveredCount} projects from filesystem`);
      // Save the newly discovered projects
      await saveProjects();
    }
  } catch (error) {
    console.log('ℹ️ Could not scan projects directory:', error);
  }

  console.log(`📊 Total projects: ${projects.size}`);
}

// Save projects to disk
async function saveProjects() {
  try {
    const projectsArray = Array.from(projects.values());
    const projectsDir = path.dirname(PROJECTS_FILE);
    await fs.mkdir(projectsDir, { recursive: true });
    await fs.writeFile(PROJECTS_FILE, JSON.stringify(projectsArray, null, 2), 'utf-8');
    console.log(`💾 Saved ${projectsArray.length} projects to disk`);
  } catch (error) {
    console.error('❌ Failed to save projects:', error);
  }
}

// Save deleted project IDs to disk
async function saveDeletedProjects() {
  try {
    const deletedArray = Array.from(deletedProjectIds);
    const deletedDir = path.dirname(DELETED_FILE);
    await fs.mkdir(deletedDir, { recursive: true });
    await fs.writeFile(DELETED_FILE, JSON.stringify(deletedArray, null, 2), 'utf-8');
    console.log(`🗑️  Saved ${deletedArray.length} deleted project IDs to disk`);
  } catch (error) {
    console.error('❌ Failed to save deleted projects:', error);
  }
}

// Initialize projects on first load
let projectsLoaded = false;
let loadingPromise: Promise<void> | null = null;
let lastLoadTime = 0;
const RESCAN_INTERVAL = 60000; // Rescan every 60 seconds (reduced from 10s for performance)

// Reset project cache - call this when config changes
export function resetProjectCache() {
  projects.clear();
  deletedProjectIds.clear();
  projectsLoaded = false;
  loadingPromise = null;
  lastLoadTime = 0;
  console.log('🔄 Project cache reset');
}

async function ensureProjectsLoaded(forceRescan = false) {
  const now = Date.now();
  const shouldRescan = forceRescan || (now - lastLoadTime > RESCAN_INTERVAL);

  // If already loaded and no rescan needed, return immediately
  if (projectsLoaded && !shouldRescan) return;

  // If currently loading, wait for it
  if (loadingPromise) return loadingPromise;

  // Reset the loaded flag to allow rescan
  if (shouldRescan && projectsLoaded) {
    projectsLoaded = false;
  }

  loadingPromise = loadProjects().then(() => {
    projectsLoaded = true;
    lastLoadTime = Date.now();
    loadingPromise = null;
  });

  return loadingPromise;
}

export async function GET() {
  // Ensure projects are loaded before responding
  await ensureProjectsLoaded();

  // Always reload deleted list from disk (in case it was updated by another request)
  try {
    const deletedData = await fs.readFile(DELETED_FILE, 'utf-8');
    const deletedArray = JSON.parse(deletedData);
    deletedProjectIds.clear();
    deletedArray.forEach((id: string) => deletedProjectIds.add(id));
  } catch {
    // No deleted file
  }

  console.log(`[GET /api/projects] Projects: ${projects.size}, Deleted: ${deletedProjectIds.size}`);
  console.log(`[GET /api/projects] Deleted IDs: ${Array.from(deletedProjectIds).join(', ')}`);

  // Filter out deleted projects from the response
  const projectList = Array.from(projects.values())
    .filter(p => !deletedProjectIds.has(p.projectId))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  console.log(`[GET /api/projects] Returning ${projectList.length} projects (after filtering deleted)`);

  // Enrich projects with session and git data
  const enrichedProjects = await Promise.all(
    projectList.map(async (project) => {
      const projectDir = path.join(getProjectsBaseDir(), project.projectId);

      // Get session data - check both session-service AND multi-agent-service
      const session = getSession(project.projectId);
      const multiAgentStatus = multiAgentService.getSessionStatus(project.projectId);

      let sessionSummary = undefined;

      // Prefer multi-agent session if active (this is what's used for builds)
      if (multiAgentStatus.active) {
        sessionSummary = {
          sessionId: multiAgentStatus.sessionId,
          status: 'active',
          startedAt: new Date(),
          lastActiveAt: new Date(),
          duration: 0,
          messageCount: 0,
          currentTask: undefined,
          phase: multiAgentStatus.phase,
          taskCount: multiAgentStatus.taskCount,
          completedCount: multiAgentStatus.completedCount,
        };
      } else if (session) {
        sessionSummary = {
          sessionId: session.sessionId,
          status: session.status,
          startedAt: session.startedAt,
          lastActiveAt: session.lastActiveAt,
          duration: Date.now() - new Date(session.startedAt).getTime(),
          messageCount: session.messages.length,
          currentTask: session.currentTaskId,
        };
      }

      // Get git data if it's a git repo
      let gitSummary = undefined;
      try {
        const isRepo = await isGitRepository(projectDir);
        if (isRepo) {
          const gitStatus = await getGitStatus(projectDir);
          gitSummary = {
            isGitRepo: true,
            repoUrl: project.config?.git?.repoUrl,
            currentBranch: gitStatus.currentBranch,
            hasUncommittedChanges: gitStatus.hasUncommittedChanges,
            ahead: gitStatus.ahead,
            behind: gitStatus.behind,
            lastPulledAt: project.config?.git?.lastPulledAt,
          };
        }
      } catch {
        // Ignore git errors
      }

      // Check if there's an active session/orchestrator for this project
      const activeOrchestrators = (global as any).activeOrchestrators;
      const hasActiveOrchestrator = activeOrchestrators?.has(project.projectId);
      let activeStatus = project.status;
      let activeAgent = undefined;

      // First check multi-agent service (v2 builds)
      if (multiAgentStatus.active) {
        // Map phase to status
        const phaseToStatus: Record<string, string> = {
          'product_owner': 'planning',
          'coder': 'developing',
          'tester': 'testing',
          'security': 'testing',
          'infrastructure': 'deploying',
        };
        activeStatus = phaseToStatus[multiAgentStatus.phase || ''] || 'developing';

        // Get active agent from multi-agent service
        const sessionId = multiAgentService.getSessionIdForProject(project.projectId);
        if (sessionId) {
          const maSession = multiAgentService.getSession(sessionId);
          if (maSession) {
            const workingAgent = Array.from(maSession.agents.values()).find((a: any) => a.status === 'working');
            if (workingAgent) {
              activeAgent = {
                type: (workingAgent as any).role,
                status: 'working',
                currentTask: (workingAgent as any).currentTaskDescription || multiAgentStatus.phase,
              };
            }
          }
        }
      } else if (hasActiveOrchestrator) {
        const orchestrator = activeOrchestrators.get(project.projectId);
        // Override status if orchestrator is running
        if (orchestrator?.state?.status) {
          activeStatus = orchestrator.state.status;
        } else {
          // If orchestrator exists but no status, assume it's building
          activeStatus = 'developing';
        }
        // Get current agent info
        if (orchestrator?.agents) {
          const workingAgent = Array.from(orchestrator.agents.values()).find((a: any) => a.status === 'working');
          if (workingAgent) {
            activeAgent = {
              type: (workingAgent as any).type,
              status: 'working',
              currentTask: (workingAgent as any).currentTask,
            };
          }
        }
      }

      return {
        ...project,
        status: activeStatus,
        activeAgent,
        projectDirectory: projectDir,
        session: sessionSummary,
        git: gitSummary,
      };
    })
  );

  return NextResponse.json({ projects: enrichedProjects });
}

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, requirements, config, buildType } = body;

  const project = {
    projectId,
    requirements,
    config,
    status: 'idle',
    progress: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    buildType: buildType || 'quick', // Default to quick unless specified
  };

  projects.set(projectId, project);
  await saveProjects(); // Persist to disk

  return NextResponse.json({ success: true, project });
}

// PATCH - Update specific fields of a project
export async function PATCH(request: Request) {
  await ensureProjectsLoaded();

  const body = await request.json();
  const { projectId, ...updates } = body;

  if (!projectId) {
    return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
  }

  const project = projects.get(projectId);
  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Update the project with new fields
  const updatedProject = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  projects.set(projectId, updatedProject);
  await saveProjects();

  return NextResponse.json({ success: true, project: updatedProject });
}

// Export projects map and helper functions for other modules
export { projects, saveProjects, deletedProjectIds, saveDeletedProjects, ensureProjectsLoaded };
