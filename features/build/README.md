# Complex Build Feature

## Purpose
Production-ready multi-agent development with full quality gates. Manages medium-complexity projects with 4-5 parallel specialized agents.

## Scope
- Multi-agent orchestration (Product Owner, Coder, Tester, Security, Fixer)
- Full testing & security scanning
- Architecture planning & documentation
- Real-time agent chat interface
- Kanban board for task tracking
- File tree explorer
- Deployment integration (AWS/Azure)

## Current Architecture

```
features/build/
├── README.md                    # This file - context for Claude
├── index.ts                     # Public API exports
├── types.ts                     # All TypeScript interfaces (centralized)
├── constants.ts                 # Configuration constants & defaults
├── components/
│   ├── tabs/
│   │   ├── OverviewTab.tsx      # Task board & AI controls (~635 lines)
│   │   ├── DevelopmentTab.tsx   # Code editor & file tree
│   │   ├── TestingTab.tsx       # Test results & coverage
│   │   ├── SecurityTab.tsx      # Security scanning & vulnerabilities
│   │   ├── SettingsTab.tsx      # Build configuration
│   │   └── index.ts             # Tab exports
│   ├── shared/
│   │   ├── AgentStatusIndicator.tsx  # Agent status badges with tooltips
│   │   ├── StatusBadge.tsx      # Task/Build/Priority status badges
│   │   └── index.ts             # Shared component exports
│   └── index.ts                 # Component exports (re-exports all)
├── hooks/
│   ├── useBuildState.ts         # Core build state management
│   ├── useBuildStream.ts        # SSE streaming & event handling
│   ├── useUIState.ts            # UI-specific state (tabs, selection)
│   ├── useFileTree.ts           # File tree & contents
│   ├── useBuildPreview.ts       # Preview server (legacy)
│   ├── usePreviewServer.ts      # Preview server management
│   └── index.ts                 # Hook exports
```

## Usage

### Types

Import types from `@/features/build/types`:

```typescript
import type {
  Epic,
  Task,
  TaskStatus,
  AgentMessage,
  AgentRole,
  MessageType,
  BuildPhase,
  BuildMetrics,
  BuildLog,
  SecurityMetrics,
  TestingMetrics,
  DoraMetrics,
  QuickSettings,
  PreviewStatus,
  ConnectionStatus,
  MainTab,
  CheckpointInfo,
  TreeNode,
  FileChange,
  ResearchSuggestion,
} from '@/features/build/types';
```

### Constants

Import constants from `@/features/build/constants`:

```typescript
import {
  // Agent styling
  AGENT_COLORS,
  AGENT_BG_COLORS,
  AGENT_ICONS,
  AGENT_NAMES,
  AGENT_TERMINAL_ICONS,
  AGENT_TERMINAL_COLORS,

  // Kanban board
  KANBAN_COLUMNS,
  KANBAN_COLUMN_COLORS,
  STATUS_TO_COLUMN,

  // Default values
  DEFAULT_BUILD_METRICS,
  DEFAULT_TESTING_METRICS,
  DEFAULT_SECURITY_METRICS,
  DEFAULT_DORA_METRICS,
  DEFAULT_QUICK_SETTINGS,

  // Connection config
  MAX_RECONNECT_ATTEMPTS,
  HEARTBEAT_INTERVAL,
  RECONNECT_DELAY,

  // Preview config
  PREVIEW_POLL_INTERVAL,
  PREVIEW_MAX_RETRIES,
} from '@/features/build/constants';
```

### Components

Import tab components from `@/features/build/components`:

```typescript
import {
  SecurityTab,
  TestingTab,
  SettingsTab,
  OverviewTab,
  DevelopmentTab,
  ComplianceTab,  // Re-exported from @/components/panels
  DeployTab,      // Re-exported from @/components/panels
} from '@/features/build/components';
```

### Hooks

Import hooks from `@/features/build/hooks`:

```typescript
import {
  useBuildState,
  useFileTree,
  useBuildPreview,
  usePreviewServer,
} from '@/features/build/hooks';
```

## Key Types

### BuildPhase
Status of the build process:
- `loading` - Initial loading state
- `planned` - Epics and stories defined
- `building` - Build in progress
- `completed` - Build finished successfully
- `error` - Build failed
- `paused` - Build paused by user
- `stopped` - Build stopped by user

### TaskStatus
Task lifecycle states:
- `backlog` - Not started
- `pending` - Ready to start
- `in_progress` - Being worked on
- `testing` - Under testing
- `completed` / `done` - Finished
- `failed` - Failed

### AgentRole
AI agent types:
- `coordinator` - Orchestrates the build process
- `product_owner` - Defines requirements and acceptance criteria
- `coder` - Implements features (can have multiple instances)
- `tester` - Writes and runs tests
- `security` - Performs security scanning
- `fixer` - Fixes build errors and test failures
- `researcher` - Researches implementation approaches

## Data Flow

```
Page Load
    ↓
useBuildState (loads project from API)
    ↓
User clicks "Start Build"
    ↓
POST /api/v2/multi-agent (SSE stream)
    ↓
Stream parsing updates:
├── AgentMessages (chat)
├── Tasks (kanban)
├── FileTree (files)
└── Metrics (stats)
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v2/plan` | POST | Create project plan |
| `/api/v2/multi-agent` | POST | Start multi-agent build (SSE) |
| `/api/v2/multi-agent/pause` | POST | Pause build |
| `/api/v2/multi-agent/resume` | POST | Resume build |
| `/api/v2/fixer` | POST | Fix errors |
| `/api/projects/[id]` | GET | Get project state |
| `/api/projects/[id]/files` | GET | Get file tree |
| `/api/preview/start` | POST | Start dev server |
| `/api/preview/stop` | POST | Stop dev server |
| `/api/preview/status` | GET | Get preview status |

## State Management
- Zustand store: `useProjectStore` for cross-component state
- Local hooks for component-specific state
- WebSocket for real-time updates

## Existing Extracted Components
These are already in `components/panels/`:
- `ArchitecturePanel`
- `ComplianceTab`
- `InfrastructurePanel`
- `DeployTab`

## NOT in Scope
- Quick builds (see `/features/quick-build/`)
- Fleet orchestration (see `/features/fleet/`)
- Shared UI components (see `/shared/`)

## Design Decisions

1. **Tab Extraction**: Large tabs (Security, Testing, Settings, Overview, Development) are extracted into separate components for maintainability.

2. **Centralized Types**: All types are in `types.ts` to avoid duplication and ensure consistency across the codebase.

3. **Centralized Constants**: Default values and configuration constants are in `constants.ts` for single source of truth.

4. **Custom Hooks**: State management is extracted into hooks (`useBuildState`, `useFileTree`, `usePreviewServer`) for reusability.

5. **Feature Module Pattern**: This feature uses a self-contained module pattern with components, hooks, types, and constants grouped together.
