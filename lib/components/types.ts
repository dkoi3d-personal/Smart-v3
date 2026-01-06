/**
 * Fleet Component Library - Unified Types
 *
 * These types define the unified API that agents use.
 * Design system adapters translate these to specific implementations.
 */

import { ReactNode } from 'react';

// ============================================================================
// Core Types
// ============================================================================

/** Standard sizes used across components */
export type ComponentSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

/** Standard variants for interactive elements */
export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link';

/** Standard color intents */
export type ColorIntent = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';

/** Standard status colors */
export type StatusColor = 'success' | 'warning' | 'error' | 'info' | 'neutral';

// ============================================================================
// Layout Components
// ============================================================================

export interface StackProps {
  children: ReactNode;
  /** Direction of the stack */
  direction?: 'horizontal' | 'vertical';
  /** Gap between items (uses spacing scale) */
  gap?: ComponentSize | number;
  /** Alignment of items */
  align?: 'start' | 'center' | 'end' | 'stretch' | 'baseline';
  /** Justification of items */
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  /** Whether to wrap items */
  wrap?: boolean;
  className?: string;
}

export interface GridProps {
  children: ReactNode;
  /** Number of columns (responsive object or number) */
  columns?: number | { sm?: number; md?: number; lg?: number; xl?: number };
  /** Gap between items */
  gap?: ComponentSize | number;
  className?: string;
}

export interface ContainerProps {
  children: ReactNode;
  /** Max width constraint */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether to center the container */
  centered?: boolean;
  /** Padding on the sides */
  padding?: ComponentSize;
  className?: string;
}

export interface DividerProps {
  /** Orientation of the divider */
  orientation?: 'horizontal' | 'vertical';
  /** Optional label in the middle */
  label?: string;
  className?: string;
}

// ============================================================================
// Typography Components
// ============================================================================

export interface HeadingProps {
  children: ReactNode;
  /** Semantic level (h1-h6) */
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Visual size (can differ from level) */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether to truncate with ellipsis */
  truncate?: boolean;
  className?: string;
}

export interface TextProps {
  children: ReactNode;
  /** Text size */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Text weight */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  /** Text color intent */
  color?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error';
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether to use monospace font */
  mono?: boolean;
  /** Whether to truncate with ellipsis */
  truncate?: boolean;
  /** Render as span instead of p */
  inline?: boolean;
  className?: string;
}

