/**
 * Document Converter - Converts PDFs and other documents to images for OCR
 * Supports: PDF, PNG, JPG, JPEG, GIF, WEBP
 */

import * as fs from 'fs';
import * as path from 'path';

// Types
export interface ConversionResult {
  success: boolean;
  images: string[]; // Base64 encoded images
  pageCount: number;
  error?: string;
}

export interface DocumentInfo {
  type: 'pdf' | 'image' | 'unknown';
  pageCount?: number;
  filename: string;
  size: number;
}

// Supported image formats that can be sent directly to OCR
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];

/**
 * Get document info without converting
 */
export function getDocumentInfo(filePath: string): DocumentInfo {
  const ext = path.extname(filePath).toLowerCase();
  const filename = path.basename(filePath);
  const stats = fs.statSync(filePath);

  if (ext === '.pdf') {
    return { type: 'pdf', filename, size: stats.size };
  } else if (IMAGE_EXTENSIONS.includes(ext)) {
    return { type: 'image', pageCount: 1, filename, size: stats.size };
  }
  return { type: 'unknown', filename, size: stats.size };
}

/**
 * Convert a document to base64 images for OCR
 */
export async function convertToImages(filePath: string): Promise<ConversionResult> {
  const ext = path.extname(filePath).toLowerCase();

  // If it's already an image, just return it as base64
  if (IMAGE_EXTENSIONS.includes(ext)) {
    try {
      const imageData = fs.readFileSync(filePath);
      const base64 = imageData.toString('base64');
      return {
        success: true,
        images: [base64],
        pageCount: 1
      };
    } catch (error) {
      return {
        success: false,
        images: [],
        pageCount: 0,
        error: `Failed to read image: ${error}`
      };
    }
  }

  // Handle PDF
  if (ext === '.pdf') {
    return convertPdfToImages(filePath);
  }

  return {
    success: false,
    images: [],
    pageCount: 0,
    error: `Unsupported file type: ${ext}`
  };
}

/**
 * Convert PDF pages to images using pdf.js
 */
async function convertPdfToImages(pdfPath: string): Promise<ConversionResult> {
  try {
    // Dynamic import for server-side PDF.js
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const { createCanvas } = await import('canvas');

    // Read PDF file
    const pdfData = new Uint8Array(fs.readFileSync(pdfPath));

    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({
      data: pdfData,
      useSystemFonts: true,
    });

    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;
    const images: string[] = [];

    // Convert each page to an image
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);

      // Set scale for good quality (2x for better OCR)
      const scale = 2.0;
      const viewport = page.getViewport({ scale });

      // Create canvas
      const canvas = createCanvas(viewport.width, viewport.height);
      const context = canvas.getContext('2d');

      // Render page to canvas
      await page.render({
        canvasContext: context as any,
        viewport: viewport,
        canvas: canvas as any,
      }).promise;

      // Convert to base64 PNG
      const base64 = canvas.toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
      images.push(base64);
    }

    return {
      success: true,
      images,
      pageCount: numPages
    };
  } catch (error) {
    console.error('PDF conversion error:', error);
    return {
      success: false,
      images: [],
      pageCount: 0,
      error: `PDF conversion failed: ${error}`
    };
  }
}

/**
 * Convert base64 data URL or file to base64 string
 */
export function normalizeBase64(input: string): string {
  // Remove data URL prefix if present
  if (input.startsWith('data:')) {
    const commaIndex = input.indexOf(',');
    if (commaIndex !== -1) {
      return input.slice(commaIndex + 1);
    }
  }
  return input;
}

/**
 * Get MIME type from file extension
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}
