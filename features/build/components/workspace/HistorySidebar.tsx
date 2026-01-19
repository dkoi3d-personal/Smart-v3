'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  History,
  Package,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
  Loader2,
  FileCode,
  Code2,
  TestTube,
  Clock,
  XCircle,
  Plus,
  GitBranch,
  RotateCcw,
  PanelLeftClose,
  PanelLeft,
  Info,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDuration, getRelativeTime } from '@/lib/format-utils';

interface BuildTask {
  id: string;
  title: string;
  status: string;
  epicId?: string;
  epic_id?: string;
}

interface BuildEpic {
  id: string;
  title: string;
  status?: string;
}

interface BuildMetadata {
  buildNumber: number;
  prompt: string;
  startedAt: string;
  completedAt?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  commitHash?: string;
  metrics?: {
    filesCreated: number;
    filesModified: number;
    linesOfCode: number;
    testsTotal: number;
    testsPassed: number;
    testsFailed: number;
    coverage: number;
    duration: number;
    tokensUsed: number;
    commandsRun: number;
  };
  storyCount?: number;
  epicCount?: number;
  isCurrent?: boolean;
  // Stories/epics loaded with includeStories=true
  epics?: BuildEpic[];
  tasks?: BuildTask[];
}

interface HistorySidebarProps {
  projectId: string;
  projectDirectory: string;
  isBuilding: boolean;
  currentBuildNumber?: number;
  onSelectBuild: (buildNumber: number) => void;
  onNewBuild?: () => void;
  onRestoreVersion?: (commitHash: string) => void;
  onShowProjectContext?: () => void;
  currentBuildMetrics?: {
    filesCreated: number;
    linesOfCode: number;
    elapsedTime: number;
  };
  currentTestingMetrics?: {
    totalTests: number;
  };
  currentStoryCount?: number;
  defaultCollapsed?: boolean;
}

