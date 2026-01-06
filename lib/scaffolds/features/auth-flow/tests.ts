/**
 * Auth Flow Template - Test Files
 */

import { TemplateTestFile } from '../types';

export const authFlowTests: TemplateTestFile[] = [
  {
    path: '__tests__/auth/login.test.ts',
    framework: 'vitest',
    description: 'Login API endpoint tests',
    content: `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    compare: vi.fn(),
  },
}));

// Mock JWT
vi.mock('@/lib/auth/jwt', () => ({
  signToken: vi.fn().mockResolvedValue('mock-token'),
}));

import { POST } from '@/app/api/auth/login/route';
import { prisma } from '@/lib/db';
import bcrypt from 'bcryptjs';

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 for non-existent user', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);

    const request = createRequest({
      email: 'test@example.com',
      password: 'password123',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const data = await response.json();
    expect(data.error).toBe('Invalid email or password');
  });

  it('returns 401 for incorrect password', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      password: 'hashed-password',
      name: 'Test User',
    });
    (bcrypt.compare as any).mockResolvedValue(false);

    const request = createRequest({
      email: 'test@example.com',
      password: 'wrong-password',
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 200 and sets cookie for valid credentials', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      password: 'hashed-password',
      name: 'Test User',
    });
    (bcrypt.compare as any).mockResolvedValue(true);

    const request = createRequest({
      email: 'test@example.com',
      password: 'correct-password',
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('test@example.com');

    // Check that auth cookie was set
    const cookies = response.headers.get('set-cookie');
    expect(cookies).toContain('auth-token');
  });

  it('returns 400 for invalid email format', async () => {
    const request = createRequest({
      email: 'invalid-email',
      password: 'password123',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing password', async () => {
    const request = createRequest({
      email: 'test@example.com',
      password: '',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});`,
  },

  {
    path: '__tests__/auth/signup.test.ts',
    framework: 'vitest',
    description: 'Signup API endpoint tests',
    content: `import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Prisma
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

// Mock bcrypt
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed-password'),
  },
}));

import { POST } from '@/app/api/auth/signup/route';
import { prisma } from '@/lib/db';

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/signup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a new user successfully', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({
      id: 1,
      email: 'new@example.com',
      name: 'New User',
    });

    const request = createRequest({
      name: 'New User',
      email: 'new@example.com',
      password: 'password123',
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.user.email).toBe('new@example.com');
  });

  it('returns 400 for existing email', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({
      id: 1,
      email: 'existing@example.com',
    });

    const request = createRequest({
      name: 'Test User',
      email: 'existing@example.com',
      password: 'password123',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toContain('already exists');
  });

  it('returns 400 for password less than 8 characters', async () => {
    const request = createRequest({
      name: 'Test User',
      email: 'test@example.com',
      password: 'short',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for missing name', async () => {
    const request = createRequest({
      name: '',
      email: 'test@example.com',
      password: 'password123',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid email format', async () => {
    const request = createRequest({
      name: 'Test User',
      email: 'invalid-email',
      password: 'password123',
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('lowercases email before storing', async () => {
    (prisma.user.findUnique as any).mockResolvedValue(null);
    (prisma.user.create as any).mockResolvedValue({
      id: 1,
      email: 'test@example.com',
      name: 'Test User',
    });

    const request = createRequest({
      name: 'Test User',
      email: 'TEST@EXAMPLE.COM',
      password: 'password123',
    });

    await POST(request);

    expect(prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'test@example.com',
        }),
      })
    );
  });
});`,
  },

  {
    path: '__tests__/auth/session.test.ts',
    framework: 'vitest',
    description: 'Session utility tests',
    content: `import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

// Mock JWT verification
vi.mock('@/lib/auth/jwt', () => ({
  verifyToken: vi.fn(),
}));

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/jwt';
import { getSession, requireSession, isAuthenticated } from '@/lib/auth/session';

describe('Session Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSession', () => {
    it('returns null when no token cookie exists', async () => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const session = await getSession();
      expect(session).toBeNull();
    });

    it('returns null when token is invalid', async () => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'invalid-token' }),
      });
      (verifyToken as any).mockResolvedValue(null);

      const session = await getSession();
      expect(session).toBeNull();
    });

    it('returns session for valid token', async () => {
      const mockPayload = { userId: 1, email: 'test@example.com' };

      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
      });
      (verifyToken as any).mockResolvedValue(mockPayload);

      const session = await getSession();
      expect(session).toEqual(mockPayload);
    });
  });

  describe('requireSession', () => {
    it('throws error when not authenticated', async () => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      await expect(requireSession()).rejects.toThrow('Authentication required');
    });

    it('returns session when authenticated', async () => {
      const mockPayload = { userId: 1, email: 'test@example.com' };

      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
      });
      (verifyToken as any).mockResolvedValue(mockPayload);

      const session = await requireSession();
      expect(session).toEqual(mockPayload);
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when not authenticated', async () => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      });

      const result = await isAuthenticated();
      expect(result).toBe(false);
    });

    it('returns true when authenticated', async () => {
      (cookies as any).mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-token' }),
      });
      (verifyToken as any).mockResolvedValue({ userId: 1 });

      const result = await isAuthenticated();
      expect(result).toBe(true);
    });
  });
});`,
  },

  {
    path: '__tests__/auth/useAuth.test.tsx',
    framework: 'vitest',
    description: 'useAuth hook tests',
    content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { useAuth } from '@/hooks/useAuth';

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with loading state', () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: { id: 1, email: 'test@example.com' } }),
    });

    const { result } = renderHook(() => useAuth());

    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it('sets user after successful fetch', async () => {
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test User' };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ user: mockUser }),
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('sets user to null when not authenticated', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('logout clears user and redirects', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user).toEqual(mockUser);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(mockPush).toHaveBeenCalledWith('/login');
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('refresh fetches user again', async () => {
    const mockUser = { id: 1, email: 'test@example.com' };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: mockUser }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ user: { ...mockUser, name: 'Updated' } }),
      });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.user?.name).toBe('Updated');
  });
});`,
  },
];
