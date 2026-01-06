# Multi-Agent Service Refactoring Plan

## Current State (Updated Dec 2024)
- `multi-agent-service.ts`: **4,107 lines** (down from 6,089 - 1,982 lines removed!)
- `agents/configs/prompts.ts`: 1,233 lines (prompts for each role)
- `agents/context/templates.ts`: 148 lines (NEW - extracted context templates)
- `agents/context/types.ts`: 101 lines (NEW - context builder types)
- `agents/tool-handlers.ts`: 1,454 lines (tool handlers)
- `agents/configs/tools.ts`: 507 lines (tool definitions)

## Problems Identified

### 1. Dead Code (~1,670 lines)
**Location**: `multi-agent-service.ts` lines 808-2485
**Issue**: Giant switch statement in `executeTool()` that is NEVER called because:
- `hasToolHandler()` check at line 793 always succeeds
- All tools are registered in `tool-handlers.ts`
- Even if it wasn't, `executeTool()` itself is never called anywhere

**Fix**: Remove the entire switch statement, keep just the fallback return.

### 2. Duplicate Prompts
Prompts are defined in multiple places:
- `agents/configs/prompts.ts` - base systemPrompt for each role
- `multi-agent-service.ts` - WORKFLOW sections added to fullPrompt
- `multi-agent-service.ts` - getFreshContext() generates dynamic prompts
- `multi-agent-service.ts` - testerContext, securityContext, etc.

**Fix**: Create a unified prompt system:
```
services/agents/prompts/
├── base/           # Base prompts per role
│   ├── coder.ts
│   ├── tester.ts
│   └── ...
├── workflows/      # Workflow templates
│   ├── coder-workflow.ts
│   └── tester-workflow.ts
├── context/        # Dynamic context builders
│   ├── fresh-context.ts
│   └── story-context.ts
└── index.ts        # Prompt builder that combines them
```

### 3. Context Building Logic
**Location**: `multi-agent-service.ts` lines 4258-4490 (getFreshContext)
**Issue**: 230+ lines of prompt building logic embedded in the main service

**Fix**: Extract to `services/agents/context-builder.ts`

### 4. Tool Handler System
**Current**: Tools defined in tools.ts but handlers never called
**Issue**: The whole tool system is unused - Claude CLI uses built-in tools

**Options**:
A. Remove the tool system entirely (it's not used)
B. Actually connect it via MCP or subprocess communication

**Recommendation**: Option A - remove dead code, keep prompts file-based

## Refactoring Steps

### Phase 1: Safe Cleanup (Do First) ✅ COMPLETE
1. [x] Remove dead switch statement in executeTool() (~1,601 lines removed)
2. [x] Added registry check at top of executeTool()
3. [x] Build verified passing

### Phase 2: Extract Prompts ✅ PARTIAL
1. [x] Created `services/agents/context/` directory structure
2. [ ] Move base prompts from `prompts.ts` (already in separate file)
3. [x] Extract WORKFLOW templates → `agents/context/templates.ts`
4. [x] Extract static context templates (FILE_HYGIENE, SECURITY, TESTER)
5. [x] Update multi-agent-service.ts to use imported templates

### Phase 3: Extract Context Building ✅ PARTIAL
1. [ ] Extract getFreshContext() to `context-builder.ts` (complex - tightly coupled to session state)
2. [x] Extract testerContext, securityContext static parts → templates.ts
3. [x] Create clean interfaces for context generation → `agents/context/types.ts`

### Phase 4: Tool System Decision
1. [ ] Decide: keep or remove tool-handlers.ts
2. [ ] If removing: delete tools.ts, tool-handlers.ts
3. [ ] If keeping: actually wire it up to Claude somehow

## Expected Results
After Phase 1-3 (CURRENT STATE):
- `multi-agent-service.ts`: **4,107 lines** (down from 6,089 - 1,982 lines removed! 32.5% reduction)
- Context templates extracted to `agents/context/templates.ts` (148 lines)
- Type definitions extracted to `agents/context/types.ts` (101 lines)
- Static context strings now use imported templates

After full extraction (future):
- `multi-agent-service.ts`: ~3,500 lines (if getFreshContext is extracted)
- Prompts in organized directory structure
- Context building fully modular
- Easier to maintain and debug

## Notes
- The switch statement removal is safe because `executeTool()` is never called
- All tool handling happens via Claude CLI's built-in tools
- Agents update `.agile-stories.json` directly (not through our tool handlers)
