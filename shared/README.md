# Shared Module

## Purpose
Common utilities, services, types, and components used across all features (quick-build, build, fleet).

## Architecture

```
shared/
├── README.md              # This file
├── index.ts               # Main exports
├── types/
│   ├── index.ts           # Common type exports
│   ├── project.ts         # Project-related types
│   └── api.ts             # API response types
├── services/
│   ├── index.ts           # Service exports
│   ├── project-service.ts # Project CRUD operations
│   ├── claude-service.ts  # Claude API wrapper
│   └── preview-service.ts # Preview server management
├── hooks/
│   ├── index.ts           # Hook exports
│   ├── useProject.ts      # Project loading hook
│   └── useWebSocket.ts    # WebSocket connection
├── utils/
│   ├── index.ts           # Utility exports
│   ├── paths.ts           # Path utilities
│   ├── format.ts          # Formatting utilities
│   └── validation.ts      # Input validation
└── components/
    ├── index.ts           # Component exports
    └── ui/                # Re-export shadcn components
```

## What Goes Here

### Types
- `ProjectConfig` - Project configuration shared by all modes
- `ProjectState` - Project state shared by all modes
- `ApiResponse` - Standard API response wrapper

### Services
- `projectService` - Load/save project state
- `claudeService` - Claude Code/API interactions
- `previewService` - Start/stop preview servers

### Hooks
- `useProject` - Load and manage project data
- `useWebSocket` - Real-time updates connection

### Utils
- `getProjectDir` - Resolve project directory path
- `formatDuration` - Human-readable duration
- `validateRequirements` - Input validation

## What Does NOT Go Here

- Feature-specific components (use `features/<name>/components/`)
- Feature-specific types (use `features/<name>/types.ts`)
- Feature-specific hooks (use `features/<name>/hooks/`)
- UI primitives (use `components/ui/` from shadcn)

## Import Pattern

```typescript
// From features
import { useQuickBuild } from '@/features/quick-build';
import { useBuildState } from '@/features/build';
import { useFleetState } from '@/features/fleet';

// From shared
import { projectService, formatDuration } from '@/shared';
import type { ProjectConfig } from '@/shared';
```
