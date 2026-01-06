/**
 * Obsidian Design System
 *
 * A premium dark theme with warm undertones, refined violet accents,
 * and sophisticated depth. Designed to feel luxurious, not "techy".
 *
 * Philosophy:
 * - Warm dark backgrounds (slight purple undertone)
 * - Off-white text for reduced eye strain
 * - Jewel tone status colors (emerald, amber, coral, sapphire)
 * - Glass effects for depth and sophistication
 * - Generous spacing for a luxurious feel
 *
 * Inspired by: Linear, Vercel, Arc, Raycast
 * Color science: OKLCH for perceptual uniformity
 *
 * @version 2.0.0
 */

import type { DesignSystem } from '../types';

export function getModernDarkDesignSystem(): DesignSystem {
  return {
    id: 'modern-dark',
    name: 'Obsidian',
    description: 'A premium dark theme with warm undertones and refined violet accents. Sophisticated, elegant, and easy on the eyes. Feels luxurious, not techy.',
    version: '2.0.0',
    isDefault: true,
    isBuiltIn: true,
    createdAt: '2024-12-01T00:00:00.000Z',
    updatedAt: '2025-12-20T00:00:00.000Z',
    source: { type: 'builtin' },

    tokens: {
      colors: {
        // =================================================================
        // BACKGROUND LAYER SYSTEM
        // Warm undertones with subtle purple for depth, not cold gray
        // =================================================================
        background: 'oklch(0.11 0.01 285)',      // #0F0F12 - base layer, slight purple
        foreground: 'oklch(0.93 0.01 285)',      // #ECECEF - off-white, not pure white
        card: 'oklch(0.14 0.01 285)',            // #18181C - elevated surface
        cardForeground: 'oklch(0.93 0.01 285)',  // matches foreground
        popover: 'oklch(0.16 0.01 285)',         // #1C1C22 - highest elevation
        popoverForeground: 'oklch(0.93 0.01 285)',

        // =================================================================
        // ACCENT COLORS
        // Refined violet - sophisticated, not neon
        // =================================================================
        primary: 'oklch(0.62 0.22 280)',         // #7C5CFF - refined violet
        primaryForeground: 'oklch(0.98 0 0)',    // white text on primary
        secondary: 'oklch(0.20 0.01 285)',       // #28282E - subtle elevated
        secondaryForeground: 'oklch(0.90 0.01 285)',
        accent: 'oklch(0.22 0.02 285)',          // #2E2E36 - hover states
        accentForeground: 'oklch(0.93 0.01 285)',

        // =================================================================
        // MUTED & BORDERS
        // Nearly invisible borders, balanced muted text
        // =================================================================
        muted: 'oklch(0.18 0.01 285)',           // #222228 - muted backgrounds
        mutedForeground: 'oklch(0.58 0.02 285)', // #8B8B97 - secondary text
        border: 'oklch(0.22 0.01 285)',          // #2A2A32 - subtle borders
        input: 'oklch(0.16 0.01 285)',           // input backgrounds
        ring: 'oklch(0.62 0.22 280)',            // focus ring (primary)

        // =================================================================
        // DESTRUCTIVE
        // Soft coral-red, not aggressive
        // =================================================================
        destructive: 'oklch(0.65 0.20 20)',      // #F87171 - soft coral-red
        destructiveForeground: 'oklch(0.98 0 0)',

        // =================================================================
        // JEWEL TONE STATUS COLORS
        // Premium feel, not primary colors
        // =================================================================
        success: 'oklch(0.72 0.19 160)',         // #34D399 - emerald
        successForeground: 'oklch(0.15 0.03 160)',
        warning: 'oklch(0.80 0.16 85)',          // #FBBF24 - amber
        warningForeground: 'oklch(0.20 0.05 85)',
        error: 'oklch(0.65 0.20 20)',            // #F87171 - coral
        errorForeground: 'oklch(0.98 0 0)',
        info: 'oklch(0.68 0.15 250)',            // #60A5FA - sapphire
        infoForeground: 'oklch(0.15 0.03 250)',

        // =================================================================
        // CHART COLORS
        // Harmonious jewel tones for data visualization
        // =================================================================
        chart1: 'oklch(0.62 0.22 280)',          // violet
        chart2: 'oklch(0.72 0.19 160)',          // emerald
        chart3: 'oklch(0.80 0.16 85)',           // amber
        chart4: 'oklch(0.68 0.15 250)',          // sapphire
        chart5: 'oklch(0.65 0.18 330)',          // rose
      },

      spacing: {
        unit: 4,
        scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96],
      },

      typography: {
        fontFamily: {
          sans: 'var(--font-geist-sans), "Inter", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
          mono: 'var(--font-geist-mono), "JetBrains Mono", ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
          display: 'var(--font-geist-sans), "Inter", ui-sans-serif, system-ui',
        },
        fontSize: {
          xs: { size: '0.75rem', lineHeight: '1rem', letterSpacing: '0.01em' },
          sm: { size: '0.875rem', lineHeight: '1.25rem', letterSpacing: '0' },
          base: { size: '1rem', lineHeight: '1.5rem', letterSpacing: '-0.01em' },
          lg: { size: '1.125rem', lineHeight: '1.75rem', letterSpacing: '-0.01em' },
          xl: { size: '1.25rem', lineHeight: '1.75rem', letterSpacing: '-0.02em' },
          '2xl': { size: '1.5rem', lineHeight: '2rem', letterSpacing: '-0.02em' },
          '3xl': { size: '1.875rem', lineHeight: '2.25rem', letterSpacing: '-0.02em' },
          '4xl': { size: '2.25rem', lineHeight: '2.5rem', letterSpacing: '-0.03em' },
          '5xl': { size: '3rem', lineHeight: '1', letterSpacing: '-0.03em' },
          '6xl': { size: '3.75rem', lineHeight: '1', letterSpacing: '-0.03em' },
        },
        fontWeight: {
          light: 300,
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
      },

      radii: {
        none: '0',
        sm: '0.375rem',    // 6px - subtle rounding
        md: '0.5rem',      // 8px - buttons, inputs
        lg: '0.75rem',     // 12px - cards
        xl: '1rem',        // 16px - modals, large cards
        '2xl': '1.5rem',   // 24px - hero sections
        full: '9999px',    // pills, avatars
      },

      shadows: {
        // Subtle, warm shadows that add depth without harshness
        sm: '0 1px 2px rgba(0, 0, 0, 0.3)',
        md: '0 4px 12px rgba(0, 0, 0, 0.25)',
        lg: '0 8px 24px rgba(0, 0, 0, 0.3)',
        xl: '0 16px 48px rgba(0, 0, 0, 0.35)',
        // Glow effects for focus states
        glow: '0 0 20px rgba(124, 92, 255, 0.25)',
        'glow-sm': '0 0 10px rgba(124, 92, 255, 0.15)',
        'glow-lg': '0 0 40px rgba(124, 92, 255, 0.35)',
        // Inner shadow for inset inputs
        inner: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
      },

      transitions: {
        duration: {
          instant: '75ms',
          fast: '150ms',
          normal: '200ms',
          slow: '300ms',
          slower: '500ms',
        },
        easing: {
          default: 'cubic-bezier(0.4, 0, 0.2, 1)',
          in: 'cubic-bezier(0.4, 0, 1, 1)',
          out: 'cubic-bezier(0, 0, 0.2, 1)',
          inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
          bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
          spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        },
      },
    },

    components: {
      button: {
        name: 'Button',
        description: 'Premium buttons with subtle gradients and glow effects. Use primary for main actions, ghost for minimal UI.',
        variants: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
        sizes: ['xs', 'sm', 'default', 'lg', 'icon'],
        states: ['default', 'hover', 'focus', 'active', 'disabled', 'loading'],
        props: {
          variant: { type: 'string', default: 'default', options: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] },
          size: { type: 'string', default: 'default', options: ['xs', 'sm', 'default', 'lg', 'icon'] },
          disabled: { type: 'boolean', default: 'false' },
          loading: { type: 'boolean', default: 'false' },
        },
        usage: `\`\`\`tsx
// Primary - subtle gradient, hover glow
<Button className="bg-gradient-to-b from-primary/90 to-primary hover:shadow-glow transition-all">
  Get Started
</Button>

// Ghost - appears on hover
<Button variant="ghost" className="hover:bg-accent">
  Cancel
</Button>

// With loading state
<Button disabled className="relative">
  <Loader2 className="h-4 w-4 animate-spin" />
  <span className="ml-2">Processing...</span>
</Button>
\`\`\``,
        doAndDont: {
          do: [
            'Use subtle gradient on primary buttons (from-primary/90 to-primary)',
            'Add glow effect on hover for important actions',
            'Keep labels short and action-oriented',
            'Use the loading state for async actions',
          ],
          dont: [
            'Use bright/neon colors - keep it refined',
            'Add too many button variants in one view',
            'Use link variant for important actions',
            'Skip the loading state for slow actions',
          ],
        },
      },

      card: {
        name: 'Card',
        description: 'Glass-effect cards with subtle borders and premium hover states. Use for grouping related content.',
        variants: ['default', 'glass', 'elevated', 'bordered', 'interactive'],
        states: ['default', 'hover', 'selected', 'disabled'],
        props: {
          variant: { type: 'string', default: 'default' },
          interactive: { type: 'boolean', default: 'false' },
        },
        usage: `\`\`\`tsx
// Glass effect card - premium feel
<Card className="bg-card/50 backdrop-blur-xl border-border/50 hover:border-primary/30 transition-colors">
  <CardContent className="p-6">
    <h3 className="text-lg font-medium">Premium Card</h3>
    <p className="text-muted-foreground mt-2">Glass effect with backdrop blur</p>
  </CardContent>
</Card>

// Interactive card with hover effect
<Card className="group cursor-pointer hover:bg-accent/50 transition-all hover:shadow-lg">
  <CardContent className="p-6">
    <h3 className="group-hover:text-primary transition-colors">Click me</h3>
  </CardContent>
</Card>
\`\`\``,
        doAndDont: {
          do: [
            'Use backdrop-blur for glass effect (backdrop-blur-xl)',
            'Add subtle border transitions on hover',
            'Use generous padding (p-6) for luxury feel',
            'Group related cards with consistent spacing',
          ],
          dont: [
            'Use harsh borders (prefer border-border/50)',
            'Nest cards within cards',
            'Overcrowd cards with too much content',
            'Mix glass and solid cards in the same section',
          ],
        },
      },

      badge: {
        name: 'Badge',
        description: 'Jewel-tone badges for status and categories. Subtle backgrounds with matching text colors.',
        variants: ['default', 'secondary', 'success', 'warning', 'error', 'info', 'outline'],
        sizes: ['sm', 'default', 'lg'],
        states: ['default'],
        props: {
          variant: { type: 'string', default: 'default' },
          size: { type: 'string', default: 'default' },
        },
        usage: `\`\`\`tsx
// Jewel tone status badges
<Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25">
  Active
</Badge>
<Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25">
  Pending
</Badge>
<Badge className="bg-rose-500/15 text-rose-400 border-rose-500/25">
  Failed
</Badge>
<Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25">
  In Progress
</Badge>

// Pill shape for modern look
<Badge className="rounded-full bg-primary/15 text-primary">
  New Feature
</Badge>
\`\`\``,
        doAndDont: {
          do: [
            'Use low opacity backgrounds (15-20%)',
            'Match border color to text at lower opacity',
            'Use pill shape (rounded-full) for modern feel',
            'Be consistent with status colors across the app',
          ],
          dont: [
            'Use solid bright backgrounds',
            'Put long text in badges',
            'Use primary color for all badges',
            'Mix badge styles in the same context',
          ],
        },
      },

      input: {
        name: 'Input',
        description: 'Refined inputs with inset feel, glow focus states, and subtle animations.',
        variants: ['default', 'error', 'success'],
        sizes: ['sm', 'default', 'lg'],
        states: ['default', 'hover', 'focus', 'error', 'disabled'],
        props: {
          type: { type: 'string', default: 'text' },
          error: { type: 'boolean', default: 'false' },
          disabled: { type: 'boolean', default: 'false' },
        },
        usage: `\`\`\`tsx
// Default input with glow focus
<Input
  className="bg-input border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
  placeholder="Enter your email..."
/>

// Error state
<Input
  className="bg-input border-red-500/50 focus:border-red-500 focus:ring-2 focus:ring-red-500/20"
  placeholder="Invalid input"
/>

// With floating label effect
<div className="relative">
  <Input id="name" className="peer placeholder:text-transparent" placeholder="Name" />
  <Label
    htmlFor="name"
    className="absolute left-3 -top-2.5 text-xs bg-background px-1 text-muted-foreground peer-placeholder-shown:top-2.5 peer-placeholder-shown:text-base peer-focus:-top-2.5 peer-focus:text-xs peer-focus:text-primary transition-all"
  >
    Name
  </Label>
</div>
\`\`\``,
        doAndDont: {
          do: [
            'Use glow ring on focus (ring-primary/20)',
            'Transition all properties smoothly',
            'Use subtle placeholder text',
            'Add floating labels for forms',
          ],
          dont: [
            'Use harsh border colors',
            'Skip the focus state',
            'Use placeholder as label substitute',
            'Overcrowd input with icons',
          ],
        },
      },

      alert: {
        name: 'Alert',
        description: 'Contextual alerts with jewel-tone backgrounds and subtle borders.',
        variants: ['default', 'success', 'warning', 'error', 'info'],
        states: ['default', 'dismissible'],
        props: {
          variant: { type: 'string', default: 'default' },
          dismissible: { type: 'boolean', default: 'false' },
        },
        usage: `\`\`\`tsx
// Success alert
<Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
  <CheckCircle className="h-4 w-4 text-emerald-400" />
  <AlertTitle className="text-emerald-100">Success!</AlertTitle>
  <AlertDescription>Your changes have been saved.</AlertDescription>
</Alert>

// Warning with action
<Alert className="bg-amber-500/10 border-amber-500/30 text-amber-200">
  <AlertTriangle className="h-4 w-4 text-amber-400" />
  <AlertTitle>Attention Required</AlertTitle>
  <AlertDescription className="flex items-center gap-2">
    Please review the changes
    <Button size="sm" variant="outline" className="ml-auto">Review</Button>
  </AlertDescription>
</Alert>
\`\`\``,
        doAndDont: {
          do: [
            'Use jewel-tone backgrounds at 10% opacity',
            'Match icon and border colors',
            'Keep messages concise',
            'Include actions when appropriate',
          ],
          dont: [
            'Use solid bright backgrounds',
            'Show too many alerts at once',
            'Use for transient messages (use toast instead)',
            'Skip the icon - it aids quick recognition',
          ],
        },
      },

      table: {
        name: 'Table',
        description: 'Clean data tables with subtle hover states and refined borders.',
        variants: ['default', 'striped', 'bordered'],
        states: ['default', 'hover', 'selected'],
        props: {
          striped: { type: 'boolean', default: 'false' },
          hoverable: { type: 'boolean', default: 'true' },
        },
        usage: `\`\`\`tsx
<Table>
  <TableHeader>
    <TableRow className="border-border/50 hover:bg-transparent">
      <TableHead className="text-muted-foreground font-medium">Name</TableHead>
      <TableHead className="text-muted-foreground font-medium">Status</TableHead>
      <TableHead className="text-muted-foreground font-medium text-right">Actions</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {items.map((item) => (
      <TableRow
        key={item.id}
        className="border-border/30 hover:bg-accent/50 transition-colors cursor-pointer"
      >
        <TableCell className="font-medium">{item.name}</TableCell>
        <TableCell>
          <Badge className={STATUS_STYLES[item.status]}>{item.status}</Badge>
        </TableCell>
        <TableCell className="text-right">
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
\`\`\``,
        doAndDont: {
          do: [
            'Use subtle borders (border-border/30)',
            'Add smooth hover transitions',
            'Keep header text muted',
            'Align numbers and actions to the right',
          ],
          dont: [
            'Use harsh grid lines',
            'Overcrowd cells with content',
            'Skip the hover state on interactive tables',
            'Use zebra striping (breaks premium feel)',
          ],
        },
      },

      dialog: {
        name: 'Dialog',
        description: 'Premium modals with glass overlay and smooth animations.',
        variants: ['default', 'fullscreen', 'drawer'],
        sizes: ['sm', 'default', 'lg', 'xl', 'full'],
        states: ['open', 'closed'],
        props: {
          size: { type: 'string', default: 'default' },
          closeOnOverlayClick: { type: 'boolean', default: 'true' },
        },
        usage: `\`\`\`tsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Open Settings</Button>
  </DialogTrigger>
  <DialogContent className="bg-card/95 backdrop-blur-xl border-border/50 shadow-2xl">
    <DialogHeader>
      <DialogTitle className="text-xl">Settings</DialogTitle>
      <DialogDescription className="text-muted-foreground">
        Customize your experience
      </DialogDescription>
    </DialogHeader>
    <div className="py-6 space-y-4">
      {/* Content */}
    </div>
    <DialogFooter className="gap-2">
      <Button variant="ghost">Cancel</Button>
      <Button>Save Changes</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
\`\`\``,
        doAndDont: {
          do: [
            'Use glass effect on content (backdrop-blur-xl)',
            'Add smooth entry animations',
            'Keep dialogs focused on one task',
            'Use large shadow for depth (shadow-2xl)',
          ],
          dont: [
            'Use pure solid backgrounds',
            'Stack multiple dialogs',
            'Use for long forms (use a page instead)',
            'Skip the overlay blur',
          ],
        },
      },

      progress: {
        name: 'Progress',
        description: 'Smooth progress bars with gradient fills and subtle animations.',
        variants: ['default', 'success', 'warning', 'error'],
        sizes: ['sm', 'default', 'lg'],
        states: ['default', 'indeterminate', 'complete'],
        props: {
          value: { type: 'number' },
          max: { type: 'number', default: '100' },
          indeterminate: { type: 'boolean', default: 'false' },
        },
        usage: `\`\`\`tsx
// Default with gradient fill
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Progress</span>
    <span className="font-medium">75%</span>
  </div>
  <Progress
    value={75}
    className="h-2 bg-muted"
    indicatorClassName="bg-gradient-to-r from-primary to-primary/80"
  />
</div>

// Success state
<Progress
  value={100}
  className="h-2 bg-emerald-500/20"
  indicatorClassName="bg-emerald-500"
/>
\`\`\``,
        doAndDont: {
          do: [
            'Use gradient fills for visual interest',
            'Show percentage text alongside the bar',
            'Animate value changes smoothly',
            'Use appropriate colors for states',
          ],
          dont: [
            'Use harsh solid colors',
            'Skip the label for important progress',
            'Use for unknown durations (use spinner)',
            'Make the bar too thin to see',
          ],
        },
      },

      skeleton: {
        name: 'Skeleton',
        description: 'Elegant loading placeholders with smooth shimmer animation.',
        variants: ['text', 'circular', 'rectangular', 'card'],
        states: ['default', 'loading'],
        props: {
          variant: { type: 'string', default: 'text' },
        },
        usage: `\`\`\`tsx
// Card skeleton
<Card className="p-6 space-y-4">
  <div className="flex items-center gap-4">
    <Skeleton className="h-12 w-12 rounded-full bg-muted animate-pulse" />
    <div className="space-y-2 flex-1">
      <Skeleton className="h-4 w-1/3 bg-muted animate-pulse" />
      <Skeleton className="h-3 w-1/2 bg-muted animate-pulse" />
    </div>
  </div>
  <Skeleton className="h-20 w-full bg-muted animate-pulse rounded-lg" />
  <div className="flex gap-2">
    <Skeleton className="h-8 w-20 bg-muted animate-pulse rounded-md" />
    <Skeleton className="h-8 w-20 bg-muted animate-pulse rounded-md" />
  </div>
</Card>
\`\`\``,
        doAndDont: {
          do: [
            'Match skeleton shapes to actual content',
            'Use subtle pulse animation',
            'Group skeletons to match layout',
            'Use muted background color',
          ],
          dont: [
            'Use harsh shimmer effects',
            'Make skeletons too uniform',
            'Skip skeleton for slow loads',
            'Use bright colors',
          ],
        },
      },

      avatar: {
        name: 'Avatar',
        description: 'User avatars with fallback initials and status indicators.',
        variants: ['default', 'bordered', 'status'],
        sizes: ['xs', 'sm', 'default', 'lg', 'xl'],
        states: ['default', 'online', 'offline', 'busy', 'away'],
        props: {
          size: { type: 'string', default: 'default' },
          status: { type: 'string' },
        },
        usage: `\`\`\`tsx
// With status indicator
<div className="relative">
  <Avatar className="h-10 w-10 border-2 border-background">
    <AvatarImage src="/user.jpg" />
    <AvatarFallback className="bg-primary/20 text-primary">JD</AvatarFallback>
  </Avatar>
  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
</div>

// Avatar group
<div className="flex -space-x-3">
  {users.slice(0, 4).map((user) => (
    <Avatar key={user.id} className="border-2 border-background">
      <AvatarImage src={user.avatar} />
      <AvatarFallback>{user.initials}</AvatarFallback>
    </Avatar>
  ))}
  {users.length > 4 && (
    <div className="h-10 w-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
      +{users.length - 4}
    </div>
  )}
</div>
\`\`\``,
        doAndDont: {
          do: [
            'Use initials as fallback',
            'Add border when overlapping',
            'Use status colors consistently',
            'Keep avatar groups to 4-5 visible',
          ],
          dont: [
            'Use harsh colored backgrounds',
            'Skip the fallback',
            'Make avatars too small (<24px)',
            'Use different sizes in a group',
          ],
        },
      },

      tabs: {
        name: 'Tabs',
        description: 'Refined navigation tabs with smooth transitions and active indicators.',
        variants: ['default', 'pills', 'underline', 'ghost'],
        states: ['default', 'active', 'disabled'],
        props: {
          variant: { type: 'string', default: 'default' },
        },
        usage: `\`\`\`tsx
// Pill style tabs
<TabsList className="bg-muted/50 p-1 rounded-lg">
  <TabsTrigger
    value="overview"
    className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
  >
    Overview
  </TabsTrigger>
  <TabsTrigger
    value="analytics"
    className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
  >
    Analytics
  </TabsTrigger>
</TabsList>

// Underline tabs
<TabsList className="border-b border-border/50 bg-transparent">
  <TabsTrigger
    value="details"
    className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-foreground rounded-none"
  >
    Details
  </TabsTrigger>
</TabsList>
\`\`\``,
        doAndDont: {
          do: [
            'Use smooth transitions on state change',
            'Add subtle shadow on active pill tabs',
            'Keep tab labels short (1-2 words)',
            'Use consistent spacing between tabs',
          ],
          dont: [
            'Use more than 5-6 tabs',
            'Mix different tab styles',
            'Skip the active indicator',
            'Use for sequential steps (use stepper)',
          ],
        },
      },

      toast: {
        name: 'Toast',
        description: 'Non-intrusive notifications with jewel-tone accents and smooth animations.',
        variants: ['default', 'success', 'warning', 'error', 'info'],
        states: ['default', 'entering', 'leaving'],
        props: {
          variant: { type: 'string', default: 'default' },
          duration: { type: 'number', default: '4000' },
          dismissible: { type: 'boolean', default: 'true' },
        },
        usage: `\`\`\`tsx
// Success toast
toast({
  title: "Changes saved",
  description: "Your preferences have been updated.",
  className: "bg-card/95 backdrop-blur-xl border-emerald-500/30",
  icon: <CheckCircle className="h-5 w-5 text-emerald-400" />,
});

// Error toast with action
toast({
  title: "Upload failed",
  description: "Please try again.",
  className: "bg-card/95 backdrop-blur-xl border-rose-500/30",
  icon: <XCircle className="h-5 w-5 text-rose-400" />,
  action: <Button size="sm" variant="ghost">Retry</Button>,
});
\`\`\``,
        doAndDont: {
          do: [
            'Use glass effect (backdrop-blur)',
            'Add colored border for type indication',
            'Keep messages brief',
            'Include icons for quick recognition',
          ],
          dont: [
            'Use solid bright backgrounds',
            'Show too many toasts at once',
            'Use for critical errors (use dialog)',
            'Make toasts too long',
          ],
        },
      },
    },

    guidelines: `# Obsidian Design System Guidelines

## Philosophy

Obsidian is designed to feel **luxurious, not techy**. Every element should feel intentional, refined, and easy on the eyes. Think of it as the difference between a cold server room and a warm, sophisticated lounge.

### Core Principles

1. **Warmth in Darkness** - Use purple/blue undertones in dark grays
2. **Refined Accents** - Violet, not neon; subtle, not aggressive
3. **Depth Through Glass** - Use backdrop-blur for layering
4. **Generous Space** - Let elements breathe
5. **Smooth Motion** - Every transition should feel intentional

---

## Color Usage

### Background Layers

Build depth through layered surfaces:

\`\`\`
Base (0.11)  →  Card (0.14)  →  Popover (0.16)  →  Overlay
\`\`\`

Each layer is slightly lighter with warm undertones.

### Text Hierarchy

- **Foreground** (#ECECEF): Primary text, headings
- **Muted** (#8B8B97): Secondary text, labels
- **Subtle** (~0.35 lightness): Tertiary, placeholders

### Accent Colors

Use the primary violet **sparingly**:
- CTAs and primary buttons
- Active states
- Focus rings
- Links (on hover)

### Status Colors (Jewel Tones)

| Status | Color | Usage |
|--------|-------|-------|
| Success | Emerald (#34D399) | Completed, active, positive |
| Warning | Amber (#FBBF24) | Pending, attention needed |
| Error | Coral (#F87171) | Failed, destructive |
| Info | Sapphire (#60A5FA) | Informational, in progress |

Use these at **10-20% opacity** for backgrounds.

---

## Glass Effects

Create depth and sophistication with glass effects:

\`\`\`tsx
// Glass card
<div className="bg-card/50 backdrop-blur-xl border-border/50 rounded-xl">
  {content}
</div>

// Glass overlay
<div className="fixed inset-0 bg-background/80 backdrop-blur-sm">
  {modal}
</div>
\`\`\`

### When to Use Glass

- Modal/dialog overlays
- Elevated cards that overlap content
- Navigation headers (sticky)
- Floating action panels

### When NOT to Use Glass

- Base-level cards
- Form containers
- Table rows
- Performance-critical areas

---

## Spacing Philosophy

Obsidian uses **generous spacing** for a luxury feel:

| Context | Spacing | Example |
|---------|---------|---------|
| Tight | 8px (gap-2) | Inline elements, badges |
| Normal | 16px (gap-4) | List items, form rows |
| Comfortable | 24px (gap-6) | Card padding, sections |
| Spacious | 32px+ (gap-8+) | Page sections |

### Cards
- Always use \`p-6\` (24px) minimum padding
- Use \`gap-4\` between card sections

### Forms
- Use \`space-y-4\` between form fields
- Use \`gap-2\` between label and input

---

## Animation Guidelines

### Timing

| Type | Duration | Use Case |
|------|----------|----------|
| Micro | 150ms | Hovers, color changes |
| Normal | 200ms | Most transitions |
| Emphasis | 300ms | Modals, panels |
| Dramatic | 500ms | Page transitions |

### Easing

- **Default** (ease-out): Most interactions
- **Spring**: Playful elements, bouncy feedback
- **Linear**: Progress bars, loading

### Focus States

Always animate focus rings:

\`\`\`tsx
<Button className="focus:ring-2 focus:ring-primary/20 transition-all" />
\`\`\`

---

## Border & Shadow

### Borders

Use nearly-invisible borders that appear on interaction:

\`\`\`tsx
// Default: barely visible
<Card className="border-border/50" />

// Hover: subtle highlight
<Card className="border-border/50 hover:border-primary/30 transition-colors" />
\`\`\`

### Shadows

Use shadows sparingly in dark mode:

- **Cards**: \`shadow-md\` or none
- **Modals**: \`shadow-2xl\` for depth
- **Focus**: \`shadow-glow\` for emphasis

---

## Typography

### Font Weights

- **Light (300)**: Large display text only
- **Normal (400)**: Body text, descriptions
- **Medium (500)**: Labels, buttons
- **Semibold (600)**: Headings, emphasis
- **Bold (700)**: Hero text only

### Letter Spacing

Negative letter spacing for headings creates a tighter, more premium feel:

- Body: 0 or -0.01em
- Headings: -0.02em to -0.03em

---

## Accessibility

### Contrast Ratios

All text meets WCAG 2.1 AA standards:
- Regular text: 4.5:1 minimum
- Large text: 3:1 minimum
- UI components: 3:1 minimum

### Focus Indicators

Every interactive element has:
1. Visible focus ring (2px, primary color at 20% opacity)
2. Keyboard navigable
3. Clear active states

### Color Independence

Never rely on color alone:
- Use icons alongside status colors
- Include text labels for status badges
- Provide patterns/shapes for charts

---

## Premium Patterns

### Hover Lift Effect

\`\`\`tsx
<Card className="hover:-translate-y-1 hover:shadow-lg transition-all duration-300">
\`\`\`

### Gradient Border (Premium Cards)

\`\`\`tsx
<div className="relative p-[1px] rounded-xl bg-gradient-to-r from-primary/50 via-transparent to-primary/50">
  <div className="bg-card rounded-xl p-6">
    {content}
  </div>
</div>
\`\`\`

### Glow Effect on Focus

\`\`\`tsx
<Button className="focus:shadow-glow focus:ring-2 focus:ring-primary/20">
\`\`\`

---

## What NOT to Do

1. **Pure black backgrounds** - Use warm near-black
2. **Pure white text** - Use off-white (#ECECEF)
3. **Neon accent colors** - Keep saturated colors subtle
4. **Harsh borders** - Use low opacity borders
5. **Flat design** - Add depth with glass and shadows
6. **Cramped layouts** - Give elements room to breathe
7. **Instant transitions** - Everything should animate smoothly

---

## Summary

Obsidian is about creating an experience that feels **effortlessly premium**. When in doubt:

- Add more spacing
- Reduce opacity
- Soften the transition
- Warm up the color

The goal is an interface that users want to spend time in - sophisticated, calm, and beautiful.
`,

    examples: [
      {
        id: 'theme-css-variables',
        title: 'Obsidian Theme CSS Variables',
        description: 'Complete CSS variable setup for the Obsidian theme with dark/light modes',
        language: 'css',
        code: `:root {
  /* Light mode - inverted warm tones */
  --background: 250 5% 98%;
  --foreground: 250 10% 10%;
  --card: 250 5% 100%;
  --card-foreground: 250 10% 10%;
  --primary: 262 83% 58%;
  --primary-foreground: 0 0% 100%;
  --secondary: 250 5% 94%;
  --secondary-foreground: 250 10% 15%;
  --muted: 250 5% 92%;
  --muted-foreground: 250 5% 45%;
  --accent: 250 5% 90%;
  --accent-foreground: 250 10% 10%;
  --destructive: 0 84% 60%;
  --border: 250 5% 88%;
  --ring: 262 83% 58%;
}

.dark {
  /* Obsidian dark mode - warm undertones */
  --background: 260 10% 7%;
  --foreground: 260 5% 93%;
  --card: 260 8% 10%;
  --card-foreground: 260 5% 93%;
  --popover: 260 8% 12%;
  --popover-foreground: 260 5% 93%;
  --primary: 262 83% 65%;
  --primary-foreground: 0 0% 100%;
  --secondary: 260 8% 15%;
  --secondary-foreground: 260 5% 90%;
  --muted: 260 8% 13%;
  --muted-foreground: 260 5% 55%;
  --accent: 260 8% 18%;
  --accent-foreground: 260 5% 93%;
  --destructive: 0 72% 63%;
  --destructive-foreground: 0 0% 100%;
  --border: 260 8% 18%;
  --input: 260 8% 12%;
  --ring: 262 83% 65%;

  /* Jewel tone status colors */
  --success: 160 64% 52%;
  --success-foreground: 160 64% 15%;
  --warning: 43 96% 56%;
  --warning-foreground: 43 96% 15%;
  --error: 0 72% 63%;
  --error-foreground: 0 0% 100%;
  --info: 217 91% 67%;
  --info-foreground: 217 91% 15%;

  /* Chart colors */
  --chart-1: 262 83% 65%;
  --chart-2: 160 64% 52%;
  --chart-3: 43 96% 56%;
  --chart-4: 217 91% 67%;
  --chart-5: 330 70% 60%;
}`,
        tags: ['theme', 'css', 'variables', 'dark-mode', 'light-mode'],
      },
      {
        id: 'glass-dashboard-card',
        title: 'Glass Dashboard Card',
        description: 'Premium glass-effect stat card with gradient accents',
        language: 'tsx',
        code: `import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  change: number;
  trend: 'up' | 'down';
}

export function StatCard({ title, value, change, trend }: StatCardProps) {
  return (
    <Card className="relative overflow-hidden bg-card/50 backdrop-blur-xl border-border/50 hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      {/* Subtle gradient glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

      <CardContent className="relative p-6">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>

        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight">{value}</span>
          <span
            className={\`flex items-center gap-1 text-sm font-medium \${
              trend === 'up'
                ? 'text-emerald-400'
                : 'text-rose-400'
            }\`}
          >
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4" />
            ) : (
              <TrendingDown className="h-4 w-4" />
            )}
            {change}%
          </span>
        </div>

        {/* Mini sparkline placeholder */}
        <div className="mt-4 h-10 w-full rounded-md bg-muted/50" />
      </CardContent>
    </Card>
  );
}

// Usage
<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
  <StatCard title="Total Revenue" value="$45,231" change={12.5} trend="up" />
  <StatCard title="Active Users" value="2,451" change={8.2} trend="up" />
  <StatCard title="Bounce Rate" value="24.3%" change={-3.1} trend="down" />
</div>`,
        tags: ['dashboard', 'stats', 'glass', 'card', 'gradient'],
      },
      {
        id: 'premium-form',
        title: 'Premium Form with Floating Labels',
        description: 'Elegant form with glow focus states and floating labels',
        language: 'tsx',
        code: `import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function PremiumLoginForm() {
  return (
    <Card className="w-full max-w-md bg-card/50 backdrop-blur-xl border-border/50">
      <CardHeader className="text-center pb-2">
        <CardTitle className="text-2xl font-semibold tracking-tight">
          Welcome back
        </CardTitle>
        <p className="text-muted-foreground">Sign in to your account</p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Floating label input */}
        <div className="relative">
          <Input
            id="email"
            type="email"
            placeholder=" "
            className="peer h-12 bg-input/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all pt-4"
          />
          <Label
            htmlFor="email"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-all duration-200
                       peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary
                       peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs"
          >
            Email address
          </Label>
        </div>

        {/* Password with floating label */}
        <div className="relative">
          <Input
            id="password"
            type="password"
            placeholder=" "
            className="peer h-12 bg-input/50 border-border/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all pt-4"
          />
          <Label
            htmlFor="password"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-all duration-200
                       peer-focus:top-2 peer-focus:text-xs peer-focus:text-primary
                       peer-[:not(:placeholder-shown)]:top-2 peer-[:not(:placeholder-shown)]:text-xs"
          >
            Password
          </Label>
        </div>

        <Button className="w-full h-12 bg-gradient-to-b from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 hover:shadow-glow transition-all duration-300">
          Sign in
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{' '}
          <a href="#" className="text-primary hover:underline underline-offset-4">
            Sign up
          </a>
        </p>
      </CardContent>
    </Card>
  );
}`,
        tags: ['form', 'login', 'floating-labels', 'glass', 'premium'],
      },
      {
        id: 'status-table-row',
        title: 'Premium Table Row with Status',
        description: 'Elegant table row with jewel-tone status badges and smooth interactions',
        language: 'tsx',
        code: `import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { MoreHorizontal, Play, ExternalLink } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
  failed: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
  draft: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
} as const;

interface Project {
  id: string;
  name: string;
  owner: { name: string; avatar: string; initials: string };
  status: keyof typeof STATUS_STYLES;
  lastUpdated: string;
}

export function ProjectRow({ project }: { project: Project }) {
  return (
    <div className="group flex items-center justify-between p-4 rounded-lg border border-transparent hover:bg-accent/50 hover:border-border/50 transition-all duration-200 cursor-pointer">
      <div className="flex items-center gap-4">
        {/* Project icon with gradient */}
        <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
          <span className="text-primary font-semibold text-sm">
            {project.name.charAt(0)}
          </span>
        </div>

        <div>
          <h4 className="font-medium group-hover:text-primary transition-colors">
            {project.name}
          </h4>
          <div className="flex items-center gap-2 mt-0.5">
            <Avatar className="h-4 w-4">
              <AvatarImage src={project.owner.avatar} />
              <AvatarFallback className="text-[8px]">
                {project.owner.initials}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {project.owner.name}
            </span>
            <span className="text-muted-foreground/50">•</span>
            <span className="text-xs text-muted-foreground">
              {project.lastUpdated}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Badge className={\`\${STATUS_STYLES[project.status]} border\`}>
          {project.status}
        </Badge>

        {/* Actions - appear on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
          >
            <Play className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-accent"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}`,
        tags: ['table', 'row', 'status', 'badges', 'hover', 'premium'],
      },
      {
        id: 'glass-navigation',
        title: 'Glass Navigation Header',
        description: 'Sticky navigation with glass blur effect and smooth animations',
        language: 'tsx',
        code: `import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Bell, Search, Settings, Command } from 'lucide-react';

export function GlassNav() {
  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Glass effect background */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-xl border-b border-border/50" />

      <div className="relative flex h-16 items-center justify-between px-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <span className="text-white font-bold text-sm">O</span>
          </div>
          <span className="font-semibold text-lg tracking-tight">Obsidian</span>
        </div>

        {/* Search bar */}
        <div className="flex-1 max-w-md mx-8">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-9 pl-9 pr-12 rounded-lg bg-muted/50 border border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:bg-muted focus:border-border/50 focus:ring-2 focus:ring-primary/10 transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:flex h-5 items-center gap-1 rounded bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              <Command className="h-3 w-3" />K
            </kbd>
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-accent"
          >
            <Bell className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 hover:bg-accent"
          >
            <Settings className="h-4 w-4" />
          </Button>

          <div className="h-6 w-px bg-border/50 mx-2" />

          <Avatar className="h-8 w-8 ring-2 ring-background">
            <AvatarImage src="/user.jpg" />
            <AvatarFallback className="bg-primary/20 text-primary text-xs">
              JD
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}`,
        tags: ['navigation', 'header', 'glass', 'search', 'blur'],
      },
      {
        id: 'gradient-border-card',
        title: 'Gradient Border Feature Card',
        description: 'Premium card with animated gradient border effect',
        language: 'tsx',
        code: `import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

export function GradientBorderCard() {
  return (
    <div className="relative group">
      {/* Animated gradient border */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-xl opacity-50 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200 animate-gradient-x" />

      {/* Card content */}
      <div className="relative bg-card rounded-xl p-8 space-y-6">
        {/* Icon with glow */}
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-xl blur-xl" />
          <div className="relative h-14 w-14 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
        </div>

        <div>
          <h3 className="text-xl font-semibold tracking-tight">
            Premium Feature
          </h3>
          <p className="mt-2 text-muted-foreground">
            Experience the next level of design with our premium features.
            Built for those who appreciate the finer details.
          </p>
        </div>

        <Button className="group/btn bg-gradient-to-b from-primary to-primary/90 hover:shadow-glow transition-all">
          Get Started
          <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}

/* Add this to your globals.css */
/*
@keyframes gradient-x {
  0%, 100% {
    background-size: 200% 200%;
    background-position: left center;
  }
  50% {
    background-size: 200% 200%;
    background-position: right center;
  }
}
.animate-gradient-x {
  animation: gradient-x 3s ease infinite;
}
*/`,
        tags: ['card', 'gradient', 'border', 'premium', 'animation', 'glow'],
      },
    ],
  };
}
