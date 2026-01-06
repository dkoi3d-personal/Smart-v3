'use client';

import {
  Sparkles,
  FileCode,
  Package,
  Hammer,
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Play,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { BuildProgress as BuildProgressType, BuildPhase, DatabaseConfig } from '../types';

interface BuildProgressProps {
  progress: BuildProgressType;
  databaseConfig: DatabaseConfig | null;
  building: boolean;
  previewUrl: string | null;
  previewLoading: boolean;
  onFix: () => void;
  onLaunchPreview: () => void;
  onOpenEditor: () => void;
  onCreateComplexBuild: () => void;
  creatingComplexBuild: boolean;
}

const getPhaseIcon = (phase: BuildPhase) => {
  switch (phase) {
    case 'planning':
      return <Sparkles className="h-5 w-5 animate-pulse" />;
    case 'creating':
      return <FileCode className="h-5 w-5 animate-pulse" />;
    case 'installing':
      return <Package className="h-5 w-5 animate-bounce" />;
    case 'database':
      return <Database className="h-5 w-5 animate-pulse text-blue-500" />;
    case 'building':
      return <Hammer className="h-5 w-5 animate-pulse" />;
    case 'complete':
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case 'error':
      return <XCircle className="h-5 w-5 text-red-500" />;
    default:
      return <Loader2 className="h-5 w-5 animate-spin" />;
  }
};

const getPhaseSteps = (hasDatabase: boolean): BuildPhase[] => {
  if (hasDatabase) {
    return ['planning', 'creating', 'installing', 'database', 'building', 'complete'];
  }
  return ['planning', 'creating', 'installing', 'building', 'complete'];
};

export function BuildProgress({
  progress,
  databaseConfig,
  building,
  previewUrl,
  previewLoading,
  onFix,
  onLaunchPreview,
  onOpenEditor,
  onCreateComplexBuild,
  creatingComplexBuild,
}: BuildProgressProps) {
  const hasDatabase = databaseConfig && databaseConfig.provider !== 'none';
  const phases = getPhaseSteps(!!hasDatabase);
  const currentPhaseIndex = phases.indexOf(progress.phase);

  return (
    <Card
      className={
        progress.phase === 'error'
          ? 'border-red-500'
          : progress.phase === 'complete'
          ? 'border-green-500'
          : ''
      }
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getPhaseIcon(progress.phase)}
          {progress.message}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Phase Steps */}
        <div className="flex items-center justify-between mb-6">
          {phases.map((phase, idx) => {
            const isActive = progress.phase === phase;
            const isPast = currentPhaseIndex > idx;

            return (
              <div key={phase} className="flex items-center">
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${isActive ? 'bg-primary text-primary-foreground' : ''}
                    ${isPast ? 'bg-green-500 text-white' : ''}
                    ${!isActive && !isPast ? 'bg-muted text-muted-foreground' : ''}
                  `}
                >
                  {idx + 1}
                </div>
                {idx < phases.length - 1 && (
                  <div className={`w-6 h-1 mx-1 ${isPast ? 'bg-green-500' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Error Display */}
        {progress.error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-red-500 mb-2">Error Details</h4>
            <pre className="text-sm text-red-400 whitespace-pre-wrap font-mono max-h-32 overflow-auto">
              {progress.error}
            </pre>
            <Button onClick={onFix} disabled={building} className="mt-4" variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try to Fix
            </Button>
          </div>
        )}

        {/* Files Created */}
        {progress.filesCreated && progress.filesCreated.length > 0 && (
          <div className="mb-4">
            <h4 className="font-semibold mb-2">Files Created ({progress.filesCreated.length})</h4>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-auto">
              {progress.filesCreated.slice(0, 20).map((file, idx) => (
                <Badge key={idx} variant="secondary" className="font-mono text-xs">
                  {file}
                </Badge>
              ))}
              {progress.filesCreated.length > 20 && (
                <Badge variant="outline" className="text-xs">
                  +{progress.filesCreated.length - 20} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Success Actions - Launch Preview (only when no preview yet) */}
        {progress.phase === 'complete' && !previewUrl && !previewLoading && (
          <div className="flex gap-4 mt-4">
            <Button onClick={onLaunchPreview} className="flex-1">
              <Play className="h-4 w-4 mr-2" />
              Launch Preview
            </Button>
            <Button variant="outline" onClick={onOpenEditor}>
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in Editor
            </Button>
          </div>
        )}

        {/* Create Complex Build - Always show when build is complete */}
        {progress.phase === 'complete' && (
          <Button
            variant="secondary"
            className="w-full mt-4 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border border-purple-500/30"
            onClick={onCreateComplexBuild}
            disabled={creatingComplexBuild}
          >
            {creatingComplexBuild ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Project...
              </>
            ) : (
              <>
                <Layers className="h-4 w-4 mr-2" />
                Create Complex Build
                <Badge variant="outline" className="ml-2 text-xs">
                  Full Testing & Security
                </Badge>
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
