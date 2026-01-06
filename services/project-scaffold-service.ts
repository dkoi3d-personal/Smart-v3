/**
 * Project Scaffold Service
 *
 * Fast project initialization by copying pre-built templates instead of
 * running create-next-app (which takes 5-10 minutes).
 *
 * Flow:
 * 1. First run: Creates base template with npm install (~5 min, one-time)
 * 2. Subsequent runs: Copies template files + symlinks node_modules (~10 sec)
 */

import { promises as fs } from 'fs';
import path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const TEMPLATES_DIR = path.join(process.cwd(), 'templates');
const BASE_NEXTJS_TEMPLATE = path.join(TEMPLATES_DIR, 'nextjs-base');
const IS_WINDOWS = process.platform === 'win32';

export interface ScaffoldOptions {
  projectDir: string;
  projectName?: string;
  includeTests?: boolean;
  useSymlinks?: boolean; // Use symlinks for node_modules (faster but shared)
}

export interface ScaffoldResult {
  success: boolean;
  message: string;
  duration: number;
  method: 'template-copy' | 'create-next-app' | 'fallback';
}

/**
 * Base Next.js template package.json with all common dependencies
 */
const BASE_PACKAGE_JSON = {
  name: "nextjs-project",
  version: "0.1.0",
  private: true,
  scripts: {
    dev: "next dev",
    verify: "./node_modules/.bin/tsc --noEmit",
    "clean:build": "node scripts/clean-build.cjs",
    // "build" just runs verify - coders can't accidentally run real builds
    build: "./node_modules/.bin/tsc --noEmit && echo 'Type check passed. Testers will run real build.'",
    // Testers use "build:full" for actual Next.js builds
    "build:full": "npm run clean:build && cross-env NODE_ENV=production next build",
    start: "next start",
    lint: "next lint",
    test: "jest",
    "test:watch": "jest --watch"
  },
  dependencies: {
    next: "14.2.18",
    react: "^18",
    "react-dom": "^18",
    // Database - pinned to 5.x to avoid Prisma 7 breaking changes
    "@prisma/client": "5.22.0",
  },
  devDependencies: {
    typescript: "^5",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    tailwindcss: "^3.4",
    postcss: "^8",
    autoprefixer: "^10",
    // Database - pinned to 5.x to avoid Prisma 7 breaking changes
    prisma: "5.22.0",
    tsx: "^4.0.0",
    // Windows compatibility
    "cross-env": "^7.0.3",
    // ESLint 9 + Prettier
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "typescript-eslint": "^8.0.0",
    "eslint-plugin-react": "^7.35.0",
    "eslint-plugin-react-hooks": "^5.0.0",
    "prettier": "^3.3.0",
    // Testing
    jest: "^29",
    "@testing-library/react": "^14",
    "@testing-library/jest-dom": "^6",
    "@types/jest": "^29",
    "jest-environment-jsdom": "^29"
  },
  prisma: {
    seed: "tsx prisma/seed.ts"
  }
};

/**
 * Check if base template exists and is valid
 */
export async function isTemplateReady(): Promise<boolean> {
  try {
    const nodeModulesPath = path.join(BASE_NEXTJS_TEMPLATE, 'node_modules');
    const packageJsonPath = path.join(BASE_NEXTJS_TEMPLATE, 'package.json');

    await fs.access(nodeModulesPath);
    await fs.access(packageJsonPath);

    // Check node_modules has content
    const entries = await fs.readdir(nodeModulesPath);
    return entries.length > 10; // Should have many packages
  } catch {
    return false;
  }
}

/**
 * Initialize the base template (one-time setup, ~5 min)
 */
