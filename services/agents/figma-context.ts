/**
 * Figma Context and Design Token Integration
 *
 * Extracted from multi-agent-service.ts for maintainability.
 * Handles loading and formatting Figma design data for agent prompts.
 */

import * as fs from 'fs/promises';
import path from 'path';
import { projects, ensureProjectsLoaded } from '@/app/api/projects/route';

// =============================================================================
// Types
// =============================================================================

export interface ProjectSourceInfo {
  source: 'figma' | 'text';
  figmaUrl?: string;
  figmaContext?: any;
  hasFigmaDesign: boolean;
}

// =============================================================================
// Project Source Detection
// =============================================================================

/**
 * Get project source info to determine where design tokens come from
 */
export async function getProjectSourceInfo(projectId: string): Promise<ProjectSourceInfo> {
  try {
    await ensureProjectsLoaded();
    const project = projects.get(projectId);

    if (project && project.source === 'figma') {
      return {
        source: 'figma',
        figmaUrl: project.figmaUrl,
        figmaContext: project.figmaContext,
        hasFigmaDesign: true,
      };
    }
  } catch (error) {
    console.warn(`[Multi-Agent] Could not load project source info for ${projectId}:`, error);
  }

  return {
    source: 'text',
    hasFigmaDesign: false,
  };
}

/**
 * Load full Figma context from project directory
 */
export async function loadFigmaContext(projectDir: string): Promise<any | null> {
  try {
    const figmaContextPath = path.join(projectDir, 'figma-context.json');
    const data = await fs.readFile(figmaContextPath, 'utf-8');
    const context = JSON.parse(data);
    console.log(`[Multi-Agent] Loaded Figma context from ${figmaContextPath}`);
    return context;
  } catch {
    return null;
  }
}

// =============================================================================
// Figma Instruction Generation
// =============================================================================

/**
 * Generate Figma-specific instructions for Product Owner
 */
export function getFigmaProductOwnerInstructions(figmaContext: any): string {
  if (!figmaContext) return '';

  const colors = figmaContext.colors || {};
  const screens = figmaContext.screens || [];
  const authFlow = figmaContext.authFlow || [];
  const mainWorkflow = figmaContext.mainWorkflow || [];
  const dataModel = figmaContext.dataModel || {};
  const styleTokens = figmaContext.styleTokens || {};
  const localImagePaths = figmaContext.localImagePaths || {};
  const icons = figmaContext.icons || [];
  const illustrations = icons.filter((i: any) => i.isIllustration);

  const figmaFileId = figmaContext.figmaFileId || '';
  const figmaNodeId = figmaContext.figmaNodeId || '';

  let instructions = `
=== 🎨 FIGMA DESIGN PROJECT - PIXEL PERFECT BUILD ===

🚫 **SKIP story-foundation** - Project is ALREADY scaffolded with package.json, design-tokens.json, and tailwind.config.js. Do NOT create a "Project Foundation" or "Project Setup" story. Start directly with feature stories.

⛔⛔⛔ FORBIDDEN - DO NOT READ THESE FILES ⛔⛔⛔
- figma-context.json (TOO LARGE - will exceed token limits)
- figma-screens.json (TOO LARGE - will exceed token limits)
- public/figma-icons/icon-manifest.json (TOO LARGE - will exceed token limits)

All essential data from these files is ALREADY INCLUDED in this prompt below.
If you try to read these files, you WILL get a token limit error.
Use Grep to search for specific details if needed.
⛔⛔⛔ END FORBIDDEN FILES ⛔⛔⛔

## 📁 DESIGN DATA (ALREADY EMBEDDED IN THIS PROMPT)
- Screens, colors, typography, icons, and workflows are summarized below
- Reference images are in \`figma-frames/\` - view specific PNG images as needed
- For detailed screen data, use Grep: \`grep "ScreenName" figma-screens.json\`

This project MUST match the Figma design EXACTLY. Reference images are in \`figma-frames/\`.
${figmaFileId ? `\n**Figma File**: \`${figmaFileId}\`${figmaNodeId ? ` | **Node**: \`${figmaNodeId}\`` : ''}` : ''}

## 📸 CRITICAL: Reference Images Available
${Object.keys(localImagePaths).length > 0 ? `Reference images for each screen are saved in the project:
${screens.map((s: any) => `- **${s.name}**: \`figma-frames/${s.name.toLowerCase().replace(/\\s+/g, '-')}.png\``).join('\n')}

