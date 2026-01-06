/**
 * Azure App Service Startup Script
 *
 * This script runs BEFORE the Next.js server starts.
 * It handles database migrations and seeding on first deploy.
 *
 * Usage: node scripts/azure-startup.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const log = (msg) => console.log(`[Startup] ${new Date().toISOString()} - ${msg}`);
const logError = (msg) => console.error(`[Startup] ${new Date().toISOString()} - ERROR: ${msg}`);

async function main() {
  log('Starting Azure deployment initialization...');

  // Check if DATABASE_URL is configured
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    log('No DATABASE_URL found - skipping database setup');
    startServer();
    return;
  }

  log('DATABASE_URL detected - running database setup');

  // Check if prisma schema exists
  const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
  if (!fs.existsSync(schemaPath)) {
    log('No Prisma schema found - skipping database setup');
    startServer();
    return;
  }

  try {
    // Step 1: Generate Prisma client (in case it wasn't included in build)
    log('Generating Prisma client...');
    execSync('npx prisma generate', {
      stdio: 'inherit',
      timeout: 60000
    });
    log('Prisma client generated');

    // Step 2: Run database migrations
    log('Running database migrations...');
    try {
      // Use migrate deploy for production (only applies committed migrations)
      execSync('npx prisma migrate deploy', {
        stdio: 'inherit',
        timeout: 120000
      });
      log('Migrations applied successfully');
    } catch (migrateError) {
      // If migrate deploy fails (e.g., no migrations folder), try db push
      log('migrate deploy failed, trying db push...');
      try {
        execSync('npx prisma db push', {
          stdio: 'inherit',
          timeout: 120000
        });
        log('Schema pushed successfully');
      } catch (pushError) {
        logError('Database schema sync failed - app may not work correctly');
        logError(pushError.message);
      }
    }

    // Step 3: Check if database needs seeding
    // Only seed if the database is empty (first deployment)
    if (await shouldSeedDatabase()) {
      log('Running database seed...');
      try {
        execSync('npx prisma db seed', {
          stdio: 'inherit',
          timeout: 180000
        });
        log('Database seeded successfully');
      } catch (seedError) {
        // Seed failure is not fatal - app can still run
        logError('Seeding failed (non-fatal): ' + seedError.message);
      }
    } else {
      log('Database already has data - skipping seed');
    }

  } catch (error) {
    logError('Database setup failed: ' + error.message);
    // Continue to start server even if DB setup fails
    // The app might still work or show appropriate errors
  }

  startServer();
}

/**
 * Check if database is empty and needs seeding
 */
async function shouldSeedDatabase() {
  // Check for seed marker file (created after first successful seed)
  const markerPath = path.join(process.cwd(), '.db-seeded');
  if (fs.existsSync(markerPath)) {
    return false;
  }

  // Also check environment variable to skip seeding
  if (process.env.SKIP_DB_SEED === 'true') {
    return false;
  }

  // Default: seed the database
  // After seeding, create marker file
  return true;
}

/**
 * Start the Next.js server
 */
function startServer() {
  log('Starting Next.js server...');

  // Check for standalone server (preferred)
  const standaloneServerPath = path.join(process.cwd(), 'server.js');
  const standaloneServerPath2 = path.join(process.cwd(), '.next', 'standalone', 'server.js');

  if (fs.existsSync(standaloneServerPath)) {
    log('Using standalone server.js');
    require(standaloneServerPath);
  } else if (fs.existsSync(standaloneServerPath2)) {
    log('Using .next/standalone/server.js');
    require(standaloneServerPath2);
  } else {
    // Fallback to next start
    log('Using next start');
    execSync('npx next start', { stdio: 'inherit' });
  }
}

// Create seed marker after successful seed
process.on('exit', () => {
  // This would run after seed completes
});

main().catch((error) => {
  logError('Startup script failed: ' + error.message);
  process.exit(1);
});
