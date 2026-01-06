/**
 * Architecture Documentation Service - Enhanced Version
 * Generates comprehensive architecture diagrams, data models, API docs (OpenAPI/Swagger), and component documentation
 *
 * Enhanced features:
 * - Improved component extraction with multiple pattern matching strategies
 * - Better TypeScript type parsing for complex types, generics, and unions
 * - Richer API documentation with actual response schemas
 * - More reliable agent documentation with code-based extraction
 * - Better error handling and progress feedback
 *
 * This service thoroughly scans the project to extract:
 * - All React components with props, hooks, state, and dependencies
 * - All TypeScript interfaces, types, enums, and type aliases
 * - All API routes with full OpenAPI 3.0 documentation including response examples
 * - Agent configurations, tools, and interactions
 * - Design patterns, tech stack, and architectural decisions
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  ArchitectureOverview,
  ArchitectureDiagram,
  ComponentDoc,
  DataModel,
  APIDocumentation,
  APIEndpoint,
  AgentDocumentation,
  TechStackItem,
  DesignPattern,
  ArchitectureGenerationStatus,
  GenerationStage,
  DiagramType,
} from '@/lib/architecture/types';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = 'claude-sonnet-4-20250514';

interface ArchitectureServiceOptions {
  projectId: string;
  projectPath: string;
  projectName: string;
  onProgress?: (status: ArchitectureGenerationStatus) => void;
}

interface ScannedFile {
  path: string;
  content: string;
  type: 'component' | 'page' | 'api' | 'hook' | 'store' | 'service' | 'type' | 'utility' | 'config' | 'other';
  size: number;
}

export class ArchitectureDocumentationService {
  private projectId: string;
  private projectPath: string;
  private projectName: string;
  private onProgress?: (status: ArchitectureGenerationStatus) => void;
  private status: ArchitectureGenerationStatus;

  constructor(options: ArchitectureServiceOptions) {
    this.projectId = options.projectId;
    this.projectPath = options.projectPath;
    this.projectName = options.projectName;
    this.onProgress = options.onProgress;
    this.status = this.initializeStatus();
  }

  private initializeStatus(): ArchitectureGenerationStatus {
    return {
      projectId: this.projectId,
      status: 'idle',
      progress: 0,
      stages: [
        { name: 'File Analysis', status: 'pending', description: 'Scanning project files', progress: 0 },
        { name: 'Component Extraction', status: 'pending', description: 'Extracting component documentation', progress: 0 },
        { name: 'Data Model Analysis', status: 'pending', description: 'Analyzing data models and types', progress: 0 },
        { name: 'API Documentation', status: 'pending', description: 'Generating OpenAPI/Swagger documentation', progress: 0 },
        { name: 'Agent Documentation', status: 'pending', description: 'Documenting AI agents', progress: 0 },
        { name: 'Diagram Generation', status: 'pending', description: 'Creating architecture diagrams', progress: 0 },
      ],
    };
  }

  private updateProgress(stageName: string, stageProgress: number, stageStatus: GenerationStage['status'] = 'in_progress') {
    const stage = this.status.stages.find(s => s.name === stageName);
    if (stage) {
      stage.progress = stageProgress;
      stage.status = stageStatus;
    }

    const totalProgress = this.status.stages.reduce((sum, s) => sum + s.progress, 0) / this.status.stages.length;
    this.status.progress = Math.round(totalProgress);
    this.status.currentPhase = stageName;

    this.onProgress?.(this.status);
  }

  async generateFullDocumentation(): Promise<ArchitectureOverview> {
    this.status.status = 'analyzing';
    this.status.startedAt = new Date();
    this.onProgress?.(this.status);

    try {
      // Stage 1: File Analysis - Comprehensive scan
      this.updateProgress('File Analysis', 0);
      const files = await this.scanProjectFiles();
      console.log(`📁 Scanned ${files.length} files from ${this.projectPath}`);
      this.updateProgress('File Analysis', 100, 'complete');

      // Stage 2: Component Extraction - All React components with AI enrichment
      this.updateProgress('Component Extraction', 0);
      let components = await this.extractAllComponents(files);
      console.log(`🧩 Extracted ${components.length} components (basic)`);

      // Enrich components with AI for better descriptions
      this.updateProgress('Component Extraction', 50);
      components = await this.enrichComponentsWithAI(components, files);
      console.log(`🧩 Enriched ${components.length} components`);
      this.updateProgress('Component Extraction', 100, 'complete');

      // Stage 3: Data Model Analysis - All interfaces and types
      this.updateProgress('Data Model Analysis', 0);
      let dataModels = await this.extractAllDataModels(files);
      console.log(`📊 Extracted ${dataModels.length} data models (basic)`);

      // Enrich data models with relationships and descriptions
      this.updateProgress('Data Model Analysis', 50);
      dataModels = await this.enrichDataModelsWithAI(dataModels, files);
      console.log(`📊 Enriched ${dataModels.length} data models`);
      this.updateProgress('Data Model Analysis', 100, 'complete');

      // Stage 4: API Documentation - OpenAPI/Swagger with AI
      this.updateProgress('API Documentation', 0);
      let apiDocs = await this.generateOpenAPIDocumentation(files);
      console.log(`🔌 Documented ${apiDocs.endpoints.length} API endpoints (basic)`);

      // Enrich API docs with better descriptions and examples
      this.updateProgress('API Documentation', 50);
      apiDocs = await this.enrichAPIDocsWithAI(apiDocs, files);
      console.log(`🔌 Enriched ${apiDocs.endpoints.length} API endpoints`);
      this.updateProgress('API Documentation', 100, 'complete');

      // Stage 5: Agent Documentation - Always use AI for this
      this.updateProgress('Agent Documentation', 0);
      const agents = await this.documentAgentsWithAI(files);
      console.log(`🤖 Documented ${agents.length} agents`);
      this.updateProgress('Agent Documentation', 100, 'complete');

      // Stage 6: Diagram Generation - Based on actual data
      this.updateProgress('Diagram Generation', 0);
      const diagrams = await this.generateAllDiagrams(components, dataModels, apiDocs, agents);
      console.log(`📐 Generated ${diagrams.length} diagrams`);
      this.updateProgress('Diagram Generation', 100, 'complete');

      // Extract tech stack and patterns
      const techStack = this.extractTechStack(files);
      const patterns = this.identifyPatterns(files, components);

      // Generate project description with AI
      const projectDescription = await this.generateProjectDescription(files, components, apiDocs);

      this.status.status = 'complete';
      this.status.completedAt = new Date();
      this.onProgress?.(this.status);

      return {
        projectId: this.projectId,
        projectName: this.projectName,
        description: projectDescription,
        techStack,
        diagrams,
        components,
        dataModels,
        apiDocumentation: apiDocs,
        agents,
        designPatterns: patterns,
        lastUpdated: new Date(),
        version: '1.0.0',
        generatedBy: 'agent',
      };
    } catch (error) {
      this.status.status = 'error';
      this.status.error = error instanceof Error ? error.message : 'Unknown error';
      this.onProgress?.(this.status);
      throw error;
    }
  }

  /**
   * Generate a meaningful project description using AI
   */
  private async generateProjectDescription(
    files: ScannedFile[],
    components: ComponentDoc[],
    apiDocs: APIDocumentation
  ): Promise<string> {
    try {
      // Gather key info about the project
      const pageComponents = components.filter(c => c.type === 'page');
      const apiEndpoints = apiDocs.endpoints.slice(0, 10);
      const hasAgents = files.some(f => f.path.includes('agent'));

      const projectContext = `
Project: ${this.projectName}
Pages: ${pageComponents.map(p => p.name).join(', ')}
API Endpoints: ${apiEndpoints.map(e => `${e.method} ${e.path}`).join(', ')}
Total Components: ${components.length}
Has AI Agents: ${hasAgents}
      `.trim();

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Based on this project info, write a 1-2 sentence description of what this application does:

${projectContext}

Return ONLY the description, no quotes or extra text.`
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      return text.trim() || `Architecture documentation for ${this.projectName}`;
    } catch {
      return `Architecture documentation for ${this.projectName}`;
    }
  }

  /**
   * Enrich components with AI-generated descriptions
   */
  private async enrichComponentsWithAI(
    components: ComponentDoc[],
    files: ScannedFile[]
  ): Promise<ComponentDoc[]> {
    if (components.length === 0) return components;

    // Only enrich key components (pages, stores, services) to save API calls
    const keyComponents = components.filter(c =>
      c.type === 'page' || c.type === 'store' || c.type === 'service' || c.type === 'hook'
    ).slice(0, 20);

    if (keyComponents.length === 0) return components;

    try {
      const componentSummary = keyComponents.map(c => ({
        name: c.name,
        type: c.type,
        path: c.path,
        props: c.props?.map(p => p.name).join(', ') || '',
        currentDesc: c.description,
      }));

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analyze these React components and provide better descriptions. Return JSON array with name and description only:

${JSON.stringify(componentSummary, null, 2)}

Return format: [{"name": "ComponentName", "description": "Clear description of what it does"}]`
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const enriched = JSON.parse(jsonMatch[0]) as Array<{ name: string; description: string }>;
        const enrichedMap = new Map(enriched.map(e => [e.name, e.description]));

        return components.map(c => ({
          ...c,
          description: enrichedMap.get(c.name) || c.description,
        }));
      }
    } catch (err) {
      console.warn('⚠️ Component enrichment failed:', err);
    }

    return components;
  }

  /**
   * Enrich data models with AI-generated descriptions and relationship analysis
   */
  private async enrichDataModelsWithAI(
    models: DataModel[],
    files: ScannedFile[]
  ): Promise<DataModel[]> {
    if (models.length === 0) return models;

    // Take top models by importance (those with relationships or many fields)
    const keyModels = models
      .sort((a, b) => (b.fields.length + b.relationships.length) - (a.fields.length + a.relationships.length))
      .slice(0, 25);

    if (keyModels.length === 0) return models;

    try {
      const modelSummary = keyModels.map(m => ({
        name: m.name,
        fields: m.fields.slice(0, 10).map(f => `${f.name}: ${f.type}`).join(', '),
        relationships: m.relationships.map(r => r.targetModel).join(', '),
      }));

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Analyze these TypeScript data models and provide descriptions. Return JSON array:

${JSON.stringify(modelSummary, null, 2)}

Return format: [{"name": "ModelName", "description": "What this model represents and its purpose"}]`
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const enriched = JSON.parse(jsonMatch[0]) as Array<{ name: string; description: string }>;
        const enrichedMap = new Map(enriched.map(e => [e.name, e.description]));

        return models.map(m => ({
          ...m,
          description: enrichedMap.get(m.name) || m.description,
        }));
      }
    } catch (err) {
      console.warn('⚠️ Data model enrichment failed:', err);
    }

    return models;
  }

  /**
   * Enrich API documentation with AI-generated descriptions and examples
   */
  private async enrichAPIDocsWithAI(
    apiDocs: APIDocumentation,
    files: ScannedFile[]
  ): Promise<APIDocumentation> {
    if (apiDocs.endpoints.length === 0) return apiDocs;

    const keyEndpoints = apiDocs.endpoints.slice(0, 30);

    try {
      const endpointSummary = keyEndpoints.map(e => ({
        method: e.method,
        path: e.path,
        currentSummary: e.summary,
        params: e.parameters?.map(p => p.name).join(', ') || '',
        hasBody: !!e.requestBody,
      }));

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 3000,
        messages: [{
          role: 'user',
          content: `Analyze these API endpoints and provide better summaries and descriptions. Return JSON array:

${JSON.stringify(endpointSummary, null, 2)}

Return format: [{"path": "/api/...", "method": "GET", "summary": "Short summary", "description": "Detailed description of what this endpoint does"}]`
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const enriched = JSON.parse(jsonMatch[0]) as Array<{ path: string; method: string; summary: string; description: string }>;
        const enrichedMap = new Map(enriched.map(e => [`${e.method}:${e.path}`, e]));

        return {
          ...apiDocs,
          endpoints: apiDocs.endpoints.map(e => {
            const enrichment = enrichedMap.get(`${e.method}:${e.path}`);
            return enrichment ? {
              ...e,
              summary: enrichment.summary || e.summary,
              description: enrichment.description || e.description,
            } : e;
          }),
        };
      }
    } catch (err) {
      console.warn('⚠️ API docs enrichment failed:', err);
    }

    return apiDocs;
  }

  /**
   * Document agents using AI analysis - more thorough than code-only extraction
   */
  private async documentAgentsWithAI(files: ScannedFile[]): Promise<AgentDocumentation[]> {
    // Find agent-related files
    const agentFiles = files.filter(f =>
      f.path.includes('agent') ||
      f.path.includes('multi-agent') ||
      f.path.includes('orchestrat') ||
      f.path.includes('workflow') ||
      (f.type === 'service' && (f.content.includes('agent') || f.content.includes('Agent')))
    );

    console.log(`🤖 Found ${agentFiles.length} agent-related files`);

    if (agentFiles.length === 0) {
      // Check if this is an agent-based project at all
      const hasAgentPatterns = files.some(f =>
        f.content.includes('agent') ||
        f.content.includes('orchestrat') ||
        f.content.includes('workflow')
      );

      if (!hasAgentPatterns) {
        return []; // Not an agent-based project
      }

      return this.getDefaultAgentDocs(files);
    }

    // Prepare content for AI analysis - include more context
    const agentContent = agentFiles
      .slice(0, 10) // Top 10 most relevant files
      .map(f => `// File: ${f.path}\n${f.content.slice(0, 5000)}`)
      .join('\n\n---\n\n');

    try {
      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 6000,
        messages: [{
          role: 'user',
          content: `Analyze this codebase thoroughly and document ALL AI agents found. Look for:
- Agent class definitions
- Agent role configurations
- Agent types and their responsibilities
- Tools/capabilities each agent has
- How agents interact with each other

Codebase:
${agentContent.slice(0, 25000)}

Return a comprehensive JSON array. Include ALL agents you find, even partial definitions:
[{
  "id": "unique-id",
  "name": "Agent Name",
  "type": "supervisor|research|product_owner|coder|tester|security|infrastructure|architecture",
  "description": "Detailed description of what this agent does",
  "responsibilities": ["responsibility 1", "responsibility 2", ...],
  "capabilities": ["capability 1", "capability 2", ...],
  "tools": [{"name": "tool_name", "description": "what it does", "parameters": []}],
  "inputs": [{"name": "input_name", "type": "type", "description": "desc", "required": true}],
  "outputs": [{"name": "output_name", "type": "type", "description": "desc"}],
  "interactions": [{"withAgent": "OtherAgent", "type": "triggers|receives_from|coordinates_with", "description": "how they interact"}],
  "limitations": ["limitation 1"],
  "bestPractices": ["practice 1"]
}]

Return ONLY valid JSON array, no markdown or explanation.`
        }]
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const agents = JSON.parse(jsonMatch[0]) as AgentDocumentation[];
        console.log(`🤖 AI extracted ${agents.length} agents`);

        if (agents.length > 0) {
          return agents.map((a, i) => ({
            ...a,
            id: a.id || `agent-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
            examples: a.examples || [],
          }));
        }
      }
    } catch (err) {
      console.warn('⚠️ AI agent documentation failed:', err);
    }

    // Fallback to code-based extraction
    const codeExtracted = this.extractAgentsFromCode(files, agentFiles);
    return codeExtracted.length > 0 ? codeExtracted : this.getDefaultAgentDocs(files);
  }

  /**
   * Comprehensive file scanning - reads ALL relevant project files
   */
  private async scanProjectFiles(): Promise<ScannedFile[]> {
    const files: ScannedFile[] = [];

    // Positive patterns - what to include
    const patterns = [
      '**/*.ts',
      '**/*.tsx',
      '**/*.js',
      '**/*.jsx',
      'package.json',
      'tsconfig.json',
    ];

    // Negative patterns - what to exclude (use ignore option, not ! prefix)
    const ignorePatterns = [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/*.test.*',
      '**/*.spec.*',
      '**/__tests__/**',
      '**/.architecture/**',
      '**/coverage/**',
    ];

    try {
      const normalizedPath = this.projectPath.replace(/\\/g, '/');
      console.log(`🔍 Scanning directory: ${normalizedPath}`);

      const matches = await glob(patterns, {
        cwd: normalizedPath,
        absolute: false,
        nodir: true,
        ignore: ignorePatterns,
      });

      console.log(`📄 Found ${matches.length} files matching patterns`);

      // Read up to 500 files (increased limit)
      for (const match of matches.slice(0, 500)) {
        const fullPath = path.join(this.projectPath, match);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          const fileType = this.categorizeFile(match, content);

          files.push({
            path: match,
            content,
            type: fileType,
            size: content.length,
          });
        } catch (err) {
          console.warn(`⚠️ Could not read file: ${match}`);
        }
      }
    } catch (err) {
      console.error('❌ Glob error:', err);
    }

    return files;
  }

  /**
   * Categorize file by its path and content
   */
  private categorizeFile(filePath: string, content: string): ScannedFile['type'] {
    const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();

    // Log for debugging
    console.log(`  📄 Categorizing: ${normalizedPath}`);

    // API routes - Next.js App Router style
    if (normalizedPath.includes('/api/') && (normalizedPath.endsWith('route.ts') || normalizedPath.endsWith('route.tsx'))) {
      console.log(`    → Detected as API route`);
      return 'api';
    }

    // Components folder - check for /components/ anywhere in path
    if (normalizedPath.includes('/components/')) {
      console.log(`    → Detected as component (path contains /components/)`);
      return 'component';
    }

    // Pages
    if (normalizedPath.includes('/pages/')) {
      console.log(`    → Detected as page (in /pages/ folder)`);
      return 'page';
    }
    if (normalizedPath.endsWith('/page.tsx') || normalizedPath.endsWith('/page.ts')) {
      console.log(`    → Detected as page (page.tsx file)`);
      return 'page';
    }

    // Layout files are also components
    if (normalizedPath.endsWith('layout.tsx') || normalizedPath.endsWith('layout.ts')) return 'page';

    // Hooks
    if (normalizedPath.includes('/hooks/')) return 'hook';
    const fileName = normalizedPath.split('/').pop() || '';
    if (fileName.startsWith('use') && fileName.endsWith('.ts')) return 'hook';

    // Stores
    if (normalizedPath.includes('/stores/') || normalizedPath.includes('store.ts') || normalizedPath.includes('-store.ts')) return 'store';

    // Services
    if (normalizedPath.includes('/services/')) return 'service';

    // Types
    if (normalizedPath.includes('/types/') || normalizedPath.includes('/interfaces/')) return 'type';
    if (fileName === 'types.ts' || fileName.endsWith('.types.ts')) return 'type';

    // Utilities/Lib
    if (normalizedPath.includes('/lib/') || normalizedPath.includes('/utils/')) return 'utility';

    // Config files
    if (normalizedPath.endsWith('.config.ts') || normalizedPath.endsWith('.config.js')) return 'config';

    // Check content for React components (.tsx files with JSX)
    if (normalizedPath.endsWith('.tsx')) {
      // Look for function components with JSX return
      if (content.includes('export default function') && content.includes('return (')) {
        console.log(`    → Detected as component (export default function with JSX)`);
        return 'component';
      }
      if (content.includes('export function') && content.includes('return (') && content.includes('<')) {
        console.log(`    → Detected as component (export function with JSX)`);
        return 'component';
      }
      // Arrow function components
      if ((content.includes('export const') || content.includes('export default')) && content.includes('=>') && content.includes('<')) {
        console.log(`    → Detected as component (arrow function with JSX)`);
        return 'component';
      }
    }

    return 'other';
  }

  /**
   * Extract ALL React components from the project
   */
  private async extractAllComponents(files: ScannedFile[]): Promise<ComponentDoc[]> {
    const components: ComponentDoc[] = [];

    // Log file type distribution for debugging
    const typeDistribution = files.reduce((acc, f) => {
      acc[f.type] = (acc[f.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    console.log(`📊 File type distribution:`, typeDistribution);

    // Get all component files
    const componentFiles = files.filter(f =>
      f.type === 'component' || f.type === 'page' ||
      (f.path.endsWith('.tsx') && f.content.includes('export'))
    );

    console.log(`🔍 Processing ${componentFiles.length} potential component files`);
    console.log(`📂 Component file paths:`, componentFiles.map(f => f.path));

    // Process components in batches to use Claude more efficiently
    const batchSize = 10;
    for (let i = 0; i < componentFiles.length; i += batchSize) {
      const batch = componentFiles.slice(i, i + batchSize);
      const batchProgress = Math.round((i / componentFiles.length) * 100);
      this.updateProgress('Component Extraction', batchProgress);

      // Extract components from this batch using pattern matching first
      for (const file of batch) {
        const extracted = this.extractComponentFromCode(file);
        if (extracted) {
          components.push(extracted);
        }
      }
    }

    return components;
  }

  /**
   * Extract component info using enhanced pattern matching (fast, no AI call)
   * Supports multiple export patterns, arrow functions, class components, and forwardRef
   */
  private extractComponentFromCode(file: ScannedFile): ComponentDoc | null {
    const content = file.content;

    // Extract component name from various export patterns
    let name = '';

    // Pattern 1: export default function ComponentName
    const defaultFunctionMatch = content.match(/export\s+default\s+function\s+(\w+)/);
    // Pattern 2: export function ComponentName
    const namedFunctionMatch = content.match(/export\s+function\s+(\w+)/);
    // Pattern 3: export const ComponentName = () => or function()
    const constArrowMatch = content.match(/export\s+const\s+(\w+)\s*=\s*(?:\([^)]*\)|[^=])*=>/);
    const constFunctionMatch = content.match(/export\s+const\s+(\w+)\s*=\s*function/);
    // Pattern 4: export const ComponentName: React.FC =
    const constFCMatch = content.match(/export\s+const\s+(\w+)\s*:\s*(?:React\.)?FC/);
    // Pattern 5: export class ComponentName extends
    const classMatch = content.match(/export\s+(?:default\s+)?class\s+(\w+)\s+extends/);
    // Pattern 6: forwardRef pattern
    const forwardRefMatch = content.match(/export\s+const\s+(\w+)\s*=\s*(?:React\.)?forwardRef/);
    // Pattern 7: memo pattern
    const memoMatch = content.match(/export\s+const\s+(\w+)\s*=\s*(?:React\.)?memo/);
    // Pattern 8: Simple const export (fallback)
    const simpleConstMatch = content.match(/export\s+const\s+(\w+)\s*[=:]/);
    // Pattern 9: Default export at end of file
    const defaultExportAtEnd = content.match(/export\s+default\s+(\w+)\s*;?\s*$/m);

    if (defaultFunctionMatch) name = defaultFunctionMatch[1];
    else if (namedFunctionMatch) name = namedFunctionMatch[1];
    else if (constArrowMatch) name = constArrowMatch[1];
    else if (constFunctionMatch) name = constFunctionMatch[1];
    else if (constFCMatch) name = constFCMatch[1];
    else if (classMatch) name = classMatch[1];
    else if (forwardRefMatch) name = forwardRefMatch[1];
    else if (memoMatch) name = memoMatch[1];
    else if (simpleConstMatch) name = simpleConstMatch[1];
    else if (defaultExportAtEnd) name = defaultExportAtEnd[1];
    else return null;

    // Skip non-component exports
    if (name.startsWith('use') && file.type !== 'hook') return null;
    if (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(name)) return null;
    if (['default', 'module', 'exports'].includes(name.toLowerCase())) return null;

    // Extract props interface with better handling
    const props: ComponentDoc['props'] = [];

    // Try multiple props patterns
    const propsPatterns = [
      // interface ComponentNameProps { }
      new RegExp(`interface\\s+${name}Props\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'),
      // interface Props { }
      /interface\s+Props\s*\{([\s\S]*?)\n\}/m,
      // type ComponentNameProps = { }
      new RegExp(`type\\s+${name}Props\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`, 'm'),
      // Generic props interface
      /interface\s+\w*Props\w*\s*\{([\s\S]*?)\n\}/m,
    ];

    for (const pattern of propsPatterns) {
      const propsMatch = content.match(pattern);
      if (propsMatch && propsMatch[1]) {
        const propsContent = propsMatch[1];
        this.parsePropsFromContent(propsContent, props);
        break;
      }
    }

    // Also extract props from function parameters: ({ prop1, prop2 }: Props)
    const destructuredPropsMatch = content.match(/(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|\function))\s*\(\s*\{\s*([^}]+)\s*\}/);
    if (destructuredPropsMatch && props.length === 0) {
      const destructuredProps = destructuredPropsMatch[1].split(',').map(p => p.trim().split(':')[0].split('=')[0].trim());
      for (const propName of destructuredProps) {
        if (propName && !props.find(p => p.name === propName)) {
          props.push({
            name: propName,
            type: 'unknown',
            required: true,
            description: '',
          });
        }
      }
    }

    // Extract imports to find dependencies (both external and internal)
    const importMatches = content.matchAll(/import\s+(?:\{[^}]+\}|\*\s+as\s+\w+|\w+)?\s*(?:,\s*\{[^}]+\})?\s*from\s+['"]([^'"]+)['"]/g);
    const dependencies: string[] = [];
    const internalDeps: string[] = [];

    for (const match of importMatches) {
      const dep = match[1];
      if (dep.startsWith('.') || dep.startsWith('@/')) {
        internalDeps.push(dep);
      } else {
        dependencies.push(dep);
      }
    }

    // Extract all exports from file
    const exportMatches = content.matchAll(/export\s+(?:const|function|class|type|interface|enum|default)\s+(\w+)/g);
    const exports: string[] = [];
    for (const match of exportMatches) {
      if (match[1] !== 'default') {
        exports.push(match[1]);
      }
    }

    // Extract hooks used in the component
    const hooksUsed: string[] = [];
    const hookMatches = content.matchAll(/\b(use\w+)\s*\(/g);
    for (const match of hookMatches) {
      if (!hooksUsed.includes(match[1])) {
        hooksUsed.push(match[1]);
      }
    }

    // Extract state variables
    const stateVars: string[] = [];
    const useStateMatches = content.matchAll(/const\s+\[(\w+),\s*set\w+\]\s*=\s*useState/g);
    for (const match of useStateMatches) {
      stateVars.push(match[1]);
    }

    // Determine type with more accuracy
    let type: ComponentDoc['type'] = 'component';
    if (file.type === 'page' || file.path.includes('/app/') && file.path.endsWith('page.tsx')) type = 'page';
    else if (file.type === 'hook' || name.startsWith('use')) type = 'hook';
    else if (file.type === 'store' || content.includes('create(') && content.includes('zustand')) type = 'store';
    else if (file.type === 'service') type = 'service';
    else if (file.type === 'api') type = 'api';
    else if (file.type === 'utility' || file.path.includes('/lib/') || file.path.includes('/utils/')) type = 'utility';

    // Generate description from JSDoc or inline comments
    let description = '';

    // Try JSDoc comment
    const jsdocMatch = content.match(/\/\*\*\s*\n([\s\S]*?)\*\/\s*(?:export|const|function|class)/);
    if (jsdocMatch) {
      const jsdocContent = jsdocMatch[1];
      const descLine = jsdocContent.match(/\*\s*([^@\n][^\n]*)/);
      if (descLine) {
        description = descLine[1].trim();
      }
    }

    // Try single-line comment before export
    if (!description) {
      const singleCommentMatch = content.match(/\/\/\s*([^\n]+)\n\s*export/);
      if (singleCommentMatch) {
        description = singleCommentMatch[1].trim();
      }
    }

    // Fallback description
    if (!description) {
      if (type === 'hook') {
        description = `Custom React hook for ${name.replace(/^use/, '').toLowerCase()} functionality`;
      } else if (type === 'page') {
        description = `Page component at ${file.path.replace(/\.tsx?$/, '')}`;
      } else if (type === 'store') {
        description = `State management store for ${name.replace(/Store$/, '').toLowerCase()} data`;
      } else {
        description = `${type.charAt(0).toUpperCase() + type.slice(1)} in ${file.path}`;
      }
    }

    return {
      id: `comp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      type,
      description,
      path: file.path,
      props,
      exports,
      dependencies: [...dependencies, ...internalDeps.slice(0, 10)], // Include some internal deps
      dependents: [],
      linesOfCode: content.split('\n').length,
      complexity: this.calculateComplexity(content),
      lastModified: new Date(),
      // Extended metadata (stored in description for now)
      ...(hooksUsed.length > 0 && { hooksUsed }),
      ...(stateVars.length > 0 && { stateVariables: stateVars }),
    } as ComponentDoc;
  }

  /**
   * Parse props from interface/type content
   */
  private parsePropsFromContent(content: string, props: NonNullable<ComponentDoc['props']>): void {
    // Track brace depth for nested types
    let depth = 0;
    let currentProp = '';
    let currentComment = '';

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines
      if (!trimmed) continue;

      // Capture JSDoc comments
      if (trimmed.startsWith('/**') || trimmed.startsWith('*')) {
        const commentMatch = trimmed.match(/\*\s*([^@*][^\n]*)/);
        if (commentMatch) {
          currentComment = commentMatch[1].trim();
        }
        continue;
      }

      // Skip regular comments
      if (trimmed.startsWith('//')) {
        currentComment = trimmed.replace(/^\/\/\s*/, '');
        continue;
      }

      // Count braces
      for (const char of trimmed) {
        if (char === '{' || char === '<') depth++;
        if (char === '}' || char === '>') depth--;
      }

      // Only parse top-level properties
      if (depth <= 0) {
        const propMatch = trimmed.match(/^(\w+)(\?)?:\s*(.+?);?\s*$/);
        if (propMatch) {
          const [, propName, optional, propType] = propMatch;
          props.push({
            name: propName,
            type: this.simplifyType(propType),
            required: !optional,
            description: currentComment || '',
          });
          currentComment = '';
        }
      }
    }
  }

  /**
   * Simplify complex TypeScript types for display
   */
  private simplifyType(type: string): string {
    let simplified = type.trim();

    // Remove trailing semicolons
    simplified = simplified.replace(/;$/, '');

    // Simplify common patterns
    if (simplified.includes(' | ')) {
      const parts = simplified.split(' | ').map(p => p.trim());
      if (parts.length > 3) {
        simplified = `${parts[0]} | ${parts[1]} | ...`;
      }
    }

    // Simplify React types
    simplified = simplified
      .replace(/React\.ReactNode/, 'ReactNode')
      .replace(/React\.ReactElement/, 'ReactElement')
      .replace(/React\.CSSProperties/, 'CSSProperties')
      .replace(/React\.MouseEvent<[^>]+>/, 'MouseEvent')
      .replace(/React\.ChangeEvent<[^>]+>/, 'ChangeEvent');

    // Truncate very long types
    if (simplified.length > 60) {
      simplified = simplified.substring(0, 57) + '...';
    }

    return simplified;
  }

  /**
   * Calculate code complexity (simple heuristic)
   */
  private calculateComplexity(content: string): 'low' | 'medium' | 'high' {
    const lines = content.split('\n').length;
    const conditionals = (content.match(/if\s*\(|switch\s*\(|\?\s*:/g) || []).length;
    const loops = (content.match(/for\s*\(|while\s*\(|\.map\(|\.forEach\(/g) || []).length;

    const score = lines / 50 + conditionals * 2 + loops * 2;

    if (score < 5) return 'low';
    if (score < 15) return 'medium';
    return 'high';
  }

  /**
   * Categorize a data model based on its name patterns
   * Returns the category and whether it should be included in main data models
   */
  private categorizeDataModel(name: string): { category: DataModel['category']; isDataModel: boolean } {
    const lowerName = name.toLowerCase();

    // Props interfaces - React component props (filter from data models)
    if (name.endsWith('Props') || name.endsWith('PropsType')) {
      return { category: 'props', isDataModel: false };
    }

    // Context types (filter from data models)
    if (name.endsWith('ContextValue') || name.endsWith('ContextType') || name.endsWith('Context')) {
      return { category: 'context', isDataModel: false };
    }

    // State types
    if (name.endsWith('State') || name.endsWith('StateType')) {
      return { category: 'state', isDataModel: false };
    }

    // UI/Component utility types - these are internal component concerns, not data models
    const uiUtilityPatterns = [
      'position', 'coordinates', 'coord', 'point',    // Position types
      'dimension', 'size', 'bounds', 'rect', 'box',   // Size/dimension types
      'style', 'styles', 'css', 'classname',          // Styling types
      'animation', 'transition', 'keyframe',          // Animation types
      'gesture', 'drag', 'scroll', 'touch', 'mouse',  // Interaction types
      'layout', 'grid', 'flex',                       // Layout types
      'render', 'display', 'visible', 'hidden',       // Rendering types
      'focus', 'hover', 'active', 'disabled',         // UI state types
      'variant', 'variants',                          // Component variant types
      'slot', 'slots',                                // Slot types
      'aria', 'a11y', 'accessibility',                // Accessibility types
    ];
    if (uiUtilityPatterns.some(pattern => lowerName.includes(pattern))) {
      return { category: 'utility', isDataModel: false };
    }

    // Form-related internal types (filter)
    if (lowerName.includes('formfield') || lowerName.includes('formvalue') ||
        lowerName.includes('fieldvalue') || lowerName.includes('inputvalue')) {
      return { category: 'utility', isDataModel: false };
    }

    // Hook return types (filter)
    if (name.endsWith('Return') || name.endsWith('ReturnType') || name.endsWith('Hook')) {
      return { category: 'utility', isDataModel: false };
    }

    // Action types for reducers (filter)
    if (name.endsWith('Action') || name.endsWith('Actions') || name.endsWith('ActionType')) {
      return { category: 'utility', isDataModel: false };
    }

    // Event types (filter)
    if (name.endsWith('Event') || name.endsWith('EventData') || name.endsWith('EventPayload')) {
      return { category: 'utility', isDataModel: false };
    }

    // Config/Options types (include as they often define important structures)
    if (name.endsWith('Config') || name.endsWith('Options') || name.endsWith('Settings')) {
      return { category: 'config', isDataModel: true };
    }

    // API Response types (include as they define API contracts)
    if (name.endsWith('Response') || name.endsWith('Result')) {
      return { category: 'response', isDataModel: true };
    }

    // API Request types (include as they define API contracts)
    if (name.endsWith('Request') || name.endsWith('Payload') || name.endsWith('Input') || name.endsWith('Params')) {
      return { category: 'request', isDataModel: true };
    }

    // Internal/Private types (filter from data models)
    if (name.startsWith('_') || name.startsWith('Internal')) {
      return { category: 'utility', isDataModel: false };
    }

    // Event handler types (filter)
    if (name.endsWith('Handler') || name.endsWith('Callback') || name.endsWith('Listener')) {
      return { category: 'utility', isDataModel: false };
    }

    // Ref types (filter)
    if (name.endsWith('Ref') || name.endsWith('RefType')) {
      return { category: 'utility', isDataModel: false };
    }

    // Generic utility type patterns (filter)
    if (name.endsWith('Map') || name.endsWith('Dict') || name.endsWith('Cache') || name.endsWith('Store')) {
      // These are often internal storage structures, not domain models
      // But keep them if they look like domain stores (e.g., UserStore)
      if (lowerName.includes('user') || lowerName.includes('product') || lowerName.includes('order')) {
        return { category: 'data', isDataModel: true };
      }
      return { category: 'utility', isDataModel: false };
    }

    // Default: treat as real data model
    return { category: 'data', isDataModel: true };
  }

  /**
   * Extract ALL TypeScript interfaces, types, and enums as data models
   * Enhanced to handle complex types, generics, union types, and mapped types
   * Now includes categorization and filtering of non-data types
   */
  private async extractAllDataModels(files: ScannedFile[]): Promise<DataModel[]> {
    const models: DataModel[] = [];
    const processedNames = new Set<string>();

    // Get all files that might contain types
    const typeFiles = files.filter(f =>
      f.type === 'type' ||
      f.path.includes('types') ||
      f.path.includes('/lib/') ||
      f.content.includes('interface ') ||
      f.content.includes('type ') ||
      f.content.includes('enum ')
    );

    console.log(`🔍 Processing ${typeFiles.length} files for data models`);

    for (const file of typeFiles) {
      // Extract interfaces with extends support
      const interfacePattern = /(?:export\s+)?interface\s+(\w+)(?:<([^>]+)>)?\s*(?:extends\s+([^{]+))?\s*\{/g;
      let match;

      while ((match = interfacePattern.exec(file.content)) !== null) {
        const name = match[1];
        const generics = match[2] || null;
        const extendsClause = match[3]?.trim() || null;

        if (processedNames.has(name)) continue;

        // Find the matching closing brace
        const startIndex = match.index + match[0].length;
        const fieldsContent = this.extractBraceContent(file.content, startIndex);

        if (fieldsContent) {
          processedNames.add(name);
          const fields = this.parseTypeFieldsEnhanced(fieldsContent);
          const relationships = this.findRelationshipsEnhanced(name, fieldsContent, extendsClause, files);
          const { category, isDataModel } = this.categorizeDataModel(name);

          // Skip empty types (no fields) - they're not useful for documentation
          if (fields.length === 0 && relationships.length === 0) continue;

          // Skip non-data model types (Props, Context, State, etc.)
          if (!isDataModel) continue;

          models.push({
            id: `model-${Date.now()}-${models.length}-${Math.random().toString(36).slice(2, 9)}`,
            name: generics ? `${name}<${this.simplifyGenerics(generics)}>` : name,
            description: this.extractTypeDescription(file.content, name),
            fields,
            relationships,
            source: 'typescript',
            filePath: file.path,
            category,
          });
        }
      }

      // Extract type aliases (object types)
      const typeObjectPattern = /(?:export\s+)?type\s+(\w+)(?:<([^>]+)>)?\s*=\s*\{/g;

      while ((match = typeObjectPattern.exec(file.content)) !== null) {
        const name = match[1];
        const generics = match[2] || null;
        if (processedNames.has(name)) continue;

        const startIndex = match.index + match[0].length;
        const fieldsContent = this.extractBraceContent(file.content, startIndex);

        if (fieldsContent) {
          processedNames.add(name);
          const fields = this.parseTypeFieldsEnhanced(fieldsContent);
          const { category, isDataModel } = this.categorizeDataModel(name);

          // Skip empty types
          if (fields.length === 0) continue;

          // Skip non-data model types
          if (!isDataModel) continue;

          models.push({
            id: `model-${Date.now()}-${models.length}-${Math.random().toString(36).slice(2, 9)}`,
            name: generics ? `${name}<${this.simplifyGenerics(generics)}>` : name,
            description: this.extractTypeDescription(file.content, name),
            fields,
            relationships: this.findRelationshipsEnhanced(name, fieldsContent, null, files),
            source: 'typescript',
            filePath: file.path,
            category,
          });
        }
      }

      // Extract union type aliases (keep these - they're often important enums)
      const typeUnionPattern = /(?:export\s+)?type\s+(\w+)\s*=\s*(['"][^'"]+['"](?:\s*\|\s*['"][^'"]+['"])+)/g;

      while ((match = typeUnionPattern.exec(file.content)) !== null) {
        const name = match[1];
        const unionValues = match[2];
        if (processedNames.has(name)) continue;

        processedNames.add(name);
        const values = unionValues.match(/['"]([^'"]+)['"]/g)?.map(v => v.replace(/['"]/g, '')) || [];
        const { category, isDataModel } = this.categorizeDataModel(name);

        // Skip non-data model types
        if (!isDataModel) continue;

        models.push({
          id: `model-${Date.now()}-${models.length}-${Math.random().toString(36).slice(2, 9)}`,
          name,
          description: this.extractTypeDescription(file.content, name) || `Union type with ${values.length} values`,
          fields: values.map(v => ({
            name: v,
            type: 'literal',
            required: true,
            description: `Literal value: "${v}"`,
          })),
          relationships: [],
          source: 'typescript',
          filePath: file.path,
          category: 'enum', // String unions are effectively enums
        });
      }

      // Extract enums
      const enumPattern = /(?:export\s+)?enum\s+(\w+)\s*\{/g;

      while ((match = enumPattern.exec(file.content)) !== null) {
        const name = match[1];
        if (processedNames.has(name)) continue;

        const startIndex = match.index + match[0].length;
        const enumContent = this.extractBraceContent(file.content, startIndex);

        if (enumContent) {
          processedNames.add(name);
          const enumFields = this.parseEnumValues(enumContent);

          // Skip empty enums
          if (enumFields.length === 0) continue;

          models.push({
            id: `model-${Date.now()}-${models.length}-${Math.random().toString(36).slice(2, 9)}`,
            name,
            description: this.extractTypeDescription(file.content, name) || `Enum with ${enumFields.length} values`,
            fields: enumFields,
            relationships: [],
            source: 'typescript',
            filePath: file.path,
            category: 'enum',
          });
        }
      }

      // Extract type aliases that reference other types (e.g., type Foo = Bar & Baz)
      const typeIntersectionPattern = /(?:export\s+)?type\s+(\w+)\s*=\s*(\w+(?:\s*&\s*\w+)+)\s*;/g;

      while ((match = typeIntersectionPattern.exec(file.content)) !== null) {
        const name = match[1];
        const intersection = match[2];
        if (processedNames.has(name)) continue;

        processedNames.add(name);
        const types = intersection.split('&').map(t => t.trim());
        const { category, isDataModel } = this.categorizeDataModel(name);

        // Skip non-data model types
        if (!isDataModel) continue;

        models.push({
          id: `model-${Date.now()}-${models.length}-${Math.random().toString(36).slice(2, 9)}`,
          name,
          description: this.extractTypeDescription(file.content, name) || `Intersection of ${types.join(' & ')}`,
          fields: [{
            name: '_intersection',
            type: intersection,
            required: true,
            description: `Combines: ${types.join(', ')}`,
          }],
          relationships: types.map(t => ({
            targetModel: t,
            type: 'one-to-one' as const,
            fieldName: '_extends',
            description: `Extends ${t}`,
          })),
          source: 'typescript',
          filePath: file.path,
          category,
        });
      }
    }

    console.log(`📊 Extracted ${models.length} data models (filtered Props, Context, State, empty types)`);

    return models;
  }

  /**
   * Simplify generic type parameters for display
   */
  private simplifyGenerics(generics: string): string {
    // Simplify common patterns
    return generics
      .replace(/extends\s+\w+/g, '')
      .replace(/\s+/g, '')
      .split(',')
      .map(g => g.trim().split('=')[0]) // Remove default values
      .join(', ');
  }

  /**
   * Parse enum values
   */
  private parseEnumValues(content: string): DataModel['fields'] {
    const fields: DataModel['fields'] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) continue;

      // Match: EnumValue = 'string' or EnumValue = 123 or just EnumValue
      const enumMatch = trimmed.match(/^(\w+)\s*(?:=\s*(.+?))?[,]?\s*$/);
      if (enumMatch) {
        const [, enumName, enumValue] = enumMatch;
        fields.push({
          name: enumName,
          type: enumValue ? (enumValue.match(/^['"]/) ? 'string' : 'number') : 'auto',
          required: true,
          description: enumValue ? `Value: ${enumValue.replace(/,\s*$/, '')}` : 'Auto-incremented value',
        });
      }
    }

    return fields;
  }

  /**
   * Extract content between braces, handling nested braces
   */
  private extractBraceContent(content: string, startIndex: number): string | null {
    let depth = 1;
    let i = startIndex;

    while (i < content.length && depth > 0) {
      const char = content[i];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      i++;
    }

    if (depth === 0) {
      return content.substring(startIndex, i - 1);
    }
    return null;
  }

  /**
   * Enhanced type field parsing with better handling of complex types
   */
  private parseTypeFieldsEnhanced(content: string): DataModel['fields'] {
    const fields: DataModel['fields'] = [];
    let currentComment = '';

    // Track depth for nested structures
    let braceDepth = 0;
    let angleDepth = 0;
    let parenDepth = 0;
    let currentLine = '';

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (char === '{') braceDepth++;
      else if (char === '}') braceDepth--;
      else if (char === '<') angleDepth++;
      else if (char === '>') angleDepth--;
      else if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;

      if (char === '\n') {
        // Only process at top level
        if (braceDepth === 0 && angleDepth === 0 && parenDepth === 0) {
          const field = this.parseFieldLine(currentLine.trim(), currentComment);
          if (field) {
            fields.push(field);
            currentComment = '';
          } else {
            // Check if it's a comment
            const trimmed = currentLine.trim();
            if (trimmed.startsWith('//')) {
              currentComment = trimmed.replace(/^\/\/\s*/, '');
            } else if (trimmed.startsWith('*') && !trimmed.startsWith('*/')) {
              const commentMatch = trimmed.match(/\*\s*([^@*][^\n]*)/);
              if (commentMatch) {
                currentComment = commentMatch[1].trim();
              }
            }
          }
        }
        currentLine = '';
      } else {
        currentLine += char;
      }
    }

    // Process last line
    if (currentLine.trim()) {
      const field = this.parseFieldLine(currentLine.trim(), currentComment);
      if (field) fields.push(field);
    }

    return fields;
  }

  /**
   * Parse a single field line
   */
  private parseFieldLine(line: string, comment: string): DataModel['fields'][0] | null {
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      return null;
    }

    // Match field: name?: type; or readonly name: type;
    const fieldMatch = line.match(/^(readonly\s+)?(\w+)(\?)?:\s*(.+?);?\s*$/);
    if (!fieldMatch) return null;

    const [, readonly, fieldName, optional, fieldType] = fieldMatch;

    // Clean and simplify the type
    let type = this.simplifyTypeForDisplay(fieldType);

    return {
      name: fieldName,
      type,
      required: !optional,
      description: comment || (readonly ? 'Read-only field' : ''),
    };
  }

  /**
   * Simplify complex TypeScript types for display in documentation
   */
  private simplifyTypeForDisplay(type: string): string {
    let simplified = type.trim().replace(/;$/, '');

    // Handle function types
    if (simplified.includes('=>')) {
      const funcMatch = simplified.match(/\(([^)]*)\)\s*=>\s*(.+)/);
      if (funcMatch) {
        const params = funcMatch[1].split(',').length;
        const returnType = funcMatch[2].trim();
        simplified = `(${params} params) => ${returnType.length > 20 ? returnType.slice(0, 17) + '...' : returnType}`;
      }
    }

    // Handle array types
    simplified = simplified
      .replace(/Array<([^>]+)>/g, '$1[]')
      .replace(/ReadonlyArray<([^>]+)>/g, 'readonly $1[]');

    // Handle Promise types
    simplified = simplified.replace(/Promise<([^>]+)>/g, 'Promise<$1>');

    // Handle Record types
    simplified = simplified.replace(/Record<([^,]+),\s*([^>]+)>/g, 'Record<$1, $2>');

    // Handle union types - keep first few options
    if (simplified.includes(' | ')) {
      const parts = simplified.split(' | ').map(p => p.trim());
      if (parts.length > 4) {
        simplified = `${parts.slice(0, 3).join(' | ')} | ... (${parts.length - 3} more)`;
      }
    }

    // Simplify React types
    simplified = simplified
      .replace(/React\.ReactNode/, 'ReactNode')
      .replace(/React\.ReactElement(?:<[^>]+>)?/, 'ReactElement')
      .replace(/React\.FC(?:<[^>]+>)?/, 'FC')
      .replace(/React\.ComponentProps<[^>]+>/, 'ComponentProps')
      .replace(/React\.HTMLAttributes<[^>]+>/, 'HTMLAttributes');

    // Truncate if still too long
    if (simplified.length > 80) {
      simplified = simplified.substring(0, 77) + '...';
    }

    return simplified;
  }

  /**
   * Parse type fields from interface/type body (legacy method for compatibility)
   */
  private parseTypeFields(content: string): DataModel['fields'] {
    return this.parseTypeFieldsEnhanced(content);
  }

  /**
   * Extract JSDoc description for a type
   */
  private extractTypeDescription(content: string, typeName: string): string {
    const pattern = new RegExp(`\\/\\*\\*\\s*\\n([\\s\\S]*?)\\*\\/\\s*(?:export\\s+)?(?:interface|type)\\s+${typeName}`);
    const match = content.match(pattern);

    if (match) {
      const docContent = match[1];
      const descLine = docContent.match(/\*\s*([^@\n]+)/);
      if (descLine) return descLine[1].trim();
    }

    return `Data model: ${typeName}`;
  }

  /**
   * Enhanced relationship finding that also captures extends clauses
   */
  private findRelationshipsEnhanced(
    typeName: string,
    fieldsContent: string,
    extendsClause: string | null,
    files: ScannedFile[]
  ): DataModel['relationships'] {
    const relationships: DataModel['relationships'] = [];
    const allTypeNames = new Set<string>();
    const foundRelationships = new Set<string>(); // Track to avoid duplicates

    // Collect all type names from project
    for (const file of files) {
      const typeMatches = file.content.matchAll(/(?:interface|type|enum)\s+(\w+)/g);
      for (const match of typeMatches) {
        allTypeNames.add(match[1]);
      }
    }

    // Add relationships from extends clause
    if (extendsClause) {
      const extendedTypes = extendsClause.split(',').map(t => t.trim().split('<')[0]);
      for (const extType of extendedTypes) {
        if (extType && allTypeNames.has(extType) && !foundRelationships.has(`extends:${extType}`)) {
          foundRelationships.add(`extends:${extType}`);
          relationships.push({
            targetModel: extType,
            type: 'one-to-one',
            fieldName: '_extends',
            description: `Extends ${extType}`,
          });
        }
      }
    }

    // Check fields for references to other types
    const lines = fieldsContent.split('\n');
    for (const line of lines) {
      const fieldMatch = line.match(/(\w+)(\?)?:\s*([^;]+)/);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1];
      const fieldType = fieldMatch[3];

      // Check if field type references another model
      for (const otherType of allTypeNames) {
        if (otherType === typeName) continue;

        // More precise matching to avoid false positives
        const typeRegex = new RegExp(`\\b${otherType}\\b`);
        if (typeRegex.test(fieldType)) {
          const relationKey = `${fieldName}:${otherType}`;
          if (foundRelationships.has(relationKey)) continue;

          foundRelationships.add(relationKey);
          const isArray = fieldType.includes('[]') || fieldType.includes('Array<') || fieldType.includes('Map<');
          const isOptional = fieldType.includes('| null') || fieldType.includes('| undefined');

          relationships.push({
            targetModel: otherType,
            type: isArray ? 'one-to-many' : 'one-to-one',
            fieldName,
            description: `${isArray ? 'Collection' : 'Reference'} to ${otherType}${isOptional ? ' (optional)' : ''}`,
          });
        }
      }
    }

    return relationships;
  }

  /**
   * Find relationships between types (legacy wrapper)
   */
  private findRelationships(typeName: string, fieldsContent: string, files: ScannedFile[]): DataModel['relationships'] {
    return this.findRelationshipsEnhanced(typeName, fieldsContent, null, files);
  }

  /**
   * Generate OpenAPI/Swagger documentation for all API routes
   */
  private async generateOpenAPIDocumentation(files: ScannedFile[]): Promise<APIDocumentation> {
    const apiFiles = files.filter(f => f.type === 'api');
    const endpoints: APIEndpoint[] = [];

    console.log(`🔍 Processing ${apiFiles.length} API route files`);

    for (const file of apiFiles) {
      const fileEndpoints = this.parseAPIRoute(file);
      endpoints.push(...fileEndpoints);
    }

    // Generate OpenAPI tags based on route paths
    const tags = this.generateAPITags(endpoints);

    // Generate schemas from data models
    const schemas: Record<string, any> = {};

    return {
      title: `${this.projectName} API`,
      version: '1.0.0',
      description: `OpenAPI 3.0 documentation for ${this.projectName}`,
      baseUrl: '/api',
      endpoints,
      tags,
      schemas,
      lastGenerated: new Date(),
    };
  }

  /**
   * Parse an API route file and extract endpoint information with rich schemas
   */
  private parseAPIRoute(file: ScannedFile): APIEndpoint[] {
    const endpoints: APIEndpoint[] = [];
    const content = file.content;

    // Convert file path to API path
    const apiPath = '/api/' + file.path
      .replace(/^app[\\/]api[\\/]/, '')
      .replace(/[\\/]route\.ts$/, '')
      .replace(/\[([^\]]+)\]/g, '{$1}')
      .replace(/\\/g, '/');

    // Find HTTP methods (support both async and regular functions)
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

    for (const method of methods) {
      const methodPattern = new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\(`);
      if (!methodPattern.test(content)) continue;

      // Extract function body for this method (improved regex)
      const funcStartMatch = content.match(new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\s*\\([^)]*\\)[^{]*\\{`));
      let funcBody = '';

      if (funcStartMatch) {
        const startIndex = funcStartMatch.index! + funcStartMatch[0].length;
        funcBody = this.extractBraceContent(content, startIndex) || '';
      }

      // Extract parameters from path
      const pathParams: APIEndpoint['parameters'] = [];
      const pathParamMatches = apiPath.matchAll(/\{(\w+)\}/g);
      for (const match of pathParamMatches) {
        pathParams.push({
          name: match[1],
          in: 'path',
          type: 'string',
          required: true,
          description: `Path parameter: ${match[1]}`,
        });
      }

      // Extract query parameters from code (multiple patterns)
      const queryPatterns = [
        /(?:searchParams|url\.searchParams)\.get\(['"](\w+)['"]\)/g,
        /request\.nextUrl\.searchParams\.get\(['"](\w+)['"]\)/g,
        /params\.get\(['"](\w+)['"]\)/g,
      ];

      const foundQueryParams = new Set<string>();
      for (const pattern of queryPatterns) {
        const matches = funcBody.matchAll(pattern);
        for (const match of matches) {
          if (!foundQueryParams.has(match[1])) {
            foundQueryParams.add(match[1]);
            pathParams.push({
              name: match[1],
              in: 'query',
              type: 'string',
              required: false,
              description: `Query parameter: ${match[1]}`,
            });
          }
        }
      }

      // Extract request body from code with better schema detection
      let requestBody: APIEndpoint['requestBody'] = undefined;
      if (funcBody.includes('request.json()') || funcBody.includes('await request.json')) {
        const bodyFields: { name: string; type: string; required: boolean }[] = [];

        // Pattern 1: const { field1, field2 } = await request.json()
        const destructureMatch = funcBody.match(/const\s*\{([^}]+)\}\s*=\s*(?:await\s+)?(?:body|request\.json\(\)|data)/);
        if (destructureMatch) {
          const fields = destructureMatch[1].split(',').map(f => {
            const trimmed = f.trim();
            const nameMatch = trimmed.match(/^(\w+)/);
            return nameMatch ? nameMatch[1] : null;
          }).filter(Boolean) as string[];

          for (const field of fields) {
            bodyFields.push({ name: field, type: 'string', required: true });
          }
        }

        // Pattern 2: body.fieldName or data.fieldName
        const bodyAccessMatches = funcBody.matchAll(/(?:body|data)\.(\w+)/g);
        for (const match of bodyAccessMatches) {
          if (!bodyFields.find(f => f.name === match[1])) {
            bodyFields.push({ name: match[1], type: 'any', required: false });
          }
        }

        // Try to find a TypeScript type for the body
        const bodyTypeMatch = content.match(/interface\s+(\w*Body\w*|\w*Request\w*|\w*Input\w*)\s*\{([^}]+)\}/);
        if (bodyTypeMatch) {
          const typeFields = this.parseTypeFieldsEnhanced(bodyTypeMatch[2]);
          for (const field of typeFields) {
            const existing = bodyFields.find(f => f.name === field.name);
            if (existing) {
              existing.type = field.type;
              existing.required = field.required;
            } else {
              bodyFields.push({ name: field.name, type: field.type, required: field.required });
            }
          }
        }

        const schema: Record<string, any> = {
          type: 'object',
          properties: bodyFields.reduce((acc, f) => ({
            ...acc,
            [f.name]: { type: f.type === 'string' ? 'string' : f.type === 'number' ? 'number' : f.type === 'boolean' ? 'boolean' : 'any' }
          }), {}),
          required: bodyFields.filter(f => f.required).map(f => f.name),
        };

        requestBody = {
          description: bodyFields.length > 0 ? `Request body with fields: ${bodyFields.map(f => f.name).join(', ')}` : 'JSON request body',
          required: true,
          contentType: 'application/json',
          schema,
          example: bodyFields.reduce((acc, f) => ({
            ...acc,
            [f.name]: f.type === 'string' ? `example_${f.name}` :
                      f.type === 'number' ? 0 :
                      f.type === 'boolean' ? true :
                      f.type === 'array' ? [] : null
          }), {}),
        };
      }

      // Extract responses with better schema detection
      const responses: APIEndpoint['responses'] = [];
      const foundStatusCodes = new Set<number>();

      // Look for NextResponse.json calls with status detection
      const responsePattern = /NextResponse\.json\s*\(\s*(\{[^}]*\}|\w+)\s*(?:,\s*\{\s*status:\s*(\d+)\s*\})?\s*\)/g;
      let responseMatch;

      while ((responseMatch = responsePattern.exec(funcBody)) !== null) {
        const responseContent = responseMatch[1];
        let statusCode = responseMatch[2] ? parseInt(responseMatch[2]) : 200;

        // Check surrounding context for error handling
        const surroundingStart = Math.max(0, responseMatch.index - 150);
        const surroundingContext = funcBody.slice(surroundingStart, responseMatch.index);

        if (surroundingContext.includes('catch') || surroundingContext.includes('error') || surroundingContext.includes('Error')) {
          if (statusCode === 200) statusCode = 500;
        }
        if (surroundingContext.includes('!') || surroundingContext.includes('not found') || surroundingContext.includes('notFound')) {
          if (statusCode === 200) statusCode = 404;
        }

        if (foundStatusCodes.has(statusCode)) continue;
        foundStatusCodes.add(statusCode);

        // Try to parse the response object
        let example: Record<string, any> = {};
        let description = statusCode < 300 ? 'Success' : statusCode < 500 ? `Client Error (${statusCode})` : `Server Error (${statusCode})`;

        // Extract fields from response object
        const responseFieldMatches = responseContent.matchAll(/(\w+):\s*([^,}]+)/g);
        for (const fieldMatch of responseFieldMatches) {
          const fieldName = fieldMatch[1];
          const fieldValue = fieldMatch[2].trim();

          // Generate example value
          if (fieldValue.match(/^['"].*['"]$/)) {
            example[fieldName] = fieldValue.replace(/['"]/g, '');
          } else if (fieldValue === 'true' || fieldValue === 'false') {
            example[fieldName] = fieldValue === 'true';
          } else if (fieldValue.match(/^\d+$/)) {
            example[fieldName] = parseInt(fieldValue);
          } else {
            example[fieldName] = `<${fieldName}>`;
          }

          // Improve description based on content
          if (fieldName === 'error' || fieldName === 'message') {
            description = statusCode < 300 ? 'Success' : `Error: ${example[fieldName]}`;
          }
        }

        responses.push({
          statusCode,
          description,
          example: Object.keys(example).length > 0 ? example : { success: statusCode < 300 },
        });
      }

      // Ensure we have at least success and error responses
      if (!responses.find(r => r.statusCode === 200)) {
        responses.unshift({ statusCode: 200, description: 'Success', example: { success: true } });
      }
      if (!responses.find(r => r.statusCode >= 400)) {
        responses.push({ statusCode: 500, description: 'Internal Server Error', example: { error: 'An error occurred' } });
      }

      // Sort responses by status code
      responses.sort((a, b) => a.statusCode - b.statusCode);

      // Extract summary from JSDoc comment (improved pattern)
      let summary = '';
      let description = '';

      const jsdocPattern = new RegExp(`\\/\\*\\*\\s*\\n([\\s\\S]*?)\\*\\/\\s*(?:export\\s+)?(?:async\\s+)?function\\s+${method}`);
      const jsdocMatch = content.match(jsdocPattern);

      if (jsdocMatch) {
        const jsdocContent = jsdocMatch[1];
        const lines = jsdocContent.split('\n').map(l => l.replace(/^\s*\*\s?/, '').trim()).filter(l => l && !l.startsWith('@'));
        summary = lines[0] || '';
        description = lines.slice(1).join(' ').trim();
      }

      // Fallback: Generate meaningful summary from path
      if (!summary) {
        const pathWords = apiPath.split('/').filter(p => p && p !== 'api' && !p.startsWith('{'));
        const resource = pathWords[pathWords.length - 1] || 'resource';
        const actionMap: Record<string, string> = {
          GET: `Get ${resource}`,
          POST: `Create ${resource}`,
          PUT: `Update ${resource}`,
          PATCH: `Partially update ${resource}`,
          DELETE: `Delete ${resource}`,
        };
        summary = actionMap[method] || `${method} ${apiPath}`;
        description = `API endpoint: ${method} ${apiPath}`;
      }

      // Extract tags from path
      const tags: string[] = [];
      const pathParts = apiPath.split('/').filter(p => p && p !== 'api' && !p.startsWith('{'));
      if (pathParts.length > 0) tags.push(pathParts[0]);

      endpoints.push({
        id: `endpoint-${Date.now()}-${endpoints.length}-${Math.random().toString(36).slice(2, 9)}`,
        path: apiPath,
        method: method as APIEndpoint['method'],
        summary,
        description,
        tags,
        parameters: pathParams,
        requestBody,
        responses,
      });
    }

    return endpoints;
  }

  /**
   * Generate API tags from endpoints
   */
  private generateAPITags(endpoints: APIEndpoint[]): { name: string; description: string }[] {
    const tagSet = new Set<string>();
    endpoints.forEach(ep => ep.tags?.forEach(t => tagSet.add(t)));

    return Array.from(tagSet).map(name => ({
      name,
      description: `API endpoints for ${name}`,
    }));
  }

  /**
   * Document AI agents from service files with comprehensive code-based extraction
   */
  private async documentAgents(files: ScannedFile[]): Promise<AgentDocumentation[]> {
    const agents: AgentDocumentation[] = [];

    // Find agent-related files
    const agentFiles = files.filter(f =>
      f.path.includes('agent') ||
      f.path.includes('multi-agent') ||
      f.path.includes('orchestrat') ||
      (f.type === 'service' && (f.content.includes('agent') || f.content.includes('Agent')))
    );

    console.log(`🤖 Found ${agentFiles.length} agent-related files`);

    // First try to extract agents from code patterns
    const codeExtractedAgents = this.extractAgentsFromCode(files, agentFiles);

    if (codeExtractedAgents.length > 0) {
      agents.push(...codeExtractedAgents);
      console.log(`📝 Extracted ${codeExtractedAgents.length} agents from code patterns`);
    }

    // If we found some agents but want more detail, optionally use Claude
    // Only use Claude if we have agent files but couldn't extract much from patterns
    if (agentFiles.length > 0 && codeExtractedAgents.length < 2) {
      try {
        const aiExtractedAgents = await this.extractAgentsWithAI(agentFiles);
        // Merge with code-extracted, avoiding duplicates
        for (const aiAgent of aiExtractedAgents) {
          if (!agents.find(a => a.name.toLowerCase() === aiAgent.name.toLowerCase())) {
            agents.push(aiAgent);
          }
        }
      } catch (err) {
        console.warn('⚠️ AI agent analysis failed, using code-extracted agents');
      }
    }

    // If still no agents, return defaults
    return agents.length > 0 ? agents : this.getDefaultAgentDocs(files);
  }

  /**
   * Extract agent information directly from code patterns
   */
  private extractAgentsFromCode(files: ScannedFile[], agentFiles: ScannedFile[]): AgentDocumentation[] {
    const agents: AgentDocumentation[] = [];
    const processedNames = new Set<string>();

    for (const file of agentFiles) {
      const content = file.content;

      // Pattern 1: Agent role definitions (common in multi-agent systems)
      // e.g., { role: 'supervisor', name: 'Supervisor Agent', ... }
      const rolePattern = /(?:role|type)\s*:\s*['"](\w+)['"]\s*,\s*name\s*:\s*['"]([^'"]+)['"]/g;
      let match;

      while ((match = rolePattern.exec(content)) !== null) {
        const [, role, name] = match;
        if (processedNames.has(name.toLowerCase())) continue;
        processedNames.add(name.toLowerCase());

        // Try to extract more details from surrounding context
        const contextStart = Math.max(0, match.index - 200);
        const contextEnd = Math.min(content.length, match.index + 1000);
        const context = content.slice(contextStart, contextEnd);

        agents.push(this.parseAgentFromContext(name, role, context, file.path));
      }

      // Pattern 2: Agent class definitions
      const classPattern = /class\s+(\w*Agent\w*)\s*(?:extends|implements)?[^{]*\{/g;

      while ((match = classPattern.exec(content)) !== null) {
        const className = match[1];
        if (processedNames.has(className.toLowerCase())) continue;
        processedNames.add(className.toLowerCase());

        const classStart = match.index;
        const classBody = this.extractBraceContent(content, classStart + match[0].length);

        if (classBody) {
          agents.push(this.parseAgentFromClass(className, classBody, file.path));
        }
      }

      // Pattern 3: Agent configuration objects
      const configPattern = /(?:const|let|var)\s+(\w*[Aa]gent\w*)\s*(?::\s*\w+)?\s*=\s*\{/g;

      while ((match = configPattern.exec(content)) !== null) {
        const configName = match[1];
        if (processedNames.has(configName.toLowerCase())) continue;

        const configStart = match.index + match[0].length;
        const configBody = this.extractBraceContent(content, configStart);

        if (configBody && (configBody.includes('prompt') || configBody.includes('role') || configBody.includes('tool'))) {
          processedNames.add(configName.toLowerCase());
          agents.push(this.parseAgentFromConfig(configName, configBody, file.path));
        }
      }

      // Pattern 4: AGENT_ROLES or similar constant definitions
      const rolesArrayPattern = /(?:AGENT_ROLES|agentRoles|AGENTS)\s*(?::\s*[^=]+)?\s*=\s*\[/g;

      while ((match = rolesArrayPattern.exec(content)) !== null) {
        const arrayStart = match.index + match[0].length - 1; // Include the [
        const arrayContent = this.extractArrayContent(content, arrayStart);

        if (arrayContent) {
          const roleObjects = this.parseRoleArray(arrayContent);
          for (const roleObj of roleObjects) {
            if (!processedNames.has(roleObj.name.toLowerCase())) {
              processedNames.add(roleObj.name.toLowerCase());
              agents.push(roleObj);
            }
          }
        }
      }
    }

    return agents;
  }

  /**
   * Parse agent info from surrounding context
   */
  private parseAgentFromContext(name: string, role: string, context: string, filePath: string): AgentDocumentation {
    // Extract description
    const descMatch = context.match(/description\s*:\s*['"`]([^'"`]+)['"`]/);
    const description = descMatch ? descMatch[1] : `${name} - ${role} agent`;

    // Extract capabilities/tools
    const capabilities: string[] = [];
    const toolsMatch = context.match(/tools\s*:\s*\[([^\]]+)\]/);
    if (toolsMatch) {
      const toolNames = toolsMatch[1].match(/['"]([^'"]+)['"]/g);
      if (toolNames) {
        capabilities.push(...toolNames.map(t => t.replace(/['"]/g, '')));
      }
    }

    // Extract responsibilities from prompt or description
    const responsibilities: string[] = [];
    const promptMatch = context.match(/(?:system|prompt)\s*:\s*['"`]([^'"`]+)['"`]/);
    if (promptMatch) {
      const promptText = promptMatch[1];
      // Extract key phrases as responsibilities
      const phrases = promptText.match(/(?:responsible for|handle|manage|create|analyze|review|test|deploy|monitor)\s+[^.]+/gi);
      if (phrases) {
        responsibilities.push(...phrases.slice(0, 5).map(p => p.trim()));
      }
    }

    return {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      type: this.normalizeAgentType(role),
      description,
      responsibilities: responsibilities.length > 0 ? responsibilities : [
        `Handle ${role} tasks`,
        `Coordinate with other agents`,
      ],
      capabilities: capabilities.length > 0 ? capabilities : [role],
      tools: capabilities.map(c => ({ name: c, description: `${c} capability`, parameters: [] })),
      inputs: [{ name: 'task', type: 'string', description: 'Task to perform', required: true }],
      outputs: [{ name: 'result', type: 'object', description: 'Task result' }],
      interactions: [],
      limitations: [],
      bestPractices: [],
      examples: [],
    };
  }

  /**
   * Parse agent info from class definition
   */
  private parseAgentFromClass(className: string, classBody: string, filePath: string): AgentDocumentation {
    // Extract methods as capabilities
    const methodMatches = classBody.matchAll(/(?:async\s+)?(\w+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/g);
    const methods: string[] = [];
    for (const match of methodMatches) {
      if (!['constructor', 'toString', 'valueOf'].includes(match[1])) {
        methods.push(match[1]);
      }
    }

    // Extract properties
    const propMatches = classBody.matchAll(/(?:private|public|protected)?\s*(\w+)\s*(?::\s*([^;=]+))?/g);
    const properties: string[] = [];
    for (const match of propMatches) {
      if (match[1] && !match[1].startsWith('_')) {
        properties.push(match[1]);
      }
    }

    // Infer type from class name
    const type = this.inferAgentTypeFromName(className);

    return {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name: className.replace(/Agent$/, ' Agent').replace(/([a-z])([A-Z])/g, '$1 $2'),
      type,
      description: `${className} implementation`,
      responsibilities: methods.slice(0, 5).map(m => `${m.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}`),
      capabilities: methods.slice(0, 8),
      tools: methods.slice(0, 5).map(m => ({ name: m, description: `Method: ${m}`, parameters: [] })),
      inputs: [{ name: 'context', type: 'object', description: 'Execution context', required: true }],
      outputs: [{ name: 'result', type: 'any', description: 'Execution result' }],
      interactions: [],
      limitations: [],
      bestPractices: [],
      examples: [],
    };
  }

  /**
   * Parse agent info from config object
   */
  private parseAgentFromConfig(configName: string, configBody: string, filePath: string): AgentDocumentation {
    // Extract name
    const nameMatch = configBody.match(/name\s*:\s*['"]([^'"]+)['"]/);
    const name = nameMatch ? nameMatch[1] : configName;

    // Extract type/role
    const typeMatch = configBody.match(/(?:type|role)\s*:\s*['"]([^'"]+)['"]/);
    const type = typeMatch ? this.normalizeAgentType(typeMatch[1]) : 'agent';

    // Extract description
    const descMatch = configBody.match(/description\s*:\s*['"]([^'"]+)['"]/);
    const description = descMatch ? descMatch[1] : `Configuration for ${name}`;

    return {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      name,
      type,
      description,
      responsibilities: [`Handle ${type} operations`],
      capabilities: [type],
      tools: [],
      inputs: [{ name: 'config', type: 'object', description: 'Agent configuration', required: true }],
      outputs: [{ name: 'status', type: 'object', description: 'Agent status' }],
      interactions: [],
      limitations: [],
      bestPractices: [],
      examples: [],
    };
  }

  /**
   * Extract array content including nested structures
   */
  private extractArrayContent(content: string, startIndex: number): string | null {
    let depth = 1;
    let i = startIndex + 1; // Start after the [

    while (i < content.length && depth > 0) {
      const char = content[i];
      if (char === '[') depth++;
      else if (char === ']') depth--;
      i++;
    }

    if (depth === 0) {
      return content.substring(startIndex + 1, i - 1);
    }
    return null;
  }

  /**
   * Parse array of agent role objects
   */
  private parseRoleArray(arrayContent: string): AgentDocumentation[] {
    const agents: AgentDocumentation[] = [];

    // Match object literals in the array
    const objectPattern = /\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/g;
    let match;

    while ((match = objectPattern.exec(arrayContent)) !== null) {
      const objContent = match[1];

      const nameMatch = objContent.match(/name\s*:\s*['"]([^'"]+)['"]/);
      const typeMatch = objContent.match(/(?:type|role)\s*:\s*['"]([^'"]+)['"]/);
      const descMatch = objContent.match(/description\s*:\s*['"]([^'"]+)['"]/);

      if (nameMatch || typeMatch) {
        agents.push({
          id: `agent-${Date.now()}-${agents.length}-${Math.random().toString(36).slice(2, 9)}`,
          name: nameMatch ? nameMatch[1] : typeMatch![1],
          type: typeMatch ? this.normalizeAgentType(typeMatch[1]) : 'agent',
          description: descMatch ? descMatch[1] : `Agent: ${nameMatch?.[1] || typeMatch?.[1]}`,
          responsibilities: [],
          capabilities: [],
          tools: [],
          inputs: [],
          outputs: [],
          interactions: [],
          limitations: [],
          bestPractices: [],
          examples: [],
        });
      }
    }

    return agents;
  }

  /**
   * Normalize agent type string
   */
  private normalizeAgentType(type: string): string {
    const normalized = type.toLowerCase().replace(/[-_\s]/g, '');

    const typeMap: Record<string, string> = {
      supervisor: 'supervisor',
      orchestrator: 'supervisor',
      coordinator: 'supervisor',
      researcher: 'research',
      research: 'research',
      analyst: 'research',
      productowner: 'product_owner',
      product: 'product_owner',
      pm: 'product_owner',
      coder: 'coder',
      developer: 'coder',
      programmer: 'coder',
      engineer: 'coder',
      tester: 'tester',
      qa: 'tester',
      test: 'tester',
      security: 'security',
      securityanalyst: 'security',
      infrastructure: 'infrastructure',
      devops: 'infrastructure',
      deploy: 'infrastructure',
      architecture: 'architecture',
      architect: 'architecture',
      design: 'architecture',
    };

    return typeMap[normalized] || type;
  }

  /**
   * Infer agent type from class/function name
   */
  private inferAgentTypeFromName(name: string): string {
    const lowerName = name.toLowerCase();

    if (lowerName.includes('supervis') || lowerName.includes('orchestrat') || lowerName.includes('coordinat')) {
      return 'supervisor';
    }
    if (lowerName.includes('research') || lowerName.includes('analys')) {
      return 'research';
    }
    if (lowerName.includes('product') || lowerName.includes('owner')) {
      return 'product_owner';
    }
    if (lowerName.includes('code') || lowerName.includes('develop') || lowerName.includes('implement')) {
      return 'coder';
    }
    if (lowerName.includes('test') || lowerName.includes('qa')) {
      return 'tester';
    }
    if (lowerName.includes('secur')) {
      return 'security';
    }
    if (lowerName.includes('infra') || lowerName.includes('devops') || lowerName.includes('deploy')) {
      return 'infrastructure';
    }
    if (lowerName.includes('architect') || lowerName.includes('design')) {
      return 'architecture';
    }

    return 'agent';
  }

  /**
   * Use Claude AI to extract agent documentation (fallback)
   */
  private async extractAgentsWithAI(agentFiles: ScannedFile[]): Promise<AgentDocumentation[]> {
    const agentContent = agentFiles.map(f => `// File: ${f.path}\n${f.content.slice(0, 3000)}`).join('\n\n');

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `Analyze this codebase and document all AI agents found. Look for agent types, their roles, tools, and interactions.

${agentContent.slice(0, 15000)}

Return ONLY valid JSON array with this structure (no markdown, no explanation):
[{
  "name": "AgentName",
  "type": "supervisor|research|product_owner|coder|tester|security|infrastructure|architecture",
  "description": "What this agent does",
  "responsibilities": ["resp1", "resp2"],
  "capabilities": ["cap1", "cap2"],
  "tools": [{"name": "toolName", "description": "...", "parameters": []}],
  "inputs": [{"name": "input", "type": "string", "description": "...", "required": true}],
  "outputs": [{"name": "output", "type": "string", "description": "..."}],
  "interactions": [{"withAgent": "OtherAgent", "type": "triggers|receives_from|coordinates_with", "description": "..."}],
  "limitations": ["limit1"],
  "bestPractices": ["practice1"]
}]`
      }]
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((a: Partial<AgentDocumentation>, i: number) => ({
        id: `agent-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`,
        ...a,
      }));
    }

    return [];
  }

  /**
   * Get default agent documentation when no agents are found
   */
  private getDefaultAgentDocs(files: ScannedFile[]): AgentDocumentation[] {
    // Check if this looks like a multi-agent project
    const hasAgentPatterns = files.some(f =>
      f.content.includes('agent') ||
      f.content.includes('orchestrat') ||
      f.content.includes('workflow')
    );

    if (!hasAgentPatterns) {
      return []; // No agents in this project
    }

    return [
      {
        id: 'agent-supervisor',
        name: 'Supervisor Agent',
        type: 'supervisor',
        description: 'Orchestrates the overall development workflow and coordinates other agents',
        responsibilities: ['Workflow orchestration', 'Quality assurance', 'Agent coordination', 'Error recovery'],
        capabilities: ['Start/stop agents', 'Monitor progress', 'Handle escalations'],
        tools: [],
        inputs: [{ name: 'requirements', type: 'string', description: 'Project requirements', required: true }],
        outputs: [{ name: 'status', type: 'WorkflowStatus', description: 'Current workflow status' }],
        interactions: [{ withAgent: 'All agents', type: 'coordinates_with', description: 'Coordinates all agent activities' }],
        limitations: [],
        bestPractices: [],
        examples: [],
      },
      {
        id: 'agent-coder',
        name: 'Coder Agent',
        type: 'coder',
        description: 'Implements features and writes code based on specifications',
        responsibilities: ['Code implementation', 'Bug fixes', 'Code refactoring', 'Following best practices'],
        capabilities: ['Write code', 'Read files', 'Execute commands', 'Run tests'],
        tools: [{ name: 'write_file', description: 'Write content to a file', parameters: [] }],
        inputs: [{ name: 'task', type: 'string', description: 'Coding task specification', required: true }],
        outputs: [{ name: 'code', type: 'string', description: 'Generated code' }],
        interactions: [{ withAgent: 'Supervisor', type: 'receives_from', description: 'Receives tasks from supervisor' }],
        limitations: [],
        bestPractices: [],
        examples: [],
      },
      {
        id: 'agent-tester',
        name: 'Tester Agent',
        type: 'tester',
        description: 'Creates and runs tests to ensure code quality',
        responsibilities: ['Write unit tests', 'Write integration tests', 'Run test suites', 'Report test results'],
        capabilities: ['Create test files', 'Execute tests', 'Analyze coverage'],
        tools: [],
        inputs: [{ name: 'code', type: 'string', description: 'Code to test', required: true }],
        outputs: [{ name: 'testResults', type: 'object', description: 'Test execution results' }],
        interactions: [{ withAgent: 'Coder', type: 'receives_from', description: 'Receives code to test' }],
        limitations: [],
        bestPractices: [],
        examples: [],
      },
    ];
  }

  /**
   * Generate all architecture diagrams based on actual project data
   */
  private async generateAllDiagrams(
    components: ComponentDoc[],
    dataModels: DataModel[],
    apiDocs: APIDocumentation,
    agents: AgentDocumentation[]
  ): Promise<ArchitectureDiagram[]> {
    const diagrams: ArchitectureDiagram[] = [];

    // System Overview
    diagrams.push(this.generateSystemOverviewDiagram(components, apiDocs, agents));
    this.updateProgress('Diagram Generation', 15);

    // Component Hierarchy
    diagrams.push(this.generateComponentDiagram(components));
    this.updateProgress('Diagram Generation', 30);

    // API Routes Diagram
    diagrams.push(this.generateAPIDiagram(apiDocs));
    this.updateProgress('Diagram Generation', 45);

    // Entity Relationship Diagram
    if (dataModels.length > 0) {
      diagrams.push(this.generateERDiagram(dataModels));
    }
    this.updateProgress('Diagram Generation', 60);

    // State Management Diagram - Shows context providers, stores, hooks
    const stores = components.filter(c => c.type === 'store');
    const hooks = components.filter(c => c.type === 'hook' && (
      c.name.toLowerCase().includes('state') ||
      c.name.toLowerCase().includes('context') ||
      c.name.toLowerCase().includes('store')
    ));
    if (stores.length > 0 || hooks.length > 0) {
      diagrams.push(this.generateStateManagementDiagram(components));
    }
    this.updateProgress('Diagram Generation', 75);

    // Route Structure Diagram - Shows Next.js/React page routes
    const pages = components.filter(c => c.type === 'page' || c.type === 'layout');
    if (pages.length > 0) {
      diagrams.push(this.generateRouteStructureDiagram(components));
    }
    this.updateProgress('Diagram Generation', 90);

    // Agent Workflow Diagram
    if (agents.length > 0) {
      diagrams.push(this.generateAgentDiagram(agents));
    }

    return diagrams;
  }

  /**
   * Generate system overview diagram from actual components
   */
  private generateSystemOverviewDiagram(
    components: ComponentDoc[],
    apiDocs: APIDocumentation,
    agents: AgentDocumentation[]
  ): ArchitectureDiagram {
    const pages = components.filter(c => c.type === 'page').slice(0, 5);
    const stores = components.filter(c => c.type === 'store').slice(0, 5);
    const services = components.filter(c => c.type === 'service').slice(0, 5);
    const apiTags = apiDocs.tags.slice(0, 5);

    const mermaidCode = `graph TB
    subgraph Client["🖥️ Client Layer"]
        ${pages.map(p => `${this.sanitizeName(p.name)}["${p.name}"]`).join('\n        ') || 'Pages["Pages"]'}
    end

    subgraph State["📦 State Management"]
        ${stores.map(s => `${this.sanitizeName(s.name)}["${s.name}"]`).join('\n        ') || 'Store["Zustand Store"]'}
    end

    subgraph API["🔌 API Layer (${apiDocs.endpoints.length} endpoints)"]
        ${apiTags.map(t => `API_${this.sanitizeName(t.name)}["/${t.name}/*"]`).join('\n        ') || 'Routes["API Routes"]'}
    end

    subgraph Services["⚙️ Services"]
        ${services.map(s => `${this.sanitizeName(s.name)}["${s.name}"]`).join('\n        ') || 'Svc["Services"]'}
    end

    ${agents.length > 0 ? `subgraph Agents["🤖 AI Agents"]
        ${agents.slice(0, 5).map(a => `${this.sanitizeName(a.name)}["${a.name}"]`).join('\n        ')}
    end` : ''}

    Client --> State
    Client --> API
    API --> Services
    ${agents.length > 0 ? 'Services --> Agents' : ''}`;

    return {
      id: `diagram-overview-${Date.now()}`,
      name: 'System Overview',
      type: 'system-overview',
      format: 'mermaid',
      content: mermaidCode,
      description: `High-level system architecture with ${components.length} components, ${apiDocs.endpoints.length} API endpoints`,
      components: components.map(c => c.name),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Generate component diagram from actual components
   */
  private generateComponentDiagram(components: ComponentDoc[]): ArchitectureDiagram {
    const pages = components.filter(c => c.type === 'page').slice(0, 8);
    const comps = components.filter(c => c.type === 'component').slice(0, 15);
    const hooks = components.filter(c => c.type === 'hook').slice(0, 8);
    const stores = components.filter(c => c.type === 'store').slice(0, 5);

    const mermaidCode = `graph TD
    ${pages.length > 0 ? `subgraph Pages["📄 Pages (${components.filter(c => c.type === 'page').length})"]
        ${pages.map(p => `${this.sanitizeName(p.name)}["${p.name}"]`).join('\n        ')}
    end` : ''}

    ${comps.length > 0 ? `subgraph Components["🧩 Components (${components.filter(c => c.type === 'component').length})"]
        ${comps.map(c => `${this.sanitizeName(c.name)}["${c.name}"]`).join('\n        ')}
    end` : ''}

    ${hooks.length > 0 ? `subgraph Hooks["🪝 Hooks (${components.filter(c => c.type === 'hook').length})"]
        ${hooks.map(h => `${this.sanitizeName(h.name)}["${h.name}"]`).join('\n        ')}
    end` : ''}

    ${stores.length > 0 ? `subgraph Stores["📦 Stores (${components.filter(c => c.type === 'store').length})"]
        ${stores.map(s => `${this.sanitizeName(s.name)}["${s.name}"]`).join('\n        ')}
    end` : ''}

    ${pages.length > 0 && comps.length > 0 ? 'Pages --> Components' : ''}
    ${comps.length > 0 && hooks.length > 0 ? 'Components --> Hooks' : ''}
    ${hooks.length > 0 && stores.length > 0 ? 'Hooks --> Stores' : ''}`;

    return {
      id: `diagram-components-${Date.now()}`,
      name: 'Component Architecture',
      type: 'component-diagram',
      format: 'mermaid',
      content: mermaidCode,
      description: `React component hierarchy: ${components.length} total components`,
      components: components.map(c => c.name),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Generate API diagram from actual endpoints
   */
  private generateAPIDiagram(apiDocs: APIDocumentation): ArchitectureDiagram {
    const endpoints = apiDocs.endpoints.slice(0, 20);

    // Group endpoints by tag/category
    const grouped = new Map<string, APIEndpoint[]>();
    for (const ep of endpoints) {
      const tag = ep.tags?.[0] || 'other';
      if (!grouped.has(tag)) grouped.set(tag, []);
      grouped.get(tag)!.push(ep);
    }

    let mermaidCode = 'graph LR\n    Client["🖥️ Client"]\n\n';

    for (const [tag, eps] of grouped) {
      const sanitizedTag = this.sanitizeName(tag);
      mermaidCode += `    subgraph ${sanitizedTag}["📂 /${tag}"]\n`;

      for (const ep of eps.slice(0, 5)) {
        const methodColor = {
          GET: '🟢',
          POST: '🔵',
          PUT: '🟡',
          PATCH: '🟠',
          DELETE: '🔴'
        }[ep.method] || '⚪';

        const epName = this.sanitizeName(`${tag}_${ep.method}_${eps.indexOf(ep)}`);
        mermaidCode += `        ${epName}["${methodColor} ${ep.method} ${ep.path}"]\n`;
      }

      mermaidCode += '    end\n\n';
      mermaidCode += `    Client --> ${sanitizedTag}\n`;
    }

    return {
      id: `diagram-api-${Date.now()}`,
      name: 'API Routes',
      type: 'api-flow',
      format: 'mermaid',
      content: mermaidCode,
      description: `API endpoints: ${apiDocs.endpoints.length} routes across ${grouped.size} categories`,
      components: apiDocs.endpoints.map(e => e.path),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Generate ER diagram from actual data models
   */
  private generateERDiagram(dataModels: DataModel[]): ArchitectureDiagram {
    // Filter to models that have fields and valid names
    // Limited preview - full diagram generated on-demand via "Open in Mermaid Live"
    const validModels = dataModels.filter(m =>
      m.name &&
      m.fields &&
      m.fields.length > 0 &&
      /^[a-zA-Z]/.test(m.name) // Must start with letter
    ).slice(0, 8); // Preview limit - full view via Mermaid Live button

    const modelNames = new Set(validModels.map(m => this.sanitizeName(m.name)));

    let entities = '';
    let relationships = '';
    const seenRelationships = new Set<string>(); // Track unique relationships

    for (const model of validModels) {
      const sanitizedModelName = this.sanitizeName(model.name);

      // Process fields - sanitize types for Mermaid ER syntax
      // Limited for preview - full fields in Mermaid Live
      const fields = model.fields?.slice(0, 5).map(f => {
        try {
          // Mermaid ER only allows simple type names - letters, numbers, underscore
          // First, simplify common complex types
          let type = f.type || 'any';

          // Handle union types - just take the first type or simplify
          if (type.includes('|')) {
            const parts = type.split('|').map(p => p.trim());
            // If it's a string literal union like 'a' | 'b', just call it "string"
            if (parts.every(p => p.startsWith("'") || p.startsWith('"'))) {
              type = 'string';
            } else {
              // Take first non-literal type or call it "union"
              const nonLiteral = parts.find(p => !p.startsWith("'") && !p.startsWith('"'));
              type = nonLiteral || 'union';
            }
          }

          // Handle literal types like "literal 4weeks" - just use "string"
          if (type.toLowerCase().startsWith('literal')) {
            type = 'string';
          }

          // Clean up the type for Mermaid - be very aggressive about removing non-alphanumeric chars
          type = type
            .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]+/g, '') // Remove ALL whitespace including unicode
            .replace(/[^a-zA-Z0-9_]/g, '_') // Replace any non-alphanumeric with underscore
            .replace(/_+/g, '_') // Collapse multiple underscores
            .replace(/^_|_$/g, '') // Remove leading/trailing underscores
            .substring(0, 15); // Limit length

          // Ensure type starts with letter and has no spaces
          if (!type || !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(type)) {
            type = 'any';
          }

          // Ensure field name is valid - also check for spaces
          let fieldName = (f.name || 'field')
            .replace(/[\s\u00A0\u2000-\u200B\u202F\u205F\u3000]+/g, '_') // Remove ALL whitespace
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_|_$/g, '')
            .substring(0, 20);

          if (!fieldName || !/^[a-zA-Z]/.test(fieldName)) {
            fieldName = 'field';
          }

          return `        ${type} ${fieldName}`;
        } catch {
          return null; // Skip malformed fields
        }
      }).filter(f => f && f.trim()).join('\n');

      if (fields) {
        entities += `    ${sanitizedModelName} {\n${fields}\n    }\n`;
      }

      // Add relationships only to models that exist in our set
      for (const rel of (model.relationships || []).slice(0, 4)) {
        const targetName = this.sanitizeName(rel.targetModel);

        // Only add relationship if target model exists in our diagram
        if (modelNames.has(targetName) && targetName !== sanitizedModelName) {
          // Create unique key to prevent duplicate relationships
          const relKey = [sanitizedModelName, targetName].sort().join('_');
          if (seenRelationships.has(relKey)) continue;
          seenRelationships.add(relKey);

          const relType = rel.type === 'one-to-many' ? '||--o{' : '||--||';
          const fieldLabel = (rel.fieldName || 'ref').replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 15) || 'ref';
          relationships += `    ${sanitizedModelName} ${relType} ${targetName} : "${fieldLabel}"\n`;
        }
      }
    }

    // If no valid entities, create a placeholder
    if (!entities.trim()) {
      entities = '    NoModels {\n        string info\n    }\n';
    }

    // Build final Mermaid code with validation
    let mermaidCode = `erDiagram\n${entities}${relationships}`;

    // Validate: ensure we have at least one entity
    if (!entities.trim() || entities.includes('NoModels')) {
      // Simple fallback diagram that always renders
      mermaidCode = `erDiagram
    DataModel {
        string id
        string name
    }`;
    }

    // Clean up any problematic whitespace/newlines
    mermaidCode = mermaidCode
      .split('\n')
      .filter(line => line.trim()) // Remove empty lines
      .join('\n');

    console.log(`[Architecture] Generated ER diagram with ${validModels.length} models, code length: ${mermaidCode.length}`);
    console.log(`[Architecture] ER diagram preview: ${mermaidCode.substring(0, 200)}...`);

    return {
      id: `diagram-er-${Date.now()}`,
      name: 'Data Models',
      type: 'entity-relationship',
      format: 'mermaid',
      content: mermaidCode,
      description: `Entity relationship diagram preview: ${validModels.length} of ${dataModels.length} models (Open in Mermaid for full view)`,
      components: dataModels.map(m => m.name),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Generate agent interaction diagram
   */
  private generateAgentDiagram(agents: AgentDocumentation[]): ArchitectureDiagram {
    const mermaidCode = `flowchart TB
    ${agents.map(a => `${this.sanitizeName(a.name)}[["🤖 ${a.name}"]]`).join('\n    ')}

    ${agents.flatMap(a =>
      (a.interactions || []).map(i => {
        const targetName = this.sanitizeName(i.withAgent);
        const sourceName = this.sanitizeName(a.name);
        const arrow = i.type === 'triggers' ? '-->' : i.type === 'receives_from' ? '<--' : '<-->';
        return `${sourceName} ${arrow}|${i.type}| ${targetName}`;
      })
    ).slice(0, 15).join('\n    ')}`;

    return {
      id: `diagram-agents-${Date.now()}`,
      name: 'Agent Workflow',
      type: 'sequence-diagram',
      format: 'mermaid',
      content: mermaidCode,
      description: `AI agent interactions: ${agents.length} agents`,
      components: agents.map(a => a.name),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Generate state management diagram showing stores, context, and hooks
   */
  private generateStateManagementDiagram(components: ComponentDoc[]): ArchitectureDiagram {
    const stores = components.filter(c => c.type === 'store').slice(0, 10);
    const contextHooks = components.filter(c =>
      c.type === 'hook' && (
        c.name.toLowerCase().includes('context') ||
        c.name.toLowerCase().includes('state') ||
        c.name.toLowerCase().includes('store') ||
        c.name.toLowerCase().includes('provider')
      )
    ).slice(0, 10);
    const providers = components.filter(c =>
      c.name.toLowerCase().includes('provider') ||
      c.name.toLowerCase().includes('context')
    ).slice(0, 8);

    let mermaidCode = `flowchart TD
    subgraph GlobalState["🗄️ Global State"]
        ${stores.length > 0 ? stores.map(s => `${this.sanitizeName(s.name)}[["📦 ${s.name}"]]`).join('\n        ') : 'NoStore["No Global Store"]'}
    end

    subgraph ContextProviders["🔄 Context Providers"]
        ${providers.length > 0 ? providers.map(p => `${this.sanitizeName(p.name)}["🏠 ${p.name}"]`).join('\n        ') : 'NoProvider["No Providers"]'}
    end

    subgraph StateHooks["🪝 State Hooks"]
        ${contextHooks.length > 0 ? contextHooks.map(h => `${this.sanitizeName(h.name)}["⚡ ${h.name}"]`).join('\n        ') : 'NoHooks["No State Hooks"]'}
    end

    subgraph Components["🧩 Components"]
        ConsumingComponents["Components consume state"]
    end

    GlobalState --> ContextProviders
    ContextProviders --> StateHooks
    StateHooks --> Components`;

    return {
      id: `diagram-state-${Date.now()}`,
      name: 'State Management',
      type: 'state-management',
      format: 'mermaid',
      content: mermaidCode,
      description: `State management: ${stores.length} stores, ${contextHooks.length} state hooks`,
      components: [...stores, ...contextHooks, ...providers].map(c => c.name),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Generate route structure diagram for Next.js/React pages
   */
  private generateRouteStructureDiagram(components: ComponentDoc[]): ArchitectureDiagram {
    const pages = components.filter(c => c.type === 'page').slice(0, 15);
    const layouts = components.filter(c => c.type === 'layout').slice(0, 5);

    // Group pages by route segment
    const routeGroups = new Map<string, ComponentDoc[]>();
    for (const page of pages) {
      // Extract route from file path or name
      const pagePath = page.path || page.name;
      const segments = pagePath.split('/').filter(Boolean);
      const routeGroup = segments.length > 1 ? segments[segments.length - 2] : 'root';
      if (!routeGroups.has(routeGroup)) routeGroups.set(routeGroup, []);
      routeGroups.get(routeGroup)!.push(page);
    }

    let mermaidCode = `flowchart TB
    Root["🏠 /"]

    ${layouts.length > 0 ? `subgraph Layouts["📐 Layouts"]
        ${layouts.map(l => `${this.sanitizeName(l.name)}["${l.name}"]`).join('\n        ')}
    end

    Root --> Layouts` : ''}

    ${Array.from(routeGroups.entries()).map(([group, groupPages]) => {
      const sanitizedGroup = this.sanitizeName(group);
      return `subgraph Route_${sanitizedGroup}["📁 /${group}"]
        ${groupPages.map(p => `${this.sanitizeName(p.name)}["📄 ${p.name}"]`).join('\n        ')}
    end
    ${layouts.length > 0 ? `Layouts --> Route_${sanitizedGroup}` : `Root --> Route_${sanitizedGroup}`}`;
    }).join('\n\n    ')}`;

    return {
      id: `diagram-routes-${Date.now()}`,
      name: 'Route Structure',
      type: 'route-structure',
      format: 'mermaid',
      content: mermaidCode,
      description: `Page routes: ${pages.length} pages, ${layouts.length} layouts`,
      components: [...pages, ...layouts].map(c => c.name),
      lastUpdated: new Date(),
      version: 1,
    };
  }

  /**
   * Sanitize name for Mermaid diagram IDs
   * Ensures output is a valid identifier: starts with letter, alphanumeric only
   */
  private sanitizeName(name: string): string {
    let sanitized = name
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace special chars
      .replace(/_+/g, '_')           // Collapse multiple underscores
      .replace(/^_|_$/g, '')         // Remove leading/trailing underscores
      .substring(0, 30);

    // Ensure it starts with a letter (Mermaid requirement)
    if (!sanitized || !/^[a-zA-Z]/.test(sanitized)) {
      sanitized = 'Model_' + (sanitized || 'Unknown');
    }

    return sanitized || 'Unknown';
  }

  /**
   * Extract tech stack from package.json
   */
  private extractTechStack(files: ScannedFile[]): TechStackItem[] {
    const stack: TechStackItem[] = [];

    const packageFile = files.find(f => f.path === 'package.json');
    if (!packageFile) return stack;

    try {
      const pkg = JSON.parse(packageFile.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Core frameworks
      if (deps['next']) stack.push({ category: 'frontend', name: 'Next.js', version: deps['next'], purpose: 'React framework with SSR/SSG' });
      if (deps['react']) stack.push({ category: 'frontend', name: 'React', version: deps['react'], purpose: 'UI library' });
      if (deps['typescript']) stack.push({ category: 'devops', name: 'TypeScript', version: deps['typescript'], purpose: 'Type-safe JavaScript' });

      // Styling
      if (deps['tailwindcss']) stack.push({ category: 'frontend', name: 'Tailwind CSS', version: deps['tailwindcss'], purpose: 'Utility-first CSS' });
      if (deps['@radix-ui/react-dialog'] || deps['@radix-ui/react-slot']) stack.push({ category: 'frontend', name: 'Radix UI', purpose: 'Accessible UI components' });

      // State management
      if (deps['zustand']) stack.push({ category: 'frontend', name: 'Zustand', version: deps['zustand'], purpose: 'State management' });
      if (deps['redux'] || deps['@reduxjs/toolkit']) stack.push({ category: 'frontend', name: 'Redux', version: deps['redux'] || deps['@reduxjs/toolkit'], purpose: 'State management' });

      // AI/ML
      if (deps['@anthropic-ai/sdk']) stack.push({ category: 'ai', name: 'Anthropic SDK', version: deps['@anthropic-ai/sdk'], purpose: 'Claude AI integration' });
      if (deps['openai']) stack.push({ category: 'ai', name: 'OpenAI SDK', version: deps['openai'], purpose: 'GPT integration' });

      // Backend
      if (deps['socket.io'] || deps['socket.io-client']) stack.push({ category: 'backend', name: 'Socket.IO', version: deps['socket.io'] || deps['socket.io-client'], purpose: 'Real-time communication' });
      if (deps['prisma'] || deps['@prisma/client']) stack.push({ category: 'database', name: 'Prisma', version: deps['prisma'] || deps['@prisma/client'], purpose: 'Database ORM' });

      // Testing
      if (deps['jest'] || deps['vitest']) stack.push({ category: 'testing', name: deps['jest'] ? 'Jest' : 'Vitest', version: deps['jest'] || deps['vitest'], purpose: 'Testing framework' });
      if (deps['@testing-library/react']) stack.push({ category: 'testing', name: 'Testing Library', version: deps['@testing-library/react'], purpose: 'React testing utilities' });

    } catch {
      console.warn('⚠️ Could not parse package.json');
    }

    return stack;
  }

  /**
   * Identify design patterns in use
   */
  private identifyPatterns(files: ScannedFile[], components: ComponentDoc[]): DesignPattern[] {
    const patterns: DesignPattern[] = [];

    const stores = files.filter(f => f.type === 'store');
    const hooks = files.filter(f => f.type === 'hook');
    const services = files.filter(f => f.type === 'service');
    const apis = files.filter(f => f.type === 'api');

    if (stores.length > 0) {
      patterns.push({
        name: 'State Management Pattern',
        category: 'architectural',
        description: `Centralized state using ${stores.length} store(s)`,
        usage: ['Global application state', 'Cross-component data sharing', 'State persistence'],
        files: stores.map(f => f.path),
      });
    }

    if (hooks.length > 0) {
      patterns.push({
        name: 'Custom Hooks Pattern',
        category: 'behavioral',
        description: `${hooks.length} custom React hooks for reusable logic`,
        usage: ['Data fetching', 'WebSocket connections', 'Form handling', 'Side effects'],
        files: hooks.map(f => f.path),
      });
    }

    if (services.length > 0) {
      patterns.push({
        name: 'Service Layer Pattern',
        category: 'architectural',
        description: `${services.length} service modules for business logic`,
        usage: ['API integration', 'Data transformation', 'External service communication'],
        files: services.map(f => f.path),
      });
    }

    if (apis.length > 0) {
      patterns.push({
        name: 'API Routes Pattern',
        category: 'architectural',
        description: `Next.js App Router with ${apis.length} API routes`,
        usage: ['RESTful endpoints', 'Server-side processing', 'Data mutations'],
        files: apis.map(f => f.path),
      });
    }

    // Check for specific patterns in code
    const hasProviders = files.some(f => f.content.includes('Provider') && f.content.includes('createContext'));
    if (hasProviders) {
      patterns.push({
        name: 'Context Provider Pattern',
        category: 'structural',
        description: 'React Context for dependency injection',
        usage: ['Theme provider', 'Auth context', 'Global configuration'],
        files: files.filter(f => f.content.includes('createContext')).map(f => f.path),
      });
    }

    const hasHOCs = files.some(f => f.content.includes('withAuth') || f.content.includes('withLayout'));
    if (hasHOCs) {
      patterns.push({
        name: 'Higher-Order Component Pattern',
        category: 'structural',
        description: 'HOCs for cross-cutting concerns',
        usage: ['Authentication wrapping', 'Layout injection', 'Error boundaries'],
        files: [],
      });
    }

    return patterns;
  }

  /**
   * Generate specific diagram type on demand
   */
  async generateDiagram(type: DiagramType): Promise<ArchitectureDiagram> {
    const files = await this.scanProjectFiles();
    const components = await this.extractAllComponents(files);
    const dataModels = await this.extractAllDataModels(files);
    const apiDocs = await this.generateOpenAPIDocumentation(files);
    const agents = await this.documentAgents(files);

    switch (type) {
      case 'system-overview':
        return this.generateSystemOverviewDiagram(components, apiDocs, agents);
      case 'component-diagram':
        return this.generateComponentDiagram(components);
      case 'api-flow':
        return this.generateAPIDiagram(apiDocs);
      case 'entity-relationship':
        return this.generateERDiagram(dataModels);
      case 'sequence-diagram':
        return this.generateAgentDiagram(agents);
      case 'data-flow':
        return this.generateDataFlowDiagram(components, apiDocs);
      default:
        return this.generateSystemOverviewDiagram(components, apiDocs, agents);
    }
  }

  /**
   * Generate data flow diagram
   */
  private generateDataFlowDiagram(components: ComponentDoc[], apiDocs: APIDocumentation): ArchitectureDiagram {
    const stores = components.filter(c => c.type === 'store').slice(0, 5);
    const services = components.filter(c => c.type === 'service').slice(0, 5);

    const mermaidCode = `flowchart LR
    subgraph Input["📥 User Input"]
        UI["React UI"]
        Forms["Forms"]
        Events["Events"]
    end

    subgraph Processing["⚙️ Processing"]
        ${stores.length > 0 ? stores.map(s => `${this.sanitizeName(s.name)}["${s.name}"]`).join('\n        ') : 'State["State Store"]'}
        ${services.length > 0 ? services.map(s => `${this.sanitizeName(s.name)}["${s.name}"]`).join('\n        ') : 'Services["Services"]'}
    end

    subgraph API["🔌 API (${apiDocs.endpoints.length} endpoints)"]
        Routes["API Routes"]
    end

    subgraph Output["📤 Output"]
        Response["API Response"]
        Update["UI Update"]
    end

    UI --> ${stores.length > 0 ? this.sanitizeName(stores[0].name) : 'State'}
    Forms --> Routes
    Events --> ${stores.length > 0 ? this.sanitizeName(stores[0].name) : 'State'}
    ${stores.length > 0 ? this.sanitizeName(stores[0].name) : 'State'} --> Update
    Routes --> Response
    ${services.length > 0 ? `Routes --> ${this.sanitizeName(services[0].name)}` : ''}`;

    return {
      id: `diagram-dataflow-${Date.now()}`,
      name: 'Data Flow',
      type: 'data-flow',
      format: 'mermaid',
      content: mermaidCode,
      description: 'Data flow through the application',
      components: ['Input', 'Processing', 'API', 'Output'],
      lastUpdated: new Date(),
      version: 1,
    };
  }
}

// Export factory function
export function createArchitectureService(options: ArchitectureServiceOptions): ArchitectureDocumentationService {
  return new ArchitectureDocumentationService(options);
}
