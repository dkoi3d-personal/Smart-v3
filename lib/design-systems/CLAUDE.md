# Design Systems Library

Manages design system tokens and generates prompts for UI-focused agents.

## Quick Start

```typescript
import {
  getDesignSystemPromptForProject,
  getComponentLibraryPromptForProject,
} from '@/lib/design-systems/prompt-generator';

// Get prompt for agent context
const dsPrompt = await getDesignSystemPromptForProject('my-project');

// In fleet coordinator, this is auto-injected for UI stories
```

## Key Files

| File | Purpose |
|------|---------|
| `design-system-store.ts` | CRUD operations, persistence |
| `prompt-generator.ts` | Generates prompts for agents |
| `defaults/modern-dark.ts` | Default dark theme |
| `defaults/ochsner-health.ts` | Healthcare design system |

## Design System Structure

```typescript
interface DesignSystem {
  id: string;
  name: string;
  projectId: string;
  tokens: {
    colors: {
      background: string;     // Page background
      foreground: string;     // Text color
      primary: string;        // Primary actions
      secondary: string;      // Secondary elements
      accent: string;         // Highlights
      destructive: string;    // Errors, delete
      muted: string;          // Disabled, hints
      border: string;         // Borders
      // Status colors
      success: string;
      warning: string;
      error: string;
      info: string;
    };
    typography: {
      fontFamily: string;     // Body font
      headingFont: string;    // Heading font
      monoFont: string;       // Code font
    };
    spacing: { unit: number }; // Base spacing unit (px)
    borderRadius: { sm: string; md: string; lg: string; xl: string };
  };
  componentLibrary?: 'shadcn' | 'radix' | 'custom';
  createdAt: Date;
}
```

## Common Operations

### Add a new default design system
1. Create `defaults/my-theme.ts`
2. Export `MY_THEME_DESIGN_SYSTEM` constant
3. Add to `getDefaultDesignSystems()` in `design-system-store.ts`

### Modify how prompts are generated
- Edit `prompt-generator.ts` → `generateDesignSystemPrompt()`
- The prompt is injected in `fleet-coordinator.ts` → `generateContextPrompt()`

### Add new token category
1. Update `DesignSystem` interface
2. Update default themes
3. Update prompt generation to include new tokens

## Usage in Fleet

```
Fleet Start
    ↓
getComponentLibraryPromptWithInfo(projectId)
    ↓
Stored in fleet.state.designSystemPrompt
    ↓
Injected into agent prompts for UI stories
```

The prompt is injected in `fleet-coordinator.ts:993-1063`.

## Built-in Design Systems

### Modern Dark (Default)
- Dark theme with purple accents
- Good for developer tools, dashboards
- High contrast

### Ochsner Health (Healthcare)
- Purple primary (#461d7c / #4d2787)
- Green accent (#c7e59f)
- WCAG 2.2 AA compliant
- Montserrat headings, Roboto body
- Healthcare UX patterns

## Gotchas & Warnings

1. **Design system loaded at fleet start** - Changing mid-execution won't affect running agents
2. **Only injected for UI work** - Backend stories don't get design context
3. **Token format matters** - Use CSS-compatible values (hex, oklch, etc.)
4. **Component library optional** - If not set, agents use plain Tailwind

## Data Storage

- **Config**: `data/design-systems/_config.json`
- **Systems**: `data/design-systems/{id}.json`

## Related Code

- **Used by**: `lib/fleet/fleet-coordinator.ts` (injects into prompts)
- **API**: `app/api/design-systems/` for CRUD
- **UI**: `app/settings/` page for configuration
