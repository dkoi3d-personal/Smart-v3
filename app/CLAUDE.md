# App Directory (Next.js App Router)

Next.js 16 App Router structure for the AI Development Platform.

## Quick Reference

```typescript
// Navigate to build
router.push('/build/' + projectId);

// Start a multi-agent build via API
const res = await fetch('/api/v2/multi-agent', {
  method: 'POST',
  body: JSON.stringify({ projectId, requirements }),
});

// Connect to SSE stream
const eventSource = new EventSource(`/api/v2/stream?projectId=${id}`);
eventSource.onmessage = (e) => console.log(JSON.parse(e.data));
```

## Main Pages

| Route | File | Purpose |
|-------|------|---------|
| `/` | `page.tsx` | Home - build mode selection |
| `/quick-build` | `quick-build/page.tsx` | Simple single-agent builds |
| `/build/[projectId]` | `build/[projectId]/page.tsx` | Project build view |
| `/projects` | `projects/page.tsx` | Project management |
| `/settings` | `settings/page.tsx` | Configuration |
| `/learnings` | `learnings/page.tsx` | Learning management |

## API Routes

### Build APIs (`api/v2/`)
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v2/multi-agent` | POST | Start multi-agent build |
| `/api/v2/stream` | GET | SSE stream for real-time updates |
| `/api/v2/fixer` | POST | Fix errors in project |
| `/api/v2/research` | POST | Research mode |

### Quick Build
| Route | Purpose |
|-------|---------|
| `/api/simple-build` | Quick single-agent build |

### Data APIs
| Route | Purpose |
|-------|---------|
| `/api/learnings/*` | Learning/memory CRUD |
| `/api/design-systems/*` | Design system CRUD |
| `/api/projects/*` | Project management |
| `/api/preview/*` | Dev server preview |

## Common Operations

### Add a new page
1. Create `app/[route]/page.tsx`
2. Add `'use client'` if interactive
3. Import from `@/components` or `@/features`

### Add a new API route
1. Create `app/api/[route]/route.ts`
2. Export `GET`, `POST`, etc. functions
3. For SSE: Return `ReadableStream` with `text/event-stream` content-type

### Connect to SSE stream
```typescript
useEffect(() => {
  const es = new EventSource(`/api/v2/stream?projectId=${id}`);
  es.addEventListener('agent:message', (e) => {
    const data = JSON.parse(e.data);
    // handle event
  });
  return () => es.close(); // IMPORTANT: cleanup!
}, [id]);
```

## Gotchas & Warnings

1. **SSE cleanup required** - Always close EventSource in useEffect cleanup
2. **Client components need 'use client'** - Or you get hydration errors
3. **Large page files** - Use `features/*/components/` for feature components

## State Management

| Page | State Location |
|------|----------------|
| Build | `features/build/hooks/` + `features/build/stores/` |
| Quick Build | `features/quick-build/hooks/` |
| Settings | Form state + `data/` persistence |
| Projects | Server fetch + client cache |

## Data Flow

```
User Action → Page Component → API Route → Service → multi-agent-service
                    ↑                           ↓
                    └──── SSE Stream ←──────────┘
```

## Related Code

- **Components**: `components/` for shared, `features/*/components/` for feature-specific
- **Hooks**: `features/*/hooks/` for feature hooks
- **Types**: `features/*/types.ts` or `lib/*/types.ts`
- **Data**: `data/` directory for JSON persistence
