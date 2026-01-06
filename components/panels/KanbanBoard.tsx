'use client';

import React, { useState, useEffect } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Kanban, Zap, User } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { cn } from '@/lib/utils';
import type { Story, Epic } from '@/lib/agents/types';
import { StoryDetailsDialog } from '@/components/dialogs/StoryDetailsDialog';

const columns = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300' },
  { id: 'testing', title: 'Testing', color: 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300' },
  { id: 'done', title: 'Done', color: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300' },
] as const;

const priorityColors: Record<string, string> = {
  low: 'border-l-gray-400',
  medium: 'border-l-blue-500',
  high: 'border-l-orange-500',
  critical: 'border-l-red-500',
};

function StoryCard({ story, onClick }: { story: Story; onClick?: () => void }) {
  const borderColor = priorityColors[story.priority] || 'border-l-gray-400';

  return (
    <div
      className={cn(
        'bg-card border border-border rounded p-1.5 cursor-pointer',
        'hover:shadow-sm hover:border-primary/30 transition-all',
        'border-l-2',
        borderColor
      )}
      onClick={onClick}
    >
      {/* Title */}
      <p className="text-[11px] font-medium line-clamp-2 text-foreground mb-1">{story.title}</p>

      {/* Progress bar */}
      {story.progress > 0 && story.progress < 100 && (
        <div className="h-0.5 bg-muted rounded-full overflow-hidden mb-1">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${story.progress}%` }}
          />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-muted-foreground text-[9px]">
        <div className="flex items-center gap-0.5">
          <Zap className="h-2 w-2" />
          <span>{story.storyPoints}pts</span>
        </div>
        {story.assignedAgent && (
          <div className="flex items-center gap-0.5 truncate max-w-[60px]">
            <User className="h-2 w-2 shrink-0" />
            <span className="truncate">{story.assignedAgent}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard() {
  const { project, epics, currentProjectId } = useProjectStore();
  const allStories = project?.stories || [];
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Filter epics to only show those belonging to the current project
  const projectEpics = currentProjectId
    ? epics.filter(epic => !epic.projectId || epic.projectId === currentProjectId)
    : epics;

  // Find the current epic being worked on (status === 'in_progress')
  // If no epic is in progress, show the first epic that's not done
  const currentEpic = projectEpics.find(epic => epic.status === 'in_progress')
    || projectEpics.find(epic => epic.status !== 'done');

  // Calculate epic completion tally (only for current project)
  const completedEpicsCount = projectEpics.filter(epic => epic.status === 'done').length;
  const totalEpicsCount = projectEpics.length;

  // Filter stories to only show those from the current epic AND current project
  const stories = currentEpic
    ? allStories.filter(story =>
        story.epicId === currentEpic.id &&
        (!story.projectId || !currentProjectId || story.projectId === currentProjectId)
      )
    : [];

  // Debug logging
  useEffect(() => {
    console.log('🎯 Kanban Board Update:', {
      currentProjectId,
      totalEpics: projectEpics.length,
      totalStories: allStories.length,
      currentEpic: currentEpic?.title,
      storiesInEpic: stories.length,
      storyStatuses: stories.map(s => ({ id: s.id, title: s.title, status: s.status, projectId: s.projectId }))
    });
  }, [currentProjectId, projectEpics.length, allStories.length, currentEpic?.id, stories.length]);

  // Create a map of epicId to epic for quick lookup (only for current project)
  const epicMap = new Map<string, Epic>();
  projectEpics.forEach(epic => epicMap.set(epic.id, epic));

  const handleStoryClick = (story: Story) => {
    setSelectedStory(story);
    setIsDialogOpen(true);
  };

  return (
    <>
      <CardHeader className="pb-1.5 space-y-1 px-2 pt-2">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          <Kanban className="h-3 w-3" />
          Kanban
          {totalEpicsCount > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground font-normal">
              {completedEpicsCount + 1}/{totalEpicsCount}
            </span>
          )}
        </CardTitle>
        {currentEpic ? (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="font-medium text-foreground truncate flex-1">{currentEpic.title}</span>
            <span className="shrink-0">{stories.length}</span>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">
            {totalEpicsCount === 0 ? 'No epics' : 'Done'}
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-2" style={{ minHeight: 0 }}>
        <div className="grid grid-cols-4 gap-2 h-full">
          {columns.map((column) => {
            const columnStories = stories.filter((s) => s.status === column.id);

            return (
              <div key={column.id} className="flex flex-col h-full min-h-0">
                {/* Column header */}
                <div className={cn('text-[10px] font-medium px-1.5 py-1 rounded-t-md border border-b-0 border-border flex items-center justify-between', column.color)}>
                  <span>{column.title}</span>
                  <span className="opacity-60">{columnStories.length}</span>
                </div>
                {/* Column content */}
                <div
                  className="flex-1 border border-border rounded-b-md bg-muted/10 overflow-y-auto"
                  style={{ maxHeight: 'calc(100vh - 350px)', minHeight: '200px' }}
                >
                  <div className="p-1.5 space-y-1.5">
                    {columnStories.length === 0 ? (
                      <div className="text-xs text-muted-foreground text-center py-6">
                        No stories
                      </div>
                    ) : (
                      columnStories.map((story) => (
                        <StoryCard
                          key={story.id}
                          story={story}
                          onClick={() => handleStoryClick(story)}
                        />
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <StoryDetailsDialog
        story={selectedStory}
        epicTitle={selectedStory ? epicMap.get(selectedStory.epicId)?.title : undefined}
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </>
  );
}
