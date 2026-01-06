'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  Check,
  Loader2,
  Circle,
  AlertCircle,
  FileCode,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Play,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import type { BuildProgress, BuildPhase } from '../types';

interface BuildProgressCardProps {
  progress: BuildProgress | null;
  logs: string[];
  onLaunchPreview?: () => void;
  onOpenInEditor?: () => void;
  onRetry?: () => void;
  previewUrl?: string | null;
  previewLoading?: boolean;
}

interface PhaseConfig {
  id: BuildPhase;
  label: string;
  activeLabel: string;
}

const PHASES: PhaseConfig[] = [
  { id: 'planning', label: 'Planning', activeLabel: 'Analyzing requirements...' },
  { id: 'creating', label: 'Creating', activeLabel: 'Generating files...' },
  { id: 'epic-setup', label: 'Epic Setup', activeLabel: 'Configuring Epic APIs...' },
  { id: 'installing', label: 'Installing', activeLabel: 'Installing dependencies...' },
  { id: 'building', label: 'Building', activeLabel: 'Building application...' },
  { id: 'complete', label: 'Complete', activeLabel: 'Build complete!' },
];

function getPhaseIndex(phase: BuildPhase): number {
  const index = PHASES.findIndex(p => p.id === phase);
  return index >= 0 ? index : 0;
}

export function BuildProgressCard({
  progress,
  logs,
  onLaunchPreview,
  onOpenInEditor,
  onRetry,
  previewUrl,
  previewLoading,
}: BuildProgressCardProps) {
  const currentPhaseIndex = progress ? getPhaseIndex(progress.phase) : 0;
  const isError = progress?.phase === 'error';
  const isComplete = progress?.phase === 'complete';
  const progressPercent = isComplete ? 100 : Math.round((currentPhaseIndex / (PHASES.length - 1)) * 100);

  // Get files created
  const filesCreated = progress?.filesCreated || [];
  const showAllFiles = filesCreated.length <= 10;

  return (
    <div className="flex flex-col h-full">
      {/* Progress Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            {isError ? 'Build Failed' : isComplete ? 'Build Complete!' : 'Building Your App'}
          </h2>
          <span className="text-sm font-medium text-muted-foreground">
            {progressPercent}%
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full transition-all duration-500 ease-out rounded-full',
              isError ? 'bg-destructive' : isComplete ? 'bg-green-500' : 'bg-primary'
            )}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Phase Indicators */}
      <div className="flex items-center justify-between mb-6">
        {PHASES.filter(p => p.id !== 'error').map((phase, index) => {
          const isActive = progress?.phase === phase.id;
          const isPast = currentPhaseIndex > index;
          const isFuture = currentPhaseIndex < index;

          return (
            <div key={phase.id} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    isPast && 'bg-green-500 text-white',
                    isActive && !isError && 'bg-primary text-primary-foreground',
                    isActive && isError && 'bg-destructive text-destructive-foreground',
                    isFuture && 'bg-muted text-muted-foreground'
                  )}
                >
                  {isPast ? (
                    <Check className="h-4 w-4" />
                  ) : isActive ? (
                    isError ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    )
                  ) : (
                    <Circle className="h-4 w-4" />
                  )}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1 font-medium',
                    (isPast || isActive) && !isError ? 'text-foreground' : 'text-muted-foreground'
                  )}
                >
                  {phase.label}
                </span>
              </div>
              {index < PHASES.length - 2 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1',
                    isPast ? 'bg-green-500' : 'bg-muted'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Status */}
      {progress && !isComplete && !isError && (
        <div className="p-4 rounded-lg bg-muted/50 mb-4">
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>{progress.message || PHASES[currentPhaseIndex]?.activeLabel}</span>
          </div>
          {progress.details && (
            <p className="text-xs text-muted-foreground mt-1 pl-6">
              {progress.details}
            </p>
          )}
        </div>
      )}

      {/* Error State */}
      {isError && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 mb-4">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-destructive">Build Error</p>
              <p className="text-sm text-muted-foreground mt-1">
                {progress.error || 'An unexpected error occurred'}
              </p>
              {onRetry && (
                <button
                  onClick={onRetry}
                  className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 text-sm font-medium rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry Build
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Files Created */}
      {filesCreated.length > 0 && (
        <div className="flex-1 min-h-0 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <FileCode className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Files Created ({filesCreated.length})
            </span>
          </div>
          <div className="h-full max-h-[200px] overflow-y-auto border rounded-lg p-2 bg-muted/30">
            {filesCreated.slice(0, showAllFiles ? undefined : 8).map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-1 px-2 text-xs font-mono text-muted-foreground hover:bg-muted/50 rounded"
              >
                <span className="text-green-500">+</span>
                <span className="truncate">{file}</span>
              </div>
            ))}
            {!showAllFiles && (
              <div className="py-1 px-2 text-xs text-muted-foreground">
                ... and {filesCreated.length - 8} more files
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success State - Actions */}
      {isComplete && (
        <div className="space-y-3">
          <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
            <div className="flex items-center gap-2 text-green-400">
              <Check className="h-5 w-5" />
              <span className="font-medium">Your Epic app is ready!</span>
            </div>
          </div>

          <div className="flex gap-3">
            {onLaunchPreview && (
              <button
                onClick={onLaunchPreview}
                disabled={previewLoading}
                className={cn(
                  'flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-colors',
                  'bg-primary text-primary-foreground hover:bg-primary/90',
                  previewLoading && 'opacity-60 cursor-wait'
                )}
              >
                {previewLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : previewUrl ? (
                  <ExternalLink className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {previewLoading ? 'Starting...' : previewUrl ? 'Open Preview' : 'Launch Preview'}
              </button>
            )}
            {onOpenInEditor && (
              <button
                onClick={onOpenInEditor}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border hover:bg-muted transition-colors"
              >
                <FolderOpen className="h-4 w-4" />
                Open in Editor
              </button>
            )}
          </div>
        </div>
      )}

      {/* Build Logs (collapsed by default) */}
      {logs.length > 0 && !isComplete && (
        <details className="mt-auto">
          <summary className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-foreground">
            <ChevronRight className="h-4 w-4 transition-transform [details[open]>&]:rotate-90" />
            Build Logs ({logs.length})
          </summary>
          <div className="mt-2 max-h-[150px] overflow-y-auto border rounded-lg p-2 bg-black/90 text-green-400 font-mono text-xs">
            {logs.slice(-20).map((log, i) => (
              <div key={i} className="py-0.5">
                {log}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

export default BuildProgressCard;
