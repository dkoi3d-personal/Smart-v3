import { NextRequest, NextResponse } from 'next/server';
import { loadBug, requestFix, updateFixRequest, addComment } from '@/lib/bug-tracker';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

// POST - Request a fix from Claude
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bugId: string }> }
) {
  try {
    const { bugId } = await params;
    const body = await request.json();
    const { projectId, requestedBy, description, projectFiles } = body;

    if (!projectId) {
      return NextResponse.json(
        { error: 'Project ID is required' },
        { status: 400 }
      );
    }

    const bug = await loadBug(projectId, bugId);
    if (!bug) {
      return NextResponse.json(
        { error: 'Bug not found' },
        { status: 404 }
      );
    }

    // Create the fix request
    const fixRequest = await requestFix(
      projectId,
      bugId,
      requestedBy || 'uat_tester',
      description || 'Please fix this bug'
    );

    if (!fixRequest) {
      return NextResponse.json(
        { error: 'Failed to create fix request' },
        { status: 500 }
      );
    }

    // Build context for Claude
    const bugContext = `
## Bug Report

**Title:** ${bug.title}
**Severity:** ${bug.severity}
**Category:** ${bug.category}
**Status:** ${bug.status}

**Description:**
${bug.description}

**Steps to Reproduce:**
${bug.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`).join('\n')}

**Expected Behavior:**
${bug.expectedBehavior}

**Actual Behavior:**
${bug.actualBehavior}

**Environment:**
- Browser: ${bug.environment.browser || 'Unknown'}
- OS: ${bug.environment.os || 'Unknown'}
- Screen Size: ${bug.environment.screenSize || 'Unknown'}
- URL: ${bug.environment.url || 'Unknown'}

**Additional Context from Tester:**
${description || 'No additional context provided.'}

## Project Files
${projectFiles ? JSON.stringify(projectFiles, null, 2) : 'No project files provided.'}
`;

    // Update fix request to processing
    await updateFixRequest(projectId, bugId, fixRequest.id, { status: 'processing' });

    // Call Claude to analyze and suggest fix
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a senior software engineer helping to fix a bug reported by a UAT tester.

${bugContext}

Please analyze this bug and provide:
1. **Root Cause Analysis**: What is likely causing this bug?
2. **Recommended Fix**: Provide specific code changes needed to fix this bug.
3. **Files to Modify**: List the files that need to be changed.
4. **Testing Steps**: How to verify the fix works.

If you need more information to provide a fix, specify what additional context you need.

Format your response in a clear, structured way that both developers and non-technical testers can understand.`,
        },
      ],
    });

    const claudeResponse = message.content[0].type === 'text' ? message.content[0].text : '';

    // Update fix request with Claude's response
    await updateFixRequest(projectId, bugId, fixRequest.id, {
      claudeResponse,
      status: 'completed',
    });

    // Add Claude's response as a comment
    await addComment(projectId, bugId, {
      authorId: 'claude',
      authorName: 'Claude AI',
      authorRole: 'ai_assistant',
      content: claudeResponse,
      isClaudeResponse: true,
    });

    return NextResponse.json({
      success: true,
      fixRequest: {
        ...fixRequest,
        claudeResponse,
        status: 'completed',
      },
    });
  } catch (error) {
    console.error('Failed to request fix:', error);
    return NextResponse.json(
      { error: 'Failed to request fix from Claude' },
      { status: 500 }
    );
  }
}
