/**
 * MLX-VLM Types
 *
 * Type definitions for MLX Vision Language Model integration
 */

export interface MLXOCRRequest {
  image: string; // base64 encoded image or file path
  prompt?: string;
  mode: 'document' | 'general' | 'figure' | 'free';
  maxTokens?: number;
}

export interface MLXOCRResponse {
  text: string;
  boundingBoxes?: BoundingBox[];
  tokensPerSecond: number;
  peakMemoryGB: number;
  totalTokens: number;
}

export interface BoundingBox {
  text: string;
  coordinates: [number, number, number, number]; // [x1, y1, x2, y2]
}

export interface MLXModelInfo {
  name: string;
  path: string;
  size?: string;
  capabilities: MLXCapability[];
}

export type MLXCapability = 'ocr' | 'vision' | 'grounding';

export interface MLXConfig {
  modelPath: string;
  pythonPath: string;
  maxTokens: number;
  offlineMode: boolean;
}

export const DEFAULT_MLX_CONFIG: MLXConfig = {
  modelPath: 'mlx-community/DeepSeek-OCR-4bit',
  pythonPath: '/Users/rfitzgerald/.pyenv/versions/3.12.0/bin/python',
  maxTokens: 500,
  offlineMode: true,
};

// DeepSeek-OCR specific prompts
export const MLX_OCR_PROMPTS = {
  document: '<|grounding|>Convert the document to markdown',
  general: '<|grounding|>OCR this image',
  figure: '<|grounding|>Parse the figure',
  free: '',
};
