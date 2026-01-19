/**
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
