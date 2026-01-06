/**
 * Ochsner Health Design System
 *
 * Based on Ochsner Health's brand guidelines:
 * - Deep purple primary color (#461d7c / #4d2787)
 * - Light green accent (#c7e59f)
 * - Montserrat for headings, Roboto for body
 * - Healthcare-focused, professional, trustworthy
 *
 * Sources:
 * - https://brandfetch.com/ochsnerlsuhs.org
 * - https://visualfueldesign.com/ochsner-health-systems
 * - Healthcare UX best practices (WCAG 2.2, ADA, HIPAA)
 */

import type { DesignSystem } from '../types';

export function getOchsnerHealthDesignSystem(): DesignSystem {
  return {
    id: 'ochsner-health',
    name: 'Ochsner Health',
    description: 'Healthcare design system inspired by Ochsner Health - Louisiana\'s leading nonprofit healthcare provider. Features deep purple primary colors with fresh green accents for a trustworthy, professional healthcare appearance. Includes full dark/light theme support and healthcare-specific UX patterns.',
    version: '2.0.0',
    isDefault: false,
    isBuiltIn: true,
    createdAt: '2024-12-17T00:00:00.000Z',
    updatedAt: '2024-12-20T00:00:00.000Z',
    source: { type: 'builtin' },

    tokens: {
      colors: {
        // ============================================
        // LIGHT THEME (default)
        // ============================================
        background: '#ffffff',
        foreground: '#1a1a2e',

        // Card and popover
        card: '#ffffff',
        cardForeground: '#1a1a2e',
        popover: '#ffffff',
        popoverForeground: '#1a1a2e',

        // Primary - Ochsner Purple (Meteorite)
        primary: '#461d7c',
        primaryForeground: '#ffffff',

        // Secondary - Light Purple Tint
        secondary: '#f4f0f8',
        secondaryForeground: '#461d7c',

        // Muted
        muted: '#f4f4f8',
        mutedForeground: '#64648c',

        // Accent - Ochsner Green (Caper)
        accent: '#c7e59f',
        accentForeground: '#1a1a2e',

        // Destructive
        destructive: '#dc2626',
        destructiveForeground: '#ffffff',

        // Borders and inputs
        border: '#e5e5ed',
        input: '#e5e5ed',
        ring: '#461d7c',

        // ============================================
        // DARK THEME
        // Define in CSS as .dark { --background: #0f0a1a; ... }
        // ============================================
        // Dark mode values (for reference in CSS generation):
        // background: '#0f0a1a' (deep purple-black)
        // foreground: '#f8f8fc'
        // card: '#1a1429'
        // cardForeground: '#f8f8fc'
        // primary: '#8b5cf6' (lighter purple for dark bg)
        // secondary: '#2d2640'
        // muted: '#2d2640'
        // mutedForeground: '#a8a8c0'
        // accent: '#c7e59f'
        // border: '#3d3560'

        // Chart colors (work in both themes)
        chart1: '#461d7c',
        chart2: '#c7e59f',
        chart3: '#8b5cf6',
        chart4: '#4d2787',
        chart5: '#a3e635',

        // Status colors (semantic)
        success: '#16a34a',
        successForeground: '#ffffff',
        warning: '#f59e0b',
        warningForeground: '#1a1a2e',
        error: '#dc2626',
        errorForeground: '#ffffff',
        info: '#461d7c',
        infoForeground: '#ffffff',
      },

      spacing: {
        unit: 4,
        scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64],
      },

      typography: {
        fontFamily: {
          sans: '"Montserrat", "Roboto", "Segoe UI", system-ui, sans-serif',
          mono: '"Roboto Mono", "Consolas", monospace',
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
          '5xl': { size: '3rem', lineHeight: '1' },
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
        sm: '0.25rem',
        md: '0.5rem',
        lg: '0.75rem',
        xl: '1rem',
        '2xl': '1.5rem',
        full: '9999px',
      },

      shadows: {
        sm: '0 1px 2px 0 rgb(70 29 124 / 0.05)',
        md: '0 4px 6px -1px rgb(70 29 124 / 0.1), 0 2px 4px -2px rgb(70 29 124 / 0.1)',
        lg: '0 10px 15px -3px rgb(70 29 124 / 0.1), 0 4px 6px -4px rgb(70 29 124 / 0.1)',
        xl: '0 20px 25px -5px rgb(70 29 124 / 0.1), 0 8px 10px -6px rgb(70 29 124 / 0.1)',
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
        description: 'Primary action buttons with Ochsner purple branding. Use for CTAs and important actions.',
        variants: ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'],
        sizes: ['sm', 'md', 'lg', 'icon'],
        states: ['default', 'hover', 'active', 'disabled', 'focus'],
        props: {
          variant: { type: 'string', default: 'default' },
          size: { type: 'string', default: 'md' },
          disabled: { type: 'boolean', default: 'false' },
        },
        usage: `## Button Usage

Primary buttons use Ochsner's signature purple (#461d7c).
In dark mode, buttons use a lighter purple (#8b5cf6) for visibility.

\`\`\`tsx
// Primary action - deep purple
<Button variant="default">Schedule Appointment</Button>

// Secondary action - lighter background
<Button variant="secondary">Learn More</Button>

// Outline for less emphasis
<Button variant="outline">Cancel</Button>

// Healthcare-specific sizes
<Button size="lg" className="min-h-[48px]">
  Book Appointment
</Button>
\`\`\`

### Healthcare Button Guidelines
- Minimum touch target: 48x48px for accessibility
- Clear, action-oriented labels
- Loading state for async actions
- Icons enhance recognition (Calendar, Phone, etc.)`,
        doAndDont: {
          do: [
            'Use primary purple buttons for main CTAs like "Book Appointment"',
            'Use secondary buttons for supporting actions',
            'Ensure 4.5:1 contrast ratio minimum',
            'Use descriptive labels that indicate the action',
            'Make buttons at least 48x48px for touch targets',
          ],
          dont: [
            'Don\'t use multiple primary buttons in one section',
            'Don\'t use red for non-destructive actions',
            'Don\'t use all caps for button text',
            'Don\'t make buttons too small (min 48px height)',
            'Don\'t use vague labels like "Click Here"',
          ],
        },
      },

      card: {
        name: 'Card',
        description: 'Content container for healthcare information. White in light mode, dark purple in dark mode.',
        variants: ['default', 'outlined', 'elevated', 'interactive'],
        states: ['default', 'hover', 'selected'],
        props: {
          variant: { type: 'string', default: 'default' },
          padding: { type: 'string', default: 'md' },
        },
        usage: `## Card Usage

Cards adapt to light/dark theme automatically.

\`\`\`tsx
// Light: white bg, subtle shadow
// Dark: dark purple bg (#1a1429)
<Card>
  <CardHeader>
    <CardTitle>Patient Information</CardTitle>
    <CardDescription>View and manage your health records</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>

// Interactive card with hover
<Card className="hover:border-primary/50 transition-colors cursor-pointer">
  {/* Clickable content */}
</Card>
\`\`\``,
        doAndDont: {
          do: [
            'Use cards to group related patient information',
            'Include clear headings and descriptions',
            'Use adequate padding (p-6) for readability',
            'Add hover states for interactive cards',
          ],
          dont: [
            'Don\'t nest cards within cards',
            'Don\'t overcrowd with information',
            'Don\'t use cards for single data points',
            'Don\'t forget dark mode styling',
          ],
        },
      },

      badge: {
        name: 'Badge',
        description: 'Status indicators and labels for healthcare states.',
        variants: ['default', 'secondary', 'success', 'warning', 'destructive', 'outline'],
        states: ['default'],
        props: {
          variant: { type: 'string', default: 'default' },
        },
        usage: `## Badge Usage - Healthcare Status

\`\`\`tsx
// Appointment status
<Badge variant="success">Confirmed</Badge>
<Badge variant="warning">Pending</Badge>
<Badge variant="destructive">Cancelled</Badge>

// Health status indicators
<Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
  Normal
</Badge>
<Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">
  Requires Attention
</Badge>
<Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
  Critical
</Badge>
\`\`\`

### Healthcare Status Colors
- **Green**: Normal, confirmed, healthy
- **Yellow/Orange**: Pending, attention needed, borderline
- **Red**: Critical, cancelled, urgent
- **Purple**: Informational, new, in progress`,
      },

      input: {
        name: 'Input',
        description: 'Form inputs for patient data collection. HIPAA-conscious design.',
        variants: ['default', 'error', 'success'],
        states: ['default', 'focus', 'disabled', 'error'],
        props: {
          type: { type: 'string', default: 'text' },
          placeholder: { type: 'string' },
          disabled: { type: 'boolean', default: 'false' },
        },
        usage: `## Input Usage - Healthcare Forms

\`\`\`tsx
// Standard input with label (REQUIRED pattern)
<div className="space-y-2">
  <Label htmlFor="dob">Date of Birth <span className="text-destructive">*</span></Label>
  <Input
    id="dob"
    type="date"
    aria-required="true"
  />
</div>

// Secure/sensitive field indicator
<div className="space-y-2">
  <Label htmlFor="ssn" className="flex items-center gap-2">
    Social Security Number
    <Lock className="h-3 w-3 text-muted-foreground" />
  </Label>
  <Input
    id="ssn"
    type="password"
    autoComplete="off"
    className="font-mono"
  />
  <p className="text-xs text-muted-foreground">
    Protected health information - encrypted in transit
  </p>
</div>

// Error state
<div className="space-y-2">
  <Label htmlFor="phone">Phone Number</Label>
  <Input
    id="phone"
    className="border-destructive focus:ring-destructive"
    aria-invalid="true"
    aria-describedby="phone-error"
  />
  <p id="phone-error" className="text-sm text-destructive">
    Please enter a valid phone number
  </p>
</div>
\`\`\`

### Healthcare Form Guidelines
- ALWAYS use labels (not just placeholders)
- Mark required fields with asterisk
- Show validation inline
- Indicate secure/encrypted fields
- Support autofill where appropriate`,
      },

      alert: {
        name: 'Alert',
        description: 'Important messages for patient communications.',
        variants: ['default', 'success', 'warning', 'destructive', 'info'],
        states: ['default'],
        props: {
          variant: { type: 'string', default: 'default' },
        },
        usage: `## Alert Usage - Patient Communications

\`\`\`tsx
// Appointment reminder
<Alert className="border-primary bg-primary/5">
  <Calendar className="h-4 w-4" />
  <AlertTitle>Appointment Reminder</AlertTitle>
  <AlertDescription>
    Your appointment with Dr. Smith is tomorrow at 2:00 PM.
    <Button variant="link" className="p-0 h-auto ml-1">
      Add to calendar
    </Button>
  </AlertDescription>
</Alert>

// Health warning
<Alert variant="warning">
  <AlertTriangle className="h-4 w-4" />
  <AlertTitle>Action Required</AlertTitle>
  <AlertDescription>
    Your lab results require review. Please schedule a follow-up.
  </AlertDescription>
</Alert>

// Success confirmation
<Alert variant="success" className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
  <CheckCircle className="h-4 w-4 text-green-600" />
  <AlertTitle>Appointment Confirmed</AlertTitle>
  <AlertDescription>
    Confirmation sent to your email and phone.
  </AlertDescription>
</Alert>
\`\`\``,
      },

      table: {
        name: 'Table',
        description: 'Data tables for medical records, lab results, and appointments.',
        variants: ['default', 'striped', 'bordered'],
        states: ['default', 'loading'],
        props: {
          striped: { type: 'boolean', default: 'false' },
        },
        usage: `## Table Usage - Medical Data

\`\`\`tsx
// Lab results table
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Test</TableHead>
      <TableHead>Result</TableHead>
      <TableHead>Reference Range</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell className="font-medium">Glucose</TableCell>
      <TableCell>95 mg/dL</TableCell>
      <TableCell className="text-muted-foreground">70-100 mg/dL</TableCell>
      <TableCell>
        <Badge variant="success">Normal</Badge>
      </TableCell>
    </TableRow>
    <TableRow>
      <TableCell className="font-medium">Cholesterol</TableCell>
      <TableCell className="text-yellow-600 dark:text-yellow-400 font-medium">
        215 mg/dL
      </TableCell>
      <TableCell className="text-muted-foreground">&lt;200 mg/dL</TableCell>
      <TableCell>
        <Badge variant="warning">Borderline</Badge>
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
\`\`\`

### Table Accessibility
- Use semantic table elements
- Include scope attributes for headers
- Highlight abnormal values
- Support keyboard navigation`,
      },

      dialog: {
        name: 'Dialog',
        description: 'Modal dialogs for confirmations and detailed information.',
        variants: ['default', 'alert'],
        states: ['open', 'closed'],
        props: {
          open: { type: 'boolean' },
          onOpenChange: { type: 'function' },
        },
        usage: `## Dialog Usage - Healthcare Confirmations

\`\`\`tsx
// Appointment confirmation dialog
<Dialog>
  <DialogTrigger asChild>
    <Button>Cancel Appointment</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Cancel Appointment?</DialogTitle>
      <DialogDescription>
        Are you sure you want to cancel your appointment with Dr. Smith
        on January 15, 2025 at 2:00 PM?
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="gap-2">
      <Button variant="outline">Keep Appointment</Button>
      <Button variant="destructive">Yes, Cancel</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// Medication details dialog
<Dialog>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle className="flex items-center gap-2">
        <Pill className="h-5 w-5 text-primary" />
        Medication Details
      </DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      {/* Medication info */}
    </div>
  </DialogContent>
</Dialog>
\`\`\``,
      },

      skeleton: {
        name: 'Skeleton',
        description: 'Loading placeholders for async healthcare data.',
        variants: ['default', 'card', 'table'],
        states: ['loading'],
        props: {},
        usage: `## Skeleton Usage - Loading States

\`\`\`tsx
// Patient card skeleton
<Card>
  <CardHeader className="flex flex-row items-center gap-4">
    <Skeleton className="h-16 w-16 rounded-full" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-3 w-24" />
    </div>
  </CardHeader>
  <CardContent className="space-y-3">
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-4/5" />
    <Skeleton className="h-10 w-full mt-4" />
  </CardContent>
</Card>

// Table skeleton
<Table>
  <TableBody>
    {[...Array(5)].map((_, i) => (
      <TableRow key={i}>
        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
\`\`\`

### Loading UX Guidelines
- Always show loading states for async data
- Match skeleton dimensions to actual content
- Use subtle animation (pulse)
- Consider skeleton for 200ms+ delays`,
      },

      progress: {
        name: 'Progress',
        description: 'Progress indicators for health goals and form completion.',
        variants: ['default', 'success', 'warning'],
        states: ['default', 'indeterminate'],
        props: {
          value: { type: 'number', default: '0' },
          max: { type: 'number', default: '100' },
        },
        usage: `## Progress Usage - Health Goals

\`\`\`tsx
// Daily step goal
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Daily Steps</span>
    <span className="font-medium">7,500 / 10,000</span>
  </div>
  <Progress value={75} className="h-2" />
</div>

// Health score with color coding
<div className="space-y-2">
  <div className="flex justify-between text-sm">
    <span>Health Score</span>
    <span className="font-medium text-green-600">85/100</span>
  </div>
  <Progress
    value={85}
    className="h-3 bg-gray-100 dark:bg-gray-800"
    indicatorClassName="bg-green-500"
  />
</div>

// Form completion progress
<div className="flex items-center gap-4">
  <Progress value={60} className="flex-1 h-2" />
  <span className="text-sm text-muted-foreground">60% complete</span>
</div>
\`\`\``,
      },

      toast: {
        name: 'Toast',
        description: 'Transient notifications for actions and updates.',
        variants: ['default', 'success', 'error', 'warning'],
        states: ['visible', 'hidden'],
        props: {
          title: { type: 'string' },
          description: { type: 'string' },
          duration: { type: 'number', default: '5000' },
        },
        usage: `## Toast Usage - Feedback Notifications

\`\`\`tsx
// Success toast
toast({
  title: "Appointment Scheduled",
  description: "Your appointment has been confirmed for Jan 15 at 2:00 PM.",
  variant: "success",
});

// Action with undo
toast({
  title: "Appointment Cancelled",
  description: "Your appointment has been cancelled.",
  action: (
    <Button variant="outline" size="sm" onClick={handleUndo}>
      Undo
    </Button>
  ),
});

// Error toast
toast({
  title: "Unable to Save",
  description: "Please check your connection and try again.",
  variant: "destructive",
});
\`\`\`

### Toast Guidelines
- Keep messages brief and clear
- Use for transient feedback only
- Provide undo for destructive actions
- Auto-dismiss after 5 seconds
- Allow manual dismiss`,
      },

      avatar: {
        name: 'Avatar',
        description: 'User and provider profile images.',
        variants: ['default', 'rounded'],
        sizes: ['sm', 'md', 'lg', 'xl'],
        states: ['default', 'loading'],
        props: {
          src: { type: 'string' },
          alt: { type: 'string' },
          fallback: { type: 'string' },
        },
        usage: `## Avatar Usage

\`\`\`tsx
// Provider avatar with status
<div className="relative">
  <Avatar className="h-12 w-12">
    <AvatarImage src="/doctors/smith.jpg" alt="Dr. Sarah Smith" />
    <AvatarFallback className="bg-primary text-primary-foreground">
      SS
    </AvatarFallback>
  </Avatar>
  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
</div>

// Avatar sizes
<Avatar className="h-8 w-8">{/* sm */}</Avatar>
<Avatar className="h-12 w-12">{/* md */}</Avatar>
<Avatar className="h-16 w-16">{/* lg */}</Avatar>
<Avatar className="h-24 w-24">{/* xl */}</Avatar>
\`\`\``,
      },

      tabs: {
        name: 'Tabs',
        description: 'Navigation tabs for organizing health information sections.',
        variants: ['default', 'pills', 'underline'],
        states: ['default', 'active', 'disabled'],
        props: {
          defaultValue: { type: 'string' },
        },
        usage: `## Tabs Usage - Section Navigation

\`\`\`tsx
<Tabs defaultValue="overview" className="w-full">
  <TabsList className="grid w-full grid-cols-4">
    <TabsTrigger value="overview">
      <Home className="h-4 w-4 mr-2" />
      Overview
    </TabsTrigger>
    <TabsTrigger value="appointments">
      <Calendar className="h-4 w-4 mr-2" />
      Appointments
    </TabsTrigger>
    <TabsTrigger value="records">
      <FileText className="h-4 w-4 mr-2" />
      Records
    </TabsTrigger>
    <TabsTrigger value="billing">
      <CreditCard className="h-4 w-4 mr-2" />
      Billing
    </TabsTrigger>
  </TabsList>
  <TabsContent value="overview">
    {/* Dashboard content */}
  </TabsContent>
</Tabs>
\`\`\``,
      },

      calendar: {
        name: 'Calendar',
        description: 'Date picker for appointment scheduling.',
        variants: ['default', 'range'],
        states: ['default', 'disabled'],
        props: {
          mode: { type: 'string', default: 'single' },
          selected: { type: 'Date' },
        },
        usage: `## Calendar Usage - Appointment Scheduling

\`\`\`tsx
// Single date selection
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={setSelectedDate}
  disabled={(date) =>
    date < new Date() || // Past dates
    date.getDay() === 0 || // Sundays
    date.getDay() === 6    // Saturdays
  }
  className="rounded-md border"
/>

// With available slots indicator
<Calendar
  mode="single"
  selected={selectedDate}
  onSelect={setSelectedDate}
  modifiers={{
    available: availableDates,
    limited: limitedDates,
  }}
  modifiersStyles={{
    available: { backgroundColor: '#c7e59f40' },
    limited: { backgroundColor: '#f59e0b20' },
  }}
/>
\`\`\``,
      },
    },

    guidelines: `# Ochsner Health Design System Guidelines

## Brand Overview

Ochsner Health is Louisiana's leading nonprofit healthcare provider, delivering expert care across 47 hospitals and 370+ health centers. This design system reflects Ochsner's commitment to trustworthy, professional, and compassionate healthcare.

## Theme Support (REQUIRED)

### Light Theme (Default)
- Background: White (#ffffff)
- Cards: White with subtle purple-tinted shadows
- Primary: Deep Purple (#461d7c)
- Text: Dark navy (#1a1a2e)

### Dark Theme
- Background: Deep purple-black (#0f0a1a)
- Cards: Dark purple (#1a1429)
- Primary: Light purple (#8b5cf6) for visibility
- Text: Light gray (#f8f8fc)

### Implementation
\`\`\`css
:root {
  --background: 0 0% 100%;
  --foreground: 240 24% 14%;
  --primary: 265 63% 30%;
  --card: 0 0% 100%;
  --border: 240 10% 91%;
}

.dark {
  --background: 265 40% 8%;
  --foreground: 240 20% 98%;
  --primary: 263 85% 66%;
  --card: 265 35% 13%;
  --border: 265 25% 30%;
}
\`\`\`

## Color Philosophy

### Primary Purple (#461d7c)
- Represents trust, wisdom, and healthcare expertise
- Use for primary CTAs, active states, navigation
- In dark mode, use lighter variant (#8b5cf6)

### Accent Green (#c7e59f)
- Represents health, growth, and positive outcomes
- Use for success states, health indicators, progress
- Consistent across both themes

### Status Colors
- **Success Green** (#16a34a): Normal results, confirmations
- **Warning Amber** (#f59e0b): Attention needed, borderline
- **Error Red** (#dc2626): Critical, cancelled, errors
- **Info Purple** (#461d7c): Informational, in-progress

## Typography

### Montserrat (Headings)
- Weights: Semibold (600), Bold (700)
- Use for page titles, card headers, buttons

### Roboto (Body)
- Weights: Regular (400), Medium (500)
- Excellent readability for medical information
- Use for paragraphs, labels, descriptions

### Healthcare Typography Rules
- Minimum 16px for body text
- Minimum 14px for secondary text
- Line height 1.5 for readability
- Never use all caps for medical terms

## Accessibility (WCAG 2.2 AA Required)

### Color Contrast
- Text: 4.5:1 minimum (7:1 preferred)
- Large text: 3:1 minimum
- UI components: 3:1 minimum

### Touch Targets
- Minimum 48x48px for all interactive elements
- 8px minimum spacing between targets

### Screen Reader Support
- Semantic HTML structure
- ARIA labels for icons and actions
- Focus management in modals
- Skip links for navigation

### Elderly Users
- Large font size options
- High contrast mode support
- Clear error messages
- Simple navigation patterns

## Healthcare UX Patterns

### Patient Dashboard
- Card-based layout for health summaries
- Quick action buttons prominently placed
- Status badges with clear color coding
- Recent activity timeline

### Appointment Scheduling
- Calendar with available dates highlighted
- Provider cards with photos
- Time slot selection with clear feedback
- Multi-step confirmation flow

### Medical Records
- Tabbed navigation by record type
- Expandable sections for details
- Clear date/time formatting
- Download and print options

### Lab Results
- Table format with reference ranges
- Color-coded status indicators
- Trend charts for historical data
- Provider notes section

### Forms & Data Entry
- One question per screen for mobile
- Progress indicator for multi-step
- Inline validation with clear errors
- Autosave for long forms

## HIPAA & Security Considerations

### Visual Security Indicators
- Lock icons for sensitive data
- "Secure" badges on forms
- Session timeout warnings
- Encryption indicators

### Privacy Patterns
- Masked SSN/sensitive data by default
- "Show/Hide" toggles for PHI
- Audit log awareness messaging
- Clear data retention notices

## Do's and Don'ts

### Do
- Use purple for primary actions
- Use green for health-positive states
- Maintain clean, uncluttered layouts
- Provide clear feedback for all actions
- Support both light and dark themes
- Test with screen readers
- Use loading states for async operations

### Don't
- Use bright/neon colors
- Overcrowd screens with information
- Use small fonts for health data
- Hide critical actions in menus
- Forget dark mode styling
- Use color alone to convey meaning
- Skip loading/error states`,

    examples: [
      {
        id: 'ochsner-theme-setup',
        title: 'Theme Configuration (globals.css)',
        description: 'CSS variables for light and dark theme support',
        language: 'css',
        code: `/* Ochsner Health Theme - globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Light Theme */
    --background: 0 0% 100%;
    --foreground: 240 24% 14%;

    --card: 0 0% 100%;
    --card-foreground: 240 24% 14%;

    --popover: 0 0% 100%;
    --popover-foreground: 240 24% 14%;

    --primary: 265 63% 30%;
    --primary-foreground: 0 0% 100%;

    --secondary: 260 30% 96%;
    --secondary-foreground: 265 63% 30%;

    --muted: 240 10% 96%;
    --muted-foreground: 240 10% 50%;

    --accent: 83 60% 76%;
    --accent-foreground: 240 24% 14%;

    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;

    --border: 240 10% 91%;
    --input: 240 10% 91%;
    --ring: 265 63% 30%;

    --radius: 0.5rem;
  }

  .dark {
    /* Dark Theme */
    --background: 265 40% 8%;
    --foreground: 240 20% 98%;

    --card: 265 35% 13%;
    --card-foreground: 240 20% 98%;

    --popover: 265 35% 13%;
    --popover-foreground: 240 20% 98%;

    --primary: 263 85% 66%;
    --primary-foreground: 0 0% 100%;

    --secondary: 265 25% 20%;
    --secondary-foreground: 240 20% 98%;

    --muted: 265 25% 20%;
    --muted-foreground: 240 10% 70%;

    --accent: 83 60% 76%;
    --accent-foreground: 240 24% 14%;

    --destructive: 0 70% 50%;
    --destructive-foreground: 0 0% 100%;

    --border: 265 25% 25%;
    --input: 265 25% 25%;
    --ring: 263 85% 66%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}`,
        tags: ['theme', 'css', 'dark-mode', 'light-mode', 'variables'],
      },
      {
        id: 'ochsner-theme-toggle',
        title: 'Theme Toggle Component',
        description: 'Sun/moon toggle for switching between light and dark themes',
        language: 'tsx',
        code: `'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="h-9 w-9"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}

// In layout.tsx, wrap with ThemeProvider:
// import { ThemeProvider } from 'next-themes';
// <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
//   {children}
// </ThemeProvider>`,
        tags: ['theme', 'toggle', 'dark-mode', 'component'],
      },
      {
        id: 'ochsner-patient-dashboard',
        title: 'Patient Dashboard',
        description: 'Main patient dashboard with health overview cards',
        language: 'tsx',
        code: `import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  Calendar, Activity, FileText, Heart,
  TrendingUp, Clock, ChevronRight
} from 'lucide-react';

export function PatientDashboard() {
  return (
    <div className="space-y-6 p-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Welcome back, John</h1>
          <p className="text-muted-foreground">Here's your health summary</p>
        </div>
        <Button>
          <Calendar className="h-4 w-4 mr-2" />
          Schedule Appointment
        </Button>
      </div>

      {/* Health Score */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Heart className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Health Score</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">85/100</p>
              </div>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
              <TrendingUp className="h-3 w-3 mr-1" />
              +5 this month
            </Badge>
          </div>
          <Progress value={85} className="h-2" />
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Next Appointment</p>
                <p className="font-medium">Jan 15, 2025 • 2:00 PM</p>
                <p className="text-sm text-muted-foreground">Dr. Sarah Smith</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Recent Results</p>
                <p className="font-medium">Blood Work - Dec 20</p>
                <Badge variant="success" className="mt-1">All Normal</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:border-primary/50 transition-colors cursor-pointer">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Daily Steps</p>
                <p className="font-medium">7,500 / 10,000</p>
                <Progress value={75} className="h-1 mt-2 w-24" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
          <Button variant="ghost" size="sm">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { doctor: 'Dr. Sarah Smith', specialty: 'Primary Care', date: 'Jan 15', time: '2:00 PM' },
            { doctor: 'Dr. Michael Chen', specialty: 'Cardiology', date: 'Jan 22', time: '10:30 AM' },
          ].map((apt, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {apt.doctor.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{apt.doctor}</p>
                  <p className="text-sm text-muted-foreground">{apt.specialty}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-medium">{apt.date}</p>
                <p className="text-sm text-muted-foreground">{apt.time}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}`,
        tags: ['dashboard', 'patient', 'healthcare', 'cards', 'progress'],
      },
      {
        id: 'ochsner-lab-results',
        title: 'Lab Results Table',
        description: 'Table displaying lab results with status indicators',
        language: 'tsx',
        code: `import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table';
import { Download, Printer, FileText } from 'lucide-react';

interface LabResult {
  test: string;
  result: string;
  unit: string;
  range: string;
  status: 'normal' | 'high' | 'low' | 'critical';
}

const results: LabResult[] = [
  { test: 'Glucose, Fasting', result: '95', unit: 'mg/dL', range: '70-100', status: 'normal' },
  { test: 'Hemoglobin A1c', result: '5.4', unit: '%', range: '<5.7', status: 'normal' },
  { test: 'Total Cholesterol', result: '215', unit: 'mg/dL', range: '<200', status: 'high' },
  { test: 'HDL Cholesterol', result: '55', unit: 'mg/dL', range: '>40', status: 'normal' },
  { test: 'LDL Cholesterol', result: '140', unit: 'mg/dL', range: '<100', status: 'high' },
  { test: 'Triglycerides', result: '120', unit: 'mg/dL', range: '<150', status: 'normal' },
];

function getStatusBadge(status: LabResult['status']) {
  switch (status) {
    case 'normal':
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Normal</Badge>;
    case 'high':
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">High</Badge>;
    case 'low':
      return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">Low</Badge>;
    case 'critical':
      return <Badge variant="destructive">Critical</Badge>;
  }
}

export function LabResults() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Lab Results
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Collected: December 20, 2024 • Ochsner Medical Center
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Test</TableHead>
              <TableHead className="text-right">Result</TableHead>
              <TableHead className="text-right">Reference Range</TableHead>
              <TableHead className="text-center">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {results.map((result) => (
              <TableRow key={result.test}>
                <TableCell className="font-medium">{result.test}</TableCell>
                <TableCell className="text-right">
                  <span className={
                    result.status === 'high' || result.status === 'low'
                      ? 'font-semibold text-yellow-600 dark:text-yellow-400'
                      : result.status === 'critical'
                      ? 'font-bold text-red-600 dark:text-red-400'
                      : ''
                  }>
                    {result.result}
                  </span>
                  <span className="text-muted-foreground ml-1">{result.unit}</span>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {result.range} {result.unit}
                </TableCell>
                <TableCell className="text-center">
                  {getStatusBadge(result.status)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="mt-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
            Provider Note
          </p>
          <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
            Cholesterol levels are slightly elevated. Consider dietary modifications
            and schedule follow-up in 3 months.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}`,
        tags: ['table', 'lab-results', 'healthcare', 'status', 'badge'],
      },
      {
        id: 'ochsner-appointment-booking',
        title: 'Appointment Booking Flow',
        description: 'Multi-step appointment booking with provider selection',
        language: 'tsx',
        code: `'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Calendar } from '@/components/ui/calendar';
import { Progress } from '@/components/ui/progress';
import {
  Calendar as CalendarIcon, Clock, MapPin,
  Star, ChevronRight, ChevronLeft, Check
} from 'lucide-react';

const providers = [
  { id: 1, name: 'Dr. Sarah Smith', specialty: 'Primary Care', rating: 4.9, reviews: 127, available: true },
  { id: 2, name: 'Dr. Michael Chen', specialty: 'Primary Care', rating: 4.8, reviews: 89, available: true },
  { id: 3, name: 'Dr. Emily Johnson', specialty: 'Primary Care', rating: 4.7, reviews: 156, available: false },
];

const timeSlots = ['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '2:00 PM', '2:30 PM', '3:00 PM'];

export function AppointmentBooking() {
  const [step, setStep] = useState(1);
  const [selectedProvider, setSelectedProvider] = useState<number | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedTime, setSelectedTime] = useState<string | null>(null);

  const progress = (step / 3) * 100;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between mb-2">
          <CardTitle>Schedule Appointment</CardTitle>
          <span className="text-sm text-muted-foreground">Step {step} of 3</span>
        </div>
        <Progress value={progress} className="h-2" />
      </CardHeader>

      <CardContent>
        {/* Step 1: Select Provider */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="font-medium">Select a Provider</h3>
            {providers.map((provider) => (
              <div
                key={provider.id}
                onClick={() => provider.available && setSelectedProvider(provider.id)}
                className={\`p-4 rounded-lg border-2 transition-colors cursor-pointer \${
                  selectedProvider === provider.id
                    ? 'border-primary bg-primary/5'
                    : provider.available
                    ? 'border-border hover:border-primary/50'
                    : 'border-border opacity-50 cursor-not-allowed'
                }\`}
              >
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {provider.name.split(' ').slice(1).map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{provider.name}</p>
                    <p className="text-sm text-muted-foreground">{provider.specialty}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm">{provider.rating}</span>
                      <span className="text-sm text-muted-foreground">({provider.reviews} reviews)</span>
                    </div>
                  </div>
                  {!provider.available && (
                    <Badge variant="secondary">Unavailable</Badge>
                  )}
                  {selectedProvider === provider.id && (
                    <Check className="h-5 w-5 text-primary" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Step 2: Select Date & Time */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-3">Select Date</h3>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                disabled={(date) => date < new Date() || date.getDay() === 0}
                className="rounded-md border mx-auto"
              />
            </div>

            {selectedDate && (
              <div>
                <h3 className="font-medium mb-3">Available Times</h3>
                <div className="grid grid-cols-4 gap-2">
                  {timeSlots.map((time) => (
                    <Button
                      key={time}
                      variant={selectedTime === time ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedTime(time)}
                      className="h-10"
                    >
                      {time}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Confirmation */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
                <Check className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold">Confirm Your Appointment</h3>
            </div>

            <div className="p-4 rounded-lg bg-muted/50 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback className="bg-primary text-primary-foreground">SS</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">Dr. Sarah Smith</p>
                  <p className="text-sm text-muted-foreground">Primary Care</p>
                </div>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <CalendarIcon className="h-4 w-4 text-primary" />
                <span>{selectedDate?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <Clock className="h-4 w-4 text-primary" />
                <span>{selectedTime}</span>
              </div>

              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span>Ochsner Medical Center - Main Campus</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        {step > 1 ? (
          <Button variant="outline" onClick={() => setStep(step - 1)}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        ) : (
          <div />
        )}

        {step < 3 ? (
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 1 && !selectedProvider) ||
              (step === 2 && (!selectedDate || !selectedTime))
            }
          >
            Continue
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button className="bg-green-600 hover:bg-green-700">
            <Check className="h-4 w-4 mr-2" />
            Confirm Appointment
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}`,
        tags: ['appointment', 'booking', 'wizard', 'calendar', 'healthcare'],
      },
    ],
  };
}
