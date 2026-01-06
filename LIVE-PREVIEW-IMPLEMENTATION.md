# Live Preview Implementation Guide

## Overview

The AI Dev Platform now supports **real file writing** and **live preview** of generated applications! Agents can create actual files in project directories, and you can see the results instantly in the Live Preview panel.

## How It Works

### 1. Project Directory Creation

When you start a new workflow:
```
POST /api/workflow/start
  ↓
Creates directory: projects/{project-name}/
  ↓
All agent-generated files written here
```

**Example:**
- Project name: "my-todo-app"
- Directory: `C:\Users\srfit\coding\Coding-Platform\ai-dev-platform\projects\my-todo-app\`

### 2. Tool Execution (Agentic Loop)

The Anthropic API service now implements an **agentic loop** with 4 tools:

#### Available Tools:

1. **write_file** - Create/overwrite files
   ```typescript
   {
     path: "index.html",
     content: "<!DOCTYPE html>..."
   }
   ```

2. **read_file** - Read existing files
   ```typescript
   {
     path: "package.json"
   }
   ```

3. **edit_file** - Edit specific sections
   ```typescript
   {
     path: "src/App.tsx",
     old_content: "const App = () => {",
     new_content: "const App: React.FC = () => {"
   }
   ```

4. **run_bash** - Execute commands
   ```typescript
   {
     command: "npm install react"
   }
   ```

### 3. The Agentic Loop Flow

```
1. User submits requirements
   ↓
2. Supervisor analyzes → Plans approach
   ↓
3. Product Owner creates stories
   ↓
4. Coder agent invoked with tools:
   ├─ Claude API call with tools defined
   ├─ Claude responds: "I'll use write_file tool"
   ├─ Tool executed: File written to disk
   ├─ Tool result sent back to Claude
   ├─ Claude: "File created successfully"
   └─ Loop continues until task complete
   ↓
5. Files appear in Code Editor panel
   ↓
6. Live Preview automatically loads generated app
```

## Architecture Changes

### services/anthropic-api.ts

**Before (Single-turn API):**
```typescript
async invokeAgent(prompt) {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: prompt }]
  });
  return response.content; // Just text
}
```

**After (Agentic Loop with Tools):**
```typescript
async invokeAgent(options) {
  const tools = [write_file, read_file, edit_file, run_bash];

  while (iteration < maxTurns) {
    // Call Claude with tools
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      tools: tools,
      messages: conversationHistory
    });

    // Check for tool use
    if (response.content includes tool_use) {
      // Execute the tool
      const result = await executeTool(toolName, toolInput);

      // Send result back to Claude
      conversationHistory.push({
        role: 'user',
        content: [{ type: 'tool_result', content: result }]
      });

      // Continue loop
      continue;
    }

    // No tool use = done
    return finalResponse;
  }
}
```

### Key Implementation Details:

1. **Working Directory:** Passed to each agent
   ```typescript
   await anthropicService.invokeAgent({
     prompt: coderPrompt,
     workingDirectory: project.projectDirectory,
     allowedTools: ['write_file', 'edit_file', 'read_file', 'run_bash'],
     maxTurns: 100
   });
   ```

2. **Tool Filtering:** Each agent gets specific tools
   - Supervisor: All tools
   - Product Owner: Read/Write only
   - Coder: All tools (needs file manipulation)
   - Tester: Read + Bash (run tests)
   - Security: Read + Bash (scan vulnerabilities)
   - Infrastructure: All tools (deployment)

3. **Path Resolution:** Supports both relative and absolute paths
   ```typescript
   const absolutePath = path.isAbsolute(filePath)
     ? filePath
     : path.join(workingDirectory, filePath);
   ```

## Live Preview Component

### components/panels/LivePreview.tsx

**Features:**
- Auto-detects main file (index.html, App.tsx, etc.)
- Renders in iframe via `/api/preview/[projectId]`
- Responsive device preview (desktop/tablet/mobile)
- Refresh button to reload preview
- Security: Sandboxed iframe

**Detection Logic:**
```typescript
const hasPreview = project.codeFiles.some(
  file => file.path.endsWith('.html') ||
          file.path.endsWith('.tsx') ||
          file.path.endsWith('.jsx')
);

