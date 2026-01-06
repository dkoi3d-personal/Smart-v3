# Services Directory

Backend services for the AI Development Platform.

## Quick Start

```typescript
// Run multi-agent build
import { multiAgentService } from '@/services/multi-agent-service';
import { claudeSubscriptionService } from '@/services/claude-subscription-service';

// Start an agent session
const session = await claudeSubscriptionService.startSession({
  workingDirectory: '/path/to/project',
  prompt: 'Build a login page',
  model: 'sonnet',
});
```

## Key Services

| Service | Lines | Purpose |
|---------|-------|---------|
| `multi-agent-service.ts` | ~5,000 | Main orchestration (coordinates all agents) |
| `simple-builder.ts` | ~3,700 | Quick single-agent builds |
| `claude-subscription-service.ts` | ~500 | Spawns Claude CLI processes |
| `dev-server-manager.ts` | ~300 | Dev server lifecycle |

## Memory Services (`./memory/`)

| Service | Purpose |
|---------|---------|
| `learning-agent.ts` | Extracts learnings from agent output |
| `learning-store.ts` | SQLite storage for learnings |
| `pending-learnings.ts` | Queue for user approval |
| `smart-learning-extractor.ts` | AI-powered learning extraction |

## Common Operations

### Add a new agent role
1. Add role to `AgentRole` type in `services/agents/types.ts`
2. Add config to `AGENT_CONFIGS` in `multi-agent-service.ts`
3. Add execution logic in `executeAgent()` method

### Modify agent prompts
- Healthcare prompts: `lib/healthcare-agent-prompts.ts`
- Default prompts: `AGENT_CONFIGS` in `multi-agent-service.ts`

### Debug agent execution
```typescript
// Enable verbose logging
claudeSubscriptionService.on('output', (data) => {
  console.log('[Agent]', data.content);
});
```

## Gotchas & Warnings

1. **multi-agent-service.ts is large** - Use `services/agents/` for new code
2. **Singleton via globalThis** - Services persist across requests, watch for stale state
3. **Stories stored in project dir** - Look for `stories.json` in working directory
4. **Never start dev servers from agents** - Use `dev-server-manager.ts` separately
5. **Process cleanup required** - Always call `session.stop()` or processes leak

## Architecture

```
claudeSubscriptionService (spawns CLI)
        ↓
MultiAgentService (orchestrates roles)
        ↓
Agent Execution (Coder, Tester, Security, etc.)
```

## Types Location

All types extracted to `services/agents/types.ts`:
- `AgentRole`, `AgentMessage`, `Task`, `Epic`
- `MultiAgentSession`, `SessionCheckpoint`
- `CoderConfig`, `CommandLog`

## Related Code

- **Used by**: `app/api/` routes, `app/build/` page
- **Data**: `data/projects.json`, project `stories.json` files
