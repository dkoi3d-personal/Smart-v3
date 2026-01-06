/**
 * Plan API Endpoint
 * Creates a project plan from requirements or Figma design
 */

import { NextRequest, NextResponse } from 'next/server';
import { claudeCodeService, Task } from '@/services/claude-code-service';
import * as fs from 'fs/promises';
import path from 'path';
import { ensureProjectDir } from '@/lib/project-paths';
import { projects, saveProjects } from '../../projects/route';
import { scaffoldPrisma, inferModelsFromRequirements, getPrismaInstructions } from '@/lib/scaffolds/prisma-sqlite';
import { createDesignSystem, setProjectDesignSystem } from '@/lib/design-systems/design-system-store';
import { detectFeatureTemplates, applyTemplates, mergeRequirements, getTemplateSummary, getBootstrapTemplate, isHealthcareRelated } from '@/lib/scaffolds/features';

interface StyleToken {
  colors: Record<string, string>;
  typography: {
    fonts: string[];
    sizes: Record<string, { size: string; lineHeight: string; weight: number }>;
  };
  spacing: string[];
  borderRadius: string[];
  shadows: string[];
  borders: string[];
}

interface ScreenAnalysis {
  id: string;
  name: string;
  route: string;
  isAuth: boolean;
  hasTable: boolean;
  hasList: boolean;
  hasForm: boolean;
  buttons: string[];
  inputFields: string[];
  textContent: string[];
  inferredActions: string[];
  imageUrl?: string;
  dimensions?: { width: number; height: number };
}

interface FigmaDesignContext {
  name: string;
  description: string;
  layout: {
    type: string;
    structure: string[];
    responsive: boolean;
  };
  colors: Record<string, string | undefined>;
  typography: {
    headingFont?: string;
    bodyFont?: string;
    sizes: string[];
  };
  components: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  // Enhanced workflow data
  screens?: ScreenAnalysis[];
  authFlow?: string[];
  mainWorkflow?: string[];
  sharedNavigation?: string[];
  dataModel?: Record<string, { name: string; fields: string[]; relationships?: string[] }>;
  styleTokens?: StyleToken;
  frameImages?: Record<string, string>;
  requirements: string;
  sourceUrl?: string;
  figmaFileId?: string;
  figmaNodeId?: string;
}

/**
 * Create a design system from Figma context
 * Maps Figma colors to our design token structure
 */
