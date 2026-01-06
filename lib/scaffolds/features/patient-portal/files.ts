/**
 * Patient Portal Template - Files
 */

import { TemplateFile } from '../types';

export const patientPortalFiles: TemplateFile[] = [
  // ============================================================
  // HOOKS
  // ============================================================
  {
    path: 'hooks/usePatientData.ts',
    type: 'hook',
    content: `/**
 * Patient Data Hook - Aggregates patient data from multiple sources
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useFhirPatient, useFhirConditions, useFhirMedications, useFhirObservations } from '@/hooks/useFhir';
import { useConversations } from '@/hooks/useConversations';

interface PatientDataResult {
  patient: any;
  conditions: any[];
  medications: any[];
  vitals: any[];
  conversations: any[];
  unreadMessages: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function usePatientData(): PatientDataResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { data: patient, loading: patientLoading, error: patientError } = useFhirPatient();
  const { data: conditions, loading: conditionsLoading } = useFhirConditions();
  const { data: medications, loading: medicationsLoading } = useFhirMedications();
  const { data: vitals, loading: vitalsLoading } = useFhirObservations({ category: 'vital-signs' });
  const { conversations, loading: convsLoading } = useConversations();

  const isLoading = patientLoading || conditionsLoading || medicationsLoading || vitalsLoading || convsLoading;

  useEffect(() => {
    setLoading(isLoading);
    if (patientError) {
      setError(patientError);
    }
  }, [isLoading, patientError]);

  const unreadMessages = conversations.reduce(
    (sum, conv) => sum + (conv.unreadCount || 0),
    0
  );

  const refetch = useCallback(async () => {
    // Refetch logic would go here
    setLoading(true);
    // Individual hooks handle their own refetching
  }, []);

  return {
    patient,
    conditions: conditions || [],
    medications: medications || [],
    vitals: vitals || [],
    conversations,
    unreadMessages,
    loading,
    error,
    refetch,
  };
}
`,
  },
  {
    path: 'hooks/usePortalStats.ts',
    type: 'hook',
    content: `/**
 * Portal Statistics Hook
 */

'use client';

import { useState, useEffect } from 'react';

interface PortalStats {
  upcomingAppointments: number;
  unreadMessages: number;
  pendingActions: number;
  lastVisit: Date | null;
}

interface UsePortalStatsResult {
  stats: PortalStats;
  loading: boolean;
  error: Error | null;
}

export function usePortalStats(): UsePortalStatsResult {
  const [stats, setStats] = useState<PortalStats>({
    upcomingAppointments: 0,
    unreadMessages: 0,
    pendingActions: 0,
    lastVisit: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/portal/stats');
        if (!response.ok) throw new Error('Failed to fetch stats');

        const data = await response.json();
        setStats({
          upcomingAppointments: data.upcomingAppointments || 0,
          unreadMessages: data.unreadMessages || 0,
          pendingActions: data.pendingActions || 0,
          lastVisit: data.lastVisit ? new Date(data.lastVisit) : null,
        });
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch stats'));
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return { stats, loading, error };
}
`,
  },

  // ============================================================
  // COMPONENTS
  // ============================================================
  {
    path: 'components/portal/PortalNav.tsx',
    type: 'component',
    content: `/**
 * Portal Navigation Sidebar
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  badge?: number;
}

interface PortalNavProps {
  unreadMessages?: number;
  upcomingAppointments?: number;
}

export function PortalNav({ unreadMessages = 0, upcomingAppointments = 0 }: PortalNavProps) {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { href: '/portal/dashboard', label: 'Dashboard', icon: '🏠' },
    { href: '/portal/records', label: 'Health Records', icon: '📋' },
    {
      href: '/portal/appointments',
      label: 'Appointments',
      icon: '📅',
      badge: upcomingAppointments,
    },
    {
      href: '/portal/messages',
      label: 'Messages',
      icon: '💬',
      badge: unreadMessages,
    },
    { href: '/portal/profile', label: 'My Profile', icon: '👤' },
  ];

  return (
    <nav className="w-64 bg-white border-r h-full">
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold text-blue-600">My Health Portal</h1>
      </div>

      <ul className="py-4">
        {navItems.map((item) => {
          const isActive = pathname === item.href;

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={\`flex items-center justify-between px-4 py-3 text-sm transition-colors \${
                  isActive
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700'
                    : 'text-gray-600 hover:bg-gray-50'
                }\`}
              >
                <span className="flex items-center gap-3">
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </span>
                {item.badge ? (
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="absolute bottom-0 left-0 right-0 p-4 border-t">
        <Link
          href="/auth/logout"
          className="flex items-center gap-3 text-sm text-gray-600 hover:text-red-600"
        >
          <span>🚪</span>
          <span>Sign Out</span>
        </Link>
      </div>
    </nav>
  );
}
`,
  },
  {
    path: 'components/portal/RecordCard.tsx',
    type: 'component',
    content: `/**
 * Record Card Component
 */

'use client';

import { format } from 'date-fns';

interface RecordCardProps {
  type: 'condition' | 'medication' | 'observation' | 'immunization';
  title: string;
  subtitle?: string;
  date?: Date | string;
  status?: string;
  onClick?: () => void;
}

const typeConfig = {
  condition: { icon: '🏥', color: 'yellow' },
  medication: { icon: '💊', color: 'green' },
  observation: { icon: '📊', color: 'blue' },
  immunization: { icon: '💉', color: 'purple' },
};

export function RecordCard({
  type,
  title,
  subtitle,
  date,
  status,
  onClick,
}: RecordCardProps) {
  const config = typeConfig[type];

  return (
    <div
      onClick={onClick}
      className={\`p-4 bg-white border rounded-lg hover:shadow-md transition-shadow \${
        onClick ? 'cursor-pointer' : ''
      }\`}
    >
      <div className="flex items-start gap-3">
        <div className={\`p-2 rounded-lg bg-\${config.color}-50\`}>
          <span className="text-xl">{config.icon}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{title}</h3>
          {subtitle && (
            <p className="text-sm text-gray-500 truncate">{subtitle}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {date && (
              <span className="text-xs text-gray-400">
                {format(new Date(date), 'MMM d, yyyy')}
              </span>
            )}
            {status && (
              <span className={\`text-xs px-2 py-0.5 rounded-full \${
                status === 'active'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
              }\`}>
                {status}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'components/portal/AppointmentCard.tsx',
    type: 'component',
    content: `/**
 * Appointment Card Component
 */

'use client';

import { format, isToday, isTomorrow, isPast } from 'date-fns';

interface AppointmentCardProps {
  id: string;
  providerName: string;
  type: 'in_person' | 'telehealth' | 'phone';
  startTime: Date | string;
  endTime?: Date | string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  location?: string;
  onCancel?: () => void;
  onReschedule?: () => void;
  onJoin?: () => void;
}

const typeIcons = {
  in_person: '🏥',
  telehealth: '💻',
  phone: '📞',
};

export function AppointmentCard({
  id,
  providerName,
  type,
  startTime,
  status,
  location,
  onCancel,
  onReschedule,
  onJoin,
}: AppointmentCardProps) {
  const appointmentDate = new Date(startTime);
  const isPastAppointment = isPast(appointmentDate);

  const getDateLabel = () => {
    if (isToday(appointmentDate)) return 'Today';
    if (isTomorrow(appointmentDate)) return 'Tomorrow';
    return format(appointmentDate, 'EEEE, MMM d');
  };

  const getStatusBadge = () => {
    const styles = {
      scheduled: 'bg-yellow-100 text-yellow-700',
      confirmed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
      completed: 'bg-gray-100 text-gray-600',
    };
    return styles[status];
  };

  return (
    <div className="p-4 bg-white border rounded-lg">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <span className="text-xl">{typeIcons[type]}</span>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{providerName}</h3>
            <p className="text-sm text-gray-500 capitalize">
              {type.replace('_', ' ')} Visit
            </p>
            {location && (
              <p className="text-xs text-gray-400 mt-1">📍 {location}</p>
            )}
          </div>
        </div>
        <span className={\`text-xs px-2 py-1 rounded-full \${getStatusBadge()}\`}>
          {status}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm">
        <span className="font-medium text-blue-600">{getDateLabel()}</span>
        <span className="text-gray-400">•</span>
        <span className="text-gray-600">
          {format(appointmentDate, 'h:mm a')}
        </span>
      </div>

      {!isPastAppointment && status !== 'cancelled' && status !== 'completed' && (
        <div className="mt-4 flex gap-2">
          {type === 'telehealth' && onJoin && (
            <button
              onClick={onJoin}
              className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
            >
              Join Video Call
            </button>
          )}
          {onReschedule && (
            <button
              onClick={onReschedule}
              className="px-3 py-2 border border-gray-300 text-sm rounded-lg hover:bg-gray-50"
            >
              Reschedule
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-2 text-red-600 text-sm rounded-lg hover:bg-red-50"
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'components/portal/HealthSummary.tsx',
    type: 'component',
    content: `/**
 * Health Summary Widget
 */

'use client';

interface HealthSummaryProps {
  vitals?: Array<{
    code: string;
    display: string;
    value: number | string;
    unit: string;
    date: string;
  }>;
  conditions?: Array<{
    name: string;
    status: string;
  }>;
  loading?: boolean;
}

const VITAL_DISPLAY_ORDER = ['Blood Pressure', 'Heart Rate', 'Weight', 'BMI'];

export function HealthSummary({ vitals = [], conditions = [], loading }: HealthSummaryProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border p-6 animate-pulse">
        <div className="h-6 w-32 bg-gray-200 rounded mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  // Get latest vitals by type
  const latestVitals = new Map<string, typeof vitals[0]>();
  vitals.forEach((vital) => {
    const existing = latestVitals.get(vital.display);
    if (!existing || new Date(vital.date) > new Date(existing.date)) {
      latestVitals.set(vital.display, vital);
    }
  });

  const activeConditions = conditions.filter((c) => c.status === 'active');

  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">Health Summary</h2>

      {/* Vitals Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {VITAL_DISPLAY_ORDER.map((vitalName) => {
          const vital = latestVitals.get(vitalName);
          return (
            <div key={vitalName} className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">{vitalName}</p>
              {vital ? (
                <p className="text-lg font-semibold text-gray-900">
                  {typeof vital.value === 'number'
                    ? vital.value.toFixed(1)
                    : vital.value}
                  <span className="text-sm font-normal text-gray-500 ml-1">
                    {vital.unit}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-gray-400">No data</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Active Conditions */}
      {activeConditions.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Active Conditions
          </h3>
          <div className="flex flex-wrap gap-2">
            {activeConditions.slice(0, 5).map((condition, idx) => (
              <span
                key={idx}
                className="px-2 py-1 text-xs bg-yellow-50 text-yellow-700 rounded-full"
              >
                {condition.name}
              </span>
            ))}
            {activeConditions.length > 5 && (
              <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                +{activeConditions.length - 5} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'components/portal/QuickActions.tsx',
    type: 'component',
    content: `/**
 * Quick Actions Widget
 */

'use client';

import Link from 'next/link';

interface QuickAction {
  href: string;
  label: string;
  icon: string;
  description: string;
}

const actions: QuickAction[] = [
  {
    href: '/portal/appointments?action=book',
    label: 'Book Appointment',
    icon: '📅',
    description: 'Schedule a new visit',
  },
  {
    href: '/portal/messages?action=new',
    label: 'Send Message',
    icon: '✉️',
    description: 'Contact your care team',
  },
  {
    href: '/portal/prescriptions',
    label: 'Request Refill',
    icon: '💊',
    description: 'Refill your medications',
  },
  {
    href: '/portal/records/request',
    label: 'Request Records',
    icon: '📄',
    description: 'Get copies of your records',
  },
];

export function QuickActions() {
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
      <div className="grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex items-start gap-3 p-4 rounded-lg border hover:border-blue-300 hover:bg-blue-50 transition-colors"
          >
            <span className="text-2xl">{action.icon}</span>
            <div>
              <p className="font-medium text-gray-900">{action.label}</p>
              <p className="text-xs text-gray-500">{action.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
`,
  },

  // ============================================================
  // LAYOUT
  // ============================================================
  {
    path: 'app/(portal)/portal/layout.tsx',
    type: 'lib',
    content: `/**
 * Portal Layout
 */

'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { PortalNav } from '@/components/portal/PortalNav';
import { usePortalStats } from '@/hooks/usePortalStats';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const { stats } = usePortalStats();

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!session) {
    redirect('/auth/login?callbackUrl=/portal/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <PortalNav
        unreadMessages={stats.unreadMessages}
        upcomingAppointments={stats.upcomingAppointments}
      />
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
`,
  },

  // ============================================================
  // PAGES
  // ============================================================
  {
    path: 'app/(portal)/portal/dashboard/page.tsx',
    type: 'page',
    content: `/**
 * Portal Dashboard Page
 */

'use client';

import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { usePatientData } from '@/hooks/usePatientData';
import { usePortalStats } from '@/hooks/usePortalStats';
import { HealthSummary } from '@/components/portal/HealthSummary';
import { QuickActions } from '@/components/portal/QuickActions';
import { AppointmentCard } from '@/components/portal/AppointmentCard';
import { format } from 'date-fns';

export default function PortalDashboardPage() {
  const { data: session } = useSession();
  const { patient, vitals, conditions, loading } = usePatientData();
  const { stats } = usePortalStats();

  const userName = session?.user?.name || patient?.name?.[0]?.given?.[0] || 'there';

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Welcome Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {userName}!
        </h1>
        <p className="text-gray-500">
          Here's an overview of your health information
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 rounded-lg">
              <span className="text-xl">📅</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.upcomingAppointments}
              </p>
              <p className="text-sm text-gray-500">Upcoming Appointments</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-50 rounded-lg">
              <span className="text-xl">💬</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.unreadMessages}
              </p>
              <p className="text-sm text-gray-500">Unread Messages</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 rounded-lg">
              <span className="text-xl">⚡</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.pendingActions}
              </p>
              <p className="text-sm text-gray-500">Actions Needed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Health Summary & Quick Actions */}
        <div className="lg:col-span-2 space-y-6">
          <HealthSummary
            vitals={vitals}
            conditions={conditions.map((c: any) => ({
              name: c.code?.text || c.code?.coding?.[0]?.display || 'Unknown',
              status: c.clinicalStatus?.coding?.[0]?.code || 'unknown',
            }))}
            loading={loading}
          />

          <QuickActions />
        </div>

        {/* Right Column - Upcoming & Messages */}
        <div className="space-y-6">
          {/* Upcoming Appointments Widget */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upcoming</h2>
              <Link
                href="/portal/appointments"
                className="text-sm text-blue-600 hover:underline"
              >
                View All
              </Link>
            </div>
            <div className="text-center text-gray-500 py-4">
              <p>No upcoming appointments</p>
              <Link
                href="/portal/appointments?action=book"
                className="text-blue-600 text-sm hover:underline"
              >
                Book an appointment
              </Link>
            </div>
          </div>

          {/* Recent Messages Widget */}
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Messages</h2>
              <Link
                href="/portal/messages"
                className="text-sm text-blue-600 hover:underline"
              >
                View All
              </Link>
            </div>
            {stats.unreadMessages > 0 ? (
              <div className="text-center py-4">
                <p className="text-lg font-semibold text-blue-600">
                  {stats.unreadMessages} unread
                </p>
                <Link
                  href="/portal/messages"
                  className="text-sm text-gray-500 hover:underline"
                >
                  Check your inbox
                </Link>
              </div>
            ) : (
              <div className="text-center text-gray-500 py-4">
                <p>No new messages</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Last Visit */}
      {stats.lastVisit && (
        <div className="mt-6 text-sm text-gray-400">
          Last visit: {format(stats.lastVisit, 'MMMM d, yyyy')}
        </div>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'app/(portal)/portal/records/page.tsx',
    type: 'page',
    content: `/**
 * Portal Records Page
 */

'use client';

import { useState } from 'react';
import { usePatientData } from '@/hooks/usePatientData';
import { RecordCard } from '@/components/portal/RecordCard';

type RecordTab = 'conditions' | 'medications' | 'vitals' | 'immunizations';

export default function PortalRecordsPage() {
  const [activeTab, setActiveTab] = useState<RecordTab>('conditions');
  const { conditions, medications, vitals, loading } = usePatientData();

  const tabs: { id: RecordTab; label: string; count: number }[] = [
    { id: 'conditions', label: 'Conditions', count: conditions?.length || 0 },
    { id: 'medications', label: 'Medications', count: medications?.length || 0 },
    { id: 'vitals', label: 'Vitals', count: vitals?.length || 0 },
    { id: 'immunizations', label: 'Immunizations', count: 0 },
  ];

  const renderRecords = () => {
    if (loading) {
      return (
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      );
    }

    switch (activeTab) {
      case 'conditions':
        return conditions.length > 0 ? (
          <div className="grid gap-4">
            {conditions.map((condition: any) => (
              <RecordCard
                key={condition.id}
                type="condition"
                title={condition.code?.text || condition.code?.coding?.[0]?.display || 'Unknown'}
                status={condition.clinicalStatus?.coding?.[0]?.code}
                date={condition.onsetDateTime}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No conditions on record
          </div>
        );

      case 'medications':
        return medications.length > 0 ? (
          <div className="grid gap-4">
            {medications.map((med: any) => (
              <RecordCard
                key={med.id}
                type="medication"
                title={med.medicationCodeableConcept?.text || 'Unknown'}
                subtitle={med.dosageInstruction?.[0]?.text}
                status={med.status}
                date={med.authoredOn}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No active medications
          </div>
        );

      case 'vitals':
        return vitals.length > 0 ? (
          <div className="grid gap-4">
            {vitals.map((vital: any) => (
              <RecordCard
                key={vital.id}
                type="observation"
                title={vital.code?.text || vital.code?.coding?.[0]?.display || 'Unknown'}
                subtitle={\`\${vital.valueQuantity?.value} \${vital.valueQuantity?.unit || ''}\`}
                date={vital.effectiveDateTime}
              />
            ))}
          </div>
        ) : (
          <div className="text-center text-gray-500 py-8">
            No vitals recorded
          </div>
        );

      case 'immunizations':
        return (
          <div className="text-center text-gray-500 py-8">
            No immunization records
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Health Records</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={\`px-4 py-2 text-sm font-medium border-b-2 transition-colors \${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }\`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-gray-100 rounded-full text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Records */}
      {renderRecords()}
    </div>
  );
}
`,
  },
  {
    path: 'app/(portal)/portal/appointments/page.tsx',
    type: 'page',
    content: `/**
 * Portal Appointments Page
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { AppointmentCard } from '@/components/portal/AppointmentCard';
import { format, isPast } from 'date-fns';

interface Appointment {
  id: string;
  providerId: number;
  providerName: string;
  type: 'in_person' | 'telehealth' | 'phone';
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'confirmed' | 'cancelled' | 'completed';
  location?: string;
}

export default function PortalAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'upcoming' | 'past' | 'all'>('upcoming');

  useEffect(() => {
    async function fetchAppointments() {
      try {
        const response = await fetch('/api/appointments');
        if (response.ok) {
          const data = await response.json();
          setAppointments(data);
        }
      } catch (error) {
        console.error('Failed to fetch appointments:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAppointments();
  }, []);

  const filteredAppointments = appointments.filter((apt) => {
    const isUpcoming = !isPast(new Date(apt.startTime));
    if (filter === 'upcoming') return isUpcoming;
    if (filter === 'past') return !isUpcoming;
    return true;
  });

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
        <Link
          href="/book"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Book Appointment
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        {(['upcoming', 'past', 'all'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={\`px-4 py-2 rounded-lg text-sm font-medium transition-colors \${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }\`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Appointments List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : filteredAppointments.length > 0 ? (
        <div className="space-y-4">
          {filteredAppointments.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              {...appointment}
              onCancel={() => console.log('Cancel:', appointment.id)}
              onReschedule={() => console.log('Reschedule:', appointment.id)}
              onJoin={() => console.log('Join:', appointment.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No {filter} appointments</p>
          <Link
            href="/book"
            className="text-blue-600 hover:underline"
          >
            Book your first appointment
          </Link>
        </div>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'app/(portal)/portal/messages/page.tsx',
    type: 'page',
    content: `/**
 * Portal Messages Page
 * Wrapper around the messaging system
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useConversations } from '@/hooks/useConversations';
import { ConversationList } from '@/components/messaging/ConversationList';

export default function PortalMessagesPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { conversations, loading, createConversation } = useConversations();

  if (!session?.user?.id) {
    return null;
  }

  const userId = parseInt(session.user.id);

  const handleNewMessage = async () => {
    // In a real app, show a modal to select provider
    // For now, just navigate to the full messages page
    router.push('/messages?action=new');
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <button
          onClick={handleNewMessage}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          New Message
        </button>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : conversations.length > 0 ? (
        <div className="bg-white rounded-lg shadow">
          <ConversationList
            conversations={conversations}
            onSelect={(conv) => router.push(\`/messages/\${conv.id}\`)}
            currentUserId={userId}
          />
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">No messages yet</p>
          <button
            onClick={handleNewMessage}
            className="text-blue-600 hover:underline"
          >
            Send your first message
          </button>
        </div>
      )}
    </div>
  );
}
`,
  },
  {
    path: 'app/(portal)/portal/profile/page.tsx',
    type: 'page',
    content: `/**
 * Portal Profile Page
 */

'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useFhirPatient } from '@/hooks/useFhir';

export default function PortalProfilePage() {
  const { data: session } = useSession();
  const { data: patient, loading } = useFhirPatient();
  const [isEditing, setIsEditing] = useState(false);

  if (loading) {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="h-64 bg-gray-100 rounded" />
        </div>
      </div>
    );
  }

  const name = patient?.name?.[0];
  const fullName = name?.text || \`\${name?.given?.join(' ')} \${name?.family}\`.trim() || 'Unknown';
  const phone = patient?.telecom?.find((t: any) => t.system === 'phone')?.value;
  const email = patient?.telecom?.find((t: any) => t.system === 'email')?.value || session?.user?.email;
  const address = patient?.address?.[0];

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg"
        >
          {isEditing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      <div className="bg-white rounded-lg border p-6 space-y-6">
        {/* Personal Information */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Full Name</label>
              <p className="font-medium">{fullName}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Date of Birth</label>
              <p className="font-medium">
                {patient?.birthDate
                  ? new Date(patient.birthDate).toLocaleDateString()
                  : 'Not provided'}
              </p>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Gender</label>
              <p className="font-medium capitalize">{patient?.gender || 'Not provided'}</p>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Email</label>
              <p className="font-medium">{email || 'Not provided'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Phone</label>
              <p className="font-medium">{phone || 'Not provided'}</p>
            </div>
          </div>
        </section>

        {/* Address */}
        {address && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Address</h2>
            <div>
              <p className="font-medium">
                {address.line?.join(', ')}
                <br />
                {address.city}, {address.state} {address.postalCode}
              </p>
            </div>
          </section>
        )}

        {/* Preferences */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Preferences</h2>
          <div className="space-y-3">
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm">Receive appointment reminders</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded" defaultChecked />
              <span className="text-sm">Receive message notifications</span>
            </label>
            <label className="flex items-center gap-3">
              <input type="checkbox" className="rounded" />
              <span className="text-sm">Allow text message notifications</span>
            </label>
          </div>
        </section>

        {isEditing && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                // Save logic here
                setIsEditing(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Changes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
`,
  },

  // ============================================================
  // API ROUTE
  // ============================================================
  {
    path: 'app/api/portal/stats/route.ts',
    type: 'api',
    content: `/**
 * Portal Stats API
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Get upcoming appointments count
    const upcomingAppointments = await prisma.appointment?.count({
      where: {
        patientId: userId,
        startTime: { gte: new Date() },
        status: { in: ['scheduled', 'confirmed'] },
      },
    }).catch(() => 0) || 0;

    // Get unread messages count
    const unreadMessages = await prisma.message?.count({
      where: {
        conversation: {
          participants: {
            some: { userId },
          },
        },
        senderId: { not: userId },
        readAt: null,
      },
    }).catch(() => 0) || 0;

    // Get pending actions (e.g., unsigned forms, pending payments)
    const pendingActions = 0; // TODO: Implement based on your app's needs

    // Get last visit date
    const lastAppointment = await prisma.appointment?.findFirst({
      where: {
        patientId: userId,
        status: 'completed',
      },
      orderBy: { endTime: 'desc' },
      select: { endTime: true },
    }).catch(() => null);

    return NextResponse.json({
      upcomingAppointments,
      unreadMessages,
      pendingActions,
      lastVisit: lastAppointment?.endTime || null,
    });
  } catch (error) {
    console.error('[Portal Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
`,
  },
];
