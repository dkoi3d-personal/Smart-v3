'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface WorkflowStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'error';
  description: string;
}

interface WorkflowStatusProps {
  currentStep?: string;
  progress?: number;
  status?: string;
}

export function WorkflowStatus({ currentStep, progress = 0, status = 'idle' }: WorkflowStatusProps) {
  const steps: WorkflowStep[] = [
    {
      name: 'Planning',
      status: getCurrentStepStatus('planning', currentStep, status),
      description: 'Supervisor analyzing requirements',
    },
    {
      name: 'Stories',
      status: getCurrentStepStatus('stories', currentStep, status),
      description: 'Product Owner creating user stories',
    },
    {
      name: 'Development',
      status: getCurrentStepStatus('developing', currentStep, status),
      description: 'Coder implementing features',
    },
    {
      name: 'Testing',
      status: getCurrentStepStatus('testing', currentStep, status),
      description: 'Running automated tests',
    },
    {
      name: 'Security',
      status: getCurrentStepStatus('security', currentStep, status),
      description: 'Security scan and fixes',
    },
  ];

  return (
    <Card className="border-2 border-border">
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Workflow Progress</h3>
            <Badge variant={status === 'completed' ? 'default' : 'secondary'}>
              {Math.round(progress)}%
            </Badge>
          </div>

          <Progress value={progress} className="h-2" />

          <div className="space-y-2 mt-4">
            {steps.map((step, index) => (
              <div key={step.name} className="flex items-start gap-3">
                <div className="mt-0.5">
                  {step.status === 'completed' && (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  {step.status === 'in_progress' && (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  )}
                  {step.status === 'pending' && (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                  {step.status === 'error' && (
                    <Circle className="h-5 w-5 text-red-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${
                      step.status === 'in_progress' ? 'text-blue-600' :
                      step.status === 'completed' ? 'text-green-600' :
                      'text-muted-foreground'
                    }`}>
                      {step.name}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
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

  if (!currentStep) {
    return 'pending';
  }

  const stepOrder = ['planning', 'stories', 'developing', 'testing', 'security'];
  const currentIndex = stepOrder.indexOf(currentStep);
  const stepIndex = stepOrder.indexOf(stepName);

  if (stepIndex < currentIndex) {
    return 'completed';
  } else if (stepIndex === currentIndex) {
    return 'in_progress';
  }
  return 'pending';
}
