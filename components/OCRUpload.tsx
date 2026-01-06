'use client';

/**
 * OCR Upload Component
 *
 * Reusable component for uploading images and extracting text via MLX OCR.
 * Can be copied into generated applications.
 *
 * Features:
 * - Drag and drop file upload
 * - Click to browse files
 * - Multiple OCR modes (document, general, figure, free)
 * - Real-time processing status
 * - Extracted text display with copy functionality
 * - Bounding box visualization (optional)
 *
 * Usage:
 *   <OCRUpload
 *     onResult={(result) => console.log(result.text)}
 *     mode="document"
 *   />
 */

import { useState, useCallback, useRef } from 'react';
import { Upload, FileImage, Loader2, Copy, Check, AlertCircle, X, ScanText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

// OCR Result type
export interface OCRResult {
  text: string;
  boundingBoxes?: Array<{
    text: string;
    coordinates: [number, number, number, number];
    page?: number; // For multi-page PDFs
  }>;
  tokensPerSecond: number;
  peakMemoryGB: number;
  totalTokens: number;
  pageCount?: number; // For PDFs - number of pages processed
}

// Component props
export interface OCRUploadProps {
  /** Callback when OCR completes successfully */
  onResult?: (result: OCRResult) => void;
  /** Callback when error occurs */
  onError?: (error: string) => void;
  /** Default OCR mode */
  mode?: 'document' | 'general' | 'figure' | 'free';
  /** Custom prompt for 'free' mode */
  customPrompt?: string;
  /** Whether to show mode selector */
  showModeSelector?: boolean;
  /** Whether to show result preview */
  showPreview?: boolean;
  /** Custom className for container */
  className?: string;
  /** Accepted file types (default: images and PDFs) */
  accept?: string;
  /** Max file size in bytes (default 10MB) */
  maxSize?: number;
  /** API base URL for OCR endpoint (default: http://localhost:3000 for generated apps) */
  apiBaseUrl?: string;
}

// Supported file types
const SUPPORTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'application/pdf'];

// Mode descriptions
const MODE_DESCRIPTIONS = {
  document: 'Best for forms, documents, receipts. Converts to markdown.',
  general: 'General-purpose OCR for any image with text.',
  figure: 'Optimized for charts, diagrams, and figures.',
  free: 'Use a custom prompt for specific extraction needs.',
};

export function OCRUpload({
  onResult,
  onError,
  mode: defaultMode = 'document',
  customPrompt,
  showModeSelector = true,
  showPreview = true,
  className,
  accept = 'image/*,.pdf,application/pdf',
  maxSize = 20 * 1024 * 1024, // 20MB for PDFs
  apiBaseUrl = 'http://localhost:3000', // Default to platform URL for generated apps
}: OCRUploadProps) {
  const [isPdf, setIsPdf] = useState(false);
  const [pageCount, setPageCount] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [mode, setMode] = useState<'document' | 'general' | 'figure' | 'free'>(defaultMode);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFile = useCallback(async (selectedFile: File) => {
    // Validate file type
    const isImage = selectedFile.type.startsWith('image/');
    const isPdfFile = selectedFile.type === 'application/pdf';

    if (!isImage && !isPdfFile) {
      const err = 'Please select an image or PDF file';
      setError(err);
      onError?.(err);
      return;
    }

    // Validate file size
    if (selectedFile.size > maxSize) {
      const err = `File too large. Max size is ${Math.round(maxSize / 1024 / 1024)}MB`;
      setError(err);
      onError?.(err);
      return;
    }

    setFile(selectedFile);
    setError(null);
    setResult(null);
    setIsPdf(isPdfFile);
    setPageCount(0);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
  }, [maxSize, onError]);

  // Process OCR
  const processOCR = useCallback(async () => {
    if (!file || !preview) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/api/mlx/ocr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: preview, // base64 data URI
          mode,
          prompt: mode === 'free' ? customPrompt : undefined,
          isPdf, // Flag for PDF processing
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'OCR failed');
      }

      // Handle multi-page results (PDFs)
      if (data.pageCount) {
        setPageCount(data.pageCount);
      }

      setResult(data);
      onResult?.(data);
    } catch (err: any) {
      const errorMsg = err.message || 'OCR processing failed';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsProcessing(false);
    }
  }, [file, preview, mode, customPrompt, isPdf, onResult, onError]);

  // Copy result to clipboard
  const copyToClipboard = useCallback(async () => {
    if (!result?.text) return;

    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [result?.text]);

  // Clear everything
  const clear = useCallback(() => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setIsPdf(false);
    setPageCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Drag handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  }, [handleFile]);

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ScanText className="h-5 w-5 text-orange-500" />
          OCR Document Scanner
        </CardTitle>
        <CardDescription>
          Upload an image or PDF to extract text using local AI (MLX DeepSeek-OCR)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Mode Selector */}
        {showModeSelector && (
          <div className="space-y-2">
            <label className="text-sm font-medium">OCR Mode</label>
            <Select value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="document">Document (Forms, Receipts)</SelectItem>
                <SelectItem value="general">General (Any Image)</SelectItem>
                <SelectItem value="figure">Figure (Charts, Diagrams)</SelectItem>
                <SelectItem value="free">Custom Prompt</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{MODE_DESCRIPTIONS[mode]}</p>
          </div>
        )}

        {/* Drop Zone */}
        {!preview ? (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
              isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50',
              'hover:bg-muted/50'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={accept}
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="font-medium">Drop file here or click to browse</p>
            <p className="text-sm text-muted-foreground mt-1">
              PNG, JPG, WEBP, PDF up to {Math.round(maxSize / 1024 / 1024)}MB
            </p>
          </div>
        ) : (
          /* Preview */
          <div className="space-y-4">
            <div className="relative rounded-lg overflow-hidden bg-muted">
              {isPdf ? (
                <div className="flex flex-col items-center justify-center p-8 bg-muted">
                  <FileImage className="h-16 w-16 text-red-500 mb-2" />
                  <p className="font-medium">{file?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    PDF Document • {file ? Math.round(file.size / 1024) : 0} KB
                  </p>
                  {pageCount > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">{pageCount} pages processed</p>
                  )}
                </div>
              ) : (
                <img
                  src={preview}
                  alt="Preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
              )}
              <Button
                variant="destructive"
                size="icon"
                className="absolute top-2 right-2 h-8 w-8"
                onClick={clear}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Process Button */}
            <Button
              onClick={processOCR}
              disabled={isProcessing}
              className="w-full"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing OCR...
                </>
              ) : (
                <>
                  <ScanText className="h-4 w-4 mr-2" />
                  Extract Text
                </>
              )}
            </Button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {/* Result Display */}
        {showPreview && result && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Extracted Text</h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{result.tokensPerSecond?.toFixed(0) || 'N/A'} tok/s</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  onClick={copyToClipboard}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-muted/50 max-h-64 overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-mono">{result.text}</pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default OCRUpload;
