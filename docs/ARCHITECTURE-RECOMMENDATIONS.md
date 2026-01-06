# Architecture Refactoring Recommendations

Generated: 2024-12-15

## Executive Summary

**Overall Score: 4.6/10** - Proto-stage product, needs refactoring before production

### Scale Metrics
- Total TypeScript Code: 72,849 LOC
- API Routes: 105 endpoints
- Services: 23 files
- Fleet System: 80+ files
- Test Coverage: ~2%

---

## Critical Issues (Fix First)

### 1. File-Based Persistence (CRITICAL)
**Problem**: No database - everything is JSON files with `proper-lockfile`
- Location: `services/project-persistence.ts`
- Impact: Breaks at ~500 stories, 1000 file reads for large projects

**Fix**: Add PostgreSQL or MongoDB
- Your Azure integration already has PostgreSQL Flexible Server support
- Estimated effort: 1-2 weeks

### 2. God Service Anti-Pattern (CRITICAL)
**Problem**: Monolithic services doing too much

| File | LOC | Issue |
|------|-----|-------|
| `services/multi-agent-service.ts` | 5,382 | Handles orchestration, streaming, events, metrics |
| `lib/agents/orchestrator.ts` | 3,087 | Overlaps with multi-agent-service |
| `lib/fleet/fleet-coordinator.ts` | 2,521 | Another orchestrator |

**Fix**: Extract into focused services:
- `AgentCoordinator` (orchestration only)
- `StreamHandler` (SSE/WebSocket)
- `MetricsCollector`
- `AgentFactory`

### 3. API Route Explosion (HIGH)
**Problem**: 105 routes with unclear hierarchy
```
/api/v2/multi-agent/
/api/workflow/
/api/fleet/
```
Three different ways to do similar things.

**Fix**: Consolidate to single versioned API, pick one orchestration path

### 4. No Authentication (HIGH)
**Problem**: All 105 API routes are completely unprotected

**Fix**: Add JWT auth middleware (you already have `jose` as dependency)

### 5. Minimal Testing (HIGH)
**Problem**: Only 2 test files found
- `mega-prompt-decomposer.test.ts`
- `worktree-manager.test.ts`

**Fix**: Target 60% coverage minimum for services

---

## Architectural Anti-Patterns Found

| Pattern | Severity | Location |
|---------|----------|----------|
| God Services | CRITICAL | multi-agent-service.ts |
| No Database | CRITICAL | project-persistence.ts |
| Global State | HIGH | `global.io`, `global.activeOrchestrators` in server.js |
| Duplicate Orchestrators | HIGH | AgentOrchestrator vs FleetCoordinator vs TaskOrchestrator |
| Magic Numbers | MEDIUM | Hardcoded timeouts scattered everywhere |
| Silent Failures | MEDIUM | Bare `catch {}` blocks |
| Console.log Logging | MEDIUM | No structured logging |

---

## What's Good (Keep These)

| Strength | Score |
|----------|-------|
| TypeScript Usage | 9/10 - Full strict mode, comprehensive types |
| Component Structure | 7/10 - React components well-organized |
| State Management | 7/10 - Zustand stores are clean |
| Multi-Cloud Support | 8/10 - AWS + Azure implemented |
| Healthcare Domain | 8/10 - Epic FHIR, HIPAA compliance |
| Real-time Updates | 7/10 - Socket.io streaming works |

---

## Priority Action Plan

### Phase 1: Stabilization (Week 1-2)
- [ ] Add PostgreSQL for project/story persistence
- [ ] Implement JWT auth middleware
- [ ] Consolidate API routes (pick v2 OR workflow, not both)
- [ ] Delete unused fleet files (or move to /experimental)
- [ ] Add request validation (zod schemas)

### Phase 2: Service Extraction (Week 3-4)
- [ ] Split multi-agent-service.ts into 4 focused services
- [ ] Create AgentInterface abstraction
- [ ] Centralize configuration (no more magic numbers)
- [ ] Add structured logging (Pino or Winston)
- [ ] Implement proper error types and handling

### Phase 3: Quality (Month 2)
- [ ] Add unit tests for services (target 60% coverage)
- [ ] Add API integration tests
- [ ] Add E2E tests for critical flows
- [ ] Generate OpenAPI spec for all routes
- [ ] Add monitoring/tracing

### Phase 4: Scale (Month 3+)
- [ ] Add Redis caching layer
- [ ] Implement job queue for async agent work
- [ ] Add agent context windowing/summarization
- [ ] Performance profiling and optimization
- [ ] Load testing

---

## Quick Wins (Do Today)

1. **Remove `global.*` usage** in server.js - use proper singleton pattern
2. **Add `.env` validation** at startup - fail fast on missing config
3. **Externalize prompts** - move hardcoded prompts to `/prompts/*.md` files
4. **Add health check endpoint** - `/api/health` returning system status
5. **Document the main entry point** - which API route should clients actually call?

---

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Auth Middleware → Rate Limiter → Validator         │    │
│  └─────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                    Service Layer (Thin)                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Project  │  │  Agent   │  │  Build   │  │  Deploy  │   │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
├───────┼─────────────┼─────────────┼─────────────┼──────────┤
│       │      Core Domain Layer    │             │          │
│  ┌────┴─────────────┴─────────────┴─────────────┴────┐    │
│  │              Agent Orchestrator                    │    │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ │    │
│  │  │ Planner │ │ Coder   │ │ Tester  │ │Security │ │    │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ │    │
│  └───────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────┤
│                   Infrastructure Layer                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │PostgreSQL│  │  Redis   │  │  Queue   │  │  S3/Blob │   │
│  │ (State)  │  │ (Cache)  │  │ (Jobs)   │  │ (Files)  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## File Locations Reference

| Component | File | LOC |
|-----------|------|-----|
| Main Orchestrator | `services/multi-agent-service.ts` | 5,382 |
| Task Orchestrator | `lib/agents/task-orchestrator.ts` | 703 |
| Session Service | `services/session-service.ts` | 353 |
| Parallel Coordinator | `services/parallel-agent-coordinator.ts` | 678 |
| Fleet Agent Bridge | `services/fleet-agent-bridge.ts` | 678 |
| Fleet Coordinator | `lib/fleet/fleet-coordinator.ts` | 2,521 |
| Agent Context Registry | `lib/fleet/agent-context-registry.ts` | - |
| MCP Config | `.mcp.json` | 72 |
| WebSocket Events | `lib/websocket/events.ts` | 119 |
| Stream Endpoint | `app/api/v2/stream/route.ts` | 261 |
