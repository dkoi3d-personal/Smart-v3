'use client';

import { useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentMessage, AgentRole } from '../../types';
import { AGENT_COLORS, AGENT_BG_COLORS, AGENT_ICONS } from '../../constants';

interface AgentChatPanelProps {
  messages: AgentMessage[];
  className?: string;
  maxHeight?: string;
}

export function AgentChatPanel({
  messages,
  className,
  maxHeight = 'h-[400px]',
}: AgentChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className={cn('flex items-center justify-center text-muted-foreground', maxHeight, className)}>
        <p>No agent messages yet. Start a build to see agent activity.</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn(maxHeight, className)} ref={scrollRef}>
      <div className="space-y-2 p-4">
        {messages.map((message) => (
          <AgentMessageItem key={message.id} message={message} />
        ))}
      </div>
    </ScrollArea>
  );
}

interface AgentMessageItemProps {
  message: AgentMessage;
}

function AgentMessageItem({ message }: AgentMessageItemProps) {
  const Icon = AGENT_ICONS[message.agentRole as AgentRole];
  const textColor = AGENT_COLORS[message.agentRole as AgentRole] || 'text-gray-500';
  const bgColor = AGENT_BG_COLORS[message.agentRole as AgentRole] || 'bg-gray-500/10';

  const getMessageTypeStyle = (type: AgentMessage['type']) => {
    switch (type) {
      case 'thinking':
        return 'border-l-2 border-yellow-500/50 bg-yellow-500/5';
      case 'action':
        return 'border-l-2 border-blue-500/50 bg-blue-500/5';
      case 'result':
        return 'border-l-2 border-green-500/50 bg-green-500/5';
      case 'error':
        return 'border-l-2 border-red-500/50 bg-red-500/5';
      case 'chat':
      default:
        return 'border-l-2 border-gray-500/50';
    }
  };

  const agentDisplayName = message.instanceNumber
    ? `${message.agentName} ${message.instanceNumber}`
    : message.agentName;

  return (
    <div className={cn('rounded-lg p-3', getMessageTypeStyle(message.type))}>
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('p-1 rounded', bgColor)}>
          {Icon && <Icon className={cn('h-3 w-3', textColor)} />}
        </div>
        <span className={cn('font-medium text-sm', textColor)}>{agentDisplayName}</span>
        {message.toolName && (
          <Badge variant="outline" className="text-xs">
            {message.toolName}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(message.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div className="text-sm whitespace-pre-wrap pl-6">{message.content}</div>
    </div>
  );
}