Each story MUST reference its screen image for pixel-perfect implementation.` : 'Frame images not available - use Figma MCP to fetch design details.'}

## 🎯 Icons Available - CONTEXT MAPPED
Icons extracted from Figma are in \`figma-icons/\` directory as SVGs.
Each icon is named based on its context (the component/card it belongs to).

**Icon filenames are semantic**: \`icon-healthy-eating-plate.svg\` belongs to the "Healthy Eating Plate" card.

See \`figma-icons/icon-manifest.json\` for the full list with context mappings.
Stories MUST specify which icon to use based on the context label matching the component being built.

## 🎯 DEEP DECOMPOSITION RULES
⚠️ Break each screen into 3-6 component-level stories (NOT one story per screen!):
- Layout story: header, navigation, overall structure
- Component stories: one per card/section with its illustration
- Navigation story: TabBar, sidebar, menus

**AC specifics (use design tokens, not raw colors):**
✅ "Card uses \`/figma-icons/illustration-library.svg\`" (exact path)
✅ "Title 'Library' in text-lg font-semibold" (text + typography)
✅ "Uses bg-primary from design-tokens" (token reference, NOT hex)
❌ "Uses appropriate icon" or "#4F46E5" (vague or raw values)

## 🧠 INFER FULL FEATURES FROM UI TEXT
Figma shows UI but NOT backend. YOU must infer and create stories for:

**When you see a menu item/card like "Blood Pressure Readings":**
1. **Data model**: Create BloodPressureReading (date, systolic, diastolic, pulse, notes)
2. **API**: Create GET/POST/PUT/DELETE /api/blood-pressure-readings
3. **List page**: Implement the page showing all readings
4. **Detail/Add pages**: Create forms and detail views

**When you see a dashboard with metrics:**
- Infer what data populates those metrics
- Create the aggregation logic/API

**When you see navigation to features not in Figma:**
- Create the full feature (data + API + UI) based on the name

## 📱 Screens to Build (${screens.length} total)
${screens.map((s: any) => {
  const patterns = [];
  if (s.hasTable) patterns.push('table');
  if (s.hasList) patterns.push('list/cards');
  if (s.hasForm) patterns.push('form');
  const actions = s.inferredActions?.join(', ') || '';
  return `- **${s.name}** (${s.route}) - ${patterns.join(', ') || 'UI screen'}${actions ? ` [${actions}]` : ''}`;
}).join('\n') || '- Screens not detected'}

## 🔐 Authentication Flow
${authFlow.length > 0 ? authFlow.map((name: string, i: number) => `${i + 1}. ${name}`).join(' → ') : 'No auth flow detected'}

## 🔄 Main Workflow
${mainWorkflow.length > 0 ? mainWorkflow.join(' → ') : 'No workflow detected'}

## 📊 Data Model (${Object.keys(dataModel).length} entities)
${Object.entries(dataModel).map(([name, entity]: [string, any]) =>
  `- **${name}**: ${entity.fields?.slice(0, 5).join(', ')}${entity.fields?.length > 5 ? '...' : ''}`
).join('\n') || '- No data model detected'}

## 🎨 Design Tokens
${(() => {
  const tokenStatus = figmaContext.tokenStatus;
  if (tokenStatus?.status === 'existing') {
    return `### ✅ TOKEN STATUS: ALL TOKENS ALREADY IMPLEMENTED
**${tokenStatus.summary}**
DO NOT create a Tailwind configuration story - design tokens are already set up!
Just verify the existing \`design-tokens.json\` matches the Figma design.`;
  } else if (tokenStatus?.status === 'partial') {
    return `### ⚠️ TOKEN STATUS: PARTIAL MATCH
**${tokenStatus.summary}**

**Already implemented (DO NOT recreate):**
${tokenStatus.existingTokens?.colors?.length > 0 ? `- Colors: ${tokenStatus.existingTokens.colors.slice(0, 8).join(', ')}` : ''}
${tokenStatus.existingTokens?.fonts?.length > 0 ? `- Fonts: ${tokenStatus.existingTokens.fonts.join(', ')}` : ''}

**NEW tokens to add:**
${tokenStatus.newTokens?.colors?.length > 0 ? `- Colors: ${tokenStatus.newTokens.colors.slice(0, 8).join(', ')}` : ''}
${tokenStatus.newTokens?.fonts?.length > 0 ? `- Fonts: ${tokenStatus.newTokens.fonts.join(', ')}` : ''}`;
  } else {
    return `### 🆕 TOKEN STATUS: NEW PROJECT
All design tokens need to be set up from scratch.`;
  }
})()}

