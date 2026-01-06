/**
 * Ollama Service Types
 *
 * Type definitions for local AI services via Ollama
 */

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

export interface OllamaModelInfo {
  name: string;
  displayName: string;
  size: string;
  capabilities: ModelCapability[];
  description: string;
  installed: boolean;
  downloading?: boolean;
  downloadProgress?: number;
}

export type ModelCapability = 'ocr' | 'vision' | 'code' | 'chat' | 'reasoning' | 'embedding';

export interface OllamaStatus {
  running: boolean;
  version?: string;
  models: OllamaModelInfo[];
  error?: string;
}

export interface OCRRequest {
  image: string; // base64 encoded image
  prompt?: string;
  mode: 'document' | 'general' | 'figure' | 'free';
}

export interface OCRResponse {
  text: string;
  confidence?: number;
  processingTime: number;
  model: string;
}

export interface GenerateRequest {
  model: string;
  prompt: string;
  images?: string[]; // base64 encoded images
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    num_predict?: number;
  };
}

export interface GenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Model capability definitions
export const MODEL_CAPABILITIES: Record<string, { capabilities: ModelCapability[]; description: string }> = {
  'deepseek-ocr': {
    capabilities: ['ocr', 'vision'],
    description: 'OCR and document understanding model',
  },
  'deepseek-vl': {
    capabilities: ['vision', 'chat'],
    description: 'Vision-language model for image understanding',
  },
  'deepseek-coder': {
    capabilities: ['code', 'chat'],
    description: 'Code generation and understanding',
  },
  'deepseek-r1': {
    capabilities: ['reasoning', 'chat'],
    description: 'Advanced reasoning model',
  },
  'llava': {
    capabilities: ['vision', 'chat'],
    description: 'Vision-language assistant',
  },
  'llama3.2-vision': {
    capabilities: ['vision', 'chat'],
    description: 'Meta Llama 3.2 with vision capabilities',
  },
};

// OCR prompt templates
export const OCR_PROMPTS = {
  document: '<|grounding|>Convert the document to markdown',
  general: '<|grounding|>OCR this image',
  figure: 'Parse the figure',
  free: 'Free OCR',
  describe: 'Describe this image in detail',
};

// Local AI service configuration
export interface LocalAIConfig {
  ollamaUrl: string;
  enabledCapabilities: ModelCapability[];
  preferredModels: Record<ModelCapability, string>;
  autoDownload: boolean;
}

export const DEFAULT_LOCAL_AI_CONFIG: LocalAIConfig = {
  ollamaUrl: 'http://localhost:11434',
  enabledCapabilities: ['ocr', 'vision'],
  preferredModels: {
    ocr: 'deepseek-ocr',
    vision: 'deepseek-ocr',
    code: 'deepseek-coder',
    chat: 'deepseek-r1',
    reasoning: 'deepseek-r1',
    embedding: 'nomic-embed-text',
  },
  autoDownload: false,
};
