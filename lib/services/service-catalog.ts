/**
 * Service Catalog - Central registry for all platform services
 *
 * Manages APIs, MCP servers, and LLM providers that agents can use
 * during Quick Build and Complex Build operations.
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  description: string;
  requestBody?: Record<string, any>;
  responseExample?: Record<string, any>;
  headers?: Record<string, string>;
}

export interface CodeExample {
  title: string;
  language: 'typescript' | 'javascript' | 'python' | 'curl';
  code: string;
}

export interface ApiService {
  id: string;
  name: string;
  description: string;
  category: 'ocr' | 'healthcare' | 'database' | 'storage' | 'ai' | 'utility' | 'external';
  baseUrl: string;
  endpoints: ApiEndpoint[];
  authentication?: {
    type: 'none' | 'bearer' | 'api-key' | 'oauth';
    headerName?: string;
    envVariable?: string;
  };
  examples: CodeExample[];
  tags: string[];
  enabled: boolean;
  requiresSetup?: boolean;
  setupInstructions?: string;
}

export interface McpTool {
  name: string;
  description: string;
  inputSchema?: Record<string, any>;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface McpServerConfig {
  id: string;
  name: string;
  description: string;
  command: string;
  args: string[];
  env?: Record<string, string>;
  tools: McpTool[];
  resources?: McpResource[];
  enabled: boolean;
  autoStart?: boolean;
  category: 'filesystem' | 'database' | 'search' | 'code' | 'custom';
}

export interface LlmModel {
  id: string;
  name: string;
  contextWindow: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
  costPerMillion?: { input: number; output: number };
}

export interface LlmProvider {
  id: string;
  name: string;
  type: 'anthropic' | 'openai' | 'ollama' | 'groq' | 'local' | 'azure' | 'mlx';
  baseUrl?: string;
  apiKeyEnvVar?: string;
  models: LlmModel[];
  capabilities: ('vision' | 'code' | 'chat' | 'embedding' | 'function-calling')[];
  useCases: string[];
  enabled: boolean;
  isDefault?: boolean;
}

// ============================================================================
// EXTERNAL INTEGRATIONS (Services injected into builds)
// ============================================================================

export type IntegrationCategory =
  | 'analytics'
  | 'auth'
  | 'payments'
  | 'email'
  | 'database'
  | 'storage'
  | 'monitoring'
  | 'mock';

export interface IntegrationEnvVar {
  name: string;
  description: string;
  required: boolean;
  example?: string;
}

export interface IntegrationInjection {
  target: 'layout' | 'providers' | 'lib' | 'env' | 'config' | 'api-route';
  filename?: string;
  code: string;
  importStatement?: string;
}

export interface ExternalIntegration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  icon?: string;

  // NPM packages to install
  packages: string[];

  // Environment variables needed
  envVars: IntegrationEnvVar[];

  // Code injections
  injections: IntegrationInjection[];

  // Setup instructions
  setupSteps: string[];
  docsUrl?: string;

  // For mock services - API endpoint to test
  mockEndpoint?: string;

  enabled: boolean;
}

export interface ServiceCatalog {
  version: string;
  lastUpdated: string;
  apis: ApiService[];
  mcpServers: McpServerConfig[];
  llmProviders: LlmProvider[];
  externalIntegrations: ExternalIntegration[];
}

// ============================================================================
// CATALOG LOADER
// ============================================================================

const CATALOG_PATH = path.join(process.cwd(), 'data', 'service-catalog.json');

let catalogCache: ServiceCatalog | null = null;
let catalogLastModified: number = 0;

/**
 * Load the service catalog from disk
 */
export function loadServiceCatalog(): ServiceCatalog {
  try {
    // Check if file has been modified
    const stats = fs.statSync(CATALOG_PATH);
    if (catalogCache && stats.mtimeMs <= catalogLastModified) {
      return catalogCache;
    }

    const content = fs.readFileSync(CATALOG_PATH, 'utf-8');
    catalogCache = JSON.parse(content);
    catalogLastModified = stats.mtimeMs;
    return catalogCache!;
  } catch (error) {
    console.warn('[ServiceCatalog] Failed to load catalog, using defaults:', error);
    return getDefaultCatalog();
  }
}

