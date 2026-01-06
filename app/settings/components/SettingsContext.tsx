'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface ClaudeVerification {
  installed: boolean;
  authenticated: boolean;
  subscriptionType: string | null;
  accountEmail: string | null;
  version: string | null;
  error: string | null;
}

export interface MLXStatus {
  mlxAvailable: boolean;
  model: {
    name: string;
    available: boolean;
    path?: string;
    error?: string;
  };
  capabilities: string[];
  performance: {
    approximate_tokens_per_second: number;
    approximate_memory_gb: number;
  };
  error?: string;
}

export interface OllamaStatusUI {
  ollamaAvailable: boolean;
  deepseekOcrAvailable: boolean;
  deepseekModel?: {
    name: string;
    displayName: string;
    size: string;
  };
  models: Array<{ name: string; displayName: string; installed: boolean }>;
  capabilities: string[];
  error?: string;
}

export interface EpicStatus {
  configured: boolean;
  connected: boolean;
  hasPrivateKey: boolean;
  environment: string;
  clientId: string | null;
  tokenInfo: { expiresAt: string; tokenType?: string } | null;
}

export interface FigmaStatus {
  configured: boolean;
  hasEnvToken: boolean;
  lastValidated: string | null;
  accountEmail?: string;
  tokenMasked?: string;
}

export interface ProjectDirConfig {
  codingDirectory: string | null;
  defaultDirectory: string;
  activeDirectory: string;
  directoryExists: boolean;
  configuredAt: string | null;
  isConfigured: boolean;
}

export interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

export interface CredentialConfig {
  type: string;
  label: string;
  description: string;
  fields: CredentialField[];
  icon: string;
  docsUrl?: string;
}

export interface HealthcareSettings {
  includeEpicAPIs: boolean;
  includeTestPatients: boolean;
  includeFHIRExamples: boolean;
  ehrPlatform: 'epic' | 'cerner' | 'generic';
  complianceLevel: 'hipaa' | 'hipaa-hitrust' | 'basic';
}

export interface McpConfig {
  figmaMcpEnabled: boolean;
  memoryMcpEnabled: boolean;
  filesystemMcpEnabled: boolean;
  githubMcpEnabled: boolean;
  eslintMcpEnabled: boolean;
  lastUpdated: string | null;
}

// ============================================================================
// CONTEXT
// ============================================================================

interface SettingsContextType {
  // Claude
  claudeStatus: ClaudeVerification | null;
  verifyingClaude: boolean;
  verifyClaude: () => Promise<void>;
  isLoggingIn: boolean;
  fleetLoginProgress: string[];
  startFleetLogin: () => Promise<void>;
  switchClaudeAccount: () => Promise<void>;
  logoutClaude: () => Promise<boolean>;

  // Local AI
  mlxStatus: MLXStatus | null;
  mlxLoading: boolean;
  loadMLXStatus: () => Promise<void>;
  ollamaStatus: OllamaStatusUI | null;
  ollamaLoading: boolean;
  loadOllamaStatus: () => Promise<void>;

  // Epic
  epicStatus: EpicStatus | null;
  epicLoading: boolean;
  epicError: string | null;
  loadEpicStatus: () => Promise<void>;
  connectEpic: () => Promise<void>;
  disconnectEpic: () => Promise<void>;
  setEpicError: (error: string | null) => void;

  // Figma
  figmaStatus: FigmaStatus | null;
  figmaLoading: boolean;
  figmaError: string | null;
  loadFigmaStatus: () => Promise<void>;
  saveFigmaToken: (token: string) => Promise<boolean>;
  disconnectFigma: () => Promise<void>;
  testFigmaConnection: () => Promise<any>;
  setFigmaError: (error: string | null) => void;

  // Project Directory
  projectDirConfig: ProjectDirConfig | null;
  projectDirLoading: boolean;
  projectDirError: string | null;
  loadProjectDirConfig: () => Promise<void>;
  saveProjectDir: (dir: string) => Promise<boolean>;
  resetProjectDir: () => Promise<void>;
  setProjectDirError: (error: string | null) => void;

  // Credentials
  credentialConfigs: CredentialConfig[];
  credentialStatus: Record<string, boolean>;
  credentialsLoading: boolean;
  loadCredentials: () => Promise<void>;
  saveCredential: (type: string, values: Record<string, string>) => Promise<boolean>;
  deleteCredential: (type: string) => Promise<boolean>;
  testCredential: (type: string) => Promise<{ success: boolean; message: string }>;

