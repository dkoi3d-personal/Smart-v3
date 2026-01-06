# AI Fleet Orchestrator - Refactoring Plan

Prioritized plan to improve performance, maintainability, and AI-friendliness.

## Priority Levels

- **P0 (Critical)**: Breaking issues, memory leaks, data corruption risks
- **P1 (High)**: Performance bottlenecks, major maintainability issues
- **P2 (Medium)**: Code quality, testing gaps
- **P3 (Low)**: Nice-to-haves, minor improvements

---

## P0: Critical Issues

### 1. ✅ SSE Memory Leaks (COMPLETED)
**File**: `app/api/fleet/stream/route.ts`
- [x] Remove excessive console.logs
- [x] Add centralized cleanup function
- [x] Cleanup on fleet:completed and fleet:error
- [x] Prevent double cleanup

### 2. Global State Memory Growth
**File**: `app/api/fleet/route.ts` (lines 50-68)

**Problem**: `activeFleets` Map grows indefinitely
```typescript
const globalForFleet = globalThis as unknown as {
  activeFleets: Map<string, FleetCoordinator>;
};
```

**Fix**:
```typescript
// Add cleanup for completed/errored fleets
fleet.once('fleet:completed', () => {
  setTimeout(() => activeFleets.delete(projectId), 60000); // 1 min delay
});
```

**Effort**: 30 min | **Risk**: Low

### 3. State Persistence Race Conditions
**File**: `lib/fleet/fleet-persistence.ts`

**Problem**: Concurrent saves can corrupt state

**Fix**: Add file locking
```typescript
import lockfile from 'proper-lockfile';

async function saveWithLock(filePath: string, data: any) {
  const release = await lockfile.lock(filePath, { retries: 3 });
  try {
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
  } finally {
    await release();
  }
}
```

**Effort**: 1 hour | **Risk**: Medium

---

## P1: High Priority

### 4. Split multi-agent-service.ts (5,969 lines)
**Current structure**:
- Types/interfaces (lines 51-200)
- Learning functions (lines 207-385)
- Architecture context (lines 386-500)
- Agent configs (lines 507-1990)
- MultiAgentService class (lines 1992-5962)

**Target structure**:
```
services/
├── agents/
│   ├── types.ts              ✅ DONE
│   ├── index.ts              ✅ DONE
│   ├── config.ts             # Agent configurations
│   ├── session-manager.ts    # Session lifecycle
│   ├── executor.ts           # Core execution
│   ├── story-sync.ts         # Story persistence
│   └── checkpoint.ts         # Save/restore
├── multi-agent-service.ts    # Slim orchestrator
└── ...
```

**Migration steps**:
1. [x] Extract types to `services/agents/types.ts`
2. [ ] Extract AGENT_CONFIGS to `services/agents/config.ts`
3. [ ] Extract learning functions to `services/agents/learning.ts`
4. [ ] Extract architecture helpers to `services/agents/architecture.ts`
5. [ ] Extract checkpoint methods to `services/agents/checkpoint.ts`
6. [ ] Update imports across codebase

**Effort**: 4-6 hours | **Risk**: Medium (test thoroughly)

### 5. Split fleet/page.tsx (5,147 lines)
**Target structure**:
```
app/fleet/
├── page.tsx                  # Slim wrapper
├── components/
│   ├── DecompositionPanel.tsx
│   ├── ArchitecturePanel.tsx
│   ├── ExecutionPanel.tsx
│   ├── ProgressPanel.tsx
│   ├── KanbanBoard.tsx
│   └── AgentFeed.tsx
└── hooks/
    ├── useDecomposition.ts
    ├── useExecution.ts
    └── useAgentFeed.ts
```

**Effort**: 6-8 hours | **Risk**: Medium

### 6. Add React.memo() to List Components
**Files**: `app/fleet/page.tsx`, fleet components

**Problem**: Re-renders on every state update

