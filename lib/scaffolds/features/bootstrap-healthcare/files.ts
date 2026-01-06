/**
 * Healthcare Bootstrap Template - Files
 * Extends generic bootstrap with HIPAA compliance features
 */

import { TemplateFile } from '../types';

export const bootstrapHealthcareFiles: TemplateFile[] = [
  // ============================================================
  // EXTENDED ENV TEMPLATE
  // ============================================================
  {
    path: '.env.example',
    type: 'config',
    content: `# Database
DATABASE_URL="postgresql://user:password@localhost:5432/healthapp?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here-use-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# FHIR/EPIC Integration
FHIR_BASE_URL="https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4"
FHIR_CLIENT_ID=""
FHIR_CLIENT_SECRET=""
FHIR_REDIRECT_URI="http://localhost:3000/api/fhir/callback"

# Real-time Messaging
NEXT_PUBLIC_SOCKET_URL="http://localhost:3001"

# Session Security
SESSION_TIMEOUT_MINUTES=15
SESSION_WARNING_MINUTES=2

# Compliance
AUDIT_LOG_RETENTION_YEARS=7
PHI_LOGGING_ENABLED=false
`,
  },

  // ============================================================
  // HEALTHCARE PRISMA SCHEMA (Prisma 5.x)
  // ============================================================
  {
    path: 'prisma/schema.prisma',
    type: 'lib',
    content: `// Prisma Schema - Prisma 5.x
// Uses SQLite for local development (converted by template-applier)

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================================
// USER & AUTH
// ============================================================

model User {
  id             Int       @id @default(autoincrement())
  email          String    @unique
  name           String?
  password       String
  avatar         String?
  role           String    @default("patient") // patient, provider, care_team, admin
  specialty      String?   // For providers
  npi            String?   // National Provider Identifier
  organizationId Int?
  organization   Organization? @relation(fields: [organizationId], references: [id])
  emailVerified  DateTime?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt

  sessions             Session[]
  patientAppointments  Appointment[] @relation("PatientAppointments")
  providerAppointments Appointment[] @relation("ProviderAppointments")
  schedules            Schedule[]
  participants         Participant[]
  sentMessages         Message[]

  @@index([email])
  @@index([role])
  @@index([organizationId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       Int
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expires      DateTime
  ipAddress    String?
  userAgent    String?

  @@index([userId])
}

model Organization {
  id        Int      @id @default(autoincrement())
  name      String
  type      String   // hospital, clinic, practice
  npi       String?  // Organization NPI
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  users User[]
}

// ============================================================
// AUDIT & COMPLIANCE
// ============================================================

model AuditLog {
  id          String   @id @default(cuid())
  timestamp   DateTime @default(now())
  userId      Int?
  userEmail   String?
  action      String   // VIEW, CREATE, UPDATE, DELETE, EXPORT, LOGIN, LOGOUT
  resourceType String  // Patient, Appointment, Message, etc.
  resourceId  String?
  ipAddress   String?
  userAgent   String?
  details     Json?
  phiAccessed Boolean  @default(false)

  @@index([timestamp])
  @@index([userId])
  @@index([action])
  @@index([resourceType])
  @@index([phiAccessed])
}

// ============================================================
// MESSAGING
// ============================================================

model Conversation {
  id           String        @id @default(cuid())
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt
  participants Participant[]
  messages     Message[]

  @@index([updatedAt])
}

model Participant {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  userId         Int
  user           User         @relation(fields: [userId], references: [id])
  role           String       // patient, provider, care_team
  joinedAt       DateTime     @default(now())

  @@unique([conversationId, userId])
  @@index([userId])
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  senderId       Int
  sender         User         @relation(fields: [senderId], references: [id])
  content        String
  encrypted      Boolean      @default(false)
  readAt         DateTime?
  createdAt      DateTime     @default(now())

  @@index([conversationId])
  @@index([senderId])
  @@index([createdAt])
}

// ============================================================
// SCHEDULING
// ============================================================

model Appointment {
  id          String   @id @default(cuid())
  patientId   Int
  patient     User     @relation("PatientAppointments", fields: [patientId], references: [id])
  providerId  Int
  provider    User     @relation("ProviderAppointments", fields: [providerId], references: [id])
  startTime   DateTime
  endTime     DateTime
  type        String   // in_person, telehealth, phone
  status      String   @default("scheduled") // scheduled, confirmed, cancelled, completed, no_show
  notes       String?
  location    String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([patientId])
  @@index([providerId])
  @@index([startTime])
  @@index([status])
}

model Schedule {
  id          String @id @default(cuid())
  providerId  Int
  provider    User   @relation(fields: [providerId], references: [id])
  dayOfWeek   Int    // 0 = Sunday, 6 = Saturday
  startTime   String // "09:00"
  endTime     String // "17:00"
  slotMinutes Int    @default(30)

  @@unique([providerId, dayOfWeek])
  @@index([providerId])
}
`,
  },
  {
    path: 'prisma/seed.ts',
    type: 'lib',
    content: `/**
 * Prisma Seed Script - Healthcare
 * Run with: npx prisma db seed
 *
 * Seeds initial data for development including healthcare-specific models.
 * Coders should update this file incrementally when adding new models.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting healthcare seed...');

  // Create organization
  const organization = await prisma.organization.upsert({
    where: { id: 1 },
    update: {},
    create: {
      name: 'Sample Health Clinic',
      type: 'clinic',
      npi: '1234567890',
    },
  });

  console.log('Created organization:', organization.name);

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      password: adminPassword,
      role: 'admin',
      organizationId: organization.id,
    },
  });

  console.log('Created admin:', admin.email);

  // Create provider
  const providerPassword = await bcrypt.hash('provider123', 12);
  const provider = await prisma.user.upsert({
    where: { email: 'provider@example.com' },
    update: {},
    create: {
      email: 'provider@example.com',
      name: 'Dr. Jane Smith',
      password: providerPassword,
      role: 'provider',
      specialty: 'Family Medicine',
      npi: '0987654321',
      organizationId: organization.id,
    },
  });

  console.log('Created provider:', provider.email);

  // Create patient
  const patientPassword = await bcrypt.hash('patient123', 12);
  const patient = await prisma.user.upsert({
    where: { email: 'patient@example.com' },
    update: {},
    create: {
      email: 'patient@example.com',
      name: 'John Doe',
      password: patientPassword,
      role: 'patient',
    },
  });

  console.log('Created patient:', patient.email);

  // Create provider schedule
  for (let day = 1; day <= 5; day++) { // Mon-Fri
    await prisma.schedule.upsert({
      where: {
        providerId_dayOfWeek: {
          providerId: provider.id,
          dayOfWeek: day,
        },
      },
      update: {},
      create: {
        providerId: provider.id,
        dayOfWeek: day,
        startTime: '09:00',
        endTime: '17:00',
        slotMinutes: 30,
      },
    });
  }

  console.log('Created provider schedule');

  // Add additional seed data for new models here

  console.log('Healthcare seed completed!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`,
  },
  {
    path: 'lib/prisma.ts',
    type: 'lib',
    content: `/**
 * Prisma Client Singleton
 * Prevents multiple Prisma instances in development (hot reload)
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
`,
  },

  // ============================================================
  // HEALTHCARE-SPECIFIC LIB
  // ============================================================
  {
    path: 'lib/phi-logger.ts',
    type: 'lib',
    content: `/**
 * PHI-Safe Logger
 * Redacts sensitive data before logging
 */

const PHI_PATTERNS = [
  /\\b\\d{3}-\\d{2}-\\d{4}\\b/g, // SSN
  /\\b\\d{9}\\b/g, // SSN without dashes
  /\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b/g, // Email
  /\\b\\d{10}\\b/g, // Phone
  /\\b\\d{3}[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b/g, // Phone with separators
  /\\b\\d{2}\\/\\d{2}\\/\\d{4}\\b/g, // DOB
  /\\bMRN[:\\s]?\\d+/gi, // MRN
];

const REDACT_FIELDS = [
  'ssn',
  'socialSecurityNumber',
  'dateOfBirth',
  'dob',
  'birthDate',
  'phone',
  'phoneNumber',
  'address',
  'mrn',
  'medicalRecordNumber',
];

function redactValue(value: string): string {
  let redacted = value;
  for (const pattern of PHI_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }
  return redacted;
}

function redactObject(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return typeof obj === 'string' ? redactValue(obj) : obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactObject);
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_FIELDS.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactObject(value);
    }
  }
  return redacted;
}

const isPHILoggingEnabled = process.env.PHI_LOGGING_ENABLED === 'true';

export const phiLogger = {
  log: (...args: any[]) => {
    if (isPHILoggingEnabled) {
      console.log(...args);
    } else {
      console.log(...args.map(redactObject));
    }
  },
  info: (...args: any[]) => {
    if (isPHILoggingEnabled) {
      console.info(...args);
    } else {
      console.info(...args.map(redactObject));
    }
  },
  warn: (...args: any[]) => {
    if (isPHILoggingEnabled) {
      console.warn(...args);
    } else {
      console.warn(...args.map(redactObject));
    }
  },
  error: (...args: any[]) => {
    // Always log errors, but redact PHI
    console.error(...args.map(redactObject));
  },
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV === 'development') {
      if (isPHILoggingEnabled) {
        console.debug(...args);
      } else {
        console.debug(...args.map(redactObject));
      }
    }
  },
};

export default phiLogger;
`,
  },
  {
    path: 'lib/session-security.ts',
    type: 'lib',
    content: `/**
 * Session Security Utilities
 */

const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15') * 60 * 1000;
const WARNING_TIME = parseInt(process.env.SESSION_WARNING_MINUTES || '2') * 60 * 1000;

export interface SessionStatus {
  isExpired: boolean;
  isWarning: boolean;
  remainingTime: number;
  warningTime: number;
}

export function checkSessionStatus(lastActivity: Date): SessionStatus {
  const now = Date.now();
  const elapsed = now - lastActivity.getTime();
  const remaining = SESSION_TIMEOUT - elapsed;

  return {
    isExpired: remaining <= 0,
    isWarning: remaining <= WARNING_TIME && remaining > 0,
    remainingTime: Math.max(0, remaining),
    warningTime: WARNING_TIME,
  };
}

export function getSessionConfig() {
  return {
    timeout: SESSION_TIMEOUT,
    warningTime: WARNING_TIME,
    timeoutMinutes: parseInt(process.env.SESSION_TIMEOUT_MINUTES || '15'),
    warningMinutes: parseInt(process.env.SESSION_WARNING_MINUTES || '2'),
  };
}
`,
  },
  {
    path: 'lib/roles.ts',
    type: 'lib',
    content: `/**
 * Role-Based Access Control
 */

export type UserRole = 'patient' | 'provider' | 'care_team' | 'admin';

export const ROLES: Record<UserRole, { label: string; level: number }> = {
  patient: { label: 'Patient', level: 1 },
  provider: { label: 'Healthcare Provider', level: 3 },
  care_team: { label: 'Care Team Member', level: 2 },
  admin: { label: 'Administrator', level: 4 },
};

export function hasRole(userRole: string, requiredRole: UserRole): boolean {
  const userLevel = ROLES[userRole as UserRole]?.level || 0;
  const requiredLevel = ROLES[requiredRole].level;
  return userLevel >= requiredLevel;
}

export function isProvider(role: string): boolean {
  return role === 'provider' || role === 'admin';
}

export function isAdmin(role: string): boolean {
  return role === 'admin';
}

export function canAccessPatientData(userRole: string, patientId: number, userId: number): boolean {
  // Admins and providers can access any patient
  if (isProvider(userRole)) return true;

  // Patients can only access their own data
  if (userRole === 'patient') return patientId === userId;

  // Care team members need explicit access (implement your logic)
  return false;
}
`,
  },

  // ============================================================
  // HEALTHCARE COMPONENTS
  // ============================================================
  {
    path: 'components/healthcare/PHIWarning.tsx',
    type: 'component',
    content: `'use client';

interface PHIWarningProps {
  visible?: boolean;
}

export function PHIWarning({ visible = true }: PHIWarningProps) {
  if (!visible) return null;

  return (
    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 mb-4">
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            <strong>Protected Health Information (PHI)</strong>
            {' '}- This page contains sensitive patient data protected under HIPAA.
          </p>
        </div>
      </div>
    </div>
  );
}
`,
  },
  {
    path: 'components/healthcare/SessionTimeout.tsx',
    type: 'component',
    content: `'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { getSessionConfig } from '@/lib/session-security';

export function SessionTimeout() {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());

  const config = getSessionConfig();

  const resetTimer = useCallback(() => {
    setLastActivity(Date.now());
    setShowWarning(false);
  }, []);

  const handleLogout = useCallback(() => {
    signOut({ callbackUrl: '/auth/login?reason=timeout' });
  }, []);

  // Track user activity
  useEffect(() => {
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      if (!showWarning) {
        setLastActivity(Date.now());
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [showWarning]);

  // Check session status
  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      const remaining = config.timeout - elapsed;

      if (remaining <= 0) {
        handleLogout();
      } else if (remaining <= config.warningTime) {
        setShowWarning(true);
        setRemainingSeconds(Math.ceil(remaining / 1000));
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lastActivity, config, handleLogout]);

  if (!showWarning) return null;

  return (
    <Modal
      isOpen={showWarning}
      onClose={resetTimer}
      title="Session Expiring"
      size="sm"
    >
      <div className="text-center">
        <p className="text-gray-600 mb-4">
          Your session will expire in{' '}
          <span className="font-bold text-red-600">{remainingSeconds}</span>{' '}
          seconds due to inactivity.
        </p>
        <p className="text-sm text-gray-500 mb-6">
          Click "Stay Logged In" to continue your session.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" onClick={handleLogout}>
            Log Out
          </Button>
          <Button onClick={resetTimer}>
            Stay Logged In
          </Button>
        </div>
      </div>
    </Modal>
  );
}
`,
  },
  {
    path: 'components/healthcare/RoleGuard.tsx',
    type: 'component',
    content: `'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { hasRole, UserRole } from '@/lib/roles';
import { PageLoader } from '@/components/ui/Spinner';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole: UserRole;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function RoleGuard({
  children,
  requiredRole,
  fallback,
  redirectTo,
}: RoleGuardProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const userRole = (session?.user as any)?.role || 'patient';
  const hasAccess = hasRole(userRole, requiredRole);

  useEffect(() => {
    if (status === 'authenticated' && !hasAccess && redirectTo) {
      router.push(redirectTo);
    }
  }, [status, hasAccess, redirectTo, router]);

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
          <p className="text-gray-600">
            You don't have permission to view this page.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
`,
  },
  {
    path: 'components/healthcare/index.ts',
    type: 'component',
    content: `export { PHIWarning } from './PHIWarning';
export { SessionTimeout } from './SessionTimeout';
export { RoleGuard } from './RoleGuard';
`,
  },

  // ============================================================
  // UPDATED PROVIDERS WITH SESSION TIMEOUT
  // ============================================================
  {
    path: 'app/providers.tsx',
    type: 'lib',
    content: `'use client';

import { SessionProvider } from 'next-auth/react';
import { ToastProvider } from '@/components/ui/Toast';
import { SessionTimeout } from '@/components/healthcare/SessionTimeout';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ToastProvider>
        {children}
        <SessionTimeout />
      </ToastProvider>
    </SessionProvider>
  );
}
`,
  },

  // ============================================================
  // UPDATED AUTH WITH ROLES
  // ============================================================
  {
    path: 'lib/auth.ts',
    type: 'lib',
    content: `import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { auditLog } from '@/lib/audit/logger';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: { organization: true },
        });

        if (!user) {
          throw new Error('No user found with this email');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          // Log failed login attempt
          await auditLog({
            userEmail: credentials.email,
            action: 'LOGIN',
            resourceType: 'Session',
            details: { success: false, reason: 'Invalid password' },
            ipAddress: (req as any)?.headers?.['x-forwarded-for'] || undefined,
          });
          throw new Error('Invalid password');
        }

        // Log successful login
        await auditLog({
          userId: user.id,
          userEmail: user.email,
          action: 'LOGIN',
          resourceType: 'Session',
          details: { success: true },
          ipAddress: (req as any)?.headers?.['x-forwarded-for'] || undefined,
        });

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
          specialty: user.specialty,
          organizationId: user.organizationId,
          organizationName: user.organization?.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.specialty = (user as any).specialty;
        token.organizationId = (user as any).organizationId;
        token.organizationName = (user as any).organizationName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
        (session.user as any).specialty = token.specialty;
        (session.user as any).organizationId = token.organizationId;
        (session.user as any).organizationName = token.organizationName;
      }
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      // Log logout
      if (token?.id) {
        await auditLog({
          userId: parseInt(token.id as string),
          userEmail: token.email as string,
          action: 'LOGOUT',
          resourceType: 'Session',
        });
      }
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours (but UI session timeout is shorter)
  },
  secret: process.env.NEXTAUTH_SECRET,
};

export async function getSession() {
  return getServerSession(authOptions);
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session?.user?.id) return null;

  return prisma.user.findUnique({
    where: { id: parseInt(session.user.id) },
    include: { organization: true },
  });
}
`,
  },

  // ============================================================
  // ROOT PAGE - CRITICAL: Every build needs this!
  // ============================================================
  {
    path: 'app/page.tsx',
    type: 'page',
    content: `/**
 * Root Page - Healthcare Application Entry Point
 * This page is displayed when users visit localhost:3000
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-gray-50">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 text-primary-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
            Healthcare Portal
          </h1>
        </div>

        <p className="text-lg text-gray-600">
          Your secure, HIPAA-compliant healthcare platform.
          Access your health records, schedule appointments, and communicate with your care team.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
          >
            Patient Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-50 transition-colors"
          >
            New Patient Registration
          </Link>
        </div>

        <div className="pt-8 border-t border-gray-200 space-y-4">
          <p className="text-sm text-gray-500">
            For healthcare providers and staff:
          </p>
          <Link
            href="/auth/login?role=provider"
            className="text-primary-600 hover:text-primary-700 font-medium text-sm"
          >
            Provider Portal Access &rarr;
          </Link>
        </div>

        <p className="text-xs text-gray-400 pt-4">
          HIPAA Compliant | Secure | Your data is protected
        </p>
      </div>
    </main>
  );
}
`,
  },

  // ============================================================
  // STUB FOR AUDIT LOGGER (uses audit-logger template)
  // ============================================================
  {
    path: 'lib/audit/logger.ts',
    type: 'lib',
    content: `/**
 * Audit Logger Stub
 * This is a minimal implementation. The full audit-logger template
 * provides comprehensive audit logging with database persistence.
 */

import { prisma } from '@/lib/prisma';
import { phiLogger } from '@/lib/phi-logger';

export interface AuditLogInput {
  userId?: number;
  userEmail?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  phiAccessed?: boolean;
}

const PHI_RESOURCES = [
  'Patient',
  'Observation',
  'Condition',
  'MedicationRequest',
  'DiagnosticReport',
  'Immunization',
  'AllergyIntolerance',
  'Encounter',
  'CarePlan',
  'ClinicalNote',
  'Message',
];

export async function auditLog(input: AuditLogInput): Promise<void> {
  const phiAccessed = input.phiAccessed ?? PHI_RESOURCES.includes(input.resourceType);

  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        userEmail: input.userEmail,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        details: input.details || {},
        phiAccessed,
      },
    });
  } catch (error) {
    phiLogger.error('[AuditLog] Failed to create audit log:', error);
  }
}

export const audit = {
  view: (resourceType: string, resourceId: string, ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'VIEW', resourceType, resourceId }),
  create: (resourceType: string, resourceId: string, ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'CREATE', resourceType, resourceId }),
  update: (resourceType: string, resourceId: string, ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'UPDATE', resourceType, resourceId }),
  delete: (resourceType: string, resourceId: string, ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'DELETE', resourceType, resourceId }),
  export: (resourceType: string, resourceId: string, ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'EXPORT', resourceType, resourceId }),
  login: (ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'LOGIN', resourceType: 'Session' }),
  logout: (ctx: Partial<AuditLogInput>) =>
    auditLog({ ...ctx, action: 'LOGOUT', resourceType: 'Session' }),
};
`,
  },
];
