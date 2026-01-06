/**
 * Prisma + SQLite Quick Scaffold
 *
 * Fast database setup for builds - just run scaffoldPrisma(projectDir)
 * Creates a working Prisma setup with SQLite in seconds.
 *
 * IMPORTANT: Uses Prisma 5.x (NOT Prisma 7) for stability
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface PrismaModel {
  name: string;
  fields: Array<{
    name: string;
    type: 'String' | 'Int' | 'Boolean' | 'DateTime' | 'Float' | 'Json';
    optional?: boolean;
    isId?: boolean;
    isUnique?: boolean;
    default?: string;
    relation?: { model: string; field: string };
  }>;
}

/**
 * Generate a complete Prisma schema from models
 * Prisma 5.x - standard configuration
 */
export function generatePrismaSchema(models: PrismaModel[]): string {
  let schema = `// Prisma Schema - Auto-generated
// Database: SQLite (file-based, zero config)
// Prisma 5.x

generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-3.0.x"]
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

`;

  for (const model of models) {
    schema += `model ${model.name} {\n`;

    for (const field of model.fields) {
      let line = `  ${field.name} `;
      line += field.type;
      if (field.optional) line += '?';
      if (field.isId) line += ' @id @default(autoincrement())';
      else if (field.default) line += ` @default(${field.default})`;
      if (field.isUnique) line += ' @unique';
      schema += line + '\n';
    }

    // Add timestamps by default
    if (!model.fields.some(f => f.name === 'createdAt')) {
      schema += '  createdAt DateTime @default(now())\n';
    }
    if (!model.fields.some(f => f.name === 'updatedAt')) {
      schema += '  updatedAt DateTime @updatedAt\n';
    }

    schema += '}\n\n';
  }

  return schema;
}

/**
 * Quick scaffold Prisma + SQLite in a project
 * Call this from build agents when backend is needed
 */
export async function scaffoldPrisma(
  projectDir: string,
  models?: PrismaModel[]
): Promise<void> {
  const prismaDir = path.join(projectDir, 'prisma');

  // Create prisma directory
  await fs.mkdir(prismaDir, { recursive: true });

  // Default models if none provided
  const defaultModels: PrismaModel[] = models || [
    {
      name: 'User',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'email', type: 'String', isUnique: true },
        { name: 'name', type: 'String', optional: true },
      ]
    }
  ];

  // Write schema
  const schema = generatePrismaSchema(defaultModels);
  await fs.writeFile(path.join(prismaDir, 'schema.prisma'), schema);

  // Write .env with SQLite path
  const envContent = `# Database - SQLite (zero config, just works)
DATABASE_URL="file:./dev.db"
`;

  // Only write .env if it doesn't exist
  const envPath = path.join(projectDir, '.env');
  try {
    await fs.access(envPath);
    // File exists, append if DATABASE_URL not present
    const existing = await fs.readFile(envPath, 'utf-8');
    if (!existing.includes('DATABASE_URL')) {
      await fs.appendFile(envPath, '\n' + envContent);
    }
  } catch {
    // File doesn't exist, create it
    await fs.writeFile(envPath, envContent);
  }

  // Write db utility (Prisma 5.x standard)
  const dbUtilContent = `/**
 * Prisma Client Singleton
 * Prevents multiple Prisma instances in development (hot reload)
 * Prisma 5.x
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
`;

  const libDir = path.join(projectDir, 'lib');
  await fs.mkdir(libDir, { recursive: true });
  await fs.writeFile(path.join(libDir, 'db.ts'), dbUtilContent);

  console.log(`[Prisma] Scaffolded SQLite database in ${projectDir}`);
}

/**
 * Infer models from requirements text
 */
