'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAgentStore } from '@/stores/agent-store';
import { useProjectStore } from '@/stores/project-store';
import { useUIStore } from '@/stores/ui-store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Settings, Pause, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';

// Placeholder components - will be implemented next
import { RequirementsPanel } from '@/components/panels/RequirementsPanel';
import { AddFeaturesPanel } from '@/components/panels/AddFeaturesPanel';
import { KanbanBoard } from '@/components/panels/KanbanBoard';
import EpicPanel from '@/components/panels/EpicPanel';
import { CodeEditor } from '@/components/panels/CodeEditor';
import { LivePreview } from '@/components/panels/LivePreview';
import { TestRunner } from '@/components/panels/TestRunner';
import { DevSecOpsDashboard } from '@/components/panels/DevSecOpsDashboard';
import { DeploymentStatus } from '@/components/panels/DeploymentStatus';
import { AgentChat } from '@/components/panels/AgentChat';
import { WorkflowStatusHeader } from '@/components/WorkflowStatusHeader';

function DashboardLoading() {
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <Dashboard />
    </Suspense>
  );
}

function Dashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const viewProjectId = searchParams.get('project');

  // Redirect to the new pages
  useEffect(() => {
    if (viewProjectId) {
      // If there's a project ID, redirect to the build page
      router.replace(`/build/${viewProjectId}`);
    } else {
      // Otherwise redirect to home to create a new project
      router.replace('/');
    }
  }, [viewProjectId, router]);

  // Show loading while redirecting
  return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );

  // Legacy code below - keeping for reference but unreachable
  const [viewingProject, setViewingProject] = useState<any>(null);
  const [loadingProject, setLoadingProject] = useState(false);
  const [currentWorkflowStep, setCurrentWorkflowStep] = useState<string>('idle');
  const [workflowProgress, setWorkflowProgress] = useState<number>(0);
  const [currentStoryIndex, setCurrentStoryIndex] = useState<number>(0);
  const [totalStories, setTotalStories] = useState<number>(0);
  const [loopIteration, setLoopIteration] = useState<number>(0);

  const { initializeAgents, agents, updateAgentStatus, updateAgentProgress, resetAllAgents } = useAgentStore();
  const { project, addStory, updateStory, addEpic, updateEpic, addCodeFile, setTestResults, setSecurityReport, addMessage, createProject, updateProjectStatus, resetProject } = useProjectStore();
  const { connected, on, off, socket } = useWebSocket({
    autoConnect: true,
    projectId: viewProjectId || project?.projectId
  });

  // Clear project when starting fresh (no project ID in URL)
  useEffect(() => {
    if (!viewProjectId) {
      console.log('🆕 Starting fresh - clearing project store and agents');
      resetProject();
      resetAllAgents();
      setViewingProject(null);
      setCurrentWorkflowStep('idle');
      setWorkflowProgress(0);
      setCurrentStoryIndex(0);
      setTotalStories(0);
      setLoopIteration(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewProjectId]);

  // Load project details if viewing a specific project
  useEffect(() => {
    if (viewProjectId) {
      setLoadingProject(true);
      // Use the specific project endpoint to get full state
      fetch(`/api/projects/${viewProjectId}`)
        .then(res => res.json())
        .then(fullState => {
          console.log('📥 Loaded full project state:', fullState);
          setViewingProject(fullState);

          // Clear any existing project data first to avoid conflicts
          if (project && project.projectId !== viewProjectId) {
            console.log('🧹 Clearing old project data before loading new project');
            // Create a fresh project - this will clear old data
          }

          // Restore project state to store
          if (!project || project.projectId !== viewProjectId) {
            createProject(
              {
                name: fullState.config?.name || fullState.projectId,
                description: fullState.requirements,
                techStack: fullState.config?.techStack || [],
                requirements: fullState.requirements,
                targetPlatform: 'web',
                deployment: fullState.deployment || {
                  provider: 'aws',
                  region: 'us-east-1',
                  environment: 'dev',
                },
              },
              viewProjectId
            );
          }

          // Restore messages
          if (fullState.orchestratorState?.messages) {
            fullState.orchestratorState.messages.forEach((msg: any) => {
              addMessage({
                id: msg.id,
                agentId: msg.agentId,
                agentType: msg.agentType,
                type: msg.type || 'info',
                content: msg.content,
                timestamp: new Date(msg.timestamp),
              });
            });
            console.log('✅ Restored', fullState.orchestratorState.messages.length, 'messages');
          }

          // Restore epics
          const epics = fullState.orchestratorState?.epics || fullState.epics || [];
          if (epics.length > 0) {
            epics.forEach((epic: any) => addEpic(epic));
            console.log('✅ Restored', epics.length, 'epics');
          }

          // Restore stories
          const stories = fullState.orchestratorState?.stories || fullState.stories || [];
          if (stories.length > 0) {
            stories.forEach((story: any) => addStory(story));
            console.log('✅ Restored', stories.length, 'stories');
          }

          // Restore code files
          if (fullState.orchestratorState?.codeFiles) {
            fullState.orchestratorState.codeFiles.forEach((file: any) => {
              addCodeFile(file); // file already has path property
            });
            console.log('✅ Restored', fullState.orchestratorState.codeFiles.length, 'code files');
          }

          // Restore test results
          if (fullState.orchestratorState?.testResults) {
            setTestResults(fullState.orchestratorState.testResults);
            console.log('✅ Restored test results');
          }

          // Restore security report
          if (fullState.orchestratorState?.securityReport) {
            setSecurityReport(fullState.orchestratorState.securityReport);
            console.log('✅ Restored security report');
          }

          // Restore agent states
          if (fullState.orchestratorState?.agents) {
            fullState.orchestratorState.agents.forEach((agent: any) => {
              updateAgentStatus(agent.type, agent.status, agent.currentTask);
              if (agent.progress !== undefined) {
                updateAgentProgress(agent.type, agent.progress);
              }
            });
            console.log('✅ Restored', fullState.orchestratorState.agents.length, 'agent states');
          }

          // Restore workflow state
          if (fullState.orchestratorState) {
            updateProjectStatus(fullState.status || 'idle');
            setCurrentWorkflowStep(fullState.orchestratorState.currentStep || 'idle');
            setWorkflowProgress(fullState.orchestratorState.progress || 0);
            console.log('✅ Restored workflow state:', fullState.orchestratorState.currentStep);
          }

          console.log('✅ Project fully restored and ready');
          console.log('📊 Final state:', {
            epics: fullState.epics?.length || fullState.orchestratorState?.epics?.length || 0,
            stories: fullState.stories?.length || fullState.orchestratorState?.stories?.length || 0,
            messages: fullState.orchestratorState?.messages?.length || 0,
            codeFiles: fullState.orchestratorState?.codeFiles?.length || 0,
          });
        })
        .catch(err => {
          console.error('❌ Failed to load project:', err);
          alert('Failed to load project. It may have been deleted or the server may have restarted.');
        })
        .finally(() => setLoadingProject(false));
    }
  }, [viewProjectId]);

  // Project room joining is now handled automatically by useWebSocket hook
  // No need to manually join here anymore

  useEffect(() => {
    // Initialize agents on mount
    initializeAgents();
  }, [initializeAgents]);

  // WebSocket event handlers
  useEffect(() => {
    if (!connected) return;

    const handleWorkflowStarted = (data: any) => {
      console.log('✅ Workflow started:', data);
      setCurrentWorkflowStep('research');
      setWorkflowProgress(3);
      updateProjectStatus('planning');
    };

    const handleAgentStatus = (agent: any) => {
      console.log('🤖 Agent status update:', agent);
      updateAgentStatus(agent.type, agent.status, agent.currentTask);

      // Update workflow step and progress based on agent activity
      // Only update if agent is actively working (not completed/idle)
      if (agent.status === 'working' || agent.status === 'thinking') {
        if (agent.type === 'research') {
          setCurrentWorkflowStep('research');
          setWorkflowProgress(5);
        } else if (agent.type === 'supervisor') {
          setCurrentWorkflowStep('planning');
          setWorkflowProgress(15);
        } else if (agent.type === 'product_owner') {
          setCurrentWorkflowStep('stories');
          setWorkflowProgress(25);
        } else if (agent.type === 'coder') {
          setCurrentWorkflowStep('developing');
          setWorkflowProgress((prev) => Math.max(prev, 35)); // Ensure forward progress
        } else if (agent.type === 'tester') {
          setCurrentWorkflowStep('testing');
          setWorkflowProgress((prev) => Math.max(prev, 65));
        } else if (agent.type === 'security') {
          setCurrentWorkflowStep('security');
          setWorkflowProgress((prev) => Math.max(prev, 80));
        } else if (agent.type === 'infrastructure') {
          setCurrentWorkflowStep('deploying');
          setWorkflowProgress((prev) => Math.max(prev, 90));
        }
      } else if (agent.status === 'completed') {
        // Agent completed - bump progress forward and potentially move to next step
        if (agent.type === 'research') {
          setWorkflowProgress(10);
          // Don't change step yet, supervisor will set it
        } else if (agent.type === 'supervisor') {
          setWorkflowProgress(20);
          // Don't change step yet, product_owner will set it
        } else if (agent.type === 'product_owner') {
          setWorkflowProgress(30);
          // Don't change step yet, coder will set it
        } else if (agent.type === 'coder') {
          setWorkflowProgress((prev) => Math.max(prev, 60));
        } else if (agent.type === 'tester') {
          setWorkflowProgress((prev) => Math.max(prev, 75));
        } else if (agent.type === 'security') {
          setWorkflowProgress((prev) => Math.max(prev, 85));
        } else if (agent.type === 'infrastructure') {
          setWorkflowProgress((prev) => Math.max(prev, 95));
        }
      }
    };

    const handleEpicsCreated = (epics: any[]) => {
      console.log('📊 Epics created:', epics);
      epics.forEach(epic => addEpic(epic));
    };

    const handleEpicUpdate = (update: any) => {
      console.log('📊 Epic updated:', update);
      updateEpic(update.id, { status: update.status });
    };

    const handleStoryCreated = (stories: any[]) => {
      console.log('📝 Stories created:', stories);
      stories.forEach(story => addStory(story));
      setTotalStories(stories.length);
      setCurrentStoryIndex(0);
    };

    const handleStoryUpdate = (story: any) => {
      console.log('📝 Story updated:', story);
      updateStory(story.id, story);

      // Track which story we're on
      if (story.status === 'in_progress') {
        setCurrentWorkflowStep('developing');
        // Find the index of this story
        const allStories = project?.stories || [];
        const storyIndex = allStories.findIndex(s => s.id === story.id);
        if (storyIndex !== -1) {
          setCurrentStoryIndex(storyIndex);
          // Reset loop iteration when starting a new story
          setLoopIteration(0);
        }
      } else if (story.status === 'testing') {
        setCurrentWorkflowStep('testing');
        // When moving from code to test, increment the loop iteration
        setLoopIteration(prev => prev + 1);
      } else if (story.status === 'done') {
        // Story completed, move to next
        const allStories = project?.stories || [];
        const storyIndex = allStories.findIndex(s => s.id === story.id);
        if (storyIndex !== -1 && storyIndex < allStories.length - 1) {
          setCurrentStoryIndex(storyIndex + 1);
          // Reset loop iteration for the next story
          setLoopIteration(0);
        }
      }
    };

    const handleWorkflowCompleted = (data: any) => {
      console.log('🎉 Workflow completed:', data);
      setCurrentWorkflowStep('completed');
      setWorkflowProgress(100);
      updateProjectStatus('completed');
    };

    const handleWorkflowError = (data: any) => {
      console.error('❌ Workflow error:', data);
      alert(`Workflow error: ${data.error || 'Unknown error'}`);
    };

    const handleCodeChanged = (data: any) => {
      console.log('📝 Code changed:', data);
      if (data.file) {
        addCodeFile(data.file);
      }
    };

    const handleTestResults = (results: any) => {
      console.log('🧪 Test results:', results);
      setTestResults(results);
    };

    const handleSecurityReport = (report: any) => {
      console.log('🔒 Security report:', report);
      setSecurityReport(report);
    };

    const handleAgentMessage = (message: any) => {
      console.log('💬 Agent message:', message);
      addMessage(message);
    };

    // Register event listeners
    on('workflow:started', handleWorkflowStarted);
    on('agent:status', handleAgentStatus);
    on('epics:created', handleEpicsCreated);
    on('epic:update', handleEpicUpdate);
    on('stories:created', handleStoryCreated);
    on('story:started', handleStoryUpdate);
    on('story:updated', handleStoryUpdate);
    on('story:completed', handleStoryUpdate);
    on('workflow:completed', handleWorkflowCompleted);
    on('workflow:error', handleWorkflowError);
    on('code:changed', handleCodeChanged);
    on('test:results', handleTestResults);
    on('security:report', handleSecurityReport);
    on('agent:message', handleAgentMessage);

    // Cleanup
    return () => {
      off('workflow:started', handleWorkflowStarted);
      off('agent:status', handleAgentStatus);
      off('epics:created', handleEpicsCreated);
      off('stories:created', handleStoryCreated);
      off('story:started', handleStoryUpdate);
      off('story:updated', handleStoryUpdate);
      off('story:completed', handleStoryUpdate);
      off('workflow:completed', handleWorkflowCompleted);
      off('workflow:error', handleWorkflowError);
      off('code:changed', handleCodeChanged);
      off('test:results', handleTestResults);
      off('security:report', handleSecurityReport);
      off('agent:message', handleAgentMessage);
    };
  }, [connected, on, off, updateAgentStatus, addStory, updateStory, addEpic, addCodeFile, setTestResults, setSecurityReport, addMessage]);

  // Listen for local custom events (immediate feedback before WebSocket)
  useEffect(() => {
    const handleLocalMessage = (event: any) => {
      if (event.detail) {
        addMessage(event.detail);
      }
    };

    window.addEventListener('agent-message-local', handleLocalMessage);
    return () => {
      window.removeEventListener('agent-message-local', handleLocalMessage);
    };
  }, [addMessage]);

  const handleStart = async () => {
    const projectId = viewProjectId || project?.projectId;
    const requirements = viewingProject?.requirements || project?.requirements;
    const currentStatus = viewingProject?.status || project?.status;

    if (!projectId || !requirements) {
      alert('No project requirements found. Please create a new project.');
      return;
    }

    try {
      // Determine if we should resume or start fresh
      const shouldResume = ['paused', 'error', 'completed'].includes(currentStatus || '');

      // Always use fast workflow with Ochsner AI Studio
      const endpoint = shouldResume
        ? `/api/workflow/${projectId}/resume`
        : '/api/workflow/start-fast';

      console.log(`${shouldResume ? '▶️ Resuming' : '🚀 Starting fast'} workflow for project ${projectId}`);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requirements,
          projectName: viewingProject?.projectId || project?.config?.name || projectId,
          options: !shouldResume ? {
            skipDeploy: true,
            maxParallelTasks: 3,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(`Failed to ${shouldResume ? 'resume' : 'start'} workflow: ${error.error || 'Unknown error'}`);
        return;
      }

      const data = await response.json();
      console.log(`Workflow ${shouldResume ? 'resumed' : 'started'}:`, data);
      updateProjectStatus('planning');
      setCurrentWorkflowStep('research');
      setWorkflowProgress(3);
    } catch (error) {
      console.error('Failed to start/resume workflow:', error);
      alert('Failed to start workflow. Check console for details.');
    }
  };

  const handlePause = async () => {
    const projectId = viewProjectId || project?.projectId;
    if (!projectId) {
      alert('No active project to pause');
      return;
    }

    try {
      const response = await fetch(`/api/workflow/${projectId}/pause`, {
        method: 'POST',
      });
      if (response.ok) {
        setCurrentWorkflowStep('idle');
        updateProjectStatus('paused');
        alert('Workflow paused successfully');
      } else {
        const error = await response.json();
        alert(`Failed to pause workflow: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to pause workflow:', error);
      alert('Failed to pause workflow');
    }
  };

  const handleStop = async () => {
    const projectId = viewProjectId || project?.projectId;
    if (!projectId) {
      alert('No active project to stop');
      return;
    }

    if (!confirm('Are you sure you want to stop this workflow? This cannot be undone.')) {
      return;
    }

    try {
      const response = await fetch(`/api/workflow/${projectId}/stop`, {
        method: 'POST',
      });
      if (response.ok) {
        setCurrentWorkflowStep('idle');
        setWorkflowProgress(0);
        updateProjectStatus('error');
        alert('Workflow stopped successfully');
      } else {
        const error = await response.json();
        alert(`Failed to stop workflow: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Failed to stop workflow:', error);
      alert('Failed to stop workflow');
    }
  };

  const isActive = (status?: string) => {
    if (!status) return false;
    return ['planning', 'developing', 'testing', 'deploying'].includes(status);
  };

  const canStart = (status?: string) => {
    if (!status) return true;
    return ['idle', 'paused', 'error', 'completed'].includes(status);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'idle': return 'bg-gray-500';
      case 'planning': return 'bg-blue-500';
      case 'developing': return 'bg-purple-500';
      case 'testing': return 'bg-yellow-500';
      case 'deploying': return 'bg-orange-500';
      case 'completed': return 'bg-green-500';
      case 'error': return 'bg-red-500';
      case 'paused': return 'bg-gray-400';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Bar */}
      <header className="border-b px-4 py-3 bg-card">
        {/* Top Row: Project Name & Controls */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            {viewProjectId && (
              <Link href="/projects">
                <Button size="sm" variant="ghost">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </Link>
            )}
            <div>
              <h1 className="text-xl font-bold">
                {viewProjectId
                  ? (loadingProject ? 'Loading...' : viewingProject?.projectId || 'Project')
                  : (project?.config?.name || 'Ochsner AI Studio')}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                {(viewingProject || project) && (
                  <Badge className={getStatusColor(viewingProject?.status || project?.status || 'idle')}>
                    {viewingProject?.status || project?.status || 'idle'}
                  </Badge>
                )}
                <div className="flex items-center gap-1.5">
                  <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="text-xs text-muted-foreground">
                    {connected ? 'Connected' : 'Disconnected'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Projects button - always show */}
            <Link href="/projects">
              <Button size="sm" variant="outline">
                Projects
              </Button>
            </Link>

            {/* Dashboard button - show when viewing a project */}
            {viewProjectId && (
              <Link href="/dashboard">
                <Button size="sm" variant="outline">
                  New Project
                </Button>
              </Link>
            )}

            {/* Show workflow controls when viewing a project */}
            {(viewingProject || project) && (
              <>
                {/* Show Start/Resume button when project can be started */}
                {canStart(viewingProject?.status || project?.status) && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleStart}
                    className="border-2 font-semibold"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {(viewingProject?.status || project?.status) === 'paused' ? 'Resume' : 'Start'} Workflow
                  </Button>
                )}

                {/* Show Pause button when workflow is active */}
                {isActive(viewingProject?.status || project?.status) && (
                  <Button size="sm" variant="outline" onClick={handlePause} className="border-2">
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </Button>
                )}

                {/* Show Stop button when project exists (always show for any project) */}
                <Button size="sm" variant="destructive" onClick={handleStop} className="border-2 font-semibold">
                  <Square className="h-4 w-4 mr-2" />
                  Stop
                </Button>
              </>
            )}

            {/* Show Settings when no project is active */}
            {!viewProjectId && !project && (
              <Button size="sm" variant="outline">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </Button>
            )}
          </div>
        </div>

        {/* Bottom Row: Workflow Progress */}
        {(viewingProject || project) && (
          <div className="pt-3 border-t border-border">
            <WorkflowStatusHeader
              currentStep={currentWorkflowStep}
              progress={workflowProgress}
              status={viewingProject?.status || project?.status || 'idle'}
              currentStoryIndex={currentStoryIndex}
              totalStories={totalStories}
              loopIteration={loopIteration}
            />
          </div>
        )}
      </header>

      {/* Main Dashboard Grid */}
      <div className="flex-1 overflow-hidden">
        {(viewingProject || project) && (viewingProject?.requirements || project?.requirements) && (
          <div className="bg-muted/30 border-b px-4 py-2">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium">Requirements</p>
                <p className="text-sm text-muted-foreground line-clamp-2">
                  {viewingProject?.requirements || project?.requirements}
                </p>
              </div>
              <div className="flex gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>{' '}
                  <span className="font-medium">
                    {new Date((viewingProject || project)!.createdAt).toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Updated:</span>{' '}
                  <span className="font-medium">
                    {new Date((viewingProject || project)!.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Tabbed Dashboard Layout */}
        <Tabs defaultValue="overview" className={`${(viewingProject || project) && (viewingProject?.requirements || project?.requirements) ? 'h-[calc(100%-4rem)]' : 'h-full'} flex flex-col p-3`}>
          <TabsList className="w-fit border-2 border-border mb-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="development">Development</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="flex-1 m-0 overflow-hidden">
            <div className="h-full grid grid-cols-4 grid-rows-2 gap-3">
          {/* Row 1 - Requirements/Features Panel (2 rows tall for easier typing) */}
          <div className="col-span-1 row-span-2 overflow-hidden min-h-0">
            <Card className="h-full flex flex-col border-2 border-border shadow-lg">
              {/* Show RequirementsPanel if no project or project is idle */}
              {/* Show AddFeaturesPanel if project is active/started */}
              {(!project && !viewProjectId) || (project?.status === 'idle' && !viewProjectId) ? (
                <RequirementsPanel />
              ) : (
                <AddFeaturesPanel />
              )}
            </Card>
          </div>

          {/* Row 1 - Kanban/Epics */}
          <div className="col-span-2 row-span-1 overflow-hidden min-h-0">
            <Card className="h-full flex flex-col border-2 border-border shadow-lg">
              <Tabs defaultValue="kanban" className="h-full flex flex-col">
                <div className="px-4 pt-3 pb-0">
                  <TabsList className="grid w-full grid-cols-2 border border-border">
                    <TabsTrigger value="kanban">Kanban Board</TabsTrigger>
                    <TabsTrigger value="epics">Epics</TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="kanban" className="flex-1 overflow-hidden m-0 min-h-0">
                  <KanbanBoard />
                </TabsContent>
                <TabsContent value="epics" className="flex-1 overflow-hidden m-0 p-4 min-h-0">
                  <EpicPanel />
                </TabsContent>
              </Tabs>
            </Card>
          </div>

          {/* Row 1 - Agent Chat (2 rows tall for better scrolling) */}
          <div className="col-span-1 row-span-2 overflow-hidden min-h-0">
            <Card className="h-full flex flex-col border-2 border-border shadow-lg">
              <AgentChat />
            </Card>
          </div>

          {/* Row 2 - Test Runner */}
          <div className="col-span-1 row-span-1 overflow-hidden min-h-0">
            <Card className="h-full flex flex-col border-2 border-border shadow-lg">
              <TestRunner />
            </Card>
          </div>

          {/* Row 2 - DevSecOps Dashboard */}
          <div className="col-span-1 row-span-1 overflow-hidden min-h-0">
            <Card className="h-full flex flex-col border-2 border-border shadow-lg">
              <DevSecOpsDashboard />
            </Card>
          </div>
            </div>
          </TabsContent>

          {/* Development Tab */}
          <TabsContent value="development" className="flex-1 m-0 overflow-hidden">
            <div className="h-full grid grid-cols-3 grid-rows-2 gap-3">
              {/* Code Editor - Full height on left */}
              <div className="col-span-2 row-span-2 overflow-hidden min-h-0">
                <Card className="h-full flex flex-col border-2 border-border shadow-lg">
                  <CodeEditor />
                </Card>
              </div>

              {/* Live Preview - Top right */}
              <div className="col-span-1 row-span-1 overflow-hidden min-h-0">
                <Card className="h-full flex flex-col border-2 border-border shadow-lg">
                  <LivePreview />
                </Card>
              </div>

              {/* Deployment Status - Bottom right */}
              <div className="col-span-1 row-span-1 overflow-hidden min-h-0">
                <Card className="h-full flex flex-col border-2 border-border shadow-lg">
                  <DeploymentStatus />
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
