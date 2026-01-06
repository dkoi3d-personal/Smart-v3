# AI Dev Platform - Deployment Architecture Research

## Current State Analysis

Your application currently has **multiple Claude integration approaches**:

| Integration | File | How It Works | Requirement |
|-------------|------|--------------|-------------|
| **Anthropic Direct API** | `services/anthropic-api.ts` | Server-side API calls | `ANTHROPIC_API_KEY` env var |
| **Claude Code Service** | `services/claude-code-service.ts` | Streaming with tools | `ANTHROPIC_API_KEY` env var |
| **Claude Agent SDK** | `services/claude-agent-api.ts` | Official SDK package | `ANTHROPIC_API_KEY` env var |
| **Claude Subscription** | `services/claude-subscription-service.ts` | Spawns Claude CLI locally | User's Claude Code login |

The **Claude Subscription Service** is the problematic one for deployment - it spawns the Claude CLI as a subprocess, which requires the CLI to be installed and authenticated on the user's local machine.

---

## Deployment Architecture Options

### Option 1: BYOK (Bring Your Own Key) - Web App with User API Keys

**How it works**: Deploy the web app to the cloud, but each user provides their own Anthropic API key.

```
┌─────────────────────────────────────────────────────────────┐
│                    CLOUD DEPLOYMENT                         │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │   Next.js App   │────▶│  Anthropic API              │   │
│  │   (Your UI)     │     │  (Using USER's API Key)     │   │
│  └─────────────────┘     └─────────────────────────────┘   │
│           │                                                  │
│           │ User provides their API key                      │
│           ▼                                                  │
│  ┌─────────────────┐                                        │
│  │  User's Browser │                                        │
│  └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────┘
```

**Implementation**:
1. Add a settings page where users enter their Anthropic API key
2. Store keys securely (encrypted in database or browser localStorage)
3. Pass the user's key to API routes instead of server-side env var
4. Remove/disable the Claude Subscription service

**Pros**:
- Simple to implement
- Users pay their own API costs directly to Anthropic
- No rate limit sharing between users
- Works on any hosting platform (Vercel, Railway, Render)

**Cons**:
- Users need their own Anthropic API account ($5+ minimum)
- No access to Claude Code CLI features (MCP servers, slash commands)
- Must manage key security carefully

**Code Changes Required**:
```typescript
// New: services/user-api-service.ts
export async function callClaudeWithUserKey(
  userApiKey: string,
  messages: Message[],
  tools?: Tool[]
) {
  const client = new Anthropic({ apiKey: userApiKey });
  return client.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages,
    tools,
    max_tokens: 8192
  });
}
```

---

### Option 2: Containerized Agent Execution with Sandbox

**How it works**: Deploy the app with containerized Claude Agent SDK instances that run in isolated sandboxes.

