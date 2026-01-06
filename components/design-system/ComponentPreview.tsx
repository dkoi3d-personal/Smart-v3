'use client';

/**
 * Component Preview System
 *
 * Renders live components with design system tokens applied.
 * Used in the design systems settings page to preview how components look.
 */

import { useState, useId, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Settings,
  Trash2,
  Edit,
  Check,
  X,
  AlertCircle,
  CheckCircle2,
  Info,
  AlertTriangle,
  Loader2,
  MoreHorizontal,
  ChevronDown,
  Search,
  Bell,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Star,
  Heart,
  Share,
  Download,
  Upload,
  Play,
  Pause,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Sun,
  Moon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DesignSystem } from '@/lib/design-systems/types';

interface ComponentPreviewProps {
  designSystem: DesignSystem;
}

// ============================================================================
// Design System Token Converter
// ============================================================================

/**
 * Convert a hex/oklch color to HSL format for CSS variables
 * Returns HSL values without the hsl() wrapper for Tailwind compatibility
 */
function colorToHsl(color: string | Record<string, string> | undefined): string {
  // Handle undefined or null
  if (!color) {
    return '0 0% 50%'; // Default gray
  }

  // Handle object format (e.g., { "50": "#...", "DEFAULT": "#..." })
  if (typeof color === 'object') {
    // Try to get DEFAULT, 500, or first available value
    const colorValue = color.DEFAULT || color['500'] || color['600'] || Object.values(color)[0];
    if (typeof colorValue === 'string') {
      return colorToHsl(colorValue);
    }
    return '0 0% 50%'; // Fallback
  }

  // Ensure color is a string
  if (typeof color !== 'string') {
    return '0 0% 50%'; // Fallback for unexpected types
  }

  // If already in oklch format, convert to hex first (approximation)
  if (color.startsWith('oklch')) {
    // For oklch colors, we'll use a simple mapping approach
    // This is a simplified conversion - in production you'd want a proper oklch-to-hsl converter
    return color; // Let CSS handle oklch directly
  }

  // Handle hex colors
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    if (max === min) {
      return `0 0% ${Math.round(l * 100)}%`;
    }

    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    let h = 0;
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;

    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  }

  // Return as-is for other formats
  return color;
}

/**
 * Normalize colors to the expected flat format
 * Handles both flat format (background, foreground) and scaled format (primary.DEFAULT)
 * Also handles mixed formats where both exist
 */
function normalizeColors(colors: DesignSystem['tokens']['colors']): Record<string, string> {
  // Cast to unknown first, then to Record for type safety
  const colorsRecord = colors as unknown as Record<string, unknown>;

  // Helper to get a string color value from a potentially nested structure
  const getStringColor = (key: string, fallback: string): string => {
    const val = colorsRecord[key];
    if (typeof val === 'string') return val;
    if (val && typeof val === 'object') {
      const obj = val as Record<string, string>;
      return obj.DEFAULT || obj['500'] || obj['600'] || Object.values(obj)[0] || fallback;
    }
    return fallback;
  };

  // Helper to get a color scale object
  const getColorScale = (key: string): Record<string, string> | null => {
    const val = colorsRecord[key];
    if (val && typeof val === 'object') {
      return val as Record<string, string>;
    }
    return null;
  };

  // Get primary and neutral color scales for proper mapping
  const neutral = getColorScale('neutral');
  const primary = getColorScale('primary');

  // Build the flat format, preferring explicit flat values if they exist
  return {
    // Background and foreground
    background: getStringColor('background', neutral?.['50'] || '#ffffff'),
    foreground: getStringColor('foreground', primary?.['900'] || neutral?.['900'] || '#0a0a0a'),
    // Cards
    card: getStringColor('card', neutral?.['50'] || '#ffffff'),
    cardForeground: getStringColor('cardForeground', primary?.['900'] || neutral?.['900'] || '#0a0a0a'),
    // Popovers
    popover: getStringColor('popover', neutral?.['50'] || '#ffffff'),
    popoverForeground: getStringColor('popoverForeground', primary?.['900'] || neutral?.['900'] || '#0a0a0a'),
    // Primary brand color
    primary: getStringColor('primary', primary?.DEFAULT || primary?.['600'] || '#3b82f6'),
    primaryForeground: getStringColor('primaryForeground', '#ffffff'),
    // Secondary
    secondary: getStringColor('secondary', '#6b7280'),
    secondaryForeground: getStringColor('secondaryForeground', '#ffffff'),
    // Muted
    muted: getStringColor('muted', neutral?.['100'] || '#f4f4f5'),
    mutedForeground: getStringColor('mutedForeground', neutral?.['500'] || '#71717a'),
    // Accent
    accent: getStringColor('accent', '#f59e0b'),
    accentForeground: getStringColor('accentForeground', '#ffffff'),
    // Destructive
    destructive: getStringColor('destructive', '#ef4444'),
    destructiveForeground: getStringColor('destructiveForeground', '#ffffff'),
    // Borders and inputs
    border: getStringColor('border', neutral?.['200'] || '#e4e4e7'),
    input: getStringColor('input', neutral?.['200'] || '#e4e4e7'),
    ring: getStringColor('ring', primary?.DEFAULT || '#3b82f6'),
  };
}

