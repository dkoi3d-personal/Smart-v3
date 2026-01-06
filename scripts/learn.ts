#!/usr/bin/env npx ts-node
/**
 * Learning CLI
 *
 * Quick command-line interface for recording and searching learnings.
 *
 * Usage:
 *   npx ts-node scripts/learn.ts add "Prisma 7 hates URLs" --category database --severity warning
 *   npx ts-node scripts/learn.ts search "prisma"
 *   npx ts-node scripts/learn.ts list
 *   npx ts-node scripts/learn.ts stats
 */

import path from 'path';

// Adjust path for script location
const storePath = path.join(__dirname, '..', 'services', 'memory', 'learning-store');
const { LearningStore, LearningType, Severity } = require(storePath);

// ============================================================================
// CLI Parser
// ============================================================================

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

function parseArgs(args: string[]): ParsedArgs {
  const result: ParsedArgs = {
    command: args[0] || 'help',
    positional: [],
    flags: {},
  };

  let i = 1;
  while (i < args.length) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        result.flags[key] = next;
        i += 2;
      } else {
        result.flags[key] = true;
        i += 1;
      }
    } else {
      result.positional.push(arg);
      i += 1;
    }
  }

  return result;
}

// ============================================================================
// Commands
// ============================================================================

const store = new LearningStore();

function cmdAdd(args: ParsedArgs): void {
  const title = args.positional[0];
  if (!title) {
    console.error('Error: Title is required');
    console.log('Usage: learn add "Title" --category <cat> --severity <sev> [--solution "..."]');
    process.exit(1);
  }

  const learning = {
    type: (args.flags.type as string) || 'gotcha',
    category: (args.flags.category as string) || 'general',
    title,
    description: (args.flags.description as string) || title,
    solution: args.flags.solution as string | undefined,
    severity: (args.flags.severity as string) || 'warning',
    library: args.flags.library as string | undefined,
    libraryVersion: args.flags.version as string | undefined,
    tags: args.flags.tags ? (args.flags.tags as string).split(',') : [],
    projectName: args.flags.project as string | undefined,
  };

  const id = store.add(learning);
  console.log(`✅ Learning recorded (ID: ${id})`);
  console.log(`   Title: ${title}`);
  console.log(`   Category: ${learning.category}`);
  console.log(`   Severity: ${learning.severity}`);
  if (learning.solution) {
    console.log(`   Solution: ${learning.solution}`);
  }
}

function cmdSearch(args: ParsedArgs): void {
  const query = args.positional.join(' ');
  if (!query) {
    console.error('Error: Search query is required');
    process.exit(1);
  }

  const limit = parseInt(args.flags.limit as string) || 10;
  const results = store.search(query, limit);

  if (results.length === 0) {
    console.log('No learnings found.');
    return;
  }

  console.log(`Found ${results.length} learning(s):\n`);
  for (const l of results) {
    printLearning(l);
  }
}

function cmdList(args: ParsedArgs): void {
  const category = args.flags.category as string;
  const library = args.flags.library as string;
  const limit = parseInt(args.flags.limit as string) || 20;

  let results;
  if (category) {
    results = store.getByCategory(category, limit);
    console.log(`Learnings in category "${category}":\n`);
  } else if (library) {
    results = store.getByLibrary(library, limit);
    console.log(`Learnings for library "${library}":\n`);
  } else {
    results = store.getRecent(limit);
    console.log(`Recent learnings:\n`);
  }

  if (results.length === 0) {
    console.log('No learnings found.');
    return;
  }

  for (const l of results) {
    printLearning(l);
  }
}

function cmdGet(args: ParsedArgs): void {
  const id = parseInt(args.positional[0]);
  if (isNaN(id)) {
    console.error('Error: Valid ID is required');
    process.exit(1);
  }

  const learning = store.get(id);
  if (!learning) {
    console.error(`Learning with ID ${id} not found`);
    process.exit(1);
  }

  printLearning(learning, true);
}

function cmdDelete(args: ParsedArgs): void {
  const id = parseInt(args.positional[0]);
  if (isNaN(id)) {
    console.error('Error: Valid ID is required');
    process.exit(1);
  }

  const success = store.delete(id);
  if (success) {
    console.log(`✅ Learning ${id} deleted`);
  } else {
    console.error(`Learning with ID ${id} not found`);
    process.exit(1);
  }
}