export async function initializeBaseTemplate(): Promise<void> {
  console.log('[Scaffold] Initializing base Next.js template...');
  const startTime = Date.now();

  // Create template directory
  await fs.mkdir(BASE_NEXTJS_TEMPLATE, { recursive: true });

  // Write package.json
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'package.json'),
    JSON.stringify(BASE_PACKAGE_JSON, null, 2)
  );

  // Write tsconfig.json
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        lib: ["dom", "dom.iterable", "esnext"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        paths: { "@/*": ["./*"] }
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"]
    }, null, 2)
  );

  // Write tailwind.config.js
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'tailwind.config.js'),
    `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
}
`
  );

  // Write postcss.config.mjs
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'postcss.config.mjs'),
    `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
export default config;
`
  );

  // Write next.config.mjs - App Router only, no Pages Router features
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'next.config.mjs'),
    `/** @type {import('next').NextConfig} */
const nextConfig = {
  // Force clean build to avoid stale cache issues
  cleanDistDir: true,
  // Disable static optimization that can cause issues
  reactStrictMode: true,
  // Transpile packages for proper ESM support
  transpilePackages: [],
  // Logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
};
export default nextConfig;
`
  );

  // Write jest.config.js
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'jest.config.js'),
    `const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
module.exports = createJestConfig({
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
});
`
  );

  // Write jest.setup.js
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'jest.setup.js'),
    `import '@testing-library/jest-dom';
`
  );

  // Write eslint.config.js - ESLint 9 flat config format
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'eslint.config.js'),
    `import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    ignores: ['node_modules/', '.next/', 'out/', 'prisma/'],
  },
];
`
  );

  // Write .prettierignore - prevent prettier from choking on non-JS files
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, '.prettierignore'),
    `node_modules/
.next/
out/
prisma/
*.prisma
*.md
*.json
*.lock
`
  );

  // Write .prettierrc for consistent formatting
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, '.prettierrc'),
    `{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
`
  );

  // Create app directory with basic layout
  const appDir = path.join(BASE_NEXTJS_TEMPLATE, 'app');
  await fs.mkdir(appDir, { recursive: true });

  await fs.writeFile(
    path.join(appDir, 'layout.tsx'),
    `import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Next.js App',
  description: 'Generated by AI Dev Platform',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
  );

  await fs.writeFile(
    path.join(appDir, 'page.tsx'),
    `/**
 * Homepage - Root Route (/)
 *
 * This file handles localhost:3000/
 * Modify this to be your app's main landing page.
 */
export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="text-center px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-6">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-3">
          Ready to Build
        </h1>
        <p className="text-lg text-slate-600 mb-6 max-w-md">
          Your Next.js app is running. Start building your features!
        </p>
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <code className="text-sm text-slate-600">localhost:3000</code>
        </div>
      </div>
    </main>
  );
}
`
  );

  await fs.writeFile(
    path.join(appDir, 'globals.css'),
    `@tailwind base;
@tailwind components;
@tailwind utilities;
`
  );

  // Write next-env.d.ts
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, 'next-env.d.ts'),
    `/// <reference types="next" />
/// <reference types="next/image-types/global" />
`
  );

  // Create lib directory for Prisma singleton
  const libDir = path.join(BASE_NEXTJS_TEMPLATE, 'lib');
  await fs.mkdir(libDir, { recursive: true });

  // Write lib/prisma.ts - Prisma 5.x singleton with WAL mode for concurrency
  await fs.writeFile(
    path.join(libDir, 'prisma.ts'),
    `/**
 * Prisma Client Singleton
 * Prevents multiple Prisma instances in development (hot reload)
 * Uses WAL mode for SQLite to support concurrent access from multiple coders
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  walEnabled: boolean | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

// Enable WAL mode for SQLite - allows concurrent reads and better write performance
// This prevents "database is locked" errors when multiple agents access the DB
if (!globalForPrisma.walEnabled && process.env.DATABASE_URL?.includes('file:')) {
  prisma.$executeRawUnsafe('PRAGMA journal_mode = WAL;')
    .then(() => {
      globalForPrisma.walEnabled = true;
      console.log('[Prisma] SQLite WAL mode enabled for better concurrency');
    })
    .catch(() => {
      // Ignore errors - WAL mode is optional optimization
    });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
`
  );

  // Create prisma directory
  const prismaDir = path.join(BASE_NEXTJS_TEMPLATE, 'prisma');
  await fs.mkdir(prismaDir, { recursive: true });

  // Write prisma/schema.prisma - SQLite for local dev
  // NOTE: No auth fields - PO creates auth stories if needed, Coder adds password/sessions
  await fs.writeFile(
    path.join(prismaDir, 'schema.prisma'),
    `// Prisma Schema - Prisma 5.x
// Uses SQLite for local development
// NOTE: Auth fields (password, sessions) are added by Coder when auth stories exist

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
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
`
  );

  // Write prisma/seed.ts
  await fs.writeFile(
    path.join(prismaDir, 'seed.ts'),
    `/**
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
`
  );

  // NOTE: We only create .env.example, NOT .env
  // The multi-agent-service creates .env.local at runtime with proper values
  // Having both .env and .env.local causes conflicts

  // Write .env.example (documentation only)
  await fs.writeFile(
    path.join(BASE_NEXTJS_TEMPLATE, '.env.example'),
    `# Database - SQLite for local development
DATABASE_URL="file:./dev.db"

# Auth (uncomment when implementing authentication)
# NEXTAUTH_SECRET="your-secret-key-here"
# NEXTAUTH_URL="http://localhost:3000"
`
  );

  // Create scripts directory for Windows-compatible build scripts
  const scriptsDir = path.join(BASE_NEXTJS_TEMPLATE, 'scripts');
  await fs.mkdir(scriptsDir, { recursive: true });

  // Write scripts/clean-build.js - Windows-compatible cleanup with retries
  await fs.writeFile(
    path.join(scriptsDir, 'clean-build.js'),
    `/**
 * Windows-compatible build cleanup script
 * Handles file locking issues that prevent .next deletion
 */
