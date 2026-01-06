'use client';

import { useState, useCallback } from 'react';

export interface UseAIEnhanceOptions {
  /** Optional context about the project/domain */
  context?: string;
  /** Callback when enhancement completes */
  onSuccess?: (enhanced: string, original: string) => void;
  /** Callback when enhancement fails */
  onError?: (error: string) => void;
}

export interface UseAIEnhanceReturn {
  /** Enhance the given text */
  enhance: (text: string) => Promise<string | null>;
  /** Whether enhancement is in progress */
  isEnhancing: boolean;
  /** Error message if enhancement failed */
  error: string | null;
  /** Clear any error */
  clearError: () => void;
}

/**
 * Hook for AI-powered text enhancement
 *
 * @example
 * ```tsx
 * const { enhance, isEnhancing } = useAIEnhance({
 *   context: 'React TypeScript project',
 *   onSuccess: (enhanced) => setPrompt(enhanced),
 * });
 *
 * <Button onClick={() => enhance(prompt)} disabled={isEnhancing}>
 *   {isEnhancing ? 'Enhancing...' : 'Enhance'}
 * </Button>
 * ```
 */
export function useAIEnhance(options: UseAIEnhanceOptions = {}): UseAIEnhanceReturn {
  const { context, onSuccess, onError } = options;
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enhance = useCallback(async (text: string): Promise<string | null> => {
    if (!text.trim()) {
      setError('Please enter some text to enhance');
      return null;
    }

    setIsEnhancing(true);
    setError(null);

    try {
      const response = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          projectContext: context,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to enhance text');
      }

      const { enhancedPrompt, originalPrompt } = await response.json();

      onSuccess?.(enhancedPrompt, originalPrompt);
      return enhancedPrompt;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to enhance text';
      setError(message);
      onError?.(message);
      return null;
    } finally {
      setIsEnhancing(false);
    }
  }, [context, onSuccess, onError]);

  const clearError = useCallback(() => setError(null), []);

  return {
    enhance,
    isEnhancing,
    error,
    clearError,
  };
}