### Colors
${Object.entries(colors).slice(0, 15).map(([name, value]) => `- ${name}: ${value}`).join('\n') || '- Colors from figma-frames images'}

### Typography
- Font: ${figmaContext.typography?.headingFont || styleTokens.typography?.fonts?.[0] || 'Inter'}
${styleTokens.typography?.sizes ? Object.entries(styleTokens.typography.sizes).slice(0, 5).map(([name, spec]: [string, any]) => `- ${name}: ${spec.size}`).join('\n') : ''}

### Spacing
${styleTokens.spacing?.slice(0, 10).join(', ') || 'See design-tokens.json'}

## 📋 REQUIRED STORIES (in order)

### Phase 1: Infrastructure
${(() => {
  const tokenStatus = figmaContext.tokenStatus;
  if (tokenStatus?.status === 'existing') {
    return `1. **"Verify existing Tailwind design tokens"** (priority: low)
   - Verify \`design-tokens.json\` matches current Figma design
   - All tokens already implemented - NO changes needed
   - Skip if tokens are correct`;
  } else if (tokenStatus?.status === 'partial') {
    return `1. **"Update Tailwind with new design tokens"** (priority: critical)
   - ADD ONLY the new tokens to tailwind.config.js
   - DO NOT modify existing tokens: ${tokenStatus.existingTokens?.colors?.slice(0, 5).join(', ') || 'see list above'}
   - Add new colors: ${tokenStatus.newTokens?.colors?.slice(0, 5).join(', ') || 'none'}`;
  } else {
    return `1. **"Configure Tailwind with Figma design tokens"** (priority: critical)
   - Load \`design-tokens.json\` colors into tailwind.config.js
   - Configure fonts and spacing
   - MUST be done first`;
  }
})()}

2. **"Set up Prisma schema with data model"** (priority: critical)
   - Create models: ${Object.keys(dataModel).join(', ') || 'from requirements'}

### Phase 2: Auth Flow (${authFlow.length} screens)
${authFlow.map((name: string, i: number) => {
  const screen = screens.find((s: any) => s.name === name);
  const routePath = screen?.route || '/';
  const appPath = routePath === '/' ? 'app/page.tsx' : `app${routePath}/page.tsx`;
  return `${i + 3}. **"Implement ${name} screen"** (${routePath})
   - **CREATE FILE**: \`${appPath}\`
   - Reference: \`figma-frames/${name.toLowerCase().replace(/\\s+/g, '-')}.png\`
   - Match design pixel-perfectly`;
}).join('\n') || '- No auth stories needed'}

### Phase 3: Main Screens (${mainWorkflow.length} screens)
${mainWorkflow.map((name: string, i: number) => {
  const screen = screens.find((s: any) => s.name === name);
  const patterns = [];
  if (screen?.hasTable) patterns.push('data table');
  if (screen?.hasList) patterns.push('card list');
  if (screen?.hasForm) patterns.push('form');
  const routePath = screen?.route || '/';
  const appPath = routePath === '/' ? 'app/page.tsx' : `app${routePath}/page.tsx`;
  return `${i + 3 + authFlow.length}. **"Implement ${name} screen"** (${routePath})
   - **CREATE FILE**: \`${appPath}\`
   - Reference: \`figma-frames/${name.toLowerCase().replace(/\\s+/g, '-')}.png\`
   - UI: ${patterns.join(', ') || 'layout'}
   - Actions: ${screen?.inferredActions?.join(', ') || 'view'}`;
}).join('\n') || '- Create stories for each screen'}

### Phase 4: Shared Components
${screens.some((s: any) => s.sharedComponents?.includes('Navigation')) ? `- **"Implement shared Navigation/Sidebar"** - appears in ${screens.filter((s: any) => s.sharedComponents?.includes('Navigation')).length} screens` : ''}
${screens.some((s: any) => s.sharedComponents?.includes('Header')) ? `- **"Implement shared Header"** - appears in ${screens.filter((s: any) => s.sharedComponents?.includes('Header')).length} screens` : ''}

## 🚨 CRITICAL: Route Files Required
For EVERY screen story, the acceptance criteria MUST include:
- "Route file created at \`app/[route]/page.tsx\`"
- "Page is accessible at http://localhost:3000/[route]"
- "Page renders without 404 error"

## Story Acceptance Criteria Template
EVERY UI story MUST include these acceptance criteria:

### Route (REQUIRED - prevents 404 errors)
1. "Route file created at \`app/[route]/page.tsx\`"
2. "Page renders at http://localhost:3000/[route] without errors"

