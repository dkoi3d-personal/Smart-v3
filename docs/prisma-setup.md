# Prisma Database Setup

Reference for Prisma database configuration. Read when setting up or modifying database.

---

## Important: Use Prisma 5.x

**DO NOT use Prisma 6 or 7** - they have breaking changes.

---

## Environment Setup

`.env.local` is auto-created with SQLite for local dev:
```env
DATABASE_URL="file:./dev.db"
```

For production, use your database URL in `.env.production`.

---

## Package.json Scripts

Add these scripts for automatic database setup:
```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "db:push": "prisma db push",
    "db:seed": "prisma db seed",
    "db:setup": "prisma db push && prisma db seed",
    "dev": "npm run db:setup && next dev",
    "prebuild": "npm run clean:build && npm run db:setup"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  }
}
```

This ensures database is seeded automatically on:
- `npm run dev` - auto-seeds before starting
- `npm run build` - auto-seeds before building
- `npm install` - auto-generates Prisma client

---

## Prisma Singleton (REQUIRED)

Create `lib/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Use in components/routes:
```typescript
import { prisma } from '@/lib/prisma';

const orders = await prisma.order.findMany({
  include: { patient: true, medication: true }
});
```

---

## NEVER Use Mock Data

All data MUST come from Prisma queries, not hardcoded arrays:

```typescript
// WRONG - hardcoded data
const orders = [
  { id: '1', patientName: 'John Doe' },
];

// CORRECT - database query
const orders = await prisma.order.findMany();
```

---

## Seed File Template

Create `prisma/seed.ts`:
```typescript
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  // Use upsert to avoid duplicates
  const user = await prisma.user.upsert({
    where: { email: 'admin@test.com' },
    update: {},
    create: {
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('Seeded:', { user });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

---

## Common Commands

```bash
npx prisma generate      # Generate client after schema changes
npx prisma db push       # Push schema to database (dev)
npx prisma db seed       # Run seed script
npx prisma migrate dev   # Create migration (production-ready)
npx prisma studio        # Visual database browser
```

---

## Schema Best Practices

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String?
  role      Role     @default(USER)

  // Relations
  posts     Post[]

  // Timestamps (always include!)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Indexes
  @@index([email])
}

enum Role {
  USER
  ADMIN
}
```

---

## Incremental Seeding

When adding new models:
1. Add model to `prisma/schema.prisma`
2. Run: `npx prisma db push`
3. Update `prisma/seed.ts` with sample data
4. Run: `npx prisma db seed`
