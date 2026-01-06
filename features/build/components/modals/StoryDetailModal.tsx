'use client';

/**
 * StoryDetailModal - Modal for viewing story details and agent logs
 *
 * Displays:
 * - Story title, status, priority, and metadata
 * - Description and acceptance criteria
 * - Agent logs filtered by story ID
 * - Error details for failed stories
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Code2,
  CheckCircle,
  Circle,
  Loader2,
  Terminal,
  AlertCircle,
  X,
  Hash,
  Target,
  CheckSquare,
  FileText,
  TestTube,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Task, Epic, AgentMessage } from '@/features/build/types';

export interface StoryDetailModalProps {
  story: Task;
  onClose: () => void;
  agentMessages: AgentMessage[];
  epics: Epic[];
}

export const StoryDetailModal = React.memo(function StoryDetailModal({
  story,
  onClose,
  agentMessages,
  epics,
}: StoryDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'logs'>('details');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Find epic for this story
  const epic = epics.find((e) => e.id === story.epicId);

  // Filter messages for this story by storyId - only show logs tagged with this story's ID
  // FIXED: Only match messages with a defined storyId that matches this story's ID
  // Previously, if story.id was undefined, it would match all messages with storyId: undefined
  // This caused all agent messages (product_owner, coordinator, security) to appear in stories
  const storyLogs = agentMessages
    .filter((m) => m.storyId !== undefined && story.id !== undefined && m.storyId === story.id)
    .slice(-100);

  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [storyLogs.length, activeTab]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  // Status config for visual styling
  const statusConfig: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
    backlog: { color: 'text-slate-400', bg: 'bg-slate-500/10', icon: <Circle className="h-3.5 w-3.5" /> },
    pending: { color: 'text-slate-400', bg: 'bg-slate-500/10', icon: <Circle className="h-3.5 w-3.5" /> },
    in_progress: {
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    },
    testing: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: <TestTube className="h-3.5 w-3.5" /> },
    completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle className="h-3.5 w-3.5" /> },
    done: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: <CheckCircle className="h-3.5 w-3.5" /> },
    failed: { color: 'text-red-400', bg: 'bg-red-500/10', icon: <AlertCircle className="h-3.5 w-3.5" /> },
  };

  const status = statusConfig[story.status || 'backlog'] || statusConfig.backlog;
  const isActive = story.status === 'in_progress';

  // Message type styling
  const getMessageStyle = (type: string) => {
    switch (type) {
      case 'thinking':
        return { icon: '🤔', color: 'text-purple-400', label: 'Thinking' };
      case 'action':
        return { icon: '🔧', color: 'text-blue-400', label: 'Action' };
      case 'result':
        return { icon: '✅', color: 'text-emerald-400', label: 'Result' };
      case 'error':
        return { icon: '❌', color: 'text-red-400', label: 'Error' };
      case 'chat':
        return { icon: '💬', color: 'text-slate-400', label: 'Chat' };
      default:
        return { icon: '📝', color: 'text-slate-400', label: 'Message' };
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-md"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-gradient-to-b from-card to-card/95 border border-border/50 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 pr-14 border-b border-border/50 bg-gradient-to-r from-muted/50 to-transparent">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-muted/50 hover:bg-destructive/20 hover:text-destructive transition-all duration-200 group"
            aria-label="Close"
          >
            <X className="h-5 w-5 group-hover:scale-110 transition-transform" />
          </button>

          {/* Epic badge */}
          {epic && (
            <div className="flex items-center gap-2 mb-3">
              <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
              <span className="text-xs font-medium text-orange-400/80">{epic.title}</span>
            </div>
          )}

          {/* Title & Status */}
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold leading-tight">{story.title}</h2>
            <div className={cn('flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold shrink-0', status.bg, status.color)}>
              {status.icon}
              <span>{(story.status || 'backlog').replace('_', ' ').toUpperCase()}</span>
            </div>
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            {story.priority && (
              <Badge
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wide',
                  story.priority === 'high' && 'bg-red-500/20 text-red-400 border-red-500/30',
                  story.priority === 'medium' && 'bg-amber-500/20 text-amber-400 border-amber-500/30',
                  story.priority === 'low' && 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                )}
              >
                {story.priority}
              </Badge>
            )}
            {story.storyPoints && (
              <Badge variant="outline" className="text-[10px] font-medium">
                {story.storyPoints} pts
              </Badge>
            )}
            {story.assignedTo && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <div className={cn('h-2 w-2 rounded-full', isActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500')} />
                <Code2 className="h-3 w-3" />
                <span className="font-medium">{story.assignedTo}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Hash className="h-3 w-3" />
              <span>{story.id}</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'details' | 'logs')}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="mx-5 mt-4 grid w-fit grid-cols-2 bg-muted/50 p-1 rounded-lg">
            <TabsTrigger value="details" className="px-4 text-sm gap-2 data-[state=active]:bg-background">
              <FileText className="h-3.5 w-3.5" />
              Details
            </TabsTrigger>
            <TabsTrigger value="logs" className="px-4 text-sm gap-2 data-[state=active]:bg-background">
              <Terminal className="h-3.5 w-3.5" />
              Agent Logs
              {storyLogs.length > 0 && (
                <span
                  className={cn(
                    'ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {storyLogs.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-y-auto m-0 p-5 space-y-5">
            {/* Description */}
            {story.description && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Description
                </h3>
                <p className="text-sm leading-relaxed text-foreground/90 pl-6">{story.description}</p>
              </div>
            )}

            {/* Acceptance Criteria */}
            {story.acceptanceCriteria && story.acceptanceCriteria.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Acceptance Criteria
                  <span className="text-xs font-normal text-muted-foreground/60">({story.acceptanceCriteria.length})</span>
                </h3>
                <div className="space-y-2 pl-2">
                  {story.acceptanceCriteria.map((ac, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 bg-muted/30 rounded-xl border border-border/30 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-shrink-0 w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                        {idx + 1}
                      </div>
                      <p className="text-sm flex-1 text-foreground/80">{ac}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error info if failed */}
            {story.status === 'failed' && story.error && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Error Details
                </h3>
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <pre className="text-xs text-red-300 whitespace-pre-wrap font-mono">{story.error}</pre>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="flex-1 overflow-hidden m-0 flex flex-col">
            {storyLogs.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
                <Terminal className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">No agent logs yet</p>
                <p className="text-xs mt-1 opacity-60">
                  {story.status === 'backlog' || story.status === 'pending'
                    ? 'Logs will appear when work begins'
                    : 'No logs recorded for this story'}
                </p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-black/20">
                {storyLogs.map((msg, idx) => {
                  const style = getMessageStyle(msg.type);
                  // Agent role colors for visual distinction
                  const agentColors: Record<string, string> = {
                    coder: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
                    tester: 'text-green-400 bg-green-500/10 border-green-500/30',
                    product_owner: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
                    coordinator: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30',
                    security: 'text-red-400 bg-red-500/10 border-red-500/30',
                    fixer: 'text-orange-400 bg-orange-500/10 border-orange-500/30',
                  };
                  const agentStyle = agentColors[msg.agentRole] || 'text-gray-400 bg-gray-500/10 border-gray-500/30';
                  return (
                    <div
                      key={msg.id || idx}
                      className="flex items-start gap-3 p-3 bg-card/50 rounded-lg border border-border/20 hover:bg-card/80 transition-colors group"
                    >
                      <span className="text-base shrink-0">{style.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {/* Agent name - prominent for audit, show instance number if parallel agent */}
                          <span className={cn('text-xs font-bold px-2 py-0.5 rounded border', agentStyle)}>
                            {msg.instanceNumber
                              ? `${msg.agentName || msg.agentRole}-${msg.instanceNumber}`
                              : msg.agentName || msg.agentRole}
                          </span>
                          <span className={cn('text-xs font-semibold', style.color)}>{style.label}</span>
                          {msg.toolName && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                              {msg.toolName}
                            </Badge>
                          )}
                          {/* StoryId for debugging - shows which story this message is tagged with */}
                          <span className="text-[10px] text-muted-foreground/40 font-mono">[{msg.storyId || 'no-story'}]</span>
                          <span className="text-[10px] text-muted-foreground/50 ml-auto">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/80 whitespace-pre-wrap break-words font-mono leading-relaxed">
                          {msg.content.length > 500 ? msg.content.slice(0, 500) + '...' : msg.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* Live indicator */}
            {isActive && storyLogs.length > 0 && (
              <div className="p-3 border-t border-border/30 bg-muted/30 flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Live streaming agent activity...</span>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t border-border/30 bg-muted/20 flex items-center justify-between">
          <div className="text-xs text-muted-foreground/60">
            Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">ESC</kbd> to close
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-sm">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
});

export default StoryDetailModal;
