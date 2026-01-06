/**
 * Ollama Client
 *
 * Client for interacting with local Ollama instance
 */

import {
  OllamaModel,
  OllamaModelInfo,
  OllamaStatus,
  OCRRequest,
  OCRResponse,
  GenerateRequest,
  GenerateResponse,
  MODEL_CAPABILITIES,
  OCR_PROMPTS,
  LocalAIConfig,
  DEFAULT_LOCAL_AI_CONFIG,
  ModelCapability,
} from './types';

export class OllamaClient {
  private baseUrl: string;
  private config: LocalAIConfig;

  constructor(config: Partial<LocalAIConfig> = {}) {
    this.config = { ...DEFAULT_LOCAL_AI_CONFIG, ...config };
    this.baseUrl = this.config.ollamaUrl;
  }

  /**
   * Check if Ollama is running and get status
   */
  async getStatus(): Promise<OllamaStatus> {
    try {
      // Check if Ollama is running
      const versionResponse = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (!versionResponse.ok) {
        return {
          running: false,
          models: [],
          error: 'Ollama server not responding',
        };
      }

      const versionData = await versionResponse.json();

      // Get installed models
      const modelsResponse = await fetch(`${this.baseUrl}/api/tags`);
      const modelsData = await modelsResponse.json();

      const models = this.parseModels(modelsData.models || []);

      return {
        running: true,
        version: versionData.version,
        models,
      };
    } catch (error) {
      return {
        running: false,
        models: [],
        error: error instanceof Error ? error.message : 'Failed to connect to Ollama',
      };
    }
  }

  /**
   * Parse model list and enrich with capability info
   */
  private parseModels(models: OllamaModel[]): OllamaModelInfo[] {
    return models.map((model) => {
      const baseName = model.name.split(':')[0];
      const capabilityInfo = MODEL_CAPABILITIES[baseName] || {
        capabilities: ['chat'] as ModelCapability[],
        description: 'General purpose model',
      };

      return {
        name: model.name,
        displayName: this.formatModelName(model.name),
        size: this.formatSize(model.size),
        capabilities: capabilityInfo.capabilities,
        description: capabilityInfo.description,
        installed: true,
      };
    });
  }

  /**
   * Format model name for display
   */
  private formatModelName(name: string): string {
    return name
      .split(':')[0]
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Format file size
   */
  private formatSize(bytes: number): string {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) {
      return `${gb.toFixed(1)} GB`;
    }
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  }

  /**
   * Perform OCR on an image
   */
  async performOCR(request: OCRRequest): Promise<OCRResponse> {
    const startTime = Date.now();
    const model = this.config.preferredModels.ocr;
    const prompt = OCR_PROMPTS[request.mode] || OCR_PROMPTS.general;

    const fullPrompt = request.prompt
      ? `${prompt}\n\n${request.prompt}`
      : prompt;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: fullPrompt,
          images: [request.image],
          stream: false,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`OCR failed: ${error}`);
      }

      const data: GenerateResponse = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        text: data.response,
        processingTime,
        model,
      };
    } catch (error) {
      throw new Error(
        `OCR processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Generate text with optional image input
   */
  async generate(request: GenerateRequest): Promise<GenerateResponse> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...request,
        stream: false,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Generation failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(
    modelName: string,
    onProgress?: (progress: { status: string; completed?: number; total?: number }) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to pull model: ${await response.text()}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const progress = JSON.parse(line);
          onProgress?.(progress);
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  /**
   * Delete a model
   */
  async deleteModel(modelName: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName }),
    });

    if (!response.ok) {
      throw new Error(`Failed to delete model: ${await response.text()}`);
    }
  }

  /**
   * Check if a specific capability is available
   */
  async hasCapability(capability: ModelCapability): Promise<boolean> {
    const status = await this.getStatus();
    if (!status.running) return false;

    return status.models.some((model) => model.capabilities.includes(capability));
  }

  /**
   * Get preferred model for a capability
   */
  getPreferredModel(capability: ModelCapability): string {
    return this.config.preferredModels[capability];
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LocalAIConfig>): void {
    this.config = { ...this.config, ...config };
    this.baseUrl = this.config.ollamaUrl;
  }
}

// Singleton instance
let ollamaClient: OllamaClient | null = null;

export function getOllamaClient(config?: Partial<LocalAIConfig>): OllamaClient {
  if (!ollamaClient) {
    ollamaClient = new OllamaClient(config);
  } else if (config) {
    ollamaClient.updateConfig(config);
  }
  return ollamaClient;
}

export default OllamaClient;
