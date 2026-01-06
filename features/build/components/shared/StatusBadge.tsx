'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TaskStatus, BuildPhase } from '../../types';

interface TaskStatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

const TASK_STATUS_STYLES: Record<TaskStatus, string> = {
  backlog: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  pending: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  in_progress: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  testing: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  done: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: 'Backlog',
  pending: 'Pending',
  in_progress: 'In Progress',
  testing: 'Testing',
  completed: 'Completed',
  done: 'Done',
  failed: 'Failed',
};

export function TaskStatusBadge({ status, className }: TaskStatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium border',
        TASK_STATUS_STYLES[status],
        className
      )}
    >
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

interface BuildPhaseBadgeProps {
  phase: BuildPhase;
  className?: string;
}

const BUILD_PHASE_STYLES: Record<BuildPhase, string> = {
  loading: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  planned: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  building: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  completed: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  error: 'bg-red-500/20 text-red-300 border-red-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  stopped: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
};

const BUILD_PHASE_LABELS: Record<BuildPhase, string> = {
  loading: 'Loading',
  planned: 'Planned',
  building: 'Building',
  completed: 'Completed',
  error: 'Error',
  paused: 'Paused',
  stopped: 'Stopped',
};

export function BuildPhaseBadge({ phase, className }: BuildPhaseBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium border',
        BUILD_PHASE_STYLES[phase],
        className
      )}
    >
      {BUILD_PHASE_LABELS[phase]}
    </Badge>
  );
}

interface PriorityBadgeProps {
  priority: 'low' | 'medium' | 'high';
  className?: string;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  high: 'bg-red-500/20 text-red-300 border-red-500/30',
};

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-xs font-medium border capitalize',
        PRIORITY_STYLES[priority],
        className
      )}
    >
      {priority}
    </Badge>
  );
}
