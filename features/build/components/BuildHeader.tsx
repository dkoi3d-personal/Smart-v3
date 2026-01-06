'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  Home,
  Play,
  Pause,
  Square,
  RefreshCw,
  Loader2,
  CheckCircle,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { BuildPhase } from '../types';

interface BuildHeaderProps {
  projectName: string;
  projectId: string;
  phase: BuildPhase;
  isStreaming: boolean;
  deploymentUrl: string | null;
  onStartBuild: () => void;
  onPauseBuild: () => void;
  onStopBuild: () => void;
  onResumeBuild?: () => void;
}

const PHASE_CONFIG: Record<BuildPhase, { label: string; color: string; icon: React.ReactNode }> = {
  loading: {
    label: 'Loading',
    color: 'bg-gray-500',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  planned: {
    label: 'Ready',
    color: 'bg-blue-500',
    icon: <Clock className="h-3 w-3" />,
  },
  building: {
    label: 'Building',
    color: 'bg-amber-500',
    icon: <Loader2 className="h-3 w-3 animate-spin" />,
  },
  completed: {
    label: 'Completed',
    color: 'bg-green-500',
    icon: <CheckCircle className="h-3 w-3" />,
  },
  error: {
    label: 'Error',
    color: 'bg-red-500',
    icon: <AlertCircle className="h-3 w-3" />,
  },
  paused: {
    label: 'Paused',
    color: 'bg-yellow-500',
    icon: <Pause className="h-3 w-3" />,
  },
  stopped: {
    label: 'Stopped',
    color: 'bg-gray-500',
    icon: <Square className="h-3 w-3" />,
  },
};

export function BuildHeader({
  projectName,
  projectId,
  phase,
  isStreaming,
  deploymentUrl,
  onStartBuild,
  onPauseBuild,
  onStopBuild,
  onResumeBuild,
}: BuildHeaderProps) {
  const phaseConfig = PHASE_CONFIG[phase];

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-between px-4 py-2">
        {/* Left: Navigation & Project Name */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/">
                <Home className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link href="/projects">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="border-l pl-3">
            <h1 className="text-lg font-semibold">{projectName}</h1>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-mono">{projectId}</span>
              <Badge variant="outline" className={`${phaseConfig.color} text-white text-xs px-1.5`}>
                <span className="mr-1">{phaseConfig.icon}</span>
                {phaseConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Right: Build Controls */}
        <div className="flex items-center gap-2">
          {deploymentUrl && (
            <Button variant="outline" size="sm" asChild>
              <a href={deploymentUrl} target="_blank" rel="noopener noreferrer">
                View Deployment
              </a>
            </Button>
          )}

          {phase === 'planned' && (
            <Button onClick={onStartBuild} size="sm">
              <Play className="h-4 w-4 mr-1" />
              Start Build
            </Button>
          )}

          {phase === 'building' && isStreaming && (
            <>
              <Button variant="outline" size="sm" onClick={onPauseBuild}>
                <Pause className="h-4 w-4 mr-1" />
                Pause
              </Button>
              <Button variant="destructive" size="sm" onClick={onStopBuild}>
                <Square className="h-4 w-4 mr-1" />
                Stop
              </Button>
            </>
          )}

          {phase === 'paused' && onResumeBuild && (
            <Button onClick={onResumeBuild} size="sm">
              <Play className="h-4 w-4 mr-1" />
              Resume
            </Button>
          )}

          {(phase === 'completed' || phase === 'error' || phase === 'stopped') && (
            <Button onClick={onStartBuild} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-1" />
              Rebuild
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