export interface LabelProps {
  children: ReactNode;
  /** Associated form field ID */
  htmlFor?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// Form Components
// ============================================================================

export interface ButtonProps {
  children: ReactNode;
  /** Button variant */
  variant?: ButtonVariant;
  /** Button size */
  size?: ComponentSize;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Whether the button is in a loading state */
  loading?: boolean;
  /** Icon to show before children */
  leftIcon?: ReactNode;
  /** Icon to show after children */
  rightIcon?: ReactNode;
  /** Whether this is an icon-only button */
  iconOnly?: boolean;
  /** Button type */
  type?: 'button' | 'submit' | 'reset';
  /** Full width button */
  fullWidth?: boolean;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

export interface InputProps {
  /** Input value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Input type */
  type?: 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';
  /** Input size */
  size?: ComponentSize;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Whether the input is read-only */
  readOnly?: boolean;
  /** Whether the input has an error */
  error?: boolean;
  /** Icon to show at the start */
  leftIcon?: ReactNode;
  /** Icon to show at the end */
  rightIcon?: ReactNode;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Blur handler */
  onBlur?: () => void;
  /** ID for the input */
  id?: string;
  /** Name for the input */
  name?: string;
  className?: string;
}

export interface TextAreaProps {
  /** TextArea value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Number of rows */
  rows?: number;
  /** Whether the textarea is disabled */
  disabled?: boolean;
  /** Whether the textarea is read-only */
  readOnly?: boolean;
  /** Whether the textarea has an error */
  error?: boolean;
  /** Whether to allow resize */
  resize?: 'none' | 'vertical' | 'horizontal' | 'both';
  /** Change handler */
  onChange?: (value: string) => void;
  /** ID for the textarea */
  id?: string;
  /** Name for the textarea */
  name?: string;
  className?: string;
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  /** Selected value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Options to display */
  options: SelectOption[];
  /** Select size */
  size?: ComponentSize;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Whether the select has an error */
  error?: boolean;
  /** Change handler */
  onChange?: (value: string) => void;
  /** ID for the select */
  id?: string;
  /** Name for the select */
  name?: string;
  className?: string;
}

export interface CheckboxProps {
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Default checked state for uncontrolled mode */
  defaultChecked?: boolean;
  /** Label to display */
  label?: string;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Indeterminate state */
  indeterminate?: boolean;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** ID for the checkbox */
  id?: string;
  /** Name for the checkbox */
  name?: string;
  className?: string;
}

export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  /** Selected value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Options to display */
  options: RadioOption[];
  /** Layout direction */
  direction?: 'horizontal' | 'vertical';
  /** Whether the group is disabled */
  disabled?: boolean;
  /** Change handler */
  onChange?: (value: string) => void;
  /** Name for the radio group */
  name?: string;
  className?: string;
}

export interface SwitchProps {
  /** Whether the switch is on */
  checked?: boolean;
  /** Default checked state for uncontrolled mode */
  defaultChecked?: boolean;
  /** Label to display */
  label?: string;
  /** Whether the switch is disabled */
  disabled?: boolean;
  /** Switch size */
  size?: ComponentSize;
  /** Change handler */
  onChange?: (checked: boolean) => void;
  /** ID for the switch */
  id?: string;
  className?: string;
}

export interface FormFieldProps {
  children: ReactNode;
  /** Label for the field */
  label?: string;
  /** Helper text below the field */
  helperText?: string;
  /** Error message (shows in error state) */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** ID to connect label to input */
  htmlFor?: string;
  className?: string;
}

// ============================================================================
// Data Display Components
// ============================================================================

export interface CardProps {
  children: ReactNode;
  /** Card variant */
  variant?: 'default' | 'outline' | 'filled' | 'elevated';
  /** Padding size */
  padding?: ComponentSize;
  /** Whether the card is interactive (hover effects) */
  interactive?: boolean;
  /** Click handler (makes card clickable) */
  onClick?: () => void;
  className?: string;
}

export interface CardHeaderProps {
  children: ReactNode;
  /** Title for the card */
  title?: string;
  /** Subtitle for the card */
  subtitle?: string;
  /** Action element (button, menu, etc.) */
  action?: ReactNode;
  className?: string;
}

export interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export interface BadgeProps {
  children: ReactNode;
  /** Badge color intent */
  color?: StatusColor | 'primary' | 'secondary';
  /** Badge variant */
  variant?: 'solid' | 'outline' | 'subtle';
  /** Badge size */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to show as a dot */
  dot?: boolean;
  className?: string;
}

export interface AvatarProps {
  /** Image source URL */
  src?: string;
  /** Alt text for image */
  alt?: string;
  /** Fallback text (initials) */
  fallback?: string;
  /** Avatar size */
  size?: ComponentSize;
  /** Avatar shape */
  shape?: 'circle' | 'square';
  /** Status indicator */
  status?: 'online' | 'offline' | 'away' | 'busy';
  className?: string;
}

export interface AvatarGroupProps {
  children: ReactNode;
  /** Maximum avatars to show */
  max?: number;
  /** Avatar size */
  size?: ComponentSize;
  className?: string;
}

export interface TableColumn<T> {
  /** Unique key for the column */
  key: string;
  /** Header label */
  header: string;
  /** Accessor function or key */
  accessor: keyof T | ((row: T) => ReactNode);
  /** Column width */
  width?: string | number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Whether column is sortable */
  sortable?: boolean;
}

export interface TableProps<T> {
  /** Data to display */
  data: T[];
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Row key accessor */
  rowKey: keyof T | ((row: T) => string);
  /** Whether to show loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Whether rows are selectable */
  selectable?: boolean;
  /** Selected row keys */
  selectedKeys?: string[];
  /** Selection change handler */
  onSelectionChange?: (keys: string[]) => void;
  /** Row click handler */
  onRowClick?: (row: T) => void;
  /** Whether to use striped rows */
  striped?: boolean;
  /** Whether to show hover effect on rows */
  hoverable?: boolean;
  className?: string;
}

export interface ListProps {
  children: ReactNode;
  /** List variant */
  variant?: 'default' | 'divided' | 'cards';
  /** Gap between items */
  gap?: ComponentSize;
  className?: string;
}

export interface ListItemProps {
  children: ReactNode;
  /** Icon or avatar to show at start */
  leftContent?: ReactNode;
  /** Action element at end */
  rightContent?: ReactNode;
  /** Whether the item is interactive */
  interactive?: boolean;
  /** Whether the item is selected */
  selected?: boolean;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Feedback Components
// ============================================================================

export interface AlertProps {
  children: ReactNode;
  /** Alert title */
  title?: string;
  /** Alert color intent */
  color?: StatusColor;
  /** Alert variant */
  variant?: 'solid' | 'outline' | 'subtle';
  /** Icon to display */
  icon?: ReactNode;
  /** Whether the alert is dismissible */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  className?: string;
}

export interface ToastProps {
  /** Toast message */
  message: string;
  /** Toast title */
  title?: string;
  /** Toast color intent */
  color?: StatusColor;
  /** Duration in milliseconds (0 for persistent) */
  duration?: number;
  /** Action button */
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ProgressProps {
  /** Progress value (0-100) */
  value: number;
  /** Maximum value */
  max?: number;
  /** Progress size */
  size?: ComponentSize;
  /** Progress color */
  color?: StatusColor | 'primary';
  /** Whether to show label */
  showLabel?: boolean;
  /** Custom label format */
  formatLabel?: (value: number, max: number) => string;
  /** Whether to show as indeterminate */
  indeterminate?: boolean;
  className?: string;
}

export interface SpinnerProps {
  /** Spinner size */
  size?: ComponentSize;
  /** Spinner color */
  color?: 'default' | 'primary' | 'white';
  /** Accessible label */
  label?: string;
  className?: string;
}

export interface SkeletonProps {
  /** Width of the skeleton */
  width?: string | number;
  /** Height of the skeleton */
  height?: string | number;
  /** Shape variant */
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  /** Whether to animate */
  animate?: boolean;
  className?: string;
}

// ============================================================================
// Overlay Components
// ============================================================================

export interface ModalProps {
  children: ReactNode;
  /** Whether the modal is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Modal title */
  title?: string;
  /** Modal description */
  description?: string;
  /** Modal size */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** Whether clicking overlay closes modal */
  closeOnOverlayClick?: boolean;
  /** Whether pressing Escape closes modal */
  closeOnEscape?: boolean;
  /** Footer content */
  footer?: ReactNode;
  className?: string;
}

export interface DrawerProps {
  children: ReactNode;
  /** Whether the drawer is open */
  open: boolean;
  /** Close handler */
  onClose: () => void;
  /** Drawer title */
  title?: string;
  /** Which side the drawer opens from */
  side?: 'left' | 'right' | 'top' | 'bottom';
  /** Drawer size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /** Footer content */
  footer?: ReactNode;
  className?: string;
}

export interface PopoverProps {
  children: ReactNode;
  /** Trigger element */
  trigger: ReactNode;
  /** Whether the popover is open (controlled) */
  open?: boolean;
  /** Open change handler (controlled) */
  onOpenChange?: (open: boolean) => void;
  /** Placement relative to trigger */
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end';
  /** Trigger mode */
  triggerMode?: 'click' | 'hover';
  className?: string;
}

export interface TooltipProps {
  children: ReactNode;
  /** Tooltip content */
  content: ReactNode;
  /** Placement relative to trigger */
  placement?: 'top' | 'bottom' | 'left' | 'right';
  /** Delay before showing (ms) */
  delayShow?: number;
  /** Delay before hiding (ms) */
  delayHide?: number;
  className?: string;
}

export interface DropdownMenuProps {
  children: ReactNode;
  /** Trigger element */
  trigger: ReactNode;
  /** Menu placement */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
  className?: string;
}

export interface DropdownMenuItemProps {
  children: ReactNode;
  /** Icon to show before label */
  icon?: ReactNode;
  /** Whether the item is disabled */
  disabled?: boolean;
  /** Whether the item is destructive */
  destructive?: boolean;
  /** Keyboard shortcut to display */
  shortcut?: string;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

// ============================================================================
// Navigation Components
// ============================================================================

export interface TabsProps {
  children: ReactNode;
  /** Selected tab value */
  value?: string;
  /** Default value for uncontrolled mode */
  defaultValue?: string;
  /** Tab change handler */
  onChange?: (value: string) => void;
  /** Tabs variant */
  variant?: 'default' | 'pills' | 'underline';
  /** Tabs size */
  size?: ComponentSize;
  /** Whether tabs should fill container */
  fullWidth?: boolean;
  className?: string;
}

export interface TabProps {
  /** Tab value (unique identifier) */
  value: string;
  /** Tab label */
  label: string;
  /** Icon to show before label */
  icon?: ReactNode;
  /** Whether the tab is disabled */
  disabled?: boolean;
  /** Badge count to show */
  badge?: number | string;
}

export interface TabPanelProps {
  children: ReactNode;
  /** Panel value (matches tab value) */
  value: string;
  className?: string;
}

export interface BreadcrumbProps {
  children: ReactNode;
  /** Separator between items */
  separator?: ReactNode;
  className?: string;
}

export interface BreadcrumbItemProps {
  children: ReactNode;
  /** Link href */
  href?: string;
  /** Whether this is the current page */
  current?: boolean;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

export interface NavMenuProps {
  children: ReactNode;
  /** Menu orientation */
  orientation?: 'horizontal' | 'vertical';
  /** Whether menu is collapsed (vertical only) */
  collapsed?: boolean;
  className?: string;
}

export interface NavMenuItemProps {
  children: ReactNode;
  /** Link href */
  href?: string;
  /** Icon to show */
  icon?: ReactNode;
  /** Whether this item is active */
  active?: boolean;
  /** Whether this item is disabled */
  disabled?: boolean;
  /** Badge to show */
  badge?: ReactNode;
  /** Click handler */
  onClick?: () => void;
  className?: string;
}

export interface NavMenuGroupProps {
  children: ReactNode;
  /** Group label */
  label: string;
  /** Icon for the group */
  icon?: ReactNode;
  /** Whether the group is expanded */
  defaultExpanded?: boolean;
  className?: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/** Props that all components accept */
export interface CommonProps {
  className?: string;
  id?: string;
  'data-testid'?: string;
}

/** Design system adapter interface */
export interface DesignSystemAdapter {
  /** Unique identifier for the adapter */
  id: string;
  /** Display name */
  name: string;
  /** Get component implementation */
  getComponent<K extends keyof ComponentRegistry>(name: K): ComponentRegistry[K];
  /** Get CSS/styling utilities */
  getStyles(): AdapterStyles;
}

export interface AdapterStyles {
  /** CSS class prefix */
  prefix: string;
  /** Get spacing class */
  spacing: (size: ComponentSize | number) => string;
  /** Get color class */
  color: (intent: ColorIntent) => string;
  /** Get size class */
  size: (size: ComponentSize) => string;
}

/** Registry of all component types */
export interface ComponentRegistry {
  // Layout
  Stack: React.ComponentType<StackProps>;
  Grid: React.ComponentType<GridProps>;
  Container: React.ComponentType<ContainerProps>;
  Divider: React.ComponentType<DividerProps>;