### Visual (Required)
- "Matches \`figma-frames/[screen-name].png\` exactly"
- "Uses colors from design-tokens.json"
- "Uses correct typography from design-tokens.json"

### Icons & Illustrations (REQUIRED for any screen with cards/icons)
${icons.length > 0 ? `🚨 **MANDATORY**: Every story with visual elements MUST include specific illustration/icon file paths.

**⚠️ CRITICAL: ONLY USE FILENAMES FROM THIS LIST - DO NOT INVENT PATHS:**
${illustrations.slice(0, 30).map((i: any) => `- "${i.contextLabel}" → \`/figma-icons/${i.fileName}\``).join('\n')}${illustrations.length > 30 ? `\n(+ ${illustrations.length - 30} more - check \`public/figma-icons/icon-manifest.json\` for full list)` : ''}

**🚫 NEVER INVENT FILENAMES - ONLY USE EXACT PATHS FROM THE LIST ABOVE**
- ✅ Copy the EXACT path from the list above (e.g., \`/figma-icons/${illustrations[0]?.fileName || 'icon-example.svg'}\`)
- ❌ DO NOT invent filenames like "illustration-healthy-eating.svg" - these DO NOT EXIST
- ❌ DO NOT guess semantic names - use the ACTUAL extracted filenames

**If the image you need is NOT in the list above:**
1. Look for the closest match by contextLabel
2. If no match exists, DO NOT reference an image - note that the icon needs to be extracted from Figma

**REQUIRED Acceptance Criteria Format:**
- ✅ "Program Overview card uses illustration from \`/figma-icons/${illustrations[0]?.fileName || 'actual-filename-from-list.svg'}\`"
- ❌ NEVER write made-up paths like "/figma-icons/illustration-my-feature.svg" unless it's in the list!

🚨 **SEED DATA / DATABASE CONTENT:**
When creating Prisma seed data with imageUrl fields, ONLY use paths from the list above:
- ✅ \`imageUrl: "/figma-icons/${illustrations[0]?.fileName || 'actual-filename.svg'}"\` (from list)
- ❌ \`imageUrl: "/figma-icons/invented-name.svg"\` (WRONG - will cause broken images!)

Coders MUST verify paths exist in \`public/figma-icons/\` before using them.` : ''}

### Functional (Based on UI Pattern)
${generatePatternBasedAC(screens)}

