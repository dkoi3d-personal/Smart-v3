# Shared Agent Memory / Hive Mind Architecture

Generated: 2024-12-15

## Overview

This document outlines how to implement shared context and memory between agents using MCP, vector databases, and other tools.

---

## Current State

### What You Already Have

| Component | Location | Status |
|-----------|----------|--------|
| MCP Config | `.mcp.json` | 9 servers configured |
| Fleet Context MCP | `lib/fleet/mcp-servers/fleet-context-server.ts` | 531 LOC, 7 tools |
| Agent Context Registry | `lib/fleet/agent-context-registry.ts` | Tracks decisions, contracts |
| Session Service | `services/session-service.ts` | In-memory + file persistence |

### Current MCP Servers Configured

1. **serena** - Semantic code understanding
2. **cipher** - Memory layer for reasoning traces
3. **memory** - Knowledge graph-based persistent memory
4. **eslint** - Code linting
5. **git** - Repository operations
6. **github** - GitHub integration
7. **filesystem** - Secure file operations
8. **fetch** - Web content fetching
9. **sequential-thinking** - Dynamic problem-solving
10. **fleet-context** - Custom fleet context sharing

### Current Gaps

1. **No Vector Storage** - Context passed as raw text, not embeddings
2. **No Semantic Search** - Can't find "relevant" past context
3. **File-Based = Slow** - Every context lookup hits disk
4. **No Cross-Session Memory** - Agents forget between runs
5. **Context Truncation** - Only last 200 chars of task results kept

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AGENT HIVE MIND ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │ Coder A  │  │ Coder B  │  │ Tester   │  │ Security │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │             │             │             │                    │
│       └─────────────┼─────────────┼─────────────┘                    │
│                     │             │                                  │
│              ┌──────▼─────────────▼──────┐                          │
│              │   MEMORY ORCHESTRATOR      │                          │
│              │   (New Service Layer)      │                          │
│              └──────┬─────────────┬───────┘                          │
│                     │             │                                  │
│         ┌───────────┴──┐    ┌────┴────────────┐                     │
│         │              │    │                  │                     │
│    ┌────▼────┐   ┌─────▼────▼─┐   ┌───────────▼───────────┐        │
│    │ SHORT   │   │   LONG     │   │      SHARED           │        │
│    │ TERM    │   │   TERM     │   │      KNOWLEDGE        │        │
│    │ MEMORY  │   │   MEMORY   │   │      GRAPH            │        │
│    ├─────────┤   ├────────────┤   ├───────────────────────┤        │
│    │ Redis   │   │ Vector DB  │   │ Neo4j / PostgreSQL    │        │
│    │ (Hot)   │   │ (Qdrant/   │   │ (Entities, Relations, │        │
│    │         │   │  Pinecone) │   │  Decisions, Contracts)│        │
│    └─────────┘   └────────────┘   └───────────────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Short-Term Memory (Redis)

**Purpose**: Hot context for active agents (sub-millisecond access)

### Installation
```bash
npm install ioredis
```

### Implementation

