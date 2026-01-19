'use client';

import { useState, useEffect } from 'react';
import {
  Kanban,
  ListTree,
  Bot,
  Edit3,
  Send,
  Play,
  Pause,
  Square,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Loader2,
  TestTube,
  History,
  Clock,
  FileCode,
  Code2,
  Wrench,
  Terminal,
  MessageSquare,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Epic, Task, BuildPhase, OverviewMode, IterationState } from '../../types';
import {
  useTasks,
  useEpics,
  usePhase,
  useIsStreaming,
  useHasCheckpoint,
  useIsIterating,
  useOverviewMode,
  useIterationState,
  useTestingMetrics,
  useSecurityMetrics,
  useBuildMetrics,
  useAgentMessages,
} from '../../stores/useBuildPageStore';

// 4-column kanban (completed stories go to Build History)
const KANBAN_COLUMNS = [
  { id: 'backlog', title: 'BACKLOG', color: 'bg-slate-700 text-white' },
  { id: 'in_progress', title: 'IN PROGRESS', color: 'bg-blue-600 text-white' },
  { id: 'testing', title: 'TESTING', color: 'bg-amber-500 text-black font-bold' },
  { id: 'done', title: 'DONE', color: 'bg-green-600 text-white' },
];

interface BuildTabProps {
  // Project ID for fetching build history
  projectId: string;
  // Props not in store (from useUIState or local state)
  taskBoardView: 'kanban' | 'epics';
  expandedEpics: Set<string>;
  // Callback props
  onTaskBoardViewChange: (view: 'kanban' | 'epics') => void;
  onExpandedEpicsChange: (epics: Set<string>) => void;
  onPhaseChange: (phase: BuildPhase) => void;
  onUserPromptChange: (prompt: string) => void;
  onSelectedStoryChange: (story: Task | null) => void;
  onResume: () => void;
  onPause: () => void;
  onStop: () => void;
  onOverviewModeChange: (mode: OverviewMode) => void;
  renderTaskCard: (task: Task) => React.ReactNode;
  // In iterate mode (completed projects), filter to only show current iteration stories
  isIterateMode?: boolean;
  // Current iteration ID - when set, only show stories from this iteration in iterate mode
  currentIterationId?: string;
}

function getKanbanStatus(status: Task['status']): string {
  if (status === 'backlog' || status === 'pending' || status === 'failed') return 'backlog';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'testing') return 'testing';
  if (status === 'done' || status === 'completed') return 'done';
  return 'backlog';
}

// Build History Section - Shows each build version (v1, v2, etc.) with its epics/stories
interface BuildHistorySectionProps {
  projectId: string;
  onSelectedStoryChange: (story: Task | null) => void;
}

interface BuildVersion {
  buildNumber: number;
  prompt: string;
  status: string;
  completedAt?: string;
  storyCount?: number;
  epicCount?: number;
  epics?: Array<{ id: string; title: string }>;
  tasks?: Array<{ id: string; title: string; status: string; epicId?: string; epic_id?: string }>;
  metrics?: {
    filesCreated: number;
    linesOfCode: number;
    testsTotal: number;
  };
}

