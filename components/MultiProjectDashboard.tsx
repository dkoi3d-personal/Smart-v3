'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  Square,
  Eye,
  RefreshCw,
  Activity,
  Code,
  TestTube,
  Shield,
  Cloud,
  Bot,
  MessageSquare,
  Search,
  Layers,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  FileText,
} from 'lucide-react';
import Link from 'next/link';
import { useMultiProjectWebSocket } from '@/hooks/useMultiProjectWebSocket';
import { useMultiProjectStore, ProjectSummary } from '@/stores/multi-project-store';
import type { AgentType } from '@/lib/agents/types';

const AGENT_ICONS: Record<AgentType, React.ReactNode> = {
  supervisor: <Bot className="h-3 w-3" />,
  research: <Search className="h-3 w-3" />,
  product_owner: <MessageSquare className="h-3 w-3" />,
  coder: <Code className="h-3 w-3" />,
  tester: <TestTube className="h-3 w-3" />,
  security: <Shield className="h-3 w-3" />,
  infrastructure: <Cloud className="h-3 w-3" />,
  architecture: <FileText className="h-3 w-3" />,
};

const AGENT_NAMES: Record<AgentType, string> = {
  supervisor: 'Supervisor',
  research: 'Research',
  product_owner: 'Product Owner',
  coder: 'Coder',
  tester: 'Tester',
  security: 'Security',
  infrastructure: 'Infrastructure',
  architecture: 'Architecture',
};

interface MultiProjectDashboardProps {
  maxProjects?: number;
  showInactive?: boolean;
  compact?: boolean;
}