```typescript
// services/memory/short-term-memory.ts
import Redis from 'ioredis';

interface AgentContext {
  agentId: string;
  sessionId: string;
  currentTask: string;
  recentDecisions: string[];
  filesMutated: string[];
  lastUpdated: number;
}

export class ShortTermMemory {
  private redis: Redis;
  private TTL_SECONDS = 3600; // 1 hour

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  async setAgentContext(agentId: string, context: AgentContext): Promise<void> {
    const key = `agent:${agentId}:context`;
    await this.redis.setex(key, this.TTL_SECONDS, JSON.stringify(context));
    await this.redis.sadd('active_agents', agentId);
  }

  async getAgentContext(agentId: string): Promise<AgentContext | null> {
    const data = await this.redis.get(`agent:${agentId}:context`);
    return data ? JSON.parse(data) : null;
  }

  async broadcastUpdate(channel: string, message: object): Promise<void> {
    await this.redis.publish(channel, JSON.stringify(message));
  }

  subscribeToUpdates(channel: string, callback: (msg: object) => void): void {
    const subscriber = this.redis.duplicate();
    subscriber.subscribe(channel);
    subscriber.on('message', (ch, msg) => {
      if (ch === channel) callback(JSON.parse(msg));
    });
  }

  async getAllActiveContexts(): Promise<AgentContext[]> {
    const agentIds = await this.redis.smembers('active_agents');
    const contexts = await Promise.all(
      agentIds.map(id => this.getAgentContext(id))
    );
    return contexts.filter((c): c is AgentContext => c !== null);
  }

  async appendToScratchpad(key: string, note: string, agentId: string): Promise<void> {
    const entry = JSON.stringify({ agentId, note, timestamp: Date.now() });
    await this.redis.rpush(`scratchpad:${key}`, entry);
    await this.redis.expire(`scratchpad:${key}`, this.TTL_SECONDS);
  }

  async getScratchpad(key: string): Promise<Array<{agentId: string; note: string; timestamp: number}>> {
    const entries = await this.redis.lrange(`scratchpad:${key}`, 0, -1);
    return entries.map(e => JSON.parse(e));
  }
}
```

---

## Layer 2: Long-Term Memory (Vector Database)

**Purpose**: Semantic search over past agent experiences

### Options

| Database | Hosting | Cost | Best For |
|----------|---------|------|----------|
| Qdrant | Self-host or Cloud | Free tier available | Full control |
| Pinecone | Cloud only | Pay per use | Quick start |
| Weaviate | Self-host or Cloud | Free tier | GraphQL queries |
| ChromaDB | Self-host | Free | Local dev |

### Installation (Qdrant)
```bash
npm install @qdrant/js-client-rest
# For embeddings:
npm install @voyageai/voyage-js  # or openai
```

### Implementation

```typescript
// services/memory/long-term-memory.ts
import { QdrantClient } from '@qdrant/js-client-rest';

interface MemoryEntry {
  id: string;
  agentId: string;
  sessionId: string;
  type: 'decision' | 'insight' | 'error' | 'solution' | 'pattern';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: number;
}

export class LongTermMemory {
  private qdrant: QdrantClient;
  private collectionName = 'agent_memories';

  constructor(qdrantUrl: string) {
    this.qdrant = new QdrantClient({ url: qdrantUrl });
  }

  async initialize(): Promise<void> {
    const collections = await this.qdrant.getCollections();
    const exists = collections.collections.some(c => c.name === this.collectionName);

    if (!exists) {
      await this.qdrant.createCollection(this.collectionName, {
        vectors: { size: 1024, distance: 'Cosine' }, // voyage-3 dimension
      });
    }
  }

  private async embed(text: string): Promise<number[]> {
    // Use Voyage AI for embeddings (best for code)
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'voyage-3', input: text }),
    });
    const data = await response.json();
    return data.data[0].embedding;
  }

  async storeMemory(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    const id = crypto.randomUUID();
    const embedding = await this.embed(entry.content);

    await this.qdrant.upsert(this.collectionName, {
      points: [{ id, vector: embedding, payload: { ...entry, id } }],
    });

    return id;
  }

  async searchMemories(
    query: string,
    filters?: { agentId?: string; type?: string },
    limit = 10
  ): Promise<MemoryEntry[]> {
    const queryEmbedding = await this.embed(query);

    const filterConditions: any[] = [];
    if (filters?.agentId) {
      filterConditions.push({ key: 'agentId', match: { value: filters.agentId } });
    }
    if (filters?.type) {
      filterConditions.push({ key: 'type', match: { value: filters.type } });
    }

    const results = await this.qdrant.search(this.collectionName, {
      vector: queryEmbedding,
      limit,
      filter: filterConditions.length > 0 ? { must: filterConditions } : undefined,
    });

    return results.map(r => r.payload as unknown as MemoryEntry);
  }
}
```

