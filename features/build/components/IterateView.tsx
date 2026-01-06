'use client';

import { useMemo, useState } from 'react';
import {
  Bot,
  Edit3,
  Send,
  Loader2,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  TestTube,
  FileCode,
  Code2,
  Clock,
  Zap,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Task, Epic, IterationState, ResearchSuggestion } from '../types';
import { formatDuration } from '@/lib/format-utils';

const KANBAN_COLUMNS = [
  { id: 'backlog', title: 'BACKLOG', color: 'from-slate-500/20 to-slate-600/10', border: 'border-slate-500/30' },
  { id: 'in_progress', title: 'IN PROGRESS', color: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30' },
  { id: 'testing', title: 'TESTING', color: 'from-amber-500/20 to-amber-600/10', border: 'border-amber-500/30' },
  { id: 'done', title: 'DONE', color: 'from-emerald-500/20 to-emerald-600/10', border: 'border-emerald-500/30' },
];

interface IterateViewProps {
  tasks: Task[];
  epics: Epic[];
  iterationState: IterationState | null;
  userPrompt: string;
  isIterating: boolean;
  onUserPromptChange: (prompt: string) => void;
  onSendIteration: (prompt: string) => void;
  onSelectedStoryChange: (story: Task | null) => void;
  onSwitchToSummary: () => void;
  renderTaskCard: (task: Task) => React.ReactNode;
}

function getKanbanStatus(status: Task['status']): string {
  if (status === 'backlog' || status === 'pending') return 'backlog';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'testing') return 'testing';
  if (status === 'done' || status === 'completed') return 'done';
  return 'backlog';
}

