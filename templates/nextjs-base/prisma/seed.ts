/**
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
