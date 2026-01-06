import { NextRequest, NextResponse } from 'next/server';
import { resolveProjectPath } from '@/lib/project-path-resolver';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SeedResult {
  success: boolean;
  method: 'prisma' | 'script' | 'direct';
  tablesSeeded: string[];
  recordCount: number;
  error?: string;
}

/**
 * Check if the project uses Prisma
 */
async function checkPrismaSetup(projectDir: string): Promise<{ hasPrisma: boolean; hasClient: boolean; hasSeed: boolean }> {
  const schemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
  const clientPath = path.join(projectDir, 'node_modules', '@prisma', 'client');
  const seedPath = path.join(projectDir, 'prisma', 'seed.ts');
  const seedJsPath = path.join(projectDir, 'prisma', 'seed.js');

  const [hasPrisma, hasClient, hasSeedTs, hasSeedJs] = await Promise.all([
    fs.access(schemaPath).then(() => true).catch(() => false),
    fs.access(clientPath).then(() => true).catch(() => false),
    fs.access(seedPath).then(() => true).catch(() => false),
    fs.access(seedJsPath).then(() => true).catch(() => false),
  ]);

  return {
    hasPrisma,
    hasClient,
    hasSeed: hasSeedTs || hasSeedJs,
  };
}

/**
 * Generate a Prisma seed script from mock data
 */
async function generatePrismaSeedScript(projectDir: string, mockDataDir: string): Promise<string> {
  const files = await fs.readdir(mockDataDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'index.ts');

  let imports = `import { PrismaClient } from '@prisma/client';\n\n`;
  let seedCode = `const prisma = new PrismaClient();\n\nasync function main() {\n`;

  for (const file of jsonFiles) {
    const modelName = file.replace('.json', '');
    const capitalizedName = modelName.charAt(0).toUpperCase() + modelName.slice(1);
    const filePath = path.join(mockDataDir, file);

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data) && data.length > 0) {
        // Check if the model might exist (we'll try it)
        seedCode += `  // Seed ${capitalizedName}\n`;
        seedCode += `  try {\n`;
        seedCode += `    await prisma.${modelName}.deleteMany();\n`;
        seedCode += `    await prisma.${modelName}.createMany({\n`;
        seedCode += `      data: ${JSON.stringify(data, null, 6).replace(/\n/g, '\n      ')},\n`;
        seedCode += `    });\n`;
        seedCode += `    console.log('Seeded ${capitalizedName}: ${data.length} records');\n`;
        seedCode += `  } catch (e) {\n`;
        seedCode += `    console.log('Skipping ${capitalizedName}: Model may not exist or data incompatible');\n`;
        seedCode += `  }\n\n`;
      }
    } catch {
      // Skip invalid files
    }
  }

  seedCode += `}\n\n`;
  seedCode += `main()\n`;
  seedCode += `  .then(async () => {\n`;
  seedCode += `    await prisma.$disconnect();\n`;
  seedCode += `  })\n`;
  seedCode += `  .catch(async (e) => {\n`;
  seedCode += `    console.error(e);\n`;
  seedCode += `    await prisma.$disconnect();\n`;
  seedCode += `    process.exit(1);\n`;
  seedCode += `  });\n`;

  return imports + seedCode;
}

/**
 * Run Prisma db seed
 */