## 🔗 INFERRED PAGES (Not in Figma, but logically required)
Generate ADDITIONAL stories for these detail/sub-pages:
${generateInferredPageStories(screens, dataModel)}
`;

  return instructions;
}

/**
 * Generate pattern-based acceptance criteria based on detected UI patterns
 */
function generatePatternBasedAC(screens: any[]): string {
  const patterns: string[] = [];

  // Collect all patterns across screens
  const hasTable = screens.some(s => s.hasTable);
  const hasList = screens.some(s => s.hasList);
  const hasForm = screens.some(s => s.hasForm);
  const hasViewButtons = screens.some(s => s.buttons?.some((b: string) =>
    b.toLowerCase().includes('view') || b.toLowerCase().includes('details')
  ));
  const hasAddButtons = screens.some(s => s.buttons?.some((b: string) =>
    b.toLowerCase().includes('add') || b.toLowerCase().includes('create') || b.toLowerCase().includes('new')
  ));
  const hasDeleteButtons = screens.some(s => s.buttons?.some((b: string) =>
    b.toLowerCase().includes('delete') || b.toLowerCase().includes('remove')
  ));
  const hasEditButtons = screens.some(s => s.buttons?.some((b: string) =>
    b.toLowerCase().includes('edit') || b.toLowerCase().includes('update')
  ));
  const hasSearchInput = screens.some(s => s.inputFields?.some((f: string) =>
    f.toLowerCase().includes('search')
  ));

  if (hasTable) {
    patterns.push(`**For TABLE screens:**
  - "Clicking a table row navigates to detail page at /[route]/[id]"
  - "Table is sortable by clicking column headers"
  - "Empty state displays 'No items found' message"
  - "Loading state shows skeleton/spinner"
  - "Table data fetched from GET /api/[entity]"`);
  }

  if (hasList) {
    patterns.push(`**For LIST/CARD screens:**
  - "Clicking a card navigates to detail page at /[route]/[id]"
  - "Cards are keyboard accessible"
  - "Empty state displays appropriate message"
  - "Loading state shows skeleton cards"`);
  }

  if (hasForm) {
    patterns.push(`**For FORM screens:**
  - "Form validates required fields on submit"
  - "Validation errors display inline below fields"
  - "Submit button disables during loading"
  - "Success redirects to appropriate list/detail page"
  - "Form data submitted via POST/PUT to /api/[entity]"`);
  }

  if (hasViewButtons) {
    patterns.push(`**For VIEW/DETAILS buttons:**
  - "View button navigates to /[entity]/[id] detail page"
  - "Detail page shows ALL fields from data model"
  - "Detail page has 'Back to list' navigation"
  - "Detail page loads data from GET /api/[entity]/[id]"`);
  }

  if (hasAddButtons) {
    patterns.push(`**For ADD/CREATE buttons:**
  - "Add button opens form modal or navigates to /[entity]/new"
  - "Form pre-populates defaults where applicable"
  - "Success adds item to list without full page reload"
  - "Cancel returns to previous state"`);
  }

  if (hasDeleteButtons) {
    patterns.push(`**For DELETE buttons:**
  - "Delete shows confirmation dialog before action"
  - "Confirmation states what will be deleted"
  - "Success removes item from list"
  - "DELETE request sent to /api/[entity]/[id]"`);
  }

  if (hasEditButtons) {
    patterns.push(`**For EDIT buttons:**
  - "Edit opens pre-filled form modal or navigates to /[entity]/[id]/edit"
  - "Form shows current values"
  - "Success updates item in list"
  - "PUT request sent to /api/[entity]/[id]"`);
  }

  if (hasSearchInput) {
    patterns.push(`**For SEARCH functionality:**
  - "Search filters list in real-time as user types"
  - "Search is debounced (300ms delay)"
  - "Clear button resets search and shows all items"
  - "No results shows 'No matches found' message"`);
  }

  return patterns.join('\n\n') || 'Add specific functional criteria based on screen actions.';
}

/**
 * Generate stories for pages that are implied but not explicitly in Figma
 */
function generateInferredPageStories(screens: any[], dataModel: any): string {
  const inferred: string[] = [];

  for (const screen of screens) {
    const entityName = deriveEntityName(screen.name, dataModel);

    // Pattern: Table/List → Detail page
    if (screen.hasTable || screen.hasList) {
      const detailRoute = `${screen.route}/[id]`;
      const detailFilePath = `app${screen.route}/[id]/page.tsx`;
      inferred.push(`### ${entityName} Detail Page (inferred from ${screen.name})
- **Route**: \`${detailRoute}\`
- **CREATE FILE**: \`${detailFilePath}\`
- **Triggered by**: Clicking row/card in ${screen.name}
- **Content**: All ${entityName} fields from data model
- **AC**:
  - "Route file created at \`${detailFilePath}\`"
  - "Page renders at http://localhost:3000${screen.route}/123 without 404"
  - "Displays all ${entityName} data fields"
  - "Has Edit and Delete action buttons"
  - "Shows related entities (if any)"
  - "Back button returns to ${screen.route}"`);
    }

    // Pattern: "View X" buttons → specific detail pages
    const viewButtons = screen.buttons?.filter((b: string) =>
      b.toLowerCase().includes('view') && !b.toLowerCase().includes('view all')
    ) || [];

    for (const button of viewButtons) {
      const targetName = button.replace(/view/i, '').trim() || entityName;
      if (targetName && !inferred.some(i => i.includes(targetName))) {
        const targetRoute = `/${slugifyForRoute(targetName)}/[id]`;
        const targetFilePath = `app/${slugifyForRoute(targetName)}/[id]/page.tsx`;
        inferred.push(`### ${targetName} Detail (inferred from "${button}" in ${screen.name})
- **Route**: \`${targetRoute}\`
- **CREATE FILE**: \`${targetFilePath}\`
- **Triggered by**: ${button} button
- **Content**: Full ${targetName} information
- **AC**:
  - "Route file created at \`${targetFilePath}\`"
  - "Page renders without 404 error"
  - "Displays complete ${targetName} details"
  - "Accessible from ${screen.name}"`);
      }
    }

    // Pattern: Report/Analytics cards → Report pages
    if (screen.name.toLowerCase().includes('report') ||
        screen.textContent?.some((t: string) => t.toLowerCase().includes('report'))) {
      const reportTypes = screen.textContent?.filter((t: string) =>
        (t.toLowerCase().includes('report') ||
         t.toLowerCase().includes('activity') ||
         t.toLowerCase().includes('summary') ||
         t.toLowerCase().includes('analytics')) &&
        t.length > 5 && t.length < 50
      ) || [];

      for (const reportType of reportTypes.slice(0, 6)) {
        if (!inferred.some(i => i.includes(reportType))) {
          const reportRoute = `/reports/${slugifyForRoute(reportType)}`;
          const reportFilePath = `app/reports/${slugifyForRoute(reportType)}/page.tsx`;
          inferred.push(`### ${reportType} Page (inferred from Reports screen)
- **Route**: \`${reportRoute}\`
- **CREATE FILE**: \`${reportFilePath}\`
- **Triggered by**: Clicking "${reportType}" card
- **Content**: Full report view with data
- **AC**:
  - "Route file created at \`${reportFilePath}\`"
  - "Page renders without 404 error"
  - "Date range filter at top"
  - "Key metrics/summary cards"
  - "Data table with report details"
  - "Export to CSV/PDF button"
  - "Back to Reports list"`);
        }
      }
    }
  }

  if (inferred.length === 0) {
    return 'No additional pages inferred. All screens are self-contained.';
  }

  return inferred.join('\n\n');
}

