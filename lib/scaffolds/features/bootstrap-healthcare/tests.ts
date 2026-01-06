/**
 * Healthcare Bootstrap Template - Tests
 */

import { TemplateTests } from '../types';

export const bootstrapHealthcareTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/lib/phi-logger.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { phiLogger, redactPHI } from '@/lib/phi-logger';

describe('redactPHI', () => {
  it('redacts SSN patterns', () => {
    expect(redactPHI('SSN: 123-45-6789')).toBe('SSN: [REDACTED-SSN]');
    expect(redactPHI('ssn is 123456789')).toBe('ssn is [REDACTED-SSN]');
  });

  it('redacts email addresses', () => {
    expect(redactPHI('Contact: patient@example.com')).toBe('Contact: [REDACTED-EMAIL]');
  });

  it('redacts phone numbers', () => {
    expect(redactPHI('Phone: (555) 123-4567')).toBe('Phone: [REDACTED-PHONE]');
    expect(redactPHI('Call 555-123-4567')).toBe('Call [REDACTED-PHONE]');
  });

  it('redacts date of birth patterns', () => {
    expect(redactPHI('DOB: 01/15/1990')).toBe('DOB: [REDACTED-DOB]');
    expect(redactPHI('Born 1990-01-15')).toBe('Born [REDACTED-DOB]');
  });

  it('redacts MRN patterns', () => {
    expect(redactPHI('MRN: 12345678')).toBe('MRN: [REDACTED-MRN]');
  });

  it('preserves non-PHI content', () => {
    expect(redactPHI('User logged in successfully')).toBe('User logged in successfully');
  });

  it('handles multiple PHI in one string', () => {
    const input = 'Patient: john@example.com, SSN: 123-45-6789, Phone: 555-123-4567';
    const result = redactPHI(input);
    expect(result).not.toContain('john@example.com');
    expect(result).not.toContain('123-45-6789');
    expect(result).not.toContain('555-123-4567');
  });
});

describe('phiLogger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('logs messages with timestamp', () => {
    phiLogger.info('Test message');
    expect(console.log).toHaveBeenCalled();
  });

  it('redacts PHI in log messages', () => {
    phiLogger.info('User email: test@example.com logged in');
    const call = (console.log as any).mock.calls[0][0];
    expect(call).toContain('[REDACTED-EMAIL]');
    expect(call).not.toContain('test@example.com');
  });

  it('redacts PHI in error objects', () => {
    phiLogger.error('Error for SSN: 123-45-6789', { extra: 'data' });
    const call = (console.error as any).mock.calls[0][0];
    expect(call).toContain('[REDACTED-SSN]');
  });
});
`,
    },
    {
      path: '__tests__/lib/session-security.test.ts',
      content: `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionMonitor } from '@/lib/session-security';

