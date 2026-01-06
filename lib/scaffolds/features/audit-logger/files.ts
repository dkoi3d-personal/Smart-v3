/**
 * Audit Logger Template - File Contents
 */

import { TemplateFile } from '../types';

export const auditLoggerFiles: TemplateFile[] = [
  // ==================== LIB UTILITIES ====================
  {
    path: 'lib/audit/types.ts',
    type: 'type',
    description: 'Audit event types',
    content: `/**
 * Audit Logger Types
 * HIPAA-compliant activity logging types
 */

export type AuditAction =
  | 'VIEW'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'EXPORT'
  | 'LOGIN'
  | 'LOGOUT'
  | 'SEARCH'
  | 'PRINT';

export type ResourceType =
  | 'Patient'
  | 'Appointment'
  | 'Message'
  | 'Document'
  | 'Prescription'
  | 'Observation'
  | 'Condition'
  | 'User'
  | 'System';

export interface AuditEvent {
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  userId?: number;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
  phiAccessed?: boolean;
}

export interface AuditLogEntry extends AuditEvent {
  id: string;
  timestamp: Date;
}

export interface AuditQueryParams {
  startDate?: Date;
  endDate?: Date;
  action?: AuditAction;
  resourceType?: ResourceType;
  userId?: number;
  phiOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface AuditQueryResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  totalPages: number;
}`,
  },

  {
    path: 'lib/audit/logger.ts',
    type: 'lib',
    description: 'Audit logging utility with database persistence',
    content: `/**
 * Audit Logger
 * HIPAA-compliant activity logging with database persistence
 */

import { prisma } from '@/lib/db';
import { AuditEvent, AuditAction, ResourceType, AuditQueryParams, AuditQueryResult } from './types';

// PHI-related resource types
const PHI_RESOURCE_TYPES: ResourceType[] = [
  'Patient',
  'Appointment',
  'Message',
  'Document',
  'Prescription',
  'Observation',
  'Condition',
];

/**
 * Log an audit event to the database
 */
export async function auditLog(event: AuditEvent): Promise<void> {
  try {
    // Auto-detect PHI access
    const phiAccessed = event.phiAccessed ?? PHI_RESOURCE_TYPES.includes(event.resourceType);

    await prisma.auditLog.create({
      data: {
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId || null,
        userId: event.userId || null,
        userEmail: event.userEmail || null,
        ipAddress: event.ipAddress || null,
        userAgent: event.userAgent || null,
        details: event.details || null,
        phiAccessed,
      },
    });

    // Log to console in development for debugging
    if (process.env.NODE_ENV === 'development') {
      console.log('[Audit]', event.action, event.resourceType, event.resourceId || '');
    }
  } catch (error) {
    // Audit logging should never throw - log error and continue
    console.error('[Audit] Failed to log event:', error);
  }
}

/**
 * Query audit logs with filters
 */
export async function queryAuditLogs(params: AuditQueryParams): Promise<AuditQueryResult> {
  const page = params.page || 1;
  const limit = params.limit || 50;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (params.startDate || params.endDate) {
    where.timestamp = {};
    if (params.startDate) {
      (where.timestamp as Record<string, unknown>).gte = params.startDate;
    }
    if (params.endDate) {
      (where.timestamp as Record<string, unknown>).lte = params.endDate;
    }
  }

  if (params.action) {
    where.action = params.action;
  }

  if (params.resourceType) {
    where.resourceType = params.resourceType;
  }

  if (params.userId) {
    where.userId = params.userId;
  }

  if (params.phiOnly) {
    where.phiAccessed = true;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((log) => ({
      ...log,
      details: log.details as Record<string, unknown> | undefined,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogs(params: AuditQueryParams): Promise<string> {
  const { logs } = await queryAuditLogs({ ...params, limit: 10000 });

  const headers = [
    'Timestamp',
    'Action',
    'Resource Type',
    'Resource ID',
    'User ID',
    'User Email',
    'IP Address',
    'PHI Accessed',
    'Details',
  ];

  const rows = logs.map((log) => [
    log.timestamp.toISOString(),
    log.action,
    log.resourceType,
    log.resourceId || '',
    log.userId?.toString() || '',
    log.userEmail || '',
    log.ipAddress || '',
    log.phiAccessed ? 'Yes' : 'No',
    log.details ? JSON.stringify(log.details) : '',
  ]);

  const csv = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => \`"\${cell.replace(/"/g, '""')}"\`).join(',')),
  ].join('\\n');

  return csv;
}

/**
 * Convenience functions for common audit events
 */
export const audit = {
  view: (resourceType: ResourceType, resourceId: string, userId?: number, userEmail?: string) =>
    auditLog({ action: 'VIEW', resourceType, resourceId, userId, userEmail }),

  create: (resourceType: ResourceType, resourceId: string, userId?: number, userEmail?: string) =>
    auditLog({ action: 'CREATE', resourceType, resourceId, userId, userEmail }),

  update: (resourceType: ResourceType, resourceId: string, userId?: number, userEmail?: string) =>
    auditLog({ action: 'UPDATE', resourceType, resourceId, userId, userEmail }),

  delete: (resourceType: ResourceType, resourceId: string, userId?: number, userEmail?: string) =>
    auditLog({ action: 'DELETE', resourceType, resourceId, userId, userEmail }),

  export: (resourceType: ResourceType, userId?: number, userEmail?: string, details?: Record<string, unknown>) =>
    auditLog({ action: 'EXPORT', resourceType, userId, userEmail, details }),

  login: (userId: number, userEmail: string, ipAddress?: string) =>
    auditLog({ action: 'LOGIN', resourceType: 'User', userId, userEmail, ipAddress, phiAccessed: false }),

  logout: (userId: number, userEmail: string) =>
    auditLog({ action: 'LOGOUT', resourceType: 'User', userId, userEmail, phiAccessed: false }),
};`,
  },

  {
    path: 'lib/audit/middleware.ts',
    type: 'lib',
    description: 'Audit logging middleware for API routes',
    content: `/**
 * Audit Logging Middleware
 * Automatically logs API access for HIPAA compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { auditLog } from './logger';
import { AuditAction, ResourceType } from './types';
import { getSession } from '@/lib/auth/session';

interface AuditMiddlewareOptions {
  action: AuditAction;
  resourceType: ResourceType;
  getResourceId?: (request: NextRequest, params?: Record<string, string>) => string | undefined;
}

/**
 * Create an audit-logged API handler
 */
export function withAuditLogging<T>(
  options: AuditMiddlewareOptions,
  handler: (request: NextRequest, context?: { params: Promise<Record<string, string>> }) => Promise<NextResponse<T>>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse<T>> => {
    const startTime = Date.now();
    let response: NextResponse<T>;

    try {
      response = await handler(request, context);
    } catch (error) {
      // Log failed attempts too
      const session = await getSession().catch(() => null);
      const params = context?.params ? await context.params : undefined;

      await auditLog({
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.getResourceId?.(request, params),
        userId: session?.userId,
        userEmail: session?.email,
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
          success: false,
        },
      });

      throw error;
    }

    // Log successful access
    const session = await getSession().catch(() => null);
    const params = context?.params ? await context.params : undefined;

    await auditLog({
      action: options.action,
      resourceType: options.resourceType,
      resourceId: options.getResourceId?.(request, params),
      userId: session?.userId,
      userEmail: session?.email,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      details: {
        duration: Date.now() - startTime,
        success: response.ok,
        status: response.status,
      },
    });

    return response;
  };
}

/**
 * Simple audit decorator for any async function
 */
export function auditedFunction<TArgs extends unknown[], TResult>(
  action: AuditAction,
  resourceType: ResourceType,
  fn: (...args: TArgs) => Promise<TResult>,
  options?: {
    getResourceId?: (...args: TArgs) => string | undefined;
    getUserId?: (...args: TArgs) => number | undefined;
  }
): (...args: TArgs) => Promise<TResult> {
  return async (...args: TArgs): Promise<TResult> => {
    const startTime = Date.now();

    try {
      const result = await fn(...args);

      await auditLog({
        action,
        resourceType,
        resourceId: options?.getResourceId?.(...args),
        userId: options?.getUserId?.(...args),
        details: {
          duration: Date.now() - startTime,
          success: true,
        },
      });

      return result;
    } catch (error) {
      await auditLog({
        action,
        resourceType,
        resourceId: options?.getResourceId?.(...args),
        userId: options?.getUserId?.(...args),
        details: {
          duration: Date.now() - startTime,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  };
}`,
  },

  {
    path: 'lib/audit/index.ts',
    type: 'lib',
    description: 'Audit module exports',
    content: `export * from './types';
export { auditLog, queryAuditLogs, exportAuditLogs, audit } from './logger';
export { withAuditLogging, auditedFunction } from './middleware';`,
  },

  // ==================== API ROUTES ====================
  {
    path: 'app/api/audit/route.ts',
    type: 'api',
    description: 'Query audit logs endpoint',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { queryAuditLogs } from '@/lib/audit';
import { requireSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireSession();

    // TODO: Add role check - only admins should access audit logs
    // if (!session.isAdmin) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const searchParams = request.nextUrl.searchParams;

    const params = {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      action: searchParams.get('action') as any || undefined,
      resourceType: searchParams.get('resourceType') as any || undefined,
      userId: searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined,
      phiOnly: searchParams.get('phiOnly') === 'true',
      page: searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 50,
    };

    const result = await queryAuditLogs(params);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[Audit API] Query error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}`,
  },

  {
    path: 'app/api/audit/export/route.ts',
    type: 'api',
    description: 'Export audit logs endpoint',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { exportAuditLogs, auditLog } from '@/lib/audit';
import { requireSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const session = await requireSession();

    // TODO: Add role check - only admins should export audit logs
    // if (!session.isAdmin) {
    //   return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    // }

    const searchParams = request.nextUrl.searchParams;

    const params = {
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      action: searchParams.get('action') as any || undefined,
      resourceType: searchParams.get('resourceType') as any || undefined,
      userId: searchParams.get('userId') ? parseInt(searchParams.get('userId')!) : undefined,
      phiOnly: searchParams.get('phiOnly') === 'true',
    };

    // Log the export action
    await auditLog({
      action: 'EXPORT',
      resourceType: 'System',
      userId: session.userId,
      userEmail: session.email,
      details: {
        exportType: 'audit_logs',
        filters: params,
      },
      phiAccessed: false,
    });

    const csv = await exportAuditLogs(params);

    // Return as CSV file download
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': \`attachment; filename="audit-log-\${new Date().toISOString().split('T')[0]}.csv"\`,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.error('[Audit API] Export error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}`,
  },

  // ==================== COMPONENTS ====================
  {
    path: 'components/audit/AuditTable.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Audit log viewer table',
    content: `'use client';

import { AuditLogEntry } from '@/lib/audit/types';
import { formatDistanceToNow } from 'date-fns';

interface AuditTableProps {
  logs: AuditLogEntry[];
  onRowClick?: (log: AuditLogEntry) => void;
}

export function AuditTable({ logs, onRowClick }: AuditTableProps) {
  const getActionColor = (action: string) => {
    switch (action) {
      case 'VIEW':
        return 'bg-blue-500/10 text-blue-500';
      case 'CREATE':
        return 'bg-green-500/10 text-green-500';
      case 'UPDATE':
        return 'bg-yellow-500/10 text-yellow-500';
      case 'DELETE':
        return 'bg-red-500/10 text-red-500';
      case 'EXPORT':
        return 'bg-purple-500/10 text-purple-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Time</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Action</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">Resource</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">User</th>
            <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">PHI</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                No audit logs found
              </td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr
                key={log.id}
                className={\`border-t border-border hover:bg-muted/50 \${onRowClick ? 'cursor-pointer' : ''}\`}
                onClick={() => onRowClick?.(log)}
              >
                <td className="px-4 py-3 text-sm text-foreground">
                  <div className="flex flex-col">
                    <span>{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={\`px-2 py-1 text-xs font-medium rounded \${getActionColor(log.action)}\`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  <div className="flex flex-col">
                    <span>{log.resourceType}</span>
                    {log.resourceId && (
                      <span className="text-xs text-muted-foreground font-mono">{log.resourceId}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-foreground">
                  {log.userEmail || log.userId || 'System'}
                </td>
                <td className="px-4 py-3">
                  {log.phiAccessed ? (
                    <span className="px-2 py-1 text-xs font-medium rounded bg-amber-500/10 text-amber-500">
                      PHI
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}`,
  },

  {
    path: 'components/audit/AuditFilters.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Audit log filters',
    content: `'use client';

import { useState } from 'react';

interface AuditFiltersProps {
  onFilter: (filters: {
    startDate?: string;
    endDate?: string;
    action?: string;
    resourceType?: string;
    phiOnly?: boolean;
  }) => void;
}

const ACTIONS = ['VIEW', 'CREATE', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT'];
const RESOURCE_TYPES = ['Patient', 'Appointment', 'Message', 'Document', 'User', 'System'];

export function AuditFilters({ onFilter }: AuditFiltersProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [phiOnly, setPhiOnly] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilter({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      action: action || undefined,
      resourceType: resourceType || undefined,
      phiOnly,
    });
  };

  const handleReset = () => {
    setStartDate('');
    setEndDate('');
    setAction('');
    setResourceType('');
    setPhiOnly(false);
    onFilter({});
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-card border border-border rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Start Date</label>
          <input
            type="datetime-local"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">End Date</label>
          <input
            type="datetime-local"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Action</label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          >
            <option value="">All Actions</option>
            {ACTIONS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-1">Resource Type</label>
          <select
            value={resourceType}
            onChange={(e) => setResourceType(e.target.value)}
            className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground text-sm"
          >
            <option value="">All Resources</option>
            {RESOURCE_TYPES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-2">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={phiOnly}
              onChange={(e) => setPhiOnly(e.target.checked)}
              className="rounded border-border"
            />
            PHI Only
          </label>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          Apply Filters
        </button>
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground hover:bg-muted"
        >
          Reset
        </button>
      </div>
    </form>
  );
}`,
  },

  {
    path: 'components/audit/AuditDetail.tsx',
    type: 'component',
    usesDesignSystem: true,
    description: 'Audit log detail modal',
    content: `'use client';

import { AuditLogEntry } from '@/lib/audit/types';

interface AuditDetailProps {
  log: AuditLogEntry | null;
  onClose: () => void;
}

export function AuditDetail({ log, onClose }: AuditDetailProps) {
  if (!log) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-card border border-border rounded-xl shadow-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">Audit Log Details</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Event ID</label>
              <p className="text-sm font-mono text-foreground">{log.id}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
              <p className="text-sm text-foreground">{new Date(log.timestamp).toLocaleString()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">Action</label>
              <p className="text-sm text-foreground">{log.action}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Resource Type</label>
              <p className="text-sm text-foreground">{log.resourceType}</p>
            </div>
          </div>

          {log.resourceId && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Resource ID</label>
              <p className="text-sm font-mono text-foreground">{log.resourceId}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">User ID</label>
              <p className="text-sm text-foreground">{log.userId || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">User Email</label>
              <p className="text-sm text-foreground">{log.userEmail || 'N/A'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">IP Address</label>
              <p className="text-sm font-mono text-foreground">{log.ipAddress || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">PHI Accessed</label>
              <p className="text-sm text-foreground">{log.phiAccessed ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {log.userAgent && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">User Agent</label>
              <p className="text-sm text-foreground break-all">{log.userAgent}</p>
            </div>
          )}

          {log.details && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Details</label>
              <pre className="mt-1 p-3 bg-muted rounded-lg text-sm text-foreground overflow-x-auto">
                {JSON.stringify(log.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}`,
  },

  // ==================== PAGES ====================
  {
    path: 'app/admin/audit-log/page.tsx',
    type: 'page',
    usesDesignSystem: true,
    description: 'Audit log admin page',
    content: `'use client';

import { useState, useEffect, useCallback } from 'react';
import { AuditTable } from '@/components/audit/AuditTable';
import { AuditFilters } from '@/components/audit/AuditFilters';
import { AuditDetail } from '@/components/audit/AuditDetail';
import { AuditLogEntry, AuditQueryResult } from '@/lib/audit/types';
import { Pagination } from '@/components/data-table/Pagination';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [filters, setFilters] = useState<Record<string, string | boolean | undefined>>({});

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('page', pagination.page.toString());
      params.set('limit', pagination.limit.toString());

      if (filters.startDate) params.set('startDate', filters.startDate as string);
      if (filters.endDate) params.set('endDate', filters.endDate as string);
      if (filters.action) params.set('action', filters.action as string);
      if (filters.resourceType) params.set('resourceType', filters.resourceType as string);
      if (filters.phiOnly) params.set('phiOnly', 'true');

      const res = await fetch(\`/api/audit?\${params}\`);
      if (!res.ok) throw new Error('Failed to fetch audit logs');

      const data: AuditQueryResult = await res.json();
      setLogs(data.logs);
      setPagination((prev) => ({
        ...prev,
        total: data.total,
        totalPages: data.totalPages,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilter = (newFilters: Record<string, string | boolean | undefined>) => {
    setFilters(newFilters);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (filters.startDate) params.set('startDate', filters.startDate as string);
    if (filters.endDate) params.set('endDate', filters.endDate as string);
    if (filters.action) params.set('action', filters.action as string);
    if (filters.resourceType) params.set('resourceType', filters.resourceType as string);
    if (filters.phiOnly) params.set('phiOnly', 'true');

    window.location.href = \`/api/audit/export?\${params}\`;
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
            <p className="text-muted-foreground">View and export activity logs for HIPAA compliance</p>
          </div>
          <button
            onClick={handleExport}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
          >
            Export CSV
          </button>
        </div>

        <AuditFilters onFilter={handleFilter} />

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : (
          <>
            <AuditTable logs={logs} onRowClick={setSelectedLog} />
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              pageSize={pagination.limit}
              onPageChange={(page) => setPagination((prev) => ({ ...prev, page }))}
              onPageSizeChange={(limit) => setPagination((prev) => ({ ...prev, limit, page: 1 }))}
            />
          </>
        )}

        <AuditDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
      </div>
    </div>
  );
}`,
  },
];
