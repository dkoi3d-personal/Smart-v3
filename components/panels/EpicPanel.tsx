'use client';

import { useProjectStore } from '@/stores/project-store';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Target, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { useState } from 'react';
import { Epic, Story, StoryStatus } from '@/lib/agents/types';
import { cn } from '@/lib/utils';

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-yellow-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-500';
  }
};

const getStatusIcon = (status: StoryStatus) => {
  switch (status) {
    case 'done': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'in_progress': return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />;
    case 'testing': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default: return <Target className="h-4 w-4 text-gray-400" />;
  }
};

const calculateEpicProgress = (epic: Epic, stories: Story[]): number => {
  const epicStories = stories.filter(s => s.epicId === epic.id);
  if (epicStories.length === 0) return 0;

  const totalProgress = epicStories.reduce((sum, story) => sum + story.progress, 0);
  return Math.round(totalProgress / epicStories.length);
};

const getEpicStatus = (epic: Epic, stories: Story[]): StoryStatus => {
  const epicStories = stories.filter(s => s.epicId === epic.id);
  if (epicStories.length === 0) return 'backlog';

  const allDone = epicStories.every(s => s.status === 'done');
  if (allDone) return 'done';

  const anyInProgress = epicStories.some(s => s.status === 'in_progress' || s.status === 'testing');
  if (anyInProgress) return 'in_progress';

  return 'backlog';
};

interface EpicCardProps {
  epic: Epic;
  stories: Story[];
}

const EpicCard = ({ epic, stories }: EpicCardProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const epicStories = stories.filter(s => s.epicId === epic.id);
  const progress = calculateEpicProgress(epic, stories);
  const status = getEpicStatus(epic, stories);

  // Calculate total story points from all stories in this epic
  const totalStoryPoints = epicStories.reduce((sum, story) => sum + (story.storyPoints || 0), 0);

  const statusLabels = {
    backlog: 'Not Started',
    in_progress: 'In Progress',
    testing: 'Testing',
    done: 'Complete'
  };

  return (
    <Card className="mb-4 border-2 border-border border-l-4 border-l-primary shadow-md">
      <CardHeader
        className="cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2 flex-1">
            <button className="mt-1">
              {isExpanded ? (
                <ChevronDown className="h-5 w-5 text-foreground" />
              ) : (
                <ChevronRight className="h-5 w-5 text-foreground" />
              )}
            </button>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <CardTitle className="text-lg text-foreground">{epic.title}</CardTitle>
                <Badge className={cn(getPriorityColor(epic.priority), "font-bold border-2")} variant="secondary">
                  {epic.priority}
                </Badge>
                <Badge variant="outline" className="gap-1 border-2 font-semibold">
                  {getStatusIcon(status)}
                  {statusLabels[status]}
                </Badge>
              </div>
              <CardDescription className="text-sm text-foreground/80">{epic.description}</CardDescription>
            </div>
          </div>

          <div className="text-right ml-4">
            <div className="text-sm font-bold text-foreground mb-1">
              {epicStories.filter(s => s.status === 'done').length} / {epicStories.length} stories
            </div>
            {totalStoryPoints > 0 && (
              <Badge variant="default" className="text-xs font-bold bg-primary/90 text-primary-foreground">
                {totalStoryPoints} pts
              </Badge>
            )}
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">Progress</span>
            <span className="text-sm font-bold text-foreground">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3 border-2 border-border" />
        </div>
      </CardHeader>

      {isExpanded && epicStories.length > 0 && (
        <CardContent className="pt-0">
          <div className="space-y-2">
            {epicStories.map(story => (
              <div
                key={story.id}
                className="flex items-center justify-between p-3 rounded-lg border-2 border-border bg-card hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  {getStatusIcon(story.status)}
                  <div className="flex-1">
                    <div className="font-semibold text-sm text-foreground">{story.title}</div>
                    {(story.workingAgent || story.assignedAgent) && (
                      <div className="text-xs mt-1 font-medium flex items-center gap-2">
                        {story.workingAgent ? (
                          <span className="text-blue-500 flex items-center gap-1">
                            <Clock className="h-3 w-3 animate-pulse" />
                            Working: {story.workingAgent}
                          </span>
                        ) : (
                          <span className="text-foreground/60">
                            Assigned: {story.assignedAgent}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Badge className={cn(getPriorityColor(story.priority), "font-bold border-2")} variant="secondary">
                    {story.priority}
                  </Badge>
                  <Badge variant="default" className="text-xs font-bold bg-primary/90 text-primary-foreground px-2.5 py-1">
                    {story.storyPoints} pts
                  </Badge>
                  {story.progress > 0 && story.status !== 'done' && (
                    <div className="w-24">
                      <Progress value={story.progress} className="h-2 border-2 border-border" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default function EpicPanel() {
  const { epics, stories } = useProjectStore();

  if (epics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No epics yet. Start a workflow to create epics.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Epics</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="default" className="font-bold">
              {epics.length} epic{epics.length !== 1 ? 's' : ''}
            </Badge>
            <Badge variant="secondary" className="font-semibold border-2">
              {stories.length} total stories
            </Badge>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {epics.map(epic => (
            <EpicCard key={epic.id} epic={epic} stories={stories} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