  // Agent Mode
  agentMode: 'default' | 'healthcare';
  healthcareSettings: HealthcareSettings;
  agentModeLoading: boolean;
  loadAgentMode: () => Promise<void>;
  saveAgentMode: (mode: 'default' | 'healthcare', settings?: HealthcareSettings) => Promise<void>;

  // MCP Configuration
  mcpConfig: McpConfig | null;
  mcpLoading: boolean;
  loadMcpConfig: () => Promise<void>;
  saveMcpConfig: (config: Partial<McpConfig>) => Promise<boolean>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within SettingsProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER
// ============================================================================

export function SettingsProvider({ children }: { children: ReactNode }) {
  // Claude state
  const [claudeStatus, setClaudeStatus] = useState<ClaudeVerification | null>(null);
  const [verifyingClaude, setVerifyingClaude] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [fleetLoginProgress, setFleetLoginProgress] = useState<string[]>([]);

  // Local AI state
  const [mlxStatus, setMlxStatus] = useState<MLXStatus | null>(null);
  const [mlxLoading, setMlxLoading] = useState(false);
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatusUI | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // Epic state
  const [epicStatus, setEpicStatus] = useState<EpicStatus | null>(null);
  const [epicLoading, setEpicLoading] = useState(false);
  const [epicError, setEpicError] = useState<string | null>(null);

  // Figma state
  const [figmaStatus, setFigmaStatus] = useState<FigmaStatus | null>(null);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<string | null>(null);

  // Project Directory state
  const [projectDirConfig, setProjectDirConfig] = useState<ProjectDirConfig | null>(null);
  const [projectDirLoading, setProjectDirLoading] = useState(false);
  const [projectDirError, setProjectDirError] = useState<string | null>(null);

  // Credentials state
  const [credentialConfigs, setCredentialConfigs] = useState<CredentialConfig[]>([]);
  const [credentialStatus, setCredentialStatus] = useState<Record<string, boolean>>({});
  const [credentialsLoading, setCredentialsLoading] = useState(false);

  // Agent Mode state
  const [agentMode, setAgentMode] = useState<'default' | 'healthcare'>('default');
  const [healthcareSettings, setHealthcareSettings] = useState<HealthcareSettings>({
    includeEpicAPIs: true,
    includeTestPatients: true,
    includeFHIRExamples: true,
    ehrPlatform: 'generic',
    complianceLevel: 'hipaa',
  });
  const [agentModeLoading, setAgentModeLoading] = useState(false);

  // MCP state
  const [mcpConfig, setMcpConfig] = useState<McpConfig | null>(null);
  const [mcpLoading, setMcpLoading] = useState(false);

  // ============================================================================
  // CLAUDE FUNCTIONS
  // ============================================================================

  const verifyClaude = useCallback(async () => {
    setVerifyingClaude(true);
    try {
      const response = await fetch('/api/setup/verify-claude');
      const data: ClaudeVerification = await response.json();
      setClaudeStatus(data);
    } catch (err) {
      setClaudeStatus({
        installed: false,
        authenticated: false,
        subscriptionType: null,
        accountEmail: null,
        version: null,
        error: 'Failed to verify Claude CLI',
      });
    } finally {
      setVerifyingClaude(false);
    }
  }, []);

  const startFleetLogin = useCallback(async () => {
    setIsLoggingIn(true);
    setFleetLoginProgress([]);

    try {
      const res = await fetch('/api/claude-account/login', { method: 'POST' });
      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              setFleetLoginProgress((prev) => [...prev, data.message]);
              if (data.type === 'success' || data.type === 'error') {
                if (data.status) {
                  // Refresh claude status
                  verifyClaude();
                }
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setFleetLoginProgress((prev) => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsLoggingIn(false);
      verifyClaude();
    }
  }, [verifyClaude]);

  const switchClaudeAccount = useCallback(async () => {
    setIsLoggingIn(true);
    setFleetLoginProgress(['Switching accounts...']);

    try {
      // Use URL param for more reliable action detection
      const res = await fetch('/api/claude-account/login?action=switch', {
        method: 'POST',
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.message) {
                setFleetLoginProgress((prev) => [...prev, data.message]);
              }
              if (data.type === 'success' || data.type === 'error') {
                if (data.status) {
                  verifyClaude();
                }
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      console.error('[switchClaudeAccount] Error:', err);
      setFleetLoginProgress((prev) => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsLoggingIn(false);
      verifyClaude();
    }
  }, [verifyClaude]);

  const logoutClaude = useCallback(async (): Promise<boolean> => {
    setFleetLoginProgress(['Logging out...']);
    try {
      const res = await fetch('/api/claude-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      const data = await res.json();
      if (data.success) {
        setFleetLoginProgress((prev) => [...prev, 'Logged out successfully']);
        await verifyClaude();
        return true;
      } else {
        setFleetLoginProgress((prev) => [...prev, data.error || 'Logout failed']);
        return false;
      }
    } catch (err: any) {
      setFleetLoginProgress((prev) => [...prev, `Error: ${err.message}`]);
      return false;
    }
  }, [verifyClaude]);

  // ============================================================================
  // LOCAL AI FUNCTIONS
  // ============================================================================

  const loadMLXStatus = useCallback(async () => {
    setMlxLoading(true);
    try {
      const response = await fetch('/api/mlx/ocr');
      const data = await response.json();
      setMlxStatus(data);
    } catch (err) {
      setMlxStatus({
        mlxAvailable: false,
        model: { name: 'DeepSeek-OCR-4bit', available: false, error: 'Failed to connect' },
        capabilities: [],
        performance: { approximate_tokens_per_second: 0, approximate_memory_gb: 0 },
        error: 'Failed to connect to MLX API',
      });
    } finally {
      setMlxLoading(false);
    }
  }, []);

  const loadOllamaStatus = useCallback(async () => {
    setOllamaLoading(true);
    try {
      const response = await fetch('/api/ollama');
      const data = await response.json();
      const deepseekModel = data.models?.find(
        (m: any) => m.name.includes('deepseek-ocr') && m.installed
      );
      setOllamaStatus({
        ollamaAvailable: data.running,
        models: data.models || [],
        deepseekOcrAvailable: !!deepseekModel,
        deepseekModel: deepseekModel
          ? {
              name: deepseekModel.name,
              displayName: deepseekModel.displayName,
              size: deepseekModel.size,
            }
          : undefined,
        capabilities: deepseekModel?.capabilities || [],
        error: data.error,
      });
    } catch (err) {
      setOllamaStatus({
        ollamaAvailable: false,
        models: [],
        deepseekOcrAvailable: false,
        capabilities: [],
        error: 'Failed to connect to Ollama',
      });
    } finally {
      setOllamaLoading(false);
    }
  }, []);

  // ============================================================================
  // EPIC FUNCTIONS
  // ============================================================================

  const loadEpicStatus = useCallback(async () => {
    setEpicLoading(true);
    try {
      const response = await fetch('/api/epic');
      if (response.ok) {
        const data = await response.json();
        setEpicStatus(data);
      }
    } catch (err) {
      console.error('Failed to load Epic status:', err);
    } finally {
      setEpicLoading(false);
    }
  }, []);

  const connectEpic = useCallback(async () => {
    setEpicLoading(true);
    setEpicError(null);
    try {
      const response = await fetch('/api/epic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appType: 'patient-portal' }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start connection');
      }
      const data = await response.json();
      window.location.href = data.authorizationUrl;
    } catch (err: any) {
      setEpicError(err.message);
      setEpicLoading(false);
    }
  }, []);

  const disconnectEpic = useCallback(async () => {
    setEpicLoading(true);
    try {
      await fetch('/api/epic', { method: 'DELETE' });
      await loadEpicStatus();
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setEpicLoading(false);
    }
  }, [loadEpicStatus]);

  // ============================================================================
  // FIGMA FUNCTIONS
  // ============================================================================

  const loadFigmaStatus = useCallback(async () => {
    setFigmaLoading(true);
    try {
      const response = await fetch('/api/settings/figma');
      if (response.ok) {
        const data = await response.json();
        setFigmaStatus(data);
      }
    } catch (err) {
      console.error('Failed to load Figma status:', err);
    } finally {
      setFigmaLoading(false);
    }
  }, []);

  const saveFigmaToken = useCallback(
    async (token: string): Promise<boolean> => {
      setFigmaError(null);
      try {
        const response = await fetch('/api/settings/figma', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: token.trim() }),
        });
        const data = await response.json();

        if (response.ok) {
          await loadFigmaStatus();
          return true;
        } else {
          setFigmaError(data.details || data.error || 'Failed to save token');
          return false;
        }
      } catch (err) {
        setFigmaError(err instanceof Error ? err.message : 'Failed to save token');
        return false;
      }
    },
    [loadFigmaStatus]
  );

  const disconnectFigma = useCallback(async () => {
    setFigmaLoading(true);
    try {
      await fetch('/api/settings/figma', { method: 'DELETE' });
      await loadFigmaStatus();
    } catch (err) {
      setFigmaError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setFigmaLoading(false);
    }
  }, [loadFigmaStatus]);

  const testFigmaConnection = useCallback(async () => {
    setFigmaError(null);
    try {
      const response = await fetch('/api/settings/figma/test', { method: 'POST' });
      const data = await response.json();
      if (!data.success) {
        setFigmaError(data.error);
      }
      return data;
    } catch (err) {
      setFigmaError(err instanceof Error ? err.message : 'Test failed');
      return { success: false, error: 'Connection test failed' };
    }
  }, []);

  // ============================================================================
  // PROJECT DIRECTORY FUNCTIONS
  // ============================================================================

  const loadProjectDirConfig = useCallback(async () => {
    setProjectDirLoading(true);
    try {
      const response = await fetch('/api/config/coding-directory');
      const data = await response.json();
      setProjectDirConfig(data);
    } catch (err) {
      console.error('Failed to load project directory config:', err);
    } finally {
      setProjectDirLoading(false);
    }
  }, []);

  const saveProjectDir = useCallback(
    async (dir: string): Promise<boolean> => {
      setProjectDirError(null);
      try {
        const response = await fetch('/api/config/coding-directory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ codingDirectory: dir.trim() }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save directory');
        }
        await loadProjectDirConfig();
        return true;
      } catch (err: any) {
        setProjectDirError(err.message);
        return false;
      }
    },
    [loadProjectDirConfig]
  );

  const resetProjectDir = useCallback(async () => {
    setProjectDirLoading(true);
    setProjectDirError(null);
    try {
      const response = await fetch('/api/config/coding-directory', { method: 'DELETE' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to reset directory');
      }
      await loadProjectDirConfig();
    } catch (err: any) {
      setProjectDirError(err.message);
    } finally {
      setProjectDirLoading(false);
    }
  }, [loadProjectDirConfig]);

  // ============================================================================
  // CREDENTIALS FUNCTIONS
  // ============================================================================

  const loadCredentials = useCallback(async () => {
    setCredentialsLoading(true);
    try {
      const response = await fetch('/api/credentials');
      if (!response.ok) throw new Error('Failed to load credentials');
      const data = await response.json();
      setCredentialConfigs(data.configs || []);
      setCredentialStatus(data.status || {});
    } catch (err) {
      console.error('Failed to load credentials:', err);
    } finally {
      setCredentialsLoading(false);
    }
  }, []);

  const saveCredential = useCallback(
    async (type: string, values: Record<string, string>): Promise<boolean> => {
      try {
        const response = await fetch('/api/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, values }),
        });
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Failed to save credentials');
        }
        await loadCredentials();
        return true;
      } catch (err) {
        console.error('Save credential error:', err);
        return false;
      }
    },
    [loadCredentials]
  );

  const deleteCredential = useCallback(
    async (type: string): Promise<boolean> => {
      try {
        const response = await fetch(`/api/credentials?type=${type}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete credentials');
        await loadCredentials();
        return true;
      } catch (err) {
        console.error('Delete credential error:', err);
        return false;
      }
    },
    [loadCredentials]
  );

  const testCredential = useCallback(
    async (type: string): Promise<{ success: boolean; message: string }> => {
      try {
        const response = await fetch(`/api/credentials/${type}/test`, { method: 'POST' });
        return await response.json();
      } catch (err) {
        return {
          success: false,
          message: err instanceof Error ? err.message : 'Test failed',
        };
      }
    },
    []
  );

  // ============================================================================
  // AGENT MODE FUNCTIONS
  // ============================================================================

  const loadAgentMode = useCallback(async () => {
    setAgentModeLoading(true);
    try {
      const response = await fetch('/api/config/agent-mode');
      if (response.ok) {
        const data = await response.json();
        setAgentMode(data.mode);
        if (data.healthcareSettings) {
          setHealthcareSettings(data.healthcareSettings);
        }
      }
    } catch (err) {
      console.error('Failed to load agent mode config:', err);
    } finally {
      setAgentModeLoading(false);
    }
  }, []);

  const saveAgentMode = useCallback(
    async (mode: 'default' | 'healthcare', settings?: HealthcareSettings) => {
      setAgentModeLoading(true);
      try {
        const response = await fetch('/api/config/agent-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode,
            healthcareSettings: settings || healthcareSettings,
          }),
        });
        if (response.ok) {
          setAgentMode(mode);
          if (settings) {
            setHealthcareSettings(settings);
          }
        }
      } catch (err) {
        console.error('Failed to save agent mode config:', err);
      } finally {
        setAgentModeLoading(false);
      }
    },
    [healthcareSettings]
  );

  // ============================================================================
  // MCP FUNCTIONS
  // ============================================================================

  const loadMcpConfig = useCallback(async () => {
    setMcpLoading(true);
    try {
      const response = await fetch('/api/settings/mcp');
      if (response.ok) {
        const data = await response.json();
        setMcpConfig(data);
      }
    } catch (err) {
      console.error('Failed to load MCP config:', err);
    } finally {
      setMcpLoading(false);
    }
  }, []);

  const saveMcpConfig = useCallback(
    async (config: Partial<McpConfig>): Promise<boolean> => {
      try {
        const response = await fetch('/api/settings/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(config),
        });
        if (response.ok) {
          await loadMcpConfig();
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to save MCP config:', err);
        return false;
      }
    },
    [loadMcpConfig]
  );

  // ============================================================================
  // INITIAL LOAD
  // ============================================================================

  useEffect(() => {
    verifyClaude();
    loadMLXStatus();
    loadOllamaStatus();
    loadEpicStatus();
    loadFigmaStatus();
    loadProjectDirConfig();
    loadCredentials();
    loadAgentMode();
    loadMcpConfig();
  }, [
    verifyClaude,
    loadMLXStatus,
    loadOllamaStatus,
    loadEpicStatus,
    loadFigmaStatus,
    loadProjectDirConfig,
    loadCredentials,
    loadAgentMode,
    loadMcpConfig,
  ]);

  // Check for Epic OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('epicConnected') === 'true') {
      loadEpicStatus();
      window.history.replaceState({}, '', '/settings');
    }
    if (params.get('epicError')) {
      setEpicError(decodeURIComponent(params.get('epicError') || 'Connection failed'));
      window.history.replaceState({}, '', '/settings');
    }
  }, [loadEpicStatus]);

  const value: SettingsContextType = {
    // Claude
    claudeStatus,
    verifyingClaude,
    verifyClaude,
    isLoggingIn,
    fleetLoginProgress,
    startFleetLogin,
    switchClaudeAccount,
    logoutClaude,

    // Local AI
    mlxStatus,
    mlxLoading,
    loadMLXStatus,
    ollamaStatus,
    ollamaLoading,
    loadOllamaStatus,

    // Epic
    epicStatus,
    epicLoading,
    epicError,
    loadEpicStatus,
    connectEpic,
    disconnectEpic,
    setEpicError,

    // Figma
    figmaStatus,
    figmaLoading,
    figmaError,
    loadFigmaStatus,
    saveFigmaToken,
    disconnectFigma,
    testFigmaConnection,
    setFigmaError,

    // Project Directory
    projectDirConfig,
    projectDirLoading,
    projectDirError,
    loadProjectDirConfig,
    saveProjectDir,
    resetProjectDir,
    setProjectDirError,

    // Credentials
    credentialConfigs,
    credentialStatus,
    credentialsLoading,
    loadCredentials,
    saveCredential,
    deleteCredential,
    testCredential,

    // Agent Mode
    agentMode,
    healthcareSettings,
    agentModeLoading,
    loadAgentMode,
    saveAgentMode,

    // MCP
    mcpConfig,
    mcpLoading,
    loadMcpConfig,
    saveMcpConfig,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