async function createDesignSystemFromFigma(
  figmaContext: FigmaDesignContext,
  projectId: string,
  projectName: string
): Promise<string> {
  // Map Figma colors to design tokens
  // Figma extracts: primary, secondary, background, text, accent, surface, etc.
  const colors = figmaContext.colors || {};

  const designSystemInput = {
    name: `${projectName} (Figma)`,
    description: `Auto-generated from Figma design: ${figmaContext.name || 'Imported Design'}`,
    version: '1.0.0',
    tokens: {
      colors: {
        // Core colors from Figma
        background: colors.background || '#0F0F12',
        foreground: colors.text || colors.foreground || '#ECECEF',
        card: colors.surface || colors.card || colors.background || '#1A1A1F',
        cardForeground: colors.text || colors.foreground || '#ECECEF',
        popover: colors.surface || colors.background || '#1A1A1F',
        popoverForeground: colors.text || colors.foreground || '#ECECEF',
        primary: colors.primary || '#7C5CFF',
        primaryForeground: colors.primaryForeground || '#FFFFFF',
        secondary: colors.secondary || colors.surface || '#2E2E36',
        secondaryForeground: colors.secondaryForeground || colors.text || '#ECECEF',
        muted: colors.muted || colors.secondary || '#2E2E36',
        mutedForeground: colors.mutedForeground || '#A1A1AA',
        accent: colors.accent || colors.primary || '#7C5CFF',
        accentForeground: colors.accentForeground || '#FFFFFF',
        destructive: colors.destructive || colors.error || '#EF4444',
        destructiveForeground: '#FFFFFF',
        border: colors.border || colors.secondary || '#2E2E36',
        input: colors.input || colors.border || '#2E2E36',
        ring: colors.ring || colors.primary || '#7C5CFF',
        // Status colors
        success: colors.success || '#22C55E',
        warning: colors.warning || '#F59E0B',
        error: colors.error || colors.destructive || '#EF4444',
        info: colors.info || '#3B82F6',
      },
      typography: {
        fontFamily: {
          sans: figmaContext.typography?.bodyFont || 'Inter, system-ui, sans-serif',
          mono: 'JetBrains Mono, monospace',
          display: figmaContext.typography?.headingFont || figmaContext.typography?.bodyFont || 'Inter, system-ui, sans-serif',
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
        },
        fontWeight: {
          normal: 400,
          medium: 500,
          semibold: 600,
          bold: 700,
        },
      },
      spacing: {
        unit: 4,
        scale: [0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64],
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
        sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        md: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        lg: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
      },
      transitions: {
        duration: {
          fast: '150ms',
          normal: '200ms',
          slow: '300ms',
        },
        easing: {
          default: 'cubic-bezier(0.4, 0, 0.2, 1)',
          linear: 'linear',
          in: 'cubic-bezier(0.4, 0, 1, 1)',
          out: 'cubic-bezier(0, 0, 0.2, 1)',
          inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
        },
      },
    },
    guidelines: `
## Figma Design Guidelines

This design system was auto-generated from a Figma design.

### Color Usage
- Use the exact colors from the design tokens
- Primary color: ${colors.primary || 'Not specified'}
- Background: ${colors.background || 'Not specified'}
- Text: ${colors.text || 'Not specified'}

### Typography
- Heading font: ${figmaContext.typography?.headingFont || 'Inter'}
- Body font: ${figmaContext.typography?.bodyFont || 'Inter'}

### Important
- Match the Figma design as closely as possible
- Use the extracted colors exactly - do not substitute with defaults
- Maintain the visual hierarchy from the original design
`,
    examples: [],
  };

  // Create the design system
  const createdSystem = await createDesignSystem(designSystemInput);

  // Set it as the project's design system
  await setProjectDesignSystem(projectId, createdSystem.id);

  console.log(`[Plan] Created Figma design system: ${createdSystem.id} for project ${projectId}`);

  return createdSystem.id;
}

/**
 * Download and save frame images from Figma
 */
async function downloadFrameImages(
  frameImages: Record<string, string>,
  screens: ScreenAnalysis[],
  projectDir: string
): Promise<Record<string, string>> {
  const savedPaths: Record<string, string> = {};
  const figmaFramesDir = path.join(projectDir, 'figma-frames');

  // Create figma-frames directory
  await fs.mkdir(figmaFramesDir, { recursive: true });

  console.log(`[Plan] Downloading ${Object.keys(frameImages).length} frame images...`);

  // Sanitize filename: remove special chars, replace spaces with dashes, clean up
  const sanitizeFileName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[\/\\:*?"<>|]/g, '') // Remove invalid filename chars
      .replace(/\s+/g, '-')           // Replace spaces with dashes
      .replace(/-+/g, '-')            // Collapse multiple dashes
      .replace(/^-|-$/g, '')          // Remove leading/trailing dashes
      || 'untitled';                  // Fallback if empty
  };

  for (const [frameId, imageUrl] of Object.entries(frameImages)) {
    if (!imageUrl) continue;

    try {
      // Find screen name for this frame
      const screen = screens.find(s => s.id === frameId);
      const baseName = screen ? sanitizeFileName(screen.name) : `frame-${frameId.replace(':', '-')}`;
      const fileName = `${baseName}.png`;

      const filePath = path.join(figmaFramesDir, fileName);

      // Download image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(`[Plan] Failed to download image for ${frameId}: ${response.status}`);
        continue;
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(filePath, buffer);

      savedPaths[frameId] = `figma-frames/${fileName}`;
      console.log(`[Plan] Saved: ${fileName}`);
    } catch (error) {
      console.error(`[Plan] Error downloading image for ${frameId}:`, error);
    }
  }

  console.log(`[Plan] Downloaded ${Object.keys(savedPaths).length} images`);
  return savedPaths;
}

/**
 * Token diff status for design tokens
 */
