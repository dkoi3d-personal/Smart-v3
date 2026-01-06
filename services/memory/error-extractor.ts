/**
 * Error Pattern Extractor
 *
 * Regex-based extraction of learnings from error messages.
 * No LLM needed - fast and reliable.
 */

import { Learning, LearningType, Severity } from './learning-store';

interface ErrorPattern {
  name: string;
  pattern: RegExp;
  type: LearningType;
  category: string;
  severity: Severity;
  extractor: (match: RegExpMatchArray, fullError: string) => Partial<Learning>;
}

// ============================================================================
// Known Error Patterns
// ============================================================================

const ERROR_PATTERNS: ErrorPattern[] = [
  // -------------------------------------------------------------------------
  // Module / Import Errors
  // -------------------------------------------------------------------------
  {
    name: 'module-not-found',
    pattern: /Cannot find module ['"]([^'"]+)['"]/,
    type: 'error-solution',
    category: 'dependencies',
    severity: 'warning',
    extractor: (match) => {
      const moduleName = match[1];
      const packageName = moduleName.startsWith('@')
        ? moduleName.split('/').slice(0, 2).join('/')
        : moduleName.split('/')[0];
      return {
        title: `Missing module: ${moduleName}`,
        description: `Module "${moduleName}" is not installed or the path is incorrect`,
        solution: `Run: npm install ${packageName}`,
        library: packageName,
        errorPattern: `Cannot find module ['"]${moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`,
      };
    },
  },
  {
    name: 'module-not-found-relative',
    pattern: /Cannot find module ['"](\.[^'"]+)['"]/,
    type: 'error-solution',
    category: 'imports',
    severity: 'info',
    extractor: (match) => ({
      title: `Missing local module: ${match[1]}`,
      description: `Local module "${match[1]}" not found. Check the file path and extension.`,
      solution: 'Verify the file exists and the import path is correct. Check for typos.',
    }),
  },

  // -------------------------------------------------------------------------
  // TypeScript Errors
  // -------------------------------------------------------------------------
  {
    name: 'ts-property-not-exist',
    pattern: /Property ['"]([^'"]+)['"] does not exist on type ['"]([^'"]+)['"]/,
    type: 'gotcha',
    category: 'typescript',
    severity: 'info',
    extractor: (match) => ({
      title: `TypeScript: Missing property "${match[1]}" on type "${match[2]}"`,
      description: `Type "${match[2]}" doesn't have property "${match[1]}". This could be a typo, missing type definition, or incorrect type assertion.`,
      solution: 'Check the type definition, add the property to the interface, or use type assertion if you know the property exists.',
      tags: ['typescript', 'types'],
    }),
  },
  {
    name: 'ts-argument-not-assignable',
    pattern: /Argument of type ['"]([^'"]+)['"] is not assignable to parameter of type ['"]([^'"]+)['"]/,
    type: 'gotcha',
    category: 'typescript',
    severity: 'info',
    extractor: (match) => ({
      title: `TypeScript: Type mismatch - "${match[1]}" vs "${match[2]}"`,
      description: `Cannot assign "${match[1]}" to "${match[2]}". Types are incompatible.`,
      solution: 'Check if you need a type conversion, or if the function signature needs updating.',
      tags: ['typescript', 'types'],
    }),
  },
  {
    name: 'ts-cannot-find-name',
    pattern: /Cannot find name ['"]([^'"]+)['"]/,
    type: 'error-solution',
    category: 'typescript',
    severity: 'info',
    extractor: (match) => ({
      title: `TypeScript: Unknown identifier "${match[1]}"`,
      description: `"${match[1]}" is not defined. Likely missing import, typo, or out of scope.`,
      solution: `Add import for "${match[1]}" or check spelling`,
      tags: ['typescript'],
    }),
  },

  // -------------------------------------------------------------------------
  // Prisma Errors
  // -------------------------------------------------------------------------
  {
    name: 'prisma-error-code',
    pattern: /Prisma.*?error.*?(P\d{4})/i,
    type: 'library-issue',
    category: 'database',
    severity: 'warning',
    extractor: (match, fullError) => ({
      title: `Prisma Error ${match[1]}`,
      description: fullError.slice(0, 300),
      library: 'prisma',
      tags: ['prisma', 'database', match[1]],
      errorPattern: `P${match[1].slice(1)}`,
    }),
  },
  {
    name: 'prisma-client-not-generated',
    pattern: /PrismaClient.*?not.*?generated|@prisma\/client.*?did not initialize|Prisma.*?did not initialize/i,
    type: 'error-solution',
    category: 'database',
    severity: 'warning',
    extractor: () => ({
      title: 'Prisma client not generated or not initialized',
      description: 'The Prisma client has not been generated or is out of sync with the schema',
      solution: 'Run: npx prisma generate',
      library: 'prisma',
      tags: ['prisma', 'setup'],
    }),
  },
  {
    name: 'prisma-migration-needed',
    pattern: /database.*?schema.*?not.*?sync|migration.*?needed/i,
    type: 'error-solution',
    category: 'database',
    severity: 'warning',
    extractor: () => ({
      title: 'Prisma schema out of sync',
      description: 'Database schema is out of sync with Prisma schema',
      solution: 'Run: npx prisma migrate dev',
      library: 'prisma',
      tags: ['prisma', 'migrations'],
    }),
  },

  // -------------------------------------------------------------------------
  // Next.js Errors
  // -------------------------------------------------------------------------
  {
    name: 'nextjs-module-not-found',
    pattern: /Module not found.*?next/i,
    type: 'library-issue',
    category: 'framework',
    severity: 'warning',
    extractor: (_, fullError) => ({
      title: 'Next.js Module Resolution Error',
      description: fullError.slice(0, 300),
      library: 'next',
      tags: ['nextjs', 'module-resolution'],
    }),
  },
  {
    name: 'nextjs-server-component-error',
    pattern: /You're importing a component that needs ['"]?useState['"]?.*?only works in a Client Component/i,
    type: 'gotcha',
    category: 'framework',
    severity: 'warning',
    extractor: () => ({
      title: 'Next.js: Client component hook in Server Component',
      description: 'Using useState, useEffect, or other client hooks in a Server Component',
      solution: "Add 'use client' directive at the top of the file",
      library: 'next',
      tags: ['nextjs', 'app-router', 'server-components'],
    }),
  },
  {
    name: 'nextjs-dynamic-server-usage',
    pattern: /Dynamic server usage.*?cookies|headers|searchParams/i,
    type: 'gotcha',
    category: 'framework',
    severity: 'info',
    extractor: () => ({
      title: 'Next.js: Dynamic server usage detected',
      description: 'Using cookies(), headers(), or searchParams makes the route dynamic',
      solution: 'This is expected behavior. The route will be server-rendered on each request.',
      library: 'next',
      tags: ['nextjs', 'app-router', 'dynamic'],
    }),
  },
  {
    name: 'edge-runtime-eval-error',
    pattern: /EvalError.*?Code generation from strings|eval.*?Edge Runtime|middleware.*?eval/i,
    type: 'gotcha',
    category: 'framework',
    severity: 'critical',
    extractor: () => ({
      title: 'Edge Runtime blocks eval() in middleware',
      description: 'Next.js Edge Runtime (used by middleware) does not support eval() or code generation from strings. This often occurs when webpack uses eval in development mode.',
      solution: 'Use production builds (npm run build && npm start) for middleware projects. The dev server generates code with eval which Edge Runtime blocks.',
      library: 'next',
      tags: ['nextjs', 'middleware', 'edge-runtime', 'eval', 'production'],
    }),
  },

  // -------------------------------------------------------------------------
  // React Errors
  // -------------------------------------------------------------------------
  {
    name: 'react-hooks-rules',
    pattern: /React Hook.*?called (conditionally|in a loop|after an early return)/i,
    type: 'anti-pattern',
    category: 'react',
    severity: 'warning',
    extractor: (match) => ({
      title: 'React: Hooks rules violation',
      description: `Hook was ${match[1]}. Hooks must be called in the exact same order every render.`,
      solution: 'Move the hook call to the top level of your component, before any conditions or loops.',
      library: 'react',
      tags: ['react', 'hooks'],
    }),
  },
  {
    name: 'react-key-prop',
    pattern: /Each child in a list should have a unique "key" prop/i,
    type: 'gotcha',
    category: 'react',
    severity: 'info',
    extractor: () => ({
      title: 'React: Missing key prop in list',
      description: 'List items need unique key props for React to track them efficiently',
      solution: 'Add a unique key prop to each item. Use a stable ID, not array index if items can reorder.',
      library: 'react',
      tags: ['react', 'lists'],
    }),
  },
  {
    name: 'react-hydration-mismatch',
    pattern: /Hydration failed|Text content does not match|There was an error while hydrating/i,
    type: 'gotcha',
    category: 'react',
    severity: 'warning',
    extractor: () => ({
      title: 'React: Hydration mismatch',
      description: 'Server-rendered HTML does not match client-rendered output. This can cause UI flicker and bugs.',
      solution: 'Ensure server and client render the same content. Use useEffect for client-only values. Check for Date/random values.',
      library: 'react',
      tags: ['react', 'ssr', 'hydration'],
    }),
  },

  // -------------------------------------------------------------------------
  // Node.js / File System Errors
  // -------------------------------------------------------------------------
  {
    name: 'enoent',
    pattern: /ENOENT.*?no such file or directory.*?['"]([^'"]+)['"]/i,
    type: 'error-solution',
    category: 'filesystem',
    severity: 'info',
    extractor: (match) => ({
      title: `File not found: ${match[1]}`,
      description: `The file or directory "${match[1]}" does not exist`,
      solution: 'Create the file/directory or check the path configuration',
      tags: ['filesystem', 'node'],
    }),
  },
  {
    name: 'eacces',
    pattern: /EACCES.*?permission denied.*?['"]([^'"]+)['"]/i,
    type: 'error-solution',
    category: 'filesystem',
    severity: 'warning',
    extractor: (match) => ({
      title: `Permission denied: ${match[1]}`,
      description: `Cannot access "${match[1]}" due to insufficient permissions`,
      solution: 'Check file permissions or run with appropriate privileges',
      tags: ['filesystem', 'permissions'],
    }),
  },
  {
    name: 'eaddrinuse',
    pattern: /EADDRINUSE.*?address already in use.*?:(\d+)/i,
    type: 'error-solution',
    category: 'networking',
    severity: 'info',
    extractor: (match) => ({
      title: `Port ${match[1]} already in use`,
      description: `Another process is using port ${match[1]}`,
      solution: `Kill the process using port ${match[1]} or use a different port. Try: lsof -i :${match[1]} (Mac/Linux) or netstat -ano | findstr :${match[1]} (Windows)`,
      tags: ['networking', 'ports'],
    }),
  },

  // -------------------------------------------------------------------------
  // Package Manager Errors
  // -------------------------------------------------------------------------
  {
    name: 'npm-peer-dep',
    pattern: /npm.*?ERESOLVE.*?peer dep|peer dependency/i,
    type: 'library-issue',
    category: 'dependencies',
    severity: 'warning',
    extractor: () => ({
      title: 'npm peer dependency conflict',
      description: 'Package has conflicting peer dependency requirements',
      solution: 'Try: npm install --legacy-peer-deps, or update conflicting packages',
      tags: ['npm', 'dependencies'],
    }),
  },
  {
    name: 'node-version-mismatch',
    pattern: /The engine "node" is incompatible|requires.*?node.*?(\d+)/i,
    type: 'config',
    category: 'environment',
    severity: 'warning',
    extractor: (match) => ({
      title: 'Node.js version mismatch',
      description: `Package requires Node.js version ${match[1] || 'different from current'}`,
      solution: 'Use nvm to switch Node versions: nvm use <version>',
      tags: ['node', 'version'],
    }),
  },

  // -------------------------------------------------------------------------
  // Database Errors
  // -------------------------------------------------------------------------
  {
    name: 'db-connection-refused',
    pattern: /ECONNREFUSED.*?(\d+\.\d+\.\d+\.\d+):(\d+)|Connection refused.*?database/i,
    type: 'error-solution',
    category: 'database',
    severity: 'warning',
    extractor: (match) => ({
      title: 'Database connection refused',
      description: `Cannot connect to database${match ? ` at ${match[1]}:${match[2]}` : ''}`,
      solution: 'Ensure the database server is running and accessible. Check connection string and firewall rules.',
      tags: ['database', 'connection'],
    }),
  },
  {
    name: 'db-auth-failed',
    pattern: /authentication failed|password authentication failed|Access denied for user/i,
    type: 'error-solution',
    category: 'database',
    severity: 'warning',
    extractor: () => ({
      title: 'Database authentication failed',
      description: 'Invalid database credentials',
      solution: 'Check DATABASE_URL or connection credentials. Verify user has correct permissions.',
      tags: ['database', 'auth'],
    }),
  },

  // -------------------------------------------------------------------------
  // API / HTTP Errors
  // -------------------------------------------------------------------------
  {
    name: 'cors-error',
    pattern: /CORS.*?blocked|Access-Control-Allow-Origin|No 'Access-Control-Allow-Origin'/i,
    type: 'gotcha',
    category: 'api',
    severity: 'warning',
    extractor: () => ({
      title: 'CORS policy blocked request',
      description: 'Cross-Origin Resource Sharing policy is blocking the request',
      solution: 'Configure CORS on the server to allow the requesting origin. Add appropriate Access-Control-Allow-* headers.',
      tags: ['cors', 'api', 'security'],
    }),
  },
  {
    name: 'fetch-failed',
    pattern: /fetch failed|Failed to fetch|NetworkError when attempting to fetch/i,
    type: 'error-solution',
    category: 'api',
    severity: 'info',
    extractor: () => ({
      title: 'Network fetch failed',
      description: 'HTTP request failed - could be network issue, CORS, or server down',
      solution: 'Check network connectivity, verify URL is correct, ensure server is running',
      tags: ['fetch', 'network', 'api'],
    }),
  },

  // -------------------------------------------------------------------------
  // Build Errors
  // -------------------------------------------------------------------------
  {
    name: 'turbopack-production-error',
    pattern: /turbopack.*?production|production.*?turbopack|--turbo.*?build|turbo.*?not.*?support/i,
    type: 'gotcha',
    category: 'build',
    severity: 'warning',
    extractor: () => ({
      title: 'Turbopack not supported in production builds',
      description: 'Next.js Turbopack is only available for development mode. Production builds must use the standard webpack bundler.',
      solution: 'Remove --turbo flag from build script. Use "next build" instead of "next build --turbo". Turbopack is for dev mode only.',
      library: 'next',
      tags: ['nextjs', 'turbopack', 'build', 'production'],
    }),
  },
  {
    name: 'turbo-env-conflict',
    pattern: /NEXT_TURBO|turbopack.*?env|NODE_ENV.*?turbo/i,
    type: 'config',
    category: 'build',
    severity: 'warning',
    extractor: () => ({
      title: 'Turbopack environment variable conflict',
      description: 'NEXT_TURBO or similar turbopack-related environment variables are causing build issues.',
      solution: 'Remove NEXT_TURBO, TURBOPACK environment variables for production builds. These are only for development.',
      library: 'next',
      tags: ['nextjs', 'turbopack', 'env', 'config'],
    }),
  },
  {
    name: 'webpack-build-error',
    pattern: /Module build failed|webpack.*?error/i,
    type: 'error-solution',
    category: 'build',
    severity: 'warning',
    extractor: (_, fullError) => ({
      title: 'Webpack build failed',
      description: fullError.slice(0, 300),
      tags: ['webpack', 'build'],
    }),
  },
  {
    name: 'out-of-memory',
    pattern: /JavaScript heap out of memory|FATAL ERROR.*?allocation failed/i,
    type: 'error-solution',
    category: 'build',
    severity: 'critical',
    extractor: () => ({
      title: 'Node.js out of memory',
      description: 'Process ran out of memory during build or execution',
      solution: 'Increase memory limit: NODE_OPTIONS="--max-old-space-size=4096" npm run build',
      tags: ['memory', 'node', 'build'],
    }),
  },

  // -------------------------------------------------------------------------
  // ESLint / Linting Errors
  // -------------------------------------------------------------------------
  {
    name: 'eslint-error',
    pattern: /eslint.*?error|ESLint.*?found.*?problems?/i,
    type: 'anti-pattern',
    category: 'linting',
    severity: 'info',
    extractor: (_, fullError) => ({
      title: 'ESLint errors detected',
      description: fullError.slice(0, 300),
      solution: 'Run: npm run lint -- --fix to auto-fix fixable issues',
      tags: ['eslint', 'linting'],
    }),
  },
  {
    name: 'unused-variable',
    pattern: /['"]([^'"]+)['"] is (?:defined but never used|assigned.*?never used)/i,
    type: 'anti-pattern',
    category: 'linting',
    severity: 'info',
    extractor: (match) => ({
      title: `Unused variable: ${match[1]}`,
      description: `Variable "${match[1]}" is defined but never used`,
      solution: 'Remove the unused variable or prefix with underscore (_) to indicate intentionally unused',
      tags: ['eslint', 'cleanup'],
    }),
  },

  // -------------------------------------------------------------------------
  // Test Errors
  // -------------------------------------------------------------------------
  {
    name: 'test-failed',
    pattern: /(?:FAIL|failed).*?test|test.*?(?:FAIL|failed)|expect.*?received/i,
    type: 'error-solution',
    category: 'testing',
    severity: 'warning',
    extractor: (_, fullError) => ({
      title: 'Test failure detected',
      description: fullError.slice(0, 400),
      tags: ['testing', 'jest', 'vitest'],
    }),
  },
  {
    name: 'assertion-error',
    pattern: /Expected:?\s*(.+?)\s*Received:?\s*(.+?)(?:\n|$)/i,
    type: 'error-solution',
    category: 'testing',
    severity: 'info',
    extractor: (match) => ({
      title: `Test assertion: Expected vs Received mismatch`,
      description: `Expected: ${match[1]}, but received: ${match[2]}`,
      tags: ['testing', 'assertion'],
    }),
  },

  // -------------------------------------------------------------------------
  // JSON/Syntax Errors
  // -------------------------------------------------------------------------
  {
    name: 'json-parse-error',
    pattern: /(?:Unexpected token|SyntaxError:).*?JSON|JSON\.parse|invalid json/i,
    type: 'error-solution',
    category: 'parsing',
    severity: 'warning',
    extractor: () => ({
      title: 'JSON parsing error',
      description: 'Invalid JSON format encountered',
      solution: 'Check for trailing commas, missing quotes, or malformed JSON structure',
      tags: ['json', 'parsing'],
    }),
  },
  {
    name: 'syntax-error',
    pattern: /SyntaxError: (.+)/i,
    type: 'error-solution',
    category: 'parsing',
    severity: 'warning',
    extractor: (match) => ({
      title: `Syntax Error: ${match[1].slice(0, 80)}`,
      description: match[0],
      tags: ['syntax', 'parsing'],
    }),
  },

  // -------------------------------------------------------------------------
  // Environment Variable Errors
  // -------------------------------------------------------------------------
  {
    name: 'env-missing',
    pattern: /(?:missing|undefined).*?(?:env|environment).*?variable|env.*?(?:is not defined|not set)/i,
    type: 'config',
    category: 'environment',
    severity: 'warning',
    extractor: (_, fullError) => ({
      title: 'Missing environment variable',
      description: fullError.slice(0, 200),
      solution: 'Add the required environment variable to .env or .env.local file',
      tags: ['env', 'config'],
    }),
  },
  {
    name: 'env-var-reference',
    pattern: /process\.env\.([A-Z_]+).*?(?:undefined|null|not set)/i,
    type: 'config',
    category: 'environment',
    severity: 'warning',
    extractor: (match) => ({
      title: `Missing env var: ${match[1]}`,
      description: `Environment variable ${match[1]} is not set`,
      solution: `Add ${match[1]}=value to your .env file`,
      tags: ['env', 'config'],
    }),
  },

  // -------------------------------------------------------------------------
  // Timeout Errors
  // -------------------------------------------------------------------------
  {
    name: 'timeout-error',
    pattern: /timeout.*?exceeded|request timed out|ETIMEDOUT/i,
    type: 'error-solution',
    category: 'networking',
    severity: 'warning',
    extractor: () => ({
      title: 'Request timeout',
      description: 'Operation timed out - could be slow network or unresponsive server',
      solution: 'Increase timeout duration, check network connectivity, or verify server is responding',
      tags: ['timeout', 'network'],
    }),
  },

  // -------------------------------------------------------------------------
  // Import/Export Errors
  // -------------------------------------------------------------------------
  {
    name: 'named-export-missing',
    pattern: /does not provide an export named ['"]([^'"]+)['"]/i,
    type: 'error-solution',
    category: 'imports',
    severity: 'warning',
    extractor: (match) => ({
      title: `Missing named export: ${match[1]}`,
      description: `The module does not export "${match[1]}"`,
      solution: 'Check the module exports, use default import, or verify the export name',
      tags: ['imports', 'exports'],
    }),
  },
  {
    name: 'default-export-missing',
    pattern: /does not have a default export|has no default export/i,
    type: 'error-solution',
    category: 'imports',
    severity: 'warning',
    extractor: () => ({
      title: 'Missing default export',
      description: 'Tried to use default import on a module without default export',
      solution: 'Use named import { name } instead of default import',
      tags: ['imports', 'exports'],
    }),
  },

  // -------------------------------------------------------------------------
  // Rate Limiting / API Errors
  // -------------------------------------------------------------------------
  {
    name: 'rate-limited',
    pattern: /rate limit|too many requests|429/i,
    type: 'gotcha',
    category: 'api',
    severity: 'warning',
    extractor: () => ({
      title: 'Rate limit exceeded',
      description: 'API rate limit has been reached',
      solution: 'Implement rate limiting, add delays between requests, or use caching',
      tags: ['api', 'rate-limit'],
    }),
  },
  {
    name: 'api-unauthorized',
    pattern: /unauthorized|401.*?error|invalid.*?(?:token|api.?key|credential)/i,
    type: 'error-solution',
    category: 'api',
    severity: 'warning',
    extractor: () => ({
      title: 'API authentication failed',
      description: 'Request was unauthorized - invalid or missing credentials',
      solution: 'Check API key, token, or credentials are valid and properly configured',
      tags: ['api', 'auth'],
    }),
  },
];