/**
 * Save the service catalog to disk
 */
export function saveServiceCatalog(catalog: ServiceCatalog): void {
  catalog.lastUpdated = new Date().toISOString();
  fs.writeFileSync(CATALOG_PATH, JSON.stringify(catalog, null, 2));
  catalogCache = catalog;
  catalogLastModified = Date.now();
}

/**
 * Get enabled APIs filtered by category or tags
 */
export function getEnabledApis(options?: {
  category?: ApiService['category'];
  tags?: string[];
}): ApiService[] {
  const catalog = loadServiceCatalog();
  let apis = catalog.apis.filter(api => api.enabled);

  if (options?.category) {
    apis = apis.filter(api => api.category === options.category);
  }

  if (options?.tags?.length) {
    apis = apis.filter(api =>
      options.tags!.some(tag => api.tags.includes(tag))
    );
  }

  return apis;
}

/**
 * Get enabled MCP servers
 */
export function getEnabledMcpServers(): McpServerConfig[] {
  const catalog = loadServiceCatalog();
  return catalog.mcpServers.filter(server => server.enabled);
}

/**
 * Get enabled LLM providers
 */
export function getEnabledLlmProviders(): LlmProvider[] {
  const catalog = loadServiceCatalog();
  return catalog.llmProviders.filter(provider => provider.enabled);
}

/**
 * Get the default LLM provider
 */
export function getDefaultLlmProvider(): LlmProvider | undefined {
  const providers = getEnabledLlmProviders();
  return providers.find(p => p.isDefault) || providers[0];
}

/**
 * Find best LLM for a specific capability
 */
export function findLlmForCapability(
  capability: LlmProvider['capabilities'][number]
): LlmProvider | undefined {
  const providers = getEnabledLlmProviders();
  return providers.find(p => p.capabilities.includes(capability));
}

/**
 * Add or update an API service
 */
export function upsertApiService(api: ApiService): void {
  const catalog = loadServiceCatalog();
  const index = catalog.apis.findIndex(a => a.id === api.id);
  if (index >= 0) {
    catalog.apis[index] = api;
  } else {
    catalog.apis.push(api);
  }
  saveServiceCatalog(catalog);
}

/**
 * Add or update an MCP server
 */
export function upsertMcpServer(server: McpServerConfig): void {
  const catalog = loadServiceCatalog();
  const index = catalog.mcpServers.findIndex(s => s.id === server.id);
  if (index >= 0) {
    catalog.mcpServers[index] = server;
  } else {
    catalog.mcpServers.push(server);
  }
  saveServiceCatalog(catalog);
}

/**
 * Add or update an LLM provider
 */
export function upsertLlmProvider(provider: LlmProvider): void {
  const catalog = loadServiceCatalog();
  const index = catalog.llmProviders.findIndex(p => p.id === provider.id);
  if (index >= 0) {
    catalog.llmProviders[index] = provider;
  } else {
    catalog.llmProviders.push(provider);
  }
  saveServiceCatalog(catalog);
}

/**
 * Remove a service by ID and type
 */
