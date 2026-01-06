/**
 * Tailwind CSS Adapter
 *
 * Maps Fleet Component Library props to Tailwind CSS classes.
 * Works with both pure Tailwind and Shadcn UI.
 */

import { ComponentSize, ButtonVariant, ColorIntent, StatusColor } from '../types';

// ============================================================================
// Spacing Utilities
// ============================================================================

const SPACING_MAP: Record<ComponentSize, string> = {
  xs: '1',   // 0.25rem
  sm: '2',   // 0.5rem
  md: '4',   // 1rem
  lg: '6',   // 1.5rem
  xl: '8',   // 2rem
};

const GAP_MAP: Record<ComponentSize, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
};

export function getSpacing(size: ComponentSize | number): string {
  if (typeof size === 'number') {
    return `${size * 0.25}rem`;
  }
  return SPACING_MAP[size];
}

export function getGapClass(size: ComponentSize | number): string {
  if (typeof size === 'number') {
    return `gap-[${size * 0.25}rem]`;
  }
  return GAP_MAP[size];
}

// ============================================================================
// Button Utilities
// ============================================================================

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
  ghost: 'hover:bg-accent hover:text-accent-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  link: 'text-primary underline-offset-4 hover:underline',
};

const BUTTON_SIZE_CLASSES: Record<ComponentSize, string> = {
  xs: 'h-7 px-2 text-xs rounded',
  sm: 'h-8 px-3 text-xs rounded-md',
  md: 'h-9 px-4 text-sm rounded-md',
  lg: 'h-10 px-6 text-base rounded-md',
  xl: 'h-12 px-8 text-lg rounded-lg',
};

export function getButtonClasses(variant: ButtonVariant, size: ComponentSize, fullWidth?: boolean, disabled?: boolean): string {
  const classes = [
    'inline-flex items-center justify-center font-medium transition-colors',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    BUTTON_VARIANT_CLASSES[variant],
    BUTTON_SIZE_CLASSES[size],
  ];

  if (fullWidth) {
    classes.push('w-full');
  }

  if (disabled) {
    classes.push('opacity-50 pointer-events-none');
  }

  return classes.join(' ');
}

// ============================================================================
// Input Utilities
// ============================================================================

const INPUT_SIZE_CLASSES: Record<ComponentSize, string> = {
  xs: 'h-7 px-2 text-xs',
  sm: 'h-8 px-3 text-sm',
  md: 'h-9 px-3 text-sm',
  lg: 'h-10 px-4 text-base',
  xl: 'h-12 px-4 text-lg',
};

export function getInputClasses(size: ComponentSize, error?: boolean, disabled?: boolean): string {
  const classes = [
    'flex w-full rounded-md border bg-background',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'placeholder:text-muted-foreground',
    INPUT_SIZE_CLASSES[size],
  ];

  if (error) {
    classes.push('border-destructive focus-visible:ring-destructive');
  } else {
    classes.push('border-input');
  }

  if (disabled) {
    classes.push('opacity-50 cursor-not-allowed');
  }

  return classes.join(' ');
}

// ============================================================================
// Badge/Status Utilities
// ============================================================================

const STATUS_COLOR_CLASSES: Record<StatusColor | 'primary' | 'secondary', { solid: string; outline: string; subtle: string }> = {
  success: {
    solid: 'bg-green-500 text-white',
    outline: 'border-green-500 text-green-500',
    subtle: 'bg-green-500/10 text-green-500',
  },
  warning: {
    solid: 'bg-yellow-500 text-white',
    outline: 'border-yellow-500 text-yellow-500',
    subtle: 'bg-yellow-500/10 text-yellow-500',
  },
  error: {
    solid: 'bg-red-500 text-white',
    outline: 'border-red-500 text-red-500',
    subtle: 'bg-red-500/10 text-red-500',
  },
  info: {
    solid: 'bg-blue-500 text-white',
    outline: 'border-blue-500 text-blue-500',
    subtle: 'bg-blue-500/10 text-blue-500',
  },
  neutral: {
    solid: 'bg-gray-500 text-white',
    outline: 'border-gray-500 text-gray-500',
    subtle: 'bg-gray-500/10 text-gray-500',
  },
  primary: {
    solid: 'bg-primary text-primary-foreground',
    outline: 'border-primary text-primary',
    subtle: 'bg-primary/10 text-primary',
  },
  secondary: {
    solid: 'bg-secondary text-secondary-foreground',
    outline: 'border-secondary text-secondary-foreground',
    subtle: 'bg-secondary/10 text-secondary-foreground',
  },
};

const BADGE_SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-2.5 py-1 text-sm',
};

export function getBadgeClasses(
  color: StatusColor | 'primary' | 'secondary',
  variant: 'solid' | 'outline' | 'subtle',
  size: 'sm' | 'md' | 'lg'
): string {
  const classes = [
    'inline-flex items-center font-medium rounded-full',
    STATUS_COLOR_CLASSES[color][variant],
    BADGE_SIZE_CLASSES[size],
  ];

  if (variant === 'outline') {
    classes.push('border');
  }

  return classes.join(' ');
}

