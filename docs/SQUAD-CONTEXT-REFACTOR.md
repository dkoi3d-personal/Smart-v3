# Squad Context Refactor - Simplified Design

## Problem Summary

1. Stories are assigned to wrong squads via fragile keyword scoring
2. Context injection happens in multiple places inconsistently
3. FleetAgentBridge doesn't inject squad context at all
4. Security stories end up with backend agents who lack OWASP knowledge

## Proposed Solution

### Core Principle: **Tag at Decomposition, Merge Context at Execution**

```
┌─────────────────────────────────────────────────────────────────┐
│ DECOMPOSITION (mega-prompt-decomposer.ts)                       │
│                                                                 │
│  story = {                                                      │
│    id: 'AUTH-001',                                             │
│    title: 'Implement OAuth2 with JWT',                          │
│    squads: ['security', 'backend'],  // ← MULTIPLE allowed      │
│    primarySquad: 'security',         // ← For assignment        │
│    securityCritical: true,           // ← Force security review │
│    tags: ['auth', 'jwt', 'oauth'],                              │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ CONTEXT BUILDER (NEW: lib/fleet/squad-context-builder.ts)       │
│                                                                 │
│  buildContext(story) {                                          │
│    contexts = []                                                │
│    for (squad of story.squads) {                                │
│      contexts.push(SQUAD_TEMPLATES[squad].rolePrompts.coder)    │
│    }                                                            │
│    if (story.securityCritical) {                                │
│      contexts.push(SECURITY_CRITICAL_PROMPT)                    │
│    }                                                            │
│    return mergeContexts(contexts)                               │
│  }                                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ SINGLE INJECTION POINT (prompt-builder.ts)                      │
│                                                                 │
│  Both WaveExecutor AND FleetAgentBridge call:                   │
│    squadContext = buildSquadContext(story)                      │
│    prompt = basePrompt + squadContext + storyDetails            │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Story Type Changes

```typescript
// In lib/fleet/mega-prompt-decomposer.ts

export interface Story {
  id: string;
  title: string;
  // ... existing fields ...

  // NEW: Explicit squad assignment (replaces squadId)
  squads: SquadSpecialization[];     // All relevant squads
  primarySquad: SquadSpecialization; // Main squad for assignment

  // NEW: Security flag
  securityCritical?: boolean;        // Forces security context injection

  // KEEP: agent role
  agentRole?: 'coder' | 'tester' | 'data';
}
```

---

## 2. Squad Assignment at Decomposition

```typescript
// In lib/fleet/mega-prompt-decomposer.ts - new function

function assignSquads(story: Story): { squads: SquadSpecialization[], primary: SquadSpecialization } {
  const squads: SquadSpecialization[] = [];

  // Rule-based assignment (deterministic, not keyword scoring)
  const titleLower = story.title.toLowerCase();
  const tags = story.tags.map(t => t.toLowerCase());

  // SECURITY - check first, always include if matches
  if (hasSecurityIndicators(story)) {
    squads.push('security');
    story.securityCritical = true;
  }

  // UI/Frontend
  if (matchesAny(tags, ['ui', 'component', 'frontend', 'page', 'modal', 'form'])) {
    squads.push('ui');
  }

  // Backend
  if (matchesAny(tags, ['api', 'endpoint', 'server', 'service', 'route'])) {
    squads.push('backend');
  }

  // Data
  if (matchesAny(tags, ['database', 'schema', 'migration', 'model', 'query'])) {
    squads.push('data');
  }

  // Integrations
  if (matchesAny(tags, ['oauth', 'webhook', 'third-party', 'external', 'integration'])) {
    squads.push('integrations');
  }

  // DevOps
  if (matchesAny(tags, ['deploy', 'ci', 'docker', 'kubernetes', 'infrastructure'])) {
    squads.push('devops');
  }

  // Fallback
  if (squads.length === 0) {
    squads.push('fullstack');
  }

  // Primary = first match (priority order matters above)
  // But security always wins if present
  const primary = squads.includes('security') ? 'security' : squads[0];

  return { squads, primary };
}