---

## Layer 3: Knowledge Graph (PostgreSQL)

**Purpose**: Track entities, decisions, and relationships

### Schema

```sql
CREATE TABLE entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type VARCHAR(50) NOT NULL,  -- 'file', 'function', 'component', 'api', 'decision'
  name VARCHAR(500) NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  to_id UUID REFERENCES entities(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,  -- 'modifies', 'depends_on', 'created_by', 'conflicts_with'
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE agent_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id VARCHAR(100) NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  decision_type VARCHAR(50) NOT NULL,
  description TEXT NOT NULL,
  rationale TEXT,
  affected_entities UUID[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_relations_from ON relations(from_id);
CREATE INDEX idx_decisions_agent ON agent_decisions(agent_id);
```

---

## Layer 4: Memory Orchestrator

**Purpose**: Unified interface combining all memory layers

```typescript
// services/memory/memory-orchestrator.ts
import { ShortTermMemory } from './short-term-memory';
import { LongTermMemory } from './long-term-memory';
import { KnowledgeGraph } from './knowledge-graph';

interface ContextRequest {
  agentId: string;
  sessionId: string;
  currentTask: string;
  query?: string;
}

interface AgentContextBundle {
  activeAgents: Array<{agentId: string; currentTask: string; filesMutated: string[]}>;
  scratchpadNotes: Array<{agentId: string; note: string}>;
  relevantMemories: Array<{content: string; type: string; similarity: number}>;
  recentDecisions: Array<{agentId: string; description: string; rationale: string}>;
  potentialConflicts: Array<{entityName: string; conflictingAgents: string[]}>;
}

export class MemoryOrchestrator {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private graph: KnowledgeGraph;

  async getContextForAgent(request: ContextRequest): Promise<AgentContextBundle> {
    const [activeContexts, scratchpad, relevantMemories, decisions, conflicts] =
      await Promise.all([
        this.shortTerm.getAllActiveContexts(),
        this.shortTerm.getScratchpad(request.sessionId),
        request.query
          ? this.longTerm.searchMemories(request.query, {}, 5)
          : Promise.resolve([]),
        this.graph.getDecisionHistory(request.sessionId, 10),
        this.graph.findConflicts(request.sessionId),
      ]);

    return {
      activeAgents: activeContexts
        .filter(c => c.agentId !== request.agentId)
        .map(c => ({
          agentId: c.agentId,
          currentTask: c.currentTask,
          filesMutated: c.filesMutated,
        })),
      scratchpadNotes: scratchpad,
      relevantMemories: relevantMemories.map(m => ({
        content: m.content,
        type: m.type,
        similarity: 0.9,
      })),
      recentDecisions: decisions,
      potentialConflicts: conflicts.map(c => ({
        entityName: c.entity.name,
        conflictingAgents: c.agents,
      })),
    };
  }

  formatContextForPrompt(bundle: AgentContextBundle): string {
    const sections: string[] = [];

    if (bundle.activeAgents.length > 0) {
      sections.push(`## Other Active Agents
${bundle.activeAgents.map(a =>
  `- **${a.agentId}**: Working on "${a.currentTask}" (modified: ${a.filesMutated.join(', ')})`
).join('\n')}`);
    }

    if (bundle.potentialConflicts.length > 0) {
      sections.push(`## Potential Conflicts
${bundle.potentialConflicts.map(c =>
  `- **${c.entityName}** is being modified by: ${c.conflictingAgents.join(', ')}`
).join('\n')}`);
    }

    if (bundle.recentDecisions.length > 0) {
      sections.push(`## Recent Team Decisions
${bundle.recentDecisions.slice(0, 5).map(d =>
  `- [${d.agentId}] ${d.description}`
).join('\n')}`);
    }

    if (bundle.relevantMemories.length > 0) {
      sections.push(`## Relevant Past Experience
