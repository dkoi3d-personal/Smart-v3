/**
 * SmartCycle AI Design System
 *
 * The official design system for the SmartCycle AI Platform.
 * Features a dark, modern aesthetic with purple accents.
 *
 * Key characteristics:
 * - Dark backgrounds with subtle depth
 * - Purple primary color (violet-500)
 * - High contrast for readability
 * - Modern, developer-focused aesthetic
 * - Healthcare/enterprise ready
 */

import type { DesignSystem } from '../types';

export function getSmartCycleAIDesignSystem(): DesignSystem {
  return {
    id: 'smartcycle-ai',
    name: 'SmartCycle AI',
    description: 'The official SmartCycle AI Platform design system. A dark, modern theme with purple accents designed for AI development workflows, healthcare applications, and enterprise dashboards.',
    version: '1.0.0',
    isDefault: true,
    isBuiltIn: true,
    createdAt: '2025-01-19T00:00:00.000Z',
    updatedAt: '2025-01-19T00:00:00.000Z',
    source: { type: 'builtin' },

    tokens: {
      colors: {
        // ============================================
        // DARK THEME (Primary - Always Dark)
        // ============================================

        // Backgrounds - Deep dark with subtle warmth
        background: '#171717',           // oklch(0.10 0 0) - Main background
        foreground: '#fafafa',           // oklch(0.985 0 0) - Primary text

        // Cards - Slightly elevated surfaces
        card: '#262626',                 // oklch(0.15 0 0) - Card background
        cardForeground: '#fafafa',       // Card text

        // Popovers/Dropdowns
        popover: '#262626',              // Same as card
        popoverForeground: '#fafafa',

        // Primary - Purple (Violet)
        primary: '#8b5cf6',              // oklch(0.65 0.25 265) - Violet-500
        primaryForeground: '#fafafa',

        // Secondary - Subtle gray
        secondary: '#404040',            // oklch(0.25 0 0)
        secondaryForeground: '#fafafa',

        // Muted - For disabled/subtle elements
        muted: '#383838',                // oklch(0.22 0 0)
        mutedForeground: '#a3a3a3',      // oklch(0.65 0 0)

        // Accent - Same as secondary for consistency
        accent: '#404040',
        accentForeground: '#fafafa',

        // Destructive - Red for errors/delete
        destructive: '#ef4444',          // oklch(0.60 0.25 25) - Red-500
        destructiveForeground: '#fafafa',

        // Borders and inputs
        border: '#525252',               // oklch(0.35 0 0)
        input: '#404040',                // oklch(0.30 0 0)
        ring: '#8b5cf6',                 // Same as primary

        // Chart colors - Vibrant for data viz
        chart1: '#8b5cf6',               // Purple
        chart2: '#22c55e',               // Green
        chart3: '#f59e0b',               // Amber
        chart4: '#a855f7',               // Violet
        chart5: '#ef4444',               // Red

        // Status colors
        success: '#22c55e',              // Green-500
        successForeground: '#ffffff',
        warning: '#f59e0b',              // Amber-500
        warningForeground: '#171717',
        error: '#ef4444',                // Red-500
        errorForeground: '#ffffff',
        info: '#3b82f6',                 // Blue-500
        infoForeground: '#ffffff',

        // Custom brand colors
        custom: {
          // Agent role colors
          'agent-coordinator': '#8b5cf6',    // Purple - Coordinator
          'agent-product-owner': '#3b82f6',  // Blue - Product Owner
          'agent-coder': '#22c55e',          // Green - Coder
          'agent-tester': '#f59e0b',         // Amber - Tester
          'agent-security': '#ef4444',       // Red - Security
          'agent-fixer': '#f97316',          // Orange - Fixer

          // Healthcare/compliance
          'hipaa': '#10b981',                // Emerald
          'soc2': '#6366f1',                 // Indigo
          'fhir': '#0ea5e9',                 // Sky

          // Gradients (start colors)
          'gradient-purple-start': '#8b5cf6',
          'gradient-purple-end': '#6366f1',
          'gradient-green-start': '#22c55e',
          'gradient-green-end': '#10b981',
        },
      },

      spacing: {
        unit: 4,
        scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64],
      },

      typography: {
        fontFamily: {
          sans: '"Inter", "Geist Sans", system-ui, -apple-system, sans-serif',
          mono: '"Geist Mono", "JetBrains Mono", "Fira Code", monospace',
          display: '"Inter", "Geist Sans", system-ui, sans-serif',
        },
        fontSize: {
          xs: { size: '0.75rem', lineHeight: '1rem' },
          sm: { size: '0.875rem', lineHeight: '1.25rem' },
          base: { size: '1rem', lineHeight: '1.5rem' },
          lg: { size: '1.125rem', lineHeight: '1.75rem' },
          xl: { size: '1.25rem', lineHeight: '1.75rem' },
          '2xl': { size: '1.5rem', lineHeight: '2rem' },
          '3xl': { size: '1.875rem', lineHeight: '2.25rem' },
          '4xl': { size: '2.25rem', lineHeight: '2.5rem' },
          '5xl': { size: '3rem', lineHeight: '1.1' },
          '6xl': { size: '3.75rem', lineHeight: '1' },
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
      },

      radii: {
        none: '0',
        sm: '0.375rem',      // 6px
        md: '0.5rem',        // 8px
        lg: '0.625rem',      // 10px (--radius)
        xl: '1rem',          // 16px
        '2xl': '1.5rem',     // 24px
        full: '9999px',
      },

      shadows: {
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.3)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.3)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.3)',
        xl: '0 20px 25px -5px rgb(0 0 0 / 0.4), 0 8px 10px -6px rgb(0 0 0 / 0.3)',
        'glow-purple': '0 0 20px rgba(139, 92, 246, 0.3)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.3)',
      },

      transitions: {
        duration: {
          fast: '150ms',
          normal: '200ms',
          slow: '300ms',
        },
        easing: {
          default: 'cubic-bezier(0.4, 0, 0.2, 1)',
          in: 'cubic-bezier(0.4, 0, 1, 1)',
          out: 'cubic-bezier(0, 0, 0.2, 1)',
          inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },

    components: {
      button: {
        name: 'Button',
        description: 'Primary action buttons with purple accent. Used for CTAs and important actions.',
        variants: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
        sizes: ['sm', 'md', 'lg', 'icon'],
        states: ['default', 'hover', 'active', 'disabled', 'focus'],
        props: {
          variant: { type: 'string', default: 'default' },
          size: { type: 'string', default: 'md' },
          disabled: { type: 'boolean', default: 'false' },
        },
        usage: `## Button Usage

Primary buttons use the purple accent color.

\`\`\`tsx
// Primary action - purple
<Button>Start Build</Button>

// Secondary action - gray background
<Button variant="secondary">View Projects</Button>

// Outline for less emphasis
<Button variant="outline">Cancel</Button>

// Ghost for subtle actions
<Button variant="ghost" size="icon">
  <Settings className="h-4 w-4" />
</Button>

// Destructive for dangerous actions
<Button variant="destructive">Delete Project</Button>

// With loading state
<Button disabled>
  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  Building...
</Button>
\`\`\``,
        doAndDont: {
          do: [
            'Use primary purple buttons for main CTAs',
            'Use secondary for supporting actions',
            'Include loading states for async actions',
            'Use icons to enhance recognition',
          ],
          dont: [
            'Don\'t use multiple primary buttons in one section',
            'Don\'t use red for non-destructive actions',
            'Don\'t disable without showing why',
          ],
        },
      },

      card: {
        name: 'Card',
        description: 'Content container with dark elevated surface. Core UI building block.',
        variants: ['default', 'outlined', 'elevated', 'interactive'],
        states: ['default', 'hover', 'selected'],
        props: {
          variant: { type: 'string', default: 'default' },
        },
        usage: `## Card Usage

Cards use a slightly elevated dark surface (#262626).

\`\`\`tsx
<Card>
  <CardHeader>
    <CardTitle>Project Name</CardTitle>
    <CardDescription>Project description</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
  <CardFooter>
    <Button>Action</Button>
  </CardFooter>
</Card>

// Interactive card with hover
<Card className="hover:border-primary/50 transition-colors cursor-pointer">
  {/* Clickable content */}
</Card>

// With status indicator
<Card className="border-l-4 border-l-green-500">
  <CardContent className="pt-6">
    Build completed successfully
  </CardContent>
</Card>
\`\`\``,
      },

      badge: {
        name: 'Badge',
        description: 'Status indicators and labels for agent states, build status, etc.',
        variants: ['default', 'secondary', 'success', 'warning', 'destructive', 'outline'],
        states: ['default'],
        props: {
          variant: { type: 'string', default: 'default' },
        },
        usage: `## Badge Usage

\`\`\`tsx
// Build status
<Badge className="bg-green-500/20 text-green-400 border-green-500/30">
  Completed
</Badge>
<Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
  Building
</Badge>
<Badge className="bg-red-500/20 text-red-400 border-red-500/30">
  Failed
</Badge>

// Agent roles
<Badge className="bg-purple-500/20 text-purple-400">Coordinator</Badge>
<Badge className="bg-blue-500/20 text-blue-400">Product Owner</Badge>
<Badge className="bg-green-500/20 text-green-400">Coder</Badge>
<Badge className="bg-amber-500/20 text-amber-400">Tester</Badge>
<Badge className="bg-red-500/20 text-red-400">Security</Badge>

// Compliance badges
<Badge className="bg-emerald-600/90 text-white">HIPAA</Badge>
<Badge className="bg-blue-600/90 text-white">HL7 FHIR</Badge>
<Badge className="bg-purple-600/90 text-white">SOC 2</Badge>
\`\`\``,
      },

      tabs: {
        name: 'Tabs',
        description: 'Navigation tabs for switching between views.',
        variants: ['default', 'pills', 'underline'],
        states: ['default', 'active', 'disabled'],
        props: {
          defaultValue: { type: 'string' },
        },
        usage: `## Tabs Usage

\`\`\`tsx
<Tabs defaultValue="code" className="w-full">
  <TabsList className="bg-muted">
    <TabsTrigger value="code">
      <Code2 className="h-4 w-4 mr-2" />
      Code
    </TabsTrigger>
    <TabsTrigger value="preview">
      <Eye className="h-4 w-4 mr-2" />
      Preview
    </TabsTrigger>
    <TabsTrigger value="terminal">
      <Terminal className="h-4 w-4 mr-2" />
      Terminal
    </TabsTrigger>
  </TabsList>
  <TabsContent value="code">
    {/* Code editor */}
  </TabsContent>
</Tabs>
\`\`\``,
      },

      progress: {
        name: 'Progress',
        description: 'Progress indicators for build status and loading states.',
        variants: ['default', 'success', 'warning', 'error'],
        states: ['default', 'indeterminate'],
        props: {
          value: { type: 'number', default: '0' },
        },
        usage: `## Progress Usage

\`\`\`tsx
// Build progress
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Building...</span>
    <span>75%</span>
  </div>
  <Progress value={75} className="h-2" />
</div>

// Agent status
<div className="flex items-center gap-3">
  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
  <span className="text-sm">Coder working...</span>
  <Progress value={45} className="flex-1 h-1" />
</div>

// Colored variants
<Progress value={100} className="bg-green-950" indicatorClassName="bg-green-500" />
<Progress value={50} className="bg-yellow-950" indicatorClassName="bg-yellow-500" />
<Progress value={25} className="bg-red-950" indicatorClassName="bg-red-500" />
\`\`\``,
      },

      alert: {
        name: 'Alert',
        description: 'Important messages and notifications.',
        variants: ['default', 'success', 'warning', 'destructive', 'info'],
        states: ['default'],
        props: {
          variant: { type: 'string', default: 'default' },
        },
        usage: `## Alert Usage

\`\`\`tsx
// Build success
<Alert className="border-green-500/50 bg-green-500/10">
  <CheckCircle className="h-4 w-4 text-green-500" />
  <AlertTitle>Build Complete</AlertTitle>
  <AlertDescription>
    Your project has been built successfully.
  </AlertDescription>
</Alert>

// Error alert
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Build Failed</AlertTitle>
  <AlertDescription>
    Check the terminal for error details.
  </AlertDescription>
</Alert>

// Info alert
<Alert className="border-blue-500/50 bg-blue-500/10">
  <Info className="h-4 w-4 text-blue-500" />
  <AlertTitle>Tip</AlertTitle>
  <AlertDescription>
    Use /fix to automatically repair errors.
  </AlertDescription>
</Alert>
\`\`\``,
      },

      input: {
        name: 'Input',
        description: 'Text inputs with dark styling.',
        variants: ['default', 'error'],
        states: ['default', 'focus', 'disabled', 'error'],
        props: {
          type: { type: 'string', default: 'text' },
          placeholder: { type: 'string' },
        },
        usage: `## Input Usage

\`\`\`tsx
// Standard input
<Input
  placeholder="Enter project name..."
  className="bg-input border-border"
/>

// With label
<div className="space-y-2">
  <Label htmlFor="name">Project Name</Label>
  <Input id="name" placeholder="my-project" />
</div>

// Textarea for requirements
<Textarea
  placeholder="Describe your application..."
  className="min-h-[120px] bg-input"
/>

// Search input
<div className="relative">
  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
  <Input className="pl-10" placeholder="Search projects..." />
</div>
\`\`\``,
      },

      dialog: {
        name: 'Dialog',
        description: 'Modal dialogs for confirmations and forms.',
        variants: ['default', 'alert'],
        states: ['open', 'closed'],
        props: {
          open: { type: 'boolean' },
        },
        usage: `## Dialog Usage

\`\`\`tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>New Project</Button>
  </DialogTrigger>
  <DialogContent className="bg-card border-border">
    <DialogHeader>
      <DialogTitle>Create New Project</DialogTitle>
      <DialogDescription>
        Enter your project details below.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <Input placeholder="Project name" />
      <Textarea placeholder="Requirements..." />
    </div>
    <DialogFooter>
      <Button variant="outline">Cancel</Button>
      <Button>Create</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
\`\`\``,
      },
    },

    guidelines: `# SmartCycle AI Design System Guidelines

## Brand Overview

SmartCycle AI is a multi-agent development platform that orchestrates specialized AI agents to build software. The design system reflects a modern, developer-focused aesthetic with a dark theme and purple accents.

## Color Philosophy

### Dark Theme (Always On)
The platform uses a dark theme exclusively for:
- Reduced eye strain during long coding sessions
- Better contrast for code and terminal output
- Modern, professional appearance

### Purple Primary (#8b5cf6)
- Represents AI, intelligence, and creativity
- Used for primary CTAs, active states, focus rings
- Creates visual hierarchy against dark backgrounds

### Agent Colors
Each agent role has a distinct color for easy identification:
- **Coordinator**: Purple (#8b5cf6)
- **Product Owner**: Blue (#3b82f6)
- **Coder**: Green (#22c55e)
- **Tester**: Amber (#f59e0b)
- **Security**: Red (#ef4444)
- **Fixer**: Orange (#f97316)

### Status Colors
- **Success**: Green (#22c55e) - Builds complete, tests pass
- **Warning**: Amber (#f59e0b) - Attention needed
- **Error**: Red (#ef4444) - Build failures, errors
- **Info**: Blue (#3b82f6) - Informational messages

## Typography

### Inter (Primary)
- Clean, modern sans-serif
- Used for all UI text
- Weights: 400 (normal), 500 (medium), 600 (semibold), 700 (bold)

### Geist Mono (Code)
- Monospace for code, terminal output
- Excellent readability at small sizes
- Used in editors, logs, file paths

## Layout Patterns

### Dashboard Layout
\`\`\`
┌─────────────────────────────────────────┐
│ Header (border-b, bg-card)              │
├─────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────────────────────┐ │
│ │ Sidebar │ │ Main Content            │ │
│ │ (bg-card│ │ (bg-background)         │ │
│ │ border-r│ │                         │ │
│ └─────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────┘
\`\`\`

### Card Grid
- Use gap-4 or gap-6 between cards
- Cards have bg-card, border-border
- Hover states: hover:border-primary/50

### Agent Status Panel
- Vertical list with status indicators
- Animated dots for active agents
- Progress bars for task completion

## Animation Guidelines

### Transitions
- Use 200ms for most transitions
- Use 150ms for hover states
- Use 300ms for modal open/close

### Loading States
- Pulse animation for status dots
- Spin animation for loaders
- Gradient shimmer for text loading

### Micro-interactions
- Button hover: slight scale + glow
- Card hover: border highlight
- Focus: ring-2 ring-primary

## Accessibility

- Maintain 4.5:1 contrast ratio minimum
- Use focus-visible for keyboard navigation
- Include sr-only labels for icons
- Support keyboard navigation in all interactive elements

## Do's and Don'ts

### Do
- Use the dark theme consistently
- Use purple for primary actions only
- Show loading states for async operations
- Use agent colors consistently
- Include hover and focus states

### Don't
- Don't use light backgrounds
- Don't use purple for non-primary elements
- Don't hide errors without recovery options
- Don't mix agent colors incorrectly
- Don't skip loading states`,

    examples: [
      {
        id: 'smartcycle-globals-css',
        title: 'globals.css',
        description: 'Complete CSS variables for the SmartCycle AI theme',
        language: 'css',
        code: `/* SmartCycle AI Design System - globals.css */
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar: var(--sidebar);
  --color-chart-5: var(--chart-5);
  --color-chart-4: var(--chart-4);
  --color-chart-3: var(--chart-3);
  --color-chart-2: var(--chart-2);
  --color-chart-1: var(--chart-1);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-accent-foreground: var(--accent-foreground);
  --color-accent: var(--accent);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-secondary: var(--secondary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-popover-foreground: var(--popover-foreground);
  --color-popover: var(--popover);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

:root {
  --radius: 0.625rem;

  /* SmartCycle AI Dark Theme */
  --background: oklch(0.10 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.15 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.15 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.65 0.25 265);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.25 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.22 0 0);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(0.25 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.60 0.25 25);
  --border: oklch(0.35 0 0);
  --input: oklch(0.30 0 0);
  --ring: oklch(0.65 0.25 265);
  --chart-1: oklch(0.65 0.25 265);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.15 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.65 0.25 265);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.25 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.35 0 0);
  --sidebar-ring: oklch(0.65 0.25 265);
}

.dark {
  /* Same as root - always dark */
  --background: oklch(0.10 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.15 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.15 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.65 0.25 265);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.25 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.22 0 0);
  --muted-foreground: oklch(0.65 0 0);
  --accent: oklch(0.25 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.60 0.25 25);
  --border: oklch(0.35 0 0);
  --input: oklch(0.30 0 0);
  --ring: oklch(0.65 0.25 265);
  --chart-1: oklch(0.65 0.25 265);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.15 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.65 0.25 265);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.25 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.35 0 0);
  --sidebar-ring: oklch(0.65 0.25 265);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}`,
        tags: ['css', 'theme', 'variables', 'dark-mode'],
      },
      {
        id: 'smartcycle-agent-status',
        title: 'Agent Status Component',
        description: 'Display agent status with role-specific colors',
        language: 'tsx',
        code: `import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const agentColors = {
  coordinator: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  product_owner: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  coder: 'bg-green-500/20 text-green-400 border-green-500/30',
  tester: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  fixer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const statusColors = {
  idle: 'bg-gray-500',
  working: 'bg-green-500 animate-pulse',
  completed: 'bg-green-500',
  error: 'bg-red-500',
};

interface AgentStatusProps {
  role: keyof typeof agentColors;
  name: string;
  status: keyof typeof statusColors;
}

export function AgentStatus({ role, name, status }: AgentStatusProps) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-card border border-border">
      <div className="flex items-center gap-3">
        <div className={cn('h-2 w-2 rounded-full', statusColors[status])} />
        <span className="font-medium">{name}</span>
      </div>
      <Badge className={cn('text-xs', agentColors[role])}>
        {role.replace('_', ' ')}
      </Badge>
    </div>
  );
}

// Usage
<div className="space-y-2">
  <AgentStatus role="coordinator" name="Coordinator" status="working" />
  <AgentStatus role="product_owner" name="Product Owner" status="completed" />
  <AgentStatus role="coder" name="Coder" status="working" />
  <AgentStatus role="tester" name="Tester" status="idle" />
  <AgentStatus role="security" name="Security" status="idle" />
</div>`,
        tags: ['component', 'agent', 'status', 'badge'],
      },
      {
        id: 'smartcycle-build-card',
        title: 'Build Card Component',
        description: 'Project build card with status indicators',
        language: 'tsx',
        code: `import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Play, Pause, Eye, Trash2 } from 'lucide-react';

interface BuildCardProps {
  name: string;
  description: string;
  status: 'idle' | 'building' | 'completed' | 'error';
  progress: number;
  onView: () => void;
  onStart: () => void;
}

const statusConfig = {
  idle: { label: 'Idle', className: 'bg-gray-500/20 text-gray-400' },
  building: { label: 'Building', className: 'bg-yellow-500/20 text-yellow-400' },
  completed: { label: 'Completed', className: 'bg-green-500/20 text-green-400' },
  error: { label: 'Error', className: 'bg-red-500/20 text-red-400' },
};

export function BuildCard({ name, description, status, progress, onView, onStart }: BuildCardProps) {
  const config = statusConfig[status];

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{name}</CardTitle>
          <Badge className={config.className}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
        {status === 'building' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        )}
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onView}>
          <Eye className="h-4 w-4 mr-1" />
          View
        </Button>
        {status === 'idle' && (
          <Button size="sm" onClick={onStart}>
            <Play className="h-4 w-4 mr-1" />
            Start
          </Button>
        )}
        {status === 'building' && (
          <Button size="sm" variant="secondary">
            <Pause className="h-4 w-4 mr-1" />
            Pause
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}`,
        tags: ['component', 'card', 'build', 'project'],
      },
      {
        id: 'smartcycle-terminal',
        title: 'Terminal Output Component',
        description: 'Styled terminal output for build logs',
        language: 'tsx',
        code: `import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface TerminalLine {
  type: 'info' | 'success' | 'error' | 'warning' | 'command';
  content: string;
  timestamp?: Date;
}

interface TerminalProps {
  lines: TerminalLine[];
  className?: string;
}

const lineColors = {
  info: 'text-gray-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warning: 'text-yellow-400',
  command: 'text-purple-400',
};

export function Terminal({ lines, className }: TerminalProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className={cn('bg-[#0d1117] rounded-lg border border-border overflow-hidden', className)}>
      <div className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <div className="h-3 w-3 rounded-full bg-yellow-500" />
          <div className="h-3 w-3 rounded-full bg-green-500" />
        </div>
        <span className="text-xs text-muted-foreground">Terminal</span>
      </div>
      <div
        ref={scrollRef}
        className="p-4 h-[300px] overflow-y-auto font-mono text-sm"
      >
        {lines.map((line, i) => (
          <div key={i} className={cn('py-0.5', lineColors[line.type])}>
            {line.type === 'command' && (
              <span className="text-muted-foreground mr-2">$</span>
            )}
            {line.content}
          </div>
        ))}
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>$</span>
          <span className="animate-pulse">_</span>
        </div>
      </div>
    </div>
  );
}

// Usage
<Terminal
  lines={[
    { type: 'command', content: 'npm run build' },
    { type: 'info', content: 'Starting build...' },
    { type: 'info', content: 'Compiling TypeScript...' },
    { type: 'success', content: '✓ Build completed in 2.3s' },
    { type: 'warning', content: '⚠ 2 warnings found' },
    { type: 'error', content: '✗ Error: Module not found' },
  ]}
/>`,
        tags: ['component', 'terminal', 'logs', 'output'],
      },
    ],
  };
}