/**
 * Derive entity name from screen name by matching to data model or singularizing
 */
function deriveEntityName(screenName: string, dataModel: any): string {
  const screenLower = screenName.toLowerCase().replace(/[-_\s]+/g, '');

  // Try to match data model entities
  for (const entityName of Object.keys(dataModel)) {
    if (screenLower.includes(entityName.toLowerCase())) {
      return entityName;
    }
  }

  // Fallback: singularize screen name
  const name = screenName.replace(/[-_]/g, ' ').trim();
  // Basic singularization
  if (name.endsWith('ies')) return name.slice(0, -3) + 'y';
  if (name.endsWith('s') && !name.endsWith('ss')) return name.slice(0, -1);
  return name;
}

/**
 * Convert string to URL-friendly slug
 */
function slugifyForRoute(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate Figma-specific instructions for Coder
 */
export function getFigmaCoderInstructions(figmaContext: any, figmaUrl?: string): string {
  if (!figmaContext) return '';

  const colors = figmaContext.colors || {};
  const screens = figmaContext.screens || [];
  const styleTokens = figmaContext.styleTokens || {};
  const localImagePaths = figmaContext.localImagePaths || {};
  const icons = figmaContext.icons || [];
  const hasImages = Object.keys(localImagePaths).length > 0 || screens.length > 0;
  const hasIcons = icons.length > 0;

  return `
=== 🎨 FIGMA DESIGN - PIXEL PERFECT IMPLEMENTATION ===

## 📁 DESIGN DATA (SUMMARY INCLUDED BELOW)
Essential design data is provided in this prompt - DO NOT read the full JSON files (they may exceed token limits).
- Use Grep to search for specific screen/component details if needed: \`grep "ScreenName" figma-screens.json\`
- Reference images in \`figma-frames/\` show exactly what to build
- Icon manifest at \`public/figma-icons/icon-manifest.json\` lists all available icons

${hasImages ? `## 📸 REFERENCE IMAGES AVAILABLE
Reference images are in \`figma-frames/\` directory:
${screens.slice(0, 10).map((s: any) => `- ${s.name}: \`figma-frames/${s.name.toLowerCase().replace(/\\s+/g, '-')}.png\``).join('\n')}

**READ these images** to see exactly what to build!` : ''}

${hasIcons ? (() => {
  const smallIcons = icons.filter((i: any) => !i.isIllustration);
  const illustrations = icons.filter((i: any) => i.isIllustration);
  return `## 🎯 ICONS & ILLUSTRATIONS FROM FIGMA - USE THESE ACTUAL SVG FILES!

🚨🚨🚨 **MANDATORY: USE THE DOWNLOADED SVG FILES!** 🚨🚨🚨
- The actual SVG files are ALREADY downloaded in \`public/figma-icons/\`
- DO NOT create inline <svg> components - USE THE FILES!
- DO NOT create placeholder rectangles/circles - USE THE FILES!
- FIRST read \`public/figma-icons/icon-manifest.json\` to see all available icons/illustrations

All assets are in \`public/figma-icons/\` and served at \`/figma-icons/*\`:

${illustrations.length > 0 ? `### 🖼️ Illustrations (for cards, features, etc.):
${illustrations.slice(0, 15).map((i: any) => {
  const context = i.contextLabel ? ` → **${i.contextLabel}**` : '';
  return `- \`/figma-icons/${i.fileName}\` (${i.size.width}x${i.size.height})${context}`;
}).join('\n')}${illustrations.length > 15 ? `\n... and ${illustrations.length - 15} more illustrations` : ''}
` : ''}
### 🔷 Icons (UI elements, navigation, actions):
${smallIcons.slice(0, 20).map((i: any) => {
  const context = i.contextLabel ? ` → **${i.contextLabel}**` : '';
  return `- \`/figma-icons/${i.fileName}\`${context}`;
}).join('\n')}${smallIcons.length > 20 ? `\n... and ${smallIcons.length - 20} more icons` : ''}