${bundle.relevantMemories.map(m =>
  `- [${m.type}] ${m.content}`
).join('\n')}`);
    }

    return sections.join('\n\n');
  }
}
```

---

## MCP Server: Hive Memory

Add to `.mcp.json`:

```json
{
  "mcpServers": {
    "hive-memory": {
      "command": "npx",
      "args": ["ts-node", "lib/fleet/mcp-servers/hive-memory-server.ts"],
      "env": {
        "REDIS_URL": "redis://localhost:6379",
        "QDRANT_URL": "http://localhost:6333",
        "POSTGRES_URL": "postgresql://localhost:5432/hive_memory",
        "VOYAGE_API_KEY": "${VOYAGE_API_KEY}"
      }
    }
  }
}
```

### MCP Tools to Implement

| Tool | Description |
|------|-------------|
| `hive_get_context` | Get shared context from hive mind |
| `hive_share_insight` | Share learning with other agents |
| `hive_record_decision` | Record architectural decision |
| `hive_add_note` | Quick note to shared scratchpad |
| `hive_check_conflicts` | Check if files are being modified by others |

---

## Quick Start Options

### Option A: Mem0 (Fastest)
```bash
npm install mem0ai
```

```typescript
import { Memory } from 'mem0ai';

const memory = new Memory({ apiKey: process.env.MEM0_API_KEY });

// Store
await memory.add({
  messages: [{ role: 'assistant', content: 'Used singleton pattern' }],
  user_id: 'coder-agent-1',
});

// Retrieve
const memories = await memory.search({
  query: 'database patterns',
  user_id: 'coder-agent-1',
});
```

### Option B: LlamaIndex Memory
```typescript
import { VectorStoreIndex } from 'llamaindex';

const index = await VectorStoreIndex.fromDocuments(documents);
const queryEngine = index.asQueryEngine();
const response = await queryEngine.query('What patterns did we use?');
```

---

## Comparison Table

| Approach | Complexity | Time | Scalability | Best For |
|----------|-----------|------|-------------|----------|
| Custom (Redis + Qdrant + PG) | High | 2-3 weeks | Excellent | Production |
| Mem0 | Low | 1-2 days | Good | Quick MVP |
| LlamaIndex Memory | Medium | 1 week | Good | RAG-heavy |
| Extend Fleet MCP | Medium | 1 week | Medium | Build on existing |

---

## Implementation Order

### Phase 1: Immediate (This week)
- [ ] Add Redis for short-term agent coordination
- [ ] Extend `fleet-context-server.ts` with scratchpad pattern

### Phase 2: Short-term (2-3 weeks)
- [ ] Add Qdrant for vector memory
- [ ] Implement semantic search for past experiences

### Phase 3: Medium-term (1-2 months)
- [ ] Add PostgreSQL knowledge graph
- [ ] Build full Memory Orchestrator

### Phase 4: Experimental
- [ ] Quantum-inspired similarity search on embeddings
- [ ] Cross-project memory sharing

---

## Environment Variables Needed

```env
# Redis
REDIS_URL=redis://localhost:6379

# Vector Database (choose one)
QDRANT_URL=http://localhost:6333
PINECONE_API_KEY=your-key
PINECONE_ENVIRONMENT=us-east-1

# Embeddings
VOYAGE_API_KEY=your-key
# or
OPENAI_API_KEY=your-key

# Knowledge Graph
POSTGRES_URL=postgresql://localhost:5432/hive_memory

# Optional: Mem0
MEM0_API_KEY=your-key
```

---

## References

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Agent-MCP Framework](https://github.com/rinadelph/Agent-MCP)
- [LlamaIndex Memory](https://docs.llamaindex.ai/en/stable/module_guides/deploying/agents/memory/)
- [Mem0 Documentation](https://docs.mem0.ai/)
- [Qdrant Documentation](https://qdrant.tech/documentation/)
