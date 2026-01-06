import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const { searchParams } = new URL(request.url);
    const projectDir = searchParams.get('directory');

    if (!projectDir) {
      return NextResponse.json({ error: 'Project directory required' }, { status: 400 });
    }

    const analysis = {
      hasPrisma: false,
      prismaProvider: null as string | null,
      hasSqlite: false,
      hasPostgresUrl: false,
      databaseUrl: null as string | null,
      databaseReady: true,
      needsProvisioning: false,
      models: [] as string[],
    };

    // Check for Prisma schema
    const prismaSchemaPath = path.join(projectDir, 'prisma', 'schema.prisma');
    try {
      const schemaContent = await fs.readFile(prismaSchemaPath, 'utf-8');
      analysis.hasPrisma = true;

      // Extract provider
      const providerMatch = schemaContent.match(/provider\s*=\s*["'](\w+)["']/);
      if (providerMatch) {
        analysis.prismaProvider = providerMatch[1];
      }

      // Check if schema uses SQLite
      if (schemaContent.includes('provider = "sqlite"') || schemaContent.includes("provider = 'sqlite'")) {
        analysis.hasSqlite = true;
      }

      // Extract model names
      const modelMatches = schemaContent.matchAll(/model\s+(\w+)\s*\{/g);
      analysis.models = Array.from(modelMatches).map(m => m[1]);
    } catch {
      // No Prisma schema
    }

    // Check .env files for DATABASE_URL
    const envFiles = ['.env', '.env.local', '.env.production', '.env.production.local'];
    for (const envFile of envFiles) {
      try {
        const envPath = path.join(projectDir, envFile);
        const content = await fs.readFile(envPath, 'utf-8');

        const dbUrlMatch = content.match(/DATABASE_URL\s*=\s*["']?([^"'\n]+)["']?/);
        if (dbUrlMatch) {
          analysis.databaseUrl = dbUrlMatch[1];

          // Check if it's SQLite
          if (dbUrlMatch[1].includes('file:') || dbUrlMatch[1].includes('.db')) {
            analysis.hasSqlite = true;
          }

          // Check if it's PostgreSQL
          if (dbUrlMatch[1].includes('postgres') || dbUrlMatch[1].includes('postgresql')) {
            analysis.hasPostgresUrl = true;
          }
        }
      } catch {
        // File doesn't exist
      }
    }

    // Determine if database is ready for deployment
    if (analysis.hasPrisma) {
      if (analysis.hasSqlite && !analysis.hasPostgresUrl) {
        analysis.databaseReady = false;
        analysis.needsProvisioning = true;
      } else if (!analysis.databaseUrl) {
        analysis.databaseReady = false;
        analysis.needsProvisioning = true;
      }
    }

    return NextResponse.json(analysis);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to analyze project' },
      { status: 500 }
    );
  }
}
