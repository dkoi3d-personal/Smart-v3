/**
 * Prompt Generator - Dynamically generates service documentation for agent prompts
 *
 * Reads from the service catalog and generates contextual documentation
 * that agents can use to understand available platform capabilities.
 */

import {
  loadServiceCatalog,
  getEnabledApis,
  getEnabledMcpServers,
  getEnabledLlmProviders,
  ApiService,
  McpServerConfig,
  LlmProvider,
} from './service-catalog';
import { mcpManager } from './mcp-manager';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptContext {
  projectType?: 'healthcare' | 'general' | 'e-commerce' | 'saas';
  features?: string[];
  includeApis?: boolean;
  includeMcp?: boolean;
  includeLlms?: boolean;
  includeExamples?: boolean;
  verbosity?: 'minimal' | 'standard' | 'detailed';
}

// ============================================================================
// PROMPT GENERATOR CLASS
// ============================================================================

class PromptGenerator {
  /**
   * Generate complete platform services documentation for agent prompts
   */
  generateServicesPrompt(context: PromptContext = {}): string {
    const {
      includeApis = true,
      includeMcp = true,
      includeLlms = true,
      includeExamples = true,
      verbosity = 'standard',
    } = context;

    const sections: string[] = [];

    sections.push('## AVAILABLE PLATFORM SERVICES\n');
    sections.push('The following services are available for you to use when building this application:\n');

    // API Services
    if (includeApis) {
      const apiDocs = this.generateApiDocs(context, verbosity, includeExamples);
      if (apiDocs) sections.push(apiDocs);
    }

    // MCP Servers
    if (includeMcp) {
      const mcpDocs = this.generateMcpDocs(verbosity);
      if (mcpDocs) sections.push(mcpDocs);
    }

    // LLM Providers
    if (includeLlms) {
      const llmDocs = this.generateLlmDocs(verbosity);
      if (llmDocs) sections.push(llmDocs);
    }

    // Usage guidelines
    sections.push(this.generateUsageGuidelines());

    return sections.join('\n');
  }

  /**
   * Generate API documentation
   */
  private generateApiDocs(
    context: PromptContext,
    verbosity: 'minimal' | 'standard' | 'detailed',
    includeExamples: boolean
  ): string {
    let apis = getEnabledApis();

    // Filter by project type
    if (context.projectType === 'healthcare') {
      // Prioritize healthcare APIs
      apis = apis.sort((a, b) => {
        const aHealth = a.tags.includes('healthcare') || a.tags.includes('fhir') ? -1 : 1;
        const bHealth = b.tags.includes('healthcare') || b.tags.includes('fhir') ? -1 : 1;
        return aHealth - bHealth;
      });
    }

    // Filter by requested features
    if (context.features?.length) {
      apis = apis.filter(api =>
        context.features!.some(feature =>
          api.tags.includes(feature.toLowerCase()) ||
          api.name.toLowerCase().includes(feature.toLowerCase())
        )
      );
    }

    if (apis.length === 0) return '';

    const lines: string[] = [
      '### Platform APIs (EXTERNAL - Call via fetch, DO NOT reimplement)\n',
      '⚠️ These APIs run on the platform at http://localhost:3000\n',
      'Your generated app should call these via fetch(), NOT implement its own version!\n',
    ];

    for (const api of apis) {
      lines.push(this.formatApiService(api, verbosity, includeExamples));
    }

    return lines.join('\n');
  }

