import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile, stat } from 'fs/promises';
import path from 'path';

interface ContextSummary {
  framework?: string;
  styling?: string;
  database?: string;
  testing?: string;
  totalFiles: number;
  totalDependencies: number;
  patterns: string[];
}

async function countFiles(dir: string): Promise<number> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        count += await countFiles(fullPath);
      } else if (entry.isFile()) {
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}

async function analyzePackageJson(projectDir: string): Promise<Partial<ContextSummary>> {
  try {
    const pkgPath = path.join(projectDir, 'package.json');
    const content = await readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(content);

    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    const patterns: string[] = [];

    // Detect framework
    let framework = 'Unknown';
    if (deps['next']) {
      framework = `Next.js ${deps['next'].replace('^', '')}`;
      patterns.push('Next.js App Router');
    } else if (deps['react']) {
      framework = `React ${deps['react'].replace('^', '')}`;
    } else if (deps['vue']) {
      framework = `Vue ${deps['vue'].replace('^', '')}`;
    }

    // Detect styling
    let styling = undefined;
    if (deps['tailwindcss']) {
      styling = 'Tailwind CSS';
      patterns.push('Utility-first CSS');
    } else if (deps['styled-components']) {
      styling = 'Styled Components';
    } else if (deps['@emotion/react']) {
      styling = 'Emotion';
    }

    // Detect database
    let database = undefined;
    if (deps['prisma'] || deps['@prisma/client']) {
      database = 'Prisma ORM';
      patterns.push('ORM-based data access');
    } else if (deps['mongoose']) {
      database = 'MongoDB (Mongoose)';
    } else if (deps['typeorm']) {
      database = 'TypeORM';
    } else if (deps['drizzle-orm']) {
      database = 'Drizzle ORM';
    }

    // Detect testing
    let testing = undefined;
    if (deps['vitest']) {
      testing = 'Vitest';
      patterns.push('Modern testing');
    } else if (deps['jest']) {
      testing = 'Jest';
    }
    if (deps['@testing-library/react']) {
      testing = testing ? `${testing} + RTL` : 'React Testing Library';
    }

    // Count dependencies
    const totalDependencies = Object.keys(deps).length;

    return {
      framework,
      styling,
      database,
      testing,
      totalDependencies,
      patterns,
    };
  } catch {
    return { totalDependencies: 0, patterns: [] };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { projectDir, step } = await request.json();

    if (!projectDir) {
      return NextResponse.json(
        { error: 'projectDir is required' },
        { status: 400 }
      );
    }

    let context: Partial<ContextSummary> = {};

    switch (step) {
      case 'structure':
        const totalFiles = await countFiles(projectDir);
        context = { totalFiles };
        break;

      case 'dependencies':
        context = await analyzePackageJson(projectDir);
        break;

      case 'architecture':
        // Re-analyze for framework patterns
        const pkgContext = await analyzePackageJson(projectDir);
        context = {
          framework: pkgContext.framework,
          patterns: pkgContext.patterns || [],
        };
        break;

      case 'services':
        // Check for common service patterns
        const patterns: string[] = [];
        try {
          await stat(path.join(projectDir, 'src', 'services'));
          patterns.push('Service layer');
        } catch {}
        try {
          await stat(path.join(projectDir, 'lib'));
          patterns.push('Shared library');
        } catch {}
        try {
          await stat(path.join(projectDir, 'app', 'api'));
          patterns.push('API routes');
        } catch {}
        context = { patterns };
        break;

      case 'tests':
        const testContext = await analyzePackageJson(projectDir);
        context = { testing: testContext.testing };
        break;

      case 'design':
        // Check for design system files
        const designPatterns: string[] = [];
        try {
          await stat(path.join(projectDir, 'components', 'ui'));
          designPatterns.push('shadcn/ui');
        } catch {}
        try {
          await stat(path.join(projectDir, 'tailwind.config.js'));
          designPatterns.push('Custom theme');
        } catch {}
        try {
          await stat(path.join(projectDir, 'tailwind.config.ts'));
          designPatterns.push('Custom theme');
        } catch {}
        context = { patterns: designPatterns };
        break;

      default:
        // Full scan
        const fullContext = await analyzePackageJson(projectDir);
        const files = await countFiles(projectDir);
        context = { ...fullContext, totalFiles: files };
    }

    return NextResponse.json({ context });
  } catch (error) {
    console.error('Context scan error:', error);
    return NextResponse.json(
      { error: 'Failed to scan context' },
      { status: 500 }
    );
  }
}
