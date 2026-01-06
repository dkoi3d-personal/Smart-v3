'use client';

import { useMemo, useState } from 'react';
import {
  FileCode,
  Code2,
  TestTube,
  Shield,
  Clock,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Edit3,
  TrendingUp,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { Task, Epic, IterationState, MetricsSnapshot } from '../types';
import { formatDuration } from '@/lib/format-utils';

interface BuildSummaryViewProps {
  tasks: Task[];
  epics: Epic[];
  iterationState: IterationState | null;
  testingMetrics: { passRate: number; totalTests: number; coverage?: number };
  securityMetrics: { grade: string; score: number } | null;
  buildMetrics: { elapsedTime: number; filesCreated: number; linesOfCode: number };
  onSwitchToIterate: () => void;
}

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subValue?: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

function MetricCard({ icon: Icon, label, value, subValue, colorClass, bgClass, borderClass }: MetricCardProps) {
  return (
    <div className={cn('rounded-xl border-2 p-3', borderClass, bgClass)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', colorClass)} />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      </div>
      <div className={cn('text-2xl font-black', colorClass)}>{value}</div>
      {subValue && <div className="text-xs text-muted-foreground">{subValue}</div>}
    </div>
  );
}

export function BuildSummaryView({
  tasks,
  epics,
  iterationState,
  testingMetrics,
  securityMetrics,
  buildMetrics,
  onSwitchToIterate,
}: BuildSummaryViewProps) {
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());

  // All tasks belong to current build (clean-slate architecture)
  const originalStories = useMemo(() => tasks, [tasks]);

  const completedStories = useMemo(() =>
    originalStories.filter(t => t.status === 'done' || t.status === 'completed'), [originalStories]
  );

  const totalStoryPoints = useMemo(() =>
    completedStories.reduce((sum, t) => sum + (t.storyPoints || 0), 0), [completedStories]
  );

  // With clean-slate architecture, iterationState is always null
  // Metrics come from the current build only
  const hasIterations = false;

  const toggleEpic = (epicId: string) => {
    const newExpanded = new Set(expandedEpics);
    if (expandedEpics.has(epicId)) {
      newExpanded.delete(epicId);
    } else {
      newExpanded.add(epicId);
    }
    setExpandedEpics(newExpanded);
  };

  const getEpicStories = (epicId: string) =>
    originalStories.filter(t => t.epicId === epicId);

  const getEpicProgress = (epicId: string) => {
    const stories = getEpicStories(epicId);
    const completed = stories.filter(t => t.status === 'done' || t.status === 'completed').length;
    return { completed, total: stories.length };
  };

  const getEpicPoints = (epicId: string) =>
    getEpicStories(epicId).reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  return (
    <div className="h-full flex flex-col gap-4 p-1">
      {/* Metrics Summary */}
      <Card className="bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg flex-shrink-0">
        <CardHeader className="pb-3 border-b border-border/40">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-base font-bold">Build Metrics</span>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {completedStories.length} stories completed across {epics.length} epics
                </div>
              </div>
            </div>
            <Button
              onClick={onSwitchToIterate}
              className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/20"
            >
              <Edit3 className="h-4 w-4 mr-2" />
              Iterate
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Main Metrics Row - Using current build metrics */}
          <div className="grid grid-cols-5 gap-3 mb-4">
            <MetricCard
              icon={FileCode}
              label="Files"
              value={buildMetrics.filesCreated}
              colorClass="text-blue-400"
              bgClass="bg-blue-950/30"
              borderClass="border-blue-700"
            />
            <MetricCard
              icon={Code2}
              label="Lines of Code"
              value={buildMetrics.linesOfCode.toLocaleString()}
              colorClass="text-purple-400"
              bgClass="bg-purple-950/30"
              borderClass="border-purple-700"
            />
            <MetricCard
              icon={TestTube}
              label="Tests"
              value={`${testingMetrics.passRate.toFixed(0)}%`}
              subValue={`${testingMetrics.totalTests} tests`}
              colorClass="text-green-400"
              bgClass="bg-green-950/30"
              borderClass="border-green-700"
            />
            <MetricCard
              icon={Shield}
              label="Security"
              value={securityMetrics?.grade ?? 'N/A'}
              subValue={securityMetrics ? `${securityMetrics.score}/100` : undefined}
              colorClass="text-red-400"
              bgClass="bg-red-950/30"
              borderClass="border-red-700"
            />
            <MetricCard
              icon={Clock}
              label="Duration"
              value={formatDuration(buildMetrics.elapsedTime)}
              colorClass="text-amber-400"
              bgClass="bg-amber-950/30"
              borderClass="border-amber-700"
            />
          </div>
        </CardContent>
      </Card>

      {/* Completed Stories by Epic */}
      <Card className="flex-1 flex flex-col bg-gradient-to-br from-background to-muted/20 border border-border/50 shadow-lg overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 flex-shrink-0">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <span className="text-base font-bold">Completed Stories</span>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {completedStories.length} stories | {totalStoryPoints} story points
                </div>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div className="p-3 space-y-2">
              {epics.map(epic => {
                const isExpanded = expandedEpics.has(epic.id);
                const progress = getEpicProgress(epic.id);
                const epicPoints = getEpicPoints(epic.id);
                const epicStories = getEpicStories(epic.id);
                const isComplete = progress.completed === progress.total && progress.total > 0;

                return (
                  <div
                    key={epic.id}
                    className={cn(
                      'border rounded-lg overflow-hidden transition-colors',
                      isComplete
                        ? 'border-emerald-500/30 bg-emerald-950/10'
                        : 'border-border/50 bg-muted/10'
                    )}
                  >
                    {/* Epic Header */}
                    <div
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => toggleEpic(epic.id)}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}

                      {isComplete && (
                        <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      )}

                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm truncate">{epic.title}</span>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-muted-foreground">
                          {progress.completed}/{progress.total} stories
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {epicPoints} pts
                        </Badge>
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              'h-full transition-all',
                              isComplete ? 'bg-emerald-500' : 'bg-blue-500'
                            )}
                            style={{
                              width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stories List */}
                    {isExpanded && epicStories.length > 0 && (
                      <div className="border-t border-border/30 bg-muted/20">
                        <div className="divide-y divide-border/20">
                          {epicStories.map(story => (
                            <div
                              key={story.id}
                              className="flex items-center gap-3 px-4 py-2 pl-10"
                            >
                              {story.status === 'completed' || story.status === 'done' ? (
                                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                              ) : (
                                <div className="h-3.5 w-3.5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                              )}
                              <span
                                className={cn(
                                  'text-sm flex-1 truncate',
                                  (story.status === 'completed' || story.status === 'done') && 'text-muted-foreground'
                                )}
                              >
                                {story.title}
                              </span>
                              {story.storyPoints && (
                                <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                                  {story.storyPoints} pts
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {epics.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">No epics yet</p>
                  <p className="text-sm mt-1">Complete a build to see your stories</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
