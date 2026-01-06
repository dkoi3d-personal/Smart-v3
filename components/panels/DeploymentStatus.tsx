'use client';

import { CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Rocket, CheckCircle, XCircle, Clock, Loader2 } from 'lucide-react';
import { useProjectStore } from '@/stores/project-store';
import { cn, formatCurrency } from '@/lib/utils';

export function DeploymentStatus() {
  const { project } = useProjectStore();
  const deployment = project?.deployment;

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const completedSteps = deployment?.steps.filter((s) => s.status === 'completed').length || 0;
  const totalSteps = deployment?.steps.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Rocket className="h-4 w-4" />
            Deployment Status
          </CardTitle>
          {deployment && (
            <Badge
              variant={
                deployment.status === 'deployed' ? 'default' :
                deployment.status === 'failed' ? 'destructive' :
                'secondary'
              }
            >
              {deployment.status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col gap-2 min-h-0">
        {deployment ? (
          <>
            {/* Progress */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Progress</span>
                <span className="font-medium">
                  {completedSteps}/{totalSteps} steps
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Deployment Info */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-muted rounded">
                <div className="text-muted-foreground mb-1">Environment</div>
                <div className="font-medium capitalize">{deployment.environment}</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="text-muted-foreground mb-1">Estimated Cost</div>
                <div className="font-medium">{formatCurrency(deployment.cost.estimated)}/mo</div>
              </div>
            </div>

            {/* Deployment Steps */}
            <ScrollArea className="flex-1">
              <div className="space-y-1">
                {deployment.steps.map((step, index) => (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-start gap-2 p-2 rounded text-xs',
                      step.status === 'running' && 'bg-blue-50 dark:bg-blue-950',
                      step.status === 'completed' && 'bg-green-50 dark:bg-green-950',
                      step.status === 'failed' && 'bg-red-50 dark:bg-red-950'
                    )}
                  >
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-muted-foreground">{index + 1}</span>
                      {getStepIcon(step.status)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{step.name}</p>
                      {step.error && (
                        <p className="text-red-600 mt-1">{step.error}</p>
                      )}
                      {step.logs && step.logs.length > 0 && (
                        <div className="mt-1 font-mono text-xs bg-black/5 dark:bg-white/5 p-1 rounded">
                          {step.logs[step.logs.length - 1]}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            {deployment.url && (
              <Button size="sm" variant="outline" className="w-full" asChild>
                <a href={deployment.url} target="_blank" rel="noopener noreferrer">
                  View Deployment
                </a>
              </Button>
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-xs text-muted-foreground">
            <Rocket className="h-12 w-12 mb-2 opacity-50" />
            <p>No deployment yet</p>
            <p className="mt-1">Build your app to enable deployment</p>
          </div>
        )}
      </CardContent>
    </>
  );
}
