'use client';

import { useState, useRef, useCallback } from 'react';
import type { PreviewState } from '../types';

interface UsePreviewOptions {
  onLog?: (message: string) => void;
}

export function usePreview(options: UsePreviewOptions = {}) {
  const [state, setState] = useState<PreviewState>({
    url: null,
    loading: false,
    error: null,
  });

  const iframeRef = useRef<HTMLIFrameElement>(null);

  const log = useCallback((message: string) => {
    options.onLog?.(message);
  }, [options]);

  const startPreview = useCallback(async (projectId: string) => {
    setState({ url: null, loading: true, error: null });
    log('Starting preview server...');

    try {
      const response = await fetch('/api/preview/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });

      const data = await response.json();

      if (data.success && data.url) {
        setState({ url: data.url, loading: false, error: null });
        log(`Preview ready at ${data.url}`);
        return data.url;
      } else {
        const error = data.error || 'Failed to start preview';
        setState({ url: null, loading: false, error });
        log(`Preview error: ${error}`);
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setState({ url: null, loading: false, error: errorMessage });
      log(`Preview error: ${errorMessage}`);
      return null;
    }
  }, [log]);

  const stopPreview = useCallback(async (projectId: string) => {
    try {
      await fetch('/api/preview/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId }),
      });
      setState({ url: null, loading: false, error: null });
      log('Preview stopped');
    } catch (error) {
      console.error('Failed to stop preview:', error);
    }
  }, [log]);

  const refreshPreview = useCallback(() => {
    if (iframeRef.current && state.url) {
      iframeRef.current.src = state.url;
    }
  }, [state.url]);

  return {
    ...state,
    iframeRef,
    startPreview,
    stopPreview,
    refreshPreview,
  };
}