export function removeService(
  id: string,
  type: 'api' | 'mcp' | 'llm' | 'integration'
): boolean {
  const catalog = loadServiceCatalog();
  let removed = false;

  switch (type) {
    case 'api':
      const apiIndex = catalog.apis.findIndex(a => a.id === id);
      if (apiIndex >= 0) {
        catalog.apis.splice(apiIndex, 1);
        removed = true;
      }
      break;
    case 'mcp':
      const mcpIndex = catalog.mcpServers.findIndex(s => s.id === id);
      if (mcpIndex >= 0) {
        catalog.mcpServers.splice(mcpIndex, 1);
        removed = true;
      }
      break;
    case 'llm':
      const llmIndex = catalog.llmProviders.findIndex(p => p.id === id);
      if (llmIndex >= 0) {
        catalog.llmProviders.splice(llmIndex, 1);
        removed = true;
      }
      break;
    case 'integration':
      const intIndex = catalog.externalIntegrations.findIndex(i => i.id === id);
      if (intIndex >= 0) {
        catalog.externalIntegrations.splice(intIndex, 1);
        removed = true;
      }
      break;
  }

  if (removed) {
    saveServiceCatalog(catalog);
  }
  return removed;
}

// ============================================================================
// EXTERNAL INTEGRATION HELPERS
// ============================================================================

/**
 * Get enabled external integrations
 */
export function getEnabledIntegrations(category?: IntegrationCategory): ExternalIntegration[] {
  const catalog = loadServiceCatalog();
  let integrations = catalog.externalIntegrations.filter(i => i.enabled);

  if (category) {
    integrations = integrations.filter(i => i.category === category);
  }

  return integrations;
}

/**
 * Get integration by ID
 */
export function getIntegrationById(id: string): ExternalIntegration | undefined {
  const catalog = loadServiceCatalog();
  return catalog.externalIntegrations.find(i => i.id === id);
}

/**
 * Add or update an external integration
 */
export function upsertIntegration(integration: ExternalIntegration): void {
  const catalog = loadServiceCatalog();
  const index = catalog.externalIntegrations.findIndex(i => i.id === integration.id);
  if (index >= 0) {
    catalog.externalIntegrations[index] = integration;
  } else {
    catalog.externalIntegrations.push(integration);
  }
  saveServiceCatalog(catalog);
}

/**
 * Get all packages required by enabled integrations
 */
export function getRequiredPackages(): string[] {
  const integrations = getEnabledIntegrations();
  const packages = new Set<string>();
  integrations.forEach(i => i.packages.forEach(p => packages.add(p)));
  return Array.from(packages);
}

/**
 * Get all env vars required by enabled integrations
 */
export function getRequiredEnvVars(): IntegrationEnvVar[] {
  const integrations = getEnabledIntegrations();
  const envVars: IntegrationEnvVar[] = [];
  integrations.forEach(i => envVars.push(...i.envVars));
  return envVars;
}

// ============================================================================
// DEFAULT CATALOG
// ============================================================================

