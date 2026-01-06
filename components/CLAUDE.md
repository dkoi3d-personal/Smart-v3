# Components Directory

Shared React components used across the application.

## Quick Start

```typescript
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { FleetDashboard } from '@/components/panels/FleetDashboard';
```

## Structure

```
components/
├── ui/                 # Base UI primitives (shadcn-style)
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   └── ...
├── panels/             # Complex panel components
│   ├── FleetDashboard.tsx
│   ├── ArchitecturePanel.tsx
│   └── ComplianceTab.tsx (1,532 lines - LARGE)
├── fleet/              # Fleet-specific components
│   └── DecompositionOverlay.tsx
└── [other].tsx         # Standalone components
```

## Key Components

### UI Primitives (`ui/`)
Standard shadcn/ui components. Import from `@/components/ui/[name]`.

### Panels (`panels/`)
| Component | Lines | Purpose |
|-----------|-------|---------|
| `FleetDashboard.tsx` | ~500 | Main fleet monitoring panel |
| `ArchitecturePanel.tsx` | 1,294 | Architecture visualization |
| `ComplianceTab.tsx` | 1,532 | HIPAA compliance checklist (LARGE) |

## Common Operations

### Add a new UI component
1. Create `ui/my-component.tsx`
2. Use shadcn patterns (forwardRef, cn utility)
3. Export from component file

### Add a new panel
1. Create `panels/MyPanel.tsx`
2. Keep under 500 lines - extract sub-components if larger
3. Use composition from `ui/` components

## Patterns

```typescript
// Standard component pattern
import { cn } from '@/lib/utils';
import { forwardRef } from 'react';

interface MyComponentProps {
  className?: string;
  children: React.ReactNode;
}

export const MyComponent = forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div ref={ref} className={cn('base-styles', className)} {...props}>
        {children}
      </div>
    );
  }
);
MyComponent.displayName = 'MyComponent';
```

## Gotchas & Warnings

1. **ComplianceTab.tsx is 1,532 lines** - Needs splitting
2. **Use ui/ for primitives** - Don't recreate buttons/cards
3. **cn() for class merging** - Import from `@/lib/utils`
4. **forwardRef for DOM refs** - Required for form components

## Related Code

- **Uses**: `@/lib/utils` for cn(), `class-variance-authority` for variants
- **Used by**: `app/` pages, `features/` components
- **Styles**: Tailwind classes, CSS variables from design system