export function IterateView({
  tasks,
  epics,
  iterationState,
  userPrompt,
  isIterating,
  onUserPromptChange,
  onSendIteration,
  onSelectedStoryChange,
  onSwitchToSummary,
  renderTaskCard,
}: IterateViewProps) {
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

  // Get current iteration ID
  const currentIterationId = iterationState?.currentIteration?.id;

  // All tasks belong to current build (clean-slate architecture)
  const currentIterationStories = useMemo(() => tasks, [tasks]);

  const originalStories = useMemo(() => tasks, [tasks]);

  // Current iteration metrics
  const currentMetrics = iterationState?.currentIteration?.metricsAdded;

  const toggleEpic = (epicId: string) => {
    const newExpanded = new Set(expandedEpics);
    if (expandedEpics.has(epicId)) {
      newExpanded.delete(epicId);
    } else {
      newExpanded.add(epicId);
    }
    setExpandedEpics(newExpanded);
  };

  const getOriginalEpicStories = (epicId: string) =>
    originalStories.filter(t => t.epicId === epicId);

  const getOriginalEpicProgress = (epicId: string) => {
    const stories = getOriginalEpicStories(epicId);
    const completed = stories.filter(t => t.status === 'done' || t.status === 'completed').length;
    return { completed, total: stories.length };
  };

  // Only show epics that have original stories
  const epicsWithOriginalStories = useMemo(() =>
    epics.filter(epic => getOriginalEpicStories(epic.id).length > 0), [epics, originalStories]
  );

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Current Iteration Section */}
      <div className="flex-1 grid grid-cols-4 gap-4 min-h-0">
        {/* Kanban - 3 columns */}
        <div className="col-span-3 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/40 flex-shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center">
                    <Zap className="h-3.5 w-3.5 text-blue-400" />
                  </div>
                  <div>
                    <span className="text-sm font-bold">Current Iteration</span>
                    {iterationState?.currentIteration && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        #{iterationState.currentIteration.iterationNumber}
                      </span>
                    )}
                  </div>
                </div>
                {currentIterationStories.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {currentIterationStories.filter(t => getKanbanStatus(t.status) === 'done').length}/
                    {currentIterationStories.length} done
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-2">
              {currentIterationStories.length === 0 && !isIterating ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p className="text-lg font-medium">No iteration in progress</p>
                    <p className="text-sm mt-1">Send a request to start iterating</p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 h-full">
                  {KANBAN_COLUMNS.map((column) => {
                    const columnTasks = currentIterationStories.filter(
                      t => getKanbanStatus(t.status) === column.id
                    );
                    return (
                      <div key={column.id} className="flex flex-col h-full min-h-0">
                        <div
                          className={cn(
                            'text-xs font-semibold p-2 rounded-t-lg flex items-center justify-between bg-gradient-to-br border-b-0',
                            column.color,
                            column.border
                          )}
                        >
                          <span>{column.title}</span>
                          <Badge variant="outline" className={cn('text-[10px] h-4 px-1.5', column.border)}>
                            {columnTasks.length}
                          </Badge>
                        </div>
                        <div
                          className={cn(
                            'flex-1 border border-t-0 rounded-b-lg overflow-y-auto bg-muted/5',
                            column.border
                          )}
                        >
                          <div className="p-1.5 space-y-1.5">
                            {columnTasks.length === 0 ? (
                              <div className="text-[10px] text-muted-foreground text-center py-4 opacity-60">
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
              )}
            </CardContent>

            {/* Iteration Metrics Bar */}
            {currentMetrics && (currentMetrics.filesCreated > 0 || currentMetrics.linesOfCode > 0) && (
              <div className="border-t border-border/40 px-3 py-2 bg-blue-950/20 flex-shrink-0">
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-blue-400">
                    <FileCode className="h-3.5 w-3.5" />
                    <span>+{currentMetrics.filesCreated} files</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-purple-400">
                    <Code2 className="h-3.5 w-3.5" />
                    <span>+{currentMetrics.linesOfCode} LOC</span>
                  </div>
                  {currentMetrics.testsTotal > 0 && (
                    <div className="flex items-center gap-1.5 text-green-400">
                      <TestTube className="h-3.5 w-3.5" />
                      <span>+{currentMetrics.testsTotal} tests</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-amber-400 ml-auto">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDuration(currentMetrics.duration)}</span>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>

        {/* AI Controls Panel - 1 column */}
        <div className="col-span-1 flex flex-col min-h-0">
          <Card className="flex-1 flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg overflow-hidden">
            <CardHeader className="pb-2 border-b border-border/40 flex-shrink-0">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center">
                  <Bot className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <span className="text-sm font-bold">AI Controls</span>
                {isIterating && (
                  <Badge variant="outline" className="text-[10px] border-blue-500/50 text-blue-400 ml-auto animate-pulse">
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Working...
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Iterate Panel */}
              <div className="bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-5 w-5 rounded-md bg-blue-500/20 flex items-center justify-center">
                    <Edit3 className="h-3 w-3 text-blue-400" />
                  </div>
                  <span className="text-xs font-semibold text-blue-400">Iterate</span>
                </div>
                <p className="text-[10px] text-muted-foreground mb-2">
                  Describe changes or new features to add
                </p>
                <Textarea
                  value={userPrompt}
                  onChange={(e) => onUserPromptChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      onSendIteration(userPrompt);
                    }
                  }}
                  placeholder="Add dark mode support..."
                  className="min-h-[80px] max-h-[120px] text-sm resize-none bg-muted/50 border-border/50 placeholder:text-muted-foreground/50 rounded-lg"
                  disabled={isIterating}
                />
                <Button
                  size="sm"
                  onClick={() => onSendIteration(userPrompt)}
                  disabled={isIterating || !userPrompt.trim()}
                  className="w-full mt-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
                >
                  {isIterating ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {isIterating ? 'Working...' : 'Send Request'}
                </Button>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {['Improve styling', 'Add feature', 'Fix bug', 'Refactor'].map((suggestion) => (
                    <Button
                      key={suggestion}
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] text-muted-foreground hover:text-blue-400 hover:bg-blue-500/10 px-2 rounded-md"
                      onClick={() => onUserPromptChange(suggestion + ': ')}
                      disabled={isIterating}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>

              {/* This Iteration Stats */}
              {iterationState?.currentIteration && (
                <div className="bg-gradient-to-br from-slate-500/10 to-slate-600/5 border border-slate-500/20 rounded-xl p-3">
                  <div className="text-xs font-semibold text-slate-400 mb-2">This Iteration</div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Stories</span>
                      <span className="text-slate-300">{currentIterationStories.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Files Added</span>
                      <span className="text-blue-400">+{currentMetrics?.filesCreated || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Lines Added</span>
                      <span className="text-purple-400">+{currentMetrics?.linesOfCode || 0}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* View Summary Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={onSwitchToSummary}
                className="w-full text-xs"
              >
                View Build Summary
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Original Build Stories (Collapsed by Epic) */}
      {epicsWithOriginalStories.length > 0 && (
        <Card className="flex-shrink-0 bg-gradient-to-br from-slate-900/50 to-slate-800/30 border border-slate-700/50">
          <CardHeader className="py-2 px-3">
            <CardTitle className="text-xs font-semibold flex items-center gap-2 text-slate-400">
              <CheckCircle className="h-3.5 w-3.5" />
              Original Build ({originalStories.length} stories)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 pt-0">
            <div className="flex flex-wrap gap-2">
              {epicsWithOriginalStories.map((epic) => {
                const progress = getOriginalEpicProgress(epic.id);
                const isExpanded = expandedEpics.has(epic.id);
                const epicStories = getOriginalEpicStories(epic.id);

                return (
                  <div key={epic.id} className="relative">
                    <button
                      onClick={() => toggleEpic(epic.id)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors',
                        'bg-slate-800/50 border border-slate-700 hover:border-slate-600',
                        isExpanded && 'border-slate-500 bg-slate-700/50'
                      )}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3 w-3 text-slate-400" />
                      ) : (
                        <ChevronRight className="h-3 w-3 text-slate-400" />
                      )}
                      <CheckCircle className="h-3 w-3 text-emerald-500" />
                      <span className="text-slate-300 max-w-[150px] truncate">{epic.title}</span>
                      <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-600 text-slate-400">
                        {progress.completed}/{progress.total}
                      </Badge>
                    </button>

                    {/* Expanded stories dropdown */}
                    {isExpanded && (
                      <div className="absolute top-full left-0 mt-1 z-10 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[200px] max-h-[200px] overflow-y-auto">
                        <div className="p-2 space-y-1">
                          {epicStories.map((story) => (
                            <div
                              key={story.id}
                              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-700/50 cursor-pointer"
                              onClick={() => onSelectedStoryChange(story)}
                            >
                              {story.status === 'completed' || story.status === 'done' ? (
                                <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <Circle className="h-3 w-3 text-slate-500 flex-shrink-0" />
                              )}
                              <span className="text-xs text-slate-300 truncate">{story.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
