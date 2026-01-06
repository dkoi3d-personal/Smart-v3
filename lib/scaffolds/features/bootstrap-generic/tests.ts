/**
 * Generic Bootstrap Template - Tests
 */

import { TemplateTests } from '../types';

export const bootstrapGenericTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/auth/useAuth.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAuth } from '@/hooks/useAuth';

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: null,
    status: 'unauthenticated',
  })),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
  })),
}));

describe('useAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthenticated state initially', () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeUndefined();
  });

  it('handles login', async () => {
    const { signIn } = await import('next-auth/react');
    (signIn as any).mockResolvedValue({ error: null });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });

    expect(signIn).toHaveBeenCalledWith('credentials', {
      email: 'test@example.com',
      password: 'password',
      redirect: false,
    });
  });

  it('handles login error', async () => {
    const { signIn } = await import('next-auth/react');
    (signIn as any).mockResolvedValue({ error: 'Invalid credentials' });

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      const success = await result.current.login('test@example.com', 'wrong');
      expect(success).toBe(false);
    });

    expect(result.current.error).toBe('Invalid credentials');
  });

  it('handles logout', async () => {
    const { signOut } = await import('next-auth/react');

    const { result } = renderHook(() => useAuth());

    await act(async () => {
      await result.current.logout();
    });

    expect(signOut).toHaveBeenCalledWith({ callbackUrl: '/' });
  });
});
`,
    },
    {
      path: '__tests__/utils/utils.test.ts',
      content: `import { describe, it, expect } from 'vitest';
import { cn, capitalize, truncate, formatDate } from '@/lib/utils';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });
});

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello');
    expect(capitalize('WORLD')).toBe('WORLD');
  });
});

describe('truncate', () => {
  it('truncates long strings', () => {
    expect(truncate('Hello World', 5)).toBe('Hello...');
  });

  it('returns short strings unchanged', () => {
    expect(truncate('Hi', 5)).toBe('Hi');
  });
});

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toContain('Jan');
    expect(formatDate(date)).toContain('15');
    expect(formatDate(date)).toContain('2024');
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/api/auth.integration.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/prisma';

describe('Auth API Integration', () => {
  const testEmail = 'integration-test@example.com';

  afterAll(async () => {
    // Clean up test user
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
  });

  it('POST /api/auth/signup creates a new user', async () => {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Test123!',
        name: 'Test User',
      }),
    });

    if (response.ok) {
      const user = await response.json();
      expect(user.email).toBe(testEmail);
      expect(user.name).toBe('Test User');
      expect(user.password).toBeUndefined(); // Password should not be returned
    }
  });

  it('POST /api/auth/signup rejects duplicate email', async () => {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'Test123!',
      }),
    });

    expect(response.status).toBe(409);
  });

  it('POST /api/auth/signup validates required fields', async () => {
    const response = await fetch('http://localhost:3000/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/auth-flow.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  const testEmail = \`e2e-\${Date.now()}@example.com\`;
  const testPassword = 'Test123!';

  test('signup flow works', async ({ page }) => {
    await page.goto('/auth/signup');

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.fill('input[name="name"]', 'E2E Test User');

    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('login flow works', async ({ page }) => {
    await page.goto('/auth/login');

    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);

    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });
  });

  test('protected routes redirect to login', async ({ page }) => {
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\\/auth\\/login/);
  });

  test('logout works', async ({ page }) => {
    // First login
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 10000 });

    // Then logout
    await page.click('button:has-text("Sign Out")');

    // Should be on home page
    await expect(page).toHaveURL('/');
  });
});

test.describe('UI Components', () => {
  test('home page renders correctly', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('h1')).toContainText('Welcome');
    await expect(page.locator('a:has-text("Get Started")')).toBeVisible();
    await expect(page.locator('a:has-text("Sign In")')).toBeVisible();
  });

  test('navigation works', async ({ page }) => {
    await page.goto('/');

    await page.click('a:has-text("Sign In")');
    await expect(page).toHaveURL('/auth/login');

    await page.goto('/');
    await page.click('a:has-text("Get Started")');
    await expect(page).toHaveURL('/auth/signup');
  });
});
`,
    },
  ],
};
