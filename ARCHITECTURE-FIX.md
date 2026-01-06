# Architecture Fix: Agent SDK vs Direct API

## Problem Summary

The AI Development Platform was originally attempting to use the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) for orchestrating 6 concurrent AI agents. This was the **wrong architectural choice** for a multi-agent orchestration system.

## Root Cause

The orchestrator (`lib/agents/orchestrator.ts`) was importing and using `claudeAgentService` from `services/claude-api.ts`, which wraps the Agent SDK's `query()` function.

### Why This Didn't Work:

1. **Agent SDK is designed for single-agent workflows** - It's built for Claude Code-like functionality where one agent executes a task with tool access
2. **Not built for concurrency** - Subagents queue sequentially, not true parallel execution
3. **Streaming-only responses** - Returns `AsyncIterator`, making agent coordination complex
4. **Session management overhead** - Requires tracking and interrupting sessions

## The Solution

### Correct Architecture: Direct Anthropic API

You already had the correct implementation in `services/anthropic-api.ts`! The fix was to switch the orchestrator to use it.

```typescript
// BEFORE (Wrong - Agent SDK)
import { claudeAgentService } from '@/services/claude-api';

// AFTER (Correct - Direct API)
import { anthropicService } from '@/services/anthropic-api';
```

### Why Direct API is Correct:

1. ✅ **Built for multi-agent systems** - Fine-grained control over each agent
2. ✅ **True concurrency** - Can run multiple agents in parallel with `Promise.all()`
3. ✅ **Stateless sessions** - No complex session cleanup required
4. ✅ **Specialized agents** - Each agent has unique system prompts and behavior
5. ✅ **Scalable** - Can handle many simultaneous workflows

## Architecture Comparison

### Agent SDK (query()) - WRONG for this use case
```typescript
const result = query({
  prompt: 'Your task',
  options: {
    model: 'sonnet',
    allowedTools: ['Read', 'Write', 'Bash'],
    permissionMode: 'acceptEdits',
  }
});

// Returns: AsyncIterator (streaming only)
// Use case: Single agentic task with tool access
// Concurrency: Sequential (subagents queue)
```

### Direct API (Anthropic) - CORRECT for multi-agent orchestration
```typescript
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 4096,
  system: 'You are the Supervisor agent...',
  messages: [{ role: 'user', content: requirements }]
});

// Returns: Complete message object
// Use case: Multi-agent orchestration with specialized roles
// Concurrency: True parallel execution
```

## Changes Made

### 1. Updated Orchestrator (`lib/agents/orchestrator.ts`)
- Changed import from `claude-api` to `anthropic-api`
- Replaced all `claudeAgentService` calls with `anthropicService`
- Removed Agent SDK session cleanup logic (not needed with stateless API)
- Updated comments to reflect API-based architecture

### 2. Updated Documentation
- **README.md**: Changed from "No API Key Required" to requiring Anthropic API key
- Added architecture explanation
- Updated prerequisites and installation steps

### 3. Updated Environment Configuration
- **.env.example**: Changed from optional `CLAUDE_CODE_PATH` to required `ANTHROPIC_API_KEY`
- Added clear instructions for getting API key

### 4. Created This Document
- Explains the architectural issue and fix
- Provides guidance for future development

## When to Use What

### Use Claude Agent SDK `query()` When:
- Building a single agent that needs tool access (file/bash operations)
- Creating Claude Code-like functionality in your app
- Self-contained agentic tasks
- Example: A code refactoring agent that reads/writes files

### Use Direct Anthropic API When:
- Orchestrating multiple specialized agents (your case)
- Need true concurrent execution
- Complex multi-agent workflows
- Agent-to-agent communication
- Example: Supervisor coordinating Product Owner, Coder, Tester, etc.

## Hybrid Approach (Optional Future Enhancement)

You could combine both approaches:

```typescript
// Supervisor/Product Owner: Direct API (planning/reasoning)
const supervisorResponse = await anthropicService.invokeAgent({
  prompt: 'Analyze these requirements...',
});

// Coder: Agent SDK (needs file/tool access)
const coderResult = query({
  prompt: 'Implement this feature...',
  options: { allowedTools: ['Read', 'Write', 'Bash'] }
});
```

## Required Setup

### 1. Get Anthropic API Key
Visit: https://console.anthropic.com/settings/keys

### 2. Create `.env.local`
```bash
cp .env.example .env.local
```

### 3. Add API Key
```
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
```

### 4. Start Server
```bash
npm run dev
```

## Testing the Fix

1. Start the development server
2. Navigate to http://localhost:3000/dashboard
3. Enter requirements in the Requirements Panel
4. Click "Analyze & Start"
5. Watch the console logs - you should see:
   - "Attempting to invoke Supervisor agent via Anthropic API..."
   - API call logs with token usage and costs
   - Agents working in parallel

## Cost Considerations

With the direct API approach, you'll pay for API usage based on Anthropic's pricing:
- **Input**: $3.00 per million tokens
- **Output**: $15.00 per million tokens

The Agent SDK would have required Claude Code subscription but had architectural limitations for multi-agent systems.

## Conclusion

The platform now uses the **correct architecture** for multi-agent orchestration. The Direct Anthropic API provides:
- True concurrency
- Better control
- Stateless sessions
- Scalability

This matches the recommended approach from Anthropic's documentation and industry best practices for building multi-agent systems.

## References

- [Building agents with the Claude Agent SDK - Anthropic](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Multi-Agent Orchestration Patterns - DEV Community](https://dev.to/bredmond1019/multi-agent-orchestration-running-10-claude-instances-in-parallel-part-3-29da)
- [Anthropic API Documentation](https://docs.anthropic.com/en/api/messages)
