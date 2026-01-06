import { NextRequest, NextResponse } from 'next/server';
import { projects, saveProjects, ensureProjectsLoaded } from '../../../projects/route';
import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import type { DevelopmentState } from '@/lib/agents/types';
import {
  loadProjectState,
  saveProjectState,
  appendMessage,
  updateEpics,
  updateStories,
  updateTestResults,
  updateSecurityReport,
  updateProjectProgress,
  loadEpics,
  loadStories,
  createBacklogIndex
} from '@/lib/project-persistence';
import { promises as fs } from 'fs';
import path from 'path';
import { getProjectDir } from '@/lib/project-paths';

/**
 * Analyze project directory to determine what's been completed
 */
async function analyzeProjectDirectory(projectDir: string) {
  const analysis = {
    filesFound: [] as string[],
    foldersFound: [] as string[],
    hasPackageJson: false,
    hasSourceCode: false,
    hasTests: false,
    hasComponents: false,
    hasPages: false,
    hasAPI: false,
    estimatedProgress: 0,
    recommendations: [] as string[],
  };

  try {
    // Check if project directory exists
    await fs.access(projectDir);

    // Read directory contents recursively
    async function scanDirectory(dir: string, relativePath: string = '') {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);

        // Skip node_modules, .git, .next
        if (['node_modules', '.git', '.next', 'out', 'build'].includes(entry.name)) {
          continue;
        }

        if (entry.isDirectory()) {
          analysis.foldersFound.push(relPath);
          await scanDirectory(fullPath, relPath);
        } else {
          analysis.filesFound.push(relPath);
        }
      }
    }

    await scanDirectory(projectDir);

    // Analyze what's been built
    analysis.hasPackageJson = analysis.filesFound.includes('package.json');
    analysis.hasSourceCode = analysis.filesFound.some(f =>
      f.endsWith('.ts') || f.endsWith('.tsx') || f.endsWith('.js') || f.endsWith('.jsx')
    );
    analysis.hasTests = analysis.filesFound.some(f =>
      f.includes('.test.') || f.includes('.spec.') || f.includes('__tests__')
    );
    analysis.hasComponents = analysis.foldersFound.some(f => f.includes('component'));
    analysis.hasPages = analysis.foldersFound.some(f => f.includes('pages') || f.includes('app'));
    analysis.hasAPI = analysis.foldersFound.some(f => f.includes('api'));

    // Estimate progress based on what exists
    let progress = 0;
    if (analysis.hasPackageJson) progress += 10;
    if (analysis.hasSourceCode) progress += 30;
    if (analysis.hasComponents) progress += 20;
    if (analysis.hasPages || analysis.hasAPI) progress += 20;
    if (analysis.hasTests) progress += 20;
    analysis.estimatedProgress = Math.min(progress, 100);

    // Generate recommendations
    if (!analysis.hasPackageJson) {
      analysis.recommendations.push('No package.json found - starting from project initialization');
    } else if (!analysis.hasSourceCode) {
      analysis.recommendations.push('Project initialized but no source code found - starting development');
    } else if (!analysis.hasTests) {
      analysis.recommendations.push('Source code found but no tests - will add test coverage');
    } else {
      analysis.recommendations.push('Project has source code and tests - continuing from last checkpoint');
    }

    console.log('📊 Project Analysis:', {
      files: analysis.filesFound.length,
      folders: analysis.foldersFound.length,
      progress: analysis.estimatedProgress,
      recommendations: analysis.recommendations,
    });

  } catch (error) {
    console.log('⚠️ Project directory not found or empty, will start fresh');
    analysis.recommendations.push('Empty project - starting from scratch');
  }

  return analysis;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;

  // Ensure projects are loaded before checking
  await ensureProjectsLoaded();

  const activeOrchestrators = (global as any).activeOrchestrators;
  const project = projects.get(projectId);

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found' },
      { status: 404 }
    );
  }

  try {
    // Check if orchestrator exists and is paused
    if (activeOrchestrators && activeOrchestrators.has(projectId)) {
      const orchestrator = activeOrchestrators.get(projectId);
      orchestrator.resume();

      // Update project status
      project.status = 'developing';
      project.updatedAt = new Date().toISOString();
      await saveProjects();

      console.log(`▶️  Workflow resumed (paused) for project: ${projectId}`);
      return NextResponse.json({ success: true, message: 'Workflow resumed from pause' });
    }

    // Analyze project directory to see what's been completed
    const projectDir = getProjectDir(projectId);
    const analysis = await analyzeProjectDirectory(projectDir);

    // Load saved project state from project directory
    const savedState = await loadProjectState(projectDir);

    // Load epics and stories from backlog structure
    const epicsFromBacklog = await loadEpics(projectDir);
    const storiesFromBacklog = await loadStories(projectDir);

    console.log(`🔄 Resuming stopped workflow for project: ${projectId}`);
    console.log(`📁 Project directory: ${projectDir}`);
    console.log(`📊 Estimated progress: ${analysis.estimatedProgress}%`);
    console.log(`💾 Loaded from backlog structure:`, {
      epics: epicsFromBacklog.length,
      stories: storiesFromBacklog.length,
      messages: savedState?.messages?.length || 0,
    });
    console.log(`💡 Recommendations: ${analysis.recommendations.join(', ')}`);

    // Create new orchestrator with existing project state (prioritize backlog structure over saved state)
    const initialState: DevelopmentState = {
      projectId,
      config: project.config || {
        name: project.projectId,
        description: project.requirements,
        techStack: ['next.js', 'typescript', 'tailwind'],
        requirements: project.requirements,
        targetPlatform: 'web' as const,
        deployment: {
          provider: 'aws' as const,
          region: 'us-east-1',
          environment: 'dev' as const,
        },
      },
      requirements: project.requirements,
      epics: epicsFromBacklog.length > 0 ? epicsFromBacklog : (savedState?.epics || []),  // Prioritize backlog structure
      stories: storiesFromBacklog.length > 0 ? storiesFromBacklog : (savedState?.stories || []),  // Prioritize backlog structure
      agents: [],
      codeFiles: new Map(),
      clarifications: [],
      messages: savedState?.messages || [],  // Restore saved messages
      errors: savedState?.errors || [],
      status: 'idle',
      progress: savedState?.progress || analysis.estimatedProgress,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(),
      projectDirectory: projectDir,
      testResults: savedState?.testResults,  // Restore test results
      securityReport: savedState?.securityReport,  // Restore security report
    };

    // Initialize orchestrator registry if it doesn't exist
    if (!activeOrchestrators) {
      (global as any).activeOrchestrators = new Map();
    }

    // Create and register new orchestrator
    const orchestrator = new AgentOrchestrator(initialState);
    (global as any).activeOrchestrators.set(projectId, orchestrator);

    // Get global socket.io instance for real-time updates
    const io = (global as any).io;

    // Wire up orchestrator events to WebSocket (same as start route)
    if (io) {
      orchestrator.on('workflow:started', (data) => {
        project.status = 'planning';
        project.updatedAt = new Date().toISOString();
        saveProjects();
        updateProjectProgress(projectDir, 'planning', 5);
        io.to(`project:${projectId}`).emit('workflow:started', data);
      });

      orchestrator.on('agent:status', (agent) => {
        io.to(`project:${projectId}`).emit('agent:status', agent);
      });

      orchestrator.on('agent:completed', (agent) => {
        io.to(`project:${projectId}`).emit('agent:completed', agent);
      });

      orchestrator.on('epics:created', (epics) => {
        updateEpics(projectDir, epics);
        io.to(`project:${projectId}`).emit('epics:created', epics);
      });

      orchestrator.on('stories:created', (stories) => {
        project.status = 'developing';
        project.updatedAt = new Date().toISOString();
        saveProjects();
        updateStories(projectDir, stories);
        updateProjectProgress(projectDir, 'developing', 10);
        io.to(`project:${projectId}`).emit('stories:created', stories);
      });

      orchestrator.on('story:started', (story) => {
        io.to(`project:${projectId}`).emit('story:started', story);
      });

      orchestrator.on('story:completed', (story) => {
        io.to(`project:${projectId}`).emit('story:completed', story);
      });

      // Relay story state transitions (in_progress -> testing -> done)
      orchestrator.on('story:updated', (story) => {
        console.log(`📡 Emitting story:updated to project:${projectId}`, { storyId: story.id, status: story.status });
        io.to(`project:${projectId}`).emit('story:updated', story);
      });

      orchestrator.on('code:changed', (data) => {
        io.to(`project:${projectId}`).emit('code:changed', data);
      });

      orchestrator.on('test:results', (results) => {
        updateTestResults(projectDir, results);
        io.to(`project:${projectId}`).emit('test:results', results);
      });

      orchestrator.on('security:report', (report) => {
        updateSecurityReport(projectDir, report);
        io.to(`project:${projectId}`).emit('security:report', report);
      });

      orchestrator.on('workflow:completed', (state) => {
        project.status = 'completed';
        project.progress = 100;
        project.updatedAt = new Date().toISOString();
        saveProjects();
        updateProjectProgress(projectDir, 'completed', 100);
        io.to(`project:${projectId}`).emit('workflow:completed', state);
        (global as any).activeOrchestrators.delete(projectId);
        orchestrator.removeAllListeners();
      });

      orchestrator.on('workflow:error', (data) => {
        project.status = 'error';
        project.updatedAt = new Date().toISOString();
        saveProjects();
        updateProjectProgress(projectDir, 'error', project?.progress || 0);
        io.to(`project:${projectId}`).emit('workflow:error', data);
        (global as any).activeOrchestrators.delete(projectId);
        orchestrator.removeAllListeners();
      });

      orchestrator.on('agent:message', (message) => {
        appendMessage(projectDir, message);
        io.to(`project:${projectId}`).emit('agent:message', message);
      });
    }

    // Emit analysis results to the client
    if (io) {
      const analysisMessage = {
        id: `msg-resume-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: `🔄 **Resuming Project Analysis**\n\n📁 Found ${analysis.filesFound.length} files in project directory\n📊 Saved Progress: ${savedState?.progress || analysis.estimatedProgress}%\n\n**Restored from Backlog Structure:**\n📋 ${epicsFromBacklog.length} Epics\n📝 ${storiesFromBacklog.length} Stories\n💬 ${savedState?.messages?.length || 0} Messages\n${savedState?.testResults ? '✅ Test Results' : '❌ No Tests Yet'}\n${savedState?.securityReport ? '✅ Security Report' : '❌ No Security Scan Yet'}\n\n**File System Status:**\n${analysis.hasPackageJson ? '✅' : '❌'} Package.json\n${analysis.hasSourceCode ? '✅' : '❌'} Source Code\n${analysis.hasComponents ? '✅' : '❌'} Components\n${analysis.hasPages ? '✅' : '❌'} Pages/Routes\n${analysis.hasAPI ? '✅' : '❌'} API Endpoints\n${analysis.hasTests ? '✅' : '❌'} Tests\n\n**Next Steps:**\n${analysis.recommendations.join('\n')}\n\nStarting workflow from where we left off...`,
        timestamp: new Date(),
      };

      io.to(`project:${projectId}`).emit('agent:message', analysisMessage);

      // Re-emit epics and stories from backlog structure so the UI loads them
      if (epicsFromBacklog.length > 0) {
        io.to(`project:${projectId}`).emit('epics:created', epicsFromBacklog);
      }
      if (storiesFromBacklog.length > 0) {
        io.to(`project:${projectId}`).emit('stories:created', storiesFromBacklog);
      }
    }

    // Update project status and progress
    project.status = 'planning';
    project.progress = analysis.estimatedProgress;
    project.updatedAt = new Date().toISOString();
    await saveProjects();

    // Create enhanced requirements with context about what's already done
    const enhancedRequirements = `
RESUMING EXISTING PROJECT

Original Requirements:
${project.requirements}

PROJECT ANALYSIS:
${analysis.recommendations.join('\n')}

Files Found: ${analysis.filesFound.length}
Folders Found: ${analysis.foldersFound.length}
Estimated Progress: ${analysis.estimatedProgress}%

What's Already Done:
- Package.json: ${analysis.hasPackageJson ? 'EXISTS' : 'MISSING'}
- Source Code: ${analysis.hasSourceCode ? 'EXISTS' : 'MISSING'}
- Components: ${analysis.hasComponents ? 'EXISTS' : 'MISSING'}
- Pages/Routes: ${analysis.hasPages ? 'EXISTS' : 'MISSING'}
- API Endpoints: ${analysis.hasAPI ? 'EXISTS' : 'MISSING'}
- Tests: ${analysis.hasTests ? 'EXISTS' : 'MISSING'}

IMPORTANT INSTRUCTIONS:
1. Review the existing code in the project directory: ${projectDir}
2. Determine what features are already implemented
3. Continue from where the previous workflow left off
4. DO NOT re-implement features that already exist
5. Focus on completing missing features and adding tests if needed
6. If the project failed due to an error, identify and fix the error first

Please analyze the existing code and continue development accordingly.
    `.trim();

    // Start the workflow in background with enhanced context
    setImmediate(async () => {
      try {
        await orchestrator.start(enhancedRequirements);
      } catch (error) {
        console.error('Workflow error:', error);
        project.status = 'error';
        project.updatedAt = new Date().toISOString();
        await saveProjects();

        if (io) {
          io.to(`project:${projectId}`).emit('workflow:error', {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    });

    console.log(`✅ Workflow restarted for project: ${projectId}`);

    return NextResponse.json({
      success: true,
      message: 'Workflow resumed with project analysis',
      projectId,
      projectDirectory: projectDir,
      analysis: {
        filesCount: analysis.filesFound.length,
        estimatedProgress: analysis.estimatedProgress,
        recommendations: analysis.recommendations,
      }
    });
  } catch (error) {
    console.error('Error resuming/restarting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to resume workflow' },
      { status: 500 }
    );
  }
}