  /**
   * Format a single API service
   */
  private formatApiService(
    api: ApiService,
    verbosity: 'minimal' | 'standard' | 'detailed',
    includeExamples: boolean
  ): string {
    const lines: string[] = [];
    // Show full URL with platform host
    const platformHost = 'http://localhost:3000';
    const fullBaseUrl = api.baseUrl.startsWith('/') ? `${platformHost}${api.baseUrl}` : api.baseUrl;

    lines.push(`#### ${api.name}`);
    lines.push(`${api.description}\n`);

    if (verbosity === 'minimal') {
      lines.push(`- Base URL: \`${fullBaseUrl}\` (EXTERNAL - call via fetch)`);
      lines.push(`- Methods: ${api.endpoints.map(e => `${e.method} ${e.path}`).join(', ')}\n`);
      return lines.join('\n');
    }

    // Standard/Detailed: Show endpoints
    lines.push('**Endpoints:** (call via fetch from your app)');
    for (const endpoint of api.endpoints) {
      lines.push(`- \`${endpoint.method} ${fullBaseUrl}${endpoint.path}\` - ${endpoint.description}`);

      if (verbosity === 'detailed' && endpoint.requestBody) {
        lines.push(`  Request body: \`${JSON.stringify(endpoint.requestBody)}\``);
      }
    }

    // Authentication info
    if (api.authentication && api.authentication.type !== 'none') {
      lines.push(`\n**Authentication:** ${api.authentication.type}`);
      if (api.authentication.envVariable) {
        lines.push(`  Environment variable: \`${api.authentication.envVariable}\``);
      }
    }

    // Setup instructions
    if (api.requiresSetup) {
      lines.push(`\n**Setup Required:** ${api.setupInstructions || 'See documentation'}`);
    }

    // Code examples
    if (includeExamples && api.examples.length > 0) {
      lines.push('\n**Example:**');
      const example = api.examples[0];
      lines.push('```' + example.language);
      lines.push(example.code);
      lines.push('```');
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Generate MCP server documentation
   */
  private generateMcpDocs(verbosity: 'minimal' | 'standard' | 'detailed'): string {
    const servers = getEnabledMcpServers();
    const runningServers = mcpManager.getServers().filter(s => s.status === 'running');

    if (servers.length === 0) return '';

    const lines: string[] = ['### MCP Servers (Model Context Protocol)\n'];

    if (runningServers.length > 0) {
      lines.push(`**Currently Running:** ${runningServers.map(s => s.config.name).join(', ')}\n`);
    }

    lines.push('**Available Servers:**\n');

    for (const server of servers) {
      lines.push(this.formatMcpServer(server, verbosity));
    }

    return lines.join('\n');
  }

  /**
   * Format a single MCP server
   */
  private formatMcpServer(
    server: McpServerConfig,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): string {
    const lines: string[] = [];

    lines.push(`#### ${server.name}`);
    lines.push(`${server.description}\n`);

    if (verbosity === 'minimal') {
      lines.push(`- Tools: ${server.tools.map(t => t.name).join(', ')}\n`);
      return lines.join('\n');
    }

    lines.push('**Tools:**');
    for (const tool of server.tools) {
      lines.push(`- \`${tool.name}\` - ${tool.description}`);
    }

    if (verbosity === 'detailed') {
      lines.push(`\n**Command:** \`${server.command} ${server.args.join(' ')}\``);
      if (server.env) {
        lines.push(`**Environment:** ${Object.keys(server.env).join(', ')}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Generate LLM provider documentation
   */
  private generateLlmDocs(verbosity: 'minimal' | 'standard' | 'detailed'): string {
    const providers = getEnabledLlmProviders();

    if (providers.length === 0) return '';

    const lines: string[] = ['### LLM Providers\n'];
    lines.push('Multiple LLM providers are available. The system will automatically route requests to the optimal provider based on the task.\n');

    for (const provider of providers) {
      lines.push(this.formatLlmProvider(provider, verbosity));
    }

    // Routing recommendations
    lines.push('**Routing Recommendations:**');
    lines.push('- Code generation: Claude Sonnet/Opus');
    lines.push('- Vision/OCR: Local MLX or Ollama LLaVA');
    lines.push('- Fast completions: Groq or Haiku');
    lines.push('- Complex reasoning: Claude Opus or o1');
    lines.push('- Privacy-sensitive: Ollama (local)\n');

    return lines.join('\n');
  }

  /**
   * Format a single LLM provider
   */
  private formatLlmProvider(
    provider: LlmProvider,
    verbosity: 'minimal' | 'standard' | 'detailed'
  ): string {
    const lines: string[] = [];

    const defaultTag = provider.isDefault ? ' (Default)' : '';
    lines.push(`#### ${provider.name}${defaultTag}`);

    if (verbosity === 'minimal') {
      lines.push(`- Models: ${provider.models.map(m => m.name).join(', ')}`);
      lines.push(`- Capabilities: ${provider.capabilities.join(', ')}\n`);
      return lines.join('\n');
    }

    lines.push(`**Type:** ${provider.type}`);
    lines.push(`**Capabilities:** ${provider.capabilities.join(', ')}`);
    lines.push(`**Use Cases:** ${provider.useCases.join(', ')}\n`);

    if (verbosity === 'detailed') {
      lines.push('**Models:**');
      for (const model of provider.models) {
        const features = [];
        if (model.supportsVision) features.push('vision');
        if (model.supportsTools) features.push('tools');
        const featStr = features.length > 0 ? ` (${features.join(', ')})` : '';
        lines.push(`- ${model.name}: ${model.contextWindow.toLocaleString()} tokens${featStr}`);
      }
    }

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Generate usage guidelines
   */
  private generateUsageGuidelines(): string {
    return `### Usage Guidelines

⚠️ **CRITICAL: USE PLATFORM APIS - DO NOT REIMPLEMENT**

The platform provides pre-built services that your generated application MUST use.
These are EXTERNAL APIs running on the platform (http://localhost:3000).
DO NOT install npm packages to reimplement these features!

1. **API Integration (MANDATORY):**
   - Platform APIs are EXTERNAL services at http://localhost:3000
   - Your generated app should call these APIs via fetch()
   - DO NOT implement your own version of platform services
   - Example: Call \`http://localhost:3000/api/mlx/ocr\` instead of installing tesseract.js

2. **OCR Implementation (MUST USE PLATFORM API):**
   ⚠️ DO NOT install tesseract.js, ocrad, or any OCR library!
   ⚠️ ALWAYS use the platform's MLX OCR service

   \`\`\`typescript
   // CORRECT: Call the platform's MLX OCR API
   const response = await fetch('http://localhost:3000/api/mlx/ocr', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       image: base64ImageData, // base64 encoded image with data URI prefix
       mode: 'document',       // 'document' | 'general' | 'figure'
       isPdf: false            // set true for PDF files
     })
   });
   const { text, boundingBoxes, tokensPerSecond } = await response.json();

   // WRONG: Do not do this!
   // npm install tesseract.js  ❌
   // import { createWorker } from 'tesseract.js'  ❌
   \`\`\`

3. **Healthcare Data:**
   - Use Epic FHIR APIs via \`http://localhost:3000/api/epic/fhir/*\`
   - Follow HIPAA compliance guidelines
   - Use test patient data during development

4. **Error Handling for Platform APIs:**
   \`\`\`typescript
   try {
     const response = await fetch('http://localhost:3000/api/mlx/ocr', {...});
     if (!response.ok) {
       const error = await response.json();
       // Handle MLX not available, model not downloaded, etc.
       throw new Error(error.error || 'Platform API failed');
     }
   } catch (err) {
     // Show user-friendly error: "OCR service unavailable. Ensure AI Dev Platform is running."
   }
   \`\`\`

5. **Why Use Platform APIs:**
   - MLX OCR uses DeepSeek-VL for superior accuracy (better than Tesseract)
   - No additional dependencies in your generated app
   - Centralized service management
   - Hardware-optimized for Apple Silicon
`;
  }

  /**
   * Generate a minimal services summary (for quick reference)
   */
  generateServicesSummary(): string {
    const apis = getEnabledApis();
    const mcpServers = getEnabledMcpServers();
    const llmProviders = getEnabledLlmProviders();

    const lines: string[] = ['## Quick Reference: Available Services\n'];

    if (apis.length > 0) {
      lines.push('**APIs:**');
      for (const api of apis) {
        lines.push(`- ${api.name}: \`${api.baseUrl}\` - ${api.description.split('.')[0]}`);
      }
      lines.push('');
    }

    if (mcpServers.length > 0) {
      lines.push('**MCP Servers:**');
      for (const server of mcpServers) {
        lines.push(`- ${server.name}: ${server.tools.map(t => t.name).join(', ')}`);
      }
      lines.push('');
    }

    if (llmProviders.length > 0) {
      lines.push('**LLM Providers:**');
      for (const provider of llmProviders) {
        const tag = provider.isDefault ? ' (default)' : '';
        lines.push(`- ${provider.name}${tag}: ${provider.models.map(m => m.name).join(', ')}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate healthcare-specific services documentation
   */
  generateHealthcarePrompt(): string {
    const context: PromptContext = {
      projectType: 'healthcare',
      includeApis: true,
      includeMcp: false,
      includeLlms: false,
      verbosity: 'detailed',
      includeExamples: true,
    };

    const healthcareApis = getEnabledApis({ tags: ['healthcare', 'fhir', 'hipaa'] });

    const lines: string[] = [
      '## Healthcare Platform Services\n',
      'This application has access to healthcare-specific APIs and must follow HIPAA compliance guidelines.\n',
    ];

    // Epic FHIR section
    const epicApi = healthcareApis.find(a => a.id === 'epic-fhir');
    if (epicApi) {
      lines.push('### Epic FHIR Integration\n');
      lines.push(this.formatApiService(epicApi, 'detailed', true));
    }

    // Compliance section
    const complianceApi = healthcareApis.find(a => a.id === 'compliance-scan');
    if (complianceApi) {
      lines.push('### HIPAA Compliance\n');
      lines.push(this.formatApiService(complianceApi, 'standard', true));
    }

    // OCR for medical documents
    const ocrApi = getEnabledApis({ tags: ['ocr'] })[0];
    if (ocrApi) {
      lines.push('### Medical Document OCR\n');
      lines.push(this.formatApiService(ocrApi, 'standard', true));
    }

    return lines.join('\n');
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

export const promptGenerator = new PromptGenerator();
export default promptGenerator;
