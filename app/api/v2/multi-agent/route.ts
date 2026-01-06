/**
 * Multi-Agent Stream API
 * Runs multiple agents in parallel and streams their conversations
 */

import { NextRequest } from 'next/server';
import { multiAgentService, AgentRole } from '@/services/multi-agent-service';
import * as fs from 'fs/promises';
import { getProjectDir, ensureProjectDir } from '@/lib/project-paths';
import { saveProjectState, updateTestingMetrics, updateSecurityMetrics, updateTasks } from '@/lib/project-persistence';
import { completeBuild, isExistingProject, loadBuildMetadata, saveBuildMetadata, saveAgentMessages, archiveCurrentBuild, initializeBuildHistory, type BuildMetadata } from '@/lib/build-history';
import { createLogger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

// Helper to broadcast to WebSocket for live reconnection
function broadcastToProject(projectId: string, event: string, data: any) {
  const io = (global as any).io;
  if (io) {
    io.to(`project:${projectId}`).emit(event, { ...data, projectId });
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    projectId,
    requirements,
    agents = ['product_owner', 'coder', 'tester', 'security'],
    coderConfig = {},
  } = body;

  if (!projectId || !requirements) {
    return new Response(
      JSON.stringify({ error: 'Project ID and requirements are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Setup project directory OUTSIDE of ai-dev-platform-v2
  const projectDir = await ensureProjectDir(projectId);

  // Check if this is an existing project (subsequent build)
  const existingProject = await isExistingProject(projectDir);
  let buildMetadata = await loadBuildMetadata(projectDir);

  // Load existing project name to preserve it (don't overwrite with projectId)
  let existingProjectName = projectId; // Default to projectId
  try {
    const projectJsonPath = `${projectDir}/project.json`;
    const projectJsonData = await fs.readFile(projectJsonPath, 'utf-8');
    const projectJson = JSON.parse(projectJsonData);
    existingProjectName = projectJson.name || projectJson.config?.name || projectId;
  } catch {
    // No existing project.json, try project-state.json
    try {
      const stateJsonPath = `${projectDir}/project-state.json`;
      const stateData = await fs.readFile(stateJsonPath, 'utf-8');
      const stateJson = JSON.parse(stateData);
      existingProjectName = stateJson.name || stateJson.config?.name || projectId;
    } catch {
      // No existing state, use projectId
    }
  }

  // Initialize build metadata if this is a first build or no metadata exists
  // For subsequent builds, archive the old build, cleanup artifacts, and start fresh
  if (!buildMetadata || buildMetadata.status === 'completed' || buildMetadata.status === 'failed') {
    // initializeBuildHistory handles: archive old build -> cleanup artifacts -> create fresh metadata
    buildMetadata = await initializeBuildHistory(projectDir, requirements, 'text');
  }

  const buildNumber = buildMetadata.buildNumber;

  // Create logger with correlation context
  const logger = createLogger('Multi-Agent API', {
    projectId,
    buildNumber,
  });

  logger.log(`Project directory: ${projectDir}`);
  logger.log(`Build ${buildNumber}, existing project: ${existingProject}`);

  // Create session with coder configuration and build number for logging
  // isExistingProject replaces the old skipFoundation + currentIterationId approach
  const session = multiAgentService.createSession(projectId, projectDir, {
    parallelCoders: coderConfig.parallelCoders ?? 1,
    batchMode: coderConfig.batchMode ?? false,
    batchSize: coderConfig.batchSize ?? 3,
    isExistingProject: existingProject, // Tells agents to not recreate project setup
  }, undefined, buildNumber);

  // Setup SSE stream
  const encoder = new TextEncoder();

  // Track build metrics
  const buildMetrics = {
    startTime: Date.now(),
    filesCreated: 0,
    filesModified: 0,
    commandsRun: 0,
    toolCalls: 0,
    tokensUsed: 0,
    linesOfCode: 0,
    iterations: 0,
  };

  // Track testing metrics for persistence
  const testingMetrics = {
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    passRate: 0,
    coverage: 0,
    duration: 0,
    storiesTested: 0,
    storiesPassed: 0,
    testFiles: [] as string[],
    seenTaskIds: [] as string[],
  };

  // Track security metrics for persistence
  let securityMetrics: {
    score: number;
    grade?: string;
    rating?: string;
    riskLevel?: string;
    findings?: { critical: number; high: number; medium: number; low: number; total: number };
    breakdown: { sast: number; secrets: number; dependencies: number };
    vulnerabilities: any[];
  } | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let isClosed = false;

      const sendEvent = (event: string, data: any) => {
        if (isClosed) return; // Prevent writes after close
        try {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (err) {
          // Controller may have been closed
          isClosed = true;
        }
      };

      // Send metrics update (with change detection to reduce overhead)
      let lastMetricsHash = '';
      const sendMetrics = (force = false) => {
        const currentMetrics = {
          ...buildMetrics,
          elapsedTime: Date.now() - buildMetrics.startTime,
        };
        // Simple hash: concatenate key values
        const currentHash = `${buildMetrics.filesCreated}-${buildMetrics.filesModified}-${buildMetrics.commandsRun}-${buildMetrics.toolCalls}-${buildMetrics.iterations}`;
        if (force || currentHash !== lastMetricsHash) {
          lastMetricsHash = currentHash;
          sendEvent('metrics', currentMetrics);
        }
      };

      // Send initial connection with start time
      sendEvent('connected', {
        sessionId: session.id,
        projectId,
        startTime: buildMetrics.startTime,
        agents: agents.map((a: AgentRole) => ({
          role: a,
          ...multiAgentService.getAgentConfig(a),
        })),
      });

      // Listen for events with metrics tracking
      // All events are sent via SSE AND WebSocket so returning users get live updates
      const onFileChanged = (data: any) => {
        logger.debug(`file:changed: ${data.path} (${data.action})`);
        if (data.action === 'write') {
          buildMetrics.filesCreated++;
          if (data.content) {
            buildMetrics.linesOfCode += data.content.split('\n').length;
          }
        } else if (data.action === 'edit') {
          buildMetrics.filesModified++;
        }
        sendEvent('file:changed', data);
        broadcastToProject(projectId, 'file:changed', data);
        sendMetrics();
      };
      const onCommandStart = (data: any) => {
        buildMetrics.commandsRun++;
        sendEvent('command:start', data);
        broadcastToProject(projectId, 'command:start', data);
        sendMetrics();
      };
      const onCommandComplete = (data: any) => {
        sendEvent('command:complete', data);
        broadcastToProject(projectId, 'command:complete', data);
      };
      const onTaskCreated = (data: any) => {
        logger.log(`task:created: ${data.id} "${data.title}" (${data.status})`);
        sendEvent('task:created', data);
        broadcastToProject(projectId, 'task:created', data);
      };
      const onTaskUpdated = (data: any) => {
        logger.log(`task:updated: ${data.id} "${data.title}" (${data.status})`);
        sendEvent('task:updated', data);
        broadcastToProject(projectId, 'task:update', data);
      };
      const onAgentStatus = (data: any) => {
        sendEvent('agent:status', data);
        broadcastToProject(projectId, 'agent:status', data);
      };
      const onEpicCreated = (data: any) => {
        sendEvent('epic:created', data);
        broadcastToProject(projectId, 'epic:created', data);
      };
      const onStoryCreated = (data: any) => {
        sendEvent('story:created', data);
        broadcastToProject(projectId, 'story:created', data);
      };
      const onStoryStarted = (data: any) => {
        logger.log(`story:started: ${data.storyId} "${data.storyTitle}" (${data.agentId})`);
        sendEvent('story:started', data);
        broadcastToProject(projectId, 'story:started', data);
      };
      const onStoryTesting = (data: any) => {
        logger.log(`story:testing: ${data.storyId} "${data.storyTitle}" (${data.agentId})`);
        sendEvent('story:testing', data);
        broadcastToProject(projectId, 'story:testing', data);
      };
      const onStoryCompleted = (data: any) => {
        logger.log(`story:completed: ${data.storyId} "${data.storyTitle}" (success: ${data.success})`);
        sendEvent('story:completed', data);
        broadcastToProject(projectId, 'story:completed', data);
      };
      const onStoryFailed = (data: any) => {
        logger.warn(`story:failed: ${data.storyId} "${data.storyTitle}" - ${data.error}`);
        sendEvent('story:failed', data);
        broadcastToProject(projectId, 'story:failed', data);
      };
      const onToolUse = (data: any) => {
        logger.debug(`tool:use: ${data.tool}`);
        buildMetrics.toolCalls++;
        sendEvent('tool:use', data);
        broadcastToProject(projectId, 'tool:use', data);
        sendMetrics();
      };
      const onTestResults = async (data: any) => {
        logger.log(`test:results: ${data.total_tests} total, ${data.passed_tests} passed`);
        sendEvent('test:results', data);
        broadcastToProject(projectId, 'test:results', data);

        // Accumulate testing metrics (avoid double-counting same task)
        if (data.task_id && !testingMetrics.seenTaskIds.includes(data.task_id)) {
          testingMetrics.seenTaskIds.push(data.task_id);
          testingMetrics.totalTests += data.total_tests || 0;
          testingMetrics.passed += data.passed_tests || 0;
          testingMetrics.failed += data.failed_tests || 0;
          if (data.skipped) testingMetrics.skipped++;
          testingMetrics.storiesTested++;
          if (data.passed) testingMetrics.storiesPassed++;
          if (data.coverage) testingMetrics.coverage = Math.max(testingMetrics.coverage, data.coverage);
          testingMetrics.passRate = testingMetrics.totalTests > 0
            ? (testingMetrics.passed / testingMetrics.totalTests) * 100
            : 0;

          // Persist to project state
          try {
            await updateTestingMetrics(projectDir, testingMetrics);
            logger.log(`Persisted testing metrics: ${testingMetrics.totalTests} tests`);
          } catch (err) {
            logger.error(`Failed to persist testing metrics: ${err}`);
          }
        }
      };
      const onTestFailed = (data: any) => {
        logger.warn(`test:failed: ${data.testName || 'unknown'}`);
        sendEvent('test:failed', data);
        broadcastToProject(projectId, 'test:failed', data);
      };
      const onSecurityReport = async (data: any) => {
        logger.log(`security:report received (score: ${data.score})`);
        sendEvent('security:report', data);
        broadcastToProject(projectId, 'security:report', data);

        // Extract and persist security metrics
        if (data.score !== undefined || data.findings) {
          securityMetrics = {
            score: data.score ?? 100,
            grade: data.grade,
            rating: data.rating,
            riskLevel: data.riskLevel,
            findings: data.findings,
            breakdown: data.breakdown || { sast: 0, secrets: 0, dependencies: 0 },
            vulnerabilities: data.vulnerabilities || [],
          };

          try {
            await updateSecurityMetrics(projectDir, securityMetrics);
            logger.log(`Persisted security metrics, score: ${securityMetrics.score}`);
          } catch (err) {
            logger.error(`Failed to persist security metrics: ${err}`);
          }
        }
      };
      const onSecurityAlert = (data: any) => {
        logger.warn(`security:alert: ${data.severity || 'unknown'} - ${data.message || ''}`);
        sendEvent('security:alert', data);
        broadcastToProject(projectId, 'security:alert', data);
      };
      // Foundation complete - enables early preview
      const onFoundationComplete = (data: any) => {
        logger.log('foundation:complete - early preview now available');
        sendEvent('foundation:complete', data);
        broadcastToProject(projectId, 'foundation:complete', data);
      };
      // Forward agent:message events from emitAgentMessage (complements the yield messages)
      // NOTE: agent:message events are handled by the for-await loop below which yields messages
      // We don't need a separate listener here as it would cause DUPLICATE messages
      // The emitAgentMessage() calls are for internal coordination, not for client streaming
      const onAgentMessage = (data: any) => {
        // Only log for debugging, don't send - the for-await loop handles message delivery
        logger.debug(`agent:message (internal): ${data.agentRole} ${data.type}${data.instanceNumber ? ` #${data.instanceNumber}` : ''}`);
      };

      multiAgentService.on('file:changed', onFileChanged);
      multiAgentService.on('command:start', onCommandStart);
      multiAgentService.on('command:complete', onCommandComplete);
      multiAgentService.on('tool:use', onToolUse);
      multiAgentService.on('task:created', onTaskCreated);
      multiAgentService.on('task:updated', onTaskUpdated);
      multiAgentService.on('agent:status', onAgentStatus);
      multiAgentService.on('epic:created', onEpicCreated);
      multiAgentService.on('story:created', onStoryCreated);
      multiAgentService.on('story:started', onStoryStarted);
      multiAgentService.on('story:testing', onStoryTesting);
      multiAgentService.on('story:completed', onStoryCompleted);
      multiAgentService.on('story:failed', onStoryFailed);
      multiAgentService.on('test:results', onTestResults);
      multiAgentService.on('test:failed', onTestFailed);
      multiAgentService.on('security:report', onSecurityReport);
      multiAgentService.on('security:alert', onSecurityAlert);
      multiAgentService.on('foundation:complete', onFoundationComplete);
      multiAgentService.on('agent:message', onAgentMessage);

      // Start periodic metrics updates (reduced from 1s to 2s since we send on events)
      const metricsInterval = setInterval(() => {
        sendMetrics(true); // Force send elapsed time update
      }, 2000);

      // Heartbeat mechanism - send ping every 15 seconds to detect broken connections
      const heartbeatInterval = setInterval(() => {
        sendEvent('heartbeat', { timestamp: Date.now() });
      }, 15000);

      try {
        // Run agents in parallel
        for await (const message of multiAgentService.runParallel(
          session,
          requirements,
          agents as AgentRole[]
        )) {
          // Track iterations for thinking messages
          if (message.type === 'thinking') {
            buildMetrics.iterations++;
          }
          // Track tool calls from action messages
          if (message.type === 'action' && message.toolName) {
            buildMetrics.toolCalls++;
          }

          const msgData = {
            id: message.id,
            agentRole: message.agentRole,
            agentName: message.agentName,
            type: message.type,
            content: message.content,
            toolName: message.toolName,
            toolInput: message.toolInput,
            timestamp: message.timestamp.toISOString(),
            instanceNumber: message.instanceNumber, // Include instance number for parallel agents
            storyId: message.storyId, // Include story ID for per-story log filtering
          };
          sendEvent('agent:message', msgData);
          // Also broadcast via WebSocket for returning users
          broadcastToProject(projectId, 'agent:message', msgData);

          // Send metrics with each message
          sendMetrics();
        }

        // Clear interval and send final metrics
        clearInterval(metricsInterval);
        const completeData = {
          sessionId: session.id,
          status: 'success',
          finalMetrics: {
            ...buildMetrics,
            elapsedTime: Date.now() - buildMetrics.startTime,
          }
        };
        sendEvent('complete', completeData);
        // Broadcast workflow completion via WebSocket
        broadcastToProject(projectId, 'workflow:completed', completeData);

      } catch (error) {
        const errorData = {
          message: error instanceof Error ? error.message : 'Unknown error',
        };
        sendEvent('error', errorData);
        broadcastToProject(projectId, 'workflow:error', { error: errorData.message });
      } finally {
        // Clear intervals
        clearInterval(metricsInterval);
        clearInterval(heartbeatInterval);

        // Cleanup listeners
        multiAgentService.removeListener('file:changed', onFileChanged);
        multiAgentService.removeListener('command:start', onCommandStart);
        multiAgentService.removeListener('command:complete', onCommandComplete);
        multiAgentService.removeListener('tool:use', onToolUse);
        multiAgentService.removeListener('task:created', onTaskCreated);
        multiAgentService.removeListener('task:updated', onTaskUpdated);
        multiAgentService.removeListener('agent:status', onAgentStatus);
        multiAgentService.removeListener('epic:created', onEpicCreated);
        multiAgentService.removeListener('story:created', onStoryCreated);
        multiAgentService.removeListener('story:started', onStoryStarted);
        multiAgentService.removeListener('story:testing', onStoryTesting);
        multiAgentService.removeListener('story:completed', onStoryCompleted);
        multiAgentService.removeListener('story:failed', onStoryFailed);
        multiAgentService.removeListener('test:results', onTestResults);
        multiAgentService.removeListener('test:failed', onTestFailed);
        multiAgentService.removeListener('security:report', onSecurityReport);
        multiAgentService.removeListener('security:alert', onSecurityAlert);
        multiAgentService.removeListener('foundation:complete', onFoundationComplete);
        multiAgentService.removeListener('agent:message', onAgentMessage);

        // Save project metadata (preserve existing name)
        await fs.writeFile(
          `${projectDir}/project.json`,
          JSON.stringify({
            projectId,
            name: existingProjectName,
            requirements,
            status: 'completed',
            updatedAt: new Date().toISOString(),
          }, null, 2)
        );

        // Save full project state with metrics for resume/reload
        try {
          // Get tasks and epics from session (include both camelCase and snake_case for compatibility)
          const sessionTasks = session.tasks?.map(t => ({
            id: t.id,
            title: t.title,
            description: t.description,
            status: t.status,
            epicId: t.epicId,
            epic_id: t.epicId, // snake_case for compatibility with PO agent
            files: t.files,
            result: t.result,
            acceptanceCriteria: t.acceptanceCriteria,
            acceptance_criteria: t.acceptanceCriteria, // snake_case for compatibility
            storyPoints: t.storyPoints,
            story_points: t.storyPoints, // snake_case for compatibility
            priority: t.priority,
            assignedTo: t.assignedTo,
            assigned_to: t.assignedTo, // snake_case for compatibility
          })) || [];

          // Map epics - status may need mapping between service and persistence types
          const sessionEpics = session.epics?.map(e => {
            // Map status: multi-agent uses 'pending'/'in_progress'/'done', persistence uses StoryStatus
            const statusMap: Record<string, string> = {
              'pending': 'backlog',
              'in_progress': 'in_progress',
              'done': 'done',
            };
            return {
              id: e.id,
              projectId: projectId,
              title: e.title,
              description: e.description,
              stories: e.stories || [],
              priority: e.priority,
              status: (statusMap[e.status] || e.status) as any,
              createdAt: e.createdAt instanceof Date ? e.createdAt : new Date(e.createdAt || Date.now()),
            };
          }) || [];

          await saveProjectState(projectDir, {
            projectId,
            requirements,
            buildType: 'complex', // Complex build via multi-agent
            config: {
              name: existingProjectName, // Preserve existing name
              requirements,
            },
            status: 'completed',
            progress: 100,
            errors: [],
            createdAt: new Date(buildMetrics.startTime).toISOString(),
            updatedAt: new Date().toISOString(),
            buildMetrics: {
              ...buildMetrics,
              elapsedTime: Date.now() - buildMetrics.startTime,
              duration: Date.now() - buildMetrics.startTime,
              endTime: new Date().toISOString(),
              startTime: new Date(buildMetrics.startTime).toISOString(),
            },
            // Include tasks and epics for state restoration
            tasks: sessionTasks,
            epics: sessionEpics,
            // Include testing and security metrics
            testingMetrics: testingMetrics.totalTests > 0 ? testingMetrics : undefined,
            securityMetrics: securityMetrics || undefined,
          });
          logger.log(`Saved project state with ${sessionTasks.length} tasks, ${sessionEpics.length} epics`);

          // Complete the build and save final metrics to build history
          try {
            const elapsedTime = Date.now() - buildMetrics.startTime;
            await completeBuild(projectDir, 'completed', {
              filesCreated: buildMetrics.filesCreated,
              filesModified: buildMetrics.filesModified,
              linesOfCode: buildMetrics.linesOfCode,
              testsTotal: testingMetrics.totalTests,
              testsPassed: testingMetrics.passed,
              testsFailed: testingMetrics.failed,
              coverage: testingMetrics.coverage,
              duration: elapsedTime,
              tokensUsed: buildMetrics.tokensUsed,
              commandsRun: buildMetrics.commandsRun,
              securityGrade: securityMetrics?.grade,
              securityScore: securityMetrics?.score,
            });
            logger.log('Completed build and saved to build history');
          } catch (err) {
            logger.error(`Failed to complete build: ${err}`);
          }
        } catch (err) {
          logger.error(`Failed to save project state: ${err}`);
        }

        isClosed = true;
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