/**
 * Generate dark mode colors from a light theme
 * Creates proper dark theme with good contrast
 */
function generateInvertedColors(colors: DesignSystem['tokens']['colors']): Record<string, string> {
  const normalized = normalizeColors(colors);
  const colorsRecord = colors as unknown as Record<string, unknown>;

  // Helper to get color scale for dark mode variants
  const getColorScale = (key: string): Record<string, string> | null => {
    const val = colorsRecord[key];
    if (val && typeof val === 'object') {
      return val as Record<string, string>;
    }
    return null;
  };

  const neutral = getColorScale('neutral');
  const primary = getColorScale('primary');

  // Create proper dark mode colors
  return {
    // Dark backgrounds
    background: neutral?.['900'] || neutral?.['950'] || '#0a0a0a',
    foreground: neutral?.['50'] || neutral?.['100'] || '#fafafa',
    // Cards slightly lighter than background
    card: neutral?.['800'] || neutral?.['900'] || '#171717',
    cardForeground: neutral?.['50'] || neutral?.['100'] || '#fafafa',
    // Popovers
    popover: neutral?.['800'] || neutral?.['900'] || '#171717',
    popoverForeground: neutral?.['50'] || neutral?.['100'] || '#fafafa',
    // Primary stays the same but ensure good contrast
    primary: primary?.['400'] || primary?.['500'] || normalized.primary,
    primaryForeground: '#ffffff',
    // Secondary
    secondary: neutral?.['700'] || neutral?.['800'] || '#262626',
    secondaryForeground: neutral?.['100'] || '#fafafa',
    // Muted - darker backgrounds, lighter text
    muted: neutral?.['800'] || neutral?.['700'] || '#262626',
    mutedForeground: neutral?.['400'] || neutral?.['300'] || '#a3a3a3',
    // Accent - keep vibrant
    accent: normalized.accent,
    accentForeground: '#ffffff',
    // Destructive
    destructive: normalized.destructive,
    destructiveForeground: '#ffffff',
    // Borders - darker
    border: neutral?.['700'] || neutral?.['800'] || '#262626',
    input: neutral?.['700'] || neutral?.['800'] || '#262626',
    ring: primary?.['400'] || primary?.['500'] || normalized.primary,
  };
}

/**
 * Get a color string from either a string or object color value
 */
function getColorString(color: string | Record<string, string> | undefined): string {
  if (!color) return '';
  if (typeof color === 'string') return color;
  if (typeof color === 'object') {
    return color.DEFAULT || color['500'] || color['600'] || Object.values(color)[0] || '';
  }
  return '';
}

/**
 * Generate scoped CSS for design system preview
 * Supports both normal and inverted (theme toggle) modes
 */
