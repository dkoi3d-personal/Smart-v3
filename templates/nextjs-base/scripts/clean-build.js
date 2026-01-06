/**
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
        console.log(`✓ Cleaned ${dir}`);
      }
      return true;
    } catch (err) {
      if (attempt < MAX_RETRIES) {
        console.log(`Retry ${attempt}/${MAX_RETRIES} for ${dir}...`);
        await sleep(RETRY_DELAY);
      } else {
        console.warn(`⚠ Could not clean ${dir}: ${err.message}`);
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