interface TokenDiffStatus {
  status: 'existing' | 'partial' | 'new';
  existingTokens: {
    colors: string[];
    fonts: string[];
    spacing: string[];
    borderRadius: string[];
    shadows: string[];
  };
  newTokens: {
    colors: string[];
    fonts: string[];
    spacing: string[];
    borderRadius: string[];
    shadows: string[];
  };
  summary: string;
}

/**
 * Compare new tokens with existing tokens to determine what's already implemented
 */
function compareDesignTokens(
  newTokens: StyleToken,
  existingTokens: Record<string, unknown> | null
): TokenDiffStatus {
  const result: TokenDiffStatus = {
    status: 'new',
    existingTokens: { colors: [], fonts: [], spacing: [], borderRadius: [], shadows: [] },
    newTokens: { colors: [], fonts: [], spacing: [], borderRadius: [], shadows: [] },
    summary: '',
  };

  if (!existingTokens) {
    // All tokens are new
    result.newTokens.colors = Object.keys(newTokens.colors);
    result.newTokens.fonts = newTokens.typography.fonts;
    result.newTokens.spacing = newTokens.spacing;
    result.newTokens.borderRadius = newTokens.borderRadius;
    result.newTokens.shadows = newTokens.shadows;
    result.summary = 'All tokens are new - no existing design tokens found';
    return result;
  }

  // Compare colors
  const existingColors = existingTokens.colors as Record<string, string> | undefined || {};
  for (const [key, value] of Object.entries(newTokens.colors)) {
    if (existingColors[key] === value) {
      result.existingTokens.colors.push(key);
    } else {
      result.newTokens.colors.push(key);
    }
  }

  // Compare fonts
  const existingTypography = existingTokens.typography as { fonts?: string[] } | undefined;
  const existingFonts = existingTypography?.fonts || [];
  for (const font of newTokens.typography.fonts) {
    if (existingFonts.includes(font)) {
      result.existingTokens.fonts.push(font);
    } else {
      result.newTokens.fonts.push(font);
    }
  }

  // Compare spacing
  const existingSpacing = (existingTokens.spacing as string[]) || [];
  for (const space of newTokens.spacing) {
    if (existingSpacing.includes(space)) {
      result.existingTokens.spacing.push(space);
    } else {
      result.newTokens.spacing.push(space);
    }
  }

  // Compare border radius
  const existingRadius = (existingTokens.borderRadius as string[]) || [];
  for (const radius of newTokens.borderRadius) {
    if (existingRadius.includes(radius)) {
      result.existingTokens.borderRadius.push(radius);
    } else {
      result.newTokens.borderRadius.push(radius);
    }
  }

  // Compare shadows
  const existingShadows = (existingTokens.shadows as string[]) || [];
  for (const shadow of newTokens.shadows) {
    if (existingShadows.includes(shadow)) {
      result.existingTokens.shadows.push(shadow);
    } else {
      result.newTokens.shadows.push(shadow);
    }
  }

  // Determine overall status
  const totalExisting = result.existingTokens.colors.length +
    result.existingTokens.fonts.length +
    result.existingTokens.spacing.length +
    result.existingTokens.borderRadius.length +
    result.existingTokens.shadows.length;

  const totalNew = result.newTokens.colors.length +
    result.newTokens.fonts.length +
    result.newTokens.spacing.length +
    result.newTokens.borderRadius.length +
    result.newTokens.shadows.length;

  if (totalNew === 0) {
    result.status = 'existing';
    result.summary = `All ${totalExisting} tokens already exist - design tokens are fully implemented`;
  } else if (totalExisting === 0) {
    result.status = 'new';
    result.summary = `All ${totalNew} tokens are new - need full design token setup`;
  } else {
    result.status = 'partial';
    result.summary = `${totalExisting} tokens already implemented, ${totalNew} new tokens to add`;
  }

  return result;
}

/**
 * Save style tokens as design-tokens.json
 * Returns diff status if existing tokens were found
 */