export function MultiProjectDashboard({
  maxProjects = 6,
  showInactive = false,
  compact = false,
}: MultiProjectDashboardProps) {
  const [loading, setLoading] = useState(true);

  const {
    projects,
    globalActivity,
    isLoadingProjects,
    refreshAllProjects,
    updateProject,
    updateProjectAgent,
    addProjectMessage,
  } = useMultiProjectStore();

  const {
    connected,
    subscribeToAll,
    on,
    off,
  } = useMultiProjectWebSocket({ autoConnect: true });

  // Fetch projects and subscribe to all
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await refreshAllProjects();
      await subscribeToAll();
      setLoading(false);
    };
    init();

    // Poll every 30s as fallback - WebSocket handles real-time updates
    const interval = setInterval(refreshAllProjects, 30000);
    return () => clearInterval(interval);
  }, [refreshAllProjects, subscribeToAll]);

  // WebSocket event handlers
  useEffect(() => {
    if (!connected) return;

    const handleAgentStatus = (data: any) => {
      if (data.projectId) {
        updateProjectAgent(data.projectId, data.type, data.status, data.currentTask);
      }
    };

    const handleMessage = (data: any) => {
      if (data.projectId) {
        addProjectMessage(data.projectId, data);
      }
    };

    const handleWorkflowCompleted = (data: any) => {
      if (data.projectId) {
        updateProject(data.projectId, { status: 'completed', progress: 100 });
      }
    };

    const handleWorkflowError = (data: any) => {
      if (data.projectId) {
        updateProject(data.projectId, { status: 'error' });
      }
    };

    on('agent:status', handleAgentStatus);
    on('agent:message', handleMessage);
    on('workflow:completed', handleWorkflowCompleted);
    on('workflow:error', handleWorkflowError);

    return () => {
      off('agent:status', handleAgentStatus);
      off('agent:message', handleMessage);
      off('workflow:completed', handleWorkflowCompleted);
      off('workflow:error', handleWorkflowError);
    };
  }, [connected, on, off, updateProject, updateProjectAgent, addProjectMessage]);

  const handlePause = async (projectId: string) => {
    try {
      await fetch(`/api/workflow/${projectId}/pause`, { method: 'POST' });
      updateProject(projectId, { status: 'paused' });
    } catch (error) {
      console.error('Failed to pause project:', error);
    }
  };

  const handleResume = async (projectId: string) => {
    try {
      await fetch(`/api/workflow/${projectId}/resume`, { method: 'POST' });
      refreshAllProjects();
    } catch (error) {
      console.error('Failed to resume project:', error);
    }
  };

  const handleStop = async (projectId: string) => {
    try {
      await fetch(`/api/workflow/${projectId}/stop`, { method: 'POST' });
      updateProject(projectId, { status: 'idle', activeAgent: undefined });
    } catch (error) {
      console.error('Failed to stop project:', error);
    }
  };

  const getStatusColor = (status: string) => {
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

  const isActive = (status: string) =>
    ['planning', 'developing', 'testing', 'deploying'].includes(status);

  // Filter and sort projects
  const displayProjects = Array.from(projects.values())
    .filter((p) => showInactive || isActive(p.status) || p.status === 'paused')
    .sort((a, b) => {
      // Active projects first
      const aActive = isActive(a.status);
      const bActive = isActive(b.status);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      // Then by updated time
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    })
    .slice(0, maxProjects);

  const activeCount = Array.from(projects.values()).filter((p) => isActive(p.status)).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading projects...</p>
        </CardContent>
      </Card>
    );
  }

  if (displayProjects.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Active Projects ({activeCount})
          </h3>
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <Link href="/projects">
              <Button size="sm" variant="ghost">
                View All
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {displayProjects.map((project) => (
          <CompactProjectCard
            key={project.projectId}
            project={project}
            isActive={isActive}
            getStatusColor={getStatusColor}
            onPause={() => handlePause(project.projectId)}
            onResume={() => handleResume(project.projectId)}
            onStop={() => handleStop(project.projectId)}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Running Projects
          <Badge variant="secondary">{activeCount} active</Badge>
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`h-2 w-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-xs text-muted-foreground">
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refreshAllProjects()}
            disabled={isLoadingProjects}
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingProjects ? 'animate-spin' : ''}`} />
          </Button>
          <Link href="/projects">
            <Button size="sm" variant="outline">
              View All Projects
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {displayProjects.map((project) => (
          <ProjectMiniCard
            key={project.projectId}
            project={project}
            isActive={isActive}
            getStatusColor={getStatusColor}
            onPause={() => handlePause(project.projectId)}
            onResume={() => handleResume(project.projectId)}
            onStop={() => handleStop(project.projectId)}
          />
        ))}
      </div>

      {/* Recent Activity */}
      {globalActivity.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="py-3">
            <CardTitle className="text-sm">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="py-0 pb-3">
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {globalActivity.slice(0, 5).map((activity, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs">
                  <div className="flex-shrink-0">
                    {activity.agentType && AGENT_ICONS[activity.agentType]}
                  </div>
                  <span className="font-medium truncate">
                    {projects.get(activity.projectId)?.name || activity.projectId}
                  </span>
                  <span className="text-muted-foreground truncate flex-1">{activity.content}</span>
                  <span className="text-muted-foreground whitespace-nowrap">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

interface ProjectCardProps {
  project: ProjectSummary;
  isActive: (status: string) => boolean;
  getStatusColor: (status: string) => string;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

function ProjectMiniCard({
  project,
  isActive,
  getStatusColor,
  onPause,
  onResume,
  onStop,
}: ProjectCardProps) {
  return (
    <Card className={`${isActive(project.status) ? 'border-primary/50' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <Link href={`/build/${project.projectId}`}>
              <h4 className="font-medium truncate hover:underline">{project.name}</h4>
            </Link>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={`${getStatusColor(project.status)} text-white text-xs`}>
                {project.status}
              </Badge>
              {project.activeAgent && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {AGENT_ICONS[project.activeAgent.type]}
                  <span>{AGENT_NAMES[project.activeAgent.type]}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            {isActive(project.status) && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onPause}>
                <Pause className="h-3 w-3" />
              </Button>
            )}
            {project.status === 'paused' && (
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onResume}>
                <Play className="h-3 w-3" />
              </Button>
            )}
            {(isActive(project.status) || project.status === 'paused') && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onStop}>
                <Square className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        {isActive(project.status) && (
          <div className="mb-2">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span>{project.progress}%</span>
            </div>
            <Progress value={project.progress} className="h-1" />
          </div>
        )}

        {/* Recent message */}
        {project.recentMessages.length > 0 && (
          <p className="text-xs text-muted-foreground truncate">
            {project.recentMessages[0].content}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-2 pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {new Date(project.updatedAt).toLocaleTimeString()}
          </span>
          <Link href={`/build/${project.projectId}`}>
            <Button size="sm" variant="ghost" className="h-6 text-xs">
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CompactProjectCard({
  project,
  isActive,
  getStatusColor,
  onPause,
  onResume,
  onStop,
}: ProjectCardProps) {
  return (
    <Card className={`${isActive(project.status) ? 'border-primary/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          <div className={`w-2 h-8 rounded-full ${getStatusColor(project.status)}`} />

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link href={`/build/${project.projectId}`}>
                <span className="font-medium text-sm hover:underline truncate">{project.name}</span>
              </Link>
              {project.activeAgent && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  {AGENT_ICONS[project.activeAgent.type]}
                </div>
              )}
            </div>
            {isActive(project.status) && (
              <Progress value={project.progress} className="h-1 mt-1" />
            )}
          </div>

          {/* Progress text */}
          {isActive(project.status) && (
            <span className="text-xs font-medium">{project.progress}%</span>
          )}

          {/* Status badge */}
          <Badge variant="outline" className="text-xs">
            {project.status}
          </Badge>

          {/* Actions */}
          <div className="flex gap-1">
            {isActive(project.status) && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onPause}>
                <Pause className="h-3 w-3" />
              </Button>
            )}
            {project.status === 'paused' && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onResume}>
                <Play className="h-3 w-3" />
              </Button>
            )}
            <Link href={`/build/${project.projectId}`}>
              <Button size="icon" variant="ghost" className="h-6 w-6">
                <Eye className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default MultiProjectDashboard;
