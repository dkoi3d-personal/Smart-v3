'use client';

import { useState, useEffect, useCallback } from 'react';

export interface EpicConnectionStatus {
  configured: boolean;
  connected: boolean;
  hasPrivateKey: boolean;
  environment: string;
  clientId: string | null;
  tokenInfo: { expiresAt: string; tokenType?: string } | null;
}

interface UseEpicStatusReturn {
  status: EpicConnectionStatus | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to check Epic FHIR API connection status
 * Used by Quick Build to verify EPIC is connected before building healthcare apps
 */
export function useEpicStatus(): UseEpicStatusReturn {
  const [status, setStatus] = useState<EpicConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/epic');
      if (!response.ok) {
        throw new Error('Failed to check Epic status');
      }
      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, refresh };
}

export default useEpicStatus;
