'use client';

import { useMemo, useState } from 'react';
import {
  History,
  Package,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Circle,
  Loader2,
  FileCode,
  Code2,
  TestTube,
  Clock,
  Shield,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Task, Epic, IterationState, IterationRecord } from '../../types';
import { formatDuration, getRelativeTime } from '@/lib/format-utils';

interface HistoryTabProps {
  tasks: Task[];
  epics: Epic[];
  iterationState: IterationState | null;
  onSelectedStoryChange: (story: Task | null) => void;
}

function MetricBadge({
  icon: Icon,
  value,
  label,
  colorClass,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className={cn('h-3.5 w-3.5', colorClass)} />
      <span className={cn('text-sm font-medium', colorClass)}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

interface IterationCardProps {
  iteration: IterationRecord;
  tasks: Task[];
  isExpanded: boolean;
  onToggle: () => void;
  onStoryClick: (story: Task) => void;
}

function IterationCard({ iteration, tasks, isExpanded, onToggle, onStoryClick }: IterationCardProps) {
  const iterationStories = useMemo(
    () => tasks.filter((t) => iteration.storiesCreated.includes(t.id)),
    [tasks, iteration.storiesCreated]
  );

  const completedStories = iterationStories.filter(
    (t) => t.status === 'done' || t.status === 'completed'
  ).length;

  const statusIcon =
    iteration.status === 'completed' ? (
      <CheckCircle className="h-4 w-4 text-emerald-500" />
    ) : iteration.status === 'failed' ? (
      <XCircle className="h-4 w-4 text-red-500" />
    ) : (
      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
    );

  const statusColor =
    iteration.status === 'completed'
      ? 'border-emerald-500/30 bg-emerald-950/10'
      : iteration.status === 'failed'
      ? 'border-red-500/30 bg-red-950/10'
      : 'border-blue-500/30 bg-blue-950/10';

  return (
    <div className={cn('border-2 rounded-xl overflow-hidden transition-colors', statusColor)}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-shrink-0 mt-0.5">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">
              Iteration #{iteration.iterationNumber}
            </Badge>
            <span className="text-xs text-muted-foreground" title={new Date(iteration.startTime).toLocaleString()}>
              {getRelativeTime(iteration.startTime)}
            </span>
          </div>
          <p className="text-sm font-medium text-foreground line-clamp-2">"{iteration.prompt}"</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <div className="text-xs text-muted-foreground mb-1">
            {completedStories}/{iterationStories.length} stories
          </div>
          <div className="text-xs text-muted-foreground">
            {iteration.endTime ? formatDuration(iteration.metricsAdded.duration) : 'In progress...'}
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border/30">
          {/* Metrics */}
          <div className="px-4 py-3 bg-muted/10 flex flex-wrap gap-4">
            <MetricBadge
              icon={FileCode}
              value={`+${iteration.metricsAdded.filesCreated}`}
              label="files"
              colorClass="text-blue-400"
            />
            <MetricBadge
              icon={Code2}
              value={`+${iteration.metricsAdded.linesOfCode}`}
              label="LOC"
              colorClass="text-purple-400"
            />
            {iteration.metricsAdded.testsTotal > 0 && (
              <MetricBadge
                icon={TestTube}
                value={`+${iteration.metricsAdded.testsTotal}`}
                label="tests"
                colorClass="text-green-400"
              />
            )}
            <MetricBadge
              icon={Clock}
              value={formatDuration(iteration.metricsAdded.duration)}
              label=""
              colorClass="text-amber-400"
            />
          </div>

          {/* Stories */}
          {iterationStories.length > 0 && (
            <div className="px-4 py-3 space-y-1">
              {iterationStories.map((story) => (
                <div
                  key={story.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={(e) => {
                    e.stopPropagation();
                    onStoryClick(story);
                  }}
                >
                  {story.status === 'completed' || story.status === 'done' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  ) : story.status === 'in_progress' ? (
                    <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin flex-shrink-0" />
                  ) : story.status === 'failed' ? (
                    <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className="text-sm flex-1 truncate">{story.title}</span>
                  {story.storyPoints && (
                    <Badge variant="outline" className="text-[10px] h-5 px-1.5">
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
}

export function HistoryTab({ tasks, epics, iterationState, onSelectedStoryChange }: HistoryTabProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['original']));

  const toggleItem = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (expandedItems.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  // All tasks belong to current build (clean-slate architecture)
  const originalStories = useMemo(() => tasks, [tasks]);

  const originalCompletedStories = originalStories.filter(
    (t) => t.status === 'done' || t.status === 'completed'
  ).length;

  // With clean-slate architecture, iterationState is always null
  // Build history is now read from .build-history/ folder via HistorySidebar
  const hasIterations = false;

  if (!iterationState) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <History className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No History Yet</p>
          <p className="text-sm mt-1">Complete a build to see iteration history</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center">
            <History className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Iteration History</h2>
            <p className="text-xs text-muted-foreground">
              Original build + {iterationState.iterations.length} iteration
              {iterationState.iterations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <ScrollArea className="flex-1">
        <div className="space-y-4 pr-4">
          {/* Original Build */}
          <div
            className={cn(
              'border-2 rounded-xl overflow-hidden transition-colors',
              'border-slate-500/30 bg-slate-950/20'
            )}
          >
            <div
              className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
              onClick={() => toggleItem('original')}
            >
              <div className="flex-shrink-0 mt-0.5">
                {expandedItems.has('original') ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>

              <div className="flex-shrink-0 mt-0.5">
                <Package className="h-4 w-4 text-slate-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-xs bg-slate-500/20 text-slate-300 border-slate-500/30">
                    Original Build
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(iterationState.originalBuildCompletedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-sm font-medium text-slate-300">Initial project build</p>
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="text-xs text-muted-foreground mb-1">
                  {originalCompletedStories}/{originalStories.length} stories
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDuration(iterationState.originalBuildMetrics.duration)}
                </div>
              </div>
            </div>

            {expandedItems.has('original') && (
              <div className="border-t border-border/30">
                {/* Metrics */}
                <div className="px-4 py-3 bg-muted/10 flex flex-wrap gap-4">
                  <MetricBadge
                    icon={FileCode}
                    value={iterationState.originalBuildMetrics.filesCreated}
                    label="files"
                    colorClass="text-blue-400"
                  />
                  <MetricBadge
                    icon={Code2}
                    value={iterationState.originalBuildMetrics.linesOfCode.toLocaleString()}
                    label="LOC"
                    colorClass="text-purple-400"
                  />
                  <MetricBadge
                    icon={TestTube}
                    value={`${iterationState.originalBuildMetrics.testsPassed}/${iterationState.originalBuildMetrics.testsTotal}`}
                    label="tests"
                    colorClass="text-green-400"
                  />
                  {iterationState.originalBuildMetrics.securityGrade && (
                    <MetricBadge
                      icon={Shield}
                      value={iterationState.originalBuildMetrics.securityGrade}
                      label="security"
                      colorClass="text-red-400"
                    />
                  )}
                  <MetricBadge
                    icon={Clock}
                    value={formatDuration(iterationState.originalBuildMetrics.duration)}
                    label=""
                    colorClass="text-amber-400"
                  />
                </div>

                {/* Epics summary */}
                <div className="px-4 py-3">
                  <div className="text-xs text-muted-foreground mb-2">
                    {epics.length} Epics, {originalStories.length} Stories
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {epics.slice(0, 6).map((epic) => {
                      const epicStories = originalStories.filter((t) => t.epicId === epic.id);
                      const completed = epicStories.filter(
                        (t) => t.status === 'done' || t.status === 'completed'
                      ).length;
                      return (
                        <div
                          key={epic.id}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-slate-800/50 border border-slate-700"
                        >
                          <CheckCircle className="h-3 w-3 text-emerald-500" />
                          <span className="text-xs text-slate-300 max-w-[100px] truncate">
                            {epic.title}
                          </span>
                          <Badge variant="outline" className="text-[9px] h-4 px-1 border-slate-600">
                            {completed}/{epicStories.length}
                          </Badge>
                        </div>
                      );
                    })}
                    {epics.length > 6 && (
                      <span className="text-xs text-muted-foreground self-center">
                        +{epics.length - 6} more
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Iterations */}
          {iterationState.iterations.map((iteration) => (
            <IterationCard
              key={iteration.id}
              iteration={iteration}
              tasks={tasks}
              isExpanded={expandedItems.has(iteration.id)}
              onToggle={() => toggleItem(iteration.id)}
              onStoryClick={onSelectedStoryChange}
            />
          ))}

          {/* Current Iteration (if in progress) */}
          {iterationState.currentIteration && (
            <IterationCard
              iteration={iterationState.currentIteration}
              tasks={tasks}
              isExpanded={expandedItems.has(iterationState.currentIteration.id)}
              onToggle={() => toggleItem(iterationState.currentIteration!.id)}
              onStoryClick={onSelectedStoryChange}
            />
          )}
        </div>
      </ScrollArea>

      {/* Note: With clean-slate architecture, build history is now shown in HistorySidebar */}
      {/* This component only shows "No History Yet" since iterationState is always null */}
    </div>
  );
}
