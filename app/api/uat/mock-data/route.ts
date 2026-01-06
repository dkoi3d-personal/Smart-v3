import { NextRequest, NextResponse } from 'next/server';
import { resolveProjectPath } from '@/lib/project-path-resolver';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SchemaField {
  name: string;
  type: string;
  isRequired: boolean;
  isArray: boolean;
}

interface DiscoveredSchema {
  name: string;
  source: 'prisma' | 'typescript' | 'json' | 'preset';
  fields: SchemaField[];
  filePath: string;
}

// Preset User schema for test accounts
const USER_PRESET_SCHEMA: DiscoveredSchema = {
  name: 'User',
  source: 'preset',
  fields: [
    { name: 'id', type: 'string', isRequired: true, isArray: false },
    { name: 'email', type: 'string', isRequired: true, isArray: false },
    { name: 'password', type: 'string', isRequired: true, isArray: false },
    { name: 'name', type: 'string', isRequired: true, isArray: false },
    { name: 'role', type: 'string', isRequired: true, isArray: false },
    { name: 'avatar', type: 'string', isRequired: false, isArray: false },
    { name: 'createdAt', type: 'datetime', isRequired: true, isArray: false },
  ],
  filePath: 'preset',
};

/**
 * Scan for Prisma schema models
 */
async function scanPrismaSchema(projectDir: string): Promise<DiscoveredSchema[]> {
  const schemas: DiscoveredSchema[] = [];
  const prismaPath = path.join(projectDir, 'prisma', 'schema.prisma');

  try {
    const content = await fs.readFile(prismaPath, 'utf-8');

    // Parse model definitions
    const modelRegex = /model\s+(\w+)\s*\{([^}]+)\}/g;
    let match;

    while ((match = modelRegex.exec(content)) !== null) {
      const modelName = match[1];
      const fieldsBlock = match[2];
      const fields: SchemaField[] = [];

      // Parse individual fields
      const fieldLines = fieldsBlock.split('\n').filter(line => line.trim() && !line.trim().startsWith('//') && !line.trim().startsWith('@@'));

      for (const line of fieldLines) {
        const fieldMatch = line.trim().match(/^(\w+)\s+(\w+)(\[\])?\s*(\?)?/);
        if (fieldMatch) {
          fields.push({
            name: fieldMatch[1],
            type: fieldMatch[2],
            isArray: !!fieldMatch[3],
            isRequired: !fieldMatch[4],
          });
        }
      }

      if (fields.length > 0) {
        schemas.push({
          name: modelName,
          source: 'prisma',
          fields,
          filePath: prismaPath,
        });
      }
    }
  } catch {
    // No Prisma schema found
  }

  return schemas;
}

/**
 * Scan for TypeScript interfaces/types in common locations
 */
async function scanTypeScriptSchemas(projectDir: string): Promise<DiscoveredSchema[]> {
  const schemas: DiscoveredSchema[] = [];
  const searchPaths = [
    'types',
    'src/types',
    'lib/types',
    'models',
    'src/models',
    'interfaces',
  ];

  for (const searchPath of searchPaths) {
    const fullPath = path.join(projectDir, searchPath);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isDirectory()) {
        const files = await fs.readdir(fullPath);
        for (const file of files) {
          if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const filePath = path.join(fullPath, file);
            const content = await fs.readFile(filePath, 'utf-8');

            // Parse interface definitions
            const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*\{([^}]+)\}/g;
            let match;

            while ((match = interfaceRegex.exec(content)) !== null) {
              const interfaceName = match[1];
              const fieldsBlock = match[2];
              const fields: SchemaField[] = [];

              // Parse fields
              const fieldLines = fieldsBlock.split('\n').filter(line => line.trim() && !line.trim().startsWith('//'));

              for (const line of fieldLines) {
                const fieldMatch = line.trim().match(/^(\w+)(\?)?:\s*(\w+)(\[\])?/);
                if (fieldMatch) {
                  fields.push({
                    name: fieldMatch[1],
                    type: fieldMatch[3],
                    isRequired: !fieldMatch[2],
                    isArray: !!fieldMatch[4],
                  });
                }
              }

              if (fields.length > 0) {
                schemas.push({
                  name: interfaceName,
                  source: 'typescript',
                  fields,
                  filePath,
                });
              }
            }
          }
        }
      }
    } catch {
      // Path doesn't exist
    }
  }

  return schemas;
}