function generateScopedCss(
  scopeId: string,
  tokens: DesignSystem['tokens'],
  inverted: boolean = false
): string {
  // Normalize colors first to handle both flat and scaled formats
  const normalizedColors = normalizeColors(tokens.colors);
  const colors = inverted ? generateInvertedColors(tokens.colors) : normalizedColors;
  const bgColor = colors.background || '';
  const isOklch = bgColor.startsWith('oklch');

  // For oklch colors, we need to use color-mix or direct values
  // For hex colors, we convert to HSL format for Tailwind

  const cssVars = isOklch ? `
    --background: ${colors.background};
    --foreground: ${colors.foreground};
    --card: ${colors.card};
    --card-foreground: ${colors.cardForeground};
    --popover: ${colors.popover};
    --popover-foreground: ${colors.popoverForeground};
    --primary: ${colors.primary};
    --primary-foreground: ${colors.primaryForeground};
    --secondary: ${colors.secondary};
    --secondary-foreground: ${colors.secondaryForeground};
    --muted: ${colors.muted};
    --muted-foreground: ${colors.mutedForeground};
    --accent: ${colors.accent};
    --accent-foreground: ${colors.accentForeground};
    --destructive: ${colors.destructive};
    --destructive-foreground: ${colors.destructiveForeground || colors.primaryForeground};
    --border: ${colors.border};
    --input: ${colors.input};
    --ring: ${colors.ring};
  ` : `
    --background: ${colorToHsl(colors.background)};
    --foreground: ${colorToHsl(colors.foreground)};
    --card: ${colorToHsl(colors.card)};
    --card-foreground: ${colorToHsl(colors.cardForeground)};
    --popover: ${colorToHsl(colors.popover)};
    --popover-foreground: ${colorToHsl(colors.popoverForeground)};
    --primary: ${colorToHsl(colors.primary)};
    --primary-foreground: ${colorToHsl(colors.primaryForeground)};
    --secondary: ${colorToHsl(colors.secondary)};
    --secondary-foreground: ${colorToHsl(colors.secondaryForeground)};
    --muted: ${colorToHsl(colors.muted)};
    --muted-foreground: ${colorToHsl(colors.mutedForeground)};
    --accent: ${colorToHsl(colors.accent)};
    --accent-foreground: ${colorToHsl(colors.accentForeground)};
    --destructive: ${colorToHsl(colors.destructive)};
    --destructive-foreground: ${colorToHsl(colors.destructiveForeground || colors.primaryForeground)};
    --border: ${colorToHsl(colors.border)};
    --input: ${colorToHsl(colors.input)};
    --ring: ${colorToHsl(colors.ring)};
  `;

  const bg = (c: string) => isOklch ? c : `hsl(${colorToHsl(c)})`;

  // Determine if this is light or dark mode based on background
  const bgLightness = colors.background.startsWith('#fff') ||
    colors.background === '#ffffff' ||
    colors.background.startsWith('#f') ? 'light' : 'dark';
  const isLight = bgLightness === 'light';

  // Semantic colors that adapt to light/dark
  const semanticColors = {
    success: isLight ? '#059669' : '#34d399',      // emerald-600 / emerald-400
    successBg: isLight ? 'rgba(16,185,129,0.1)' : 'rgba(16,185,129,0.15)',
    successBorder: isLight ? 'rgba(16,185,129,0.3)' : 'rgba(16,185,129,0.25)',
    warning: isLight ? '#d97706' : '#fbbf24',       // amber-600 / amber-400
    warningBg: isLight ? 'rgba(245,158,11,0.1)' : 'rgba(245,158,11,0.15)',
    warningBorder: isLight ? 'rgba(245,158,11,0.3)' : 'rgba(245,158,11,0.25)',
    error: isLight ? '#dc2626' : '#f87171',         // red-600 / red-400
    errorBg: isLight ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.15)',
    errorBorder: isLight ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.25)',
    info: isLight ? '#2563eb' : '#60a5fa',          // blue-600 / blue-400
    infoBg: isLight ? 'rgba(59,130,246,0.1)' : 'rgba(59,130,246,0.15)',
    infoBorder: isLight ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.25)',
  };

  return `
    #${scopeId} {
      ${cssVars}
      --success: ${semanticColors.success};
      --warning: ${semanticColors.warning};
      --error: ${semanticColors.error};
      --info: ${semanticColors.info};
      background-color: ${bg(colors.background)};
      color: ${bg(colors.foreground)};
    }
    /* All text inside should inherit foreground color */
    #${scopeId} * { color: inherit; }
    #${scopeId} h1, #${scopeId} h2, #${scopeId} h3, #${scopeId} h4, #${scopeId} h5, #${scopeId} h6,
    #${scopeId} p, #${scopeId} span, #${scopeId} div, #${scopeId} label {
      color: ${bg(colors.foreground)};
    }
    /* Background utilities */
    #${scopeId} .bg-background { background-color: ${bg(colors.background)}; }
    #${scopeId} .bg-card { background-color: ${bg(colors.card)}; }
    #${scopeId} .bg-muted { background-color: ${bg(colors.muted)}; }
    #${scopeId} .bg-primary { background-color: ${bg(colors.primary)}; }
    #${scopeId} .bg-secondary { background-color: ${bg(colors.secondary)}; }
    #${scopeId} .bg-accent { background-color: ${bg(colors.accent)}; }
    #${scopeId} .bg-destructive { background-color: ${bg(colors.destructive)}; }
    /* Text color utilities */
    #${scopeId} .text-foreground { color: ${bg(colors.foreground)} !important; }
    #${scopeId} .text-primary { color: ${bg(colors.primary)} !important; }
    #${scopeId} .text-primary-foreground { color: ${bg(colors.primaryForeground)} !important; }
    #${scopeId} .text-secondary { color: ${bg(colors.secondary)} !important; }
    #${scopeId} .text-secondary-foreground { color: ${bg(colors.secondaryForeground)} !important; }
    #${scopeId} .text-muted-foreground { color: ${bg(colors.mutedForeground)} !important; }
    #${scopeId} .text-accent-foreground { color: ${bg(colors.accentForeground)} !important; }
    #${scopeId} .text-destructive { color: ${bg(colors.destructive)} !important; }
    #${scopeId} .text-destructive-foreground { color: ${bg(colors.destructiveForeground)} !important; }
    #${scopeId} .text-card-foreground { color: ${bg(colors.cardForeground)} !important; }
    /* Semantic status colors - adapt to light/dark */
    #${scopeId} .text-emerald-400, #${scopeId} .text-emerald-500 { color: ${semanticColors.success} !important; }
    #${scopeId} .text-emerald-100, #${scopeId} .text-emerald-200 { color: ${semanticColors.success} !important; }
    #${scopeId} .text-amber-400, #${scopeId} .text-amber-500 { color: ${semanticColors.warning} !important; }
    #${scopeId} .text-amber-100, #${scopeId} .text-amber-200 { color: ${semanticColors.warning} !important; }
    #${scopeId} .text-rose-400, #${scopeId} .text-rose-500 { color: ${semanticColors.error} !important; }
    #${scopeId} .text-rose-100, #${scopeId} .text-rose-200 { color: ${semanticColors.error} !important; }
    #${scopeId} .text-blue-400, #${scopeId} .text-blue-500 { color: ${semanticColors.info} !important; }
    #${scopeId} .text-violet-400 { color: ${isLight ? '#7c3aed' : '#a78bfa'} !important; }
    /* Semantic backgrounds */
    #${scopeId} .bg-emerald-500\\/10, #${scopeId} .bg-emerald-500\\/15, #${scopeId} .bg-emerald-500\\/20 { background-color: ${semanticColors.successBg} !important; }
    #${scopeId} .bg-amber-500\\/10, #${scopeId} .bg-amber-500\\/15, #${scopeId} .bg-amber-500\\/20 { background-color: ${semanticColors.warningBg} !important; }
    #${scopeId} .bg-rose-500\\/10, #${scopeId} .bg-rose-500\\/15, #${scopeId} .bg-rose-500\\/20 { background-color: ${semanticColors.errorBg} !important; }
    #${scopeId} .bg-blue-500\\/10, #${scopeId} .bg-blue-500\\/15, #${scopeId} .bg-blue-500\\/20 { background-color: ${semanticColors.infoBg} !important; }
    #${scopeId} .bg-violet-500\\/15, #${scopeId} .bg-violet-500\\/20 { background-color: ${isLight ? 'rgba(124,58,237,0.1)' : 'rgba(167,139,250,0.15)'} !important; }
    /* Semantic borders */
    #${scopeId} .border-emerald-500\\/25, #${scopeId} .border-emerald-500\\/30 { border-color: ${semanticColors.successBorder} !important; }
    #${scopeId} .border-amber-500\\/25, #${scopeId} .border-amber-500\\/30 { border-color: ${semanticColors.warningBorder} !important; }
    #${scopeId} .border-rose-500\\/25, #${scopeId} .border-rose-500\\/30 { border-color: ${semanticColors.errorBorder} !important; }
    #${scopeId} .border-blue-500\\/25, #${scopeId} .border-blue-500\\/30 { border-color: ${semanticColors.infoBorder} !important; }
    /* Border utilities */
    #${scopeId} .border-border { border-color: ${bg(colors.border)}; }
    #${scopeId} .border-primary { border-color: ${bg(colors.primary)}; }
    #${scopeId} .border-input { border-color: ${bg(colors.input)}; }
    #${scopeId} .ring-ring { --tw-ring-color: ${bg(colors.ring)}; }
    /* Status indicator dots */
    #${scopeId} .bg-emerald-500 { background-color: ${semanticColors.success} !important; }
    #${scopeId} .bg-amber-500 { background-color: ${semanticColors.warning} !important; }
    #${scopeId} .bg-rose-500 { background-color: ${semanticColors.error} !important; }
  `;
}

