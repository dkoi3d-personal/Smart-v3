'use client';

interface Props {
  text: string;
  processingTime?: number;
  model?: string;
  loading?: boolean;
  error?: string | null;
}

export function OCRResults({ text, processingTime, model, loading, error }: Props) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border">
        <div className="flex items-center gap-3">
          <div className="animate-spin w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          <span>Processing document with AI...</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">This may take 10-30 seconds depending on document size</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
        <p className="text-red-600 dark:text-red-400 font-medium">OCR Error</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
      </div>
    );
  }

  if (!text) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border text-center text-gray-500">
        <p>Upload a document to extract text</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700 border-b flex items-center justify-between">
        <h3 className="font-medium">Extracted Text</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {model && <span>Model: {model}</span>}
          {processingTime && <span>{(processingTime / 1000).toFixed(1)}s</span>}
        </div>
      </div>
      <div className="p-4 max-h-96 overflow-y-auto">
        <pre className="whitespace-pre-wrap text-sm font-mono">{text}</pre>
      </div>
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-t flex gap-4">
        <button
          onClick={() => navigator.clipboard.writeText(text)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Copy to clipboard
        </button>
        <span className="text-sm text-gray-400">{text.length} characters</span>
      </div>
    </div>
  );
}
