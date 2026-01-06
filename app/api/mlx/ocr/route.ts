/**
 * MLX OCR API
 *
 * POST /api/mlx/ocr - Perform OCR using MLX-VLM DeepSeek-OCR
 * Supports: Images (PNG, JPG, WEBP, GIF) and PDFs (multi-page)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMLXVLMClient, MLXOCRRequest } from '@/lib/mlx-vlm';
import * as fs from 'fs/promises';
import * as path from 'path';

// Convert PDF to images using pdf.js (server-side)
async function convertPdfToImages(base64Data: string): Promise<{ images: string[]; pageCount: number }> {
  try {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');

    // Decode base64 to buffer
    const pdfBuffer = Buffer.from(base64Data, 'base64');
    const pdfData = new Uint8Array(pdfBuffer);

    // Load PDF
    const loadingTask = pdfjsLib.getDocument({ data: pdfData, useSystemFonts: true });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const images: string[] = [];

    // Convert each page to image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const scale = 2.0; // Higher scale for better OCR
      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any,
      }).promise;

      // Convert to base64 PNG (with data URI prefix for OCR client)
      const base64Image = canvas.toDataURL('image/png');
      images.push(base64Image);
    }

    return { images, pageCount: numPages };
  } catch (error) {
    console.error('PDF conversion error:', error);
    throw new Error(`Failed to convert PDF: ${error}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image, mode = 'document', prompt, maxTokens, isPdf } = body as Partial<MLXOCRRequest> & {
      image?: string;
      isPdf?: boolean;
    };

    if (!image) {
      return NextResponse.json({ error: 'Image is required (base64 encoded or file path)' }, { status: 400 });
    }

    // Validate mode
    const validModes = ['document', 'general', 'figure', 'free'];
    if (!validModes.includes(mode)) {
      return NextResponse.json(
        { error: `Invalid mode. Must be one of: ${validModes.join(', ')}` },
        { status: 400 }
      );
    }

    const client = getMLXVLMClient();

    // Check if MLX-VLM is available
    const isAvailable = await client.isAvailable();
    if (!isAvailable) {
      return NextResponse.json(
        {
          error: 'MLX-VLM not available. Please install with: pip install mlx-vlm',
          installCommand: 'pip install mlx-vlm torch torchvision',
        },
        { status: 503 }
      );
    }

    // Check if model is downloaded
    const modelInfo = await client.getModelInfo();
    if (!modelInfo.available) {
      return NextResponse.json(
        {
          error: 'DeepSeek-OCR model not downloaded',
          modelError: modelInfo.error,
        },
        { status: 503 }
      );
    }

    // Handle PDF files - convert to images and process each page
    if (isPdf || image.startsWith('data:application/pdf')) {
      const base64Data = image.replace(/^data:application\/pdf;base64,/, '');
      const { images, pageCount } = await convertPdfToImages(base64Data);

      // Process each page
      const allText: string[] = [];
      const allBoundingBoxes: any[] = [];
      let totalTokens = 0;
      let avgTokensPerSecond = 0;

      for (let i = 0; i < images.length; i++) {
        const pageResult = await client.performOCR({
          image: images[i],
          mode: mode as MLXOCRRequest['mode'],
          prompt,
          maxTokens,
        });

        allText.push(`--- Page ${i + 1} ---\n${pageResult.text}`);
        if (pageResult.boundingBoxes) {
          allBoundingBoxes.push(...pageResult.boundingBoxes.map(bb => ({ ...bb, page: i + 1 })));
        }
        totalTokens += pageResult.totalTokens || 0;
        avgTokensPerSecond += pageResult.tokensPerSecond || 0;
      }

      return NextResponse.json({
        text: allText.join('\n\n'),
        boundingBoxes: allBoundingBoxes,
        tokensPerSecond: avgTokensPerSecond / images.length,
        peakMemoryGB: 0,
        totalTokens,
        pageCount,
      });
    }

    // Handle regular images
    const result = await client.performOCR({
      image,
      mode: mode as MLXOCRRequest['mode'],
      prompt,
      maxTokens,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('MLX OCR Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'OCR failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const client = getMLXVLMClient();

    const [isAvailable, modelInfo] = await Promise.all([client.isAvailable(), client.getModelInfo()]);

    return NextResponse.json({
      mlxAvailable: isAvailable,
      model: {
        name: 'DeepSeek-OCR-4bit',
        available: modelInfo.available,
        path: modelInfo.path,
        error: modelInfo.error,
      },
      capabilities: ['ocr', 'vision', 'grounding'],
      performance: {
        approximate_tokens_per_second: 550,
        approximate_memory_gb: 3.7,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to get status' },
      { status: 500 }
    );
  }
}
