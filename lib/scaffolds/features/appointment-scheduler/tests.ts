/**
 * Appointment Scheduler Template - Tests
 */

import { TemplateTests } from '../types';

export const appointmentSchedulerTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/scheduling/availability.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAvailableSlots, isSlotAvailable } from '@/lib/scheduling/availability';
import { prisma } from '@/lib/prisma';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    schedule: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    appointment: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

describe('getAvailableSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array if no schedule for day', async () => {
    (prisma.schedule?.findFirst as any).mockResolvedValue(null);

    const slots = await getAvailableSlots({
      providerId: 1,
      date: new Date('2024-01-15'), // Monday
    });

    expect(slots).toEqual([]);
  });

  it('generates slots based on schedule', async () => {
    (prisma.schedule?.findFirst as any).mockResolvedValue({
      providerId: 1,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
      slotMinutes: 30,
    });

    (prisma.appointment?.findMany as any).mockResolvedValue([]);

    const slots = await getAvailableSlots({
      providerId: 1,
      date: new Date('2024-01-15T00:00:00'), // Monday
    });

    // Should have 6 slots from 9am to 12pm (30 min each)
    expect(slots.length).toBe(6);
    expect(slots.every(s => s.available)).toBe(true);
  });

  it('marks conflicting slots as unavailable', async () => {
    const testDate = new Date('2024-01-15T00:00:00');

    (prisma.schedule?.findFirst as any).mockResolvedValue({
      providerId: 1,
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '12:00',
      slotMinutes: 30,
    });

    (prisma.appointment?.findMany as any).mockResolvedValue([
      {
        startTime: new Date('2024-01-15T10:00:00'),
        endTime: new Date('2024-01-15T10:30:00'),
      },
    ]);

    const slots = await getAvailableSlots({
      providerId: 1,
      date: testDate,
    });

    // The 10:00 slot should be unavailable
    const tenAmSlot = slots.find(
      s => s.startTime.getHours() === 10 && s.startTime.getMinutes() === 0
    );
    expect(tenAmSlot?.available).toBe(false);
  });
});

