# SmartCycle AI Design System

A dark, modern design system with purple accents designed for AI development workflows, healthcare applications, and enterprise dashboards.

## Quick Start

### 1. Install Dependencies

```bash
npm install tailwindcss postcss autoprefixer tw-animate-css tailwindcss-animate
npm install @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react
```

### 2. Copy Files

Copy these files to your project:

- `globals.css` → `app/globals.css` (or merge with existing)
- `tailwind.config.ts` → `tailwind.config.ts`

### 3. Install Fonts (Optional)

For the best experience, install Geist fonts:

```bash
npm install geist
```

In your `app/layout.tsx`:

```tsx
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

## Color Palette

### Core Colors

| Token | Value | Description |
|-------|-------|-------------|
| `--background` | `#171717` | Main background |
| `--foreground` | `#fafafa` | Primary text |
| `--card` | `#262626` | Card backgrounds |
| `--primary` | `#8b5cf6` | Purple accent |
| `--secondary` | `#404040` | Gray secondary |
| `--muted` | `#383838` | Subtle elements |
| `--border` | `#525252` | Borders |
| `--destructive` | `#ef4444` | Error/delete |

### Agent Role Colors

```css
--agent-coordinator: #8b5cf6;    /* Purple */
--agent-product-owner: #3b82f6;  /* Blue */
--agent-coder: #22c55e;          /* Green */
--agent-tester: #f59e0b;         /* Amber */
--agent-security: #ef4444;       /* Red */
--agent-fixer: #f97316;          /* Orange */
```

### Status Colors

```css
--success: #22c55e;   /* Green */
--warning: #f59e0b;   /* Amber */
--error: #ef4444;     /* Red */
--info: #3b82f6;      /* Blue */
```

## Components

### Using with shadcn/ui

This design system is compatible with [shadcn/ui](https://ui.shadcn.com/). Install components:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card badge tabs progress alert input
```

The CSS variables will automatically style shadcn/ui components.

### Example Usage

```tsx
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function ProjectCard() {
  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>My Project</CardTitle>
          <Badge className="bg-green-500/20 text-green-400">
            Completed
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Project description...</p>
        <Button className="mt-4">View Details</Button>
      </CardContent>
    </Card>
  );
}
```

### Agent Status Badge

```tsx
const agentColors = {
  coordinator: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  product_owner: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  coder: 'bg-green-500/20 text-green-400 border-green-500/30',
  tester: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  security: 'bg-red-500/20 text-red-400 border-red-500/30',
  fixer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

<Badge className={agentColors.coder}>Coder</Badge>
```

### Status Indicators

```tsx
// Animated status dot
<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />

// Static status dot
<div className="h-2 w-2 rounded-full bg-gray-500" />
```

## Typography

| Class | Font |
|-------|------|
| `font-sans` | Inter / Geist Sans |
| `font-mono` | JetBrains Mono / Geist Mono |

## Animations

### Gradient Shimmer

```tsx
<span className="animate-gradient-shimmer">
  Loading...
</span>
```

### Glow Pulse

```tsx
<h1 className="animate-glow-pulse">
  SmartCycle AI
</h1>
```

### Status Pulse

```tsx
<div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
```

## Layout Patterns

### Dashboard Layout

```tsx
<div className="min-h-screen bg-background">
  {/* Header */}
  <header className="border-b bg-card px-4 py-3">
    <h1 className="text-xl font-bold">Dashboard</h1>
  </header>

  <div className="flex">
    {/* Sidebar */}
    <aside className="w-64 border-r bg-card min-h-screen p-4">
      {/* Navigation */}
    </aside>

    {/* Main Content */}
    <main className="flex-1 p-6">
      {/* Content */}
    </main>
  </div>
</div>
```

### Card Grid

```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>
```

## Best Practices

### Do
- Use the dark theme consistently
- Use purple (`primary`) for main CTAs only
- Show loading states for async operations
- Use agent colors consistently
- Include hover and focus states
- Maintain 4.5:1 contrast ratio

### Don't
- Don't use light backgrounds
- Don't use purple for non-primary elements
- Don't hide errors without recovery options
- Don't mix agent colors incorrectly
- Don't skip loading states

## Files Included

```
smartcycle-ai-design-system/
├── globals.css           # CSS variables and base styles
├── tailwind.config.ts    # Tailwind configuration
├── design-tokens.json    # Raw design tokens
└── README.md            # This file
```

## License

MIT License - Feel free to use in your projects.

---

Built with SmartCycle AI Platform
