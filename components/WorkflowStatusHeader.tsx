'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, Loader2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkflowStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  icon: string;
  inLoop?: boolean;
}

interface WorkflowStatusHeaderProps {
  currentStep?: string;
  progress?: number;
  status?: string;
  currentStoryIndex?: number;
  totalStories?: number;
  loopIteration?: number; // Track how many code/test cycles completed for current story
}

export function WorkflowStatusHeader({
  currentStep,
  progress = 0,
  status = 'idle',
  currentStoryIndex = 0,
  totalStories = 0,
  loopIteration = 0,
}: WorkflowStatusHeaderProps) {
  const steps: WorkflowStep[] = [
    { name: 'Research', status: getCurrentStepStatus('research', currentStep, status), icon: '🔬', inLoop: false },
    { name: 'Plan', status: getCurrentStepStatus('planning', currentStep, status), icon: '📋', inLoop: false },
    { name: 'Stories', status: getCurrentStepStatus('stories', currentStep, status), icon: '📊', inLoop: true },
    { name: 'Code', status: getCurrentStepStatus('developing', currentStep, status), icon: '💻', inLoop: true },
    { name: 'Test', status: getCurrentStepStatus('testing', currentStep, status), icon: '🧪', inLoop: true },
    { name: 'Secure', status: getCurrentStepStatus('security', currentStep, status), icon: '🔒', inLoop: false },
    { name: 'Deploy', status: getCurrentStepStatus('deploying', currentStep, status), icon: '🚀', inLoop: false },
  ];

  const isInLoop = ['developing', 'testing'].includes(currentStep || '');
  const showLoopIndicator = isInLoop && totalStories > 0;

  // Visual representation of code/test loop
  const renderLoopCycles = () => {
    if (!isInLoop) return null;

    const maxCycles = 3;
    // Determine current phase (outside of map for Badge usage)
    const isCodingPhase = currentStep === 'developing';
    const isTestingPhase = currentStep === 'testing';

    const cycles = Array.from({ length: maxCycles }, (_, i) => {
      // Determine if this cycle is completed, current, or pending
      const cycleCompleted = i < Math.floor(loopIteration / 2);
      const isCurrentCycle = i === Math.floor(loopIteration / 2);

      // For current cycle, check if we're on code or test
      const codeCompleted = cycleCompleted || (isCurrentCycle && isTestingPhase);
      const testCompleted = cycleCompleted;
      const codeActive = isCurrentCycle && isCodingPhase;
      const testActive = isCurrentCycle && isTestingPhase;

      return (
        <div key={i} className="flex items-center gap-1">
          {/* Code Circle */}
          <div className={cn(
            "w-3 h-3 rounded-full border-2 transition-all",
            codeCompleted && "bg-green-500 border-green-600",
            codeActive && "bg-green-500 border-green-600 ring-2 ring-green-400 ring-offset-1 animate-pulse",
            !codeCompleted && !codeActive && "bg-red-500/20 border-red-500"
          )} />

          <span className="text-[10px] font-medium text-muted-foreground">Code</span>

          <div className="w-2 h-px bg-border mx-0.5" />

          {/* Test Circle */}
          <div className={cn(
            "w-3 h-3 rounded-full border-2 transition-all",
            testCompleted && "bg-green-500 border-green-600",
            testActive && "bg-green-500 border-green-600 ring-2 ring-green-400 ring-offset-1 animate-pulse",
            !testCompleted && !testActive && "bg-red-500/20 border-red-500"
          )} />

          <span className="text-[10px] font-medium text-muted-foreground">Test</span>

          {i < maxCycles - 1 && <div className="w-3 h-px bg-border mx-1" />}
        </div>
      );
    });

    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 rounded-md border border-border">
        <span className="text-xs font-semibold text-muted-foreground">Story {currentStoryIndex + 1}/{totalStories} Loop:</span>
        {cycles}
        <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0.5 font-mono">
          {isCodingPhase ? 'Coding' : 'Testing'} - Cycle {Math.floor(loopIteration / 2) + 1}/{maxCycles}
        </Badge>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Loop Cycles Indicator (shown above main workflow) */}
      {showLoopIndicator && (
        <div className="flex items-center justify-center">
          {renderLoopCycles()}
        </div>
      )}

      {/* Main Workflow Steps */}
      <div className="flex items-center gap-3">
      {/* Progress Bar */}
      <div className="flex items-center gap-2">
        <div className="w-32 h-2 bg-muted rounded-full overflow-hidden border border-border">
          <div
            className={cn(
              "h-full transition-all duration-500 ease-out",
              status === 'completed' ? 'bg-green-500' :
              status === 'error' ? 'bg-red-500' :
              'bg-primary'
            )}
            style={{ width: `${progress}%` }}
          />
        </div>
        <Badge variant="secondary" className="text-xs font-mono px-2 py-0.5">
          {Math.round(progress)}%
        </Badge>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center gap-1">
        {steps.map((step, index) => {
          const isLoopStart = step.name === 'Stories';
          const isLoopEnd = step.name === 'Test';

          return (
            <div key={step.name} className="flex items-center">
              {/* Loop Start Indicator */}
              {isLoopStart && (
                <div className="flex items-center mr-1">
                  <div className="w-px h-6 bg-purple-400 dark:bg-purple-600" />
                  <div className="w-2 h-px bg-purple-400 dark:bg-purple-600" />
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <div
                  className={cn(
                    "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all",
                    step.inLoop && "ring-1 ring-purple-400 dark:ring-purple-600",
                    step.status === 'in_progress' && "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700",
                    step.status === 'completed' && "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-700",
                    step.status === 'pending' && "bg-muted text-muted-foreground border border-border",
                    step.status === 'error' && "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700"
                  )}
                >
                  {step.status === 'completed' && (
                    <CheckCircle2 className="h-3 w-3" />
                  )}
                  {step.status === 'in_progress' && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <Circle className="h-3 w-3" />
                  )}
                  <span>{step.icon}</span>
                  <span className="hidden sm:inline">{step.name}</span>
                </div>
              </div>

              {/* Loop End Indicator with Arrow Back */}
              {isLoopEnd && showLoopIndicator && (
                <div className="flex items-center ml-1">
                  <div className="w-2 h-px bg-purple-400 dark:bg-purple-600" />
                  <div className="flex flex-col items-center">
                    <div className="w-px h-6 bg-purple-400 dark:bg-purple-600" />
                    <RotateCw className={cn(
                      "h-3 w-3 text-purple-500 dark:text-purple-400 -mt-3",
                      isInLoop && "animate-spin"
                    )} />
                  </div>
                  <div className="w-8 h-px bg-purple-400 dark:bg-purple-600 -ml-1" style={{
                    transform: 'translateY(-12px)'
                  }} />
                </div>
              )}

              {/* Regular connector between steps (skip if showing loop end) */}
              {index < steps.length - 1 && !(isLoopEnd && showLoopIndicator) && (
                <div className={cn(
                  "w-6 h-0.5 mx-0.5 transition-colors",
                  getCurrentConnectorStatus(step.status, steps[index + 1].status)
                )} />
              )}
            </div>
          );
        })}
      </div>

      {/* Loop Progress Indicator */}
      {showLoopIndicator && (
        <Badge variant="outline" className="gap-1.5 border-purple-400 dark:border-purple-600 text-purple-700 dark:text-purple-300">
          <RotateCw className="h-3 w-3 animate-spin" />
          <span className="font-mono text-xs">Story {currentStoryIndex + 1}/{totalStories}</span>
        </Badge>
      )}
      </div>
    </div>
  );
}

function getCurrentStepStatus(
  stepName: string,
  currentStep?: string,
  overallStatus?: string
): 'pending' | 'in_progress' | 'completed' | 'error' {
  if (overallStatus === 'error') {
    return 'error';
  }

  if (overallStatus === 'completed') {
    return 'completed';
  }

  if (!currentStep || currentStep === 'idle') {
    return 'pending';
  }

  const stepOrder = ['research', 'planning', 'stories', 'developing', 'testing', 'security', 'deploying'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepName);

  if (stepIndex < currentIndex) {
    return 'completed';
  } else if (stepIndex === currentIndex) {
    return 'in_progress';
  }
  return 'pending';
}

function getCurrentConnectorStatus(
  currentStatus: string,
  nextStatus: string
): string {
  if (currentStatus === 'completed') {
    return 'bg-green-500 dark:bg-green-600';
  }
  if (currentStatus === 'in_progress') {
    return 'bg-blue-500 dark:bg-blue-600';
  }
  return 'bg-border';
}
