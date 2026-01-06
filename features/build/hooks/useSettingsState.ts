'use client';

import React, { useState, useCallback } from 'react';
import type { QuickSettings } from '../types';
import { DEFAULT_QUICK_SETTINGS } from '../constants';

export interface UseSettingsStateReturn {
  // Coder configuration
  parallelCoders: number;
  setParallelCoders: (count: number) => void;
  batchMode: boolean;
  setBatchMode: (enabled: boolean) => void;
  batchSize: number;
  setBatchSize: (size: number) => void;

  // Agent configs
  agentConfigs: Record<string, any>;
  setAgentConfigs: (configs: Record<string, any>) => void;

  // Quick settings
  quickSettings: QuickSettings;
  setQuickSettings: React.Dispatch<React.SetStateAction<QuickSettings>>;

  // Save state
  savingSettings: boolean;
  settingsSuccess: string | null;
  setSettingsSuccess: (message: string | null) => void;

  // Actions
  loadAgentConfig: () => Promise<void>;
  saveQuickSettings: () => Promise<void>;
}

export function useSettingsState(): UseSettingsStateReturn {
  // Coder configuration
  const [parallelCoders, setParallelCoders] = useState(1);
  const [batchMode, setBatchMode] = useState(false);
  const [batchSize, setBatchSize] = useState(3);

  // Agent configs
  const [agentConfigs, setAgentConfigs] = useState<Record<string, any>>({});

  // Quick settings
  const [quickSettings, setQuickSettings] = useState<QuickSettings>(DEFAULT_QUICK_SETTINGS);

  // Save state
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState<string | null>(null);

  // Load agent config from API
  const loadAgentConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/agent-config');
      if (response.ok) {
        const config = await response.json();
        // Apply quick settings
        if (config.quickSettings) {
          setParallelCoders(config.quickSettings.parallelCoders || 1);
          setBatchMode(false); // Batch mode only available with single coder
          setQuickSettings(prev => ({
            ...prev,
            minStories: config.quickSettings.minStories ?? prev.minStories,
            maxStories: config.quickSettings.maxStories ?? prev.maxStories,
            minEpics: config.quickSettings.minEpics ?? prev.minEpics,
            maxEpics: config.quickSettings.maxEpics ?? prev.maxEpics,
            maxRetries: config.quickSettings.maxRetries ?? prev.maxRetries,
            requireTests: config.quickSettings.requireTests ?? prev.requireTests,
            minCoverage: config.quickSettings.minCoverage ?? prev.minCoverage,
            parallelCoders: config.quickSettings.parallelCoders ?? prev.parallelCoders,
            parallelTesters: config.quickSettings.parallelTesters ?? prev.parallelTesters,
            securityScanEnabled: config.quickSettings.securityScanEnabled ?? prev.securityScanEnabled,
            blockOnCritical: config.quickSettings.blockOnCritical ?? prev.blockOnCritical,
            defaultModel: config.quickSettings.defaultModel ?? prev.defaultModel,
            maxTurnsPerAgent: config.quickSettings.maxTurnsPerAgent ?? prev.maxTurnsPerAgent,
            verboseLogging: config.quickSettings.verboseLogging ?? prev.verboseLogging,
          }));
          console.log(`⚙️ Loaded agent config: ${config.quickSettings.parallelCoders} coders, ${config.quickSettings.parallelTesters} testers`);
        }
        if (config.agents) {
          setAgentConfigs(config.agents);
        }
      }
    } catch (err) {
      console.error('Failed to load agent config:', err);
    }
  }, []);

  // Save quick settings to API
  const saveQuickSettings = useCallback(async () => {
    setSavingSettings(true);
    setSettingsSuccess(null);

    try {
      const response = await fetch('/api/agent-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quickSettings: {
            ...quickSettings,
            parallelCoders,
          },
          agents: agentConfigs,
        }),
      });

      if (response.ok) {
        setSettingsSuccess('Settings saved successfully');
        setTimeout(() => setSettingsSuccess(null), 3000);
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSettingsSuccess(null);
    } finally {
      setSavingSettings(false);
    }
  }, [quickSettings, parallelCoders, agentConfigs]);

  return {
    // Coder configuration
    parallelCoders,
    setParallelCoders,
    batchMode,
    setBatchMode,
    batchSize,
    setBatchSize,

    // Agent configs
    agentConfigs,
    setAgentConfigs,

    // Quick settings
    quickSettings,
    setQuickSettings,

    // Save state
    savingSettings,
    settingsSuccess,
    setSettingsSuccess,

    // Actions
    loadAgentConfig,
    saveQuickSettings,
  };
}
