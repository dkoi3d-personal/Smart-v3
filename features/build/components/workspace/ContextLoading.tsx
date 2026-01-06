'use client';

import { useState, useEffect } from 'react';
import {
  FolderTree,
  FileCode,
  Package,
  Paintbrush,
  TestTube,
  CheckCircle,
  Loader2,
  Circle,
  Code2,
  Database,
  Globe,
  Settings,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface ScanStep {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: 'pending' | 'scanning' | 'completed';
}

interface ContextSummary {
  framework?: string;
  styling?: string;
  database?: string;
  testing?: string;
  totalFiles: number;
  totalDependencies: number;
  patterns: string[];
}

interface ContextLoadingProps {
  projectDir: string;
  onComplete: (context: ContextSummary) => void;
  onCancel: () => void;
}

export function ContextLoading({
  projectDir,
  onComplete,
  onCancel,
}: ContextLoadingProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [contextSummary, setContextSummary] = useState<ContextSummary>({
    totalFiles: 0,
    totalDependencies: 0,
    patterns: [],
  });

  const [steps, setSteps] = useState<ScanStep[]>([
    {
      id: 'structure',
      label: 'Scanning project structure',
      description: 'Analyzing file layout and organization',
      icon: FolderTree,
      status: 'pending',
    },
    {
      id: 'dependencies',
      label: 'Analyzing dependencies',
      description: 'Reading package.json and lock files',
      icon: Package,
      status: 'pending',
    },
    {
      id: 'architecture',
      label: 'Identifying architecture',
      description: 'Detecting framework and patterns',
      icon: Code2,
      status: 'pending',
    },
    {
      id: 'services',
      label: 'Reading service layer',
      description: 'Scanning services, utils, and libs',
      icon: Settings,
      status: 'pending',
    },
    {
      id: 'tests',
      label: 'Analyzing test structure',
      description: 'Checking test patterns and coverage',
      icon: TestTube,
      status: 'pending',
    },
    {
      id: 'design',
      label: 'Loading design system',
      description: 'Checking for Figma integration',
      icon: Paintbrush,
      status: 'pending',
    },
  ]);

  // Simulate scanning progress
  useEffect(() => {
    const scanContext = async () => {
      for (let i = 0; i < steps.length; i++) {
        // Update current step to scanning
        setSteps(prev => prev.map((step, idx) => ({
          ...step,
          status: idx === i ? 'scanning' : idx < i ? 'completed' : 'pending',
        })));
        setCurrentStep(i);

        // Simulate API call for each step
        try {
          const response = await fetch('/api/context-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              projectDir,
              step: steps[i].id,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            setContextSummary(prev => ({
              ...prev,
              ...data.context,
            }));
          }
        } catch {
          // Continue even if individual step fails
        }

        // Update progress
        setProgress(((i + 1) / steps.length) * 100);

        // Mark step as completed
        setSteps(prev => prev.map((step, idx) => ({
          ...step,
          status: idx <= i ? 'completed' : 'pending',
        })));

        // Brief delay between steps for visual feedback
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // All steps completed
      onComplete(contextSummary);
    };

    scanContext();
  }, [projectDir]);

  const getStepIcon = (step: ScanStep) => {
    const Icon = step.icon;
    switch (step.status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-emerald-500" />;
      case 'scanning':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground/40" />;
    }
  };

  const getContextIcon = (key: string) => {
    switch (key) {
      case 'framework':
        return <Globe className="h-4 w-4" />;
      case 'styling':
        return <Paintbrush className="h-4 w-4" />;
      case 'database':
        return <Database className="h-4 w-4" />;
      case 'testing':
        return <TestTube className="h-4 w-4" />;
      default:
        return <Code2 className="h-4 w-4" />;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/30">
          <FolderTree className="h-10 w-10 text-white" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Preparing Build Context</h2>
        <p className="text-sm text-muted-foreground">
          Scanning your codebase to understand existing patterns...
        </p>
      </div>

      {/* Progress Bar */}
      <div className="w-full mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">Progress</span>
          <span className="text-sm font-medium">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Steps List */}
      <Card className="w-full bg-muted/20 border-border/50 mb-6">
        <CardContent className="p-4 space-y-3">
          {steps.map((step, idx) => (
            <div
              key={step.id}
              className={cn(
                'flex items-center gap-3 p-3 rounded-lg transition-colors',
                step.status === 'scanning' && 'bg-blue-500/10 border border-blue-500/30',
                step.status === 'completed' && 'opacity-60'
              )}
            >
              {getStepIcon(step)}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-medium',
                  step.status === 'scanning' && 'text-blue-400'
                )}>
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {step.description}
                </p>
              </div>
              {step.status === 'scanning' && (
                <Badge className="text-[9px] bg-blue-500/20 text-blue-400 border-blue-500/30 animate-pulse">
                  Scanning...
                </Badge>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Context Summary (as it builds up) */}
      {(contextSummary.totalFiles > 0 || contextSummary.framework) && (
        <Card className="w-full bg-gradient-to-r from-emerald-950/20 to-green-950/10 border-emerald-500/30">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Context Summary
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {contextSummary.framework && (
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-blue-400" />
                  <span className="text-sm">{contextSummary.framework}</span>
                </div>
              )}
              {contextSummary.styling && (
                <div className="flex items-center gap-2">
                  <Paintbrush className="h-4 w-4 text-pink-400" />
                  <span className="text-sm">{contextSummary.styling}</span>
                </div>
              )}
              {contextSummary.database && (
                <div className="flex items-center gap-2">
                  <Database className="h-4 w-4 text-amber-400" />
                  <span className="text-sm">{contextSummary.database}</span>
                </div>
              )}
              {contextSummary.testing && (
                <div className="flex items-center gap-2">
                  <TestTube className="h-4 w-4 text-green-400" />
                  <span className="text-sm">{contextSummary.testing}</span>
                </div>
              )}
              {contextSummary.totalFiles > 0 && (
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-slate-400" />
                  <span className="text-sm">{contextSummary.totalFiles} files</span>
                </div>
              )}
              {contextSummary.totalDependencies > 0 && (
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-purple-400" />
                  <span className="text-sm">{contextSummary.totalDependencies} deps</span>
                </div>
              )}
            </div>
            {contextSummary.patterns.length > 0 && (
              <div className="mt-3 pt-3 border-t border-emerald-500/20">
                <p className="text-[10px] text-muted-foreground mb-2">Detected patterns:</p>
                <div className="flex flex-wrap gap-1">
                  {contextSummary.patterns.map((pattern) => (
                    <Badge
                      key={pattern}
                      variant="outline"
                      className="text-[10px] border-emerald-500/30 text-emerald-400"
                    >
                      {pattern}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cancel Button */}
      <button
        onClick={onCancel}
        className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}
