/**
 * Ollama Service Exports
 */

export * from './types';
export * from './client';
export * from './config-store';
export { getOllamaClient, default as OllamaClient } from './client';

// Re-export document converter utilities
export { convertToImages, getDocumentInfo, normalizeBase64, getMimeType } from './document-converter';

// Re-export OCR helper functions
export { quickOCR, analyzeImage, checkOCRAvailability } from './ocr-helpers';
