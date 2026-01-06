# Quick Build Feature

## Purpose
Rapid prototype generation from simple prompts. Creates working Next.js apps in ~30 seconds using templates.

## Scope
- Template-based code generation (no AI API calls required)
- Simple requirements -> working app
- Auto-preview in iframe
- Can escalate to Complex Build for production-ready code

## Architecture

```
features/quick-build/
├── README.md              # This file - context for Claude
├── index.ts               # Public API exports
├── components/
│   ├── QuickBuildForm.tsx     # Requirements input + example prompts
│   ├── BuildProgress.tsx      # Phase progress indicator
│   ├── BuildLogs.tsx          # Build log viewer
│   ├── PreviewPanel.tsx       # Live preview iframe
│   └── EpicExplorerSection.tsx # Epic API explorer toggle
├── hooks/
│   ├── useQuickBuild.ts       # Build orchestration logic
│   └── usePreview.ts          # Preview server management
├── services/
│   ├── builder.ts             # Core build logic
│   └── templates/             # App templates
│       ├── base.ts            # Shared config templates
│       ├── todo.ts            # Todo app template
│       ├── calculator.ts      # Calculator template
│       ├── healthcare.ts      # Epic/FHIR templates
│       └── ocr.ts             # OCR app template
├── api/
│   └── route.ts               # API route handler logic
└── types.ts                   # TypeScript interfaces
```

## Key Files

### Entry Point
- `app/quick-build/page.tsx` - Thin wrapper importing from this feature

### Main Components
- `QuickBuildForm` - User input with example prompts
- `BuildProgress` - Shows planning -> creating -> installing -> building -> complete
- `PreviewPanel` - Embedded iframe with preview controls

### Hooks
- `useQuickBuild` - Manages build state, SSE streaming, error handling
- `usePreview` - Start/stop/refresh preview server

### Services
- `builder.ts` - Template selection and file generation
- Templates are pure functions returning file content

## Data Flow

```
User Input (requirements)
    ↓
useQuickBuild hook
    ↓
POST /api/simple-build (SSE stream)
    ↓
builder.ts (template selection)
    ↓
File generation → npm install → npm build
    ↓
usePreview hook
    ↓
Preview iframe
```

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/simple-build` | POST | Start build (SSE stream) |
| `/api/preview/start` | POST | Start preview server |
| `/api/preview/stop` | POST | Stop preview server |

## State Management
- Local React state via hooks (no global store needed)
- SessionStorage for cross-page data (requirements from home page)

## Integration Points
- Can create Complex Build project via `/api/v2/plan`
- Projects saved to `data/projects.json` and `~/coding/ai-projects/`

## NOT in Scope
- Multi-agent execution (see `/features/build/`)
- Large project orchestration (see `/features/fleet/`)
- Database setup (optional, delegated to shared service)