// ============================================================================
// Props Documentation
// ============================================================================

interface PropDocItem {
  name: string;
  type: string;
  default?: string;
  description: string;
}

interface ComponentPropsDoc {
  [key: string]: PropDocItem[];
}

const COMPONENT_PROPS: ComponentPropsDoc = {
  buttons: [
    { name: 'variant', type: '"default" | "secondary" | "outline" | "ghost" | "destructive" | "link"', default: '"default"', description: 'Visual style variant' },
    { name: 'size', type: '"default" | "sm" | "lg" | "icon"', default: '"default"', description: 'Button size' },
    { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the button' },
    { name: 'asChild', type: 'boolean', default: 'false', description: 'Render as child component (for links)' },
  ],
  cards: [
    { name: 'className', type: 'string', description: 'Additional CSS classes' },
    { name: 'children', type: 'ReactNode', description: 'Card content' },
  ],
  badges: [
    { name: 'variant', type: '"default" | "secondary" | "outline" | "destructive"', default: '"default"', description: 'Visual style variant' },
    { name: 'className', type: 'string', description: 'Additional CSS classes for custom colors' },
  ],
  inputs: [
    { name: 'type', type: 'string', default: '"text"', description: 'Input type (text, email, password, etc.)' },
    { name: 'placeholder', type: 'string', description: 'Placeholder text' },
    { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the input' },
    { name: 'className', type: 'string', description: 'Additional CSS classes' },
  ],
  alerts: [
    { name: 'variant', type: '"default" | "destructive"', default: '"default"', description: 'Alert severity' },
    { name: 'className', type: 'string', description: 'Additional CSS classes for custom styling' },
  ],
  tables: [
    { name: 'className', type: 'string', description: 'Additional CSS classes' },
  ],
  dialogs: [
    { name: 'open', type: 'boolean', description: 'Controlled open state' },
    { name: 'onOpenChange', type: '(open: boolean) => void', description: 'Callback when open state changes' },
    { name: 'modal', type: 'boolean', default: 'true', description: 'Whether dialog is modal' },
  ],
  selects: [
    { name: 'value', type: 'string', description: 'Controlled value' },
    { name: 'onValueChange', type: '(value: string) => void', description: 'Callback when value changes' },
    { name: 'defaultValue', type: 'string', description: 'Default value for uncontrolled' },
    { name: 'disabled', type: 'boolean', default: 'false', description: 'Disables the select' },
  ],
  progress: [
    { name: 'value', type: 'number', description: 'Progress value (0-100)' },
    { name: 'max', type: 'number', default: '100', description: 'Maximum value' },
    { name: 'className', type: 'string', description: 'Additional CSS classes' },
  ],
  avatars: [
    { name: 'className', type: 'string', description: 'Additional CSS classes (use for sizing)' },
  ],
  tabs: [
    { name: 'value', type: 'string', description: 'Controlled active tab' },
    { name: 'onValueChange', type: '(value: string) => void', description: 'Callback when tab changes' },
    { name: 'defaultValue', type: 'string', description: 'Default active tab for uncontrolled' },
  ],
};

function PropsTable({ componentId }: { componentId: string }) {
  const props = COMPONENT_PROPS[componentId];
  if (!props || props.length === 0) return null;

  return (
    <div className="mt-6 border-t pt-4">
      <h4 className="text-sm font-medium mb-3 text-muted-foreground">Props</h4>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[140px]">Prop</TableHead>
            <TableHead className="w-[200px]">Type</TableHead>
            <TableHead className="w-[80px]">Default</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.map((prop) => (
            <TableRow key={prop.name} className="hover:bg-muted/30">
              <TableCell className="font-mono text-xs text-primary">{prop.name}</TableCell>
              <TableCell className="font-mono text-xs text-muted-foreground">{prop.type}</TableCell>
              <TableCell className="font-mono text-xs">{prop.default || '-'}</TableCell>
              <TableCell className="text-xs">{prop.description}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ============================================================================
// Component Demos
// ============================================================================

function ButtonDemo() {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Variants</h4>
        <div className="flex flex-wrap gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">Sizes</h4>
        <div className="flex items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><Plus className="h-4 w-4" /></Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">States</h4>
        <div className="flex flex-wrap gap-3">
          <Button disabled>Disabled</Button>
          <Button onClick={handleClick}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Click me'
            )}
          </Button>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">With Icons</h4>
        <div className="flex flex-wrap gap-3">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Item
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="secondary">
            Settings
            <Settings className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardDemo() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Default Card</CardTitle>
          <CardDescription>This is a standard card component.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cards are used to group related content and actions.
          </p>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="ghost">Cancel</Button>
          <Button>Save</Button>
        </CardFooter>
      </Card>

      <Card className="hover:border-primary/50 transition-colors cursor-pointer">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Interactive Card</CardTitle>
            <Badge>New</Badge>
          </div>
          <CardDescription>Hover to see the effect</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarFallback>JD</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">John Doe</p>
              <p className="text-xs text-muted-foreground">Developer</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-xl border-border/50 md:col-span-2">
        <CardHeader>
          <CardTitle>Glass Effect Card</CardTitle>
          <CardDescription>Premium card with backdrop blur effect</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold">$45,231</p>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
            </div>
            <div className="flex items-center gap-1 text-emerald-500">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">+12.5%</span>
            </div>
          </div>
          <Progress value={65} className="mt-4" />
        </CardContent>
      </Card>
    </div>
  );
}

function BadgeDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Default Variants</h4>
        <div className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">Status Badges (Jewel Tones)</h4>
        <div className="flex flex-wrap gap-2">
          <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 border">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
          <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/25 border">
            <AlertCircle className="h-3 w-3 mr-1" />
            Pending
          </Badge>
          <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/25 border">
            <X className="h-3 w-3 mr-1" />
            Failed
          </Badge>
          <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/25 border">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            In Progress
          </Badge>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">Pill Shape</h4>
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full">Pill Badge</Badge>
          <Badge className="rounded-full bg-primary/15 text-primary border-0">Feature</Badge>
          <Badge className="rounded-full bg-violet-500/15 text-violet-400 border-0">Premium</Badge>
        </div>
      </div>
    </div>
  );
}

function InputDemo() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="space-y-6 max-w-md">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@example.com" />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter password"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-0 top-0 h-full px-3"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="search">Search with Icon</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input id="search" placeholder="Search..." className="pl-9" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="error">Error State</Label>
        <Input id="error" placeholder="Invalid input" className="border-destructive" />
        <p className="text-xs text-destructive">This field is required</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="disabled">Disabled</Label>
        <Input id="disabled" placeholder="Disabled input" disabled />
      </div>

      <div className="space-y-2">
        <Label htmlFor="textarea">Textarea</Label>
        <Textarea id="textarea" placeholder="Write a message..." rows={3} />
      </div>
    </div>
  );
}

