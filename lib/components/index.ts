/**
 * Fleet Component Library
 *
 * A thin wrapper component library that provides a unified API for agents.
 * Design system adapters translate props to specific implementations.
 *
 * Benefits:
 * - Agents learn ONE API, not multiple design systems
 * - Consistent component usage across all builds
 * - Smaller prompts (unified docs vs full design system docs)
 * - Easy validation of agent output
 * - Design system agnostic - users can switch without rewriting
 */

// Export all types
export * from './types';

// Export adapters
export { tailwindAdapter } from './adapters/tailwind';

// Export prompt generators
export {
  generateComponentLibraryPrompt,
  generateMinimalComponentPrompt,
  getComponentLibraryPromptWithTokens,
} from './component-library-prompt';

// ============================================================================
// Component Library Configuration
// ============================================================================

export interface ComponentLibraryConfig {
  /** Active design system adapter */
  adapter: 'tailwind' | 'shadcn' | 'material' | 'chakra' | 'custom';
  /** Design system tokens (colors, spacing, etc.) */
  tokens?: Record<string, any>;
  /** Custom class name prefix */
  prefix?: string;
}

let config: ComponentLibraryConfig = {
  adapter: 'tailwind',
};

/**
 * Configure the component library
 */
export function configureComponentLibrary(newConfig: Partial<ComponentLibraryConfig>): void {
  config = { ...config, ...newConfig };
}

/**
 * Get current component library configuration
 */
export function getComponentLibraryConfig(): ComponentLibraryConfig {
  return { ...config };
}

// ============================================================================
// Component Categories (for documentation/tooling)
// ============================================================================

export const COMPONENT_CATEGORIES = {
  layout: ['Stack', 'Grid', 'Container', 'Divider'],
  typography: ['Heading', 'Text', 'Label'],
  forms: ['Button', 'Input', 'TextArea', 'Select', 'Checkbox', 'RadioGroup', 'Switch', 'FormField'],
  dataDisplay: ['Card', 'CardHeader', 'CardContent', 'CardFooter', 'Badge', 'Avatar', 'AvatarGroup', 'Table', 'List', 'ListItem'],
  feedback: ['Alert', 'Progress', 'Spinner', 'Skeleton'],
  overlay: ['Modal', 'Drawer', 'Popover', 'Tooltip', 'DropdownMenu', 'DropdownMenuItem'],
  navigation: ['Tabs', 'Tab', 'TabPanel', 'Breadcrumb', 'BreadcrumbItem', 'NavMenu', 'NavMenuItem', 'NavMenuGroup'],
} as const;

export const ALL_COMPONENTS = Object.values(COMPONENT_CATEGORIES).flat();

// ============================================================================
// Prop Mappings (for validation/transformation)
// ============================================================================

export const PROP_MAPPINGS = {
  sizes: ['xs', 'sm', 'md', 'lg', 'xl'] as const,
  buttonVariants: ['primary', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const,
  cardVariants: ['default', 'outline', 'filled', 'elevated'] as const,
  badgeVariants: ['solid', 'outline', 'subtle'] as const,
  statusColors: ['success', 'warning', 'error', 'info', 'neutral'] as const,
  colorIntents: ['default', 'primary', 'secondary', 'success', 'warning', 'error', 'info'] as const,
  alignments: ['start', 'center', 'end', 'stretch', 'baseline'] as const,
  justifyOptions: ['start', 'center', 'end', 'between', 'around', 'evenly'] as const,
};

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate that a component usage follows the library API
 */
export function validateComponentUsage(
  componentName: string,
  props: Record<string, any>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check if component exists
  if (!ALL_COMPONENTS.includes(componentName as any)) {
    errors.push(`Unknown component: ${componentName}`);
  }

  // Validate common props
  if (props.size && !PROP_MAPPINGS.sizes.includes(props.size)) {
    errors.push(`Invalid size "${props.size}". Use: ${PROP_MAPPINGS.sizes.join(', ')}`);
  }

  if (props.variant) {
    if (componentName === 'Button' && !PROP_MAPPINGS.buttonVariants.includes(props.variant)) {
      errors.push(`Invalid button variant "${props.variant}". Use: ${PROP_MAPPINGS.buttonVariants.join(', ')}`);
    }
    if (componentName === 'Card' && !PROP_MAPPINGS.cardVariants.includes(props.variant)) {
      errors.push(`Invalid card variant "${props.variant}". Use: ${PROP_MAPPINGS.cardVariants.join(', ')}`);
    }
    if (componentName === 'Badge' && !PROP_MAPPINGS.badgeVariants.includes(props.variant)) {
      errors.push(`Invalid badge variant "${props.variant}". Use: ${PROP_MAPPINGS.badgeVariants.join(', ')}`);
    }
  }

  if (props.color && componentName === 'Badge') {
    const validColors = [...PROP_MAPPINGS.statusColors, 'primary', 'secondary'];
    if (!validColors.includes(props.color)) {
      errors.push(`Invalid color "${props.color}". Use: ${validColors.join(', ')}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
