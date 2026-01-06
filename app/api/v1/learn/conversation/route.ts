/**
 * Learning Conversation API
 *
 * POST /api/v1/learn/conversation - Log a conversation turn for learning
 *
 * Receives conversation data from Claude Code and stores it for learning/analysis.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

// Conversation turn structure
interface ConversationTurn {
  projectId: string;
  conversationId: string;
  userPrompt: string;
  assistantResponse: string;
  toolsUsed?: string[];
  filesModified?: string[];
  timestamp: string;
  source: string;
}

// Get data directory for storing conversations
function getConversationsDir(): string {
  return path.join(process.cwd(), 'data', 'conversations');
}

// Ensure conversations directory exists
async function ensureConversationsDir(): Promise<void> {
  const dir = getConversationsDir();
  await fs.mkdir(dir, { recursive: true });
}

// POST /api/v1/learn/conversation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      projectId,
      conversationId,
      userPrompt,
      assistantResponse,
      toolsUsed,
      filesModified,
      timestamp,
      source,
    } = body as ConversationTurn;

    // Validate required fields
    if (!projectId || !conversationId) {
      return NextResponse.json(
        { error: 'Missing required fields: projectId, conversationId' },
        { status: 400 }
      );
    }

    // Ensure directory exists
    await ensureConversationsDir();

    // Create conversation file path (one file per conversation)
    const conversationFile = path.join(
      getConversationsDir(),
      `${projectId}_${conversationId}.jsonl`
    );

    // Create the turn entry
    const turn = {
      projectId,
      conversationId,
      userPrompt: userPrompt?.substring(0, 10000), // Limit size
      assistantResponse: typeof assistantResponse === 'string'
        ? assistantResponse.substring(0, 50000)
        : JSON.stringify(assistantResponse).substring(0, 50000),
      toolsUsed: toolsUsed || [],
      filesModified: filesModified || [],
      timestamp: timestamp || new Date().toISOString(),
      source: source || 'unknown',
    };

    // Append to JSONL file (one JSON object per line)
    await fs.appendFile(
      conversationFile,
      JSON.stringify(turn) + '\n',
      'utf-8'
    );

    return NextResponse.json({
      success: true,
      message: 'Conversation turn logged',
      conversationId,
    });
  } catch (error) {
    console.error('[Learn Conversation API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to log conversation' },
      { status: 500 }
    );
  }
}

// GET /api/v1/learn/conversation - List recent conversations (optional)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const projectId = searchParams.get('projectId');
    const conversationId = searchParams.get('conversationId');
    const limit = parseInt(searchParams.get('limit') || '10');

    await ensureConversationsDir();
    const dir = getConversationsDir();

    // List conversation files
    const files = await fs.readdir(dir);
    let conversationFiles = files.filter(f => f.endsWith('.jsonl'));

    // Filter by project if specified
    if (projectId) {
      conversationFiles = conversationFiles.filter(f => f.startsWith(projectId));
    }

    // If specific conversation requested, return its turns
    if (conversationId && projectId) {
      const filePath = path.join(dir, `${projectId}_${conversationId}.jsonl`);
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const turns = content
          .trim()
          .split('\n')
          .filter(line => line)
          .map(line => JSON.parse(line));

        return NextResponse.json({
          conversationId,
          projectId,
          turns,
          count: turns.length,
        });
      } catch {
        return NextResponse.json(
          { error: 'Conversation not found' },
          { status: 404 }
        );
      }
    }

    // Return list of conversations
    const conversations = conversationFiles.slice(0, limit).map(f => {
      const [proj, ...rest] = f.replace('.jsonl', '').split('_');
      return {
        projectId: proj,
        conversationId: rest.join('_'),
        file: f,
      };
    });

    return NextResponse.json({
      conversations,
      count: conversations.length,
    });
  } catch (error) {
    console.error('[Learn Conversation API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to list conversations' },
      { status: 500 }
    );
  }
}