/**
 * Generate mock data based on field type
 */
function generateMockValue(field: SchemaField, index: number): any {
  const type = field.type.toLowerCase();

  // Common field name patterns
  const name = field.name.toLowerCase();

  if (name.includes('email')) {
    return `user${index}@example.com`;
  }
  if (name.includes('name') && name.includes('first')) {
    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank'];
    return firstNames[index % firstNames.length];
  }
  if (name.includes('name') && name.includes('last')) {
    const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller'];
    return lastNames[index % lastNames.length];
  }
  if (name.includes('name') || name.includes('title')) {
    return `${field.name} ${index + 1}`;
  }
  if (name.includes('phone')) {
    return `555-${String(1000 + index).slice(-4)}-${String(1000 + index * 7).slice(-4)}`;
  }
  if (name.includes('address')) {
    return `${100 + index} Main Street`;
  }
  if (name.includes('city')) {
    const cities = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix'];
    return cities[index % cities.length];
  }
  if (name.includes('country')) {
    return 'United States';
  }
  if (name.includes('zip') || name.includes('postal')) {
    return String(10000 + index);
  }
  if (name.includes('url') || name.includes('link') || name.includes('website')) {
    return `https://example.com/${field.name.toLowerCase()}/${index}`;
  }
  if (name.includes('image') || name.includes('avatar') || name.includes('photo')) {
    return `https://picsum.photos/seed/${index}/200/200`;
  }
  if (name.includes('description') || name.includes('bio') || name.includes('about')) {
    return `This is a sample ${field.name.toLowerCase()} for testing purposes. Item number ${index + 1}.`;
  }
  if (name.includes('price') || name.includes('amount') || name.includes('cost')) {
    return parseFloat((Math.random() * 100 + 10).toFixed(2));
  }
  if (name.includes('quantity') || name.includes('count') || name.includes('stock')) {
    return Math.floor(Math.random() * 100) + 1;
  }
  if (name.includes('date') || name.includes('created') || name.includes('updated')) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    return date.toISOString();
  }
  if (name.includes('status')) {
    const statuses = ['active', 'pending', 'completed', 'cancelled'];
    return statuses[index % statuses.length];
  }
  if (name.includes('role')) {
    const roles = ['admin', 'user', 'guest', 'moderator'];
    return roles[index % roles.length];
  }
  if (name.includes('password')) {
    return 'hashedPassword123';
  }
  if (name === 'id') {
    return `id-${index + 1}`;
  }

  // Type-based fallbacks
  switch (type) {
    case 'string':
      return `${field.name}_${index + 1}`;
    case 'int':
    case 'integer':
    case 'number':
      return index + 1;
    case 'float':
    case 'decimal':
      return parseFloat((Math.random() * 100).toFixed(2));
    case 'boolean':
    case 'bool':
      return index % 2 === 0;
    case 'datetime':
    case 'date':
      return new Date().toISOString();
    case 'json':
      return { key: `value_${index}` };
    default:
      return `${field.name}_${index + 1}`;
  }
}

/**
 * Generate mock data for a schema
 */
function generateMockData(schema: DiscoveredSchema, count: number): any[] {
  const data: any[] = [];

  for (let i = 0; i < count; i++) {
    const item: Record<string, any> = {};

    for (const field of schema.fields) {
      // Skip relation fields (those with uppercase types that aren't primitives)
      if (/^[A-Z]/.test(field.type) && !['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json'].includes(field.type)) {
        continue;
      }

      if (field.isArray) {
        item[field.name] = [generateMockValue(field, i), generateMockValue(field, i + 1)];
      } else {
        item[field.name] = generateMockValue(field, i);
      }
    }

    data.push(item);
  }

  return data;
}

