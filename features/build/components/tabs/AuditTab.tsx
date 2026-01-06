'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Shield,
  FileCode,
  Terminal,
  Loader2,
  Calendar,
  Users,
  Activity,
  Layers,
  FolderOpen,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AuditTabProps {
  projectId: string;
}

interface BuildSummary {
  buildId: string;
  timestamp: string;
  status: string;
  storiesCompleted: number;
  storiesFailed: number;
}

interface ProjectManifest {
  projectId: string;
  projectName?: string;
  createdAt: string;
  lastUpdatedAt: string;
  totalBuilds: number;
  builds: BuildSummary[];
  complianceInfo: {
    iso42001: boolean;
    euAiAct: boolean;
    soc2: boolean;
  };
}

interface StoryAuditSummary {
  storyId: string;
  title: string;
  status: string;
  epicId?: string;
  agentCount: number;
  filesCreated: number;
  filesModified: number;
  totalActions: number;
}

interface BuildDetails {
  buildId: string;
  projectId: string;
  summary: {
    buildId: string;
    projectId: string;
    startedAt: string;
    completedAt?: string;
    status: string;
    requirements: string;
    configuration: {
      parallelCoders: number;
      batchMode: boolean;
      agentModel: string;
    };
    metrics: {
      totalStories: number;
      storiesCompleted: number;
      storiesFailed: number;
      totalFilesCreated: number;
      totalFilesModified: number;
      totalTestsPassed: number;
      totalTestsFailed: number;
      totalAgentActions: number;
      buildDurationMs?: number;
    };
    modelInfo: {
      provider: string;
      model: string;
    };
    humanOversight: {
      interventions: any[];
      approvalGates: any[];
    };
  };
  stories: StoryAuditSummary[];
  buildReport?: string;
}

interface AgentAction {
  timestamp: string;
  type: string;
  target?: string;
  toolName?: string;
  content?: string;
  outcome?: string;
}

interface AgentAuditRecord {
  role: string;
  instanceId: string;
  model: string;
  startedAt: string;
  completedAt?: string;
  actions: AgentAction[];
  totalActions: number;
}

interface StoryDetails {
  storyId: string;
  buildId: string;
  projectId: string;
  auditLog: {
    storyId: string;
    title: string;
    description: string;
    lifecycle: {
      created: string;
      started?: string;
      completed?: string;
      status: string;
    };
    agents: AgentAuditRecord[];
    filesCreated: string[];
    filesModified: string[];
    testResults?: {
      passed: number;
      failed: number;
    };
    outcome: string;
  };
  filesTouched: {
    created: string[];
    modified: string[];
    deleted: string[];
  };
  summary?: string;
}

interface EpicGroup {
  epicId: string;
  stories: StoryAuditSummary[];
  completedCount: number;
  failedCount: number;
}

