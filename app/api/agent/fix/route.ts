/**
 * Fix Agent API
 *
 * Helps users resolve database and infrastructure errors
 * Uses Claude to analyze errors and suggest fixes
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getProjectDir } from '@/lib/project-paths';
import * as fs from 'fs/promises';
import * as path from 'path';

const anthropic = new Anthropic();

interface FixAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, context, error, userMessage, history } = body;

    if (!projectId || !userMessage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const projectDir = getProjectDir(projectId);

    // Gather context about the project
    let projectContext = '';
    try {
      // Check for .env file
      const envPath = path.join(projectDir, '.env');
      const envExists = await fs.access(envPath).then(() => true).catch(() => false);

      // Check for database config
      const dbConfigPath = path.join(projectDir, '.database.json');
      const dbConfigExists = await fs.access(dbConfigPath).then(() => true).catch(() => false);

      // Check for schema
      const schemaPath = path.join(projectDir, 'schema', 'data-schema.md');
      const schemaExists = await fs.access(schemaPath).then(() => true).catch(() => false);

      // Check for prisma schema
      const prismaPath = path.join(projectDir, 'prisma', 'schema.prisma');
      const prismaExists = await fs.access(prismaPath).then(() => true).catch(() => false);

      projectContext = `
Project Context:
- Project ID: ${projectId}
- .env file exists: ${envExists}
- Database config exists: ${dbConfigExists}
- Schema file exists: ${schemaExists}
- Prisma schema exists: ${prismaExists}
`;

      // If prisma exists, include relevant parts
      if (prismaExists) {
        const prismaContent = await fs.readFile(prismaPath, 'utf-8');
        const datasource = prismaContent.match(/datasource\s+\w+\s*{[^}]+}/)?.[0] || '';
        projectContext += `\nPrisma datasource config:\n${datasource}\n`;
      }

    } catch (e) {
      projectContext = `Unable to gather project context: ${e}`;
    }

    // Build conversation for Claude
    const systemPrompt = `You are a helpful database troubleshooting assistant. You help users fix database connection and migration issues.

Context: ${context || 'database-migration'}
Error: ${error || 'No specific error provided'}

${projectContext}

You can:
1. Analyze errors and explain what went wrong
2. Suggest specific fixes the user can try
3. Help configure database credentials
4. Explain migration steps

When you identify a fix that can be applied automatically, include in your response:
- action: "retry" if the user should retry the migration
- action: "configure" with a suggestion if settings need to change

Be concise but helpful. Focus on actionable solutions.`;

    // Convert history to Claude format
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    if (history) {
      for (const msg of history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role,
            content: msg.content,
          });
        }
      }
    }

    // Add the new user message
    messages.push({
      role: 'user',
      content: userMessage,
    });

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: systemPrompt,
      messages,
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === 'text');
    const message = textContent?.text || 'I apologize, but I could not generate a response.';

    // Check if the response suggests an action
    let action: string | undefined;
    let suggestion: string | undefined;

    if (message.toLowerCase().includes('try again') || message.toLowerCase().includes('retry')) {
      action = 'retry';
    }
    if (message.toLowerCase().includes('settings') || message.toLowerCase().includes('configure')) {
      action = 'configure';
      suggestion = 'Check your database credentials in Settings';
    }

    return NextResponse.json({
      success: true,
      message,
      action,
      suggestion,
    });

  } catch (error) {
    console.error('Fix agent error:', error);
    return NextResponse.json({
      success: false,
      message: 'Sorry, I encountered an error while trying to help. Please try again.',
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
