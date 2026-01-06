'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  onUpload: (base64: string, fileName: string) => void;
  disabled?: boolean;
  accept?: string;
}

export function DocumentUploader({ onUpload, disabled, accept = 'image/*,.pdf' }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');

  const handleFile = useCallback((file: File) => {
    if (!file) return;

    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreview(result);
      // Extract base64 without data URL prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      onUpload(base64, file.name);
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const clearPreview = () => {
    setPreview(null);
    setFileName('');
  };

  return (
    <div className="space-y-4">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          isDragging ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20" : "border-gray-300 dark:border-gray-700",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          type="file"
          accept={accept}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          disabled={disabled}
          className="hidden"
          id="file-upload"
        />
        <label htmlFor="file-upload" className={cn("cursor-pointer", disabled && "cursor-not-allowed")}>
          <div className="text-4xl mb-2">📄</div>
          <p className="text-lg font-medium mb-1">
            {isDragging ? 'Drop your document here' : 'Upload Medical Document'}
          </p>
          <p className="text-sm text-gray-500">
            Drag & drop or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Supports: Images (PNG, JPG), PDFs
          </p>
        </label>
      </div>

      {preview && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium truncate">{fileName}</span>
            <button
              onClick={clearPreview}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              ✕
            </button>
          </div>
          {preview.startsWith('data:image') && (
            <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded" />
          )}
          {preview.startsWith('data:application/pdf') && (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl">📑</span>
              <p className="mt-2">PDF uploaded - ready for OCR</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