export function inferModelsFromRequirements(requirements: string): PrismaModel[] {
  const models: PrismaModel[] = [];
  const text = requirements.toLowerCase();

  // Common patterns
  if (text.includes('user') || text.includes('auth') || text.includes('login')) {
    models.push({
      name: 'User',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'email', type: 'String', isUnique: true },
        { name: 'name', type: 'String', optional: true },
        { name: 'password', type: 'String', optional: true },
      ]
    });
  }

  if (text.includes('product') || text.includes('item') || text.includes('inventory')) {
    models.push({
      name: 'Product',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'name', type: 'String' },
        { name: 'description', type: 'String', optional: true },
        { name: 'price', type: 'Float' },
        { name: 'stock', type: 'Int', default: '0' },
      ]
    });
  }

  if (text.includes('order') || text.includes('purchase') || text.includes('checkout')) {
    models.push({
      name: 'Order',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'status', type: 'String', default: '"pending"' },
        { name: 'total', type: 'Float' },
        { name: 'userId', type: 'Int', optional: true },
      ]
    });
  }

  if (text.includes('post') || text.includes('article') || text.includes('blog')) {
    models.push({
      name: 'Post',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'title', type: 'String' },
        { name: 'content', type: 'String' },
        { name: 'published', type: 'Boolean', default: 'false' },
        { name: 'authorId', type: 'Int', optional: true },
      ]
    });
  }

  if (text.includes('task') || text.includes('todo')) {
    models.push({
      name: 'Task',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'title', type: 'String' },
        { name: 'completed', type: 'Boolean', default: 'false' },
        { name: 'priority', type: 'String', default: '"medium"' },
      ]
    });
  }

  if (text.includes('patient') || text.includes('medical') || text.includes('health')) {
    models.push({
      name: 'Patient',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'name', type: 'String' },
        { name: 'dateOfBirth', type: 'DateTime', optional: true },
        { name: 'medicalRecordNumber', type: 'String', isUnique: true },
      ]
    });
  }

  if (text.includes('appointment') || text.includes('booking') || text.includes('schedule')) {
    models.push({
      name: 'Appointment',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'date', type: 'DateTime' },
        { name: 'status', type: 'String', default: '"scheduled"' },
        { name: 'notes', type: 'String', optional: true },
      ]
    });
  }

  // Pharmacy specific
  if (text.includes('prescription') || text.includes('pharmacy') || text.includes('medication')) {
    models.push({
      name: 'Prescription',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'patientName', type: 'String' },
        { name: 'medication', type: 'String' },
        { name: 'dosage', type: 'String' },
        { name: 'quantity', type: 'Int' },
        { name: 'status', type: 'String', default: '"pending"' },
        { name: 'prescribedBy', type: 'String', optional: true },
      ]
    });

    models.push({
      name: 'Medication',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'name', type: 'String' },
        { name: 'genericName', type: 'String', optional: true },
        { name: 'category', type: 'String' },
        { name: 'stock', type: 'Int', default: '0' },
        { name: 'price', type: 'Float' },
      ]
    });
  }

  // Default if nothing matched
  if (models.length === 0) {
    models.push({
      name: 'Item',
      fields: [
        { name: 'id', type: 'Int', isId: true },
        { name: 'name', type: 'String' },
        { name: 'data', type: 'Json', optional: true },
      ]
    });
  }

  return models;
}

/**
 * Get Prisma setup instructions for build agents
 */
export function getPrismaInstructions(): string {
  return `
## Database Setup (Prisma 5.x + SQLite)

The project uses Prisma 5.x with SQLite for fast, zero-config database:

1. Schema is in \`prisma/schema.prisma\`
2. Database URL is in \`.env\` (DATABASE_URL)
3. Database file will be \`prisma/dev.db\`
4. Use \`lib/db.ts\` or \`lib/prisma.ts\` to import prisma client

### Required packages:
\`\`\`bash
npm install @prisma/client
npm install -D prisma
\`\`\`

### Commands (run after schema changes):
\`\`\`bash
npx prisma generate  # Generate client
npx prisma db push   # Create/update database
\`\`\`

### Usage in API routes:
\`\`\`typescript
import { prisma } from '@/lib/db';

// Create
await prisma.user.create({ data: { email, name } });

// Read
const users = await prisma.user.findMany();

// Update
await prisma.user.update({ where: { id }, data: { name } });

// Delete
await prisma.user.delete({ where: { id } });
\`\`\`
`;
}
