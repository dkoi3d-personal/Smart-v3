/**
 * OCR Helper Functions - Easy-to-use OCR utilities for agents and services
 * Uses LLaVA with GPU acceleration for fast image analysis
 */

const OLLAMA_URL = 'http://localhost:11434/api/generate';
const DEFAULT_MODEL = 'llava:7b';

/**
 * Quick OCR helper - performs OCR on a base64 image using LLaVA
 * @param imageBase64 - Base64 encoded image (without data URL prefix)
 * @param prompt - Optional custom prompt for extraction
 * @returns Extracted text from the image
 */
export async function quickOCR(imageBase64: string, prompt?: string): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt: prompt || 'Extract all text from this image. Provide the text exactly as it appears.',
      images: [imageBase64],
      stream: false,
      options: { num_gpu: 99 }
    }),
  });

  if (!response.ok) {
    throw new Error('OCR request failed: ' + await response.text());
  }

  const result = await response.json();
  return result.response || '';
}

/**
 * Analyze image helper - uses LLaVA to analyze/describe an image
 * @param imageBase64 - Base64 encoded image (without data URL prefix)
 * @param prompt - What to analyze or describe about the image
 * @returns Analysis result from LLaVA
 */
export async function analyzeImage(imageBase64: string, prompt: string): Promise<string> {
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      prompt,
      images: [imageBase64],
      stream: false,
      options: { num_gpu: 99 }
    }),
  });

  if (!response.ok) {
    throw new Error('Image analysis failed: ' + await response.text());
  }

  const result = await response.json();
  return result.response || '';
}

/**
 * Check if Ollama OCR is available
 * @returns Object with availability status and loaded models
 */
export async function checkOCRAvailability(): Promise<{ available: boolean; models: string[]; gpuEnabled: boolean }> {
  try {
    const [tagsResponse, psResponse] = await Promise.all([
      fetch('http://localhost:11434/api/tags'),
      fetch('http://localhost:11434/api/ps')
    ]);

    const tags = await tagsResponse.json();
    const ps = await psResponse.json();

    const visionModels = tags.models?.filter((m: { name: string }) =>
      m.name.includes('llava') || m.name.includes('bakllava') || m.name.includes('moondream')
    ).map((m: { name: string }) => m.name) || [];

    const gpuEnabled = ps.models?.some((m: { size_vram: number }) => m.size_vram > 0) || false;

    return { available: visionModels.length > 0, models: visionModels, gpuEnabled };
  } catch {
    return { available: false, models: [], gpuEnabled: false };
  }
}