**Fix**:
```typescript
const StoryCard = React.memo(({ story, onSelect }) => {
  // ...
});

const EpicList = React.memo(({ epics }) => {
  // ...
});
```

**Effort**: 2 hours | **Risk**: Low

### 7. Add Error Boundaries
**Problem**: Zero error boundaries in codebase

**Fix**: Add at key points:
```typescript
// app/fleet/layout.tsx
export default function FleetLayout({ children }) {
  return (
    <ErrorBoundary fallback={<FleetErrorFallback />}>
      {children}
    </ErrorBoundary>
  );
}
```

**Effort**: 2 hours | **Risk**: Low

---

## P2: Medium Priority

### 8. Create Shared Error Handler
**Problem**: Duplicated try/catch patterns

**Fix**: Create utility:
```typescript
// lib/utils/error-handler.ts
export async function withErrorContext<T>(
  operation: string,
  fn: () => Promise<T>,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const enhancedError = new Error(`${operation}: ${error.message}`);
    onError?.(enhancedError);
    throw enhancedError;
  }
}
```

**Effort**: 2 hours | **Risk**: Low

### 9. Configuration Management
**Problem**: Hardcoded values scattered across codebase

**Fix**: Create central config:
```typescript
// lib/config.ts
export const CONFIG = {
  CACHE_TTL_MS: parseInt(process.env.CACHE_TTL || '5000'),
  MAX_PARALLEL_AGENTS: parseInt(process.env.MAX_AGENTS || '20'),
  SSE_POLL_INTERVAL_MS: 3000,
  CHECKPOINT_INTERVAL_MS: 30 * 60 * 1000, // 30 min
  SESSION_TIMEOUT_MS: 15 * 60 * 1000, // 15 min
};
```

**Effort**: 3 hours | **Risk**: Low

### 10. Add Integration Tests
**Priority files to test**:
1. `app/api/fleet/route.ts` - Concurrent sessions
2. `lib/fleet/wave-executor.ts` - Wave conflict detection
3. `lib/fleet/fleet-persistence.ts` - State recovery
4. `services/multi-agent-service.ts` - Session lifecycle

**Effort**: 8-12 hours | **Risk**: Low

### 11. Optimize Epic/Story Processing
**File**: `app/fleet/page.tsx` (lines 1537-1538)

**Problem**: Nested forEach without optimization
```typescript
updatedEpics.forEach(epic => {
  (epic.stories || []).forEach(story => { ... });
});
```

**Fix**: Use Map for O(1) lookups
```typescript
const storyMap = new Map(stories.map(s => [s.id, s]));
const epicMap = new Map(epics.map(e => [e.id, e]));
```

**Effort**: 2 hours | **Risk**: Low

---

## P3: Low Priority

### 12. Remove Unused Imports
Run `npx eslint --fix` with unused-imports rule

### 13. Standardize Logging
Replace all `console.log` with structured logger

### 14. Add TypeScript Strict Mode
Enable in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true
  }
}
```

### 15. Bundle Size Optimization
- Lazy load large components
- Dynamic imports for rarely-used features
- Tree-shake lucide-react icons

---

## Implementation Order

### Week 1: Critical Fixes
1. ✅ Fix SSE memory leaks
2. Fix global state cleanup
3. Add file locking for persistence

### Week 2: Major Splits
4. Split multi-agent-service.ts
5. Add React.memo to fleet components
6. Add error boundaries

### Week 3: Quality
7. Create shared error handler
8. Add configuration management
9. Add key integration tests

### Week 4: Polish
10. Optimize epic/story processing
11. Split fleet/page.tsx
12. Standardize logging

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Largest file | 5,969 lines | < 500 lines |
| Test coverage | ~5% | > 40% |
| Memory leaks | Multiple | Zero |
| Error boundaries | 0 | 5+ |
| Build time | ? | < 30s |

---

## Notes

- Always run full test suite before/after major refactors
- Create feature branch for each major change
- Update CLAUDE.md files when structure changes
- Prefer incremental changes over big-bang rewrites