  // Typography
  Heading: React.ComponentType<HeadingProps>;
  Text: React.ComponentType<TextProps>;
  Label: React.ComponentType<LabelProps>;

  // Forms
  Button: React.ComponentType<ButtonProps>;
  Input: React.ComponentType<InputProps>;
  TextArea: React.ComponentType<TextAreaProps>;
  Select: React.ComponentType<SelectProps>;
  Checkbox: React.ComponentType<CheckboxProps>;
  RadioGroup: React.ComponentType<RadioGroupProps>;
  Switch: React.ComponentType<SwitchProps>;
  FormField: React.ComponentType<FormFieldProps>;

  // Data Display
  Card: React.ComponentType<CardProps>;
  CardHeader: React.ComponentType<CardHeaderProps>;
  CardContent: React.ComponentType<CardContentProps>;
  CardFooter: React.ComponentType<CardFooterProps>;
  Badge: React.ComponentType<BadgeProps>;
  Avatar: React.ComponentType<AvatarProps>;
  AvatarGroup: React.ComponentType<AvatarGroupProps>;
  Table: React.ComponentType<TableProps<any>>;
  List: React.ComponentType<ListProps>;
  ListItem: React.ComponentType<ListItemProps>;

  // Feedback
  Alert: React.ComponentType<AlertProps>;
  Progress: React.ComponentType<ProgressProps>;
  Spinner: React.ComponentType<SpinnerProps>;
  Skeleton: React.ComponentType<SkeletonProps>;

  // Overlay
  Modal: React.ComponentType<ModalProps>;
  Drawer: React.ComponentType<DrawerProps>;
  Popover: React.ComponentType<PopoverProps>;
  Tooltip: React.ComponentType<TooltipProps>;
  DropdownMenu: React.ComponentType<DropdownMenuProps>;
  DropdownMenuItem: React.ComponentType<DropdownMenuItemProps>;

  // Navigation
  Tabs: React.ComponentType<TabsProps>;
  Tab: React.ComponentType<TabProps>;
  TabPanel: React.ComponentType<TabPanelProps>;
  Breadcrumb: React.ComponentType<BreadcrumbProps>;
  BreadcrumbItem: React.ComponentType<BreadcrumbItemProps>;
  NavMenu: React.ComponentType<NavMenuProps>;
  NavMenuItem: React.ComponentType<NavMenuItemProps>;
  NavMenuGroup: React.ComponentType<NavMenuGroupProps>;
}
