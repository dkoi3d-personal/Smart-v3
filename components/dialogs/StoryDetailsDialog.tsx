'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle2, User, Clock, Zap, FileText, Target, Layers, GitBranch } from 'lucide-react';
import type { Story } from '@/lib/agents/types';
import { cn } from '@/lib/utils';

interface StoryDetailsDialogProps {
  story: Story | null;
  epicTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  backlog: { label: 'Backlog', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  testing: { label: 'Testing', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
  done: { label: 'Done', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
};

const priorityConfig: Record<string, { label: string; color: string }> = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-400' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-400' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400' },
};

function formatDate(dateInput: string | Date) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function StoryDetailsDialog({ story, epicTitle, open, onOpenChange }: StoryDetailsDialogProps) {
  if (!story) return null;

  const status = statusConfig[story.status] || statusConfig.backlog;
  const priority = priorityConfig[story.priority] || priorityConfig.medium;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="space-y-2">
            {/* Epic label */}
            {epicTitle && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Layers className="h-3 w-3" />
                <span className="text-[10px] font-medium">{epicTitle}</span>
              </div>
            )}

            {/* Title */}
            <DialogTitle className="text-sm font-semibold leading-snug pr-6">
              {story.title}
            </DialogTitle>

            {/* Status & Priority badges */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge className={cn('text-[10px] font-medium px-1.5 py-0', status.color)}>
                {status.label}
              </Badge>
              <Badge className={cn('text-[10px] font-medium px-1.5 py-0', priority.color)}>
                {priority.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-medium px-1.5 py-0">
                <Zap className="h-2.5 w-2.5 mr-0.5" />
                {story.storyPoints} pts
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable content */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-5 py-4 space-y-4">
            {/* Description */}
            <section>
              <h3 className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                <FileText className="h-3 w-3 text-muted-foreground" />
                Description
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {story.description || 'No description provided'}
              </p>
            </section>

            {/* Acceptance Criteria */}
            <section>
              <h3 className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                <Target className="h-3 w-3 text-muted-foreground" />
                Acceptance Criteria
              </h3>
              {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 ? (
                <ul className="space-y-1.5">
                  {story.acceptanceCriteria.map((criterion, index) => (
                    <li key={index} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />
                      <span className="text-muted-foreground">{criterion}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground/60 italic">No acceptance criteria defined</p>
              )}
            </section>

            {/* Progress */}
            {story.progress > 0 && (
              <section>
                <div className="flex items-center justify-between mb-1.5">
                  <h3 className="text-xs font-medium text-foreground">Progress</h3>
                  <span className="text-xs font-medium text-foreground">{story.progress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      story.progress === 100 ? 'bg-green-500' : 'bg-primary'
                    )}
                    style={{ width: `${story.progress}%` }}
                  />
                </div>
              </section>
            )}

            {/* Meta info */}
            <section className="grid grid-cols-2 gap-3 pt-1">
              {/* Assigned agent */}
              {(story.workingAgent || story.assignedAgent) && (
                <div className="space-y-0.5">
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <User className="h-2.5 w-2.5" />
                    {story.workingAgent ? 'Working' : 'Assigned'}
                  </div>
                  <p className={cn(
                    'text-xs font-medium',
                    story.workingAgent && 'text-blue-600 dark:text-blue-400'
                  )}>
                    {story.workingAgent || story.assignedAgent}
                  </p>
                </div>
              )}

              {/* Created */}
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Created
                </div>
                <p className="text-xs">{formatDate(story.createdAt)}</p>
              </div>

              {/* Updated */}
              <div className="space-y-0.5">
                <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" />
                  Updated
                </div>
                <p className="text-xs">{formatDate(story.updatedAt)}</p>
              </div>
            </section>

            {/* Dependencies */}
            {story.dependencies && story.dependencies.length > 0 && (
              <section className="pt-2 border-t">
                <h3 className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3 text-muted-foreground" />
                  Dependencies
                </h3>
                <div className="flex flex-wrap gap-1">
                  {story.dependencies.map((depId) => (
                    <Badge key={depId} variant="outline" className="text-[10px] px-1.5 py-0">
                      {depId}
                    </Badge>
                  ))}
                </div>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