const fs = require('fs');
const path = require('path');

const DIRS_TO_CLEAN = ['.next', 'pages', 'out'];
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanDir(dir) {
  const fullPath = path.resolve(process.cwd(), dir);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        console.log(\`✓ Cleaned \${dir}\`);
      }
      return true;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.log(\`Retry \${attempt}/\${MAX_RETRIES} for \${dir}...\`);
        await sleep(RETRY_DELAY);
      } else {
        console.warn(\`⚠ Could not clean \${dir}: \${err.message}\`);
        return false;
      }
    }
  }
}

async function main() {
  console.log('Cleaning build artifacts...');
  await Promise.all(DIRS_TO_CLEAN.map(cleanDir));
  console.log('Cleanup complete');
}

main().catch(console.error);
`
  );

  // Write scripts/azure-startup.js - Handles DB migrations on Azure deployment
  await fs.writeFile(
    path.join(scriptsDir, 'azure-startup.js'),
    `/**
 * Azure App Service Startup Script
 * Runs database migrations and seeding before starting the Next.js server.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (msg) => console.log('[Startup] ' + new Date().toISOString() + ' - ' + msg);

async function main() {
  log('Starting Azure deployment initialization...');

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('No DATABASE_URL - skipping database setup');
    return startServer();
  }

  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    log('No Prisma schema - skipping database setup');
    return startServer();
  }

  try {
    log('Generating Prisma client...');
    execSync('npx prisma generate', { stdio: 'inherit', timeout: 60000 });

    log('Running database migrations...');
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit', timeout: 120000 });
      log('Migrations applied');
    } catch {
      log('migrate deploy failed, trying db push...');
      try {
        execSync('npx prisma db push', { stdio: 'inherit', timeout: 120000 });
        log('Schema pushed');
      } catch (e) {
        console.error('Schema sync failed:', e.message);
      }
    }

    const markerPath = path.join(process.cwd(), '.db-seeded');
    if (!fs.existsSync(markerPath) && process.env.SKIP_DB_SEED !== 'true') {
      log('Running database seed...');
      try {
        execSync('npx prisma db seed', { stdio: 'inherit', timeout: 180000 });
        fs.writeFileSync(markerPath, new Date().toISOString());
        log('Database seeded');
      } catch (e) {
        console.error('Seeding failed (non-fatal):', e.message);
      }
    } else {
      log('Skipping seed (already seeded or disabled)');
    }
  } catch (e) {
    console.error('Database setup failed:', e.message);
  }

  startServer();
}

function startServer() {
  log('Starting Next.js server...');
  const serverPath = path.join(process.cwd(), 'server.js');
  if (fs.existsSync(serverPath)) {
    require(serverPath);
  } else {
    execSync('npx next start', { stdio: 'inherit' });
  }
}

main().catch((e) => { console.error('Startup failed:', e); process.exit(1); });
`
  );

  // Run npm install
  console.log('[Scaffold] Running npm install (this takes a few minutes first time)...');
  try {
    execSync('npm install', {
      cwd: BASE_NEXTJS_TEMPLATE,
      stdio: 'inherit',
      timeout: 600000, // 10 min timeout
    });
  } catch (err) {
    console.error('[Scaffold] npm install failed, trying with --legacy-peer-deps');
    execSync('npm install --legacy-peer-deps', {
      cwd: BASE_NEXTJS_TEMPLATE,
      stdio: 'inherit',
      timeout: 600000,
    });
  }

  // Run prisma generate to create the Prisma client
  console.log('[Scaffold] Running prisma generate...');
  try {
    execSync('npx prisma generate', {
      cwd: BASE_NEXTJS_TEMPLATE,
      stdio: 'inherit',
      timeout: 60000, // 1 min timeout
    });
  } catch (err) {
    console.warn('[Scaffold] prisma generate failed, will be run on first build:', err);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[Scaffold] Base template initialized in ${duration}s`);
}

/**
 * Copy directory recursively (faster than npm install)
 */
async function copyDir(src: string, dest: string, excludes: string[] = []): Promise<void> {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });

  for (const entry of entries) {
    if (excludes.includes(entry.name)) continue;

    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath, excludes);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

/**
 * Create symlink (Windows uses junction for directories)
 */
async function createSymlink(target: string, linkPath: string): Promise<void> {
  try {
    if (IS_WINDOWS) {
      // Use junction on Windows (doesn't require admin)
      execSync(`mklink /J "${linkPath}" "${target}"`, { shell: 'cmd.exe' });
    } else {
      await fs.symlink(target, linkPath);
    }
  } catch (err) {
    // Fallback to copy if symlink fails
    console.warn('[Scaffold] Symlink failed, falling back to copy');
    await copyDir(target, linkPath);
  }
}

/**
 * Fast project scaffolding - copies template instead of running create-next-app
 */
export async function scaffoldProject(options: ScaffoldOptions): Promise<ScaffoldResult> {
  const { projectDir, projectName, includeTests = true, useSymlinks = false } = options;
  const startTime = Date.now();

  console.log(`[Scaffold] Starting fast scaffold for ${projectDir}`);

  // Check if template exists
  const templateReady = await isTemplateReady();

  if (!templateReady) {
    console.log('[Scaffold] Base template not ready, initializing...');
    try {
      await initializeBaseTemplate();
    } catch (err) {
      console.error('[Scaffold] Failed to initialize template:', err);
      // Fallback to create-next-app
      return await fallbackToCreateNextApp(projectDir, startTime);
    }
  }

  try {
    // Create project directory
    await fs.mkdir(projectDir, { recursive: true });

    // Clean up stale folders that cause build errors
    // .next - stale build cache causes "Html imported outside _document" errors
    // pages - Pages Router files conflict with App Router
    // out - stale static export
    const staleFolders = ['.next', 'pages', 'out'];
    for (const folder of staleFolders) {
      const folderPath = path.join(projectDir, folder);
      try {
        await fs.rm(folderPath, { recursive: true, force: true });
        console.log(`[Scaffold] Cleaned up stale folder: ${folder}`);
      } catch {
        // Folder doesn't exist, that's fine
      }
    }

    // Copy template files (excluding node_modules)
    console.log('[Scaffold] Copying template files...');
    await copyDir(BASE_NEXTJS_TEMPLATE, projectDir, ['node_modules', '.next']);

    // Handle node_modules
    const templateNodeModules = path.join(BASE_NEXTJS_TEMPLATE, 'node_modules');
    const projectNodeModules = path.join(projectDir, 'node_modules');

    if (useSymlinks) {
      console.log('[Scaffold] Creating node_modules symlink...');
      await createSymlink(templateNodeModules, projectNodeModules);
    } else {
      // Copy node_modules (slower but isolated)
      console.log('[Scaffold] Copying node_modules (this takes ~30s)...');
      await copyDir(templateNodeModules, projectNodeModules);
    }

    // Update package.json with project name
    if (projectName) {
      const pkgPath = path.join(projectDir, 'package.json');
      const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf-8'));
      pkg.name = projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
    }

    const duration = (Date.now() - startTime) / 1000;
    console.log(`[Scaffold] ✅ Project scaffolded in ${duration.toFixed(1)}s`);

    return {
      success: true,
      message: `Project scaffolded in ${duration.toFixed(1)}s`,
      duration,
      method: 'template-copy',
    };
  } catch (err) {
    console.error('[Scaffold] Template copy failed:', err);
    return await fallbackToCreateNextApp(projectDir, startTime);
  }
}

/**
 * Fallback to create-next-app if template fails
 */
async function fallbackToCreateNextApp(projectDir: string, startTime: number): Promise<ScaffoldResult> {
  console.log('[Scaffold] Falling back to create-next-app...');

  try {
    execSync(
      'npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --no-eslint --no-git --yes',
      { cwd: projectDir, stdio: 'inherit', timeout: 600000 }
    );

    // Install test deps
    execSync(
      'npm install --save-dev jest @testing-library/react @testing-library/jest-dom @types/jest jest-environment-jsdom',
      { cwd: projectDir, stdio: 'inherit', timeout: 300000 }
    );

    const duration = (Date.now() - startTime) / 1000;
    return {
      success: true,
      message: `Project created via create-next-app in ${duration.toFixed(1)}s`,
      duration,
      method: 'create-next-app',
    };
  } catch (err) {
    const duration = (Date.now() - startTime) / 1000;
    return {
      success: false,
      message: `Scaffold failed: ${err}`,
      duration,
      method: 'fallback',
    };
  }
}

/**
 * Check if project needs scaffolding (no package.json)
 */
export async function needsScaffolding(projectDir: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectDir, 'package.json'));
    return false;
  } catch {
    return true;
  }
}

/**
 * Force regenerate the base template (use when template is corrupted)
 */
export async function resetBaseTemplate(): Promise<void> {
  console.log('[Scaffold] Resetting base template...');
  try {
    await fs.rm(BASE_NEXTJS_TEMPLATE, { recursive: true, force: true });
    console.log('[Scaffold] Deleted old template');
  } catch {
    // Template doesn't exist, that's fine
  }
  await initializeBaseTemplate();
  console.log('[Scaffold] Base template reset complete');
}

export default {
  scaffoldProject,
  isTemplateReady,
  initializeBaseTemplate,
  resetBaseTemplate,
  needsScaffolding,
};