export function HistorySidebar({
  projectId,
  projectDirectory,
  isBuilding,
  currentBuildNumber,
  onSelectBuild,
  onNewBuild,
  onShowProjectContext,
  onRestoreVersion,
  currentBuildMetrics,
  currentTestingMetrics,
  currentStoryCount,
  defaultCollapsed = false,
}: HistorySidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedBuilds, setExpandedBuilds] = useState<Set<number>>(new Set());
  const [builds, setBuilds] = useState<BuildMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch build history from API with stories included
  // Re-fetch when build completes (isBuilding goes from true to false)
  useEffect(() => {
    async function fetchBuildHistory() {
      try {
        const response = await fetch(`/api/build-history?projectId=${projectId}&includeStories=true`);
        if (response.ok) {
          const data = await response.json();
          setBuilds(data.builds || []);
        }
      } catch (error) {
        console.error('Failed to fetch build history:', error);
      } finally {
        setLoading(false);
      }
    }

    // Fetch on mount and when build completes
    if (!isBuilding) {
      fetchBuildHistory();
    }
  }, [projectId, isBuilding]);

  // Calculate totals from builds
  const totals = useMemo(() => {
    if (builds.length === 0) return null;

    let totalFiles = 0;
    let totalLoc = 0;
    let totalTests = 0;
    let totalStories = 0;

    builds.forEach(build => {
      if (build.metrics) {
        totalFiles += build.metrics.filesCreated;
        totalLoc += build.metrics.linesOfCode;
        totalTests += build.metrics.testsTotal;
      }
      if (build.storyCount) {
        totalStories += build.storyCount;
      }
    });

    return {
      builds: builds.length,
      stories: totalStories,
      files: totalFiles,
      loc: totalLoc,
      tests: totalTests,
    };
  }, [builds]);

  const toggleBuild = (buildNumber: number) => {
    setExpandedBuilds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(buildNumber)) {
        newSet.delete(buildNumber);
      } else {
        newSet.add(buildNumber);
      }
      return newSet;
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
      case 'in_progress':
        return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
      case 'failed':
        return <XCircle className="h-3.5 w-3.5 text-red-500" />;
      default:
        return <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-emerald-500/30 hover:border-emerald-500/50';
      case 'in_progress':
        return 'border-blue-500/30 hover:border-blue-500/50 bg-blue-500/5';
      case 'failed':
        return 'border-red-500/30 hover:border-red-500/50';
      default:
        return 'border-border/50 hover:border-border';
    }
  };

  // Collapsed view - just a thin strip with expand button
  if (isCollapsed) {
    return (
      <div className="h-full w-10 flex flex-col bg-gradient-to-b from-slate-900/50 to-background border-r border-border/50">
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex-1 flex flex-col items-center justify-start pt-4 gap-3 hover:bg-muted/20 transition-colors"
          title="Expand build history"
        >
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center">
            <History className="h-4 w-4 text-violet-400" />
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <div className="writing-mode-vertical text-[10px] text-muted-foreground font-medium" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
            {builds.length} builds
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="h-full w-64 flex flex-col bg-gradient-to-b from-slate-900/50 to-background border-r border-border/50 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center flex-shrink-0">
            <History className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold truncate">Build History</h2>
            <p className="text-[10px] text-muted-foreground">
              {builds.length} version{builds.length !== 1 ? 's' : ''}
            </p>
          </div>
          {onShowProjectContext && (
            <button
              onClick={onShowProjectContext}
              className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
              title="Project Context"
            >
              <Info className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsCollapsed(true)}
            className="h-6 w-6 rounded flex items-center justify-center hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Build List */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="p-3 space-y-2 overflow-hidden">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-30" />
              <p className="text-xs">Loading builds...</p>
            </div>
          ) : builds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No builds yet</p>
            </div>
          ) : (
            builds.map((build, index) => {
              const isExpanded = expandedBuilds.has(build.buildNumber);
              const isLatest = index === 0;
              const isSelected = currentBuildNumber === build.buildNumber;

              return (
                <div
                  key={build.buildNumber}
                  className={cn(
                    'border rounded-lg transition-all cursor-pointer overflow-hidden',
                    getStatusColor(build.status),
                    isSelected && 'ring-2 ring-indigo-500/50'
                  )}
                >
                  {/* Build Header */}
                  <div
                    className="p-3 hover:bg-muted/20 transition-colors"
                    onClick={() => {
                      toggleBuild(build.buildNumber);
                      onSelectBuild(build.buildNumber);
                    }}
                  >
                    <div className="flex items-start gap-2 min-w-0 w-full overflow-hidden">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleBuild(build.buildNumber);
                        }}
                        className="mt-0.5 flex-shrink-0"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </button>

                      <div className="flex-shrink-0">
                        {getStatusIcon(build.status)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-semibold">v{build.buildNumber}</span>
                          {isLatest && build.status === 'completed' && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                              Latest
                            </Badge>
                          )}
                          {build.status === 'in_progress' && (
                            <Badge className="text-[9px] px-1 py-0 h-4 bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
                              Building
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5 max-w-full">
                          {build.prompt.slice(0, 30)}...
                        </p>
                        <div className="text-[9px] text-muted-foreground/60 mt-1">
                          {getRelativeTime(build.completedAt || build.startedAt)}
                          {build.commitHash && (
                            <span className="ml-1 font-mono">{build.commitHash.slice(0, 7)}</span>
                          )}
                        </div>
                      </div>

                      {/* Restore button in collapsed view for non-latest builds */}
                      {!isLatest && !isExpanded && build.commitHash && onRestoreVersion && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 flex-shrink-0 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestoreVersion(build.commitHash!);
                          }}
                          title="Restore this version"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-0 border-t border-border/30 bg-muted/10 overflow-hidden max-w-full">
                      {/* Metrics Grid */}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                          <FileCode className="h-3 w-3 text-blue-400 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {build.metrics?.filesCreated || 0} files
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                          <Code2 className="h-3 w-3 text-purple-400 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {(build.metrics?.linesOfCode || 0).toLocaleString()} LOC
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                          <TestTube className="h-3 w-3 text-green-400 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {build.metrics?.testsTotal || 0} tests
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] min-w-0">
                          <Clock className="h-3 w-3 text-amber-400 flex-shrink-0" />
                          <span className="text-muted-foreground truncate">
                            {formatDuration(build.metrics?.duration || 0)}
                          </span>
                        </div>
                      </div>

                      {/* Epics/Stories for this build */}
                      {build.epics && build.epics.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/20 overflow-hidden">
                          <div className="text-[10px] font-medium text-muted-foreground mb-1.5">
                            {build.epics.length} {build.epics.length === 1 ? 'Epic' : 'Epics'} • {build.tasks?.length || 0} Stories
                          </div>
                          <div className="space-y-1 max-h-[150px] overflow-y-auto overflow-x-hidden">
                            {build.epics.map((epic) => {
                              const epicTasks = build.tasks?.filter(t =>
                                (t.epicId || t.epic_id) === epic.id
                              ) || [];
                              return (
                                <div key={epic.id} className="bg-muted/30 rounded px-2 py-1.5 overflow-hidden">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                                    <span className="text-[10px] font-medium text-foreground/90 truncate flex-1 min-w-0">
                                      {epic.title}
                                    </span>
                                  </div>
                                  {epicTasks.length > 0 && (
                                    <div className="mt-1 pl-4 space-y-0.5 overflow-hidden">
                                      {epicTasks.slice(0, 3).map((task) => (
                                        <div key={task.id} className="flex items-center gap-1 text-[9px] text-muted-foreground min-w-0">
                                          <CheckCircle className="h-2.5 w-2.5 text-emerald-400/60 flex-shrink-0" />
                                          <span className="truncate min-w-0">{task.title}</span>
                                        </div>
                                      ))}
                                      {epicTasks.length > 3 && (
                                        <div className="text-[9px] text-muted-foreground/60 pl-3">
                                          +{epicTasks.length - 3} more
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Fallback for builds without loaded stories */}
                      {(!build.epics || build.epics.length === 0) && build.storyCount !== undefined && build.storyCount > 0 && (
                        <div className="mt-2 pt-2 border-t border-border/20">
                          <span className="text-[10px] text-muted-foreground">
                            {build.storyCount} {build.storyCount === 1 ? 'story' : 'stories'}
                          </span>
                        </div>
                      )}

                      {/* Restore button in expanded view */}
                      {!isLatest && build.commitHash && onRestoreVersion && (
                        <div className="mt-2 pt-2 border-t border-border/20">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRestoreVersion(build.commitHash!);
                            }}
                          >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Restore this version
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Totals Footer */}
      {totals && (
        <div className="p-3 border-t border-border/50 bg-gradient-to-r from-emerald-950/30 to-green-950/20 flex-shrink-0">
          <div className="text-[10px] text-muted-foreground mb-2 font-medium">
            CUMULATIVE TOTAL
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="text-xs">
              <span className="text-emerald-400 font-semibold">{totals.builds}</span>
              <span className="text-muted-foreground"> builds</span>
            </div>
            <div className="text-xs">
              <span className="text-emerald-400 font-semibold">{totals.stories}</span>
              <span className="text-muted-foreground"> stories</span>
            </div>
            <div className="text-xs">
              <span className="text-emerald-400 font-semibold">{totals.loc.toLocaleString()}</span>
              <span className="text-muted-foreground"> LOC</span>
            </div>
            <div className="text-xs">
              <span className="text-emerald-400 font-semibold">{totals.tests}</span>
              <span className="text-muted-foreground"> tests</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
