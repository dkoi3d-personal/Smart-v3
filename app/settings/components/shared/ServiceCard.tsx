'use client';

import { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusType, StatusBadge } from './StatusIndicator';

interface ServiceCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  status: StatusType;
  statusLabel?: string;
  platformBadge?: string;
  onRefresh?: () => void;
  onExternalLink?: () => void;
  externalLinkUrl?: string;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

export function ServiceCard({
  title,
  description,
  icon,
  status,
  statusLabel,
  platformBadge,
  onRefresh,
  onExternalLink,
  externalLinkUrl,
  loading = false,
  children,
  className,
}: ServiceCardProps) {
  const borderColors = {
    success: 'border-green-500/50',
    warning: 'border-yellow-500/50',
    error: 'border-red-500/50',
    inactive: 'border-border',
  };

  const iconBgColors = {
    success: 'bg-green-100 dark:bg-green-900/30',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30',
    error: 'bg-red-100 dark:bg-red-900/30',
    inactive: 'bg-muted',
  };

  const iconTextColors = {
    success: 'text-green-600',
    warning: 'text-yellow-600',
    error: 'text-red-600',
    inactive: 'text-muted-foreground',
  };

  return (
    <Card className={cn(borderColors[status], className)}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn('p-2.5 rounded-lg', iconBgColors[status])}>
              <div className={iconTextColors[status]}>{icon}</div>
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                {title}
                {platformBadge && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {platformBadge}
                  </Badge>
                )}
              </h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          <div className="flex gap-1">
            {onRefresh && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onRefresh}
                disabled={loading}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            )}
            {(onExternalLink || externalLinkUrl) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onExternalLink || (() => window.open(externalLinkUrl, '_blank'))}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking...
          </div>
        ) : (
          <>
            {statusLabel && (
              <div className="mb-3">
                <StatusBadge status={status} label={statusLabel} />
              </div>
            )}
            {children}
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function ServiceCardSection({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-4', className)}>
      {title && <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>}
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}
