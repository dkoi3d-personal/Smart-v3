# AI Development Platform

- dont start the dev server unless I tell you too
- never start a server for me

---

A multi-agent AI development platform that orchestrates specialized agents (Product Owner, Coder, Tester, Security, Fixer) to build software from natural language requirements.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE (Next.js)                        │
│  - /build/[projectId]   - Project build view                        │
│  - /quick-build         - Simple single-agent builds                │
│  - /projects            - Project management                        │
└────────────────────────────────────────┬────────────────────────────┘
                                         │
┌────────────────────────────────────────▼────────────────────────────┐
│              MULTI-AGENT SERVICE (services/multi-agent-service.ts)  │
│  - Agent orchestration   - Session management   - Tool execution    │
└───────┬─────────────────────────────────────────┬──────────────────┘
        │                                         │
┌───────▼─────────────────────────┐   ┌──────────▼───────────────────┐
│  PRODUCT OWNER AGENT            │   │  CODER AGENT                  │
│  - Creates epics and stories    │   │  - Implements features        │
│  - Defines acceptance criteria  │   │  - Writes application code    │
└─────────────────────────────────┘   └──────────────────────────────┘
        │                                         │
┌───────▼─────────────────────────┐   ┌──────────▼───────────────────┐
│  TESTER AGENT                   │   │  SECURITY AGENT               │
│  - Writes tests                 │   │  - Security review            │
│  - Validates functionality      │   │  - Vulnerability scanning     │
└─────────────────────────────────┘   └──────────────────────────────┘
```

## Core Components

### 1. MultiAgentService (`services/multi-agent-service.ts`)
Main orchestration service for running parallel agents:
- Coordinates Product Owner, Coder, Tester, Security agents
- Manages agent sessions and state
- Handles tool execution (file ops, bash, git)
- Integrates with learning memory system

### 2. ClaudeSubscriptionService (`services/claude-subscription-service.ts`)
Spawns Claude CLI processes:
- Uses Claude Code subscription (no API costs)
- Manages process lifecycle
- Streams agent output

### 3. Learning Memory System (`services/memory/`)
Cross-project knowledge persistence:
- `learning-store.ts` - SQLite storage with FTS5
- `learning-agent.ts` - Extracts learnings from agent output
- `error-extractor.ts` - Automatic error pattern extraction

### 4. Build Features (`features/build/`)
React components and hooks for the build UI:
- `components/` - UI components (tabs, modals, workspace)
- `hooks/` - State management (useBuildState, useBuildStream)
- `stores/` - Zustand stores for build page state

## Usage

### Starting a Build
```typescript
// Via API
const res = await fetch('/api/v2/multi-agent', {
  method: 'POST',
  body: JSON.stringify({ projectId, requirements }),
});

// Connect to SSE stream for real-time updates
const eventSource = new EventSource(`/api/v2/stream?projectId=${id}`);
eventSource.onmessage = (e) => console.log(JSON.parse(e.data));
```

### Quick Build (Single Agent)
```typescript
const res = await fetch('/api/simple-build', {
  method: 'POST',
  body: JSON.stringify({ prompt, projectId }),
});
```

## Quick Commands

```bash
# Run development server
npm run dev

# Run unit tests
npx vitest run

# Build for production
npm run build
```

## Key File Structure

```
app/
├── api/                    # API routes
│   ├── v2/multi-agent/     # Multi-agent build API
│   ├── simple-build/       # Quick build API
│   └── projects/           # Project CRUD
├── build/[projectId]/      # Build page
└── quick-build/            # Quick build page

features/
├── build/                  # Build feature components
│   ├── components/         # UI (tabs, modals, workspace)
│   ├── hooks/              # State hooks
│   └── stores/             # Zustand stores
└── quick-build/            # Quick build feature

services/
├── multi-agent-service.ts  # Main orchestration (~5K lines)
├── claude-subscription-service.ts
├── agents/                 # Agent types and configs
└── memory/                 # Learning system

lib/
├── healthcare-modules/     # Pre-built healthcare components
├── design-systems/         # Design system utilities
└── agents/                 # Agent infrastructure

stores/
├── project-store.ts        # Project state
├── build-store.ts          # Build state
└── ui-store.ts             # UI state
```

## Key Design Decisions

1. **Multi-Agent Parallel Execution** - Specialized agents work in parallel
2. **Foundation-First Pattern** - Core setup completes before features
3. **Event-Driven Updates** - SSE for real-time UI updates
4. **Learning Memory** - Cross-project knowledge persistence
5. **File Locking** - Prevents concurrent write conflicts

## Agent Roles

| Agent | Purpose |
|-------|---------|
| Product Owner | Creates epics, stories, acceptance criteria |
| Coder | Implements features, writes application code |
| Tester | Writes tests, validates functionality |
| Security | Reviews code for security issues |
| Fixer | Debugs and fixes errors |

## Data Storage

- **SQLite**: `data/learnings.db` - Learning memory
- **JSON**: `data/projects.json` - Project metadata
- **Project Files**: Created in configured coding directory