function AlertDemo() {
  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Default Alert</AlertTitle>
        <AlertDescription>
          This is a default informational alert message.
        </AlertDescription>
      </Alert>

      <Alert className="bg-emerald-500/10 border-emerald-500/30 text-emerald-200">
        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
        <AlertTitle className="text-emerald-100">Success!</AlertTitle>
        <AlertDescription>
          Your changes have been saved successfully.
        </AlertDescription>
      </Alert>

      <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-200">
        <AlertTriangle className="h-4 w-4 text-amber-400" />
        <AlertTitle className="text-amber-100">Warning</AlertTitle>
        <AlertDescription>
          This action cannot be undone. Please proceed with caution.
        </AlertDescription>
      </Alert>

      <Alert className="bg-rose-500/10 border-rose-500/30 text-rose-200">
        <AlertCircle className="h-4 w-4 text-rose-400" />
        <AlertTitle className="text-rose-100">Error</AlertTitle>
        <AlertDescription>
          Something went wrong. Please try again later.
        </AlertDescription>
      </Alert>
    </div>
  );
}

function TableDemo() {
  const data = [
    { id: 1, name: 'John Doe', email: 'john@example.com', status: 'active', role: 'Admin' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'pending', role: 'Editor' },
    { id: 3, name: 'Bob Wilson', email: 'bob@example.com', status: 'inactive', role: 'Viewer' },
  ];

  const statusStyles: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    pending: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    inactive: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  };

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((row) => (
          <TableRow key={row.id} className="hover:bg-accent/50 transition-colors cursor-pointer">
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-muted-foreground">{row.email}</TableCell>
            <TableCell>
              <Badge className={cn('border capitalize', statusStyles[row.status])}>
                {row.status}
              </Badge>
            </TableCell>
            <TableCell>{row.role}</TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function DialogDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">Open Dialog</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Profile</DialogTitle>
            <DialogDescription>
              Make changes to your profile here. Click save when you&apos;re done.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" defaultValue="John Doe" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" defaultValue="john@example.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Hover for Tooltip</Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>This is a helpful tooltip</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

function SelectDemo() {
  return (
    <div className="space-y-6 max-w-xs">
      <div className="space-y-2">
        <Label>Select Option</Label>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Choose an option" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="option1">Option One</SelectItem>
            <SelectItem value="option2">Option Two</SelectItem>
            <SelectItem value="option3">Option Three</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label>Toggle Options</Label>
        <div className="flex items-center justify-between">
          <Label htmlFor="notifications" className="font-normal">Enable notifications</Label>
          <Switch id="notifications" />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="marketing" className="font-normal">Marketing emails</Label>
          <Switch id="marketing" defaultChecked />
        </div>
      </div>

      <div className="space-y-3">
        <Label>Checkboxes</Label>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Checkbox id="terms" />
            <Label htmlFor="terms" className="font-normal">Accept terms and conditions</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="newsletter" defaultChecked />
            <Label htmlFor="newsletter" className="font-normal">Subscribe to newsletter</Label>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressDemo() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Default Progress</span>
          <span>65%</span>
        </div>
        <Progress value={65} />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Small Progress</span>
          <span>45%</span>
        </div>
        <Progress value={45} className="h-1" />
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-emerald-400">Success</span>
          <span>100%</span>
        </div>
        <Progress value={100} className="h-2" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-2xl font-bold">247</div>
          <div className="text-xs text-muted-foreground">Tasks Complete</div>
          <Progress value={82} className="mt-2 h-1" />
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">12</div>
          <div className="text-xs text-muted-foreground">In Progress</div>
          <Progress value={24} className="mt-2 h-1" />
        </Card>
        <Card className="p-4">
          <div className="text-2xl font-bold">5</div>
          <div className="text-xs text-muted-foreground">Pending</div>
          <Progress value={10} className="mt-2 h-1" />
        </Card>
      </div>
    </div>
  );
}

function AvatarDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Sizes</h4>
        <div className="flex items-center gap-4">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs">XS</AvatarFallback>
          </Avatar>
          <Avatar className="h-10 w-10">
            <AvatarFallback className="text-sm">SM</AvatarFallback>
          </Avatar>
          <Avatar className="h-12 w-12">
            <AvatarFallback>MD</AvatarFallback>
          </Avatar>
          <Avatar className="h-16 w-16">
            <AvatarFallback className="text-lg">LG</AvatarFallback>
          </Avatar>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">With Status</h4>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar>
              <AvatarFallback className="bg-primary/20 text-primary">JD</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div className="relative">
            <Avatar>
              <AvatarFallback className="bg-violet-500/20 text-violet-400">AB</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-amber-500 border-2 border-background" />
          </div>
          <div className="relative">
            <Avatar>
              <AvatarFallback className="bg-emerald-500/20 text-emerald-400">CD</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-slate-500 border-2 border-background" />
          </div>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-3">Avatar Group</h4>
        <div className="flex -space-x-3">
          <Avatar className="border-2 border-background">
            <AvatarFallback className="bg-primary/20 text-primary">A</AvatarFallback>
          </Avatar>
          <Avatar className="border-2 border-background">
            <AvatarFallback className="bg-violet-500/20 text-violet-400">B</AvatarFallback>
          </Avatar>
          <Avatar className="border-2 border-background">
            <AvatarFallback className="bg-emerald-500/20 text-emerald-400">C</AvatarFallback>
          </Avatar>
          <Avatar className="border-2 border-background">
            <AvatarFallback className="bg-amber-500/20 text-amber-400">D</AvatarFallback>
          </Avatar>
          <div className="h-10 w-10 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
            +5
          </div>
        </div>
      </div>
    </div>
  );
}