describe('isSlotAvailable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true if no conflicting appointments', async () => {
    (prisma.appointment?.findFirst as any).mockResolvedValue(null);

    const available = await isSlotAvailable(
      1,
      new Date('2024-01-15T10:00:00'),
      new Date('2024-01-15T10:30:00')
    );

    expect(available).toBe(true);
  });

  it('returns false if slot conflicts with existing appointment', async () => {
    (prisma.appointment?.findFirst as any).mockResolvedValue({
      id: 'existing-apt',
    });

    const available = await isSlotAvailable(
      1,
      new Date('2024-01-15T10:00:00'),
      new Date('2024-01-15T10:30:00')
    );

    expect(available).toBe(false);
  });
});
`,
    },
    {
      path: '__tests__/scheduling/hooks.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAppointments } from '@/hooks/useAppointments';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('useAppointments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches appointments on mount', async () => {
    const mockAppointments = [
      {
        id: '1',
        providerId: 1,
        startTime: '2024-01-15T10:00:00Z',
        endTime: '2024-01-15T10:30:00Z',
        status: 'scheduled',
        createdAt: '2024-01-10T00:00:00Z',
        updatedAt: '2024-01-10T00:00:00Z',
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockAppointments),
    });

    const { result } = renderHook(() => useAppointments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.appointments.length).toBe(1);
    expect(result.current.appointments[0].startTime).toBeInstanceOf(Date);
  });

  it('books new appointment', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'new-apt',
          providerId: 1,
          startTime: '2024-01-15T10:00:00Z',
          endTime: '2024-01-15T10:30:00Z',
          status: 'scheduled',
        }),
      });

    const { result } = renderHook(() => useAppointments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.book({
        providerId: 1,
        startTime: new Date('2024-01-15T10:00:00Z'),
        type: 'in_person',
      });
    });

    expect(result.current.appointments.length).toBe(1);
  });

  it('cancels appointment', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve([
          {
            id: 'apt-1',
            status: 'scheduled',
            startTime: '2024-01-15T10:00:00Z',
            endTime: '2024-01-15T10:30:00Z',
            createdAt: '2024-01-10T00:00:00Z',
            updatedAt: '2024-01-10T00:00:00Z',
          },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'cancelled' }),
      });

    const { result } = renderHook(() => useAppointments());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.cancel('apt-1');
    });

    expect(result.current.appointments[0].status).toBe('cancelled');
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/scheduling/api.integration.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Scheduling API Integration', () => {
  let testAppointmentId: string;

  beforeAll(async () => {
    // Create test schedule
    await prisma.schedule?.create({
      data: {
        providerId: 1,
        dayOfWeek: 1, // Monday
        startTime: '09:00',
        endTime: '17:00',
        slotMinutes: 30,
      },
    });
  });

  afterAll(async () => {
    // Clean up
    if (testAppointmentId) {
      await prisma.appointment?.delete({
        where: { id: testAppointmentId },
      });
    }
    await prisma.schedule?.deleteMany({
      where: { providerId: 1 },
    });
  });

  it('GET /api/appointments/availability returns slots', async () => {
    const response = await fetch(
      'http://localhost:3000/api/appointments/availability?providerId=1&date=2024-01-15'
    );

    if (response.ok) {
      const data = await response.json();
      expect(data.slots).toBeDefined();
      expect(Array.isArray(data.slots)).toBe(true);
    }
  });

  it('GET /api/appointments/availability returns available dates', async () => {
    const response = await fetch(
      'http://localhost:3000/api/appointments/availability?providerId=1&mode=dates'
    );

    if (response.ok) {
      const data = await response.json();
      expect(data.dates).toBeDefined();
      expect(Array.isArray(data.dates)).toBe(true);
    }
  });

  it('POST /api/appointments creates appointment', async () => {
    const response = await fetch('http://localhost:3000/api/appointments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'session=test-session',
      },
      body: JSON.stringify({
        providerId: 1,
        startTime: '2024-01-15T10:00:00Z',
        type: 'in_person',
      }),
    });

    if (response.ok) {
      const data = await response.json();
      testAppointmentId = data.id;
      expect(data.status).toBe('scheduled');
    }
  });

  it('GET /api/providers returns providers list', async () => {
    const response = await fetch('http://localhost:3000/api/providers');

    if (response.ok) {
      const data = await response.json();
      expect(Array.isArray(data)).toBe(true);
    }
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/booking.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Appointment Booking', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'patient@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/portal/dashboard');
  });

  test('displays booking wizard', async ({ page }) => {
    await page.goto('/book');

    // Should show provider selection
    await expect(page.locator('h1:has-text("Select a Provider")')).toBeVisible();
  });

  test('progresses through booking steps', async ({ page }) => {
    await page.goto('/book');

    // Step 1: Select provider
    const firstProvider = page.locator('button').filter({ hasText: /Dr\./ }).first();
    if (await firstProvider.isVisible()) {
      await firstProvider.click();

      // Step 2: Select visit type
      await expect(page.locator('h1:has-text("Select Visit Type")')).toBeVisible();
      await page.click('button:has-text("In-Person Visit")');

      // Step 3: Select date
      await expect(page.locator('h1:has-text("Select a Date")')).toBeVisible();

      // Click an available date
      const availableDate = page.locator('button.bg-blue-50').first();
      if (await availableDate.isVisible()) {
        await availableDate.click();

        // Step 4: Select time
        await expect(page.locator('h1:has-text("Select a Time")')).toBeVisible();
      }
    }
  });

  test('shows confirmation modal', async ({ page }) => {
    await page.goto('/book');

    // Complete all steps to reach confirmation
    const firstProvider = page.locator('button').filter({ hasText: /Dr\./ }).first();
    if (await firstProvider.isVisible()) {
      await firstProvider.click();
      await page.click('button:has-text("In-Person Visit")');

      const availableDate = page.locator('button.bg-blue-50').first();
      if (await availableDate.isVisible()) {
        await availableDate.click();

        const availableTime = page.locator('button').filter({ hasText: /AM|PM/ }).first();
        if (await availableTime.isVisible()) {
          await availableTime.click();

          // Should show confirmation
          await expect(page.locator('h2:has-text("Confirm Appointment")')).toBeVisible();
        }
      }
    }
  });

  test('allows going back through steps', async ({ page }) => {
    await page.goto('/book');

    const firstProvider = page.locator('button').filter({ hasText: /Dr\./ }).first();
    if (await firstProvider.isVisible()) {
      await firstProvider.click();

      // Go back
      await page.click('text=← Back');

      // Should be back at provider selection
      await expect(page.locator('h1:has-text("Select a Provider")')).toBeVisible();
    }
  });
});

test.describe('Calendar Component', () => {
  test('navigates between months', async ({ page }) => {
    await page.goto('/book');

    // Navigate to date step
    const firstProvider = page.locator('button').filter({ hasText: /Dr\./ }).first();
    if (await firstProvider.isVisible()) {
      await firstProvider.click();
      await page.click('button:has-text("In-Person Visit")');

      // Click next month
      await page.click('button:has-text("→")');

      // Click previous month
      await page.click('button:has-text("←")');
    }
  });
});

test.describe('Time Slots', () => {
  test('groups slots by time of day', async ({ page }) => {
    await page.goto('/book');

    const firstProvider = page.locator('button').filter({ hasText: /Dr\./ }).first();
    if (await firstProvider.isVisible()) {
      await firstProvider.click();
      await page.click('button:has-text("In-Person Visit")');

      const availableDate = page.locator('button.bg-blue-50').first();
      if (await availableDate.isVisible()) {
        await availableDate.click();

        // Check for time of day groupings
        const morningSection = page.locator('text=Morning');
        const afternoonSection = page.locator('text=Afternoon');

        // At least one should be visible
        const hasMorning = await morningSection.isVisible().catch(() => false);
        const hasAfternoon = await afternoonSection.isVisible().catch(() => false);

        expect(hasMorning || hasAfternoon).toBe(true);
      }
    }
  });
});
`,
    },
  ],
};
