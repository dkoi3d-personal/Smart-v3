/**
 * Infrastructure Analysis API
 *
 * Analyzes a project to detect infrastructure requirements based on:
 * - package.json dependencies
 * - Environment variable references
 * - Config files (prisma, drizzle, etc.)
 * - Code patterns
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

interface InfraRequirement {
  id: string;
  type: 'database' | 'storage' | 'cache' | 'queue' | 'cdn' | 'auth' | 'api' | 'compute';
  name: string;
  description: string;
  detected: boolean;
  detectedFrom: string[];
  provider: 'azure' | 'aws' | 'gcp' | 'vercel' | 'any';
  status: 'not_provisioned' | 'provisioning' | 'ready' | 'error';
}

interface AnalysisResult {
  requirements: InfraRequirement[];
  packageJson?: {
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
  };
  envVars: string[];
  configFiles: string[];
}

// Detection patterns for various infrastructure needs
const DETECTION_PATTERNS = {
  database: {
    postgres: {
      packages: ['pg', 'postgres', '@prisma/client', 'drizzle-orm', 'sequelize', 'typeorm', 'knex'],
      envVars: ['DATABASE_URL', 'POSTGRES_URL', 'PG_CONNECTION', 'DB_HOST'],
      files: ['prisma/schema.prisma', 'drizzle.config.ts', 'drizzle.config.js'],
    },
    mysql: {
      packages: ['mysql', 'mysql2'],
      envVars: ['MYSQL_URL', 'MYSQL_HOST'],
      files: [],
    },
    mongodb: {
      packages: ['mongoose', 'mongodb'],
      envVars: ['MONGODB_URI', 'MONGO_URL'],
      files: [],
    },
  },
  cache: {
    redis: {
      packages: ['redis', 'ioredis', '@upstash/redis'],
      envVars: ['REDIS_URL', 'REDIS_HOST', 'UPSTASH_REDIS_REST_URL'],
      files: [],
    },
  },
  storage: {
    s3: {
      packages: ['@aws-sdk/client-s3', 'aws-sdk'],
      envVars: ['AWS_S3_BUCKET', 'S3_BUCKET', 'AWS_ACCESS_KEY_ID'],
      files: [],
    },
    azure: {
      packages: ['@azure/storage-blob'],
      envVars: ['AZURE_STORAGE_CONNECTION_STRING', 'AZURE_STORAGE_ACCOUNT'],
      files: [],
    },
  },
  auth: {
    nextauth: {
      packages: ['next-auth', '@auth/core'],
      envVars: ['NEXTAUTH_SECRET', 'NEXTAUTH_URL'],
      files: ['app/api/auth/[...nextauth]/route.ts', 'pages/api/auth/[...nextauth].ts'],
    },
    clerk: {
      packages: ['@clerk/nextjs'],
      envVars: ['CLERK_SECRET_KEY', 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'],
      files: [],
    },
  },
  queue: {
    bullmq: {
      packages: ['bullmq', 'bull'],
      envVars: ['REDIS_URL'], // Usually shares with redis
      files: [],
    },
    sqs: {
      packages: ['@aws-sdk/client-sqs'],
      envVars: ['AWS_SQS_QUEUE_URL'],
      files: [],
    },
  },
};

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readFileIfExists(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

async function findEnvVars(projectDir: string): Promise<string[]> {
  const envVars: Set<string> = new Set();

  // Check .env files
  const envFiles = ['.env', '.env.local', '.env.example', '.env.development'];
  for (const envFile of envFiles) {
    const content = await readFileIfExists(path.join(projectDir, envFile));
    if (content) {
      const matches = content.match(/^([A-Z_][A-Z0-9_]*)=/gm);
      if (matches) {
        matches.forEach(m => envVars.add(m.replace('=', '')));
      }
    }
  }

  return Array.from(envVars);
}

async function analyzeProject(projectDir: string): Promise<AnalysisResult> {
  const requirements: InfraRequirement[] = [];
  const configFiles: string[] = [];

  // Read package.json
  const packageJsonPath = path.join(projectDir, 'package.json');
  let packageJson: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | null = null;

  try {
    const content = await fs.readFile(packageJsonPath, 'utf-8');
    packageJson = JSON.parse(content);
  } catch {
    // No package.json
  }

  const allDeps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };
  const depNames = Object.keys(allDeps);

  // Find env vars
  const envVars = await findEnvVars(projectDir);

  // Check for database requirements
  for (const [dbType, patterns] of Object.entries(DETECTION_PATTERNS.database)) {
    const detectedFrom: string[] = [];

    // Check packages
    const matchedPackages = patterns.packages.filter(pkg => depNames.includes(pkg));
    if (matchedPackages.length > 0) {
      detectedFrom.push(`packages: ${matchedPackages.join(', ')}`);
    }

    // Check env vars
    const matchedEnvVars = patterns.envVars.filter(ev => envVars.includes(ev));
    if (matchedEnvVars.length > 0) {
      detectedFrom.push(`env: ${matchedEnvVars.join(', ')}`);
    }

    // Check config files
    for (const file of patterns.files) {
      if (await fileExists(path.join(projectDir, file))) {
        detectedFrom.push(`file: ${file}`);
        configFiles.push(file);
      }
    }

    if (detectedFrom.length > 0) {
      requirements.push({
        id: `database-${dbType}`,
        type: 'database',
        name: dbType === 'postgres' ? 'PostgreSQL Database' :
              dbType === 'mysql' ? 'MySQL Database' :
              dbType === 'mongodb' ? 'MongoDB Database' : 'Database',
        description: `${dbType.charAt(0).toUpperCase() + dbType.slice(1)} database detected in project`,
        detected: true,
        detectedFrom,
        provider: dbType === 'mongodb' ? 'any' : 'azure',
        status: 'not_provisioned',
      });
    }
  }

  // Check for cache requirements
  for (const [cacheType, patterns] of Object.entries(DETECTION_PATTERNS.cache)) {
    const detectedFrom: string[] = [];

    const matchedPackages = patterns.packages.filter(pkg => depNames.includes(pkg));
    if (matchedPackages.length > 0) {
      detectedFrom.push(`packages: ${matchedPackages.join(', ')}`);
    }

    const matchedEnvVars = patterns.envVars.filter(ev => envVars.includes(ev));
    if (matchedEnvVars.length > 0) {
      detectedFrom.push(`env: ${matchedEnvVars.join(', ')}`);
    }

    if (detectedFrom.length > 0) {
      requirements.push({
        id: `cache-${cacheType}`,
        type: 'cache',
        name: 'Redis Cache',
        description: 'Redis cache for sessions, caching, and pub/sub',
        detected: true,
        detectedFrom,
        provider: 'azure',
        status: 'not_provisioned',
      });
    }
  }

  // Check for storage requirements
  for (const [storageType, patterns] of Object.entries(DETECTION_PATTERNS.storage)) {
    const detectedFrom: string[] = [];

    const matchedPackages = patterns.packages.filter(pkg => depNames.includes(pkg));
    if (matchedPackages.length > 0) {
      detectedFrom.push(`packages: ${matchedPackages.join(', ')}`);
    }

    const matchedEnvVars = patterns.envVars.filter(ev => envVars.includes(ev));
    if (matchedEnvVars.length > 0) {
      detectedFrom.push(`env: ${matchedEnvVars.join(', ')}`);
    }

    if (detectedFrom.length > 0) {
      requirements.push({
        id: `storage-${storageType}`,
        type: 'storage',
        name: storageType === 's3' ? 'S3 Storage' : 'Azure Blob Storage',
        description: 'Object storage for files and media',
        detected: true,
        detectedFrom,
        provider: storageType === 's3' ? 'aws' : 'azure',
        status: 'not_provisioned',
      });
    }
  }

  // Check for auth requirements
  for (const [authType, patterns] of Object.entries(DETECTION_PATTERNS.auth)) {
    const detectedFrom: string[] = [];

    const matchedPackages = patterns.packages.filter(pkg => depNames.includes(pkg));
    if (matchedPackages.length > 0) {
      detectedFrom.push(`packages: ${matchedPackages.join(', ')}`);
    }

    const matchedEnvVars = patterns.envVars.filter(ev => envVars.includes(ev));
    if (matchedEnvVars.length > 0) {
      detectedFrom.push(`env: ${matchedEnvVars.join(', ')}`);
    }

    for (const file of patterns.files) {
      if (await fileExists(path.join(projectDir, file))) {
        detectedFrom.push(`file: ${file}`);
        configFiles.push(file);
      }
    }

    if (detectedFrom.length > 0) {
      requirements.push({
        id: `auth-${authType}`,
        type: 'auth',
        name: authType === 'nextauth' ? 'NextAuth.js' : 'Clerk Authentication',
        description: 'Authentication provider',
        detected: true,
        detectedFrom,
        provider: 'any',
        status: 'not_provisioned',
      });
    }
  }

  // Check for queue requirements
  for (const [queueType, patterns] of Object.entries(DETECTION_PATTERNS.queue)) {
    const detectedFrom: string[] = [];

    const matchedPackages = patterns.packages.filter(pkg => depNames.includes(pkg));
    if (matchedPackages.length > 0) {
      detectedFrom.push(`packages: ${matchedPackages.join(', ')}`);
    }

    if (detectedFrom.length > 0) {
      requirements.push({
        id: `queue-${queueType}`,
        type: 'queue',
        name: queueType === 'bullmq' ? 'BullMQ Queue' : 'AWS SQS Queue',
        description: 'Message queue for background jobs',
        detected: true,
        detectedFrom,
        provider: queueType === 'sqs' ? 'aws' : 'azure',
        status: 'not_provisioned',
      });
    }
  }

  // If no requirements detected, add default suggestions
  if (requirements.length === 0) {
    requirements.push(
      {
        id: 'database-postgres',
        type: 'database',
        name: 'PostgreSQL Database',
        description: 'Relational database for application data',
        detected: false,
        detectedFrom: [],
        provider: 'azure',
        status: 'not_provisioned',
      },
      {
        id: 'cache-redis',
        type: 'cache',
        name: 'Redis Cache',
        description: 'In-memory cache for sessions and caching',
        detected: false,
        detectedFrom: [],
        provider: 'azure',
        status: 'not_provisioned',
      },
      {
        id: 'storage-blob',
        type: 'storage',
        name: 'Blob Storage',
        description: 'File and media storage',
        detected: false,
        detectedFrom: [],
        provider: 'azure',
        status: 'not_provisioned',
      }
    );
  }

  return {
    requirements,
    packageJson: packageJson ? {
      dependencies: packageJson.dependencies || {},
      devDependencies: packageJson.devDependencies || {},
    } : undefined,
    envVars,
    configFiles,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Determine project directory
    const projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), 'projects');
    const projectDir = path.join(projectsDir, projectId);

    // Check if project exists
    try {
      await fs.access(projectDir);
    } catch {
      return NextResponse.json({
        error: 'Project not found',
        requirements: [], // Return empty requirements
        envVars: [],
        configFiles: [],
      });
    }

    const result = await analyzeProject(projectDir);
    return NextResponse.json(result);

  } catch (error: any) {
    console.error('Infrastructure analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
