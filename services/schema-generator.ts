/**
 * Schema Generator Service
 *
 * Uses Claude to analyze project requirements and generate
 * appropriate database schema with tables, columns, and relationships.
 */

import { claudeSubscriptionService } from './claude-subscription-service';
import type { DatabaseSchema, TableDefinition, ColumnDefinition } from './database-provisioning';

export interface SchemaGenerationOptions {
  requirements: string;
  projectType?: 'web' | 'api' | 'fullstack';
  features?: string[];
  existingSchema?: DatabaseSchema;
}

/**
 * Generate database schema from requirements using Claude
 */
export async function generateSchemaFromRequirements(
  options: SchemaGenerationOptions
): Promise<DatabaseSchema> {
  const { requirements, projectType = 'fullstack', features = [] } = options;

  const prompt = buildSchemaPrompt(requirements, projectType, features);

  let schemaJson = '';

  // Use Claude to generate the schema
  for await (const message of claudeSubscriptionService.runAgent(prompt, {
    model: 'sonnet',
    maxTurns: 3,
    permissionMode: 'bypassPermissions',
  })) {
    if (message.type === 'text' || message.type === 'complete') {
      schemaJson += message.content;
    }
  }

  // Parse the JSON from Claude's response
  const schema = parseSchemaFromResponse(schemaJson);

  return schema;
}

/**
 * Build the prompt for schema generation
 */
function buildSchemaPrompt(requirements: string, projectType: string, features: string[]): string {
  return `You are a database architect. Analyze the following project requirements and generate a database schema.

PROJECT REQUIREMENTS:
${requirements}

PROJECT TYPE: ${projectType}

${features.length > 0 ? `FEATURES: ${features.join(', ')}` : ''}

Generate a JSON database schema with the following structure:
{
  "tables": [
    {
      "name": "table_name_in_snake_case",
      "columns": [
        {
          "name": "column_name",
          "type": "id|uuid|string|text|int|bigint|float|decimal|boolean|datetime|timestamp|json",
          "primaryKey": true/false,
          "unique": true/false,
          "nullable": true/false,
          "default": "autoincrement()|now()|uuid()|other_default",
          "references": { "table": "other_table", "column": "id" } // for foreign keys
        }
      ],
      "indexes": ["column1", "column2"] // columns to index
    }
  ]
}

RULES:
1. Always include an 'id' column as primary key (type: "id" with default: "autoincrement()")
2. Include createdAt and updatedAt timestamps
3. Use snake_case for table and column names
4. Create proper foreign key relationships with references
5. Add indexes for columns commonly queried
6. Include a "users" table if authentication is implied
7. Keep it practical - don't over-engineer

Common patterns to include if relevant:
- Users table: id, email (unique), name, password_hash, created_at, updated_at
- For e-commerce: products, orders, order_items, categories
- For social: posts, comments, likes, followers
- For SaaS: organizations, memberships, subscriptions

RESPOND WITH ONLY THE JSON, NO EXPLANATION.`;
}

/**
 * Parse schema JSON from Claude's response
 */
function parseSchemaFromResponse(response: string): DatabaseSchema {
  // Try to extract JSON from the response
  let jsonStr = response;

  // Look for JSON block in markdown
  const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }

  // Try to find JSON object directly
  const objectMatch = response.match(/\{[\s\S]*"tables"[\s\S]*\}/);
  if (objectMatch) {
    jsonStr = objectMatch[0];
  }

  try {
    const parsed = JSON.parse(jsonStr.trim());

    // Validate and normalize the schema
    const schema: DatabaseSchema = {
      tables: [],
    };

    if (Array.isArray(parsed.tables)) {
      for (const table of parsed.tables) {
        const normalizedTable: TableDefinition = {
          name: String(table.name || 'unnamed_table'),
          columns: [],
          indexes: table.indexes || [],
        };

        if (Array.isArray(table.columns)) {
          for (const col of table.columns) {
            normalizedTable.columns.push({
              name: String(col.name || 'unnamed_column'),
              type: String(col.type || 'string'),
              primaryKey: Boolean(col.primaryKey),
              unique: Boolean(col.unique),
              nullable: col.nullable !== false, // default to nullable
              default: col.default,
              references: col.references,
            });
          }
        }

        schema.tables.push(normalizedTable);
      }
    }

    return schema;
  } catch (error) {
    console.error('Failed to parse schema JSON:', error);
    console.error('Response was:', response.substring(0, 500));

    // Return a basic schema as fallback
    return getDefaultSchema();
  }
}

