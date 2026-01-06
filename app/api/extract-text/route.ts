/**
 * Text Extraction API
 *
 * Extracts text content from uploaded PDF and DOCX files.
 * Uses pdf-parse for PDFs (Node.js compatible) and JSZip for DOCX.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as JSZipModule from 'jszip';

// Handle both ESM and CJS exports
const JSZip = (JSZipModule as any).default || JSZipModule;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    let extractedText = '';

    if (fileName.endsWith('.pdf')) {
      extractedText = await extractPdfText(file);
    } else if (fileName.endsWith('.docx')) {
      extractedText = await extractDocxText(file);
    } else {
      return NextResponse.json(
        { error: 'Unsupported file type. Only PDF and DOCX are supported.' },
        { status: 400 }
      );
    }

    return NextResponse.json({ text: extractedText });
  } catch (error) {
    console.error('[extract-text] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to extract text' },
      { status: 500 }
    );
  }
}

/**
 * Extract text from PDF file using pdf2json (pure Node.js, no worker needed)
 */
async function extractPdfText(file: File): Promise<string> {
  const PDFParser = (await import('pdf2json')).default;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return new Promise((resolve, reject) => {
    const pdfParser = new PDFParser();

    pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
      reject('parserError' in errData ? errData.parserError : errData);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
      try {
        // Safe decode that handles malformed URI sequences
        const safeDecode = (str: string): string => {
          try {
            return decodeURIComponent(str);
          } catch {
            // If decodeURIComponent fails, try to decode what we can
            return str.replace(/%([0-9A-Fa-f]{2})/g, (_, hex) => {
              try {
                return String.fromCharCode(parseInt(hex, 16));
              } catch {
                return '';
              }
            });
          }
        };

        // Extract text from all pages
        const text = (pdfData.Pages || [])
          .map((page: { Texts?: Array<{ R?: Array<{ T?: string }> }> }) =>
            (page.Texts || [])
              .map((textItem: { R?: Array<{ T?: string }> }) =>
                (textItem.R || [])
                  .map((r: { T?: string }) => safeDecode(r.T || ''))
                  .join('')
              )
              .join(' ')
          )
          .join('\n\n');

        resolve(text);
      } catch (err) {
        reject(err);
      }
    });

    pdfParser.parseBuffer(buffer);
  });
}

/**
 * Extract text from DOCX file using JSZip
 * DOCX files are ZIP archives containing XML files.
 * The main content is in word/document.xml
 */
async function extractDocxText(file: File): Promise<string> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Get the main document content
    const documentFile = zip.file('word/document.xml');
    if (!documentFile) {
      throw new Error('Could not find document content in DOCX file');
    }

    const documentXml = await documentFile.async('text');

    // Extract text from XML - get all <w:t> elements (Word text runs)
    const paragraphs: string[] = [];

    // Split by paragraph markers and extract text
    const paragraphMatches = documentXml.split(/<w:p[^>]*>/);

    for (const para of paragraphMatches) {
      // Find all text runs in this paragraph
      const textMatches = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
      const paraText = textMatches
        .map((match: string) => {
          const textMatch = match.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
          return textMatch ? textMatch[1] : '';
        })
        .join('');

      if (paraText.trim()) {
        paragraphs.push(paraText);
      }
    }

    const extractedText = paragraphs.join('\n');

    if (!extractedText.trim()) {
      // Fallback: strip all XML tags
      const fallbackText = documentXml
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return fallbackText;
    }

    return extractedText;
  } catch (error) {
    console.error('[extract-text] DOCX parsing error:', error);
    throw new Error('Failed to parse DOCX file. The file may be corrupted or in an unsupported format.');
  }
}
