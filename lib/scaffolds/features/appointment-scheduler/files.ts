/**
 * Appointment Scheduler Template - Files
 */

import { TemplateFile } from '../types';

export const appointmentSchedulerFiles: TemplateFile[] = [
  // ============================================================
  // LIB - Scheduling Logic
  // ============================================================
  {
    path: 'lib/scheduling/types.ts',
    type: 'type',
    content: `/**
 * Scheduling Types
 */

export type AppointmentType = 'in_person' | 'telehealth' | 'phone';
export type AppointmentStatus = 'scheduled' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

export interface Provider {
  id: number;
  name: string;
  specialty?: string;
  avatar?: string;
  location?: string;
}

export interface TimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
  providerId: number;
}

export interface Schedule {
  id: string;
  providerId: number;
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  startTime: string; // "09:00"
  endTime: string;   // "17:00"
  slotMinutes: number;
}

export interface Appointment {
  id: string;
  patientId: number;
  providerId: number;
  provider?: Provider;
  type: AppointmentType;
  startTime: Date;
  endTime: Date;
  status: AppointmentStatus;
  notes?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BookingRequest {
  providerId: number;
  startTime: Date;
  type: AppointmentType;
  notes?: string;
}
`,
  },
  {
    path: 'lib/scheduling/availability.ts',
    type: 'lib',
    content: `/**
 * Availability Calculator
 */

import { addMinutes, format, parse, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';
import { TimeSlot, Schedule } from './types';
import { prisma } from '@/lib/prisma';

export interface AvailabilityOptions {
  providerId: number;
  date: Date;
  duration?: number; // minutes, default 30
}

/**
 * Get available time slots for a provider on a specific date
 */
export async function getAvailableSlots(options: AvailabilityOptions): Promise<TimeSlot[]> {
  const { providerId, date, duration = 30 } = options;
  const dayOfWeek = date.getDay();

  // Get provider's schedule for this day
  const schedule = await prisma.schedule?.findFirst({
    where: {
      providerId,
      dayOfWeek,
    },
  });

  if (!schedule) {
    return []; // Provider doesn't work on this day
  }

  // Get existing appointments for this day
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const existingAppointments = await prisma.appointment?.findMany({
    where: {
      providerId,
      startTime: { gte: dayStart, lte: dayEnd },
      status: { in: ['scheduled', 'confirmed'] },
    },
    select: { startTime: true, endTime: true },
  }) || [];

  // Generate all possible slots
  const slots: TimeSlot[] = [];
  const slotDuration = schedule.slotMinutes || duration;

  let currentTime = parse(schedule.startTime, 'HH:mm', date);
  const endTime = parse(schedule.endTime, 'HH:mm', date);

  while (isBefore(currentTime, endTime)) {
    const slotEnd = addMinutes(currentTime, slotDuration);

    // Check if slot overlaps with existing appointments
    const isAvailable = !existingAppointments.some((apt) => {
      const aptStart = new Date(apt.startTime);
      const aptEnd = new Date(apt.endTime);
      return (
        (isBefore(currentTime, aptEnd) && isAfter(slotEnd, aptStart))
      );
    });

    // Don't show past slots for today
    const now = new Date();
    const isPast = isBefore(currentTime, now);

    if (!isPast) {
      slots.push({
        startTime: new Date(currentTime),
        endTime: slotEnd,
        available: isAvailable,
        providerId,
      });
    }

    currentTime = addMinutes(currentTime, slotDuration);
  }

  return slots;
}

/**
 * Get available dates for a provider in a date range
 */
export async function getAvailableDates(
  providerId: number,
  startDate: Date,
  endDate: Date
): Promise<Date[]> {
  // Get provider's schedule
  const schedules = await prisma.schedule?.findMany({
    where: { providerId },
    select: { dayOfWeek: true },
  }) || [];

  const workDays = new Set(schedules.map((s) => s.dayOfWeek));
  const availableDates: Date[] = [];

  let currentDate = new Date(startDate);
  while (isBefore(currentDate, endDate)) {
    if (workDays.has(currentDate.getDay())) {
      // Check if any slots are available on this day
      const slots = await getAvailableSlots({
        providerId,
        date: currentDate,
      });

      if (slots.some((s) => s.available)) {
        availableDates.push(new Date(currentDate));
      }
    }
    currentDate = new Date(currentDate.getTime() + 86400000); // Add 1 day
  }

  return availableDates;
}

/**
 * Check if a specific slot is available
 */
export async function isSlotAvailable(
  providerId: number,
  startTime: Date,
  endTime: Date
): Promise<boolean> {
  const conflicting = await prisma.appointment?.findFirst({
    where: {
      providerId,
      status: { in: ['scheduled', 'confirmed'] },
      OR: [
        {
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      ],
    },
  });

  return !conflicting;
}
`,
  },
  {
    path: 'lib/scheduling/slots.ts',
    type: 'lib',
    content: `/**
 * Time Slot Utilities
 */

import { format, addDays, startOfWeek, isSameDay } from 'date-fns';

export interface SlotGroup {
  date: Date;
  dateLabel: string;
  slots: Array<{
    time: string;
    startTime: Date;
    available: boolean;
  }>;
}

/**
 * Group slots by date for display
 */
export function groupSlotsByDate(
  slots: Array<{ startTime: Date; available: boolean }>
): SlotGroup[] {
  const groups = new Map<string, SlotGroup>();

  for (const slot of slots) {
    const dateKey = format(slot.startTime, 'yyyy-MM-dd');

    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: slot.startTime,
        dateLabel: format(slot.startTime, 'EEEE, MMMM d'),
        slots: [],
      });
    }

    groups.get(dateKey)!.slots.push({
      time: format(slot.startTime, 'h:mm a'),
      startTime: slot.startTime,
      available: slot.available,
    });
  }

  return Array.from(groups.values());
}

/**
 * Get week dates starting from a given date
 */
export function getWeekDates(startDate: Date): Date[] {
  const weekStart = startOfWeek(startDate);
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/**
 * Format time slot for display
 */
export function formatTimeSlot(startTime: Date, endTime: Date): string {
  return \`\${format(startTime, 'h:mm a')} - \${format(endTime, 'h:mm a')}\`;
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Get relative date label
 */
export function getRelativeDateLabel(date: Date): string {
  const today = new Date();
  const tomorrow = addDays(today, 1);

  if (isSameDay(date, today)) return 'Today';
  if (isSameDay(date, tomorrow)) return 'Tomorrow';
  return format(date, 'EEEE, MMM d');
}
`,
  },

  // ============================================================
  // API ROUTES
  // ============================================================
  {
    path: 'app/api/appointments/route.ts',
    type: 'api',
    content: `/**
 * Appointments API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { auditLog } from '@/lib/audit/logger';
import { isSlotAvailable } from '@/lib/scheduling/availability';
import { addMinutes } from 'date-fns';

// GET - List user's appointments
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const upcoming = searchParams.get('upcoming') === 'true';

    const appointments = await prisma.appointment.findMany({
      where: {
        patientId: userId,
        ...(status && { status }),
        ...(upcoming && { startTime: { gte: new Date() } }),
      },
      include: {
        provider: {
          select: { id: true, name: true, specialty: true },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json(appointments);
  } catch (error) {
    console.error('[Appointments API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointments' },
      { status: 500 }
    );
  }
}

// POST - Create new appointment
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { providerId, startTime, type, notes, duration = 30 } = body;

    if (!providerId || !startTime || !type) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const startDate = new Date(startTime);
    const endDate = addMinutes(startDate, duration);

    // Check availability
    const available = await isSlotAvailable(providerId, startDate, endDate);
    if (!available) {
      return NextResponse.json(
        { error: 'This time slot is no longer available' },
        { status: 409 }
      );
    }

    // Create appointment
    const appointment = await prisma.appointment.create({
      data: {
        patientId: userId,
        providerId,
        startTime: startDate,
        endTime: endDate,
        type,
        status: 'scheduled',
        notes,
      },
      include: {
        provider: {
          select: { id: true, name: true, specialty: true },
        },
      },
    });

    await auditLog({
      userId,
      userEmail: session.user.email || undefined,
      action: 'CREATE',
      resourceType: 'Appointment',
      resourceId: appointment.id,
      phiAccessed: true,
      details: { providerId, type },
    });

    return NextResponse.json(appointment, { status: 201 });
  } catch (error) {
    console.error('[Appointments API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create appointment' },
      { status: 500 }
    );
  }
}
`,
  },
  {
    path: 'app/api/appointments/[id]/route.ts',
    type: 'api',
    content: `/**
 * Single Appointment API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { auditLog } from '@/lib/audit/logger';
import { isSlotAvailable } from '@/lib/scheduling/availability';
import { addMinutes } from 'date-fns';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET - Get single appointment
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const userId = parseInt(session.user.id);

    const appointment = await prisma.appointment.findFirst({
      where: { id, patientId: userId },
      include: {
        provider: {
          select: { id: true, name: true, specialty: true, location: true },
        },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('[Appointments API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch appointment' },
      { status: 500 }
    );
  }
}

// PATCH - Reschedule or cancel
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await context.params;
    const userId = parseInt(session.user.id);
    const body = await request.json();
    const { action, startTime, notes } = body;

    // Verify ownership
    const existing = await prisma.appointment.findFirst({
      where: { id, patientId: userId },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    let updateData: any = {};

    if (action === 'cancel') {
      updateData.status = 'cancelled';
    } else if (action === 'reschedule' && startTime) {
      const newStart = new Date(startTime);
      const duration = (new Date(existing.endTime).getTime() - new Date(existing.startTime).getTime()) / 60000;
      const newEnd = addMinutes(newStart, duration);

      // Check new slot availability
      const available = await isSlotAvailable(existing.providerId, newStart, newEnd);
      if (!available) {
        return NextResponse.json(
          { error: 'This time slot is not available' },
          { status: 409 }
        );
      }

      updateData.startTime = newStart;
      updateData.endTime = newEnd;
      updateData.status = 'scheduled';
    }

    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        provider: {
          select: { id: true, name: true, specialty: true },
        },
      },
    });

    await auditLog({
      userId,
      userEmail: session.user.email || undefined,
      action: 'UPDATE',
      resourceType: 'Appointment',
      resourceId: id,
      phiAccessed: true,
      details: { action },
    });

    return NextResponse.json(appointment);
  } catch (error) {
    console.error('[Appointments API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update appointment' },
      { status: 500 }
    );
  }
}
`,
  },
  {
    path: 'app/api/appointments/availability/route.ts',
    type: 'api',
    content: `/**
 * Availability API
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAvailableSlots, getAvailableDates } from '@/lib/scheduling/availability';
import { addDays } from 'date-fns';

// GET - Get available slots or dates
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const providerId = parseInt(searchParams.get('providerId') || '0');
    const dateParam = searchParams.get('date');
    const mode = searchParams.get('mode') || 'slots'; // 'slots' or 'dates'

    if (!providerId) {
      return NextResponse.json(
        { error: 'Provider ID required' },
        { status: 400 }
      );
    }

    if (mode === 'dates') {
      // Return available dates in next 30 days
      const startDate = new Date();
      const endDate = addDays(startDate, 30);
      const dates = await getAvailableDates(providerId, startDate, endDate);

      return NextResponse.json({ dates });
    } else {
      // Return time slots for specific date
      if (!dateParam) {
        return NextResponse.json(
          { error: 'Date required for slots mode' },
          { status: 400 }
        );
      }

      const date = new Date(dateParam);
      const slots = await getAvailableSlots({ providerId, date });

      return NextResponse.json({ slots });
    }
  } catch (error) {
    console.error('[Availability API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch availability' },
      { status: 500 }
    );
  }
}
`,
  },
  {
    path: 'app/api/providers/route.ts',
    type: 'api',
    content: `/**
 * Providers API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - List providers
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const specialty = searchParams.get('specialty');
    const search = searchParams.get('search');

    const providers = await prisma.user.findMany({
      where: {
        role: 'provider',
        ...(specialty && { specialty }),
        ...(search && {
          name: { contains: search, mode: 'insensitive' },
        }),
      },
      select: {
        id: true,
        name: true,
        specialty: true,
        avatar: true,
        location: true,
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(providers);
  } catch (error) {
    console.error('[Providers API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch providers' },
      { status: 500 }
    );
  }
}
`,
  },

  // ============================================================
  // HOOKS
  // ============================================================
  {
    path: 'hooks/useAvailability.ts',
    type: 'hook',
    content: `/**
 * Availability Hook
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

interface TimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

interface UseAvailabilityOptions {
  providerId: number;
  date?: Date;
}

interface UseAvailabilityResult {
  slots: TimeSlot[];
  availableDates: Date[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAvailability({
  providerId,
  date,
}: UseAvailabilityOptions): UseAvailabilityResult {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [availableDates, setAvailableDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAvailableDates = useCallback(async () => {
    try {
      const response = await fetch(
        \`/api/appointments/availability?providerId=\${providerId}&mode=dates\`
      );
      if (!response.ok) throw new Error('Failed to fetch dates');

      const data = await response.json();
      setAvailableDates(data.dates.map((d: string) => new Date(d)));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch availability'));
    }
  }, [providerId]);

  const fetchSlots = useCallback(async () => {
    if (!date) return;

    setLoading(true);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const response = await fetch(
        \`/api/appointments/availability?providerId=\${providerId}&date=\${dateStr}\`
      );
      if (!response.ok) throw new Error('Failed to fetch slots');

      const data = await response.json();
      setSlots(
        data.slots.map((s: any) => ({
          ...s,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch slots'));
    } finally {
      setLoading(false);
    }
  }, [providerId, date]);

  useEffect(() => {
    fetchAvailableDates();
  }, [fetchAvailableDates]);

  useEffect(() => {
    if (date) {
      fetchSlots();
    }
  }, [date, fetchSlots]);

  const refetch = useCallback(async () => {
    await Promise.all([fetchAvailableDates(), fetchSlots()]);
  }, [fetchAvailableDates, fetchSlots]);

  return {
    slots,
    availableDates,
    loading,
    error,
    refetch,
  };
}
`,
  },
  {
    path: 'hooks/useAppointments.ts',
    type: 'hook',
    content: `/**
 * Appointments Hook
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Appointment, BookingRequest } from '@/lib/scheduling/types';

interface UseAppointmentsResult {
  appointments: Appointment[];
  loading: boolean;
  error: Error | null;
  book: (request: BookingRequest) => Promise<Appointment>;
  cancel: (id: string) => Promise<void>;
  reschedule: (id: string, newStartTime: Date) => Promise<Appointment>;
  refetch: () => Promise<void>;
}

export function useAppointments(options?: {
  upcoming?: boolean;
}): UseAppointmentsResult {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (options?.upcoming) params.set('upcoming', 'true');

      const response = await fetch(\`/api/appointments?\${params.toString()}\`);
      if (!response.ok) throw new Error('Failed to fetch appointments');

      const data = await response.json();
      setAppointments(
        data.map((apt: any) => ({
          ...apt,
          startTime: new Date(apt.startTime),
          endTime: new Date(apt.endTime),
          createdAt: new Date(apt.createdAt),
          updatedAt: new Date(apt.updatedAt),
        }))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch appointments'));
    } finally {
      setLoading(false);
    }
  }, [options?.upcoming]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  const book = useCallback(async (request: BookingRequest): Promise<Appointment> => {
    const response = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId: request.providerId,
        startTime: request.startTime.toISOString(),
        type: request.type,
        notes: request.notes,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to book appointment');
    }

    const appointment = await response.json();
    setAppointments((prev) => [...prev, {
      ...appointment,
      startTime: new Date(appointment.startTime),
      endTime: new Date(appointment.endTime),
    }]);

    return appointment;
  }, []);

  const cancel = useCallback(async (id: string): Promise<void> => {
    const response = await fetch(\`/api/appointments/\${id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel' }),
    });

    if (!response.ok) throw new Error('Failed to cancel appointment');

    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id ? { ...apt, status: 'cancelled' } : apt
      )
    );
  }, []);

  const reschedule = useCallback(async (id: string, newStartTime: Date): Promise<Appointment> => {
    const response = await fetch(\`/api/appointments/\${id}\`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'reschedule',
        startTime: newStartTime.toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to reschedule');
    }

    const appointment = await response.json();
    setAppointments((prev) =>
      prev.map((apt) =>
        apt.id === id
          ? {
              ...apt,
              startTime: new Date(appointment.startTime),
              endTime: new Date(appointment.endTime),
              status: 'scheduled',
            }
          : apt
      )
    );

    return appointment;
  }, []);

  return {
    appointments,
    loading,
    error,
    book,
    cancel,
    reschedule,
    refetch: fetchAppointments,
  };
}
`,
  },

  // ============================================================
  // COMPONENTS
  // ============================================================
  {
    path: 'components/scheduling/Calendar.tsx',
    type: 'component',
    content: `/**
 * Calendar Component
 */

'use client';

import { useState } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isAfter, isBefore } from 'date-fns';

interface CalendarProps {
  selectedDate?: Date;
  availableDates?: Date[];
  onSelect: (date: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function Calendar({
  selectedDate,
  availableDates = [],
  onSelect,
  minDate = new Date(),
  maxDate,
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()));

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth),
  });

  const isDateAvailable = (date: Date) => {
    return availableDates.some((d) => isSameDay(d, date));
  };

  const isDateDisabled = (date: Date) => {
    if (isBefore(date, minDate)) return true;
    if (maxDate && isAfter(date, maxDate)) return true;
    return !isDateAvailable(date);
  };

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Pad days to start on correct day of week
  const firstDayOfMonth = days[0].getDay();
  const paddedDays = Array(firstDayOfMonth).fill(null).concat(days);

  return (
    <div className="bg-white rounded-lg border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded"
        >
          ←
        </button>
        <h3 className="font-semibold">
          {format(currentMonth, 'MMMM yyyy')}
        </h3>
        <button
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="p-2 hover:bg-gray-100 rounded"
        >
          →
        </button>
      </div>

      {/* Week days header */}
      <div className="grid grid-cols-7 mb-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center text-sm text-gray-500 py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {paddedDays.map((date, index) => {
          if (!date) {
            return <div key={\`empty-\${index}\`} />;
          }

          const isSelected = selectedDate && isSameDay(date, selectedDate);
          const isDisabled = isDateDisabled(date);
          const isCurrentMonth = isSameMonth(date, currentMonth);
          const isAvailable = isDateAvailable(date);

          return (
            <button
              key={date.toISOString()}
              onClick={() => !isDisabled && onSelect(date)}
              disabled={isDisabled}
              className={\`
                p-2 text-center rounded-lg text-sm
                \${!isCurrentMonth ? 'text-gray-300' : ''}
                \${isSelected ? 'bg-blue-600 text-white' : ''}
                \${!isSelected && isAvailable ? 'bg-blue-50 text-blue-700 hover:bg-blue-100' : ''}
                \${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
              \`}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'components/scheduling/TimeSlots.tsx',
    type: 'component',
    content: `/**
 * Time Slots Component
 */

'use client';

import { format } from 'date-fns';

interface TimeSlot {
  startTime: Date;
  endTime: Date;
  available: boolean;
}

interface TimeSlotsProps {
  slots: TimeSlot[];
  selectedSlot?: Date;
  onSelect: (slot: TimeSlot) => void;
  loading?: boolean;
}

export function TimeSlots({
  slots,
  selectedSlot,
  onSelect,
  loading,
}: TimeSlotsProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const availableSlots = slots.filter((s) => s.available);

  if (availableSlots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No available times on this date
      </div>
    );
  }

  // Group by morning, afternoon, evening
  const morning = availableSlots.filter((s) => s.startTime.getHours() < 12);
  const afternoon = availableSlots.filter(
    (s) => s.startTime.getHours() >= 12 && s.startTime.getHours() < 17
  );
  const evening = availableSlots.filter((s) => s.startTime.getHours() >= 17);

  const renderSlotGroup = (title: string, groupSlots: TimeSlot[]) => {
    if (groupSlots.length === 0) return null;

    return (
      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-500 mb-2">{title}</h4>
        <div className="grid grid-cols-3 gap-2">
          {groupSlots.map((slot) => {
            const isSelected =
              selectedSlot &&
              slot.startTime.getTime() === selectedSlot.getTime();

            return (
              <button
                key={slot.startTime.toISOString()}
                onClick={() => onSelect(slot)}
                className={\`
                  px-3 py-2 text-sm rounded-lg border transition-colors
                  \${isSelected
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500 hover:bg-blue-50'
                  }
                \`}
              >
                {format(slot.startTime, 'h:mm a')}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderSlotGroup('Morning', morning)}
      {renderSlotGroup('Afternoon', afternoon)}
      {renderSlotGroup('Evening', evening)}
    </div>
  );
}
`,
  },
  {
    path: 'components/scheduling/ProviderSelect.tsx',
    type: 'component',
    content: `/**
 * Provider Select Component
 */

'use client';

import { useState, useEffect } from 'react';
import { Provider } from '@/lib/scheduling/types';

interface ProviderSelectProps {
  value?: number;
  onChange: (provider: Provider) => void;
  specialty?: string;
}

export function ProviderSelect({
  value,
  onChange,
  specialty,
}: ProviderSelectProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    async function fetchProviders() {
      try {
        const params = new URLSearchParams();
        if (specialty) params.set('specialty', specialty);
        if (search) params.set('search', search);

        const response = await fetch(\`/api/providers?\${params.toString()}\`);
        if (response.ok) {
          const data = await response.json();
          setProviders(data);
        }
      } catch (error) {
        console.error('Failed to fetch providers:', error);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(fetchProviders, 300);
    return () => clearTimeout(debounce);
  }, [specialty, search]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search providers..."
        className="w-full px-4 py-2 border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {providers.map((provider) => {
          const isSelected = value === provider.id;

          return (
            <button
              key={provider.id}
              onClick={() => onChange(provider)}
              className={\`w-full p-4 text-left rounded-lg border transition-colors \${
                isSelected
                  ? 'border-blue-600 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }\`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  {provider.avatar ? (
                    <img
                      src={provider.avatar}
                      alt={provider.name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <span className="text-blue-600 font-semibold">
                      {provider.name.charAt(0)}
                    </span>
                  )}
                </div>
                <div>
                  <p className="font-medium">{provider.name}</p>
                  {provider.specialty && (
                    <p className="text-sm text-gray-500">{provider.specialty}</p>
                  )}
                  {provider.location && (
                    <p className="text-xs text-gray-400">📍 {provider.location}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}

        {providers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No providers found
          </div>
        )}
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'components/scheduling/BookingConfirm.tsx',
    type: 'component',
    content: `/**
 * Booking Confirmation Modal
 */

'use client';

import { format } from 'date-fns';
import { Provider, AppointmentType } from '@/lib/scheduling/types';

interface BookingConfirmProps {
  provider: Provider;
  date: Date;
  time: Date;
  type: AppointmentType;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const typeLabels: Record<AppointmentType, string> = {
  in_person: 'In-Person Visit',
  telehealth: 'Video Visit',
  phone: 'Phone Call',
};

export function BookingConfirm({
  provider,
  date,
  time,
  type,
  onConfirm,
  onCancel,
  loading,
}: BookingConfirmProps) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold mb-4">Confirm Appointment</h2>

        <div className="space-y-4 mb-6">
          {/* Provider */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-lg">
                {provider.name.charAt(0)}
              </span>
            </div>
            <div>
              <p className="font-medium">{provider.name}</p>
              {provider.specialty && (
                <p className="text-sm text-gray-500">{provider.specialty}</p>
              )}
            </div>
          </div>

          {/* Date & Time */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Date & Time</p>
            <p className="font-medium">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-blue-600">{format(time, 'h:mm a')}</p>
          </div>

          {/* Visit Type */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-500">Visit Type</p>
            <p className="font-medium">{typeLabels[type]}</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Booking...' : 'Confirm Booking'}
          </button>
        </div>
      </div>
    </div>
  );
}
`,
  },

  // ============================================================
  // PAGES
  // ============================================================
  {
    path: 'app/(scheduling)/book/page.tsx',
    type: 'page',
    content: `/**
 * Booking Wizard Page
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Provider, AppointmentType } from '@/lib/scheduling/types';
import { useAvailability } from '@/hooks/useAvailability';
import { useAppointments } from '@/hooks/useAppointments';
import { ProviderSelect } from '@/components/scheduling/ProviderSelect';
import { Calendar } from '@/components/scheduling/Calendar';
import { TimeSlots } from '@/components/scheduling/TimeSlots';
import { BookingConfirm } from '@/components/scheduling/BookingConfirm';

type Step = 'provider' | 'type' | 'date' | 'time' | 'confirm';

const visitTypes: { type: AppointmentType; label: string; icon: string }[] = [
  { type: 'in_person', label: 'In-Person Visit', icon: '🏥' },
  { type: 'telehealth', label: 'Video Visit', icon: '💻' },
  { type: 'phone', label: 'Phone Call', icon: '📞' },
];

export default function BookingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('provider');
  const [provider, setProvider] = useState<Provider | null>(null);
  const [visitType, setVisitType] = useState<AppointmentType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<Date | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  const { slots, availableDates, loading: slotsLoading } = useAvailability({
    providerId: provider?.id || 0,
    date: selectedDate || undefined,
  });

  const { book } = useAppointments();

  const handleProviderSelect = (p: Provider) => {
    setProvider(p);
    setStep('type');
  };

  const handleTypeSelect = (type: AppointmentType) => {
    setVisitType(type);
    setStep('date');
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setStep('time');
  };

  const handleTimeSelect = (slot: { startTime: Date }) => {
    setSelectedTime(slot.startTime);
    setStep('confirm');
  };

  const handleConfirm = async () => {
    if (!provider || !visitType || !selectedTime) return;

    setBookingLoading(true);
    try {
      await book({
        providerId: provider.id,
        startTime: selectedTime,
        type: visitType,
      });
      router.push('/portal/appointments?success=true');
    } catch (error) {
      console.error('Booking failed:', error);
    } finally {
      setBookingLoading(false);
    }
  };

  const goBack = () => {
    const steps: Step[] = ['provider', 'type', 'date', 'time', 'confirm'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          {['Provider', 'Type', 'Date', 'Time', 'Confirm'].map((label, i) => {
            const steps: Step[] = ['provider', 'type', 'date', 'time', 'confirm'];
            const isActive = steps.indexOf(step) >= i;
            return (
              <div key={label} className="flex items-center">
                <div className={\`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium \${
                  isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }\`}>
                  {i + 1}
                </div>
                <span className={\`ml-2 text-sm \${isActive ? 'text-blue-600' : 'text-gray-400'}\`}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Steps */}
      {step === 'provider' && (
        <div>
          <h1 className="text-2xl font-bold mb-6">Select a Provider</h1>
          <ProviderSelect onChange={handleProviderSelect} />
        </div>
      )}

      {step === 'type' && (
        <div>
          <button onClick={goBack} className="text-blue-600 mb-4">← Back</button>
          <h1 className="text-2xl font-bold mb-6">Select Visit Type</h1>
          <div className="space-y-3">
            {visitTypes.map(({ type, label, icon }) => (
              <button
                key={type}
                onClick={() => handleTypeSelect(type)}
                className="w-full p-4 text-left border rounded-lg hover:border-blue-500 hover:bg-blue-50 flex items-center gap-4"
              >
                <span className="text-2xl">{icon}</span>
                <span className="font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 'date' && provider && (
        <div>
          <button onClick={goBack} className="text-blue-600 mb-4">← Back</button>
          <h1 className="text-2xl font-bold mb-6">Select a Date</h1>
          <Calendar
            selectedDate={selectedDate || undefined}
            availableDates={availableDates}
            onSelect={handleDateSelect}
          />
        </div>
      )}

      {step === 'time' && provider && selectedDate && (
        <div>
          <button onClick={goBack} className="text-blue-600 mb-4">← Back</button>
          <h1 className="text-2xl font-bold mb-6">Select a Time</h1>
          <TimeSlots
            slots={slots}
            selectedSlot={selectedTime || undefined}
            onSelect={handleTimeSelect}
            loading={slotsLoading}
          />
        </div>
      )}

      {step === 'confirm' && provider && visitType && selectedDate && selectedTime && (
        <BookingConfirm
          provider={provider}
          date={selectedDate}
          time={selectedTime}
          type={visitType}
          onConfirm={handleConfirm}
          onCancel={goBack}
          loading={bookingLoading}
        />
      )}
    </div>
  );
}
`,
  },
];