### How to Use:
\`\`\`tsx
import Image from 'next/image';

// ✅ For card illustrations (larger images)
<Image
  src="/figma-icons/illustration-healthy-eating.svg"
  alt="Healthy Eating"
  width={110}
  height={110}
  unoptimized
/>

// ✅ For icons (smaller UI elements)
<Image
  src="/figma-icons/icon-left.svg"
  alt="Back"
  width={24}
  height={24}
  unoptimized
/>

// ✅ Or use img tag
<img src="/figma-icons/icon-settings.svg" alt="Settings" className="w-6 h-6" />

// ❌ WRONG - Never create inline SVG components!
// ❌ WRONG - Never create placeholder images with basic shapes!
// ❌ Don't write: function MyIcon() { return <svg>...</svg> }
// ❌ Don't write: <svg><rect/><circle/></svg> for cards
\`\`\`

**BEFORE building any component with an icon/illustration:**
1. READ \`public/figma-icons/icon-manifest.json\`
2. Find the icon by contextLabel (matches the card/component name)
3. Use \`<Image src="/figma-icons/{fileName}" />\` or \`<img src="/figma-icons/{fileName}" />\`

⛔ **YOUR CODE WILL BE REJECTED IF YOU:**
- Create inline \`<svg>\` components instead of using the files
- Use placeholder shapes (rectangles, circles) instead of real icons
- Hardcode SVG paths instead of referencing the downloaded files
- Make up paths like \`/images/...\` or \`/icons/...\` - ONLY use \`/figma-icons/...\` paths
- Use any image path not listed in \`icon-manifest.json\`

✅ **CORRECT**: Use ONLY paths from icon-manifest.json: \`/figma-icons/illustration-*.svg\` or \`/figma-icons/icon-*.svg\`

### 🚨 SEED DATA & DATABASE IMAGEURL FIELDS:
When creating Prisma seed.ts or any DB content with imageUrl fields:
1. FIRST read \`public/figma-icons/icon-manifest.json\` to see all available files
2. Match the illustration to your content (e.g., "Healthy Eating Plate" → illustration-healthy-eating*.png or *.svg)
3. Use the exact filename: \`imageUrl: "/figma-icons/illustration-healthy-eating.png"\`
4. NEVER invent paths like \`/images/missions/...\` - these don't exist!

\`\`\`ts
// ✅ CORRECT - uses actual figma-icons file
{ title: 'Healthy Eating Plate', imageUrl: '/figma-icons/illustration-healthy-eating.png' }

// ❌ WRONG - made-up path that doesn't exist!
{ title: 'Healthy Eating Plate', imageUrl: '/images/missions/healthy-eating.jpg' }
\`\`\``;
})() : ''}

## 📁 Design Tokens
Load from \`design-tokens.json\` for exact colors, spacing, typography.

## Figma Source: ${figmaUrl || figmaContext.sourceUrl || 'See requirements'}

## 🎯 USE FIGMA MCP FOR MISSING/GENERIC ICONS
**CRITICAL**: If icon-manifest.json has generic names like "img 1:1", "illustration-new", or "Frame 123" but you need a specific illustration (e.g., "Program Overview" card), you MUST use Figma MCP to:
1. Find the correct node by searching for the text label
2. Download it with a semantic name like \`illustration-program-overview.png\`

⚠️ **DO NOT use generic-named files without checking!** If you see \`illustration-new.png\` but need "Tutorials" illustration, USE MCP to find and download the right one.

### Get Figma Data (query the design tree):
\`\`\`
mcp__figma__get_figma_data
  fileKey: "${figmaContext.figmaFileId || '<from figma URL>'}"${figmaContext.figmaNodeId ? `
  nodeId: "${figmaContext.figmaNodeId}"  # REQUIRED - gets only this section!` : ''}
