import { NextRequest, NextResponse } from 'next/server';
import { AgentOrchestrator } from '@/lib/agents/orchestrator';
import type { DevelopmentState, ProjectConfig } from '@/lib/agents/types';
import { projects, saveProjects } from '../../projects/route';
import {
  saveProjectState,
  appendMessage,
  updateEpics,
  updateStories,
  updateTestResults,
  updateSecurityReport,
  updateProjectProgress,
  createBacklogIndex
} from '@/lib/project-persistence';
import { promises as fs } from 'fs';
import path from 'path';
import { ensureProjectDir, projectDirExists } from '@/lib/project-paths';
import { createSession, addSessionMessage, setCurrentAgent, endSession } from '@/services/session-service';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirements, projectName, config } = body;

    if (!requirements || !requirements.trim()) {
      return NextResponse.json(
        { error: 'Requirements are required' },
        { status: 400 }
      );
    }

    if (!projectName || !projectName.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Create project ID first
    const projectId = `proj-${Date.now()}`;

    // Check if project folder already exists
    if (await projectDirExists(projectId)) {
      return NextResponse.json(
        { error: `Project folder "${projectId}" already exists. Please try again.` },
        { status: 400 }
      );
    }

    // Create project directory OUTSIDE of ai-dev-platform-v2
    const projectDir = await ensureProjectDir(projectId);
    console.log(`[Workflow] Project directory: ${projectDir}`);
    console.log(`📁 Created project directory: ${projectDir}`);

    // Create initial project state
    const projectConfig: ProjectConfig = config || {
      name: projectName.trim(),
      description: requirements.substring(0, 100),
      techStack: ['next.js', 'typescript', 'tailwind'],
      requirements,
      targetPlatform: 'web' as const,
      deployment: {
        provider: 'aws' as const,
        region: 'us-east-1',
        environment: 'dev' as const,
      },
    };

    const initialState: DevelopmentState = {
      projectId,
      config: projectConfig,
      requirements,
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
      projectDirectory: projectDir, // Add project directory to state
    };

    // Register project
    projects.set(projectId, {
      projectId,
      requirements,
      config: projectConfig,
      status: 'idle',
      progress: 0,
      projectDirectory: projectDir, // Store project directory path
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await saveProjects(); // Persist to disk immediately

    // Save initial project state to project directory
    await saveProjectState(projectDir, {
      projectId,
      requirements,
      config: projectConfig,
      epics: [],
      stories: [],
      messages: [],
      status: 'idle',
      progress: 0,
      errors: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create empty user-stories.json for the Product Owner script to populate
    const userStoriesPath = path.join(projectDir, 'user-stories.json');
    await fs.writeFile(userStoriesPath, JSON.stringify([], null, 2));
    console.log('📄 Created empty user-stories.json for PO script');

    // Create a session for this project
    const session = await createSession({
      projectId,
      projectDir,
      resumeIfExists: false, // New project, don't resume
    });
    console.log(`📋 Created session ${session.sessionId} for project ${projectId}`);

    // Create orchestrator
    const orchestrator = new AgentOrchestrator(initialState);

    // Register orchestrator globally for cleanup
    if ((global as any).activeOrchestrators) {
      (global as any).activeOrchestrators.set(projectId, orchestrator);
    }

    // Get global socket.io instance
    const io = (global as any).io;

    // Wire up orchestrator events to WebSocket
    if (io) {
      orchestrator.on('workflow:started', (data) => {
        console.log(`📡 Emitting workflow:started to project:${projectId}`);
        const project = projects.get(projectId);
        if (project) {
          project.status = 'planning';
          project.updatedAt = new Date().toISOString();
          saveProjects(); // Persist to disk
          updateProjectProgress(projectDir, 'planning', 5); // Save to project directory
        }
        io.to(`project:${projectId}`).emit('workflow:started', data);
      });

      orchestrator.on('agent:status', (agent) => {
        console.log(`📡 Emitting agent:status to project:${projectId}`, agent.type, agent.status);
        // Update session with current agent
        setCurrentAgent(projectId, projectDir, agent.id, agent.currentTask);
        io.to(`project:${projectId}`).emit('agent:status', agent);
      });

      orchestrator.on('agent:completed', (agent) => {
        console.log(`📡 Emitting agent:completed to project:${projectId}`, agent.type);
        io.to(`project:${projectId}`).emit('agent:completed', agent);
      });

      orchestrator.on('epics:created', async (epics) => {
        console.log(`📡 Emitting epics:created to project:${projectId}`, epics.length);
        await updateEpics(projectDir, epics); // Save to project directory
        await createBacklogIndex(projectDir); // Create backlog index
        io.to(`project:${projectId}`).emit('epics:created', epics);
      });

      orchestrator.on('stories:created', async (stories) => {
        console.log(`📡 Emitting stories:created to project:${projectId}`, stories.length);
        const project = projects.get(projectId);
        if (project) {
          project.status = 'developing';
          project.progress = 10;
          project.updatedAt = new Date().toISOString();
          saveProjects(); // Persist to disk
        }
        await updateStories(projectDir, stories); // Save to project directory
        await createBacklogIndex(projectDir); // Create backlog index
        updateProjectProgress(projectDir, 'developing', 10);
        io.to(`project:${projectId}`).emit('stories:created', stories);
      });

      orchestrator.on('story:started', (story) => {
        const project = projects.get(projectId);
        if (project) {
          project.progress = Math.min(project.progress + 10, 90);
          project.updatedAt = new Date().toISOString();
        }
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

      orchestrator.on('test:started', (data) => {
        console.log(`📡 Emitting test:started to project:${projectId}`);
        io.to(`project:${projectId}`).emit('test:started', data);
      });

      orchestrator.on('test:progress', (data) => {
        console.log(`📡 Emitting test:progress to project:${projectId}`, data);
        io.to(`project:${projectId}`).emit('test:progress', data);
      });

      orchestrator.on('test:results', (results) => {
        console.log(`📡 Emitting test:results to project:${projectId}`, {
          passed: results.passed,
          failed: results.failed,
          total: results.tests?.length,
        });
        updateTestResults(projectDir, results); // Save to project directory
        io.to(`project:${projectId}`).emit('test:results', results);
      });

      orchestrator.on('security:report', (report) => {
        updateSecurityReport(projectDir, report); // Save to project directory
        io.to(`project:${projectId}`).emit('security:report', report);
      });

      orchestrator.on('deployment:plan', (plan) => {
        io.to(`project:${projectId}`).emit('deployment:plan', plan);
      });

      orchestrator.on('workflow:completed', async (state) => {
        const project = projects.get(projectId);
        if (project) {
          project.status = 'completed';
          project.progress = 100;
          project.updatedAt = new Date().toISOString();
          saveProjects(); // Persist to disk
        }
        updateProjectProgress(projectDir, 'completed', 100); // Save to project directory
        // End session on completion
        await endSession(projectId, projectDir);
        io.to(`project:${projectId}`).emit('workflow:completed', state);
        // Cleanup orchestrator after completion
        if ((global as any).activeOrchestrators) {
          (global as any).activeOrchestrators.delete(projectId);
        }
        orchestrator.removeAllListeners();
      });

      orchestrator.on('workflow:error', (data) => {
        const project = projects.get(projectId);
        if (project) {
          project.status = 'error';
          project.updatedAt = new Date().toISOString();
          saveProjects(); // Persist to disk - IMPORTANT: Save failed projects so they can be resumed!
        }
        updateProjectProgress(projectDir, 'error', project?.progress || 0); // Save to project directory
        io.to(`project:${projectId}`).emit('workflow:error', data);
        // Cleanup orchestrator after error
        if ((global as any).activeOrchestrators) {
          (global as any).activeOrchestrators.delete(projectId);
        }
        orchestrator.removeAllListeners();
      });

      orchestrator.on('clarification:needed', (clarifications) => {
        console.log(`📡 Emitting clarification:needed to project:${projectId}`);
        io.to(`project:${projectId}`).emit('clarification:needed', clarifications);
      });

      orchestrator.on('epic:update', (update) => {
        console.log(`📡 Emitting epic:update to project:${projectId}`, update);
        io.to(`project:${projectId}`).emit('epic:update', update);
      });

      orchestrator.on('code:changed', (data) => {
        console.log(`📡 Emitting code:changed to project:${projectId}`);
        io.to(`project:${projectId}`).emit('code:changed', data);
      });

      orchestrator.on('agent:message', (message) => {
        console.log(`📡 Emitting agent:message to project:${projectId}`);
        appendMessage(projectDir, message); // Save to project directory
        addSessionMessage(projectId, projectDir, message); // Save to session
        io.to(`project:${projectId}`).emit('agent:message', message);
      });
    }

    // Emit immediate feedback message BEFORE workflow starts
    if (io) {
      const immediateMessage = {
        id: `msg-starting-${Date.now()}`,
        agentId: 'system',
        agentType: 'supervisor',
        content: '🚀 Workflow initialized! Connecting to Research Agent to begin deep analysis...',
        timestamp: new Date(),
      };
      console.log('📡 Emitting immediate startup message to project:', projectId);
      io.to(`project:${projectId}`).emit('agent:message', immediateMessage);
    }

    // Start workflow asynchronously with a small delay to allow client to connect
    console.log('🚀 Starting workflow for project:', projectId);
    setTimeout(async () => {
      try {
        // Check if server is shutting down
        if ((global as any).serverShuttingDown) {
          console.log('⚠️ Server is shutting down, aborting workflow start');
          return;
        }

        await orchestrator.start(requirements);
      } catch (error) {
        console.error('❌ Workflow error:', error);

        // Cleanup orchestrator on error
        if ((global as any).activeOrchestrators) {
          (global as any).activeOrchestrators.delete(projectId);
        }
        orchestrator.removeAllListeners();

        if (io) {
          io.to(`project:${projectId}`).emit('workflow:error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      }
    }, 300); // Small delay to allow client to connect to WebSocket room

    return NextResponse.json({
      success: true,
      projectId,
      projectDirectory: projectDir,
      projectName: projectName.trim(),
      sessionId: session.sessionId,
      message: 'Workflow started successfully',
    });
  } catch (error) {
    console.error('Error starting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
