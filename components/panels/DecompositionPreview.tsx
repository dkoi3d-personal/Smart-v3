'use client';

/**
 * DecompositionPreview
 *
 * Visual preview of how requirements are decomposed into
 * domains, epics, and stories before launching the fleet.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  FileText,
  CheckCircle,
  Circle,
  AlertCircle,
  GitBranch,
  Clock,
  Zap
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface Domain {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  estimatedComplexity: 'low' | 'medium' | 'high' | 'very-high';
  priority: number;
}

interface Epic {
  id: string;
  domainId: string;
  title: string;
  description: string;
  phase: string;
  estimatedStoryCount: number;
}

interface Story {
  id: string;
  epicId: string;
  domainId: string;
  title: string;
  description: string;
  storyPoints: number;
  priority: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  phase: string;
  dependencies: string[];
}

interface DecompositionResult {
  domains: Domain[];
  epics: Epic[];
  stories: Story[];
  phases: {
    foundation: string[];
    core: string[];
    feature: string[];
    integration: string[];
    polish: string[];
  };
}

interface DecompositionPreviewProps {
  decomposition: DecompositionResult;
  onStorySelect?: (story: Story) => void;
}

// ============================================================================
// Component
// ============================================================================

export function DecompositionPreview({
  decomposition,
  onStorySelect
}: DecompositionPreviewProps) {
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set());
  const [expandedEpics, setExpandedEpics] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'domains' | 'phases'>('domains');

  // Group data
  const domainMap = useMemo(() => {
    const map = new Map<string, {
      domain: Domain;
      epics: Epic[];
      stories: Story[];
    }>();

    for (const domain of decomposition.domains) {
      map.set(domain.id, {
        domain,
        epics: decomposition.epics.filter(e => e.domainId === domain.id),
        stories: decomposition.stories.filter(s => s.domainId === domain.id)
      });
    }

    return map;
  }, [decomposition]);

  const phaseData = useMemo(() => {
    const phases = ['foundation', 'core', 'feature', 'integration', 'polish'] as const;
    return phases.map(phase => ({
      phase,
      stories: decomposition.stories.filter(s => s.phase === phase),
      count: decomposition.stories.filter(s => s.phase === phase).length
    }));
  }, [decomposition]);

  const toggleDomain = (domainId: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev);
      if (next.has(domainId)) {
        next.delete(domainId);
      } else {
        next.add(domainId);
      }
      return next;
    });
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

  const getComplexityColor = (complexity: string) => {
    switch (complexity) {
      case 'low': return 'bg-green-500/20 text-green-400';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400';
      case 'high': return 'bg-orange-500/20 text-orange-400';
      case 'very-high': return 'bg-red-500/20 text-red-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPhaseColor = (phase: string) => {
    switch (phase) {
      case 'foundation': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'core': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'feature': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'integration': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'polish': return 'bg-pink-500/20 text-pink-400 border-pink-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <Card className="bg-gray-800 border-gray-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white">Decomposition Preview</CardTitle>
            <CardDescription>
              {decomposition.domains.length} domains, {decomposition.epics.length} epics, {decomposition.stories.length} stories
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant={viewMode === 'domains' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('domains')}
            >
              <Layers className="h-4 w-4 mr-1" />
              Domains
            </Button>
            <Button
              variant={viewMode === 'phases' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('phases')}
            >
              <Clock className="h-4 w-4 mr-1" />
              Phases
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[600px] pr-4">
          {viewMode === 'domains' ? (
            <div className="space-y-4">
              {Array.from(domainMap.values()).map(({ domain, epics, stories }) => (
                <Collapsible
                  key={domain.id}
                  open={expandedDomains.has(domain.id)}
                  onOpenChange={() => toggleDomain(domain.id)}
                >
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between p-3 bg-gray-900 rounded-lg hover:bg-gray-900/80 transition-colors">
                      <div className="flex items-center gap-3">
                        {expandedDomains.has(domain.id) ? (
                          <ChevronDown className="h-4 w-4 text-gray-400" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                        <div className="text-left">
                          <p className="font-medium text-white">{domain.name}</p>
                          <p className="text-xs text-gray-400">{domain.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getComplexityColor(domain.estimatedComplexity)}>
                          {domain.estimatedComplexity}
                        </Badge>
                        <Badge variant="outline" className="text-gray-400">
                          {stories.length} stories
                        </Badge>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="mt-2 ml-6 space-y-2">
                    {epics.map(epic => (
                      <Collapsible
                        key={epic.id}
                        open={expandedEpics.has(epic.id)}
                        onOpenChange={() => toggleEpic(epic.id)}
                      >
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors">
                            <div className="flex items-center gap-2">
                              {expandedEpics.has(epic.id) ? (
                                <ChevronDown className="h-3 w-3 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-gray-500" />
                              )}
                              <FileText className="h-4 w-4 text-purple-400" />
                              <span className="text-sm text-white">{epic.title}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs ${getPhaseColor(epic.phase)}`}>
                                {epic.phase}
                              </Badge>
                              <span className="text-xs text-gray-500">
                                {stories.filter(s => s.epicId === epic.id).length} stories
                              </span>
                            </div>
                          </div>
                        </CollapsibleTrigger>

                        <CollapsibleContent className="mt-1 ml-6 space-y-1">
                          {stories
                            .filter(s => s.epicId === epic.id)
                            .map(story => (
                              <div
                                key={story.id}
                                className="flex items-center justify-between p-2 rounded hover:bg-gray-700/50 cursor-pointer transition-colors"
                                onClick={() => onStorySelect?.(story)}
                              >
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${getPriorityColor(story.priority)}`} />
                                  <span className="text-sm text-gray-300">{story.title}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-xs text-gray-500">
                                    {story.storyPoints} pts
                                  </Badge>
                                  {story.dependencies.length > 0 && (
                                    <GitBranch className="h-3 w-3 text-gray-500" />
                                  )}
                                </div>
                              </div>
                            ))}
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </div>
          ) : (
            <div className="space-y-6">
              {phaseData.map(({ phase, stories, count }) => (
                <div key={phase}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Badge className={getPhaseColor(phase)}>
                        {phase.toUpperCase()}
                      </Badge>
                      <span className="text-sm text-gray-400">{count} stories</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {Math.round((count / decomposition.stories.length) * 100)}% of total
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {stories.slice(0, 9).map(story => (
                      <div
                        key={story.id}
                        className="p-2 bg-gray-900 rounded-lg hover:bg-gray-900/80 cursor-pointer transition-colors"
                        onClick={() => onStorySelect?.(story)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <div className={`w-2 h-2 rounded-full ${getPriorityColor(story.priority)}`} />
                          <span className="text-xs font-medium text-white truncate">
                            {story.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>{story.type}</span>
                          <span>•</span>
                          <span>{story.storyPoints} pts</span>
                        </div>
                      </div>
                    ))}
                    {stories.length > 9 && (
                      <div className="p-2 bg-gray-900/50 rounded-lg flex items-center justify-center">
                        <span className="text-sm text-gray-400">
                          +{stories.length - 9} more stories
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default DecompositionPreview;
