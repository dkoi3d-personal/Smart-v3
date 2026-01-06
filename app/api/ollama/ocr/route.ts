/**
 * OCR API
 *
 * POST /api/ollama/ocr - Perform OCR on an image or document (PDF)
 * GET /api/ollama/ocr - Get OCR status and available models
 *
 * Supports:
 * - Direct base64 image via JSON body
 * - File path via JSON body (for local testing)
 * - File upload via multipart/form-data
 * - PDF files (auto-converted to images)
 *
 * Models:
 * - llava:7b (default, GPU-accelerated)
 * - deepseek-ocr (CPU only, specialized for OCR)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOllamaClient, OCRRequest } from '@/lib/ollama';
import { convertToImages } from '@/lib/ollama/document-converter';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// LLaVA is GPU-accelerated; deepseek-ocr is CPU-only
const DEFAULT_MODEL = 'llava:7b';

async function performDirectOCR(imageBase64: string, model: string = DEFAULT_MODEL, prompt?: string) {
  const finalPrompt = prompt || 'Extract all text from this image. Provide the text exactly as it appears.';

  const response = await fetch('http://localhost:11434/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: finalPrompt,
      images: [imageBase64],
      stream: false,
      options: { num_gpu: 99 }
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error("OCR request failed: " + error);
  }

  const result = await response.json();
  return result.response || '';
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    // Handle multipart form data (file upload)
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const model = (formData.get('model') as string) || DEFAULT_MODEL;
      const prompt = formData.get('prompt') as string | null;

      if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
      }

      // Save to temp file
      const tempDir = os.tmpdir();
      const tempPath = path.join(tempDir, "ocr-" + Date.now() + "-" + file.name);
      const arrayBuffer = await file.arrayBuffer();
      fs.writeFileSync(tempPath, Buffer.from(arrayBuffer));

      // Convert to images
      const result = await convertToImages(tempPath);
      try { fs.unlinkSync(tempPath); } catch {}

      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      // OCR each page
      const pages: Array<{ page: number; text: string; error?: string }> = [];
      for (let i = 0; i < result.images.length; i++) {
        try {
          const text = await performDirectOCR(result.images[i], model, prompt || undefined);
          pages.push({ page: i + 1, text });
        } catch (err) {
          pages.push({ page: i + 1, text: '', error: String(err) });
        }
      }

      const fullText = pages.filter(p => p.text).map(p => p.text).join('\n\n---PAGE BREAK---\n\n');

      return NextResponse.json({
        success: true,
        filename: file.name,
        model,
        pageCount: result.images.length,
        pages,
        fullText,
      });
    }

    // Handle JSON body
    const body = await request.json();
    const { image, filePath, mode = 'general', prompt, model } = body;

    // If filePath provided (PDF or image), convert and OCR
    if (filePath) {
      const result = await convertToImages(filePath);
      if (!result.success) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }

      const selectedModel = model || DEFAULT_MODEL;
      const pages: Array<{ page: number; text: string; error?: string }> = [];

      for (let i = 0; i < result.images.length; i++) {
        try {
          const text = await performDirectOCR(result.images[i], selectedModel, prompt);
          pages.push({ page: i + 1, text });
        } catch (err) {
          pages.push({ page: i + 1, text: '', error: String(err) });
        }
      }

      const fullText = pages.filter(p => p.text).map(p => p.text).join('\n\n---PAGE BREAK---\n\n');

      return NextResponse.json({
        success: true,
        filename: path.basename(filePath),
        model: selectedModel,
        pageCount: result.images.length,
        pages,
        fullText,
      });
    }

    // Original behavior: single image OCR
    if (!image) {
      return NextResponse.json({ error: 'Image or filePath is required' }, { status: 400 });
    }

    // If model specified, use direct OCR
    if (model) {
      const text = await performDirectOCR(image, model, prompt);
      return NextResponse.json({ text, model, success: true });
    }

    // Use existing OllamaClient for backward compatibility
    const validModes = ['document', 'general', 'figure', 'free'];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode: ${mode}. Valid modes are: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    const client = getOllamaClient();
    const hasOCR = await client.hasCapability('ocr');

    if (!hasOCR) {
      // Fallback to LLaVA
      const text = await performDirectOCR(image, DEFAULT_MODEL, prompt);
      return NextResponse.json({ text, model: DEFAULT_MODEL, success: true });
    }

    const result = await client.performOCR({
      image,
      mode: mode as OCRRequest['mode'],
      prompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('OCR Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR failed' },
      { status: 500 }
    );
  }
}

// GET endpoint: OCR status and available models
export async function GET() {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();

    const visionModels = data.models?.filter((m: any) =>
      m.name.includes('llava') ||
      m.name.includes('ocr') ||
      m.name.includes('bakllava') ||
      m.name.includes('moondream')
    ) || [];

    // Check GPU status
    const psResponse = await fetch('http://localhost:11434/api/ps');
    const psData = await psResponse.json();
    const gpuInfo = psData.models?.map((m: any) => ({
      name: m.name,
      onGpu: m.size_vram > 0,
      vramUsed: m.size_vram
    })) || [];

    return NextResponse.json({
      available: true,
      defaultModel: DEFAULT_MODEL,
      visionModels: visionModels.map((m: any) => ({
        name: m.name,
        size: m.size,
        family: m.details?.family
      })),
      gpuStatus: gpuInfo,
      supportedFormats: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'],
      note: 'Use llava:7b for GPU-accelerated OCR. deepseek-ocr runs on CPU only.'
    });
  } catch {
    return NextResponse.json({
      available: false,
      error: 'Ollama not running'
    }, { status: 503 });
  }
}