async function runPrismaSeed(projectDir: string): Promise<{ success: boolean; output: string }> {
  try {
    const { stdout, stderr } = await execAsync('npx prisma db seed', {
      cwd: projectDir,
      timeout: 60000,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    return { success: true, output: stdout + stderr };
  } catch (error: any) {
    return {
      success: false,
      output: error.message + (error.stdout || '') + (error.stderr || '')
    };
  }
}

/**
 * Run the generated seed script directly with ts-node or tsx
 */
async function runSeedScript(projectDir: string, scriptPath: string): Promise<{ success: boolean; output: string }> {
  try {
    // Try tsx first, then ts-node
    const runners = ['npx tsx', 'npx ts-node'];

    for (const runner of runners) {
      try {
        const { stdout, stderr } = await execAsync(`${runner} "${scriptPath}"`, {
          cwd: projectDir,
          timeout: 60000,
          env: { ...process.env, NODE_ENV: 'development' },
        });
        return { success: true, output: stdout + stderr };
      } catch {
        continue;
      }
    }

    // Fallback: try direct node if it's a .js file
    const { stdout, stderr } = await execAsync(`node "${scriptPath}"`, {
      cwd: projectDir,
      timeout: 60000,
    });
    return { success: true, output: stdout + stderr };
  } catch (error: any) {
    return {
      success: false,
      output: error.message + (error.stdout || '') + (error.stderr || '')
    };
  }
}

// POST: Seed the database with mock data
export async function POST(request: NextRequest) {
  try {
    const { projectId, clearExisting = true } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Check for mock data
    const mockDataDir = path.join(projectDir, 'mock-data');
    try {
      await fs.access(mockDataDir);
    } catch {
      return NextResponse.json({
        error: 'No mock data found. Generate mock data first.',
        needsMockData: true,
      }, { status: 400 });
    }

    // Check Prisma setup
    const prismaSetup = await checkPrismaSetup(projectDir);

    if (!prismaSetup.hasPrisma) {
      return NextResponse.json({
        error: 'This project does not use Prisma. Database seeding requires Prisma.',
        suggestion: 'Add Prisma to your project or use the mock data JSON files directly.',
      }, { status: 400 });
    }

    // Ensure Prisma client is generated
    if (!prismaSetup.hasClient) {
      try {
        await execAsync('npx prisma generate', {
          cwd: projectDir,
          timeout: 60000,
        });
      } catch (error) {
        return NextResponse.json({
          error: 'Failed to generate Prisma client. Run `npx prisma generate` manually.',
        }, { status: 500 });
      }
    }

    // Generate seed script from mock data
    const seedScript = await generatePrismaSeedScript(projectDir, mockDataDir);
    const seedScriptPath = path.join(mockDataDir, 'seed-database.ts');
    await fs.writeFile(seedScriptPath, seedScript);

    // Try to run the seed
    let result: { success: boolean; output: string };

    // If project has its own seed script, add our generated one and use prisma seed
    if (prismaSetup.hasSeed) {
      // Update package.json to include our seed
      const pkgPath = path.join(projectDir, 'package.json');
      try {
        const pkgContent = await fs.readFile(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgContent);

        if (!pkg.prisma) pkg.prisma = {};
        pkg.prisma.seed = `tsx ${seedScriptPath.replace(/\\/g, '/')}`;

        await fs.writeFile(pkgPath, JSON.stringify(pkg, null, 2));
      } catch {
        // If we can't update package.json, run directly
      }
    }

    // Run the seed script directly
    result = await runSeedScript(projectDir, seedScriptPath);

    if (result.success) {
      // Count seeded records from output
      const seededMatches = result.output.match(/Seeded (\w+): (\d+) records/g) || [];
      const tablesSeeded: string[] = [];
      let totalRecords = 0;

      seededMatches.forEach(match => {
        const parts = match.match(/Seeded (\w+): (\d+) records/);
        if (parts) {
          tablesSeeded.push(parts[1]);
          totalRecords += parseInt(parts[2]);
        }
      });

      return NextResponse.json({
        success: true,
        message: `Database seeded successfully`,
        tablesSeeded,
        totalRecords,
        output: result.output,
        seedScriptPath,
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Seed failed',
        details: result.output,
        seedScriptPath,
        suggestion: 'Check that your database is running and Prisma schema is migrated.',
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Database seed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to seed database' },
      { status: 500 }
    );
  }
}

// GET: Check seed status and prerequisites
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Check mock data
    const mockDataDir = path.join(projectDir, 'mock-data');
    let hasMockData = false;
    let mockDataFiles: string[] = [];

    try {
      const files = await fs.readdir(mockDataDir);
      mockDataFiles = files.filter(f => f.endsWith('.json'));
      hasMockData = mockDataFiles.length > 0;
    } catch {
      // No mock data
    }

    // Check Prisma setup
    const prismaSetup = await checkPrismaSetup(projectDir);

    // Check database connection (try to run prisma db pull --dry-run)
    let canConnect = false;
    if (prismaSetup.hasPrisma) {
      try {
        await execAsync('npx prisma db execute --stdin < /dev/null', {
          cwd: projectDir,
          timeout: 10000,
        });
        canConnect = true;
      } catch {
        // Can't connect or command not available
      }
    }

    return NextResponse.json({
      success: true,
      status: {
        hasMockData,
        mockDataFiles,
        hasPrisma: prismaSetup.hasPrisma,
        hasPrismaClient: prismaSetup.hasClient,
        hasExistingSeed: prismaSetup.hasSeed,
        canSeed: hasMockData && prismaSetup.hasPrisma,
      },
      message: !hasMockData
        ? 'Generate mock data first'
        : !prismaSetup.hasPrisma
          ? 'Project does not use Prisma'
          : 'Ready to seed database',
    });
  } catch (error) {
    console.error('Seed status check error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check seed status' },
      { status: 500 }
    );
  }
}
