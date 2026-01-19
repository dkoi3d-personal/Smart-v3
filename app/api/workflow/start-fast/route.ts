/**
 * Fast Workflow API - Uses Employers AI Studio for optimized secure builds
 *
 * This is the new recommended endpoint for starting projects.
 * Uses task-based architecture instead of epic/story model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { TaskOrchestrator, Task } from '@/lib/agents/task-orchestrator';
import { projects, saveProjects } from '../../projects/route';
import { promises as fs } from 'fs';
import path from 'path';
import { ensureProjectDir } from '@/lib/project-paths';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirements, projectName, options } = body;

    if (!requirements?.trim()) {
      return NextResponse.json(
        { error: 'Requirements are required' },
        { status: 400 }
      );
    }

    if (!projectName?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Create project ID and directory OUTSIDE of ai-dev-platform-v2
    const projectId = `proj-${Date.now()}`;
    const projectDir = await ensureProjectDir(projectId);
    console.log(`📁 Created project directory: ${projectDir}`);

    // Register project
    projects.set(projectId, {
      projectId,
      requirements,
      config: {
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
      },
      status: 'planning',
      progress: 0,
      projectDirectory: projectDir,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    await saveProjects();

    // Get socket.io instance
    const io = (global as any).io;

    // Create task orchestrator
    const orchestrator = new TaskOrchestrator({
      requirements,
      projectDirectory: projectDir,
      skipDeploy: options?.skipDeploy ?? true,
      maxParallelTasks: options?.maxParallelTasks ?? 3,
      onProgress: (task: Task, allTasks: Task[]) => {
        // Calculate progress
        const completed = allTasks.filter(t => t.status === 'completed').length;
        const total = allTasks.length;
        const progress = Math.round((completed / total) * 100);

        // Update project status
        const project = projects.get(projectId);
        if (project) {
          project.progress = progress;
          project.status = task.status === 'running' ? 'developing' : project.status;
          project.updatedAt = new Date().toISOString();
        }

        // Emit to WebSocket
        if (io) {
          io.to(`project:${projectId}`).emit('task:progress', {
            task,
            allTasks,
            progress,
          });
        }
      },
      onMessage: (message: string, type: 'info' | 'success' | 'warning' | 'error') => {
        console.log(`[${type.toUpperCase()}] ${message}`);

        if (io) {
          io.to(`project:${projectId}`).emit('agent:message', {
            id: `msg-${Date.now()}`,
            agentId: 'task-orchestrator',
            agentType: 'system',
            content: message,
            timestamp: new Date(),
            messageType: type,
          });
        }
      },
    });

    // Store orchestrator for cleanup
    if (!(global as any).activeOrchestrators) {
      (global as any).activeOrchestrators = new Map();
    }
    (global as any).activeOrchestrators.set(projectId, orchestrator);

    // Emit immediate startup message
    if (io) {
      io.to(`project:${projectId}`).emit('agent:message', {
        id: `msg-starting-${Date.now()}`,
        agentId: 'system',
        agentType: 'system',
        content: '🚀 Fast workflow started! Employers AI Studio is building your secure application...',
        timestamp: new Date(),
      });

      io.to(`project:${projectId}`).emit('workflow:started', {
        projectId,
        mode: 'fast',
      });
    }

    // Run orchestrator asynchronously
    (async () => {
      try {
        const result = await orchestrator.run();

        // Update final project status
        const project = projects.get(projectId);
        if (project) {
          project.status = result.success ? 'completed' : 'error';
          project.progress = result.success ? 100 : project.progress;
          project.updatedAt = new Date().toISOString();
          await saveProjects();
        }

        // Emit completion
        if (io) {
          if (result.success) {
            io.to(`project:${projectId}`).emit('workflow:completed', {
              projectId,
              tasks: result.tasks,
              totalTime: result.totalTime,
              totalTokens: result.totalTokens,
              filesCreated: result.filesCreated,
            });
          } else {
            io.to(`project:${projectId}`).emit('workflow:error', {
              projectId,
              errors: result.errors,
              tasks: result.tasks,
            });
          }
        }

        // Cleanup
        if ((global as any).activeOrchestrators) {
          (global as any).activeOrchestrators.delete(projectId);
        }

      } catch (error: any) {
        console.error('❌ Fast workflow error:', error);

        const project = projects.get(projectId);
        if (project) {
          project.status = 'error';
          project.updatedAt = new Date().toISOString();
          await saveProjects();
        }

        if (io) {
          io.to(`project:${projectId}`).emit('workflow:error', {
            projectId,
            error: error.message,
          });
        }

        // Cleanup
        if ((global as any).activeOrchestrators) {
          (global as any).activeOrchestrators.delete(projectId);
        }
      }
    })();

    return NextResponse.json({
      success: true,
      projectId,
      projectDirectory: projectDir,
      projectName: projectName.trim(),
      mode: 'fast',
      message: 'Fast workflow started using Employers AI Studio',
    });

  } catch (error: any) {
    console.error('Error starting fast workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow', details: error.message },
      { status: 500 }
    );
  }
}