\`\`\`

### Find Icon for Component:
If you need to find which icon belongs to a component (e.g., "Healthy Eating Plate"):
1. Use \`mcp__figma__get_figma_data\` to get the node tree
2. Find the component by text (e.g., search for "Healthy Eating Plate")
3. Look at child nodes to find the icon's nodeId
4. Download with semantic name:

### Download Component Images/Icons:
\`\`\`
mcp__figma__download_figma_images
  fileKey: "${figmaContext.figmaFileId || '<from URL>'}"
  nodes: [{ nodeId: "<icon-node-id>", fileName: "icon-healthy-eating-plate.svg" }]
  localPath: "./public/figma-icons"
\`\`\`
Note: Save to \`public/figma-icons/\` so Next.js serves them at \`/figma-icons/*\`

This gives you EXACT colors, typography, spacing, and component-to-icon mappings!

## 🎨 Quick Reference
${(() => {
  const tokenStatus = figmaContext.tokenStatus;
  if (tokenStatus?.status === 'existing') {
    return `### ✅ TOKEN STATUS: ALL TOKENS ALREADY IMPLEMENTED
**${tokenStatus.summary}**
Design tokens are already in tailwind.config.js - DO NOT reconfigure.
Just use the existing color classes and design system.`;
  } else if (tokenStatus?.status === 'partial') {
    return `### ⚠️ TOKEN STATUS: PARTIAL MATCH
**${tokenStatus.summary}**
Some tokens exist - only add the NEW ones listed in design-tokens.json._tokenStatus`;
  } else {
    return `### 🆕 Full token setup needed from design-tokens.json`;
  }
})()}

Colors: ${Object.entries(colors).slice(0, 8).map(([n, v]) => `${n}:${v}`).join(', ') || 'See design-tokens.json'}
Font: ${styleTokens.typography?.fonts?.[0] || figmaContext.typography?.headingFont || 'Inter'}
Spacing: ${styleTokens.spacing?.slice(0, 6).join(', ') || 'See design-tokens.json'}

## 🔧 Design Token Configuration
${(() => {
  const tokenStatus = figmaContext.tokenStatus;
  if (tokenStatus?.status === 'existing') {
    return `**⚠️ SKIP THIS STEP** - Tailwind is already configured with design tokens.
Use the existing color classes (e.g., \`bg-primary\`, \`text-foreground\`).`;
  } else if (tokenStatus?.status === 'partial') {
    return `**Only add NEW tokens** - some are already configured:
\`\`\`js
// ADD these new tokens to existing tailwind.config.js
const newTokens = require('./design-tokens.json');
// Merge with existing: newTokens._tokenStatus.newTokens
\`\`\``;
  } else {
    return `\`\`\`js
const tokens = require('./design-tokens.json');
module.exports = {
  theme: { extend: { colors: tokens.tailwindExtend?.colors || {} } }
}
\`\`\``;
  }
})()}

## 📋 Rules
1. **READ reference image** before implementing each screen
2. **Use EXACT colors** from design-tokens.json
3. **Match spacing, typography, layout** from images
`;
}

/**
 * Generate design token instructions based on project source
 */
export function getDesignTokenInstructions(sourceInfo: ProjectSourceInfo): string {
  if (sourceInfo.hasFigmaDesign) {
    return `
=== DESIGN TOKEN CONFIGURATION (FROM FIGMA) ===
This project was created from a Figma design. When configuring design tokens in tailwind.config.js:

1. EXTRACT tokens from the Figma design data provided in the requirements
2. Look for color values, typography, spacing, and border-radius in the Figma context
3. Configure tailwind.config.js with these exact values:
   - colors: Extract primary, secondary, background, foreground, accent colors
   - fontFamily: Use the fonts specified in the Figma design
   - spacing: Use the spacing values from the design
   - borderRadius: Use the corner radius values from the design

4. Create CSS custom properties in globals.css that match the Figma design tokens
5. The design should be pixel-perfect to the Figma source

Example tailwind.config.js structure:
\`\`\`js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        // ... from Figma
      },
      fontFamily: {
        sans: ['var(--font-family)', 'system-ui'],
      },
    },
  },
}
\`\`\`
`;
  }

  return `
=== DESIGN TOKEN CONFIGURATION (FROM DESIGN SYSTEM) ===
This project uses a design system from settings. When configuring design tokens in tailwind.config.js:

1. Use the design system tokens provided in the "Design System" section above
2. Configure tailwind.config.js to use CSS custom properties for colors:
   - Map --primary, --secondary, --background, --foreground, etc.
3. Set up typography using the font families from the design system
4. Apply spacing and border-radius values as specified

Example tailwind.config.js structure:
\`\`\`js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        secondary: 'var(--secondary)',
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Use values from Design System section
      },
    },
  },
}
\`\`\`

Create globals.css with the CSS custom properties matching the design system tokens provided above.
`;
}