async function saveStyleTokens(styleTokens: StyleToken, projectDir: string): Promise<TokenDiffStatus> {
  const tokensPath = path.join(projectDir, 'design-tokens.json');

  // Check for existing tokens
  let existingTokens: Record<string, unknown> | null = null;
  try {
    const existingData = await fs.readFile(tokensPath, 'utf-8');
    existingTokens = JSON.parse(existingData);
    console.log(`[Plan] Found existing design-tokens.json`);
  } catch {
    // No existing tokens
  }

  // Compare tokens
  const diffStatus = compareDesignTokens(styleTokens, existingTokens);
  console.log(`[Plan] Token diff: ${diffStatus.summary}`);

  // Convert to CSS-friendly format
  const cssTokens = {
    colors: styleTokens.colors,
    typography: {
      fonts: styleTokens.typography.fonts,
      sizes: styleTokens.typography.sizes,
    },
    spacing: styleTokens.spacing,
    borderRadius: styleTokens.borderRadius,
    shadows: styleTokens.shadows,
    borders: styleTokens.borders,
    // Generate Tailwind-compatible config
    tailwindExtend: {
      colors: Object.fromEntries(
        Object.entries(styleTokens.colors).map(([key, value]) => [
          key.replace(/-/g, ''),
          value
        ])
      ),
      fontFamily: {
        sans: styleTokens.typography.fonts[0] || 'Inter',
      },
      borderRadius: Object.fromEntries(
        styleTokens.borderRadius.map((r, i) => [`custom-${i}`, r])
      ),
      boxShadow: Object.fromEntries(
        styleTokens.shadows.map((s, i) => [`custom-${i}`, s])
      ),
    },
    // Add diff status metadata
    _tokenStatus: diffStatus,
  };

  await fs.writeFile(tokensPath, JSON.stringify(cssTokens, null, 2));
  console.log(`[Plan] Saved design tokens to ${tokensPath}`);

  return diffStatus;
}

/**
 * Extract design context from Figma URL
 */
interface FigmaExtractionError {
  error: string;
  details?: string;
  suggestions?: string[];
  accountEmail?: string;
  fileId?: string;
}

