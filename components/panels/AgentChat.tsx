'use client';

import { useState, useEffect, useRef } from 'react';
import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MessageSquare, Bot, X, Activity, CheckCircle2, Loader2, ArrowUp } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { useAgentStore } from '@/stores/agent-store';
import { formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function AgentChat() {
  const { project } = useProjectStore();
  const { agents } = useAgentStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);

  const messages = project?.messages || [];
  const agentsArray = Array.from(agents.values());

  // Get active agents
  const activeAgents = agentsArray.filter(a => a.status === 'working' || a.status === 'thinking');
  const completedAgents = agentsArray.filter(a => a.status === 'completed');

  // Get current phase
  const getCurrentPhase = () => {
    if (!project) return 'Idle';
    if (project.status === 'planning') return 'Planning';
    if (project.status === 'developing') return 'Development';
    if (project.status === 'testing') return 'Testing';
    if (project.status === 'deploying') return 'Deployment';
    if (project.status === 'completed') return 'Completed';
    return 'Idle';
  };

  // Filter messages by selected agent and sort newest first
  const filteredMessages = selectedAgent
    ? messages.filter((msg: any) => msg.agentType === selectedAgent).reverse()
    : [...messages].reverse();

  // Check if user is near top of scroll
  const checkScrollPosition = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        const { scrollTop } = scrollContainer;
        const nearTop = scrollTop < 100; // Within 100px of top
        setIsNearBottom(nearTop);
        setShowScrollButton(!nearTop && filteredMessages.length > 3);
      }
    }
  };

  // Scroll to top function
  const scrollToBottom = () => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
        setShowScrollButton(false);
      }
    }
  };

  // Add scroll listener
  useEffect(() => {
    const scrollContainer = scrollAreaRef.current?.querySelector('[data-radix-scroll-area-viewport]');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollPosition);
      return () => scrollContainer.removeEventListener('scroll', checkScrollPosition);
    }
  }, [filteredMessages.length]);

  // Auto-scroll to top only if user is already near top
  useEffect(() => {
    if (isNearBottom) {
      scrollToBottom();
    }
  }, [filteredMessages.length]);

  return (
    <>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Agent Chat
          {messages.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {messages.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-3 min-h-0">
        {/* Summary Status */}
        <div className="p-3 bg-muted rounded-lg border border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Current Phase: {getCurrentPhase()}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {project?.progress || 0}% Complete
            </Badge>
          </div>

          {activeAgents.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>
                {activeAgents.map(a => a.name).join(', ')} {activeAgents.length === 1 ? 'is' : 'are'} working...
              </span>
            </div>
          )}

          {activeAgents.length === 0 && completedAgents.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-3 w-3" />
              <span>
                {completedAgents.length} agent{completedAgents.length !== 1 ? 's' : ''} completed
              </span>
            </div>
          )}
        </div>

        {/* Active Agents Filter */}
        <div className="flex flex-wrap gap-1 flex-shrink-0">
          {selectedAgent && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedAgent(null)}
              className="h-6 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Show All ({messages.length})
            </Button>
          )}
          {agentsArray.map((agent) => {
            const agentType = agent.type;
            const isSelected = selectedAgent === agentType;
            const isActive = agent.status === 'working' || agent.status === 'thinking';
            const agentMessageCount = messages.filter((m: any) => m.agentType === agentType).length;

            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(isSelected ? null : agentType)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors cursor-pointer",
                  "hover:bg-primary/80 focus:outline-none focus:ring-2 focus:ring-ring",
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : isActive
                    ? "bg-blue-600 text-white"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {isActive && <Loader2 className="h-3 w-3 animate-spin" />}
                {!isActive && <Bot className="h-3 w-3" />}
                <span>{agent.name}</span>
                {agentMessageCount > 0 && (
                  <Badge variant="outline" className="h-4 px-1 text-[10px] font-bold border-current">
                    {agentMessageCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Messages with Smart Auto-scroll */}
        <div className="flex-1 relative min-h-0">
          <ScrollArea className="h-full border border-border rounded-md" ref={scrollAreaRef}>
            <div className="space-y-3 p-3">
              {filteredMessages.length === 0 ? (
                <div className="text-xs text-muted-foreground text-center py-4">
                  {selectedAgent ? `No messages from ${selectedAgent} yet` : 'No messages yet'}
                </div>
              ) : (
                filteredMessages.map((msg: any, index: number) => {
                // Format agent name with instance number for parallel agents
                const baseAgentName = msg.agentType
                  ? msg.agentType.split('_').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  : msg.agentId.split('-')[0];

                // Add instance number if present (e.g., "Coder 1", "Tester 2")
                const agentName = msg.instanceNumber
                  ? `${baseAgentName} ${msg.instanceNumber}`
                  : baseAgentName;

                // Get agent color
                const getAgentColor = (type: string) => {
                  const colors: Record<string, string> = {
                    supervisor: 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700 text-purple-900 dark:text-purple-100',
                    research: 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700 text-cyan-900 dark:text-cyan-100',
                    product_owner: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-100',
                    coder: 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700 text-green-900 dark:text-green-100',
                    tester: 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700 text-yellow-900 dark:text-yellow-100',
                    security: 'bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700 text-red-900 dark:text-red-100',
                    infrastructure: 'bg-indigo-100 dark:bg-indigo-900/30 border-indigo-300 dark:border-indigo-700 text-indigo-900 dark:text-indigo-100',
                  };
                  return colors[type] || 'bg-slate-100 dark:bg-slate-900/30 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100';
                };

                return (
                  <div
                    key={`${msg.id}-${index}`}
                    className={cn(
                      "rounded-lg p-3 border shadow-sm hover:shadow-md transition-all",
                      getAgentColor(msg.agentType)
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 flex-shrink-0" />
                        <span className="font-semibold text-sm">{agentName}</span>
                      </div>
                      <span className="text-xs opacity-70">
                        {formatDate(msg.timestamp)}
                      </span>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                      {msg.content}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Scroll to Top Button */}
          {showScrollButton && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute top-4 right-4 h-8 w-8 p-0 rounded-full shadow-lg border-2 border-border z-10"
              onClick={scrollToBottom}
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </>
  );
}
