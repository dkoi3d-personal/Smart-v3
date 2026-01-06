import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | number): string {
  // Handle invalid dates
  if (!date) return 'N/A';

  // Convert to Date object if needed
  const dateObj = date instanceof Date ? date : new Date(date);

  // Check if date is valid
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateObj);
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatPercent(value: number | undefined): string {
  if (value === undefined || value === null || isNaN(value)) {
    return '0.0%';
  }
  return `${value.toFixed(1)}%`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function generateId(prefix: string = 'id'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

export function getLanguageFromExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    java: 'java',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    c: 'c',
    cpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    swift: 'swift',
    kt: 'kotlin',
    sql: 'sql',
    html: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'sass',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sh: 'shell',
    bash: 'shell',
    docker: 'dockerfile',
    tf: 'terraform',
  };

  return languageMap[ext || ''] || 'plaintext';
}

export function getSeverityColor(severity: 'critical' | 'high' | 'medium' | 'low' | 'info'): string {
  const colors = {
    critical: 'text-red-900 dark:text-red-100 bg-red-100 dark:bg-red-950 border-red-300 dark:border-red-800',
    high: 'text-orange-900 dark:text-orange-100 bg-orange-100 dark:bg-orange-950 border-orange-300 dark:border-orange-800',
    medium: 'text-yellow-900 dark:text-yellow-100 bg-yellow-100 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-800',
    low: 'text-blue-900 dark:text-blue-100 bg-blue-100 dark:bg-blue-950 border-blue-300 dark:border-blue-800',
    info: 'text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-gray-950 border-gray-300 dark:border-gray-800',
  };

  return colors[severity];
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    idle: 'text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700',
    planning: 'text-blue-900 dark:text-blue-100 bg-blue-200 dark:bg-blue-800',
    developing: 'text-purple-900 dark:text-purple-100 bg-purple-200 dark:bg-purple-800',
    testing: 'text-yellow-900 dark:text-yellow-100 bg-yellow-200 dark:bg-yellow-800',
    deploying: 'text-indigo-900 dark:text-indigo-100 bg-indigo-200 dark:bg-indigo-800',
    completed: 'text-green-900 dark:text-green-100 bg-green-200 dark:bg-green-800',
    error: 'text-red-900 dark:text-red-100 bg-red-200 dark:bg-red-800',
    backlog: 'text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700',
    in_progress: 'text-blue-900 dark:text-blue-100 bg-blue-200 dark:bg-blue-800',
    done: 'text-green-900 dark:text-green-100 bg-green-200 dark:bg-green-800',
  };

  return colors[status] || 'text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700';
}

export function getPriorityColor(priority: 'low' | 'medium' | 'high' | 'critical'): string {
  const colors = {
    low: 'text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-gray-700',
    medium: 'text-blue-900 dark:text-blue-100 bg-blue-200 dark:bg-blue-800',
    high: 'text-orange-900 dark:text-orange-100 bg-orange-200 dark:bg-orange-800',
    critical: 'text-red-900 dark:text-red-100 bg-red-200 dark:bg-red-800',
  };

  return colors[priority];
}

export function calculateProgress(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((result, item) => {
    const group = String(item[key]);
    if (!result[group]) {
      result[group] = [];
    }
    result[group].push(item);
    return result;
  }, {} as Record<string, T[]>);
}