function cmdStats(): void {
  const stats = store.getStats();

  console.log('📊 Learning Statistics\n');
  console.log(`Total learnings: ${stats.total}\n`);

  console.log('By Category:');
  for (const [cat, count] of Object.entries(stats.byCategory)) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log('\nBy Severity:');
  for (const [sev, count] of Object.entries(stats.bySeverity)) {
    const icon = sev === 'critical' ? '🚨' : sev === 'warning' ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} ${sev}: ${count}`);
  }

  console.log('\nBy Type:');
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`  ${type}: ${count}`);
  }

  if (stats.topHelpful.length > 0) {
    console.log('\nMost Helpful:');
    for (const l of stats.topHelpful.slice(0, 5)) {
      console.log(`  [${l.id}] ${l.title} (👍 ${l.helpfulCount})`);
    }
  }
}

function cmdCritical(): void {
  const results = store.getCritical();

  if (results.length === 0) {
    console.log('No critical learnings.');
    return;
  }

  console.log(`🚨 Critical Learnings (${results.length}):\n`);
  for (const l of results) {
    printLearning(l);
  }
}

function cmdHelp(): void {
  console.log(`
Learning CLI - Record and search cross-project learnings

Commands:
  add <title>       Record a new learning
      --category    Category (database, api, react, etc.)
      --severity    Severity (info, warning, critical)
      --type        Type (gotcha, pattern, anti-pattern, library-issue, etc.)
      --solution    Solution or workaround
      --library     Related library name
      --version     Library version
      --tags        Comma-separated tags
      --project     Project name

  search <query>    Search learnings
      --limit       Max results (default: 10)

  list              List learnings
      --category    Filter by category
      --library     Filter by library
      --limit       Max results (default: 20)

  get <id>          Get a specific learning by ID

  delete <id>       Delete a learning

  stats             Show statistics

  critical          Show all critical learnings

  help              Show this help

Examples:
  npx ts-node scripts/learn.ts add "Prisma 7 URL validation is strict" --category database --library prisma --severity warning --solution "Use String type instead of Url"

  npx ts-node scripts/learn.ts search "prisma url"

  npx ts-node scripts/learn.ts list --library prisma

  npx ts-node scripts/learn.ts stats
`);
}

// ============================================================================
// Helpers
// ============================================================================

function printLearning(l: any, detailed = false): void {
  const severityIcon = l.severity === 'critical' ? '🚨' : l.severity === 'warning' ? '⚠️' : 'ℹ️';

  console.log(`${severityIcon} [${l.id}] ${l.title}`);

  if (detailed) {
    console.log(`   Type: ${l.type}`);
    console.log(`   Category: ${l.category}`);
    console.log(`   Severity: ${l.severity}`);
    if (l.library) console.log(`   Library: ${l.library}${l.libraryVersion ? ` v${l.libraryVersion}` : ''}`);
    console.log(`   Description: ${l.description}`);
    if (l.solution) console.log(`   Solution: ${l.solution}`);
    if (l.tags?.length) console.log(`   Tags: ${l.tags.join(', ')}`);
    if (l.projectName) console.log(`   Project: ${l.projectName}`);
    console.log(`   Created: ${l.createdAt}`);
    console.log(`   Feedback: 👍 ${l.helpfulCount || 0} / 👎 ${l.notHelpfulCount || 0}`);
  } else {
    console.log(`   ${l.description.slice(0, 100)}${l.description.length > 100 ? '...' : ''}`);
    if (l.solution) console.log(`   → ${l.solution.slice(0, 80)}${l.solution.length > 80 ? '...' : ''}`);
  }
  console.log('');
}

// ============================================================================
// Main
// ============================================================================

const args = parseArgs(process.argv.slice(2));

switch (args.command) {
  case 'add':
    cmdAdd(args);
    break;
  case 'search':
    cmdSearch(args);
    break;
  case 'list':
    cmdList(args);
    break;
  case 'get':
    cmdGet(args);
    break;
  case 'delete':
    cmdDelete(args);
    break;
  case 'stats':
    cmdStats();
    break;
  case 'critical':
    cmdCritical();
    break;
  case 'help':
  default:
    cmdHelp();
    break;
}

store.close();