// GET: Discover schemas in the project
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');
    const includePresets = searchParams.get('includePresets') !== 'false';

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Scan for schemas
    const prismaSchemas = await scanPrismaSchema(projectDir);
    const tsSchemas = await scanTypeScriptSchemas(projectDir);

    // Check if User schema already exists
    const hasUserSchema = [...prismaSchemas, ...tsSchemas].some(
      s => s.name.toLowerCase() === 'user' || s.name.toLowerCase() === 'account'
    );

    // Include preset schemas if requested and not already present
    const presetSchemas: DiscoveredSchema[] = [];
    if (includePresets && !hasUserSchema) {
      presetSchemas.push(USER_PRESET_SCHEMA);
    }

    const allSchemas = [...presetSchemas, ...prismaSchemas, ...tsSchemas];

    return NextResponse.json({
      success: true,
      schemas: allSchemas,
      summary: {
        preset: presetSchemas.length,
        prisma: prismaSchemas.length,
        typescript: tsSchemas.length,
        total: allSchemas.length,
      },
      hasUserSchema,
    });
  } catch (error) {
    console.error('Schema discovery error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover schemas' },
      { status: 500 }
    );
  }
}

// Generate preset user data for test accounts
function generatePresetUserData(): any[] {
  const presetUsers = [
    {
      id: 'user-admin-001',
      email: 'admin@test.com',
      password: 'Admin123!',
      name: 'Test Admin',
      role: 'admin',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-user-002',
      email: 'user@test.com',
      password: 'User123!',
      name: 'Test User',
      role: 'user',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-guest-003',
      email: 'guest@test.com',
      password: 'Guest123!',
      name: 'Test Guest',
      role: 'guest',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-manager-004',
      email: 'manager@test.com',
      password: 'Manager123!',
      name: 'Test Manager',
      role: 'manager',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=manager',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'user-support-005',
      email: 'support@test.com',
      password: 'Support123!',
      name: 'Test Support',
      role: 'support',
      avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=support',
      createdAt: new Date().toISOString(),
    },
  ];
  return presetUsers;
}

// POST: Generate and seed mock data
export async function POST(request: NextRequest) {
  try {
    const { projectId, schemas, counts } = await request.json();

    if (!projectId || !schemas) {
      return NextResponse.json({ error: 'Project ID and schemas required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);

    // Create mock-data directory
    const mockDataDir = path.join(projectDir, 'mock-data');
    await fs.mkdir(mockDataDir, { recursive: true });

    const generatedData: Record<string, any[]> = {};

    for (const schema of schemas) {
      let data: any[];

      // Handle preset User schema specially
      if (schema.source === 'preset' && schema.name === 'User') {
        data = generatePresetUserData();
      } else {
        const count = counts?.[schema.name] || 10;
        data = generateMockData(schema, count);
      }

      generatedData[schema.name] = data;

      // Write to JSON file
      const filePath = path.join(mockDataDir, `${schema.name.toLowerCase()}.json`);
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    }

    // Create an index file
    const indexContent = `// Auto-generated mock data index
// Generated at: ${new Date().toISOString()}

${Object.keys(generatedData).map(name =>
  `export { default as ${name.toLowerCase()}Data } from './${name.toLowerCase()}.json';`
).join('\n')}

export const mockDataSummary = ${JSON.stringify(
  Object.entries(generatedData).reduce((acc, [name, data]) => {
    acc[name] = data.length;
    return acc;
  }, {} as Record<string, number>),
  null,
  2
)};
`;

    await fs.writeFile(path.join(mockDataDir, 'index.ts'), indexContent);

    // Return generated data with previews
    const preview: Record<string, any[]> = {};
    const files: Record<string, string> = {};

    for (const [name, data] of Object.entries(generatedData)) {
      // Include first 3 items as preview
      preview[name] = data.slice(0, 3);
      files[name] = path.join(mockDataDir, `${name.toLowerCase()}.json`);
    }

    return NextResponse.json({
      success: true,
      message: `Generated mock data for ${Object.keys(generatedData).length} schemas`,
      dataDir: mockDataDir,
      files,
      preview,
      summary: Object.entries(generatedData).reduce((acc, [name, data]) => {
        acc[name] = data.length;
        return acc;
      }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('Mock data generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate mock data' },
      { status: 500 }
    );
  }
}

// DELETE: Clear mock data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('projectId');

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
    }

    const projectDir = await resolveProjectPath(projectId);
    const mockDataDir = path.join(projectDir, 'mock-data');

    await fs.rm(mockDataDir, { recursive: true, force: true });

    return NextResponse.json({
      success: true,
      message: 'Mock data cleared',
    });
  } catch (error) {
    console.error('Mock data clear error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to clear mock data' },
      { status: 500 }
    );
  }
}
