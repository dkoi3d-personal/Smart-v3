/**
 * Patient Portal Template - Tests
 */

import { TemplateTests } from '../types';

export const patientPortalTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/portal/hooks.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { usePortalStats } from '@/hooks/usePortalStats';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('usePortalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches portal statistics', async () => {
    const mockStats = {
      upcomingAppointments: 2,
      unreadMessages: 5,
      pendingActions: 1,
      lastVisit: '2024-01-15T10:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockStats),
    });

    const { result } = renderHook(() => usePortalStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.stats.upcomingAppointments).toBe(2);
    expect(result.current.stats.unreadMessages).toBe(5);
    expect(result.current.stats.pendingActions).toBe(1);
    expect(result.current.stats.lastVisit).toEqual(new Date('2024-01-15T10:00:00Z'));
  });

  it('handles fetch error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => usePortalStats());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
  });
});
`,
    },
    {
      path: '__tests__/portal/components.test.tsx',
      content: `import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RecordCard } from '@/components/portal/RecordCard';
import { AppointmentCard } from '@/components/portal/AppointmentCard';
import { HealthSummary } from '@/components/portal/HealthSummary';

describe('RecordCard', () => {
  it('renders condition card', () => {
    render(
      <RecordCard
        type="condition"
        title="Type 2 Diabetes"
        status="active"
        date={new Date('2024-01-15')}
      />
    );

    expect(screen.getByText('Type 2 Diabetes')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('renders medication card with subtitle', () => {
    render(
      <RecordCard
        type="medication"
        title="Metformin 500mg"
        subtitle="Take twice daily"
        status="active"
      />
    );

    expect(screen.getByText('Metformin 500mg')).toBeInTheDocument();
    expect(screen.getByText('Take twice daily')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const onClick = vi.fn();
    render(
      <RecordCard
        type="observation"
        title="Blood Pressure"
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText('Blood Pressure'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('AppointmentCard', () => {
  const baseProps = {
    id: '1',
    providerName: 'Dr. Smith',
    type: 'in_person' as const,
    startTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    status: 'scheduled' as const,
  };

  it('renders appointment details', () => {
    render(<AppointmentCard {...baseProps} />);

    expect(screen.getByText('Dr. Smith')).toBeInTheDocument();
    expect(screen.getByText(/In Person Visit/i)).toBeInTheDocument();
    expect(screen.getByText('scheduled')).toBeInTheDocument();
  });

  it('shows action buttons for upcoming appointments', () => {
    const onCancel = vi.fn();
    const onReschedule = vi.fn();

    render(
      <AppointmentCard
        {...baseProps}
        onCancel={onCancel}
        onReschedule={onReschedule}
      />
    );

    expect(screen.getByText('Reschedule')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('shows join button for telehealth appointments', () => {
    const onJoin = vi.fn();

    render(
      <AppointmentCard
        {...baseProps}
        type="telehealth"
        onJoin={onJoin}
      />
    );

    expect(screen.getByText('Join Video Call')).toBeInTheDocument();
  });
});

describe('HealthSummary', () => {
  it('renders loading state', () => {
    render(<HealthSummary loading />);

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders vitals', () => {
    const vitals = [
      { code: '1', display: 'Blood Pressure', value: '120/80', unit: 'mmHg', date: '2024-01-15' },
      { code: '2', display: 'Heart Rate', value: 72, unit: 'bpm', date: '2024-01-15' },
    ];

    render(<HealthSummary vitals={vitals} />);

    expect(screen.getByText('Blood Pressure')).toBeInTheDocument();
    expect(screen.getByText('Heart Rate')).toBeInTheDocument();
  });

  it('renders conditions', () => {
    const conditions = [
      { name: 'Hypertension', status: 'active' },
      { name: 'Diabetes', status: 'active' },
    ];

    render(<HealthSummary conditions={conditions} />);

    expect(screen.getByText('Hypertension')).toBeInTheDocument();
    expect(screen.getByText('Diabetes')).toBeInTheDocument();
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/portal/api.integration.test.ts',
      content: `import { describe, it, expect } from 'vitest';

describe('Portal API Integration', () => {
  it('GET /api/portal/stats returns statistics', async () => {
    const response = await fetch('http://localhost:3000/api/portal/stats', {
      headers: {
        Cookie: 'session=test-session',
      },
    });

    if (response.ok) {
      const data = await response.json();
      expect(typeof data.upcomingAppointments).toBe('number');
      expect(typeof data.unreadMessages).toBe('number');
      expect(typeof data.pendingActions).toBe('number');
    }
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/patient-portal.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Patient Portal', () => {
  test.beforeEach(async ({ page }) => {
    // Login as patient
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'patient@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/portal/dashboard');
  });

  test('dashboard displays welcome message', async ({ page }) => {
    await page.goto('/portal/dashboard');

    await expect(page.locator('h1')).toContainText('Welcome back');
  });

  test('dashboard shows statistics cards', async ({ page }) => {
    await page.goto('/portal/dashboard');

    await expect(page.locator('text=Upcoming Appointments')).toBeVisible();
    await expect(page.locator('text=Unread Messages')).toBeVisible();
    await expect(page.locator('text=Actions Needed')).toBeVisible();
  });

  test('navigation sidebar works', async ({ page }) => {
    await page.goto('/portal/dashboard');

    // Navigate to records
    await page.click('a:has-text("Health Records")');
    await expect(page).toHaveURL('/portal/records');

    // Navigate to appointments
    await page.click('a:has-text("Appointments")');
    await expect(page).toHaveURL('/portal/appointments');

    // Navigate to messages
    await page.click('a:has-text("Messages")');
    await expect(page).toHaveURL('/portal/messages');

    // Navigate to profile
    await page.click('a:has-text("My Profile")');
    await expect(page).toHaveURL('/portal/profile');
  });

  test('health records page shows tabs', async ({ page }) => {
    await page.goto('/portal/records');

    await expect(page.locator('button:has-text("Conditions")')).toBeVisible();
    await expect(page.locator('button:has-text("Medications")')).toBeVisible();
    await expect(page.locator('button:has-text("Vitals")')).toBeVisible();
  });

  test('appointments page shows book button', async ({ page }) => {
    await page.goto('/portal/appointments');

    await expect(page.locator('a:has-text("Book Appointment")')).toBeVisible();
  });

  test('profile page displays user information', async ({ page }) => {
    await page.goto('/portal/profile');

    await expect(page.locator('text=Personal Information')).toBeVisible();
    await expect(page.locator('text=Contact Information')).toBeVisible();
    await expect(page.locator('text=Preferences')).toBeVisible();
  });

  test('quick actions are clickable', async ({ page }) => {
    await page.goto('/portal/dashboard');

    // Check quick action buttons
    await expect(page.locator('text=Book Appointment')).toBeVisible();
    await expect(page.locator('text=Send Message')).toBeVisible();
    await expect(page.locator('text=Request Refill')).toBeVisible();
  });
});

test.describe('Portal Responsive Design', () => {
  test('sidebar collapses on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/portal/dashboard');

    // Sidebar should be hidden or collapsed on mobile
    // Implementation depends on your responsive design
  });
});
`,
    },
  ],
};