function TabsDemo() {
  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium mb-3">Default Tabs</h4>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  This is the overview tab content. It shows general information.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="analytics" className="mt-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">
                  Analytics and metrics would be displayed here.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ============================================================================
// Sample Page Demo
// ============================================================================

function SamplePageDemo() {
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">Welcome back, John! Here&apos;s your overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Total Revenue', value: '$45,231', change: '+12.5%', up: true },
          { label: 'Active Users', value: '2,451', change: '+8.2%', up: true },
          { label: 'Conversion Rate', value: '3.24%', change: '-2.1%', up: false },
          { label: 'Avg. Order Value', value: '$124.50', change: '+4.3%', up: true },
        ].map((stat, i) => (
          <Card key={i} className="hover:border-primary/30 transition-colors">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold">{stat.value}</span>
                <span className={cn(
                  'text-xs font-medium flex items-center gap-0.5',
                  stat.up ? 'text-emerald-500' : 'text-rose-500'
                )}>
                  {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {stat.change}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { user: 'JD', name: 'John Doe', action: 'Created new project', time: '2m ago' },
              { user: 'AS', name: 'Alice Smith', action: 'Updated settings', time: '15m ago' },
              { user: 'BW', name: 'Bob Wilson', action: 'Completed task', time: '1h ago' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {item.user}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.action}</p>
                </div>
                <span className="text-xs text-muted-foreground">{item.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Create New Project
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </Button>
            <Button className="w-full justify-start" variant="outline">
              <Settings className="h-4 w-4 mr-2" />
              Configure Settings
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Form Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact Form Example</CardTitle>
          <CardDescription>A sample form with various input types</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="demo-name">Name</Label>
              <Input id="demo-name" placeholder="Enter your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="demo-email">Email</Label>
              <Input id="demo-email" type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="demo-subject">Subject</Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General Inquiry</SelectItem>
                  <SelectItem value="support">Technical Support</SelectItem>
                  <SelectItem value="sales">Sales Question</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="demo-message">Message</Label>
              <Textarea id="demo-message" placeholder="Your message..." rows={4} />
            </div>
            <div className="md:col-span-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="demo-terms" />
                <Label htmlFor="demo-terms" className="font-normal text-sm">
                  I agree to the terms and conditions
                </Label>
              </div>
              <Button type="button">
                Send Message
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// Main Component Preview
// ============================================================================

const COMPONENT_SECTIONS = [
  { id: 'buttons', name: 'Buttons', component: ButtonDemo },
  { id: 'cards', name: 'Cards', component: CardDemo },
  { id: 'badges', name: 'Badges', component: BadgeDemo },
  { id: 'inputs', name: 'Inputs', component: InputDemo },
  { id: 'alerts', name: 'Alerts', component: AlertDemo },
  { id: 'tables', name: 'Tables', component: TableDemo },
  { id: 'dialogs', name: 'Dialogs & Tooltips', component: DialogDemo },
  { id: 'selects', name: 'Selects & Toggles', component: SelectDemo },
  { id: 'progress', name: 'Progress', component: ProgressDemo },
  { id: 'avatars', name: 'Avatars', component: AvatarDemo },
  { id: 'tabs', name: 'Tabs', component: TabsDemo },
  { id: 'sample-page', name: 'Sample Page', component: SamplePageDemo },
];

export function ComponentPreview({ designSystem }: ComponentPreviewProps) {
  const [activeSection, setActiveSection] = useState('buttons');
  const [themeInverted, setThemeInverted] = useState(false);
  const scopeId = useId().replace(/:/g, '');

  const ActiveComponent = COMPONENT_SECTIONS.find(s => s.id === activeSection)?.component || ButtonDemo;

  // Memoize normalized colors - only recompute when design system changes
  const normalizedColors = useMemo(
    () => normalizeColors(designSystem.tokens.colors),
    [designSystem.tokens.colors]
  );

  // Memoize theme detection
  const isNativeLightTheme = useMemo(() => {
    const bgColor = normalizedColors.background || '#ffffff';
    return bgColor.startsWith('#fff') ||
      bgColor === '#ffffff' ||
      bgColor.includes('100%') ||
      bgColor.startsWith('#f');  // Light grays like #f5f5f5
  }, [normalizedColors.background]);

  // Current display mode (considering the toggle) - reactive to themeInverted
  const isDisplayingLight = themeInverted ? !isNativeLightTheme : isNativeLightTheme;

  // Memoize scoped CSS - regenerates when design system or theme changes
  const scopedCss = useMemo(
    () => generateScopedCss(`preview-${scopeId}`, designSystem.tokens, themeInverted),
    [scopeId, designSystem.tokens, themeInverted]
  );

  // Memoize display colors - reactive to theme toggle
  const displayColors = useMemo(
    () => themeInverted
      ? generateInvertedColors(designSystem.tokens.colors)
      : normalizedColors,
    [themeInverted, designSystem.tokens.colors, normalizedColors]
  );

  return (
    <div className="flex gap-4 h-[600px]">
      {/* Inject scoped CSS - key forces re-render on theme change */}
      <style
        key={`${scopeId}-${themeInverted}`}
        dangerouslySetInnerHTML={{ __html: scopedCss }}
      />

      {/* Sidebar Navigation */}
      <ScrollArea className="w-48 shrink-0">
        <div className="space-y-1 pr-2">
          <div className="px-3 py-2 mb-2 border-b border-border">
            <p className="text-xs font-medium text-muted-foreground">Preview Theme</p>
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-4 h-4 rounded-full border"
                style={{ backgroundColor: normalizedColors.primary }}
                title="Primary color"
              />
              <p className="text-sm font-semibold truncate" title={designSystem.name}>
                {designSystem.name}
              </p>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              {isDisplayingLight ? (
                <Sun className="h-3 w-3 text-amber-500" />
              ) : (
                <Moon className="h-3 w-3 text-blue-400" />
              )}
              <span className="text-xs text-muted-foreground">
                {isDisplayingLight ? 'Light' : 'Dark'} mode
                {themeInverted && ' (inverted)'}
              </span>
            </div>
          </div>
          {COMPONENT_SECTIONS.map((section) => (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                activeSection === section.id
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {section.name}
            </button>
          ))}
        </div>
      </ScrollArea>

      {/* Preview Area - Wrapped with Scoped Design System Styles */}
      <div
        id={`preview-${scopeId}`}
        className={cn(
          "flex-1 border rounded-lg overflow-hidden",
          isDisplayingLight && "light"
        )}
      >
        <div
          className="border-b px-4 py-2 flex items-center justify-between"
          style={{
            backgroundColor: displayColors.muted,
            borderColor: displayColors.border,
          }}
        >
          <h3
            className="font-medium text-sm"
            style={{ color: displayColors.foreground }}
          >
            {COMPONENT_SECTIONS.find(s => s.id === activeSection)?.name}
          </h3>
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setThemeInverted(!themeInverted)}
                    style={{
                      color: displayColors.foreground,
                    }}
                  >
                    {isDisplayingLight ? (
                      <Moon className="h-4 w-4" />
                    ) : (
                      <Sun className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Switch to {isDisplayingLight ? 'dark' : 'light'} mode</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span
              className="text-xs px-2 py-0.5 rounded flex items-center gap-1"
              style={{
                backgroundColor: displayColors.primary,
                color: displayColors.primaryForeground,
              }}
            >
              {isDisplayingLight ? <Sun className="h-3 w-3" /> : <Moon className="h-3 w-3" />}
              {designSystem.name}
            </span>
          </div>
        </div>
        <ScrollArea className="h-[calc(100%-41px)]">
          <div
            className="p-6"
            style={{
              backgroundColor: displayColors.background,
              color: displayColors.foreground,
            }}
          >
            <ActiveComponent />
            {activeSection !== 'sample-page' && <PropsTable componentId={activeSection} />}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

export default ComponentPreview;
