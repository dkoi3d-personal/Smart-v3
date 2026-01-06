'use client';

import { cn } from '@/lib/utils';

export type StatusType = 'success' | 'warning' | 'error' | 'inactive';

interface StatusIndicatorProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
  lg: 'h-3 w-3',
};

const colorClasses = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  inactive: 'bg-gray-400',
};

export function StatusIndicator({ status, size = 'md', pulse = false }: StatusIndicatorProps) {
  return (
    <div
      className={cn(
        'rounded-full',
        sizeClasses[size],
        colorClasses[status],
        pulse && status === 'warning' && 'animate-pulse'
      )}
    />
  );
}

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: StatusType;
  label: string;
  className?: string;
}) {
  const badgeColors = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        badgeColors[status],
        className
      )}
    >
      <StatusIndicator status={status} size="sm" />
      {label}
    </span>
  );
}
