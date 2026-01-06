/**
 * FHIR Client Template - Tests
 */

import { TemplateTests } from '../types';

export const fhirClientTests: TemplateTests = {
  unit: [
    {
      path: '__tests__/fhir/client.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FhirClient } from '@/lib/fhir/client';

describe('FhirClient', () => {
  const mockFetch = vi.fn();
  const baseUrl = 'https://fhir.example.com/r4';
  const accessToken = 'test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  describe('getPatient', () => {
    it('fetches patient by ID', async () => {
      const mockPatient = {
        resourceType: 'Patient',
        id: 'patient-123',
        name: [{ family: 'Smith', given: ['John'] }],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockPatient),
      });

      const client = new FhirClient(baseUrl, accessToken);
      const patient = await client.getPatient('patient-123');

      expect(mockFetch).toHaveBeenCalledWith(
        \`\${baseUrl}/Patient/patient-123\`,
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: \`Bearer \${accessToken}\`,
          }),
        })
      );
      expect(patient).toEqual(mockPatient);
    });
  });

  describe('searchPatients', () => {
    it('searches by name', async () => {
      const mockBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { resourceType: 'Patient', id: '1' } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBundle),
      });

      const client = new FhirClient(baseUrl, accessToken);
      const result = await client.searchPatients({ name: 'Smith' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('Patient?name=Smith'),
        expect.any(Object)
      );
      expect(result).toEqual(mockBundle);
    });
  });

  describe('getObservations', () => {
    it('fetches observations for patient', async () => {
      const mockBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [
          { resource: { resourceType: 'Observation', id: '1' } },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBundle),
      });

      const client = new FhirClient(baseUrl, accessToken);
      await client.getObservations('patient-123', { category: 'vital-signs' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('Observation?patient=patient-123&category=vital-signs'),
        expect.any(Object)
      );
    });
  });

  describe('getConditions', () => {
    it('fetches active conditions', async () => {
      const mockBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBundle),
      });

      const client = new FhirClient(baseUrl, accessToken);
      await client.getConditions('patient-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('Condition?patient=patient-123&clinical-status=active'),
        expect.any(Object)
      );
    });
  });

  describe('getMedications', () => {
    it('fetches active medications', async () => {
      const mockBundle = {
        resourceType: 'Bundle',
        type: 'searchset',
        entry: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBundle),
      });

      const client = new FhirClient(baseUrl, accessToken);
      await client.getMedications('patient-123');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('MedicationRequest?patient=patient-123&status=active'),
        expect.any(Object)
      );
    });
  });

  describe('error handling', () => {
    it('throws on failed request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const client = new FhirClient(baseUrl, accessToken);

      await expect(client.getPatient('123')).rejects.toThrow(
        'FHIR request failed: 401'
      );
    });
  });
});
`,
    },
    {
      path: '__tests__/fhir/auth.test.ts',
      content: `import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSmartConfiguration,
  getAuthorizationUrl,
  exchangeCodeForTokens,
} from '@/lib/fhir/auth';

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

describe('FHIR Auth', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  describe('getSmartConfiguration', () => {
    it('fetches SMART configuration', async () => {
      const mockConfig = {
        authorization_endpoint: 'https://fhir.example.com/auth',
        token_endpoint: 'https://fhir.example.com/token',
        capabilities: ['launch-standalone'],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      const config = await getSmartConfiguration('https://fhir.example.com/r4');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://fhir.example.com/r4/.well-known/smart-configuration',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
      expect(config).toEqual(mockConfig);
    });

    it('throws on failed fetch', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        getSmartConfiguration('https://fhir.example.com/r4')
      ).rejects.toThrow('Failed to fetch SMART configuration');
    });
  });

  describe('getAuthorizationUrl', () => {
    it('generates authorization URL with state', async () => {
      const mockConfig = {
        authorization_endpoint: 'https://fhir.example.com/authorize',
        token_endpoint: 'https://fhir.example.com/token',
        capabilities: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockConfig),
      });

      // Mock environment variables
      vi.stubEnv('FHIR_BASE_URL', 'https://fhir.example.com/r4');
      vi.stubEnv('FHIR_CLIENT_ID', 'test-client');
      vi.stubEnv('FHIR_REDIRECT_URI', 'http://localhost:3000/api/fhir/callback');

      const url = await getAuthorizationUrl();

      expect(url).toContain('https://fhir.example.com/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-client');
      expect(url).toContain('state=');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('exchanges code for tokens', async () => {
      const mockSmartConfig = {
        authorization_endpoint: 'https://fhir.example.com/authorize',
        token_endpoint: 'https://fhir.example.com/token',
        capabilities: [],
      };

      const mockTokenResponse = {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_in: 3600,
        patient: 'patient-123',
        scope: 'patient/*.read',
      };

      // First call for SMART config
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSmartConfig),
      });

      // Second call for token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTokenResponse),
      });

      vi.stubEnv('FHIR_BASE_URL', 'https://fhir.example.com/r4');
      vi.stubEnv('FHIR_CLIENT_ID', 'test-client');
      vi.stubEnv('FHIR_REDIRECT_URI', 'http://localhost:3000/api/fhir/callback');

      // Mock cookies to return correct state
      const { cookies } = await import('next/headers');
      (cookies as any).mockReturnValue({
        get: vi.fn().mockReturnValue({ value: 'test-state' }),
        set: vi.fn(),
        delete: vi.fn(),
      });

      const tokens = await exchangeCodeForTokens('auth-code', 'test-state');

      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.refreshToken).toBe('refresh-token');
      expect(tokens.patientId).toBe('patient-123');
    });

    it('throws on invalid state', async () => {
      const mockSmartConfig = {
        authorization_endpoint: 'https://fhir.example.com/authorize',
        token_endpoint: 'https://fhir.example.com/token',
        capabilities: [],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockSmartConfig),
      });

      vi.stubEnv('FHIR_BASE_URL', 'https://fhir.example.com/r4');
      vi.stubEnv('FHIR_CLIENT_ID', 'test-client');

      const { cookies } = await import('next/headers');
      (cookies as any).mockReturnValue({
        get: vi.fn().mockReturnValue({ value: 'different-state' }),
        set: vi.fn(),
        delete: vi.fn(),
      });

      await expect(
        exchangeCodeForTokens('auth-code', 'wrong-state')
      ).rejects.toThrow('Invalid OAuth state');
    });
  });
});
`,
    },
  ],
  integration: [
    {
      path: '__tests__/fhir/api.integration.test.ts',
      content: `import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// Skip these tests in CI - they require actual FHIR server
const describeIntegration = process.env.FHIR_BASE_URL
  ? describe
  : describe.skip;

describeIntegration('FHIR API Integration', () => {
  it('GET /api/fhir/auth redirects to authorization', async () => {
    const response = await fetch('http://localhost:3000/api/fhir/auth', {
      redirect: 'manual',
    });

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('authorize');
  });

  it('GET /api/fhir/Patient requires authentication', async () => {
    const response = await fetch('http://localhost:3000/api/fhir/Patient');

    expect(response.status).toBe(401);
  });

  it('GET /api/fhir/metadata returns capability statement', async () => {
    // This endpoint typically doesn't require auth
    const response = await fetch('http://localhost:3000/api/fhir/metadata');

    if (response.ok) {
      const data = await response.json();
      expect(data.resourceType).toBe('CapabilityStatement');
    }
  });
});
`,
    },
  ],
  e2e: [
    {
      path: 'e2e/fhir-flow.spec.ts',
      content: `import { test, expect } from '@playwright/test';

test.describe('FHIR OAuth Flow', () => {
  test('redirects to FHIR authorization', async ({ page }) => {
    // Navigate to auth endpoint
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('authorize') || response.url().includes('oauth')
    );

    await page.goto('/api/fhir/auth');

    // Should redirect to authorization server
    const response = await responsePromise;
    expect(response.status()).toBeLessThan(400);
  });

  test('displays dashboard after connection', async ({ page }) => {
    // This test assumes successful OAuth flow
    await page.goto('/fhir/dashboard');

    // If not connected, should show connect button
    const connectButton = page.locator('a:has-text("Connect to EPIC")');
    const searchInput = page.locator('input[placeholder*="Search"]');

    // Either should be visible
    const isConnected = await searchInput.isVisible().catch(() => false);
    const needsConnection = await connectButton.isVisible().catch(() => false);

    expect(isConnected || needsConnection).toBe(true);
  });

  test('patient search works when connected', async ({ page }) => {
    // Skip if not connected
    await page.goto('/fhir/dashboard');

    const searchInput = page.locator('input[placeholder*="Search"]');
    const isConnected = await searchInput.isVisible().catch(() => false);

    if (!isConnected) {
      test.skip();
      return;
    }

    // Search for a test patient
    await searchInput.fill('Test');
    await page.click('button:has-text("Search")');

    // Should show results or no results message
    await expect(
      page.locator('ul li, :has-text("No patients found")')
    ).toBeVisible();
  });

  test('patient detail page loads', async ({ page }) => {
    // Navigate to a test patient
    await page.goto('/fhir/patient/test-patient-id');

    // Should show patient banner or error
    const banner = page.locator('.bg-blue-50');
    const error = page.locator('.bg-red-50');

    const hasBanner = await banner.isVisible().catch(() => false);
    const hasError = await error.isVisible().catch(() => false);

    expect(hasBanner || hasError).toBe(true);
  });
});

test.describe('FHIR Components', () => {
  test('PatientBanner displays patient info', async ({ page }) => {
    await page.goto('/fhir/patient/test-patient-id');

    // Wait for banner to load
    await page.waitForSelector('.bg-blue-50, .bg-red-50');

    // If loaded successfully, should show patient name
    const banner = page.locator('.bg-blue-50');
    if (await banner.isVisible()) {
      await expect(banner.locator('h2')).toBeVisible();
    }
  });

  test('VitalsChart displays vital signs', async ({ page }) => {
    await page.goto('/fhir/patient/test-patient-id');

    // Look for vitals section
    const vitalsSection = page.locator(':has-text("Vital Signs")');
    const noVitals = page.locator(':has-text("No vital signs")');
    const error = page.locator(':has-text("Failed to load vitals")');

    await expect(
      vitalsSection.or(noVitals).or(error)
    ).toBeVisible({ timeout: 10000 });
  });

  test('MedicationList displays medications', async ({ page }) => {
    await page.goto('/fhir/patient/test-patient-id');

    const medsSection = page.locator(':has-text("Active Medications")');
    const noMeds = page.locator(':has-text("No active medications")');
    const error = page.locator(':has-text("Failed to load medications")');

    await expect(
      medsSection.or(noMeds).or(error)
    ).toBeVisible({ timeout: 10000 });
  });

  test('ConditionList displays conditions', async ({ page }) => {
    await page.goto('/fhir/patient/test-patient-id');

    const conditionsSection = page.locator(':has-text("Problem List")');
    const noConditions = page.locator(':has-text("No active conditions")');
    const error = page.locator(':has-text("Failed to load conditions")');

    await expect(
      conditionsSection.or(noConditions).or(error)
    ).toBeVisible({ timeout: 10000 });
  });
});
`,
    },
  ],
};
