# AI Platform Architecture

## Overview

This platform provides three modes for building software with AI:

| Mode | Path | Complexity | Use Case |
|------|------|------------|----------|
| **Quick Build** | `/quick-build` | Simple | Rapid prototypes from templates |
| **Complex Build** | `/build/[projectId]` | Medium | Production apps with multi-agent |
| **Fleet** | `/fleet` | Large | 1,000+ story enterprise projects |

## Directory Structure

```
ai-platform-v4/
├── app/                    # Next.js App Router (thin wrappers)
│   ├── quick-build/        # Quick build page
│   ├── build/[projectId]/  # Complex build page
│   ├── fleet/              # Fleet orchestration page
│   └── api/                # API routes
│
├── features/               # Feature modules (main logic)
│   ├── quick-build/        # Quick build feature
│   │   ├── README.md       # Feature context for Claude
│   │   ├── types.ts        # TypeScript interfaces
│   │   ├── constants.ts    # Configuration constants
│   │   ├── components/     # React components
│   │   ├── hooks/          # Custom hooks
│   │   └── index.ts        # Public exports
│   │
│   ├── build/              # Complex build feature
│   │   ├── README.md
│   │   ├── types.ts
│   │   ├── constants.ts
│   │   ├── components/
│   │   ├── hooks/
│   │   └── index.ts
│   │
│   └── fleet/              # Fleet orchestration feature
│       ├── README.md
│       ├── types.ts
│       ├── constants.ts
│       ├── hooks/
│       └── index.ts
│
├── shared/                 # Shared across all features
│   ├── README.md
│   ├── types/              # Common types
│   ├── utils/              # Utility functions
│   └── index.ts
│
├── lib/                    # Core business logic
│   ├── fleet/              # Fleet orchestration engine
│   ├── project-paths.ts    # Project directory config
│   └── project-persistence.ts
│
├── services/               # Service layer
│   ├── simple-builder.ts   # Quick build service
│   ├── multi-agent-service.ts
│   └── fleet-agent-bridge.ts
│
├── components/             # Shared React components
│   ├── ui/                 # Shadcn UI primitives
│   ├── panels/             # Reusable panels
│   └── fleet/              # Fleet-specific components
│
└── docs/                   # Documentation
    └── ARCHITECTURE.md     # This file
```

## Feature Module Pattern

Each feature module in `features/` follows this pattern:

```
features/<feature-name>/
├── README.md           # Context doc for Claude (REQUIRED)
├── index.ts            # Public API exports
├── types.ts            # TypeScript interfaces
├── constants.ts        # Configuration values
├── components/         # React components
│   ├── index.ts        # Component exports
│   └── *.tsx
├── hooks/              # Custom hooks
│   ├── index.ts        # Hook exports
│   └── use*.ts
└── utils/              # Feature-specific utilities
    └── index.ts
```

### README.md Purpose

Each feature has a `README.md` that serves as **context for Claude**:
- Explains what the feature does
- Documents the file structure
- Lists API endpoints used
- Shows data flow diagrams
- Clarifies what's in/out of scope

This helps Claude understand boundaries and make appropriate changes.

## Import Patterns

```typescript
// Feature imports
import { useQuickBuild, BuildProgress } from '@/features/quick-build';
import { useBuildState, AGENT_COLORS } from '@/features/build';
import { useFleetState, DOMAIN_ICONS } from '@/features/fleet';

// Shared imports
import { formatDuration, ProjectConfig } from '@/shared';

// UI component imports
import { Button, Card } from '@/components/ui';

// Service imports
import { getProjectDir } from '@/lib/project-paths';
```

## Data Flow

### Quick Build
```
User Input → /api/simple-build → simple-builder.ts → templates → npm build → preview
```

### Complex Build
```
User Input → /api/v2/plan → Project Created
          → /api/v2/multi-agent → SSE Stream
          → multi-agent-service.ts → Claude Code SDK
          → Parallel Agents (Coder, Tester, Security)
          → File Output + Test Results
```

### Fleet
```
User Input → /api/fleet/decompose → MegaPromptDecomposer
          → DomainClusterService → Story Groups
          → SquadAssignmentService → Squad Teams
          → FleetCoordinator → Phase Execution
          → AgileSquad + WorktreeManager → Parallel Development
          → MergeStrategyEngine → Integration
```

## Key Design Decisions

1. **Feature Modules**: Logic grouped by feature, not by type
2. **README Context**: Each feature has documentation for Claude
3. **Thin Pages**: App router pages just compose feature components
4. **Shared Module**: Common utilities in one place
5. **Type Safety**: TypeScript interfaces per feature
6. **Hook Pattern**: State management via custom hooks

## Adding a New Feature

1. Create `features/<name>/` directory
2. Add `README.md` with context
3. Create `types.ts` for interfaces
4. Create `constants.ts` for config
5. Create `hooks/` for state management
6. Create `components/` for UI
7. Export public API from `index.ts`
8. Create thin page in `app/<name>/page.tsx`

## Migration Notes

The codebase was refactored from a monolithic structure where:
- Page components were 1,000-7,000 lines
- Types were defined inline
- State logic was mixed with UI

Now:
- Page components are thin orchestrators (~200 lines)
- Types are in dedicated files
- State logic is in custom hooks
- Components are reusable
