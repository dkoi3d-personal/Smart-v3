'use client';

import { Loader2 } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AGENT_ICONS, AGENT_COLORS } from '../../constants';
import type { AgentRole } from '../../types';

interface IndividualAgentStatus {
  id: string;
  status: string;
}

interface AgentStatusIndicatorProps {
  role: AgentRole;
  status: string | undefined;
  parallelCoders?: number;
  individualCoders?: IndividualAgentStatus[];
  parallelTesters?: number;
  individualTesters?: IndividualAgentStatus[];
}

export function AgentStatusIndicator({
  role,
  status,
  parallelCoders = 1,
  individualCoders = [],
  parallelTesters = 1,
  individualTesters = [],
}: AgentStatusIndicatorProps) {
  const Icon = AGENT_ICONS[role];
  const colorClass = AGENT_COLORS[role];
  const isWorking = status === 'working';
  const activeCoders = individualCoders.filter(c => c.status === 'working');
  const activeTesters = individualTesters.filter(t => t.status === 'working');
  const hasMultipleCoders = individualCoders.length > 0;
  const hasMultipleTesters = individualTesters.length > 0;

  const indicator = (
    <div
      className={cn(
        'flex items-center gap-1 px-2 py-1 rounded text-xs border cursor-default',
        isWorking ? 'bg-muted border-primary/30' : 'border-transparent opacity-50'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5', colorClass, isWorking && 'animate-pulse')} />
      <span className="capitalize hidden sm:inline">
        {role === 'coder' && activeCoders.length > 0
          ? `coder (${activeCoders.length})`
          : role === 'tester' && activeTesters.length > 0
          ? `tester (${activeTesters.length})`
          : role}
      </span>
      {isWorking && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
    </div>
  );

  // For coder with multiple instances, wrap with detailed tooltip
  if (role === 'coder' && (hasMultipleCoders || parallelCoders > 1)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-2">
          <div className="text-xs space-y-1">
            <div className="font-semibold mb-1">Coder Agents ({parallelCoders} configured)</div>
            {individualCoders.length > 0 ? (
              individualCoders.map(({ id, status: coderStatus }) => (
                <div key={id} className="flex items-center gap-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    coderStatus === 'working' ? 'bg-green-500 animate-pulse' :
                    coderStatus === 'completed' || coderStatus === 'done' ? 'bg-blue-500' : 'bg-gray-400'
                  )} />
                  <span>{id}</span>
                  <span className="text-muted-foreground">({coderStatus || 'idle'})</span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">
                {parallelCoders > 1
                  ? 'Waiting for foundation story to complete...'
                  : 'Single coder mode'}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // For tester with multiple instances, wrap with detailed tooltip
  if (role === 'tester' && (hasMultipleTesters || parallelTesters > 1)) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {indicator}
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-2">
          <div className="text-xs space-y-1">
            <div className="font-semibold mb-1">Tester Agents ({parallelTesters} configured)</div>
            {individualTesters.length > 0 ? (
              individualTesters.map(({ id, status: testerStatus }) => (
                <div key={id} className="flex items-center gap-2">
                  <span className={cn(
                    'w-2 h-2 rounded-full',
                    testerStatus === 'working' ? 'bg-green-500 animate-pulse' :
                    testerStatus === 'completed' || testerStatus === 'done' ? 'bg-blue-500' : 'bg-gray-400'
                  )} />
                  <span>{id}</span>
                  <span className="text-muted-foreground">({testerStatus || 'idle'})</span>
                </div>
              ))
            ) : (
              <div className="text-muted-foreground">
                {parallelTesters > 1
                  ? 'Waiting for stories to enter testing...'
                  : 'Single tester mode'}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {indicator}
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <span className="capitalize">{role}</span>: {status || 'idle'}
      </TooltipContent>
    </Tooltip>
  );
}

interface AgentStatusBarProps {
  agentStatuses: Map<string, string>;
  parallelCoders?: number;
  parallelTesters?: number;
  roles?: readonly AgentRole[];
}

export function AgentStatusBar({
  agentStatuses,
  parallelCoders = 1,
  parallelTesters = 1,
  roles = ['product_owner', 'coder', 'tester', 'security'] as const,
}: AgentStatusBarProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {roles.map(role => {
          const status = agentStatuses.get(role);
          const individualCoders = role === 'coder'
            ? Array.from(agentStatuses.entries())
                .filter(([key]) => key.startsWith('coder-'))
                .map(([id, st]) => ({ id, status: st }))
            : [];
          const individualTesters = role === 'tester'
            ? Array.from(agentStatuses.entries())
                .filter(([key]) => key.startsWith('tester-'))
                .map(([id, st]) => ({ id, status: st }))
            : [];

          return (
            <AgentStatusIndicator
              key={role}
              role={role}
              status={status}
              parallelCoders={parallelCoders}
              individualCoders={individualCoders}
              parallelTesters={parallelTesters}
              individualTesters={individualTesters}
            />
          );
        })}
      </div>
    </TooltipProvider>
  );
}