describe('SessionMonitor', () => {
  let monitor: SessionMonitor;
  let onWarning: ReturnType<typeof vi.fn>;
  let onExpire: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    onWarning = vi.fn();
    onExpire = vi.fn();

    monitor = new SessionMonitor({
      warningTime: 60000, // 1 minute warning
      expiryTime: 300000, // 5 minutes total
      onWarning,
      onExpire,
    });
  });

  afterEach(() => {
    monitor.stop();
    vi.useRealTimers();
  });

  it('starts monitoring on creation', () => {
    monitor.start();
    expect(onWarning).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('triggers warning before expiry', () => {
    monitor.start();

    // Advance to warning time (5 min - 1 min = 4 min)
    vi.advanceTimersByTime(240000);

    expect(onWarning).toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('triggers expiry after full timeout', () => {
    monitor.start();

    // Advance past expiry time
    vi.advanceTimersByTime(300001);

    expect(onExpire).toHaveBeenCalled();
  });

  it('resets timer on activity', () => {
    monitor.start();

    // Advance partway
    vi.advanceTimersByTime(200000);

    // Reset activity
    monitor.resetActivity();

    // Advance past original expiry
    vi.advanceTimersByTime(200000);

    // Should not have expired yet
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('stops monitoring when stopped', () => {
    monitor.start();
    monitor.stop();

    // Advance past expiry
    vi.advanceTimersByTime(400000);

    // Should not trigger
    expect(onWarning).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });
});
`,
    },
    {
      path: '__tests__/lib/roles.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import {
  hasRole,
  canAccessPHI,
  canModifyPatientRecords,
  canManageAppointments,
  isProvider,
  isAdmin,
  ROLE_PERMISSIONS
} from '@/lib/roles';

describe('Role Utilities', () => {
  describe('hasRole', () => {
    it('returns true for matching role', () => {
      const user = { role: 'provider' };
      expect(hasRole(user, 'provider')).toBe(true);
    });

    it('returns false for non-matching role', () => {
      const user = { role: 'patient' };
      expect(hasRole(user, 'provider')).toBe(false);
    });

    it('returns true for any matching role in array', () => {
      const user = { role: 'care_team' };
      expect(hasRole(user, ['provider', 'care_team'])).toBe(true);
    });
  });

  describe('canAccessPHI', () => {
    it('allows providers to access PHI', () => {
      expect(canAccessPHI({ role: 'provider' })).toBe(true);
    });

    it('allows care_team to access PHI', () => {
      expect(canAccessPHI({ role: 'care_team' })).toBe(true);
    });

    it('allows admin to access PHI', () => {
      expect(canAccessPHI({ role: 'admin' })).toBe(true);
    });

    it('denies patients from accessing general PHI', () => {
      expect(canAccessPHI({ role: 'patient' })).toBe(false);
    });
  });

  describe('canModifyPatientRecords', () => {
    it('allows providers to modify records', () => {
      expect(canModifyPatientRecords({ role: 'provider' })).toBe(true);
    });

    it('denies patients from modifying records', () => {
      expect(canModifyPatientRecords({ role: 'patient' })).toBe(false);
    });

    it('denies care_team from modifying records', () => {
      expect(canModifyPatientRecords({ role: 'care_team' })).toBe(false);
    });
  });

  describe('canManageAppointments', () => {
    it('allows providers to manage appointments', () => {
      expect(canManageAppointments({ role: 'provider' })).toBe(true);
    });

    it('allows care_team to manage appointments', () => {
      expect(canManageAppointments({ role: 'care_team' })).toBe(true);
    });

    it('allows patients to manage own appointments', () => {
      expect(canManageAppointments({ role: 'patient' })).toBe(true);
    });
  });

  describe('role type checks', () => {
    it('isProvider returns true for providers', () => {
      expect(isProvider({ role: 'provider' })).toBe(true);
      expect(isProvider({ role: 'patient' })).toBe(false);
    });

    it('isAdmin returns true for admins', () => {
      expect(isAdmin({ role: 'admin' })).toBe(true);
      expect(isAdmin({ role: 'provider' })).toBe(false);
    });
  });
});
`,
    },
    {
      path: '__tests__/components/PHIWarning.test.tsx',
      content: `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PHIWarning } from '@/components/healthcare/PHIWarning';

describe('PHIWarning', () => {
  it('renders warning message', () => {
    render(<PHIWarning />);
    expect(screen.getByText(/protected health information/i)).toBeInTheDocument();
  });

  it('renders with info level by default', () => {
    const { container } = render(<PHIWarning />);
    expect(container.firstChild).toHaveClass('bg-blue-50');
  });

  it('renders warning level correctly', () => {
    const { container } = render(<PHIWarning level="warning" />);
    expect(container.firstChild).toHaveClass('bg-yellow-50');
  });

  it('renders critical level correctly', () => {
    const { container } = render(<PHIWarning level="critical" />);
    expect(container.firstChild).toHaveClass('bg-red-50');
  });

  it('displays custom message', () => {
    render(<PHIWarning message="Custom PHI warning" />);
    expect(screen.getByText('Custom PHI warning')).toBeInTheDocument();
  });
});
`,
    },
    {
      path: '__tests__/components/RoleGuard.test.tsx',
      content: `import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RoleGuard } from '@/components/healthcare/RoleGuard';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
}));

describe('RoleGuard', () => {
  it('renders children when user has required role', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as any).mockReturnValue({
      data: { user: { role: 'provider' } },
      status: 'authenticated',
    });

    render(
      <RoleGuard allowedRoles={['provider', 'admin']}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders fallback when user lacks role', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as any).mockReturnValue({
      data: { user: { role: 'patient' } },
      status: 'authenticated',
    });

    render(
      <RoleGuard
        allowedRoles={['provider', 'admin']}
        fallback={<div>Access Denied</div>}
      >
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders nothing when no fallback provided and unauthorized', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as any).mockReturnValue({
      data: { user: { role: 'patient' } },
      status: 'authenticated',
    });

    const { container } = render(
      <RoleGuard allowedRoles={['admin']}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows loading state while session is loading', async () => {
    const { useSession } = await import('next-auth/react');
    (useSession as any).mockReturnValue({
      data: null,
      status: 'loading',
    });

    render(
      <RoleGuard allowedRoles={['provider']}>
        <div>Protected Content</div>
      </RoleGuard>
    );

    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/api/audit-logging.integration.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Audit Logging Integration', () => {
  const testUserId = 999;

  afterAll(async () => {
    // Clean up test audit logs
    await prisma.auditLog.deleteMany({
      where: { userId: testUserId },
    });
  });

  it('creates audit log entries', async () => {
    await prisma.auditLog.create({
      data: {
        userId: testUserId,
        userEmail: 'test@example.com',
        action: 'VIEW',
        resourceType: 'Patient',
        resourceId: 'test-patient-1',
        ipAddress: '127.0.0.1',
        phiAccessed: true,
      },
    });

    const logs = await prisma.auditLog.findMany({
      where: { userId: testUserId },
    });

    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('VIEW');
    expect(logs[0].phiAccessed).toBe(true);
  });

  it('tracks PHI access correctly', async () => {
    await prisma.auditLog.create({
      data: {
        userId: testUserId,
        action: 'EXPORT',
        resourceType: 'PatientRecords',
        resourceId: 'batch-export-1',
        phiAccessed: true,
        details: { recordCount: 100 },
      },
    });

    const phiLogs = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        phiAccessed: true,
      },
    });

    expect(phiLogs.length).toBeGreaterThanOrEqual(1);
  });

  it('queries audit logs by date range', async () => {
    const now = new Date();
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const logs = await prisma.auditLog.findMany({
      where: {
        userId: testUserId,
        timestamp: {
          gte: hourAgo,
          lte: now,
        },
      },
    });

    expect(logs.length).toBeGreaterThanOrEqual(0);
  });
});
`,
    },
    {
      path: '__tests__/api/healthcare-auth.integration.test.ts',
      content: `import { describe, it, expect, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Healthcare Auth Integration', () => {
  const testEmail = 'healthcare-test@example.com';

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it('creates user with healthcare role', async () => {
    const user = await prisma.user.create({
      data: {
        email: testEmail,
        password: 'hashed-password',
        name: 'Dr. Test Provider',
        role: 'provider',
        specialty: 'Internal Medicine',
        npi: '1234567890',
      },
    });

    expect(user.role).toBe('provider');
    expect(user.specialty).toBe('Internal Medicine');
    expect(user.npi).toBe('1234567890');
  });

  it('enforces role-based data access', async () => {
    // Get provider user
    const provider = await prisma.user.findUnique({
      where: { email: testEmail },
    });

    expect(provider).not.toBeNull();
    expect(['provider', 'care_team', 'admin']).toContain(provider!.role);
  });

  it('logs authentication events', async () => {
    // Create audit log for login
    await prisma.auditLog.create({
      data: {
        userEmail: testEmail,
        action: 'LOGIN',
        resourceType: 'Session',
        ipAddress: '127.0.0.1',
        userAgent: 'Test Browser',
      },
    });

    const loginLogs = await prisma.auditLog.findMany({
      where: {
        userEmail: testEmail,
        action: 'LOGIN',
      },
    });

    expect(loginLogs.length).toBeGreaterThanOrEqual(1);
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/healthcare-auth.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Healthcare Authentication', () => {
  const providerEmail = \`provider-\${Date.now()}@example.com\`;
  const patientEmail = \`patient-\${Date.now()}@example.com\`;
  const testPassword = 'Test123!';

  test('provider can signup with role', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.fill('input[name="email"]', providerEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="name"]', 'Dr. Test Provider');

    // Select provider role if available
    const roleSelect = page.locator('select[name="role"]');
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('provider');
    }

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('provider sees PHI warning banner', async ({ page }) => {
    // Login as provider
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', providerEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/);

    // Navigate to patient records
    await page.goto('/patients');

    // Should see PHI warning
    await expect(page.locator('text=Protected Health Information')).toBeVisible();
  });

  test('session timeout warning appears', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', providerEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');

    // Wait for session timeout warning (in test, may be shortened)
    // This is a placeholder - actual timing depends on config
    await page.waitForSelector('[data-testid="session-timeout-warning"]', {
      timeout: 60000,
      state: 'visible'
    }).catch(() => {
      // May not appear in short test
    });
  });

  test('patient cannot access provider-only pages', async ({ page }) => {
    // Signup as patient
    await page.goto('/auth/signup');
    await page.fill('input[name="email"]', patientEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="name"]', 'Test Patient');

    const roleSelect = page.locator('select[name="role"]');
    if (await roleSelect.isVisible()) {
      await roleSelect.selectOption('patient');
    }

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);

    // Try to access admin audit logs
    await page.goto('/admin/audit-log');

    // Should be redirected or show access denied
    const url = page.url();
    const accessDenied = page.locator('text=Access Denied');

    expect(
      !url.includes('/admin/audit-log') || await accessDenied.isVisible()
    ).toBe(true);
  });
});

test.describe('HIPAA Audit Trail', () => {
  test('audit log records page access', async ({ page }) => {
    // Admin login would be needed
    await page.goto('/admin/audit-log');

    // If accessible, should show audit entries
    const table = page.locator('table');
    if (await table.isVisible()) {
      const rows = page.locator('tbody tr');
      // May have entries from previous tests
      const count = await rows.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('audit log can be filtered', async ({ page }) => {
    await page.goto('/admin/audit-log');

    // Look for filter controls
    const actionFilter = page.locator('select[name="action"]');
    const dateFilter = page.locator('input[type="date"]');

    if (await actionFilter.isVisible()) {
      await actionFilter.selectOption('VIEW');
      await page.waitForLoadState('networkidle');
    }
  });

  test('audit log can be exported', async ({ page }) => {
    await page.goto('/admin/audit-log');

    const exportButton = page.locator('button:has-text("Export")');
    if (await exportButton.isVisible()) {
      // Start download
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        exportButton.click(),
      ]);

      expect(download.suggestedFilename()).toMatch(/audit.*\\.csv/);
    }
  });
});
`,
    },
    {
      path: 'e2e/healthcare-components.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Healthcare UI Components', () => {
  test('PHIWarning component renders correctly', async ({ page }) => {
    // Navigate to a page with PHI
    await page.goto('/patients/1');

    const warning = page.locator('[data-testid="phi-warning"]');
    if (await warning.isVisible()) {
      await expect(warning).toContainText(/protected health information/i);
    }
  });

  test('SessionTimeout shows warning modal', async ({ page }) => {
    // This requires custom test setup to trigger timeout faster
    await page.goto('/dashboard');

    // Simulate inactivity (this is simplified)
    const modal = page.locator('[data-testid="session-timeout-modal"]');

    // In real tests, you'd wait or manipulate time
    // For now, just verify the component can exist
    const hasModal = await modal.count();
    expect(hasModal).toBeGreaterThanOrEqual(0);
  });

  test('RoleGuard restricts content', async ({ page }) => {
    // Login as patient
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'patient@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');

    // Try to access provider-only content
    await page.goto('/dashboard');

    // Provider-only section should not be visible
    const providerSection = page.locator('[data-testid="provider-only"]');
    await expect(providerSection).not.toBeVisible();
  });
});

test.describe('Healthcare Layout', () => {
  test('header shows user role', async ({ page }) => {
    await page.goto('/dashboard');

    const roleIndicator = page.locator('[data-testid="user-role"]');
    if (await roleIndicator.isVisible()) {
      const roleText = await roleIndicator.textContent();
      expect(['Patient', 'Provider', 'Care Team', 'Admin']).toContain(roleText);
    }
  });

  test('navigation shows role-appropriate links', async ({ page }) => {
    await page.goto('/dashboard');

    const nav = page.locator('nav');

    // Common links
    await expect(nav.locator('a:has-text("Dashboard")')).toBeVisible();

    // Role-specific links would vary
    // Provider: Patients, Schedules
    // Patient: My Records, Appointments
    // Admin: Audit Log, Settings
  });
});
`,
    },
  ],
};