function hasSecurityIndicators(story: Story): boolean {
  const text = `${story.title} ${story.description} ${story.tags.join(' ')}`.toLowerCase();

  // High-confidence security indicators
  const securityKeywords = [
    'security', 'auth', 'authentication', 'authorization', 'permission',
    'rbac', 'role-based', 'access control', 'encrypt', 'hash', 'password',
    'token', 'jwt', 'oauth', 'session', 'csrf', 'xss', 'injection',
    'vulnerability', 'audit', 'compliance', 'hipaa', 'gdpr', 'pci',
    'sanitize', 'validate input', '2fa', 'mfa', 'credential'
  ];

  return securityKeywords.some(kw => text.includes(kw));
}
```

---

## 3. New Context Builder

```typescript
// NEW FILE: lib/fleet/squad-context-builder.ts

import { SQUAD_TEMPLATES, SquadSpecialization } from './squad-specializations';
import { Story } from './mega-prompt-decomposer';

export interface SquadContext {
  squadInstructions: string;
  roleInstructions: string;
  complianceRequirements: string[];
  securityGuidance?: string;
}

const SECURITY_CRITICAL_PROMPT = `
## ⚠️ SECURITY-CRITICAL STORY

This story involves security-sensitive functionality. You MUST:

1. **Input Validation**: Validate and sanitize ALL user input
2. **Authentication**: Verify user identity before sensitive operations
3. **Authorization**: Check permissions for every protected resource
4. **Secrets**: NEVER log passwords, tokens, or API keys
5. **OWASP Top 10**: Consider injection, XSS, CSRF, broken auth
6. **Encryption**: Use TLS for transit, AES-256 for data at rest
7. **Audit Logging**: Log security-relevant events (login, permission changes)

If you're unsure about a security decision, err on the side of caution.
`;

export function buildSquadContext(
  story: Story,
  agentRole: 'coder' | 'tester' | 'data' = 'coder'
): SquadContext {
  const instructions: string[] = [];
  const compliance: string[] = [];

  // Merge context from ALL assigned squads
  for (const squadType of story.squads) {
    const template = SQUAD_TEMPLATES[squadType];
    if (!template) continue;

    // Add squad system prompt (condensed)
    instructions.push(`## ${template.name} Context\n${template.systemPrompt}`);

    // Add role-specific prompt
    const rolePrompt = template.rolePrompts[agentRole];
    if (rolePrompt) {
      instructions.push(rolePrompt);
    }

    // Collect compliance requirements
    if (squadType === 'security') {
      compliance.push('OWASP Top 10', 'Input Validation', 'Audit Logging');
    }
  }

  // Add security guidance if flagged
  let securityGuidance: string | undefined;
  if (story.securityCritical) {
    securityGuidance = SECURITY_CRITICAL_PROMPT;
  }

  return {
    squadInstructions: instructions.join('\n\n---\n\n'),
    roleInstructions: '', // Merged above
    complianceRequirements: compliance,
    securityGuidance,
  };
}

// Convenience function for prompt building
export function getSquadContextPrompt(story: Story, agentRole: 'coder' | 'tester' | 'data' = 'coder'): string {
  const ctx = buildSquadContext(story, agentRole);

  let prompt = ctx.squadInstructions;

  if (ctx.securityGuidance) {
    prompt = ctx.securityGuidance + '\n\n' + prompt;
  }

  if (ctx.complianceRequirements.length > 0) {
    prompt += `\n\n## Compliance Requirements\n- ${ctx.complianceRequirements.join('\n- ')}`;
  }

  return prompt;
}
```

---

## 4. Single Injection Point

```typescript
// In lib/fleet/prompt-builder.ts - modify buildStoryPrompt()

import { getSquadContextPrompt } from './squad-context-builder';

