# AI Development Platform

> Transform natural language requirements into production-ready applications with 7 AI agents working in real-time.

## What's Built

A complete full-stack platform that uses **your Claude Code subscription** (no API key required!) to orchestrate 7 AI agents that collaborate to build software:

- **Supervisor** - Orchestrates workflow & manages agents
- **Research** - Deep analysis of requirements
- **Product Owner** - Creates epics & user stories
- **Coder** - Implements features with clean code
- **Tester** - Writes & runs comprehensive tests
- **Security** - Scans for vulnerabilities (OWASP Top 10)
- **Infrastructure** - Handles AWS deployment

## Key Features

- **Multi-Agent Orchestration** - Uses Anthropic API for true concurrent agent execution
- **Real-time Dashboard** - 8-panel interface with live updates via WebSocket
- **7 Specialized AI Agents** - Complete development team working in parallel
- **Human-in-the-Loop** - Request clarifications & approvals
- **Full Visibility** - Watch all agents work simultaneously
- **Production Ready** - Real deployment, security scanning, testing
- **Quantum Computing Demos** - Interactive quantum circuit simulations

---

## Quick Start

### Prerequisites

- **Node.js 18+** installed
- **Claude Code CLI** installed and authenticated (see setup below)
- Git (for cloning)

### Step 1: Clone & Install

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/ai-dev-platform-v2.git
cd ai-dev-platform-v2

# Install dependencies
npm install
```

### Step 2: Start the App

```bash
npm run dev
```

### Step 3: Complete Setup

When you first open the app at http://localhost:3000, you'll be guided through the setup process:

1. **Claude CLI Check** - Verifies Claude Code CLI is installed
2. **Authentication Check** - Verifies you're logged in to Claude
3. **Continue to Dashboard** - Start building!

---

## Claude Code CLI Setup

The platform uses your Claude Code subscription (Pro or Max) instead of API credits.

### Install Claude Code CLI

```bash
npm install -g @anthropic-ai/claude-code
```

### Login to Claude

```bash
claude login
```

This opens a browser window to authenticate with your Claude account.

### Verify Installation

```bash
claude --version
```

You should see the version number if installed correctly.

---

## Optional: API Key Mode

If you prefer to use API credits instead of your subscription, create a `.env.local` file:

```bash
cp .env.example .env.local
```

Add your API key:

```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Get your API key from [Anthropic Console](https://console.anthropic.com/settings/keys).

---

## Dashboard Overview

The dashboard features an 8-panel grid layout:

```
┌─────────────────┬─────────────────────────────────┬─────────────────┐
│ Requirements    │         Kanban Board            │   Agent Chat    │
│   Input         │    (Drag-and-drop stories)      │  (Agent logs)   │
├─────────────────┼─────────────────┬───────────────┼─────────────────┤
│                 │                 │  Test Runner  │Security Scanner │
│ Code Editor     │ Code Editor     │  (Live tests) │(Vulnerabilities)│
│ (File tree)     │  (continued)    │               │                 │
├─────────────────┴─────────────────┼───────────────┴─────────────────┤
│        Live Preview                │      Deployment Status          │
│   (Docker container)               │    (AWS deployment steps)       │
└────────────────────────────────────┴──────────────────────────────────┘
```

---

## How to Use

### 1. Enter Requirements

In the Requirements Panel, describe what you want to build:

```
Build a todo list app with Next.js and TypeScript.
Users should be able to:
- Add new todos
- Mark todos as complete
- Delete todos
- Filter by status (all, active, completed)
```

### 2. Click "Analyze & Start"

The Supervisor agent will analyze and create a project plan.

### 3. Watch Agents Work

All 7 agents collaborate automatically in real-time.

---

## Build Modes

### Quick Build (2-3 minutes)
- Single agent execution
- Good for simple apps and prototypes
- Uses Claude Sonnet

### Complex Build (10+ minutes)
- Full 7-agent orchestration
- Enterprise-grade output
- Includes testing and security scanning

### UAT Testing
- Clone an existing Git repository
- Run automated testing
- Find and fix bugs

---

## Project Structure

```
ai-dev-platform-v2/
├── app/                    # Next.js pages & API routes
│   ├── api/                # Backend API endpoints
│   ├── dashboard/          # Main dashboard page
│   ├── quick-build/        # Quick build mode
│   ├── quantum/            # Quantum computing demos
│   ├── settings/           # Settings pages
│   ├── setup/              # First-time setup
│   └── uat/                # UAT testing mode
├── components/             # React components
│   ├── panels/             # 8 dashboard panels
│   └── ui/                 # shadcn/ui components
├── services/               # Backend services
│   ├── anthropic-api.ts    # Direct Anthropic API
│   ├── claude-subscription-service.ts  # CLI-based execution
│   └── aws-deployment.ts   # AWS infrastructure
├── lib/                    # Utilities
│   └── agents/             # Agent orchestration
├── stores/                 # Zustand state management
└── hooks/                  # React hooks
```

---

## Troubleshooting

### "Claude CLI not found"

Make sure Claude Code CLI is installed globally:

```bash
npm install -g @anthropic-ai/claude-code
```

### "Not authenticated"

Run the login command:

```bash
claude login
```

### "Using API credits instead of subscription"

Remove the `ANTHROPIC_API_KEY` from your environment:

```bash
# In .env.local, comment out or remove:
# ANTHROPIC_API_KEY=...
```

### Reset Setup

To re-run the setup verification:

1. Open browser console (F12)
2. Run: `localStorage.removeItem('ai-dev-platform-setup-complete')`
3. Refresh the page

---

## Architecture

This platform uses **multiple Claude integration methods**:

| Method | Use Case | Cost |
|--------|----------|------|
| **Claude Subscription Service** | UAT, CLI-based builds | Uses your Pro/Max subscription |
| **Anthropic Direct API** | Multi-agent orchestration | API credits |
| **Claude Agent SDK** | Advanced agent features | API credits |

For orchestrating multiple specialized agents, the direct API enables true concurrent execution.

---

## AWS Deployment (Optional)

To enable AWS deployment features, add to `.env.local`:

```
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_REGION=us-east-1
```

---

## License

MIT License

---

**Made with Claude Code and Anthropic's API**
