'use client';

import { FileCode, Clock, Terminal, Zap, Hash, Code2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BuildMetrics } from '../../types';

interface MetricsPanelProps {
  metrics: BuildMetrics;
  className?: string;
}

export function MetricsPanel({ metrics, className }: MetricsPanelProps) {
  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const items = [
    {
      label: 'Files Created',
      value: metrics.filesCreated,
      icon: FileCode,
      color: 'text-green-500',
    },
    {
      label: 'Files Modified',
      value: metrics.filesModified,
      icon: Code2,
      color: 'text-blue-500',
    },
    {
      label: 'Commands Run',
      value: metrics.commandsRun,
      icon: Terminal,
      color: 'text-amber-500',
    },
    {
      label: 'Tool Calls',
      value: metrics.toolCalls,
      icon: Zap,
      color: 'text-purple-500',
    },
    {
      label: 'Lines of Code',
      value: metrics.linesOfCode.toLocaleString(),
      icon: Hash,
      color: 'text-cyan-500',
    },
    {
      label: 'Elapsed Time',
      value: formatTime(Math.floor(metrics.elapsedTime / 1000)),
      icon: Clock,
      color: 'text-orange-500',
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Build Metrics</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-semibold">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