function getDefaultCatalog(): ServiceCatalog {
  return {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    apis: [
      {
        id: 'mlx-ocr',
        name: 'MLX OCR Service',
        description: 'Local OCR processing using MLX DeepSeek-VL on Apple Silicon. Extracts text from images with high accuracy.',
        category: 'ocr',
        baseUrl: '/api/mlx/ocr',
        endpoints: [
          {
            path: '/',
            method: 'POST',
            description: 'Extract text from an image',
            requestBody: {
              image: 'base64-encoded image data',
              mode: 'general | document | handwriting',
            },
            responseExample: {
              text: 'Extracted text content',
              confidence: 0.95,
              boundingBoxes: [],
            },
          },
        ],
        authentication: { type: 'none' },
        examples: [
          {
            title: 'Basic OCR Request',
            language: 'typescript',
            code: `const response = await fetch('/api/mlx/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    image: base64ImageData,
    mode: 'document'
  })
});
const { text } = await response.json();`,
          },
        ],
        tags: ['ocr', 'vision', 'local', 'apple-silicon'],
        enabled: true,
      },
      {
        id: 'ollama-ocr',
        name: 'Ollama Vision OCR',
        description: 'OCR using Ollama with LLaVA model. Fallback option for non-Apple Silicon machines.',
        category: 'ocr',
        baseUrl: '/api/ollama/ocr',
        endpoints: [
          {
            path: '/',
            method: 'POST',
            description: 'Extract text using Ollama vision model',
            requestBody: {
              image: 'base64-encoded image data',
              prompt: 'Optional custom prompt',
            },
          },
        ],
        authentication: { type: 'none' },
        examples: [
          {
            title: 'Ollama OCR Request',
            language: 'typescript',
            code: `const response = await fetch('/api/ollama/ocr', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ image: base64ImageData })
});`,
          },
        ],
        tags: ['ocr', 'vision', 'ollama'],
        enabled: true,
      },
      {
        id: 'epic-fhir',
        name: 'Epic FHIR APIs',
        description: 'Healthcare data access via Epic FHIR R4 APIs. Access patient records, medications, allergies, and more.',
        category: 'healthcare',
        baseUrl: '/api/epic/fhir',
        endpoints: [
          { path: '/Patient', method: 'GET', description: 'Search or retrieve patient demographics' },
          { path: '/Condition', method: 'GET', description: 'Patient conditions and diagnoses' },
          { path: '/MedicationRequest', method: 'GET', description: 'Medication orders and prescriptions' },
          { path: '/AllergyIntolerance', method: 'GET', description: 'Patient allergies' },
          { path: '/Observation', method: 'GET', description: 'Lab results and vitals' },
          { path: '/Encounter', method: 'GET', description: 'Patient visits and encounters' },
          { path: '/DiagnosticReport', method: 'GET', description: 'Diagnostic reports' },
          { path: '/Immunization', method: 'GET', description: 'Immunization records' },
        ],
        authentication: {
          type: 'oauth',
          envVariable: 'EPIC_ACCESS_TOKEN',
        },
        examples: [
          {
            title: 'Fetch Patient Data',
            language: 'typescript',
            code: `const response = await fetch('/api/epic/fhir/Patient/123');
const patient = await response.json();`,
          },
        ],
        tags: ['healthcare', 'fhir', 'epic', 'ehr'],
        enabled: true,
        requiresSetup: true,
        setupInstructions: 'Configure Epic credentials in Settings > Epic Integration',
      },
    ],
    mcpServers: [
      {
        id: 'filesystem',
        name: 'Filesystem Server',
        description: 'Read/write files and directories via MCP protocol',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp/mcp-workspace'],
        tools: [
          { name: 'read_file', description: 'Read contents of a file' },
          { name: 'write_file', description: 'Write content to a file' },
          { name: 'list_directory', description: 'List directory contents' },
        ],
        enabled: false,
        autoStart: false,
        category: 'filesystem',
      },
      {
        id: 'postgres',
        name: 'PostgreSQL Server',
        description: 'Query PostgreSQL databases via MCP',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: { DATABASE_URL: '${DATABASE_URL}' },
        tools: [
          { name: 'query', description: 'Execute SQL query' },
          { name: 'list_tables', description: 'List database tables' },
          { name: 'describe_table', description: 'Get table schema' },
        ],
        enabled: false,
        autoStart: false,
        category: 'database',
      },
      {
        id: 'brave-search',
        name: 'Brave Search',
        description: 'Web search via Brave Search API',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: { BRAVE_API_KEY: '${BRAVE_API_KEY}' },
        tools: [
          { name: 'brave_web_search', description: 'Search the web' },
          { name: 'brave_local_search', description: 'Search local businesses' },
        ],
        enabled: false,
        autoStart: false,
        category: 'search',
      },
      {
        id: 'github',
        name: 'GitHub Server',
        description: 'Interact with GitHub repositories, issues, and PRs',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: '${GITHUB_TOKEN}' },
        tools: [
          { name: 'create_repository', description: 'Create a new repository' },
          { name: 'search_repositories', description: 'Search repositories' },
          { name: 'create_issue', description: 'Create an issue' },
          { name: 'create_pull_request', description: 'Create a pull request' },
        ],
        enabled: false,
        autoStart: false,
        category: 'code',
      },
    ],
    llmProviders: [
      {
        id: 'anthropic',
        name: 'Anthropic Claude',
        type: 'anthropic',
        apiKeyEnvVar: 'ANTHROPIC_API_KEY',
        models: [
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', contextWindow: 200000, supportsVision: true, supportsTools: true },
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', contextWindow: 200000, supportsVision: true, supportsTools: true },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', contextWindow: 200000, supportsVision: true, supportsTools: true },
        ],
        capabilities: ['vision', 'code', 'chat', 'function-calling'],
        useCases: ['Complex reasoning', 'Code generation', 'Analysis', 'Multi-step tasks'],
        enabled: true,
        isDefault: true,
      },
      {
        id: 'ollama',
        name: 'Ollama (Local)',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        models: [
          { id: 'llama3.2', name: 'Llama 3.2', contextWindow: 128000, supportsVision: false, supportsTools: false },
          { id: 'llava', name: 'LLaVA', contextWindow: 4096, supportsVision: true, supportsTools: false },
          { id: 'codellama', name: 'Code Llama', contextWindow: 16000, supportsVision: false, supportsTools: false },
          { id: 'deepseek-coder', name: 'DeepSeek Coder', contextWindow: 16000, supportsVision: false, supportsTools: false },
        ],
        capabilities: ['vision', 'code', 'chat'],
        useCases: ['Local inference', 'Privacy-sensitive tasks', 'Vision tasks', 'Offline operation'],
        enabled: true,
      },
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        apiKeyEnvVar: 'OPENAI_API_KEY',
        models: [
          { id: 'gpt-4o', name: 'GPT-4o', contextWindow: 128000, supportsVision: true, supportsTools: true },
          { id: 'gpt-4o-mini', name: 'GPT-4o Mini', contextWindow: 128000, supportsVision: true, supportsTools: true },
          { id: 'o1', name: 'o1', contextWindow: 200000, supportsVision: true, supportsTools: false },
        ],
        capabilities: ['vision', 'code', 'chat', 'function-calling'],
        useCases: ['Alternative to Claude', 'Specific model requirements'],
        enabled: false,
      },
      {
        id: 'groq',
        name: 'Groq (Fast)',
        type: 'groq',
        baseUrl: 'https://api.groq.com/openai/v1',
        apiKeyEnvVar: 'GROQ_API_KEY',
        models: [
          { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', contextWindow: 128000, supportsVision: false, supportsTools: true },
          { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B', contextWindow: 32768, supportsVision: false, supportsTools: true },
        ],
        capabilities: ['code', 'chat', 'function-calling'],
        useCases: ['Fast inference', 'High throughput', 'Cost-effective'],
        enabled: false,
      },
    ],
    externalIntegrations: [
      {
        id: 'google-analytics',
        name: 'Google Analytics 4',
        description: 'Track user behavior and website analytics with Google Analytics 4. Includes page views, events, and user metrics.',
        category: 'analytics',
        icon: 'BarChart',
        packages: ['@next/third-parties'],
        envVars: [
          {
            name: 'NEXT_PUBLIC_GA_ID',
            description: 'Google Analytics 4 Measurement ID (starts with G-)',
            required: true,
            example: 'G-XXXXXXXXXX',
          },
        ],
        injections: [
          {
            target: 'layout',
            importStatement: "import { GoogleAnalytics } from '@next/third-parties/google'",
            code: '<GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID!} />',
            filename: 'app/layout.tsx',
          },
          {
            target: 'lib',
            filename: 'lib/analytics.ts',
            code: `// Google Analytics 4 utility functions
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// Track custom events
export const trackEvent = (action: string, category: string, label?: string, value?: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    });
  }
};

// Track page views (automatic with GoogleAnalytics component, but available for SPAs)
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('config', GA_ID!, {
      page_path: url,
    });
  }
};

// Extend window type for gtag
declare global {
  interface Window {
    gtag: (...args: any[]) => void;
  }
}`,
          },
        ],
        setupSteps: [
          'Go to analytics.google.com and create a new GA4 property',
          'Copy your Measurement ID (starts with G-)',
          'Add NEXT_PUBLIC_GA_ID=G-XXXXXXXXXX to your .env.local file',
          'The GoogleAnalytics component will be added to your layout automatically',
        ],
        docsUrl: 'https://nextjs.org/docs/app/building-your-application/optimizing/third-party-libraries#google-analytics',
        enabled: false,
      },
      {
        id: 'mock-analytics',
        name: 'Mock Analytics Service',
        description: 'A mock analytics service for testing integration injection. Mimics Google Analytics API patterns.',
        category: 'mock',
        icon: 'TestTube',
        packages: [],
        envVars: [
          {
            name: 'NEXT_PUBLIC_MOCK_ANALYTICS_ID',
            description: 'Mock Analytics ID for testing',
            required: true,
            example: 'MOCK-12345',
          },
        ],
        injections: [
          {
            target: 'providers',
            filename: 'components/providers/MockAnalyticsProvider.tsx',
            code: `'use client';

import { createContext, useContext, useEffect, ReactNode } from 'react';

interface MockAnalyticsContextType {
  trackEvent: (action: string, category: string, label?: string) => void;
  trackPageView: (url: string) => void;
}

const MockAnalyticsContext = createContext<MockAnalyticsContextType | null>(null);

export function MockAnalyticsProvider({ children }: { children: ReactNode }) {
  const analyticsId = process.env.NEXT_PUBLIC_MOCK_ANALYTICS_ID;

  useEffect(() => {
    console.log('[MockAnalytics] Initialized with ID:', analyticsId);
  }, [analyticsId]);

  const trackEvent = (action: string, category: string, label?: string) => {
    console.log('[MockAnalytics] Event:', { action, category, label, analyticsId });
    // In real implementation, this would send to your analytics endpoint
    fetch('/api/mock-analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, category, label, analyticsId }),
    }).catch(() => {}); // Fire and forget
  };

  const trackPageView = (url: string) => {
    console.log('[MockAnalytics] Page View:', { url, analyticsId });
    fetch('/api/mock-analytics/pageview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, analyticsId }),
    }).catch(() => {});
  };

  return (
    <MockAnalyticsContext.Provider value={{ trackEvent, trackPageView }}>
      {children}
    </MockAnalyticsContext.Provider>
  );
}

export function useMockAnalytics() {
  const context = useContext(MockAnalyticsContext);
  if (!context) {
    throw new Error('useMockAnalytics must be used within MockAnalyticsProvider');
  }
  return context;
}`,
          },
          {
            target: 'api-route',
            filename: 'app/api/mock-analytics/event/route.ts',
            code: `import { NextRequest, NextResponse } from 'next/server';

// In-memory store for demo (use a real database in production)
const events: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const event = {
      ...body,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    };
    events.push(event);
    console.log('[MockAnalytics API] Event received:', event);
    return NextResponse.json({ success: true, eventId: event.id });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ events, count: events.length });
}`,
          },
          {
            target: 'api-route',
            filename: 'app/api/mock-analytics/pageview/route.ts',
            code: `import { NextRequest, NextResponse } from 'next/server';

const pageviews: any[] = [];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pageview = {
      ...body,
      timestamp: new Date().toISOString(),
      id: crypto.randomUUID(),
    };
    pageviews.push(pageview);
    console.log('[MockAnalytics API] Pageview received:', pageview);
    return NextResponse.json({ success: true, pageviewId: pageview.id });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({ pageviews, count: pageviews.length });
}`,
          },
        ],
        setupSteps: [
          'Set NEXT_PUBLIC_MOCK_ANALYTICS_ID=MOCK-12345 in your .env.local',
          'Wrap your app with MockAnalyticsProvider',
          'Use useMockAnalytics() hook to track events',
          'View tracked events at /api/mock-analytics/event',
        ],
        mockEndpoint: '/api/mock-analytics',
        enabled: false,
      },
    ],
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  CATALOG_PATH,
  getDefaultCatalog,
};
