'use client';

/**
 * FleetDashboard
 *
 * Real-time monitoring dashboard for AI Fleet Orchestration.
 * Shows progress, metrics, domain status, and agent activity.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Play,
  Pause,
  StopCircle,
  RefreshCw,
  GitBranch,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Zap,
  Layers,
  Activity,
  Bot,
  Code2,
  TestTube,
  Shield,
  MessageSquare,
  Terminal,
  Wrench,
  Eye,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePreviewServer } from '@/features/build/hooks/usePreviewServer';

// ============================================================================
// Types
// ============================================================================

interface FleetProgress {
  phase: string;
  completed: number;
  total: number;
  percent: number;
}

interface FleetMetrics {
  activeAgents: number;
  throughput: number;
  completedStories: number;
  failedStories: number;
  totalTokensUsed: number;
  conflictsResolved: number;
  conflictsEscalated: number;
  averageStoryDurationMs: number;
}

interface DomainCluster {
  id: string;
  name: string;
  status: 'pending' | 'active' | 'completed' | 'blocked' | 'error';
  progress: number;
  activeAgents: number;
  stories: { completed: number; total: number };
}

interface AgentActivity {
  agentId: string;
  storyId: string;
  storyTitle: string;
  domain: string;
  status: 'working' | 'merging' | 'idle';
  duration: number;
}

interface AgentMessage {
  id: string;
  agentId: string;
  agentType: 'coordinator' | 'coder' | 'tester' | 'merger' | 'domain_captain';
  agentRole?: string;
  domain?: string;
  squadId?: string;
  storyId?: string;
  type: 'thinking' | 'action' | 'result' | 'chat' | 'error';
  content: string;
  toolName?: string;
  timestamp: string;
}

interface SquadMember {
  id: string;
  role: 'coder' | 'tester' | 'data';
  roleIndex: number;
  status: 'idle' | 'working' | 'completed';
  currentStoryId?: string;
}

interface Squad {
  id: string;
  name: string;
  status: 'idle' | 'active' | 'completed';
  specialization?: string;
  members: SquadMember[];
  metrics: {
    storiesCompleted: number;
    testsWritten: number;
    testsPassing: number;
  };
  inProgressStories: string[];
}

interface FleetDashboardProps {
  projectId: string;
  onStart?: () => void;
  onPause?: () => void;
  onStop?: () => void;
}

// Agent type icons and colors
const AGENT_ICONS: { [key: string]: any } = {
  coordinator: Bot,
  coder: Code2,
  tester: TestTube,
  merger: GitBranch,
  domain_captain: Users
};

const AGENT_COLORS: { [key: string]: string } = {
  coordinator: 'text-purple-400',
  coder: 'text-blue-400',
  tester: 'text-green-400',
  merger: 'text-orange-400',
  domain_captain: 'text-yellow-400'
};

// ============================================================================
// Component
// ============================================================================

export function FleetDashboard({ projectId, onStart, onPause, onStop }: FleetDashboardProps) {
  const [progress, setProgress] = useState<FleetProgress>({
    phase: 'idle',
    completed: 0,
    total: 0,
    percent: 0
  });
  const [metrics, setMetrics] = useState<FleetMetrics | null>(null);
  const [domains, setDomains] = useState<DomainCluster[]>([]);
  const [agents, setAgents] = useState<AgentActivity[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [selectedSquadId, setSelectedSquadId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'overview' | 'agents' | 'chat' | 'squads' | 'preview'>('overview');
  const [failedStories, setFailedStories] = useState<Array<{ storyId: string; title: string; error: string }>>([]);
  const [isRetrying, setIsRetrying] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);

  // Preview server state
  const {
    previewUrl,
    previewKey,
    previewStatus,
    previewError,
    startDevServer,
    stopDevServer,
    refreshPreview,
  } = usePreviewServer({
    projectId,
    onLog: (message, type) => {
      console.log(`[Preview ${type}] ${message}`);
    }
  });

  // Auto-scroll messages
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [agentMessages]);

  // Connect to SSE stream for fleet events
  useEffect(() => {
    let eventSource: EventSource | null = null;

    const connect = () => {
      // Connect to main fleet stream
      eventSource = new EventSource(`/api/fleet/stream?projectId=${projectId}`);

      eventSource.onopen = () => {
        setIsConnected(true);
        setError(null);
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setError('Connection lost. Reconnecting...');
      };

      eventSource.addEventListener('progress', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setProgress(data);
      });

      eventSource.addEventListener('metrics', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setMetrics(data);
      });

      eventSource.addEventListener('domains', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setDomains(data);
      });

      eventSource.addEventListener('agents', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setAgents(data);
      });

      eventSource.addEventListener('complete', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setProgress(prev => ({ ...prev, phase: data.phase }));
        if (data.error) setError(data.error);
      });

      eventSource.addEventListener('error', (event) => {
        const msgEvent = event as MessageEvent;
        if (msgEvent.data) {
          const data = JSON.parse(msgEvent.data);
          setError(data.message);
        }
      });

      // Agent message stream
      eventSource.addEventListener('agent:message', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setAgentMessages(prev => {
          // Prevent duplicates
          if (prev.some(m => m.id === data.id)) return prev;
          // Keep last 200 messages
          const updated = [...prev, data];
          if (updated.length > 200) updated.shift();
          return updated;
        });
      });

      // Story status updates
      eventSource.addEventListener('story:started', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setAgentMessages(prev => [...prev, {
          id: `story-start-${data.storyId}-${Date.now()}`,
          agentId: data.agentId || 'system',
          agentType: 'coordinator',
          storyId: data.storyId,
          type: 'chat',
          content: `Started: ${data.storyTitle || data.storyId}`,
          timestamp: new Date().toISOString()
        }]);
      });

      eventSource.addEventListener('story:completed', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setAgentMessages(prev => [...prev, {
          id: `story-done-${data.storyId}-${Date.now()}`,
          agentId: data.agentId || 'system',
          agentType: 'coordinator',
          storyId: data.storyId,
          type: 'result',
          content: `✓ Completed: ${data.storyTitle || data.storyId}`,
          timestamp: new Date().toISOString()
        }]);
      });

      // Failed stories summary
      eventSource.addEventListener('stories:failed:summary', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setFailedStories(data);
      });

      // Squads updates
      eventSource.addEventListener('squads', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        setSquads(data);
      });

      // Squad activity events
      eventSource.addEventListener('squad:activity', (event) => {
        const data = JSON.parse((event as MessageEvent).data);
        // Add squad activity as a message for the squad's chat
        setAgentMessages(prev => {
          const newMsg: AgentMessage = {
            id: `squad-activity-${data.squadId}-${Date.now()}`,
            agentId: data.agentId,
            agentType: data.agentRole || 'coder',
            agentRole: data.agentRole,
            squadId: data.squadId,
            storyId: data.storyId,
            type: data.action === 'completed' ? 'result' : data.action === 'failed' ? 'error' : 'action',
            content: `[${data.squadName || data.squadId}] ${data.agentRole} ${data.action}`,
            timestamp: new Date().toISOString()
          };
          // Prevent duplicates
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const updated = [...prev, newMsg];
          if (updated.length > 200) updated.shift();
          return updated;
        });
      });
    };

    connect();

    return () => {
      eventSource?.close();
    };
  }, [projectId]);

  // Fetch initial data - don't show error if fleet not found (might be starting)
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/fleet?projectId=${projectId}`);
        const data = await res.json();
        if (data.success) {
          setProgress(data.progress);
          setMetrics(data.metrics);
          setIsConnected(true);
        } else if (res.status === 404) {
          // Fleet not found - might be starting or server restarted
          setProgress(prev => ({ ...prev, phase: 'starting' }));
        }
      } catch (err) {
        console.error('Failed to fetch fleet status:', err);
      }
    };

    fetchStatus();
    // Poll every 3 seconds while not connected
    const pollInterval = setInterval(() => {
      if (!isConnected) fetchStatus();
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [projectId, isConnected]);

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'starting': return 'bg-yellow-500';
      case 'foundation': return 'bg-blue-500';
      case 'core': return 'bg-purple-500';
      case 'feature': return 'bg-green-500';
      case 'integration': return 'bg-orange-500';
      case 'polish': return 'bg-pink-500';
      case 'completed': return 'bg-emerald-500';
      case 'error': return 'bg-red-500';
      case 'idle': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'working': return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'merging': return <GitBranch className="h-4 w-4 text-purple-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertTriangle className="h-4 w-4 text-red-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDuration = (ms: number | undefined | null) => {
    const safeMs = Number(ms) || 0;
    const seconds = Math.floor(safeMs / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // Retry failed stories
  const handleRetryFailed = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch('/api/fleet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'control',
          projectId,
          action: 'retry-failed'
        })
      });
      const data = await res.json();
      if (data.success) {
        setFailedStories([]); // Clear failed stories list
        setAgentMessages(prev => [...prev, {
          id: `retry-${Date.now()}`,
          agentId: 'system',
          agentType: 'coordinator',
          type: 'action',
          content: `🔄 Retrying ${data.queued} failed stories...`,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error('Failed to retry stories:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Fleet Orchestrator</h2>
          <p className="text-muted-foreground">Project: {projectId}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </Badge>
          <Button variant="outline" size="icon" onClick={onStart} disabled={progress.phase !== 'idle'}>
            <Play className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onPause} disabled={progress.phase === 'idle' || progress.phase === 'paused'}>
            <Pause className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={onStop}>
            <StopCircle className="h-4 w-4" />
          </Button>
          {failedStories.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="ml-2 text-orange-500 border-orange-500 hover:bg-orange-500/10"
            >
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry Failed ({failedStories.length})
            </Button>
          )}
        </div>
      </div>

      {/* Failed Stories Banner */}
      {failedStories.length > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <span className="text-orange-500 font-medium">{failedStories.length} stories failed</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleRetryFailed}
              disabled={isRetrying}
              className="text-orange-500 border-orange-500 hover:bg-orange-500/10"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry All
                </>
              )}
            </Button>
          </div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {failedStories.map(story => (
              <div key={story.storyId} className="text-sm text-muted-foreground flex gap-2">
                <span className="font-mono text-xs opacity-60">{story.storyId}</span>
                <span>{story.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Starting/Connecting Banner */}
      {progress.phase === 'starting' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
          <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />
          <span className="text-yellow-500">Initializing fleet... This may take a moment for large projects.</span>
        </div>
      )}

      {/* Error Banner */}
      {error && progress.phase !== 'starting' && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          <span className="text-red-500">{error}</span>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={activeView === 'overview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveView('overview')}
        >
          <Activity className="h-4 w-4 mr-2" />
          Overview
        </Button>
        <Button
          variant={activeView === 'agents' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveView('agents')}
        >
          <Users className="h-4 w-4 mr-2" />
          Agents ({agents.length})
        </Button>
        <Button
          variant={activeView === 'squads' ? 'default' : 'outline'}
          size="sm"
          onClick={() => { setActiveView('squads'); setSelectedSquadId(null); }}
        >
          <Shield className="h-4 w-4 mr-2" />
          Squads ({squads.length})
        </Button>
        <Button
          variant={activeView === 'chat' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveView('chat')}
        >
          <Terminal className="h-4 w-4 mr-2" />
          Live Feed ({agentMessages.length})
        </Button>
        <Button
          variant={activeView === 'preview' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveView('preview')}
        >
          <Eye className="h-4 w-4 mr-2" />
          Preview
          {previewStatus === 'ready' && (
            <span className="ml-1 h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          )}
        </Button>
      </div>

      {/* Main Progress */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Overall Progress</CardTitle>
            <Badge className={getPhaseColor(progress.phase ?? 'idle')}>
              {(progress.phase ?? 'idle').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Progress value={progress.percent ?? 0} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{progress.completed ?? 0} of {progress.total ?? 0} stories</span>
              <span>{(Number(progress.percent) || 0).toFixed(1)}%</span>
            </div>

            {/* Phase Timeline */}
            <div className="flex items-center gap-1 mt-4">
              {['foundation', 'core', 'feature', 'integration', 'polish'].map((phase, idx) => {
                const currentPhase = progress.phase ?? 'idle';
                const isActive = currentPhase === phase;
                const isPast = ['idle', 'foundation', 'core', 'feature', 'integration', 'polish', 'completed']
                  .indexOf(currentPhase) > idx;
                return (
                  <React.Fragment key={phase}>
                    <div
                      className={`h-2 flex-1 rounded-full ${
                        isPast ? 'bg-green-500' :
                        isActive ? 'bg-blue-500 animate-pulse' :
                        'bg-gray-200 dark:bg-gray-700'
                      }`}
                    />
                    {idx < 4 && <div className="w-1" />}
                  </React.Fragment>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Foundation</span>
              <span>Core</span>
              <span>Feature</span>
              <span>Integration</span>
              <span>Polish</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/10 rounded-lg">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.activeAgents ?? 0}</p>
                <p className="text-xs text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/10 rounded-lg">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(Number(metrics?.throughput) || 0).toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Stories/Hour</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 rounded-lg">
                <GitBranch className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.conflictsResolved ?? 0}</p>
                <p className="text-xs text-muted-foreground">Conflicts Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-500/10 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{metrics?.failedStories ?? 0}</p>
                <p className="text-xs text-muted-foreground">Failed Stories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Domain Clusters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Domain Clusters
          </CardTitle>
          <CardDescription>Progress by functional domain</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {domains.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No domains yet. Start the fleet to see domain progress.
              </div>
            ) : (
              domains.map(domain => (
                <div key={domain.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{domain.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {domain.activeAgents} agents
                      </Badge>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {domain.stories.completed}/{domain.stories.total}
                    </span>
                  </div>
                  <Progress value={domain.progress} className="h-2" />
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Agents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Agent Activity
          </CardTitle>
          <CardDescription>Currently working agents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {agents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active agents. Fleet is idle or paused.
              </div>
            ) : (
              agents.map(agent => (
                <div
                  key={agent.agentId}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(agent.status)}
                    <div>
                      <p className="font-medium text-sm">{agent.storyTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {agent.domain} • {agent.agentId}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {formatDuration(agent.duration)}
                  </span>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Performance Stats */}
      {metrics && activeView === 'overview' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Performance Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Avg Story Duration</p>
                <p className="text-xl font-semibold">
                  {formatDuration(metrics.averageStoryDurationMs)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tokens Used</p>
                <p className="text-xl font-semibold">
                  {((Number(metrics.totalTokensUsed) || 0) / 1000000).toFixed(2)}M
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Success Rate</p>
                <p className="text-xl font-semibold">
                  {(Number(metrics.completedStories) || 0) > 0
                    ? (((Number(metrics.completedStories) || 0) / ((Number(metrics.completedStories) || 0) + (Number(metrics.failedStories) || 0))) * 100).toFixed(1)
                    : 0}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conflicts Escalated</p>
                <p className="text-xl font-semibold">{Number(metrics.conflictsEscalated) || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Live Feed / Chat View */}
      {activeView === 'chat' && (
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Agent Live Feed
            </CardTitle>
            <CardDescription>
              Real-time messages from all agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-2 font-mono text-sm">
                {agentMessages.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Terminal className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Waiting for agent activity...</p>
                  </div>
                ) : (
                  agentMessages.map((msg) => {
                    const AgentIcon = AGENT_ICONS[msg.agentType] || Bot;
                    const colorClass = AGENT_COLORS[msg.agentType] || 'text-gray-400';

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2 p-2 rounded ${
                          msg.type === 'error' ? 'bg-red-500/10' :
                          msg.type === 'result' ? 'bg-green-500/10' :
                          msg.type === 'action' ? 'bg-blue-500/10' :
                          'bg-muted/30'
                        }`}
                      >
                        <AgentIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`font-semibold text-xs uppercase ${colorClass}`}>
                              {msg.agentType.replace('_', ' ')}
                            </span>
                            {msg.domain && (
                              <Badge variant="outline" className="text-xs">
                                {msg.domain}
                              </Badge>
                            )}
                            {msg.toolName && (
                              <span className="text-xs text-yellow-500">
                                [{msg.toolName}]
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto">
                              {new Date(msg.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className={`text-sm whitespace-pre-wrap break-words ${
                            msg.type === 'error' ? 'text-red-400' :
                            msg.type === 'result' ? 'text-green-400' :
                            msg.type === 'thinking' ? 'text-muted-foreground italic' :
                            'text-foreground'
                          }`}>
                            {msg.content}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Detailed Agent View */}
      {activeView === 'agents' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Active Agents Detail
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.length === 0 ? (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  No active agents
                </div>
              ) : (
                agents.map(agent => (
                  <Card key={agent.agentId} className="bg-muted/30">
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={agent.status === 'working' ? 'default' : 'secondary'}>
                          {agent.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDuration(agent.duration)}
                        </span>
                      </div>
                      <p className="font-medium text-sm truncate">{agent.storyTitle}</p>
                      <p className="text-xs text-muted-foreground">{agent.domain}</p>
                      <p className="text-xs text-muted-foreground font-mono mt-1">
                        {agent.agentId}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Squads View */}
      {activeView === 'squads' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Squad List */}
          <Card className={selectedSquadId ? 'lg:col-span-1' : 'lg:col-span-3'}>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Active Squads
              </CardTitle>
              <CardDescription>
                Click a squad to view its agent chat history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`grid gap-3 ${selectedSquadId ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}>
                {squads.length === 0 ? (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>No squads active. Start the fleet to see squads.</p>
                  </div>
                ) : (
                  squads.map(squad => {
                    const squadMessages = agentMessages.filter(m => m.squadId === squad.id);
                    const isSelected = selectedSquadId === squad.id;
                    const activeMembers = squad.members.filter(m => m.status === 'working').length;

                    return (
                      <div
                        key={squad.id}
                        onClick={() => setSelectedSquadId(isSelected ? null : squad.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all hover:border-primary ${
                          isSelected ? 'border-primary bg-primary/5' : 'border-border bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{squad.name}</span>
                            <Badge variant={squad.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                              {squad.status}
                            </Badge>
                          </div>
                          {squadMessages.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              <MessageSquare className="h-3 w-3 mr-1" />
                              {squadMessages.length}
                            </Badge>
                          )}
                        </div>

                        {squad.specialization && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {squad.specialization}
                          </p>
                        )}

                        {/* Member status */}
                        <div className="flex gap-1 mb-2">
                          {squad.members.map(member => (
                            <div
                              key={member.id}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                                member.status === 'working' ? 'bg-blue-500/20 text-blue-400' :
                                member.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}
                            >
                              {member.role === 'coder' && <Code2 className="h-3 w-3" />}
                              {member.role === 'tester' && <TestTube className="h-3 w-3" />}
                              {member.role === 'data' && <Layers className="h-3 w-3" />}
                              <span>{member.role}</span>
                              {member.status === 'working' && (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              )}
                            </div>
                          ))}
                        </div>

                        {/* Metrics */}
                        <div className="flex gap-3 text-xs text-muted-foreground">
                          <span>{squad.metrics.storiesCompleted} stories</span>
                          <span>{squad.metrics.testsWritten} tests</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Squad Chat Panel */}
          {selectedSquadId && (
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    {squads.find(s => s.id === selectedSquadId)?.name || 'Squad'} Chat
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedSquadId(null)}
                  >
                    ← Back to all squads
                  </Button>
                </div>
                <CardDescription>
                  Real-time messages from squad agents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px] pr-4">
                  <div className="space-y-2 font-mono text-sm">
                    {(() => {
                      const squadMessages = agentMessages.filter(m => m.squadId === selectedSquadId);
                      if (squadMessages.length === 0) {
                        return (
                          <div className="text-center py-8 text-muted-foreground">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No messages from this squad yet...</p>
                          </div>
                        );
                      }
                      return squadMessages.map((msg) => {
                        const AgentIcon = AGENT_ICONS[msg.agentType] || AGENT_ICONS[msg.agentRole || ''] || Bot;
                        const colorClass = AGENT_COLORS[msg.agentType] || AGENT_COLORS[msg.agentRole || ''] || 'text-gray-400';

                        return (
                          <div
                            key={msg.id}
                            className={`flex items-start gap-2 p-2 rounded ${
                              msg.type === 'error' ? 'bg-red-500/10' :
                              msg.type === 'result' ? 'bg-green-500/10' :
                              msg.type === 'action' ? 'bg-blue-500/10' :
                              'bg-muted/30'
                            }`}
                          >
                            <AgentIcon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colorClass}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold text-xs uppercase ${colorClass}`}>
                                  {(msg.agentRole || msg.agentType).replace('_', ' ')}
                                </span>
                                {msg.toolName && (
                                  <span className="text-xs text-yellow-500">
                                    [{msg.toolName}]
                                  </span>
                                )}
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {new Date(msg.timestamp).toLocaleTimeString()}
                                </span>
                              </div>
                              <p className={`text-sm whitespace-pre-wrap break-words ${
                                msg.type === 'error' ? 'text-red-400' :
                                msg.type === 'result' ? 'text-green-400' :
                                msg.type === 'thinking' ? 'text-muted-foreground italic' :
                                'text-foreground'
                              }`}>
                                {msg.content}
                              </p>
                            </div>
                          </div>
                        );
                      });
                    })()}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Preview View */}
      {activeView === 'preview' && (
        <Card className="flex-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Eye className="h-5 w-5" />
                Live Preview
              </CardTitle>
              <div className="flex items-center gap-2">
                {previewStatus === 'idle' && (
                  <Button size="sm" onClick={startDevServer}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Preview
                  </Button>
                )}
                {previewStatus === 'starting' && (
                  <Badge variant="secondary" className="animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Starting...
                  </Badge>
                )}
                {previewStatus === 'ready' && (
                  <>
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Live
                    </Badge>
                    <Button size="sm" variant="outline" onClick={refreshPreview}>
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => window.open(previewUrl!, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={stopDevServer}>
                      <StopCircle className="h-4 w-4" />
                    </Button>
                  </>
                )}
                {previewStatus === 'error' && (
                  <>
                    <Badge variant="destructive">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Error
                    </Badge>
                    <Button size="sm" onClick={startDevServer}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </>
                )}
              </div>
            </div>
            <CardDescription>
              {previewUrl ? (
                <span className="font-mono text-xs">{previewUrl}</span>
              ) : previewError ? (
                <span className="text-red-400 text-xs">{previewError}</span>
              ) : (
                'Start the preview to see your project running'
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {previewStatus === 'ready' && previewUrl ? (
              <div className="relative w-full" style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
                <iframe
                  key={previewKey}
                  src={previewUrl}
                  className="w-full h-full border-0 rounded-b-lg"
                  title="Project Preview"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
                />
              </div>
            ) : previewStatus === 'starting' ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Loader2 className="h-12 w-12 animate-spin mb-4" />
                <p>Starting dev server...</p>
                <p className="text-sm mt-2">This may take a minute for the first build</p>
              </div>
            ) : previewStatus === 'error' ? (
              <div className="flex flex-col items-center justify-center py-20 text-red-400">
                <AlertTriangle className="h-12 w-12 mb-4" />
                <p className="font-medium">Preview failed to start</p>
                <p className="text-sm mt-2 text-muted-foreground max-w-md text-center">
                  {previewError || 'Unknown error occurred'}
                </p>
                <Button className="mt-4" onClick={startDevServer}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <Eye className="h-12 w-12 mb-4 opacity-50" />
                <p>Preview not running</p>
                <p className="text-sm mt-2">Click "Start Preview" to see your project</p>
                <Button className="mt-4" onClick={startDevServer}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Preview
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FleetDashboard;