```
┌──────────────────────────────────────────────────────────────────┐
│                       CLOUD INFRASTRUCTURE                        │
│                                                                   │
│  ┌─────────────┐      ┌────────────────────────────────────────┐ │
│  │  Next.js    │      │         Container Orchestrator          │ │
│  │  Frontend   │─────▶│  (Docker/Kubernetes/Cloud Run)          │ │
│  └─────────────┘      │                                         │ │
│                       │  ┌─────────┐ ┌─────────┐ ┌─────────┐   │ │
│                       │  │Container│ │Container│ │Container│   │ │
│                       │  │ User A  │ │ User B  │ │ User C  │   │ │
│                       │  │ (Agent) │ │ (Agent) │ │ (Agent) │   │ │
│                       │  └────┬────┘ └────┬────┘ └────┬────┘   │ │
│                       └───────┼───────────┼───────────┼────────┘ │
│                               │           │           │          │
│                               ▼           ▼           ▼          │
│                       ┌─────────────────────────────────────┐    │
│                       │         Anthropic API               │    │
│                       │   (Server API Key OR User BYOK)     │    │
│                       └─────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Recommended Sandbox Providers**:
- [Cloudflare Sandboxes](https://developers.cloudflare.com/sandbox/tutorials/claude-code/)
- [E2B (Code Interpreter)](https://e2b.dev/)
- [Modal](https://modal.com/)
- [Vercel Sandbox](https://vercel.com/kb/guide/using-vercel-sandbox-claude-agent-sdk)
- [Daytona](https://www.daytona.io/)

**Container Patterns** (from Anthropic docs):

| Pattern | Use Case | Lifecycle |
|---------|----------|-----------|
| **Ephemeral** | One-off tasks (bug fix, code gen) | Create → Execute → Destroy |
| **Long-Running** | Persistent agents, chatbots | Create → Keep alive → Periodic cleanup |
| **Hydrated** | Resume previous sessions | Create → Load state → Execute → Save state → Destroy |
| **Multi-Agent** | Agent collaboration | Single container, multiple SDK processes |

**Resource Requirements** (per container):
- RAM: 1 GiB minimum
- Disk: 5 GiB
- CPU: 1 core
- Network: Outbound HTTPS to `api.anthropic.com`

**Cost**: ~$0.05/hour per running container + API token costs

**Pros**:
- Full Claude Agent SDK capabilities
- Isolated execution per user (security)
- Can run bash commands, file operations safely
- Supports MCP servers

**Cons**:
- Complex infrastructure
- Higher operational cost
- Container orchestration overhead
- Cold start latency

---

### Option 3: Hybrid Local + Cloud Architecture

**How it works**: Deploy the web UI to the cloud, but users run a local agent that connects to your cloud service.

```
┌──────────────────────────────────────────────────────────────────┐
│                         CLOUD                                     │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │                    Next.js App                           │     │
│  │  - Project management UI                                 │     │
│  │  - WebSocket server for real-time updates               │     │
│  │  - API for project state, file storage                  │     │
│  │  - User authentication                                   │     │
│  └───────────────────────────┬─────────────────────────────┘     │
└──────────────────────────────┼───────────────────────────────────┘
                               │ WebSocket / API
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                      USER'S LOCAL MACHINE                         │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              Local Agent (npm package / CLI)             │     │
│  │  - Claude Code CLI (user's subscription)                 │     │
│  │  - OR Claude Agent SDK (user's API key)                  │     │
│  │  - Executes code in user's environment                   │     │
│  │  - Reports progress to cloud via WebSocket               │     │
│  └─────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────┐          │
│  │              User's Project Directory               │          │
│  │  ~/coding/ai-projects/my-project/                   │          │
│  └────────────────────────────────────────────────────┘          │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation**:
1. Create a lightweight npm package: `@ai-dev-platform/agent`
2. User installs: `npm install -g @ai-dev-platform/agent`
3. User runs: `ai-dev-agent connect --project <project-id>`
4. Agent connects to your cloud via WebSocket
5. Cloud sends commands, agent executes locally with Claude

**Example Agent Package**:
```typescript
// @ai-dev-platform/agent
import { WebSocket } from 'ws';
import { spawn } from 'child_process';

class LocalAgent {
  private ws: WebSocket;

  async connect(serverUrl: string, projectId: string) {
    this.ws = new WebSocket(`${serverUrl}/api/ws`);

    this.ws.on('message', async (data) => {
      const command = JSON.parse(data.toString());

      if (command.type === 'execute') {
        // Run Claude CLI locally
        const result = await this.runClaudeCLI(command.prompt);
        this.ws.send(JSON.stringify({ type: 'result', data: result }));
      }
    });
  }

  private async runClaudeCLI(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', ['-p', prompt, '--output-format', 'json']);
      // ... handle output
    });
  }
}
```

**Pros**:
- Uses user's Claude Code subscription (no API costs)
- Full CLI capabilities (MCP, slash commands, file access)
- Projects stay on user's machine
- Cloud handles coordination/UI only

**Cons**:
- Users must install local agent
- Requires Claude Code CLI installed locally
- More complex onboarding
- Users need to keep terminal open

---

### Option 4: Desktop App (Electron/Tauri)

**How it works**: Package the entire app as a desktop application.

```
┌──────────────────────────────────────────────────────────────────┐
│                    USER'S DESKTOP APPLICATION                     │
│  ┌─────────────────────────────────────────────────────────┐     │
│  │              Electron / Tauri App                        │     │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │     │
│  │  │   Next.js UI    │  │     Node.js Backend          │   │     │
│  │  │   (Renderer)    │  │  - Claude Agent SDK          │   │     │
│  │  │                 │  │  - OR Claude CLI subprocess  │   │     │
│  │  │                 │  │  - File system access        │   │     │
│  │  └─────────────────┘  └─────────────────────────────┘   │     │
│  └─────────────────────────────────────────────────────────┘     │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────┐      │
│  │                 User's File System                      │      │
│  │                 + Claude CLI / API Key                  │      │
│  └────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────┘
```

**Pros**:
- Full local access (Claude CLI, file system)
- No cloud infrastructure needed
- Works offline (except for Claude API calls)
- Single download, self-contained

**Cons**:
- Must maintain desktop builds (Windows, Mac, Linux)
- Larger download size
- Update distribution complexity
- No collaboration features without cloud backend

---

## Recommended Architecture for Your Use Case

Based on your current codebase, I recommend **Option 3: Hybrid Local + Cloud** because:

1. **Preserves Claude Subscription functionality** - Users can use their Claude Code login
2. **Minimal code changes** - Your WebSocket infrastructure already exists
3. **Best of both worlds** - Cloud UI + local execution
4. **No container orchestration** - Simpler ops

### Implementation Plan

**Phase 1: Refactor for Remote Execution**
1. Move project file storage to cloud (S3 or database)
2. Abstract execution layer to support local + remote
3. Create WebSocket protocol for command dispatch

**Phase 2: Create Local Agent Package**
```
packages/
└── agent/
    ├── package.json
    ├── src/
    │   ├── index.ts        # CLI entry point
    │   ├── connection.ts   # WebSocket to cloud
    │   ├── executor.ts     # Claude CLI / SDK wrapper
    │   └── watcher.ts      # File change reporter
    └── README.md
```

**Phase 3: Update Cloud App**
1. Add project sync endpoints
2. Modify WebSocket to dispatch to connected agents
3. Add agent connection status UI
4. Handle reconnection/offline scenarios

**Phase 4: Fallback to BYOK**
1. If no local agent connected, offer BYOK mode
2. User enters API key → server-side execution
3. Graceful degradation

---

## Quick Comparison Matrix

| Feature | BYOK | Container | Hybrid | Desktop |
|---------|------|-----------|--------|---------|
| **Deployment Complexity** | Low | High | Medium | Medium |
| **Claude CLI Features** | No | Yes | Yes | Yes |
| **User Subscription** | No | No | Yes | Yes |
| **Infrastructure Cost** | Low | High | Low | None |
| **User Onboarding** | Easy | Easy | Medium | Easy |
| **File System Access** | No | Sandboxed | Full | Full |
| **MCP Servers** | No | Yes | Yes | Yes |
| **Offline Capable** | No | No | Partial | Partial |

---

## Security Considerations

### For BYOK:
- Never store API keys in plaintext
- Use encryption at rest
- Implement key rotation reminders
- Validate keys before storing

### For Containers:
- Use ephemeral filesystems
- Network isolation
- Resource limits (prevent DoS)
- Regular security patches

### For Hybrid:
- Authenticate WebSocket connections
- Sign commands to prevent tampering
- Rate limit execution requests
- Audit logging

---

## Resources

- [Claude Agent SDK Hosting Docs](https://platform.claude.com/docs/en/agent-sdk/hosting)
- [Claude Code Sandboxing](https://www.anthropic.com/engineering/claude-code-sandboxing)
- [Cloudflare Sandbox for Claude Code](https://developers.cloudflare.com/sandbox/tutorials/claude-code/)
- [Docker Claude Code Setup](https://docs.docker.com/ai/sandboxes/claude-code/)
- [claude-agent-sdk-container (GitHub)](https://github.com/receipting/claude-agent-sdk-container)
- [AgCluster Container (Multi-Agent)](https://github.com/whiteboardmonk/agcluster-container)

---

## Next Steps

1. **Decide on primary architecture** (recommend Hybrid)
2. **Prototype local agent package** (2-3 days)
3. **Refactor cloud app** for remote execution dispatch
4. **Add BYOK fallback** for users without local agent
5. **Test deployment** on Railway/Render/Vercel
