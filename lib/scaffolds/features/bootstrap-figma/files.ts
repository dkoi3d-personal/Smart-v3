/**
 * Figma Bootstrap Template - Files
 * Infrastructure only: Database, Auth, API routes
 * NO UI components - those come from Figma design
 */

import { TemplateFile } from '../types';

export const bootstrapFigmaFiles: TemplateFile[] = [
  // ============================================================
  // CONFIG FILES
  // ============================================================
  {
    path: '.env.example',
    type: 'config',
    content: `# Database
DATABASE_URL="postgresql://user:password@localhost:5432/myapp?schema=public"

# NextAuth
NEXTAUTH_SECRET="your-secret-key-here"
NEXTAUTH_URL="http://localhost:3000"

# Optional: OAuth Providers
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_ID=""
# GITHUB_SECRET=""
`,
    description: 'Environment variables template',
  },
  {
    path: 'tailwind.config.ts',
    type: 'config',
    content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      // Design tokens will be populated from Figma extraction
      colors: {
        // These will be overridden by Figma design system
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
`,
    description: 'Tailwind config with Figma design token variables',
  },

  // ============================================================
  // PRISMA (Prisma 5.x)
  // NOTE: Auth fields (password, Session) added by Coder when PO creates auth stories
  // ============================================================
  {
    path: 'prisma/schema.prisma',
    type: 'config',
    content: `// Prisma Schema - Prisma 5.x
// Uses SQLite for local development (converted by template-applier)
// NOTE: Auth fields (password, Session model) added by Coder when auth stories exist

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  avatar    String?
  role      String   @default("user")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([email])
}
`,
    description: 'Prisma schema with User model (Prisma 5.x)',
  },
  {
    path: 'prisma/seed.ts',
    type: 'lib',
    content: `/**
 * Prisma Seed Script
 * Run with: npx prisma db seed
 *
 * Seeds initial data for development.
 * Coders should update this file incrementally when adding new models.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Create sample users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log('Created admin user:', admin.email);

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
    },
  });

  console.log('Created test user:', testUser.email);

  // Add additional seed data for new models here
  // Example:
  // const item = await prisma.item.create({
  //   data: { name: 'Sample Item', userId: testUser.id }
  // });

  console.log('Seed completed!');
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
    description: 'Database seed script for initial data',
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
    description: 'Prisma client singleton (Prisma 5.x)',
  },

  // ============================================================
  // AUTH
  // ============================================================
  {
    path: 'lib/auth.ts',
    type: 'lib',
    content: `import { NextAuthOptions, getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password required');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user) {
          throw new Error('No user found with this email');
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error('Invalid password');
        }

        return {
          id: String(user.id),
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
  });
}
`,
    description: 'NextAuth configuration with credentials provider',
  },
  {
    path: 'middleware.ts',
    type: 'config',
    content: `import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Admin routes protection
    if (pathname.startsWith('/admin') && token?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;

        // Public routes
        if (
          pathname.startsWith('/auth') ||
          pathname === '/' ||
          pathname.startsWith('/api/auth')
        ) {
          return true;
        }

        // Protected routes require token
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
`,
    description: 'Auth middleware with route protection',
  },

  // ============================================================
  // UTILS
  // ============================================================
  {
    path: 'lib/utils.ts',
    type: 'lib',
    content: `import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(date));
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
`,
    description: 'Utility functions',
  },

  // ============================================================
  // APP LAYOUT & PROVIDERS (minimal - no UI components)
  // ============================================================
  {
    path: 'app/layout.tsx',
    type: 'page',
    content: `import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: 'My App',
  description: 'Built from Figma design',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
`,
    description: 'Root layout - minimal, no UI components',
  },
  {
    path: 'app/providers.tsx',
    type: 'page',
    content: `'use client';

import { SessionProvider } from 'next-auth/react';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {children}
    </SessionProvider>
  );
}
`,
    description: 'Providers wrapper - session only',
  },
  {
    path: 'app/globals.css',
    type: 'config',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

/* CSS variables for design tokens - populated from Figma */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #6b7280;
  --color-background: #ffffff;
  --color-foreground: #111827;
  --color-muted: #f3f4f6;
  --color-accent: #8b5cf6;
}

.dark {
  --color-primary: #60a5fa;
  --color-secondary: #9ca3af;
  --color-background: #111827;
  --color-foreground: #f9fafb;
  --color-muted: #1f2937;
  --color-accent: #a78bfa;
}

@layer base {
  body {
    @apply bg-background text-foreground antialiased;
  }
}
`,
    description: 'Global CSS with design token variables',
  },

  // ============================================================
  // API ROUTES
  // ============================================================
  {
    path: 'app/api/auth/[...nextauth]/route.ts',
    type: 'api',
    content: `import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
`,
    description: 'NextAuth API route handler',
  },
  {
    path: 'app/api/auth/signup/route.ts',
    type: 'api',
    content: `import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('[Signup] Error:', error);
    return NextResponse.json(
      { error: 'Failed to create account' },
      { status: 500 }
    );
  }
}
`,
    description: 'User signup API endpoint',
  },
  {
    path: 'app/api/user/me/route.ts',
    type: 'api',
    content: `import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      createdAt: user.createdAt,
    });
  } catch (error) {
    console.error('[User/Me] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
`,
    description: 'Current user API endpoint',
  },

  // ============================================================
  // HOOKS
  // ============================================================
  {
    path: 'hooks/useAuth.ts',
    type: 'hook',
    content: `'use client';

import { useSession, signIn, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

interface SignUpData {
  email: string;
  password: string;
  name?: string;
}

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
        return false;
      }

      router.push('/dashboard');
      return true;
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [router]);

  const signup = useCallback(async (data: SignUpData) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        setError(result.error || 'Failed to create account');
        return false;
      }

      // Auto-login after signup
      return login(data.email, data.password);
    } catch (err) {
      setError('An unexpected error occurred');
      return false;
    } finally {
      setLoading(false);
    }
  }, [login]);

  const logout = useCallback(async () => {
    await signOut({ callbackUrl: '/' });
  }, []);

  return {
    user: session?.user,
    isAuthenticated: !!session,
    isLoading: status === 'loading',
    loading,
    error,
    login,
    signup,
    logout,
  };
}
`,
    description: 'Authentication hook',
  },

  // ============================================================
  // ROOT PAGE - CRITICAL: Every build needs this!
  // ============================================================
  {
    path: 'app/page.tsx',
    type: 'page',
    content: `/**
 * Root Page - Application Entry Point
 * This page is displayed when users visit localhost:3000
 *
 * NOTE: This is a placeholder that should be replaced with the
 * actual homepage design from Figma. The Figma components will
 * be generated and can replace this content.
 */

import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 bg-background text-foreground">
      <div className="max-w-2xl w-full text-center space-y-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Welcome to Your App
        </h1>

        <p className="text-lg text-muted-foreground">
          This application was built from your Figma design.
          Replace this page with your actual homepage component.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/auth/login"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-primary text-white font-medium hover:opacity-90 transition-opacity"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-gray-300 font-medium hover:bg-gray-50 transition-colors"
          >
            Create Account
          </Link>
        </div>

        <div className="pt-8 border-t border-gray-200">
          <p className="text-sm text-muted-foreground">
            Built with Next.js 14, TypeScript, and Tailwind CSS
          </p>
        </div>
      </div>
    </main>
  );
}
`,
    description: 'Root homepage - required for localhost:3000 to work',
  },

  // ============================================================
  // TYPES
  // ============================================================
  {
    path: 'types/next-auth.d.ts',
    type: 'type',
    content: `import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role?: string;
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    role?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role?: string;
  }
}
`,
    description: 'NextAuth type augmentations',
  },
];
