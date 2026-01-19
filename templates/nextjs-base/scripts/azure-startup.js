/**
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
