/**
 * Figma Bootstrap Template - Tests
 * Tests for infrastructure: Auth, API, Database
 */

import { TemplateTests } from '../types';

export const bootstrapFigmaTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/lib/utils.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import { cn, formatDate, formatTime, capitalize, truncate, generateId } from '@/lib/utils';

describe('Utils', () => {
  describe('cn', () => {
    it('should merge class names', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle conditional classes', () => {
      expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    });

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-4', 'px-6')).toBe('px-6');
    });
  });

  describe('formatDate', () => {
    it('should format date string', () => {
      const result = formatDate('2024-01-15');
      expect(result).toContain('Jan');
      expect(result).toContain('15');
      expect(result).toContain('2024');
    });

    it('should format Date object', () => {
      const date = new Date('2024-06-01');
      const result = formatDate(date);
      expect(result).toContain('Jun');
    });
  });

  describe('formatTime', () => {
    it('should format time', () => {
      const result = formatTime('2024-01-15T14:30:00');
      expect(result).toMatch(/2:30\\s*PM/i);
    });
  });

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });
  });

  describe('truncate', () => {
    it('should truncate long strings', () => {
      expect(truncate('hello world', 5)).toBe('hello...');
    });

    it('should not truncate short strings', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });
  });

  describe('generateId', () => {
    it('should generate unique ids', () => {
      const id1 = generateId();
      const id2 = generateId();
      expect(id1).not.toBe(id2);
    });

    it('should return string', () => {
      expect(typeof generateId()).toBe('string');
    });
  });
});
`,
    },
    {
      path: '__tests__/hooks/useAuth.test.tsx',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';
import { SessionProvider } from 'next-auth/react';
import { signIn, signOut } from 'next-auth/react';

// Mock next-auth/react
vi.mock('next-auth/react', async () => {
  const actual = await vi.importActual('next-auth/react');
  return {
    ...actual,
    useSession: vi.fn(() => ({
      data: null,
      status: 'unauthenticated',
    })),
    signIn: vi.fn(),
    signOut: vi.fn(),
  };
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider session={null}>{children}</SessionProvider>
);

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should return unauthenticated state initially', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeUndefined();
  });

  it('should call signIn on login', async () => {
    (signIn as any).mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'test@example.com',
      password: 'password',
      redirect: false,
    });
  });

  it('should call signOut on logout', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.logout();
    });

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });

  it('should handle signup', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 1, email: 'test@example.com' }),
    });
    (signIn as any).mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.signup({
        email: 'test@example.com',
        password: 'password',
        name: 'Test User',
      });
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/signup', expect.any(Object));
  });

  it('should set error on login failure', async () => {
    (signIn as any).mockResolvedValue({ ok: false, error: 'Invalid credentials' });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      const success = await result.current.login('test@example.com', 'wrong');
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('Invalid credentials');
  });
});
`,
    },
  ],

  integration: [
    {
      path: '__tests__/api/auth/signup.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/auth/signup/route';
import { NextRequest } from 'next/server';

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock bcryptjs
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(() => 'hashed-password'),
  },
}));

import { prisma } from '@/lib/prisma';

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create a new user', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      createdAt: new Date(),
    });

    const request = createRequest({
      email: 'test@example.com',
      password: 'password123',
      name: 'Test User',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.email).toBe('test@example.com');
    expect(data.name).toBe('Test User');
  });

  it('should return 400 if email is missing', async () => {
    const request = createRequest({
      password: 'password123',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });

  it('should return 400 if password is missing', async () => {
    const request = createRequest({
      email: 'test@example.com',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Email and password are required');
  });

  it('should return 409 if user already exists', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
    });

    const request = createRequest({
      email: 'test@example.com',
      password: 'password123',
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toBe('User already exists');
  });
});
`,
    },
    {
      path: '__tests__/api/user/me.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/user/me/route';

// Mock auth
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}));

import { getCurrentUser } from '@/lib/auth';

describe('GET /api/user/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return current user', async () => {
    const mockUser = {
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      avatar: null,
      createdAt: new Date(),
    };

    (getCurrentUser as any).mockResolvedValue(mockUser);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.email).toBe('test@example.com');
    expect(data.name).toBe('Test User');
  });

  it('should return 401 if not authenticated', async () => {
    (getCurrentUser as any).mockResolvedValue(null);

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });
});
`,
    },
  ],

  e2e: [
    {
      path: '__tests__/e2e/auth-flow.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';

/**
 * E2E tests for authentication flow
 * These tests require a running server
 * Run with: npm run test:e2e
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

describe('Authentication Flow E2E', () => {
  const testEmail = \`test-\${Date.now()}@example.com\`;
  const testPassword = 'TestPassword123!';

  describe('Signup', () => {
    it('should create a new account', async () => {
      const response = await fetch(\`\${BASE_URL}/api/auth/signup\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
          name: 'E2E Test User',
        }),
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.email).toBe(testEmail);
    });

    it('should reject duplicate email', async () => {
      const response = await fetch(\`\${BASE_URL}/api/auth/signup\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          password: testPassword,
        }),
      });

      expect(response.status).toBe(409);
    });
  });

  describe('User API', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await fetch(\`\${BASE_URL}/api/user/me\`);
      expect(response.status).toBe(401);
    });
  });
});
`,
    },
  ],
};