export function AuditTab({ projectId }: AuditTabProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<ProjectManifest | null>(null);
  const [selectedBuild, setSelectedBuild] = useState<string | null>(null);
  const [buildDetails, setBuildDetails] = useState<BuildDetails | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [expandedStories, setExpandedStories] = useState<Set<string>>(new Set());
  const [storyDetailsCache, setStoryDetailsCache] = useState<Map<string, StoryDetails>>(new Map());
  const [loadingStories, setLoadingStories] = useState<Set<string>>(new Set());
  const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());

  // Group stories by epic
  const epicGroups = useMemo(() => {
    if (!buildDetails?.stories) return [];

    const groups = new Map<string, EpicGroup>();

    for (const story of buildDetails.stories) {
      const epicId = story.epicId || 'Ungrouped Stories';

      if (!groups.has(epicId)) {
        groups.set(epicId, {
          epicId,
          stories: [],
          completedCount: 0,
          failedCount: 0,
        });
      }

      const group = groups.get(epicId)!;
      group.stories.push(story);

      if (story.status === 'success' || story.status === 'completed' || story.status === 'done') {
        group.completedCount++;
      } else if (story.status === 'failed' || story.status === 'failure') {
        group.failedCount++;
      }
    }

    return Array.from(groups.values()).sort((a, b) => {
      if (a.epicId === 'Ungrouped Stories') return 1;
      if (b.epicId === 'Ungrouped Stories') return -1;
      return a.epicId.localeCompare(b.epicId);
    });
  }, [buildDetails?.stories]);

  // Load project audit manifest
  useEffect(() => {
    async function loadManifest() {
      try {
        setLoading(true);
        const res = await fetch(`/api/audit/${projectId}`);
        const data = await res.json();

        if (!data.hasAuditData) {
          setManifest(null);
        } else {
          setManifest(data.manifest);
          if (data.manifest?.builds?.length > 0) {
            const latestBuild = data.manifest.builds[data.manifest.builds.length - 1];
            setSelectedBuild(latestBuild.buildId);
          }
        }
      } catch (err) {
        console.error('[AuditTab] Error loading manifest:', err);
        setError('Failed to load audit data');
      } finally {
        setLoading(false);
      }
    }
    loadManifest();
  }, [projectId]);

  // Load build details when selected
  useEffect(() => {
    if (!selectedBuild) return;

    async function loadBuildDetails() {
      try {
        const res = await fetch(`/api/audit/${projectId}/builds/${selectedBuild}`);
        const data = await res.json();
        setBuildDetails(data);
        setExpandedStories(new Set());
        setStoryDetailsCache(new Map());
        setExpandedEpics(new Set()); // Start collapsed
      } catch (err) {
        console.error('[AuditTab] Failed to load build details:', err);
      }
    }
    loadBuildDetails();
  }, [projectId, selectedBuild]);

  // Track failed story loads
  const [failedStories, setFailedStories] = useState<Map<string, string>>(new Map());

  // Load story details when expanded
  const loadStoryDetails = async (storyId: string) => {
    if (storyDetailsCache.has(storyId)) return;
    if (loadingStories.has(storyId)) return;

    setLoadingStories(prev => new Set(prev).add(storyId));
    // Clear any previous error
    setFailedStories(prev => {
      const next = new Map(prev);
      next.delete(storyId);
      return next;
    });

    try {
      const url = `/api/audit/${encodeURIComponent(projectId)}/builds/${encodeURIComponent(selectedBuild!)}/stories/${encodeURIComponent(storyId)}`;
      const res = await fetch(url);

      if (!res.ok) {
        const errMsg = `API error: ${res.status}`;
        setFailedStories(prev => new Map(prev).set(storyId, errMsg));
        return;
      }

      const data = await res.json();

      if (data.error) {
        setFailedStories(prev => new Map(prev).set(storyId, data.error));
        return;
      }

      setStoryDetailsCache(prev => {
        const next = new Map(prev);
        next.set(storyId, data);
        return next;
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      setFailedStories(prev => new Map(prev).set(storyId, errMsg));
    } finally {
      setLoadingStories(prev => {
        const next = new Set(prev);
        next.delete(storyId);
        return next;
      });
    }
  };

  const toggleEpic = (epicId: string) => {
    setExpandedEpics(prev => {
      const next = new Set(prev);
      if (next.has(epicId)) {
        next.delete(epicId);
      } else {
        next.add(epicId);
      }
      return next;
    });
  };

  const toggleStory = async (storyId: string) => {
    const isExpanding = !expandedStories.has(storyId);

    setExpandedStories(prev => {
      const next = new Set(prev);
      if (next.has(storyId)) {
        next.delete(storyId);
      } else {
        next.add(storyId);
      }
      return next;
    });

    if (isExpanding) {
      await loadStoryDetails(storyId);
    }
  };

  const toggleAgent = (agentId: string) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return 'N/A';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
      case 'completed':
      case 'done':
        return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed':
      case 'failure':
        return <XCircle className="h-4 w-4 text-red-400" />;
      case 'running':
      case 'in_progress':
        return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-400" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'file_create':
      case 'file_modify':
        return <FileCode className="h-3.5 w-3.5" />;
      case 'tool_use':
        return <Terminal className="h-3.5 w-3.5" />;
      case 'thinking':
        return <Activity className="h-3.5 w-3.5" />;
      default:
        return <FileText className="h-3.5 w-3.5" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 p-8">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        <span className="ml-3 text-xl text-white">Loading audit data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 p-8">
        <AlertCircle className="h-8 w-8 mr-2 text-red-400" />
        <span className="text-xl text-red-400">{error}</span>
      </div>
    );
  }

  if (!manifest) {
    return (
      <div className="p-8">
        <div className="bg-card border border-border rounded-lg p-8 text-center">
          <Shield className="h-16 w-16 mx-auto mb-4 text-blue-400" />
          <h3 className="text-2xl font-bold mb-4 text-white">No Audit Data Available</h3>
          <p className="text-gray-300 max-w-md mx-auto text-lg">
            Audit logging will be enabled when you run a build. The audit system
            tracks all agent actions for compliance with ISO 42001, EU AI Act, and SOC 2.
          </p>
          <p className="text-gray-400 mt-4 text-sm">
            Project ID: {projectId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compliance Banner */}
      <Card className="bg-blue-950/40 border-blue-800">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Shield className="h-8 w-8 text-blue-400" />
              <div>
                <h3 className="font-semibold text-white">Compliance Audit Trail</h3>
                <p className="text-sm text-gray-400">
                  Project: {projectId} • Full traceability for AI-assisted development
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {manifest.complianceInfo.iso42001 && (
                <Badge variant="secondary">ISO 42001</Badge>
              )}
              {manifest.complianceInfo.euAiAct && (
                <Badge variant="secondary">EU AI Act</Badge>
              )}
              {manifest.complianceInfo.soc2 && (
                <Badge variant="secondary">SOC 2</Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Build Selector */}
      <div className="flex items-center gap-4">
        <label className="font-medium text-white">Build:</label>
        <select
          value={selectedBuild || ''}
          onChange={(e) => setSelectedBuild(e.target.value)}
          className="px-3 py-2 border border-border rounded-md bg-card text-white min-w-[300px]"
        >
          {manifest.builds.map((build) => (
            <option key={build.buildId} value={build.buildId}>
              {new Date(build.timestamp).toLocaleDateString()} - {build.status} (
              {build.storiesCompleted} completed, {build.storiesFailed} failed)
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-400">
          {manifest.totalBuilds} total builds
        </span>
      </div>

      {buildDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Build Summary - Narrower */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-white">
                <Calendar className="h-5 w-5" />
                Build Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Status</span>
                <div className="flex items-center gap-2 font-medium text-white">
                  {getStatusIcon(buildDetails.summary.status)}
                  <span className="capitalize">{buildDetails.summary.status}</span>
                </div>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Duration</span>
                <span className="font-medium text-white">{formatDuration(buildDetails.summary.metrics.buildDurationMs)}</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Stories</span>
                <span className="font-medium text-white">
                  {buildDetails.summary.metrics.storiesCompleted}/{buildDetails.summary.metrics.totalStories}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Files</span>
                <span className="font-medium text-white">
                  +{buildDetails.summary.metrics.totalFilesCreated} / ~{buildDetails.summary.metrics.totalFilesModified}
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Tests</span>
                <span className="font-medium">
                  <span className="text-green-400">{buildDetails.summary.metrics.totalTestsPassed}</span>
                  {' / '}
                  <span className="text-red-400">{buildDetails.summary.metrics.totalTestsFailed}</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-gray-400">Actions</span>
                <span className="font-medium text-white">{buildDetails.summary.metrics.totalAgentActions}</span>
              </div>

              <hr className="my-3 border-border" />

              <div>
                <div className="font-medium text-white mb-1">Model</div>
                <p className="text-gray-400 text-xs">
                  {buildDetails.summary.modelInfo.provider} / {buildDetails.summary.modelInfo.model}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Epic/Stories List - Wider */}
          <Card className="lg:col-span-3">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-white">
                <div className="flex items-center gap-2">
                  <Layers className="h-5 w-5" />
                  Epics & Stories
                </div>
                <span className="text-sm font-normal text-gray-400">
                  {epicGroups.length} epics, {buildDetails.stories.length} stories
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[700px] overflow-y-auto pr-2">
                {epicGroups.map((epic) => (
                  <div key={epic.epicId} className="border border-border rounded-lg overflow-hidden">
                    {/* Epic Header */}
                    <div
                      className="p-3 bg-muted cursor-pointer flex items-center justify-between hover:bg-accent transition-colors"
                      onClick={() => toggleEpic(epic.epicId)}
                    >
                      <div className="flex items-center gap-3">
                        {expandedEpics.has(epic.epicId) ? (
                          <ChevronDown className="h-5 w-5 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-5 w-5 text-gray-400" />
                        )}
                        <FolderOpen className="h-5 w-5 text-blue-400" />
                        <span className="font-semibold text-white">{epic.epicId}</span>
                        <Badge variant="secondary" className="text-xs">
                          {epic.stories.length} stories
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span className="flex items-center gap-1 text-green-400">
                          <CheckCircle className="h-4 w-4" />
                          {epic.completedCount}
                        </span>
                        {epic.failedCount > 0 && (
                          <span className="flex items-center gap-1 text-red-400">
                            <XCircle className="h-4 w-4" />
                            {epic.failedCount}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Stories in Epic */}
                    {expandedEpics.has(epic.epicId) && (
                      <div className="divide-y divide-border">
                        {epic.stories.map((story) => (
                          <div key={story.storyId}>
                            {/* Story Row */}
                            <div
                              className={cn(
                                'p-3 pl-10 cursor-pointer transition-colors',
                                expandedStories.has(story.storyId)
                                  ? 'bg-accent'
                                  : 'hover:bg-muted/50'
                              )}
                              onClick={() => toggleStory(story.storyId)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  {expandedStories.has(story.storyId) ? (
                                    <ChevronDown className="h-4 w-4 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4 text-gray-400" />
                                  )}
                                  {getStatusIcon(story.status)}
                                  <span className="font-medium text-white">{story.storyId}</span>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-400">
                                  <span className="flex items-center gap-1.5" title="Agents">
                                    <Users className="h-4 w-4" />
                                    {story.agentCount}
                                  </span>
                                  <span className="flex items-center gap-1.5" title="Files">
                                    <FileCode className="h-4 w-4" />
                                    {story.filesCreated + story.filesModified}
                                  </span>
                                  <span className="flex items-center gap-1.5" title="Actions">
                                    <Activity className="h-4 w-4" />
                                    {story.totalActions}
                                  </span>
                                </div>
                              </div>
                              <p className="text-sm text-gray-400 mt-1 ml-7">
                                {story.title}
                              </p>
                            </div>

                            {/* Expanded Story Details */}
                            {expandedStories.has(story.storyId) && (
                              <div className="bg-card border-t border-border p-4 pl-10">
                                {loadingStories.has(story.storyId) ? (
                                  <div className="flex items-center gap-2 text-white py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                                    <span>Loading story audit details...</span>
                                  </div>
                                ) : storyDetailsCache.has(story.storyId) ? (
                                  <StoryAuditDetails
                                    details={storyDetailsCache.get(story.storyId)!}
                                    expandedAgents={expandedAgents}
                                    toggleAgent={toggleAgent}
                                    formatDate={formatDate}
                                    getStatusIcon={getStatusIcon}
                                    getActionIcon={getActionIcon}
                                  />
                                ) : failedStories.has(story.storyId) ? (
                                  <div className="space-y-4">
                                    <div className="bg-red-950/30 border border-red-800 rounded p-3">
                                      <p className="text-red-400 text-sm">
                                        Error loading audit details: {failedStories.get(story.storyId)}
                                      </p>
                                    </div>
                                    {/* Show basic stats from list data */}
                                    <div className="grid grid-cols-4 gap-3">
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-white">{story.agentCount}</div>
                                        <div className="text-xs text-gray-400">Agents</div>
                                      </div>
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-green-400">{story.filesCreated}</div>
                                        <div className="text-xs text-gray-400">Created</div>
                                      </div>
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-yellow-400">{story.filesModified}</div>
                                        <div className="text-xs text-gray-400">Modified</div>
                                      </div>
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-white">{story.totalActions}</div>
                                        <div className="text-xs text-gray-400">Actions</div>
                                      </div>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="space-y-4">
                                    <div className="text-gray-400 text-sm">
                                      No detailed audit data available. Showing summary stats:
                                    </div>
                                    {/* Show basic stats from list data */}
                                    <div className="grid grid-cols-4 gap-3">
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-white">{story.agentCount}</div>
                                        <div className="text-xs text-gray-400">Agents</div>
                                      </div>
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-green-400">{story.filesCreated}</div>
                                        <div className="text-xs text-gray-400">Created</div>
                                      </div>
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-yellow-400">{story.filesModified}</div>
                                        <div className="text-xs text-gray-400">Modified</div>
                                      </div>
                                      <div className="bg-muted p-3 rounded border border-border text-center">
                                        <div className="text-2xl font-bold text-white">{story.totalActions}</div>
                                        <div className="text-xs text-gray-400">Actions</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// Separated component for story audit details
function StoryAuditDetails({
  details,
  expandedAgents,
  toggleAgent,
  formatDate,
  getStatusIcon,
  getActionIcon,
}: {
  details: StoryDetails;
  expandedAgents: Set<string>;
  toggleAgent: (id: string) => void;
  formatDate: (date: string) => string;
  getStatusIcon: (status: string) => React.ReactNode;
  getActionIcon: (type: string) => React.ReactNode;
}) {
  const auditLog = details?.auditLog;
  const filesTouched = details?.filesTouched || { created: [], modified: [], deleted: [] };
  const agents = auditLog?.agents || [];
  const filesCreated = filesTouched.created || auditLog?.filesCreated || [];
  const filesModified = filesTouched.modified || auditLog?.filesModified || [];
  const filesDeleted = filesTouched.deleted || [];

  if (!auditLog) {
    return (
      <div className="text-gray-400 py-4">
        No audit data available for this story.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Description */}
      {auditLog.description && (
        <div className="bg-muted/50 p-3 rounded border border-border">
          <p className="text-white text-sm">{auditLog.description}</p>
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-muted p-3 rounded border border-border text-center">
          <div className="text-2xl font-bold text-white">{agents.length}</div>
          <div className="text-xs text-gray-400">Agents</div>
        </div>
        <div className="bg-muted p-3 rounded border border-border text-center">
          <div className="text-2xl font-bold text-green-400">{filesCreated.length}</div>
          <div className="text-xs text-gray-400">Files Created</div>
        </div>
        <div className="bg-muted p-3 rounded border border-border text-center">
          <div className="text-2xl font-bold text-yellow-400">{filesModified.length}</div>
          <div className="text-xs text-gray-400">Files Modified</div>
        </div>
        <div className="bg-muted p-3 rounded border border-border text-center">
          <div className="text-2xl font-bold text-white">
            {agents.reduce((sum, a) => sum + (a.totalActions || 0), 0)}
          </div>
          <div className="text-xs text-gray-400">Total Actions</div>
        </div>
      </div>

      {/* Lifecycle Timeline */}
      {auditLog.lifecycle && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2 text-white">
            <Clock className="h-4 w-4" />
            Lifecycle
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted p-2.5 rounded border border-border">
              <span className="text-gray-400 text-xs">Created</span>
              <p className="font-medium text-sm text-white mt-0.5">
                {auditLog.lifecycle.created ? formatDate(auditLog.lifecycle.created) : 'N/A'}
              </p>
            </div>
            <div className="bg-muted p-2.5 rounded border border-border">
              <span className="text-gray-400 text-xs">Started</span>
              <p className="font-medium text-sm text-white mt-0.5">
                {auditLog.lifecycle.started ? formatDate(auditLog.lifecycle.started) : 'N/A'}
              </p>
            </div>
            <div className="bg-muted p-2.5 rounded border border-border">
              <span className="text-gray-400 text-xs">Completed</span>
              <p className="font-medium text-sm text-white mt-0.5">
                {auditLog.lifecycle.completed ? formatDate(auditLog.lifecycle.completed) : 'N/A'}
              </p>
            </div>
            <div className="bg-muted p-2.5 rounded border border-border">
              <span className="text-gray-400 text-xs">Status</span>
              <p className="font-medium text-sm text-white mt-0.5 capitalize">
                {auditLog.lifecycle.status || auditLog.outcome || 'Unknown'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* WHO did WHAT - Agent Actions */}
      <div>
        <h4 className="font-medium mb-2 flex items-center gap-2 text-white">
          <Users className="h-4 w-4" />
          WHO did WHAT (Agent Audit Trail)
        </h4>
        {agents.length === 0 ? (
          <div className="text-gray-400 text-sm py-2">
            No agent activity recorded for this story.
          </div>
        ) : (
          <div className="space-y-2">
            {agents.map((agent, agentIdx) => (
              <div key={`${agent.instanceId || 'agent'}-${agentIdx}`} className="border border-border rounded-lg overflow-hidden">
                <div
                  className="p-3 bg-muted cursor-pointer flex items-center justify-between hover:bg-accent transition-colors"
                  onClick={() => toggleAgent(agent.instanceId || `agent-${agentIdx}`)}
                >
                  <div className="flex items-center gap-2">
                    {expandedAgents.has(agent.instanceId || `agent-${agentIdx}`) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                    <User className="h-4 w-4 text-blue-400" />
                    <span className="font-medium text-white">{agent.instanceId || `Agent ${agentIdx + 1}`}</span>
                    <Badge variant="secondary" className="text-xs">
                      {agent.role || 'unknown'}
                    </Badge>
                    <span className="text-xs text-gray-400">({agent.model || 'unknown model'})</span>
                  </div>
                  <div className="text-sm text-white font-medium">
                    {agent.totalActions || agent.actions?.length || 0} actions
                  </div>
                </div>

                {expandedAgents.has(agent.instanceId || `agent-${agentIdx}`) && (
                  <div className="p-3 border-t border-border max-h-80 overflow-y-auto bg-card">
                    {(!agent.actions || agent.actions.length === 0) ? (
                      <div className="text-gray-400 text-sm">No actions recorded.</div>
                    ) : (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-400 text-xs border-b border-border">
                            <th className="pb-2 pr-3">When</th>
                            <th className="pb-2 pr-3">What</th>
                            <th className="pb-2 pr-3">Target</th>
                            <th className="pb-2">Outcome</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agent.actions.slice(0, 50).map((action, idx) => (
                            <tr key={idx} className="border-t border-border">
                              <td className="py-2 pr-3 text-gray-400 whitespace-nowrap text-xs">
                                {action.timestamp ? new Date(action.timestamp).toLocaleTimeString() : '-'}
                              </td>
                              <td className="py-2 pr-3">
                                <div className="flex items-center gap-1.5 text-white">
                                  {getActionIcon(action.type)}
                                  <span className="capitalize text-xs">{(action.type || 'action').replace(/_/g, ' ')}</span>
                                </div>
                              </td>
                              <td className="py-2 pr-3 font-mono text-xs text-white break-all max-w-[250px]" title={action.target || action.toolName || '-'}>
                                {action.target || action.toolName || action.content?.slice(0, 50) || '-'}
                              </td>
                              <td className="py-2">
                                <Badge
                                  variant={action.outcome === 'success' ? 'default' : action.outcome === 'failure' ? 'destructive' : 'secondary'}
                                  className="text-xs"
                                >
                                  {action.outcome || 'done'}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                    {agent.actions && agent.actions.length > 50 && (
                      <p className="text-center text-xs text-gray-400 mt-2">
                        Showing 50 of {agent.actions.length} actions
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Files Changed */}
      {(filesCreated.length > 0 || filesModified.length > 0 || filesDeleted.length > 0) && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2 text-white">
            <FileCode className="h-4 w-4" />
            Files Changed
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <span className="text-sm text-green-400 font-medium">
                Created ({filesCreated.length})
              </span>
              <ul className="mt-1.5 space-y-1">
                {filesCreated.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-xs font-mono bg-muted border border-border px-2 py-1 rounded text-white break-all">
                    {f}
                  </li>
                ))}
                {filesCreated.length > 5 && (
                  <li className="text-xs text-gray-400">
                    +{filesCreated.length - 5} more
                  </li>
                )}
                {filesCreated.length === 0 && (
                  <li className="text-xs text-gray-400">None</li>
                )}
              </ul>
            </div>
            <div>
              <span className="text-sm text-yellow-400 font-medium">
                Modified ({filesModified.length})
              </span>
              <ul className="mt-1.5 space-y-1">
                {filesModified.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-xs font-mono bg-muted border border-border px-2 py-1 rounded text-white break-all">
                    {f}
                  </li>
                ))}
                {filesModified.length > 5 && (
                  <li className="text-xs text-gray-400">
                    +{filesModified.length - 5} more
                  </li>
                )}
                {filesModified.length === 0 && (
                  <li className="text-xs text-gray-400">None</li>
                )}
              </ul>
            </div>
            <div>
              <span className="text-sm text-red-400 font-medium">
                Deleted ({filesDeleted.length})
              </span>
              <ul className="mt-1.5 space-y-1">
                {filesDeleted.slice(0, 5).map((f, i) => (
                  <li key={i} className="text-xs font-mono bg-muted border border-border px-2 py-1 rounded text-white break-all">
                    {f}
                  </li>
                ))}
                {filesDeleted.length === 0 && (
                  <li className="text-xs text-gray-400">None</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Test Results */}
      {auditLog.testResults && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2 text-white">
            <CheckCircle className="h-4 w-4" />
            Test Results
          </h4>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-green-950/50 border border-green-800 rounded-lg">
              <div className="text-xl font-bold text-green-400">
                {auditLog.testResults.passed}
              </div>
              <div className="text-xs text-green-500">Passed</div>
            </div>
            <div className="text-center px-4 py-2 bg-red-950/50 border border-red-800 rounded-lg">
              <div className="text-xl font-bold text-red-400">
                {auditLog.testResults.failed}
              </div>
              <div className="text-xs text-red-500">Failed</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Summary */}
      {(auditLog as any).errorSummary && (
        <div>
          <h4 className="font-medium mb-2 flex items-center gap-2 text-red-400">
            <AlertCircle className="h-4 w-4" />
            Error Summary
          </h4>
          <div className="bg-red-950/30 border border-red-800 rounded p-3">
            <p className="text-sm text-red-300 font-mono">{(auditLog as any).errorSummary}</p>
          </div>
        </div>
      )}
    </div>
  );
}
