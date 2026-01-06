/**
 * Audit Logger Template - Tests
 */

import { TemplateTests } from '../types';

export const auditLoggerTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/audit/logger.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { auditLog, queryAuditLogs, exportAuditLogs } from '@/lib/audit/logger';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    auditLog: {
      create: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('auditLog', () => {
    it('creates an audit log entry', async () => {
      const mockEntry = {
        id: 'test-id',
        timestamp: new Date(),
        userId: 1,
        userEmail: 'user@example.com',
        action: 'VIEW',
        resourceType: 'Patient',
        resourceId: 'patient-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        details: {},
        phiAccessed: true,
      };

      (prisma.auditLog.create as any).mockResolvedValue(mockEntry);

      const result = await auditLog({
        userId: 1,
        userEmail: 'user@example.com',
        action: 'VIEW',
        resourceType: 'Patient',
        resourceId: 'patient-123',
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
        phiAccessed: true,
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 1,
          userEmail: 'user@example.com',
          action: 'VIEW',
          resourceType: 'Patient',
          resourceId: 'patient-123',
          phiAccessed: true,
        }),
      });
      expect(result).toEqual(mockEntry);
    });

    it('handles missing optional fields', async () => {
      (prisma.auditLog.create as any).mockResolvedValue({ id: 'test-id' });

      await auditLog({
        action: 'LOGIN',
        resourceType: 'Session',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'LOGIN',
          resourceType: 'Session',
        }),
      });
    });
  });

  describe('queryAuditLogs', () => {
    it('queries logs with filters', async () => {
      const mockLogs = [
        { id: '1', action: 'VIEW', resourceType: 'Patient' },
        { id: '2', action: 'UPDATE', resourceType: 'Patient' },
      ];

      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as any).mockResolvedValue(2);

      const result = await queryAuditLogs({
        resourceType: 'Patient',
        page: 1,
        limit: 10,
      });

      expect(result.logs).toEqual(mockLogs);
      expect(result.total).toBe(2);
    });

    it('filters by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      await queryAuditLogs({
        startDate,
        endDate,
        page: 1,
        limit: 10,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            timestamp: {
              gte: startDate,
              lte: endDate,
            },
          }),
        })
      );
    });

    it('filters by PHI access', async () => {
      (prisma.auditLog.findMany as any).mockResolvedValue([]);
      (prisma.auditLog.count as any).mockResolvedValue(0);

      await queryAuditLogs({
        phiOnly: true,
        page: 1,
        limit: 10,
      });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            phiAccessed: true,
          }),
        })
      );
    });
  });

  describe('exportAuditLogs', () => {
    it('exports logs as CSV', async () => {
      const mockLogs = [
        {
          id: '1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          userId: 1,
          userEmail: 'user@example.com',
          action: 'VIEW',
          resourceType: 'Patient',
          resourceId: 'patient-123',
          ipAddress: '127.0.0.1',
          phiAccessed: true,
        },
      ];

      (prisma.auditLog.findMany as any).mockResolvedValue(mockLogs);

      const csv = await exportAuditLogs({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(csv).toContain('timestamp,userId,userEmail,action,resourceType');
      expect(csv).toContain('VIEW');
      expect(csv).toContain('Patient');
    });
  });
});
`,
    },
    {
      path: '__tests__/audit/middleware.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { withAuditLogging } from '@/lib/audit/middleware';
import { auditLog } from '@/lib/audit/logger';
import { NextRequest, NextResponse } from 'next/server';

vi.mock('@/lib/audit/logger', () => ({
  auditLog: vi.fn(),
}));

describe('Audit Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs successful requests', async () => {
    const mockHandler = vi.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    );

    const wrappedHandler = withAuditLogging(mockHandler, {
      action: 'VIEW',
      resourceType: 'Patient',
    });

    const request = new NextRequest('http://localhost/api/patients/123', {
      method: 'GET',
      headers: {
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'test-agent',
      },
    });

    await wrappedHandler(request, { params: { id: '123' } });

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VIEW',
        resourceType: 'Patient',
        resourceId: '123',
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      })
    );
  });

  it('logs errors with details', async () => {
    const mockHandler = vi.fn().mockRejectedValue(new Error('Test error'));

    const wrappedHandler = withAuditLogging(mockHandler, {
      action: 'UPDATE',
      resourceType: 'Patient',
    });

    const request = new NextRequest('http://localhost/api/patients/123', {
      method: 'PUT',
    });

    try {
      await wrappedHandler(request, { params: { id: '123' } });
    } catch (e) {
      // Expected error
    }

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        resourceType: 'Patient',
        details: expect.objectContaining({
          error: 'Test error',
        }),
      })
    );
  });

  it('extracts user info from session', async () => {
    const mockHandler = vi.fn().mockResolvedValue(
      NextResponse.json({ success: true })
    );

    const wrappedHandler = withAuditLogging(mockHandler, {
      action: 'VIEW',
      resourceType: 'Patient',
    });

    const request = new NextRequest('http://localhost/api/patients/123', {
      method: 'GET',
    });
    // Simulate session data attached to request
    (request as any).user = { id: 1, email: 'user@example.com' };

    await wrappedHandler(request, { params: { id: '123' } });

    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 1,
        userEmail: 'user@example.com',
      })
    );
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/audit/api.integration.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Audit API Integration', () => {
  const testLogs = [
    {
      userId: 1,
      userEmail: 'test@example.com',
      action: 'VIEW',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      phiAccessed: true,
      ipAddress: '127.0.0.1',
    },
    {
      userId: 1,
      userEmail: 'test@example.com',
      action: 'UPDATE',
      resourceType: 'Patient',
      resourceId: 'patient-1',
      phiAccessed: true,
      ipAddress: '127.0.0.1',
    },
    {
      userId: 2,
      userEmail: 'admin@example.com',
      action: 'EXPORT',
      resourceType: 'Report',
      resourceId: 'report-1',
      phiAccessed: false,
      ipAddress: '192.168.1.1',
    },
  ];

  beforeAll(async () => {
    // Seed test data
    for (const log of testLogs) {
      await prisma.auditLog.create({ data: log });
    }
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.auditLog.deleteMany({
      where: {
        userEmail: {
          in: ['test@example.com', 'admin@example.com'],
        },
      },
    });
  });

  it('GET /api/audit returns paginated logs', async () => {
    const response = await fetch('http://localhost:3000/api/audit?page=1&limit=10');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logs).toBeDefined();
    expect(data.total).toBeGreaterThanOrEqual(testLogs.length);
    expect(data.page).toBe(1);
  });

  it('GET /api/audit filters by action', async () => {
    const response = await fetch('http://localhost:3000/api/audit?action=VIEW');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logs.every((log: any) => log.action === 'VIEW')).toBe(true);
  });

  it('GET /api/audit filters by resourceType', async () => {
    const response = await fetch('http://localhost:3000/api/audit?resourceType=Patient');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logs.every((log: any) => log.resourceType === 'Patient')).toBe(true);
  });

  it('GET /api/audit filters by PHI access', async () => {
    const response = await fetch('http://localhost:3000/api/audit?phiOnly=true');
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.logs.every((log: any) => log.phiAccessed === true)).toBe(true);
  });

  it('GET /api/audit/export returns CSV', async () => {
    const response = await fetch('http://localhost:3000/api/audit/export');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');

    const csv = await response.text();
    expect(csv).toContain('timestamp,userId,userEmail,action');
  });

  it('GET /api/audit/export respects date filters', async () => {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    const endDate = new Date();

    const response = await fetch(
      \`http://localhost:3000/api/audit/export?startDate=\${startDate.toISOString()}&endDate=\${endDate.toISOString()}\`
    );

    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv.length).toBeGreaterThan(0);
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/audit-log.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Audit Log Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('displays audit log table', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Check table is visible
    await expect(page.locator('table')).toBeVisible();
    await expect(page.locator('th:has-text("Timestamp")')).toBeVisible();
    await expect(page.locator('th:has-text("Action")')).toBeVisible();
    await expect(page.locator('th:has-text("Resource")')).toBeVisible();
    await expect(page.locator('th:has-text("User")')).toBeVisible();
  });

  test('filters by action type', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Select action filter
    await page.selectOption('select[name="action"]', 'VIEW');
    await page.click('button:has-text("Apply Filters")');

    // Verify filtered results
    const rows = page.locator('tbody tr');
    await expect(rows.first()).toContainText('VIEW');
  });

  test('filters by date range', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Set date range
    const today = new Date().toISOString().split('T')[0];
    const lastWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await page.fill('input[name="startDate"]', lastWeek);
    await page.fill('input[name="endDate"]', today);
    await page.click('button:has-text("Apply Filters")');

    // Verify table updates
    await expect(page.locator('table')).toBeVisible();
  });

  test('filters by PHI access only', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Check PHI only filter
    await page.check('input[name="phiOnly"]');
    await page.click('button:has-text("Apply Filters")');

    // All visible rows should have PHI indicator
    const phiBadges = page.locator('tbody tr .phi-badge');
    const count = await phiBadges.count();
    if (count > 0) {
      await expect(phiBadges.first()).toBeVisible();
    }
  });

  test('opens audit detail modal', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Click on first row
    await page.locator('tbody tr').first().click();

    // Verify modal opens
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.locator('[role="dialog"] h2')).toContainText('Audit Details');
  });

  test('exports audit logs to CSV', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Start download listener
    const downloadPromise = page.waitForEvent('download');

    // Click export button
    await page.click('button:has-text("Export CSV")');

    // Verify download starts
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain('audit-log');
    expect(download.suggestedFilename()).toContain('.csv');
  });

  test('paginates through results', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Get initial first row content
    const firstRowInitial = await page.locator('tbody tr').first().textContent();

    // Click next page
    await page.click('button:has-text("Next")');

    // Verify content changed (if more than 1 page exists)
    const pageIndicator = page.locator('.page-indicator');
    const pageText = await pageIndicator.textContent();
    if (pageText?.includes('2')) {
      const firstRowAfter = await page.locator('tbody tr').first().textContent();
      expect(firstRowInitial).not.toBe(firstRowAfter);
    }
  });
});
`,
    },
  ],
};