async function extractFigmaDesign(figmaUrl: string, baseUrl: string): Promise<FigmaDesignContext> {
  const response = await fetch(`${baseUrl}/api/figma/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ figmaUrl }),
  });

  const data = await response.json();

  if (!response.ok) {
    // Create a detailed error message for 403 errors
    if (response.status === 403 && data.suggestions) {
      const errorData = data as FigmaExtractionError;
      const message = [
        errorData.error,
        errorData.details,
        '',
        'Suggestions:',
        ...(errorData.suggestions || []).map((s: string) => `• ${s}`),
      ].filter(Boolean).join('\n');
      throw new Error(message);
    }
    throw new Error(data.error || 'Failed to extract Figma design');
  }

  return data.designContext;
}

/**
 * Generate enhanced requirements from Figma design context
 * Now uses the rich requirements from the extraction API
 */
function generateRequirementsFromFigma(designContext: FigmaDesignContext, projectName: string): string {
  // If we have the enhanced requirements from extraction, use them directly
  if (designContext.requirements && designContext.screens && designContext.screens.length > 0) {
    const parts: string[] = [];

    parts.push(`# ${projectName}`);
    parts.push('');
    parts.push(`## Design Source`);
    parts.push(`This application is based on a Figma design: ${designContext.sourceUrl || 'Figma design'}`);
    parts.push('');
    parts.push('## IMPORTANT: Pixel-Perfect Implementation');
    parts.push('**Reference images are saved in the `figma-frames/` directory.**');
    parts.push('**Design tokens are saved in `design-tokens.json`.**');
    parts.push('You MUST match the Figma design exactly using these references.');
    parts.push('');

    // Use the comprehensive requirements from extraction
    parts.push(designContext.requirements);

    return parts.join('\n');
  }

  // Fallback for legacy extraction without enhanced data
  const parts: string[] = [];

  parts.push(`# ${projectName}`);
  parts.push('');
  parts.push(`## Design Source`);
  parts.push(`This application is based on a Figma design: ${designContext.sourceUrl || 'Figma design'}`);
  parts.push('');

  if (designContext.description) {
    parts.push(`## Overview`);
    parts.push(designContext.description);
    parts.push('');
  }

  parts.push(`## Layout Structure`);
  parts.push(`- Layout Type: ${designContext.layout.type}`);
  parts.push(`- Sections: ${designContext.layout.structure.join(', ')}`);
  parts.push(`- Responsive: ${designContext.layout.responsive ? 'Yes' : 'No'}`);
  parts.push('');

  if (Object.keys(designContext.colors).length > 0) {
    parts.push(`## Design Tokens`);
    parts.push('### Colors');
    for (const [name, value] of Object.entries(designContext.colors)) {
      if (value) {
        parts.push(`- ${name}: ${value}`);
      }
    }
    parts.push('');
  }

  if (designContext.typography) {
    parts.push('### Typography');
    if (designContext.typography.headingFont) {
      parts.push(`- Heading Font: ${designContext.typography.headingFont}`);
    }
    if (designContext.typography.bodyFont) {
      parts.push(`- Body Font: ${designContext.typography.bodyFont}`);
    }
    if (designContext.typography.sizes.length > 0) {
      parts.push(`- Sizes: ${designContext.typography.sizes.join(', ')}`);
    }
    parts.push('');
  }

  if (designContext.components.length > 0) {
    parts.push(`## Components`);
    for (const component of designContext.components) {
      parts.push(`### ${component.name}`);
      parts.push(`- Type: ${component.type}`);
      parts.push(`- Description: ${component.description}`);
      parts.push('');
    }
  }

  parts.push(`## Functional Requirements`);
  parts.push(designContext.requirements);
  parts.push('');

  parts.push(`## Technical Requirements`);
  parts.push('- Build with Next.js and TypeScript');
  parts.push('- Use Tailwind CSS for styling');
  parts.push('- Match the Figma design pixel-perfectly');
  parts.push('- Ensure responsive behavior as specified');
  parts.push('- Use the exact colors and typography from the design tokens');
  parts.push('');

  return parts.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { requirements: textRequirements, projectName, source, figmaUrl, figmaContext: userFigmaContext, complianceMode: requestedComplianceMode, useTemplates = true } = body;

    // Validate project name
    if (!projectName?.trim()) {
      return NextResponse.json(
        { error: 'Project name is required' },
        { status: 400 }
      );
    }

    // Determine requirements based on source
    let requirements: string;
    let figmaContext: FigmaDesignContext | null = null;

    if (source === 'figma' && figmaUrl) {
      // Extract design from Figma
      console.log(`[Plan] Extracting design from Figma: ${figmaUrl}`);

      try {
        // Get the base URL for internal API calls
        const protocol = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;

        figmaContext = await extractFigmaDesign(figmaUrl, baseUrl);
        requirements = generateRequirementsFromFigma(figmaContext, projectName.trim());

        // Append user-provided context/guidance to the Figma requirements
        if (userFigmaContext?.trim()) {
          requirements += `\n\n## Additional Context & Guidance\n\n${userFigmaContext.trim()}`;
          console.log(`[Plan] Added user context (${userFigmaContext.length} chars) to Figma requirements`);
        }

        console.log(`[Plan] Generated requirements from Figma design`);
      } catch (figmaError) {
        console.error('[Plan] Figma extraction error:', figmaError);
        return NextResponse.json(
          {
            error: 'Failed to extract Figma design',
            details: figmaError instanceof Error ? figmaError.message : 'Unknown error'
          },
          { status: 400 }
        );
      }
    } else if (textRequirements?.trim()) {
      requirements = textRequirements.trim();
    } else {
      return NextResponse.json(
        { error: 'Requirements or Figma URL is required' },
        { status: 400 }
      );
    }

    // Create project ID and directory OUTSIDE of ai-dev-platform-v2
    const projectId = `proj-${Date.now()}`;
    const projectDir = await ensureProjectDir(projectId);
    console.log(`[Plan] Project directory: ${projectDir}`);

    // Scaffold Prisma + SQLite database (super fast, zero config)
    const models = inferModelsFromRequirements(requirements);
    await scaffoldPrisma(projectDir, models);
    console.log(`[Plan] Scaffolded Prisma + SQLite with ${models.length} models: ${models.map(m => m.name).join(', ')}`);

    // Determine compliance mode: use explicit request, auto-detect from requirements, or default to 'generic'
    const complianceMode = requestedComplianceMode || (isHealthcareRelated(requirements) ? 'hipaa' : 'generic');
    console.log(`[Plan] Compliance mode: ${complianceMode}`);

    // Determine build source
    const buildSource = source === 'figma' ? 'figma' : 'text';
    console.log(`[Plan] Build source: ${buildSource}`);

    // Get the appropriate bootstrap template
    // For Figma builds: infrastructure only (no UI components - those come from Figma)
    let appliedTemplates: string[] = [];
    let templateIds: string[] = [];
    let mergedRequirements = requirements;
    let templatesIncluded: string[] = [];

    // Only apply templates if enabled
    if (useTemplates) {
      // Get the appropriate bootstrap template
      const bootstrapTemplate = getBootstrapTemplate({ source: buildSource, complianceMode });
      console.log(`[Plan] Using bootstrap template: ${bootstrapTemplate.id}`);

      // For Figma builds: ONLY apply bootstrap template (no feature templates - UI comes from Figma)
      // For text builds: detect and apply feature templates too
      if (buildSource === 'figma') {
        // Figma builds only get infrastructure - no UI component templates
        templateIds = [bootstrapTemplate.id];
        console.log(`[Plan] Figma build - skipping feature templates (UI from Figma design)`);
      } else {
        // Text builds get bootstrap + auto-detected feature templates
        const templateMatches = detectFeatureTemplates(requirements);
        const detectedTemplateIds = templateMatches.map(m => m.templateId);

        // Bootstrap template goes first, then detected templates (excluding bootstrap templates to avoid duplicates)
        templateIds = [
          bootstrapTemplate.id,
          ...detectedTemplateIds.filter(id => !id.startsWith('bootstrap-'))
        ];
      }

      if (templateIds.length > 0) {
        console.log(`[Plan] Applying templates: ${templateIds.join(', ')}`);
        const results = await applyTemplates(projectDir, templateIds);
        appliedTemplates = results.filter(r => r.success).map(r => r.templateName);

        const totalFiles = results.reduce((sum, r) => sum + r.filesCreated.length, 0);
        const totalTests = results.reduce((sum, r) => sum + r.testsCreated.length, 0);
        console.log(`[Plan] Applied ${appliedTemplates.length} templates: ${getTemplateSummary(templateIds)}`);
        console.log(`[Plan] Created ${totalFiles} files and ${totalTests} test files`);
      }

      // Merge template requirements with user requirements
      const mergeResult = mergeRequirements(requirements, templateIds);
      mergedRequirements = mergeResult.mergedRequirements;
      templatesIncluded = mergeResult.templatesIncluded;
    } else {
      console.log(`[Plan] Templates disabled - building from scratch`);
    }

    // Register project in the projects registry
    projects.set(projectId, {
      projectId,
      requirements,
      buildType: 'complex', // Planning route is for complex multi-agent builds
      config: {
        name: projectName.trim(),
        description: requirements.substring(0, 100),
        techStack: ['next.js', 'typescript', 'tailwind'],
        requirements,
        targetPlatform: 'web' as const,
        deployment: {
          provider: 'aws' as const,
          region: 'us-east-1',
          environment: 'dev' as const,
        },
      },
      status: 'planning',
      progress: 0,
      projectDirectory: projectDir,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...(figmaContext && { figmaContext, source: 'figma', figmaUrl }),
      ...(appliedTemplates.length > 0 && { appliedTemplates }),
      complianceMode, // 'generic' or 'hipaa'
      useTemplates, // Whether templates were applied
    });
    await saveProjects();
    console.log(`[Plan] Registered project ${projectId} in projects registry`);

    // Save project metadata
    const projectMetadata: Record<string, unknown> = {
      projectId,
      name: projectName.trim(),
      requirements,
      buildType: 'complex',
      status: 'planning',
      source: source || 'text',
      complianceMode, // 'generic' or 'hipaa'
      useTemplates, // Whether templates were applied
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add Figma context if present
    if (figmaContext) {
      projectMetadata.figmaUrl = figmaUrl;
      projectMetadata.figmaContext = figmaContext;
    }

    // Add applied templates if any
    if (appliedTemplates.length > 0) {
      projectMetadata.appliedTemplates = appliedTemplates;
    }

    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectMetadata, null, 2)
    );

    // Save Figma design context separately for agent reference
    if (figmaContext) {
      // Download frame images if available
      let savedImagePaths: Record<string, string> = {};
      if (figmaContext.frameImages && figmaContext.screens) {
        savedImagePaths = await downloadFrameImages(
          figmaContext.frameImages,
          figmaContext.screens,
          projectDir
        );
        console.log(`[Plan] Downloaded ${Object.keys(savedImagePaths).length} frame images`);
      }

      // Save style tokens if available and capture diff status
      let tokenDiffStatus: TokenDiffStatus | null = null;
      if (figmaContext.styleTokens) {
        tokenDiffStatus = await saveStyleTokens(figmaContext.styleTokens, projectDir);
      }

      // Update context with local image paths and token status
      const contextWithLocalPaths = {
        ...figmaContext,
        localImagePaths: savedImagePaths,
        // Add token status so agents know which tokens are existing vs new
        tokenStatus: tokenDiffStatus ? {
          status: tokenDiffStatus.status,
          summary: tokenDiffStatus.summary,
          existingTokens: tokenDiffStatus.existingTokens,
          newTokens: tokenDiffStatus.newTokens,
        } : null,
      };

      await fs.writeFile(
        path.join(projectDir, 'figma-context.json'),
        JSON.stringify(contextWithLocalPaths, null, 2)
      );
      console.log(`[Plan] Saved Figma context to ${projectDir}/figma-context.json`);

      // Create and set Figma design system for this project
      await createDesignSystemFromFigma(figmaContext, projectId, projectName.trim());
    }

    // Run planning phase
    const tasks: Task[] = [];
    let planContent = '';

    // Set up event listeners
    claudeCodeService.on('task:created', (task: Task) => {
      tasks.push(task);
    });

    // Build enhanced requirements with Prisma context
    const prismaContext = models.length > 0 ? `
${getPrismaInstructions()}

### Pre-scaffolded Models
The following Prisma models have been pre-created in \`prisma/schema.prisma\`:
${models.map(m => `- ${m.name}: ${m.fields.map(f => f.name).join(', ')}`).join('\n')}

Run \`npx prisma generate && npx prisma db push\` after any schema changes.
` : '';

    // Build template context for the planner
    const templateContext = templatesIncluded.length > 0 ? `
### Pre-Applied Feature Templates
The following features have been pre-scaffolded with working code and tests:
${templatesIncluded.map(t => `- ${t}`).join('\n')}

These features are ready to use. The planner should focus on:
1. Additional features NOT covered by templates
2. Customization of template features for this specific project
3. Integration between template features and new features
` : '';

    const enhancedRequirements = `Project Name: ${projectName}

${mergedRequirements}
${prismaContext}
${templateContext}`;

    // Run the planner
    for await (const event of claudeCodeService.runStream({
      projectId,
      requirements: enhancedRequirements,
      workingDirectory: projectDir,
      mode: 'plan',
    })) {
      if (event.type === 'text') {
        planContent += event.content;
      }
    }

    // Remove listener
    claudeCodeService.removeAllListeners('task:created');

    // Save plan to project directory
    await fs.writeFile(
      path.join(projectDir, 'plan.md'),
      planContent
    );

    await fs.writeFile(
      path.join(projectDir, 'tasks.json'),
      JSON.stringify(tasks, null, 2)
    );

    // Update project status
    const projectMeta = JSON.parse(
      await fs.readFile(path.join(projectDir, 'project.json'), 'utf-8')
    );
    projectMeta.status = 'idle';  // Ready to build - 'planning' only during active planning
    projectMeta.updatedAt = new Date().toISOString();
    await fs.writeFile(
      path.join(projectDir, 'project.json'),
      JSON.stringify(projectMeta, null, 2)
    );

    return NextResponse.json({
      success: true,
      projectId,
      projectDirectory: projectDir,
      plan: planContent,
      tasks,
    });

  } catch (error) {
    console.error('Planning error:', error);
    return NextResponse.json(
      { error: 'Failed to create plan', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