// ============================================================================
// Alert Utilities
// ============================================================================

const ALERT_COLOR_CLASSES: Record<StatusColor, { solid: string; outline: string; subtle: string }> = {
  success: {
    solid: 'bg-green-500 text-white border-green-500',
    outline: 'border-green-500 text-green-700 dark:text-green-400',
    subtle: 'bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20',
  },
  warning: {
    solid: 'bg-yellow-500 text-white border-yellow-500',
    outline: 'border-yellow-500 text-yellow-700 dark:text-yellow-400',
    subtle: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20',
  },
  error: {
    solid: 'bg-red-500 text-white border-red-500',
    outline: 'border-red-500 text-red-700 dark:text-red-400',
    subtle: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  },
  info: {
    solid: 'bg-blue-500 text-white border-blue-500',
    outline: 'border-blue-500 text-blue-700 dark:text-blue-400',
    subtle: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  },
  neutral: {
    solid: 'bg-gray-500 text-white border-gray-500',
    outline: 'border-gray-300 text-gray-700 dark:text-gray-300',
    subtle: 'bg-gray-500/10 text-gray-700 dark:text-gray-300 border-gray-500/20',
  },
};

export function getAlertClasses(color: StatusColor, variant: 'solid' | 'outline' | 'subtle'): string {
  return [
    'relative w-full rounded-lg border p-4',
    ALERT_COLOR_CLASSES[color][variant],
  ].join(' ');
}

// ============================================================================
// Card Utilities
// ============================================================================

const CARD_VARIANT_CLASSES: Record<string, string> = {
  default: 'border bg-card text-card-foreground',
  outline: 'border-2 bg-transparent',
  filled: 'bg-muted',
  elevated: 'border bg-card text-card-foreground shadow-lg',
};

const CARD_PADDING_CLASSES: Record<ComponentSize, string> = {
  xs: 'p-2',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
};

export function getCardClasses(
  variant: 'default' | 'outline' | 'filled' | 'elevated',
  padding: ComponentSize,
  interactive?: boolean
): string {
  const classes = [
    'rounded-lg',
    CARD_VARIANT_CLASSES[variant],
    CARD_PADDING_CLASSES[padding],
  ];

  if (interactive) {
    classes.push('cursor-pointer transition-colors hover:bg-accent/50');
  }

  return classes.join(' ');
}

// ============================================================================
// Typography Utilities
// ============================================================================

const HEADING_SIZE_CLASSES: Record<string, string> = {
  xs: 'text-sm font-semibold',
  sm: 'text-base font-semibold',
  md: 'text-lg font-semibold',
  lg: 'text-xl font-semibold',
  xl: 'text-2xl font-bold',
  '2xl': 'text-3xl font-bold',
  '3xl': 'text-4xl font-bold tracking-tight',
  '4xl': 'text-5xl font-bold tracking-tight',
};

export function getHeadingClasses(size: string, align?: 'left' | 'center' | 'right', truncate?: boolean): string {
  const classes = [
    HEADING_SIZE_CLASSES[size] || HEADING_SIZE_CLASSES.md,
    'text-foreground',
  ];

  if (align) {
    classes.push(`text-${align}`);
  }

  if (truncate) {
    classes.push('truncate');
  }

  return classes.join(' ');
}

const TEXT_SIZE_CLASSES: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const TEXT_COLOR_CLASSES: Record<string, string> = {
  default: 'text-foreground',
  muted: 'text-muted-foreground',
  primary: 'text-primary',
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
};

export function getTextClasses(
  size: 'xs' | 'sm' | 'md' | 'lg',
  color: string,
  weight?: string,
  align?: string,
  mono?: boolean,
  truncate?: boolean
): string {
  const classes = [
    TEXT_SIZE_CLASSES[size],
    TEXT_COLOR_CLASSES[color] || TEXT_COLOR_CLASSES.default,
  ];

  if (weight) {
    classes.push(`font-${weight}`);
  }

  if (align) {
    classes.push(`text-${align}`);
  }

  if (mono) {
    classes.push('font-mono');
  }

  if (truncate) {
    classes.push('truncate');
  }

  return classes.join(' ');
}

// ============================================================================
// Layout Utilities
// ============================================================================

export function getStackClasses(
  direction: 'horizontal' | 'vertical',
  gap: ComponentSize | number,
  align?: string,
  justify?: string,
  wrap?: boolean
): string {
  const classes = ['flex'];

  if (direction === 'vertical') {
    classes.push('flex-col');
  }

  classes.push(getGapClass(typeof gap === 'number' ? 'md' : gap));

  if (align) {
    const alignMap: Record<string, string> = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
      baseline: 'items-baseline',
    };
    classes.push(alignMap[align] || '');
  }

  if (justify) {
    const justifyMap: Record<string, string> = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    };
    classes.push(justifyMap[justify] || '');
  }

  if (wrap) {
    classes.push('flex-wrap');
  }

  return classes.join(' ');
}