export function buildStoryPrompt(story: Story, options?: PromptOptions): string {
  const parts: string[] = [];

  // 1. Squad context (NEW - always included)
  const squadContext = getSquadContextPrompt(story, story.agentRole || 'coder');
  if (squadContext) {
    parts.push(squadContext);
  }

  // 2. Business domain context (existing)
  if (options?.businessDomain) {
    parts.push(getBusinessDomainPrompt(options.businessDomain));
  }

  // 3. Design system (existing - for UI stories)
  if (story.squads.includes('ui') && options?.designSystem) {
    parts.push(options.designSystem);
  }

  // 4. Story details (existing)
  parts.push(`# Story: ${story.title}\n\n${story.description}`);

  if (story.acceptanceCriteria?.length) {
    parts.push(`## Acceptance Criteria\n${story.acceptanceCriteria.map(c => `- ${c}`).join('\n')}`);
  }

  return parts.join('\n\n---\n\n');
}
```

---

## 5. Wire Up Both Execution Paths

### Wave Executor (already close)

```typescript
// In lib/fleet/wave-executor.ts - executeStory()

private async executeStory(story: Story, waveId: number): Promise<StoryResult> {
  // Use the centralized prompt builder
  const prompt = buildStoryPrompt(story, {
    businessDomain: this.businessDomain,
    designSystem: this.designSystemPrompt,
  });

  // Execute with full context
  return this.agentRunner.execute(prompt);
}
```

### Fleet Agent Bridge (needs update)

```typescript
// In services/fleet-agent-bridge.ts - buildStoryPrompt()

private buildStoryPrompt(story: Story, contextPrompt?: string): string {
  // Use the SAME centralized prompt builder
  return buildStoryPrompt(story, {
    businessDomain: this.businessDomain,
    designSystem: this.designSystemPrompt,
    additionalContext: contextPrompt,
  });
}
```

---

## 6. Migration Path

### Phase 1: Add new fields (backwards compatible)
1. Add `squads`, `primarySquad`, `securityCritical` to Story type
2. Create `squad-context-builder.ts`
3. Update `mega-prompt-decomposer.ts` to populate new fields

### Phase 2: Wire up context builder
1. Update `prompt-builder.ts` to use `getSquadContextPrompt()`
2. Update `wave-executor.ts` to use centralized builder
3. Update `fleet-agent-bridge.ts` to use centralized builder

### Phase 3: Remove old code
1. Delete scoring logic in `squad-assignment-service.ts`
2. Remove duplicate logic in `wave-squad-manager.ts`
3. Clean up deprecated squad code in `squad-decomposer.ts`

---

## Example: Before vs After

### Before (broken)
```
Story: "Implement JWT authentication with refresh tokens"

1. squad-assignment-service scores:
   - security: 15 (has "authentication")
   - backend: 30 (has "jwt", "token", "implement")

2. Assigned to: backend squad ❌

3. Context injected: Backend API patterns
   Missing: OWASP, token security, encryption guidance

4. Result: Insecure implementation
```

### After (fixed)
```
Story: "Implement JWT authentication with refresh tokens"

1. assignSquads() detects:
   - "authentication" → security indicator
   - "jwt", "token" → security indicators

2. Assigned squads: ['security', 'backend']
   Primary: security
   securityCritical: true

3. Context injected:
   - SECURITY-CRITICAL warning
   - Security squad rolePrompts (OWASP, encryption)
   - Backend squad rolePrompts (API design)
   - Compliance: OWASP Top 10, Input Validation

4. Result: Secure implementation with proper auth patterns
```

---

## Files to Change

| File | Changes |
|------|---------|
| `lib/fleet/mega-prompt-decomposer.ts` | Add squads/primarySquad fields, assignSquads() function |
| `lib/fleet/squad-context-builder.ts` | NEW FILE - centralized context building |
| `lib/fleet/prompt-builder.ts` | Use getSquadContextPrompt() |
| `lib/fleet/wave-executor.ts` | Use centralized prompt builder |
| `services/fleet-agent-bridge.ts` | Use centralized prompt builder |
| `lib/fleet/squad-assignment-service.ts` | DELETE or gut (no longer needed) |
| `lib/fleet/wave-squad-manager.ts` | Simplify - remove assignment logic |

---

## Benefits

1. **Deterministic assignment** - No fragile keyword scoring
2. **Multi-squad context** - Security + backend stories get BOTH contexts
3. **Single injection point** - Same context whether wave or worktree mode
4. **Security-first** - Security keywords always trigger security context
5. **Simpler code** - Remove 500+ lines of scoring/matching logic
6. **Testable** - Pure functions, easy to unit test