// Auto-select main file
if (files.find(f => f.path.includes('index.html'))) {
  setPreviewFile('index.html');
} else if (files.find(f => f.path.includes('App.tsx'))) {
  setPreviewFile('App.tsx');
}
```

## Preview API Route

### app/api/preview/[projectId]/route.ts

**Purpose:** Serve files from project directory

**Security:**
- Directory traversal prevention
- Validates projectId
- Only serves files within project directory

**Supported File Types:**
- HTML, CSS, JavaScript
- Images (PNG, JPG, GIF, SVG)
- JSON files

**Usage:**
```
GET /api/preview/my-todo-app?file=index.html
GET /api/preview/my-todo-app?file=styles/main.css
GET /api/preview/my-todo-app?file=src/App.tsx
```

## Complete Workflow Example

### User Action:
```
Requirements: "Build a todo list app with HTML, CSS, and vanilla JavaScript"
```

### What Happens:

1. **Project Creation**
   ```
   Directory: projects/todo-list-app/
   ```

2. **Supervisor Agent**
   ```
   → Analyzes requirements
   → Creates plan: "Need HTML structure, CSS styling, JS functionality"
   ```

3. **Product Owner Agent**
   ```
   → Creates epics and stories
   Story 1: "Create HTML structure"
   Story 2: "Add CSS styling"
   Story 3: "Implement JavaScript logic"
   ```

4. **Coder Agent (Story 1)**
   ```typescript
   // Tool use #1: write_file
   {
     tool: "write_file",
     input: {
       path: "index.html",
       content: "<!DOCTYPE html>\n<html>..."
     }
   }
   // Result: File written to projects/todo-list-app/index.html

   // Tool use #2: write_file
   {
     tool: "write_file",
     input: {
       path: "styles.css",
       content: "body { font-family: Arial; }"
     }
   }
   // Result: File written to projects/todo-list-app/styles.css

   // Tool use #3: write_file
   {
     tool: "write_file",
     input: {
       path: "script.js",
       content: "const todos = [];\n..."
     }
   }
   // Result: File written to projects/todo-list-app/script.js
   ```

5. **Live Preview Updates**
   ```
   → Code Editor shows: index.html, styles.css, script.js
   → Live Preview detects index.html
   → Iframe loads: /api/preview/todo-list-app?file=index.html
   → User sees working todo app!
   ```

## Testing the Feature

### 1. Start a Project

```bash
# Open dashboard
http://localhost:3000/dashboard

# Enter requirements
"Build a simple HTML page with a heading and button"

# Click "Analyze & Start"
```

### 2. Monitor Console Output

You should see:
```
📁 Created project directory: projects/{project-name}
    → Starting agentic loop
    → Available tools: write_file, read_file, edit_file, run_bash
    → Iteration 1/100
    → Executing 1 tool(s)
      → Tool: write_file
      ✓ Wrote file: projects/{project-name}/index.html
```

### 3. Check File System

```bash
ls projects/{project-name}/
# Should see: index.html, styles.css, etc.
```

### 4. View Live Preview

- Click on Code Editor → See generated files
- Look at Live Preview panel → See rendered app
- Click refresh button → Reload preview

## Configuration Options

### Max Iterations (maxTurns)

Controls how many tool-use cycles allowed:

- **Supervisor:** 50 turns (planning/coordination)
- **Product Owner:** 20 turns (story creation)
- **Coder:** 100 turns (lots of file operations)
- **Tester:** 50 turns (run tests, analyze results)
- **Security:** 30 turns (scan files)
- **Infrastructure:** 50 turns (deployment steps)

### Allowed Tools by Agent

```typescript
// Supervisor - All tools
allowedTools: ['write_file', 'read_file', 'edit_file', 'run_bash']

// Product Owner - Documentation only
allowedTools: ['write_file', 'read_file']

// Coder - All file operations
allowedTools: ['write_file', 'read_file', 'edit_file', 'run_bash']

// Tester - Read + Execute
allowedTools: ['read_file', 'run_bash']

// Security - Read + Scan
allowedTools: ['read_file', 'run_bash']
```

## Cost Implications

With tool execution, costs may be higher:

**Without Tools (Before):**
- Single API call per agent
- ~5,000 tokens total
- Cost: ~$0.05 per simple project

**With Tools (After):**
- Multiple iterations (5-20 per agent)
- Tool use adds overhead
- ~20,000 tokens total
- Cost: ~$0.20 per simple project

**Still very affordable!** Complex projects might cost $0.50-$1.00.

## Troubleshooting

### Files Not Appearing

**Check:**
1. Is `ANTHROPIC_API_KEY` set in `.env.local`?
2. Does console show "Wrote file" messages?
3. Check `projects/` directory exists
4. Verify project directory was created

### Live Preview Not Loading

**Check:**
1. Does Code Editor show HTML/JSX files?
2. Check browser console for iframe errors
3. Verify `/api/preview/{projectId}` returns 200
4. Try clicking refresh button

### Tools Not Executing

**Check:**
1. Agent has tools in `allowedTools` array
2. Working directory is set correctly
3. No file permission errors in console
4. Tool names match exactly (lowercase)

## Future Enhancements

Possible improvements:

1. **Hot Reload:** Watch files and auto-refresh preview
2. **Dev Server:** Spin up actual dev server for React/Vue apps
3. **Build Process:** Run `npm run build` before preview
4. **Multi-Page Apps:** File picker for preview
5. **Console Output:** Show JS console errors in UI
6. **Network Tab:** Debug API calls in preview

## Summary

The platform now provides **full end-to-end functionality**:

✅ Multi-agent orchestration
✅ Real file writing to disk
✅ Live preview of generated apps
✅ Tool execution (write, read, edit, bash)
✅ Project directory management
✅ Security-sandboxed preview

**You can now watch AI agents build working applications in real-time!** 🎉