export function getGridClasses(
  columns: number | { sm?: number; md?: number; lg?: number; xl?: number },
  gap: ComponentSize | number
): string {
  const classes = ['grid'];

  if (typeof columns === 'number') {
    classes.push(`grid-cols-${columns}`);
  } else {
    if (columns.sm) classes.push(`sm:grid-cols-${columns.sm}`);
    if (columns.md) classes.push(`md:grid-cols-${columns.md}`);
    if (columns.lg) classes.push(`lg:grid-cols-${columns.lg}`);
    if (columns.xl) classes.push(`xl:grid-cols-${columns.xl}`);
    // Default to 1 column on mobile
    classes.push('grid-cols-1');
  }

  classes.push(getGapClass(typeof gap === 'number' ? 'md' : gap));

  return classes.join(' ');
}

const CONTAINER_SIZE_CLASSES: Record<string, string> = {
  sm: 'max-w-screen-sm',
  md: 'max-w-screen-md',
  lg: 'max-w-screen-lg',
  xl: 'max-w-screen-xl',
  full: 'max-w-full',
};

const CONTAINER_PADDING_CLASSES: Record<ComponentSize, string> = {
  xs: 'px-2',
  sm: 'px-4',
  md: 'px-6',
  lg: 'px-8',
  xl: 'px-12',
};

export function getContainerClasses(
  size: 'sm' | 'md' | 'lg' | 'xl' | 'full',
  centered?: boolean,
  padding?: ComponentSize
): string {
  const classes = [
    'w-full',
    CONTAINER_SIZE_CLASSES[size],
  ];

  if (centered) {
    classes.push('mx-auto');
  }

  if (padding) {
    classes.push(CONTAINER_PADDING_CLASSES[padding]);
  }

  return classes.join(' ');
}

// ============================================================================
// Avatar Utilities
// ============================================================================

const AVATAR_SIZE_CLASSES: Record<ComponentSize, string> = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-12 w-12 text-lg',
  xl: 'h-16 w-16 text-xl',
};

export function getAvatarClasses(size: ComponentSize, shape: 'circle' | 'square'): string {
  const classes = [
    'relative inline-flex items-center justify-center overflow-hidden bg-muted',
    AVATAR_SIZE_CLASSES[size],
  ];

  if (shape === 'circle') {
    classes.push('rounded-full');
  } else {
    classes.push('rounded-md');
  }

  return classes.join(' ');
}

// ============================================================================
// Progress Utilities
// ============================================================================

const PROGRESS_SIZE_CLASSES: Record<ComponentSize, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2',
  lg: 'h-3',
  xl: 'h-4',
};

const PROGRESS_COLOR_CLASSES: Record<StatusColor | 'primary', string> = {
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  error: 'bg-red-500',
  info: 'bg-blue-500',
  neutral: 'bg-gray-500',
  primary: 'bg-primary',
};

export function getProgressClasses(size: ComponentSize): string {
  return [
    'relative w-full overflow-hidden rounded-full bg-secondary',
    PROGRESS_SIZE_CLASSES[size],
  ].join(' ');
}

export function getProgressBarClasses(color: StatusColor | 'primary'): string {
  return [
    'h-full transition-all',
    PROGRESS_COLOR_CLASSES[color],
  ].join(' ');
}

// ============================================================================
// Spinner Utilities
// ============================================================================

const SPINNER_SIZE_CLASSES: Record<ComponentSize, string> = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

export function getSpinnerClasses(size: ComponentSize, color: 'default' | 'primary' | 'white'): string {
  const colorClass = color === 'white' ? 'text-white' : color === 'primary' ? 'text-primary' : 'text-muted-foreground';
  return [
    'animate-spin',
    SPINNER_SIZE_CLASSES[size],
    colorClass,
  ].join(' ');
}

// ============================================================================
// Tabs Utilities
// ============================================================================

const TABS_VARIANT_CLASSES: Record<string, { list: string; trigger: string; triggerActive: string }> = {
  default: {
    list: 'inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground',
    trigger: 'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    triggerActive: 'bg-background text-foreground shadow-sm',
  },
  pills: {
    list: 'inline-flex items-center gap-1',
    trigger: 'inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
    triggerActive: 'bg-primary text-primary-foreground',
  },
  underline: {
    list: 'inline-flex items-center border-b',
    trigger: 'inline-flex items-center justify-center whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 border-transparent -mb-px transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
    triggerActive: 'border-primary text-foreground',
  },
};

export function getTabsClasses(variant: 'default' | 'pills' | 'underline'): typeof TABS_VARIANT_CLASSES.default {
  return TABS_VARIANT_CLASSES[variant];
}

// ============================================================================
// Export combined utility object
// ============================================================================

export const tailwindAdapter = {
  // Spacing
  getSpacing,
  getGapClass,

  // Components
  getButtonClasses,
  getInputClasses,
  getBadgeClasses,
  getAlertClasses,
  getCardClasses,
  getHeadingClasses,
  getTextClasses,
  getStackClasses,
  getGridClasses,
  getContainerClasses,
  getAvatarClasses,
  getProgressClasses,
  getProgressBarClasses,
  getSpinnerClasses,
  getTabsClasses,
};

export default tailwindAdapter;