function BuildHistorySection({ projectId, onSelectedStoryChange }: BuildHistorySectionProps) {
  const [builds, setBuilds] = useState<BuildVersion[]>([]);
  const [expandedBuilds, setExpandedBuilds] = useState<Set<number>>(new Set([1]));
  const [loading, setLoading] = useState(true);

  // Fetch build history
  useEffect(() => {
    async function fetchBuilds() {
      try {
        const res = await fetch(`/api/build-history?projectId=${projectId}&includeStories=true`);
        if (res.ok) {
          const data = await res.json();
          setBuilds(data.builds || []);
        }
      } catch (err) {
        console.error('Failed to fetch build history:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchBuilds();
  }, [projectId]);

  const toggleBuild = (buildNumber: number) => {
    setExpandedBuilds(prev => {
      const next = new Set(prev);
      if (next.has(buildNumber)) {
        next.delete(buildNumber);
      } else {
        next.add(buildNumber);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 text-violet-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading build history...</span>
        </div>
      </div>
    );
  }

  if (builds.length === 0) {
    return (
      <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <History className="h-4 w-4" />
          <span className="text-sm">No build history yet</span>
        </div>
      </div>
    );
  }

  const totalStories = builds.reduce((sum, b) => sum + (b.storyCount || b.tasks?.length || 0), 0);

  return (
    <div className="bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20 rounded-xl backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-violet-500/10">
        <div className="h-6 w-6 rounded-md bg-violet-500/20 flex items-center justify-center">
          <History className="h-3 w-3 text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-violet-400">Build History</span>
        <Badge variant="outline" className="text-[10px] border-violet-500/50 text-violet-400 bg-violet-500/10 ml-auto">
          {builds.length} {builds.length === 1 ? 'version' : 'versions'} • {totalStories} stories
        </Badge>
      </div>

      {/* Build versions as pills */}
      <div className="p-2 space-y-2 max-h-[350px] overflow-y-auto">
        {builds.map((build) => {
          const isExpanded = expandedBuilds.has(build.buildNumber);
          const storyCount = build.storyCount || build.tasks?.length || 0;
          const epicCount = build.epicCount || build.epics?.length || 0;

          return (
            <div
              key={build.buildNumber}
              className={cn(
                "border rounded-lg overflow-hidden transition-all",
                isExpanded ? "border-violet-500/40 bg-violet-500/5" : "border-border/30 hover:border-violet-500/30"
              )}
            >
              {/* Version Header - Clickable Pill */}
              <button
                onClick={() => toggleBuild(build.buildNumber)}
                className="w-full flex items-center gap-2 p-2.5 hover:bg-violet-500/5 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="h-3.5 w-3.5 text-violet-400" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <Badge className="text-[10px] px-2 py-0.5 bg-violet-500/20 text-violet-300 border-violet-500/30">
                  v{build.buildNumber}
                </Badge>
                <span className="text-[11px] text-muted-foreground truncate flex-1 text-left">
                  {build.prompt?.slice(0, 40)}{build.prompt?.length > 40 ? '...' : ''}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {epicCount}E • {storyCount}S
                </span>
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              </button>

              {/* Expanded Content - Epics & Stories */}
              {isExpanded && build.epics && build.epics.length > 0 && (
                <div className="px-3 pb-3 pt-1 border-t border-violet-500/10 space-y-1.5">
                  {build.epics.map((epic) => {
                    const epicTasks = build.tasks?.filter(t =>
                      (t.epicId || t.epic_id) === epic.id
                    ) || [];

                    return (
                      <div key={epic.id} className="bg-muted/30 rounded-lg p-2">
                        <div className="flex items-center gap-2 mb-1">
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                          <span className="text-[11px] font-medium text-foreground/90 truncate flex-1">
                            {epic.title}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-emerald-500/30 text-emerald-400">
                            {epicTasks.length}
                          </Badge>
                        </div>
                        {epicTasks.length > 0 && (
                          <div className="pl-5 space-y-0.5">
                            {epicTasks.slice(0, 3).map((task) => (
                              <div
                                key={task.id}
                                className="flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => onSelectedStoryChange(task as any)}
                              >
                                <CheckCircle className="h-2.5 w-2.5 text-emerald-400/60" />
                                <span className="truncate">{task.title}</span>
                              </div>
                            ))}
                            {epicTasks.length > 3 && (
                              <div className="text-[9px] text-muted-foreground/60">
                                +{epicTasks.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fallback if no epics loaded */}
              {isExpanded && (!build.epics || build.epics.length === 0) && storyCount > 0 && (
                <div className="px-3 pb-3 pt-1 border-t border-violet-500/10">
                  <span className="text-[10px] text-muted-foreground">
                    {storyCount} stories completed
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function BuildTab({
  projectId,
  taskBoardView,
  expandedEpics,
  onTaskBoardViewChange,
  onExpandedEpicsChange,
  onPhaseChange,
  onUserPromptChange,
  onSelectedStoryChange,
  onResume,
  onPause,
  onStop,
  onOverviewModeChange,
  renderTaskCard,
  isIterateMode = false,
  currentIterationId,
}: BuildTabProps) {
  // Get state from store selectors
  const tasks = useTasks();
  const epics = useEpics();
  const phase = usePhase();
  const hasCheckpoint = useHasCheckpoint();
  const isStreaming = useIsStreaming();
  const isIterating = useIsIterating();
  const overviewMode = useOverviewMode();
  const iterationState = useIterationState();
  const testingMetrics = useTestingMetrics();
  const securityMetrics = useSecurityMetrics();
  const buildMetrics = useBuildMetrics();
  const agentMessages = useAgentMessages();

  // Filter to only show Product Owner messages
  const poMessages = agentMessages.filter(m => m.agentRole === 'product_owner');
  // Select columns based on mode
  const kanbanColumns = KANBAN_COLUMNS;

  // All tasks go to kanban including done
  const filteredTasks = tasks;

  // For Build History: show completed stories (previous builds are in .build-history folder)
  const buildHistoryTasks = tasks.filter(t =>
    t.status === 'done' || t.status === 'completed'
  );

  // Filter epics that have stories in the current build
  const filteredEpics = epics.filter(epic =>
    filteredTasks.some(t => t.epicId === epic.id)
  );

  // For Build History epics: all epics that have completed stories
  const buildHistoryEpics = epics.filter(epic =>
    buildHistoryTasks.some(t => t.epicId === epic.id)
  );

  const toggleEpicExpanded = (epicId: string) => {
    const newExpanded = new Set(expandedEpics);
    if (expandedEpics.has(epicId)) {
      newExpanded.delete(epicId);
    } else {
      newExpanded.add(epicId);
    }
    onExpandedEpicsChange(newExpanded);
  };

  // ========== KANBAN VIEW FOR ALL PHASES ==========
  return (
    <div className="h-full grid grid-cols-4 gap-4">
      {/* Task Board with Kanban/Epics tabs - Takes 3 columns */}
      <div className="col-span-3 overflow-hidden">
        <Card className="h-full flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Kanban className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <span className="text-base font-bold">Task Board</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="h-1.5 w-24 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-green-400 transition-all duration-500"
                        style={{ width: `${filteredTasks.length > 0 ? (filteredTasks.filter(t => getKanbanStatus(t.status) === 'done').length / filteredTasks.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {filteredTasks.filter(t => getKanbanStatus(t.status) === 'done').length}/{filteredTasks.length} done
                    </span>
                  </div>
                </div>
              </div>
              {/* View toggle tabs */}
              <div className="flex items-center gap-1 bg-muted/50 backdrop-blur-sm rounded-xl p-1 border border-border/30">
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 px-4 text-xs rounded-lg transition-all duration-200",
                    taskBoardView === 'kanban'
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => onTaskBoardViewChange('kanban')}
                >
                  <Kanban className="h-3.5 w-3.5 mr-1.5" />
                  Kanban
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className={cn(
                    "h-8 px-4 text-xs rounded-lg transition-all duration-200",
                    taskBoardView === 'epics'
                      ? "bg-background shadow-sm text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => onTaskBoardViewChange('epics')}
                >
                  <ListTree className="h-3.5 w-3.5 mr-1.5" />
                  Epics
                  {filteredEpics.length > 0 && (
                    <Badge className="ml-1.5 h-5 px-1.5 text-[10px] bg-primary/10 text-primary border-0">{filteredEpics.length}</Badge>
                  )}
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden p-3">
            {taskBoardView === 'kanban' ? (
              /* Kanban View - 4 columns */
              <div className="grid gap-3 h-full grid-cols-4">
                {kanbanColumns.map((column) => {
                  const columnTasks = filteredTasks.filter(t => getKanbanStatus(t.status) === column.id);
                  const columnColors: Record<string, { header: string; border: string; bg: string }> = {
                    backlog: { header: 'from-slate-500/20 to-slate-600/10', border: 'border-slate-500/30', bg: 'bg-slate-500/5' },
                    in_progress: { header: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', bg: 'bg-blue-500/5' },
                    testing: { header: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30', bg: 'bg-amber-500/5' },
                    done: { header: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
                  };
                  const colors = columnColors[column.id] || columnColors.backlog;
                  return (
                    <div key={column.id} className="flex flex-col h-full min-h-0">
                      <div className={cn(
                        'text-sm font-semibold p-2.5 rounded-t-xl flex items-center justify-between bg-gradient-to-br border-b-0',
                        colors.header, colors.border
                      )}>
                        <span>{column.title}</span>
                        <Badge variant="outline" className={cn("text-[10px] h-5 px-2 font-bold", colors.border)}>{columnTasks.length}</Badge>
                      </div>
                      <div className={cn(
                        "flex-1 border border-t-0 rounded-b-xl overflow-y-auto",
                        colors.border, colors.bg
                      )}>
                        <div className="p-2 space-y-2">
                          {columnTasks.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-8 opacity-60">
                              No tasks
                            </div>
                          ) : (
                            columnTasks.map(renderTaskCard)
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* Epics View - shows only epics from current iteration */
              <ScrollArea className="h-full">
                {epics.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center py-12">
                      <ListTree className="h-12 w-12 mx-auto mb-4 opacity-30" />
                      <p className="text-lg font-medium">{isIterateMode ? 'No iteration epics' : 'No epics yet'}</p>
                      <p className="text-sm mt-1">{isIterateMode ? 'Start an iteration to see epics' : 'Start a build to see epics'}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-1">
                    {epics.map(epic => {
                      const isExpanded = expandedEpics.has(epic.id);
                      // Use ALL tasks for epic counts (not filtered) to show true progress
                      const epicStories = tasks.filter(t => t.epicId === epic.id);
                      if (epicStories.length === 0) return null; // Skip epics with no stories
                      const completedStories = epicStories.filter(t => t.status === 'completed' || t.status === 'done').length;
                      const inProgressStories = epicStories.filter(t => t.status === 'in_progress').length;
                      const testingStories = epicStories.filter(t => t.status === 'testing').length;
                      const totalPoints = epicStories.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

                      return (
                        <div key={epic.id} className="border-2 border-border rounded-lg overflow-hidden">
                          {/* Epic Header */}
                          <div
                            className={cn(
                              'flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50 transition-colors',
                              completedStories === epicStories.length && epicStories.length > 0 && 'bg-green-500/5',
                              inProgressStories > 0 && completedStories < epicStories.length && 'bg-blue-500/5',
                              testingStories > 0 && completedStories < epicStories.length && 'bg-amber-500/5'
                            )}
                            onClick={() => toggleEpicExpanded(epic.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-sm truncate">{epic.title}</h3>
                                <Badge className={cn(
                                  'text-[10px] font-semibold',
                                  epic.priority === 'high' && 'bg-red-500 text-white',
                                  epic.priority === 'medium' && 'bg-yellow-500 text-black',
                                  epic.priority === 'low' && 'bg-green-500 text-white',
                                  !epic.priority && 'bg-gray-500 text-white',
                                )}>
                                  {(epic.priority || 'medium').toUpperCase()}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              {/* Status breakdown */}
                              <div className="flex items-center gap-1.5 text-[10px]">
                                {inProgressStories > 0 && (
                                  <span className="text-blue-400">{inProgressStories} building</span>
                                )}
                                {testingStories > 0 && (
                                  <span className="text-amber-400">{testingStories} testing</span>
                                )}
                                <span className={completedStories === epicStories.length ? "text-emerald-400 font-medium" : "text-muted-foreground"}>
                                  {completedStories}/{epicStories.length} done
                                </span>
                              </div>
                              <Badge variant="default" className="text-xs">
                                {totalPoints} pts
                              </Badge>
                              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className={cn(
                                    'h-full transition-all',
                                    completedStories === epicStories.length && epicStories.length > 0
                                      ? 'bg-green-500'
                                      : 'bg-blue-500'
                                  )}
                                  style={{ width: `${epicStories.length > 0 ? (completedStories / epicStories.length) * 100 : 0}%` }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Stories List */}
                          {isExpanded && (
                            <div className="border-t border-border bg-muted/20">
                              {epicStories.length === 0 ? (
                                <div className="p-3 text-center text-muted-foreground text-sm">
                                  No stories
                                </div>
                              ) : (
                                <div className="max-h-[300px] overflow-y-auto divide-y divide-border/50">
                                  {epicStories.map(story => (
                                    <div
                                      key={story.id}
                                      className="p-2 pl-10 hover:bg-muted/50 cursor-pointer flex items-center gap-3"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onSelectedStoryChange(story);
                                      }}
                                    >
                                      {story.status === 'completed' || story.status === 'done' ? (
                                        <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                                      ) : story.status === 'in_progress' ? (
                                        <Loader2 className="h-4 w-4 text-blue-500 animate-spin flex-shrink-0" />
                                      ) : story.status === 'testing' ? (
                                        <TestTube className="h-4 w-4 text-yellow-500 flex-shrink-0" />
                                      ) : (
                                        <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                      )}
                                      <span className={cn(
                                        'text-sm flex-1 truncate',
                                        (story.status === 'completed' || story.status === 'done') && 'line-through opacity-60'
                                      )}>
                                        {story.title}
                                      </span>
                                      {story.priority && (
                                        <Badge className={cn(
                                          'text-[10px]',
                                          story.priority === 'high' && 'bg-red-500 text-white',
                                          story.priority === 'medium' && 'bg-yellow-500 text-black',
                                          story.priority === 'low' && 'bg-green-500 text-white',
                                        )}>
                                          {story.priority.toUpperCase()}
                                        </Badge>
                                      )}
                                      {story.storyPoints && (
                                        <Badge variant="outline" className="text-[10px]">
                                          {story.storyPoints} pts
                                        </Badge>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* AI Controls Panel */}
      <div className="col-span-1 overflow-hidden flex flex-col gap-2">
        {/* Build Stats - only shown during/after build */}
        {(phase === 'building' || phase === 'completed' || buildMetrics.elapsedTime > 0) && (
          <div className="flex items-center justify-center gap-4 py-2 px-3 rounded-lg bg-muted/30 border border-border/30">
            <div className="flex items-center gap-1.5 text-xs">
              <Clock className="h-3 w-3 text-muted-foreground" />
              <span className="font-mono font-medium tabular-nums">
                {Math.floor(buildMetrics.elapsedTime / 60000)}:{String(Math.floor((buildMetrics.elapsedTime % 60000) / 1000)).padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <FileCode className="h-3 w-3 text-emerald-500" />
              <span className="font-mono font-medium">{(buildMetrics.filesCreated || 0) + (buildMetrics.filesModified || 0)}</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <Code2 className="h-3 w-3 text-purple-500" />
              <span className="font-mono font-medium">{(buildMetrics.linesOfCode || 0).toLocaleString()}</span>
            </div>
            {buildMetrics.toolCalls !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                <Wrench className="h-3 w-3 text-cyan-500" />
                <span className="font-mono font-medium">{buildMetrics.toolCalls}</span>
              </div>
            )}
            {buildMetrics.commandsRun !== undefined && (
              <div className="flex items-center gap-1 text-xs">
                <Terminal className="h-3 w-3 text-orange-500" />
                <span className="font-mono font-medium">{buildMetrics.commandsRun}</span>
              </div>
            )}
          </div>
        )}

        <Card className="flex-1 flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg">
          <CardHeader className="pb-3 flex-shrink-0 border-b border-border/40">
            <CardTitle className="text-sm font-semibold flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-violet-400" />
              </div>
              <div className="flex-1">
                <span className="text-base font-bold">AI Controls</span>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {phase === 'building' ? 'Active session' : phase === 'stopped' ? 'Workflow stopped' : phase === 'paused' ? 'Workflow paused' : 'Ready to assist'}
                </div>
              </div>
              {/* Status indicators */}
              {(phase === 'stopped' || phase === 'paused') && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 rounded-full px-2.5 py-1">
                    <Square className="h-2 w-2 text-red-500" />
                    <span className="text-[10px] font-medium text-red-400">{phase === 'stopped' ? 'Stopped' : 'Paused'}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onResume}
                    className="h-6 px-2 hover:bg-green-500/20 text-green-500"
                    title="Resume build"
                  >
                    <Play className="h-3 w-3 mr-1" />
                    <span className="text-[10px]">Resume</span>
                  </Button>
                </div>
              )}
              {phase === 'building' && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-medium text-emerald-400">Live</span>
                  </div>
                  {isStreaming && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onPause}
                        className="h-6 w-6 hover:bg-yellow-500/20"
                        title="Pause build"
                      >
                        <Pause className="h-3 w-3 text-yellow-500" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={onStop}
                        className="h-6 w-6 hover:bg-red-500/20"
                        title="Stop build"
                      >
                        <Square className="h-3 w-3 text-red-500" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Stopped State Banner */}
            {(phase === 'stopped' || phase === 'paused') && (
              <div className="bg-gradient-to-br from-red-500/10 to-orange-500/5 border border-red-500/20 rounded-xl p-4 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center">
                    <Square className="h-5 w-5 text-red-400" />
                  </div>
                  <div>
                    <span className="text-lg font-bold text-red-400">{phase === 'stopped' ? 'Workflow Stopped' : 'Workflow Paused'}</span>
                    <p className="text-xs text-muted-foreground">All agents have been terminated</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mb-4">
                  {hasCheckpoint
                    ? 'A checkpoint was saved. You can resume from where you left off or start a new build.'
                    : 'No checkpoint was saved. You can start a new build.'}
                </p>
                <div className="flex gap-2">
                  {hasCheckpoint && (
                    <Button
                      size="sm"
                      onClick={onResume}
                      className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Resume Build
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onPhaseChange('planned')}
                    className={hasCheckpoint ? "flex-1" : "w-full"}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    New Build
                  </Button>
                </div>
              </div>
            )}

            {/* Build History - Always shows in iterate mode with completed stories from previous iterations */}
            {isIterateMode && (
              <BuildHistorySection
                projectId={projectId}
                onSelectedStoryChange={onSelectedStoryChange}
              />
            )}

            {/* Product Owner Chat Logs - Shows for all builds */}
            <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/5 border border-emerald-500/20 rounded-xl backdrop-blur-sm overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-2 p-3 border-b border-emerald-500/10">
                <div className="h-6 w-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
                  <MessageSquare className="h-3 w-3 text-emerald-400" />
                </div>
                <span className="text-sm font-semibold text-emerald-400">Product Owner</span>
                {poMessages.length > 0 && (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-400 bg-emerald-500/10 ml-auto">
                    {poMessages.length} messages
                  </Badge>
                )}
                {isStreaming && (
                  <span className="relative flex h-2 w-2 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                )}
              </div>
              {/* Chat Log */}
              <div className="max-h-[250px] overflow-y-auto">
                <div className="p-3 font-mono text-xs space-y-2">
                  {poMessages.length === 0 ? (
                    <div className="text-muted-foreground text-center py-4 flex flex-col items-center gap-2">
                      <MessageSquare className="h-6 w-6 opacity-30" />
                      <span className="text-[11px]">Waiting for Product Owner...</span>
                    </div>
                  ) : (
                    [...new Map(poMessages.map(m => [m.id, m])).values()].slice(-20).map((msg, index) => (
                      <div key={`${msg.id}-${index}`} className="flex items-start gap-2">
                        <span className="text-emerald-400 font-bold flex-shrink-0">[PO]</span>
                        <div className="flex-1 min-w-0">
                          {msg.type === 'action' && msg.toolName && (
                            <span className="text-yellow-400 mr-1">{`<${msg.toolName}>`}</span>
                          )}
                          {msg.type === 'error' ? (
                            <span className="text-red-400 break-words">{msg.content}</span>
                          ) : msg.type === 'result' ? (
                            <span className="text-cyan-400 break-words">{msg.content}</span>
                          ) : msg.type === 'thinking' ? (
                            <span className="text-gray-500 italic break-words">{msg.content}</span>
                          ) : (
                            <span className="text-green-400 break-words">{msg.content}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {isStreaming && poMessages.length > 0 && (
                    <div className="text-emerald-400">
                      <span className="animate-pulse">_</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