/**
 * Get a default schema for basic apps
 */
function getDefaultSchema(): DatabaseSchema {
  return {
    tables: [
      {
        name: 'users',
        columns: [
          { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
          { name: 'email', type: 'string', unique: true, nullable: false },
          { name: 'name', type: 'string', nullable: true },
          { name: 'password_hash', type: 'string', nullable: true },
          { name: 'created_at', type: 'datetime', default: 'now()' },
          { name: 'updated_at', type: 'datetime', default: 'now()' },
        ],
        indexes: ['email'],
      },
    ],
  };
}

/**
 * Analyze requirements to determine if database is needed
 */
export function requiresDatabase(requirements: string): boolean {
  const lowerReq = requirements.toLowerCase();

  const dbIndicators = [
    'user', 'account', 'login', 'signup', 'auth',
    'save', 'store', 'persist', 'database', 'db',
    'create', 'update', 'delete', 'crud',
    'list', 'table', 'record', 'data',
    'profile', 'settings', 'preferences',
    'order', 'cart', 'product', 'inventory',
    'post', 'comment', 'message', 'chat',
    'task', 'todo', 'project', 'item',
    'booking', 'reservation', 'appointment',
    'subscription', 'payment', 'billing',
  ];

  return dbIndicators.some(indicator => lowerReq.includes(indicator));
}

/**
 * Suggest database provider based on requirements
 */
export function suggestDatabaseProvider(requirements: string): 'sqlite' | 'neon' | 'supabase' | 'aws-rds' {
  const lowerReq = requirements.toLowerCase();

  // Supabase for real-time or auth features
  if (lowerReq.includes('real-time') || lowerReq.includes('realtime') ||
      lowerReq.includes('live update') || lowerReq.includes('websocket') ||
      lowerReq.includes('auth') || lowerReq.includes('authentication')) {
    return 'supabase';
  }

  // RDS for enterprise or high-scale
  if (lowerReq.includes('enterprise') || lowerReq.includes('high scale') ||
      lowerReq.includes('production') || lowerReq.includes('compliance')) {
    return 'aws-rds';
  }

  // Neon for general serverless needs
  if (lowerReq.includes('serverless') || lowerReq.includes('scale')) {
    return 'neon';
  }

  // Default to SQLite for local/simple apps
  return 'sqlite';
}

/**
 * Generate common schema templates
 */
export const schemaTemplates = {
  authentication: (): TableDefinition[] => [
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'email', type: 'string', unique: true, nullable: false },
        { name: 'name', type: 'string', nullable: true },
        { name: 'password_hash', type: 'string', nullable: false },
        { name: 'email_verified', type: 'boolean', default: 'false' },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['email'],
    },
    {
      name: 'sessions',
      columns: [
        { name: 'id', type: 'uuid', primaryKey: true, default: 'uuid()' },
        { name: 'user_id', type: 'int', references: { table: 'users', column: 'id' } },
        { name: 'token', type: 'string', unique: true },
        { name: 'expires_at', type: 'datetime' },
        { name: 'created_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['user_id', 'token'],
    },
  ],

  blog: (): TableDefinition[] => [
    ...schemaTemplates.authentication(),
    {
      name: 'posts',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'title', type: 'string', nullable: false },
        { name: 'slug', type: 'string', unique: true, nullable: false },
        { name: 'content', type: 'text' },
        { name: 'published', type: 'boolean', default: 'false' },
        { name: 'author_id', type: 'int', references: { table: 'users', column: 'id' } },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['slug', 'author_id', 'published'],
    },
    {
      name: 'comments',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'content', type: 'text', nullable: false },
        { name: 'post_id', type: 'int', references: { table: 'posts', column: 'id' } },
        { name: 'author_id', type: 'int', references: { table: 'users', column: 'id' } },
        { name: 'created_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['post_id', 'author_id'],
    },
  ],

  ecommerce: (): TableDefinition[] => [
    ...schemaTemplates.authentication(),
    {
      name: 'categories',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'name', type: 'string', nullable: false },
        { name: 'slug', type: 'string', unique: true },
        { name: 'description', type: 'text' },
        { name: 'parent_id', type: 'int', nullable: true, references: { table: 'categories', column: 'id' } },
      ],
      indexes: ['slug', 'parent_id'],
    },
    {
      name: 'products',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'name', type: 'string', nullable: false },
        { name: 'slug', type: 'string', unique: true },
        { name: 'description', type: 'text' },
        { name: 'price', type: 'decimal', nullable: false },
        { name: 'stock', type: 'int', default: '0' },
        { name: 'category_id', type: 'int', references: { table: 'categories', column: 'id' } },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['slug', 'category_id'],
    },
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'user_id', type: 'int', references: { table: 'users', column: 'id' } },
        { name: 'status', type: 'string', default: "'pending'" },
        { name: 'total', type: 'decimal', nullable: false },
        { name: 'shipping_address', type: 'json' },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['user_id', 'status'],
    },
    {
      name: 'order_items',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'order_id', type: 'int', references: { table: 'orders', column: 'id' } },
        { name: 'product_id', type: 'int', references: { table: 'products', column: 'id' } },
        { name: 'quantity', type: 'int', nullable: false },
        { name: 'price', type: 'decimal', nullable: false },
      ],
      indexes: ['order_id', 'product_id'],
    },
  ],

  saas: (): TableDefinition[] => [
    {
      name: 'organizations',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'name', type: 'string', nullable: false },
        { name: 'slug', type: 'string', unique: true },
        { name: 'plan', type: 'string', default: "'free'" },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['slug'],
    },
    {
      name: 'users',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'email', type: 'string', unique: true, nullable: false },
        { name: 'name', type: 'string' },
        { name: 'password_hash', type: 'string', nullable: false },
        { name: 'organization_id', type: 'int', references: { table: 'organizations', column: 'id' } },
        { name: 'role', type: 'string', default: "'member'" },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['email', 'organization_id'],
    },
    {
      name: 'subscriptions',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'organization_id', type: 'int', references: { table: 'organizations', column: 'id' } },
        { name: 'plan', type: 'string', nullable: false },
        { name: 'status', type: 'string', default: "'active'" },
        { name: 'stripe_subscription_id', type: 'string' },
        { name: 'current_period_start', type: 'datetime' },
        { name: 'current_period_end', type: 'datetime' },
        { name: 'created_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['organization_id', 'status'],
    },
  ],

  todoApp: (): TableDefinition[] => [
    ...schemaTemplates.authentication(),
    {
      name: 'lists',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'name', type: 'string', nullable: false },
        { name: 'user_id', type: 'int', references: { table: 'users', column: 'id' } },
        { name: 'created_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['user_id'],
    },
    {
      name: 'tasks',
      columns: [
        { name: 'id', type: 'id', primaryKey: true, default: 'autoincrement()' },
        { name: 'title', type: 'string', nullable: false },
        { name: 'description', type: 'text' },
        { name: 'completed', type: 'boolean', default: 'false' },
        { name: 'due_date', type: 'datetime', nullable: true },
        { name: 'priority', type: 'string', default: "'medium'" },
        { name: 'list_id', type: 'int', references: { table: 'lists', column: 'id' } },
        { name: 'user_id', type: 'int', references: { table: 'users', column: 'id' } },
        { name: 'created_at', type: 'datetime', default: 'now()' },
        { name: 'updated_at', type: 'datetime', default: 'now()' },
      ],
      indexes: ['list_id', 'user_id', 'completed'],
    },
  ],
};

export default {
  generateSchemaFromRequirements,
  requiresDatabase,
  suggestDatabaseProvider,
  schemaTemplates,
};