// ============================================================================
// Error Extractor Class
// ============================================================================

export class ErrorExtractor {
  private patterns: ErrorPattern[];

  constructor(customPatterns?: ErrorPattern[]) {
    this.patterns = [...ERROR_PATTERNS, ...(customPatterns || [])];
  }

  /**
   * Extract a learning from an error message
   */
  extract(errorMessage: string): Learning | null {
    for (const pattern of this.patterns) {
      const match = errorMessage.match(pattern.pattern);
      if (match) {
        const extracted = pattern.extractor(match, errorMessage);
        return {
          type: pattern.type,
          category: pattern.category,
          severity: pattern.severity,
          title: extracted.title || `${pattern.category} error`,
          description: extracted.description || errorMessage.slice(0, 500),
          solution: extracted.solution,
          library: extracted.library,
          libraryVersion: extracted.libraryVersion,
          tags: extracted.tags || [pattern.category],
          errorPattern: extracted.errorPattern,
          codeExample: extracted.codeExample,
        };
      }
    }
    return null;
  }

  /**
   * Extract all matching learnings from a multi-line error/log
   */
  extractAll(logContent: string): Learning[] {
    const learnings: Learning[] = [];
    const seen = new Set<string>();

    // Split into lines and check each
    const lines = logContent.split('\n');
    let buffer = '';

    for (const line of lines) {
      buffer += line + '\n';

      // Check patterns
      for (const pattern of this.patterns) {
        const match = buffer.match(pattern.pattern);
        if (match) {
          const key = `${pattern.name}:${match[1] || ''}`;
          if (!seen.has(key)) {
            seen.add(key);
            const learning = this.extract(buffer);
            if (learning) {
              learnings.push(learning);
            }
          }
        }
      }

      // Keep buffer reasonable size
      if (buffer.length > 5000) {
        buffer = buffer.slice(-2500);
      }
    }

    return learnings;
  }

  /**
   * Add a custom pattern
   */
  addPattern(pattern: ErrorPattern): void {
    this.patterns.unshift(pattern); // Add to front for priority
  }

  /**
   * Get all pattern names
   */
  getPatternNames(): string[] {
    return this.patterns.map(p => p.name);
  }
}

// ============================================================================
// Convenience function
// ============================================================================

let instance: ErrorExtractor | null = null;

export function getErrorExtractor(): ErrorExtractor {
  if (!instance) {
    instance = new ErrorExtractor();
  }
  return instance;
}

export default ErrorExtractor;
