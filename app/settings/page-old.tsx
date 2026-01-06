'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ArrowLeft,
  Key,
  Shield,
  Check,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Github,
  Cloud,
  Bot,
  Database,
  Container,
  Loader2,
  AlertCircle,
  Settings,
  Lock,
  Play,
  CheckCircle,
  XCircle,
  Terminal,
  RefreshCw,
  Heart,
  Plug,
  Unplug,
  FlaskConical,
  Cpu,
  ScanText,
  ImageIcon,
  Code,
  MessageSquare,
  Brain,
  Sparkles,
  Zap,
  Server,
  FolderOpen,
  HardDrive,
  FolderCog,
  Users,
  Paintbrush,
  Figma,
} from 'lucide-react';

// Platform icons as SVG components
const AppleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
  </svg>
);

const WindowsIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 12V6.75l6-1v6.5H3zm7 0V5.5l8-1.25V12h-8zm0 1h8v7.75l-8-1.25V13zm-7 0h6v6.25l-6-1V13z"/>
  </svg>
);

import { cn } from '@/lib/utils';

// Claude CLI verification result type
interface ClaudeVerification {
  installed: boolean;
  authenticated: boolean;
  subscriptionType: string | null;
  accountEmail: string | null;
  version: string | null;
  error: string | null;
}

// MLX/Local AI types
interface MLXStatus {
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

// Ollama/Local AI types (Windows/Linux) - matches lib/ollama/types.ts
interface OllamaStatusResponse {
  running: boolean;
  version?: string;
  models: Array<{
    name: string;
    displayName: string;
    size: string;
    capabilities: string[];
    description: string;
    installed: boolean;
  }>;
  error?: string;
}

interface OllamaStatusUI {
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

// Capability icons mapping
const CAPABILITY_ICONS: Record<string, any> = {
  ocr: ScanText,
  vision: ImageIcon,
  code: Code,
  chat: MessageSquare,
  reasoning: Brain,
  embedding: Sparkles,
  grounding: ScanText,
};

// Types matching the backend
interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
}

interface CredentialConfig {
  type: string;
  label: string;
  description: string;
  fields: CredentialField[];
  icon: string;
  docsUrl?: string;
}

// Icon mapping
const ICONS: Record<string, any> = {
  Github,
  Cloud,
  Bot,
  Database,
  Container,
  Heart,
};

// Status Indicator component for header quick status
function StatusIndicator({ status }: { status: 'success' | 'warning' | 'error' | 'inactive' }) {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    inactive: 'bg-gray-400',
  };
  return <div className={cn('h-2.5 w-2.5 rounded-full', colors[status])} />;
}

export default function SettingsPage() {
  const router = useRouter();
  const [configs, setConfigs] = useState<CredentialConfig[]>([]);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Claude CLI verification state
  const [claudeStatus, setClaudeStatus] = useState<ClaudeVerification | null>(null);
  const [verifyingClaude, setVerifyingClaude] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<CredentialConfig | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteType, setDeleteType] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // View dialog state
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [viewConfig, setViewConfig] = useState<CredentialConfig | null>(null);
  const [viewValues, setViewValues] = useState<Record<string, string>>({});
  const [viewMasked, setViewMasked] = useState<Record<string, string>>({});
  const [viewRevealed, setViewRevealed] = useState<Record<string, boolean>>({});
  const [loadingView, setLoadingView] = useState(false);

  // Test state
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string; details?: any }>>({});

  // Epic Healthcare state
  const [epicStatus, setEpicStatus] = useState<{
    configured: boolean;
    connected: boolean;
    hasPrivateKey: boolean;
    environment: string;
    clientId: string | null;
    tokenInfo: { expiresAt: string; tokenType?: string } | null;
  } | null>(null);
  const [epicLoading, setEpicLoading] = useState(false);
  const [epicError, setEpicError] = useState<string | null>(null);

  // Epic Token Paste Dialog state
  const [epicTokenDialogOpen, setEpicTokenDialogOpen] = useState(false);
  const [epicTokenInput, setEpicTokenInput] = useState('');
  const [epicPatientIdInput, setEpicPatientIdInput] = useState('');
  const [savingEpicToken, setSavingEpicToken] = useState(false);

  // Figma Integration state
  const [figmaStatus, setFigmaStatus] = useState<{
    configured: boolean;
    hasEnvToken: boolean;
    lastValidated: string | null;
    accountEmail?: string;
    tokenMasked?: string;
  } | null>(null);
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState<string | null>(null);
  const [figmaDialogOpen, setFigmaDialogOpen] = useState(false);
  const [figmaTokenInput, setFigmaTokenInput] = useState('');
  const [savingFigmaToken, setSavingFigmaToken] = useState(false);
  const [figmaTesting, setFigmaTesting] = useState(false);
  const [figmaTestResult, setFigmaTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    user?: { email: string };
    recentFile?: { name: string; key: string; thumbnail: string };
  } | null>(null);

  // MLX/Local AI state
  const [mlxStatus, setMlxStatus] = useState<MLXStatus | null>(null);
  const [mlxLoading, setMlxLoading] = useState(false);

  // Ollama/Local AI state (Windows/Linux)
  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatusUI | null>(null);
  const [ollamaLoading, setOllamaLoading] = useState(false);

  // Project Directory state
  const [projectDirConfig, setProjectDirConfig] = useState<{
    codingDirectory: string | null;
    defaultDirectory: string;
    activeDirectory: string;
    directoryExists: boolean;
    configuredAt: string | null;
    isConfigured: boolean;
  } | null>(null);
  const [projectDirLoading, setProjectDirLoading] = useState(false);
  const [projectDirDialogOpen, setProjectDirDialogOpen] = useState(false);
  const [newProjectDir, setNewProjectDir] = useState('');
  const [savingProjectDir, setSavingProjectDir] = useState(false);
  const [projectDirError, setProjectDirError] = useState<string | null>(null);

  // Agent Mode state
  const [agentMode, setAgentMode] = useState<'default' | 'healthcare'>('default');
  const [agentModeLoading, setAgentModeLoading] = useState(false);
  const [healthcareSettings, setHealthcareSettings] = useState({
    includeEpicAPIs: true,
    includeTestPatients: true,
    includeFHIRExamples: true,
    ehrPlatform: 'generic' as 'epic' | 'cerner' | 'generic',
    complianceLevel: 'hipaa' as 'hipaa' | 'hipaa-hitrust' | 'basic',
  });

  // Fleet Claude Account state (separate from developer's CLI)
  const [fleetAccountStatus, setFleetAccountStatus] = useState<{
    isLoggedIn: boolean;
    email?: string;
    accountType?: string;
    configDir: string;
    error?: string;
  } | null>(null);
  const [fleetAccountLoading, setFleetAccountLoading] = useState(false);
  const [fleetLoginProgress, setFleetLoginProgress] = useState<string[]>([]);
  const [fleetLoginUrl, setFleetLoginUrl] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Load Fleet account status
  const loadFleetAccountStatus = async () => {
    setFleetAccountLoading(true);
    try {
      const res = await fetch('/api/claude-account');
      const data = await res.json();
      setFleetAccountStatus(data);
    } catch (err) {
      console.error('Failed to load fleet account status:', err);
    } finally {
      setFleetAccountLoading(false);
    }
  };

  // Login to Fleet account
  const startFleetLogin = async () => {
    setIsLoggingIn(true);
    setFleetLoginProgress([]);
    setFleetLoginUrl(null);

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
              setFleetLoginProgress(prev => [...prev, data.message]);
              if (data.url) {
                setFleetLoginUrl(data.url);
              }
              if (data.type === 'success' || data.type === 'error') {
                if (data.status) {
                  setFleetAccountStatus(data.status);
                }
              }
            } catch {}
          }
        }
      }
    } catch (err: any) {
      setFleetLoginProgress(prev => [...prev, `Error: ${err.message}`]);
    } finally {
      setIsLoggingIn(false);
      loadFleetAccountStatus();
    }
  };

  // Logout from Fleet account
  const fleetLogout = async () => {
    setFleetAccountLoading(true);
    try {
      await fetch('/api/claude-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'logout' }),
      });
      await loadFleetAccountStatus();
    } catch (err) {
      console.error('Failed to logout:', err);
    } finally {
      setFleetAccountLoading(false);
    }
  };

  // Load credential status on mount
  useEffect(() => {
    loadCredentials();
    verifyClaude();
    loadEpicStatus();
    loadFigmaStatus();
    loadMLXStatus();
    loadOllamaStatus();
    loadProjectDirConfig();
    loadAgentMode();
    loadFleetAccountStatus();


    // Check for Epic OAuth callback results in URL
    const params = new URLSearchParams(window.location.search);
    if (params.get('epicConnected') === 'true') {
      loadEpicStatus();
      window.history.replaceState({}, '', '/settings');
    }
    if (params.get('epicError')) {
      setEpicError(decodeURIComponent(params.get('epicError') || 'Connection failed'));
      window.history.replaceState({}, '', '/settings');
    }
  }, []);

  // Load Epic status
  const loadEpicStatus = async () => {
    try {
      const response = await fetch('/api/epic');
      if (response.ok) {
        const data = await response.json();
        setEpicStatus(data);
      }
    } catch (err) {
      console.error('Failed to load Epic status:', err);
    }
  };

  // Load Figma status
  const loadFigmaStatus = async () => {
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
  };

  // Save Figma token
  const saveFigmaToken = async () => {
    if (!figmaTokenInput.trim()) return;

    setSavingFigmaToken(true);
    setFigmaError(null);
    try {
      const response = await fetch('/api/settings/figma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: figmaTokenInput.trim() }),
      });
      const data = await response.json();

      if (response.ok) {
        setFigmaDialogOpen(false);
        setFigmaTokenInput('');
        await loadFigmaStatus();
      } else {
        setFigmaError(data.details || data.error || 'Failed to save token');
      }
    } catch (err) {
      setFigmaError(err instanceof Error ? err.message : 'Failed to save token');
    } finally {
      setSavingFigmaToken(false);
    }
  };

  // Disconnect Figma
  const disconnectFigma = async () => {
    setFigmaLoading(true);
    try {
      await fetch('/api/settings/figma', { method: 'DELETE' });
      await loadFigmaStatus();
      setFigmaTestResult(null);
    } catch (err) {
      setFigmaError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setFigmaLoading(false);
    }
  };

  // Test Figma connection
  const testFigmaConnection = async () => {
    setFigmaTesting(true);
    setFigmaTestResult(null);
    setFigmaError(null);
    try {
      const response = await fetch('/api/settings/figma/test', { method: 'POST' });
      const data = await response.json();
      setFigmaTestResult(data);
      if (!data.success) {
        setFigmaError(data.error);
      }
    } catch (err) {
      setFigmaError(err instanceof Error ? err.message : 'Test failed');
      setFigmaTestResult({ success: false, error: 'Connection test failed' });
    } finally {
      setFigmaTesting(false);
    }
  };

  // Load MLX status
  const loadMLXStatus = async () => {
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
  };

  // Load Ollama status (Windows/Linux)
  const loadOllamaStatus = async () => {
    setOllamaLoading(true);
    try {
      const response = await fetch('/api/ollama');
      const data: OllamaStatusResponse = await response.json();
      const deepseekModel = data.models?.find(m => m.name.includes('deepseek-ocr') && m.installed);
      setOllamaStatus({
        ollamaAvailable: data.running,
        models: data.models || [],
        deepseekOcrAvailable: !!deepseekModel,
        deepseekModel: deepseekModel ? {
          name: deepseekModel.name,
          displayName: deepseekModel.displayName,
          size: deepseekModel.size,
        } : undefined,
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
  };

  // Load Project Directory config
  const loadProjectDirConfig = async () => {
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
  };

  // Save Project Directory config
  const saveProjectDir = async () => {
    if (!newProjectDir.trim()) {
      setProjectDirError('Please enter a directory path');
      return;
    }
    setSavingProjectDir(true);
    setProjectDirError(null);
    try {
      const response = await fetch('/api/config/coding-directory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codingDirectory: newProjectDir.trim() }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save directory');
      }
      setProjectDirDialogOpen(false);
      setNewProjectDir('');
      await loadProjectDirConfig();

    } catch (err: any) {
      setProjectDirError(err.message);
    } finally {
      setSavingProjectDir(false);
    }
  };

  // Reset Project Directory to default
  const resetProjectDir = async () => {
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
  };


  // Load Agent Mode config
  const loadAgentMode = async () => {
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
  };

  // Save Agent Mode config
  const saveAgentMode = async (mode: 'default' | 'healthcare', settings?: typeof healthcareSettings) => {
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
  };
  // Connect to Epic (OAuth flow)
  const connectEpic = async () => {
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
  };

  // Disconnect Epic
  const disconnectEpic = async () => {
    setEpicLoading(true);
    try {
      await fetch('/api/epic', { method: 'DELETE' });
      await loadEpicStatus();
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setEpicLoading(false);
    }
  };

  // Setup Epic credentials from config file
  const setupEpicFromConfig = async () => {
    setEpicLoading(true);
    setEpicError(null);
    try {
      const response = await fetch('/api/epic/setup', { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Setup failed');
      }
      await loadEpicStatus();
      await loadCredentials();
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setEpicLoading(false);
    }
  };

  // Save Epic Bearer token
  const saveEpicToken = async () => {
    if (!epicTokenInput.trim()) {
      setEpicError('Please paste a Bearer token');
      return;
    }
    setSavingEpicToken(true);
    setEpicError(null);
    try {
      const response = await fetch('/api/epic', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: epicTokenInput.trim(), patientId: epicPatientIdInput.trim() || undefined }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save token');
      }
      setEpicTokenDialogOpen(false);
      setEpicTokenInput('');
      setEpicPatientIdInput('');
      await loadEpicStatus();
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setSavingEpicToken(false);
    }
  };

  // Verify Claude CLI
  const verifyClaude = async () => {
    setVerifyingClaude(true);
    try {
      const response = await fetch('/api/setup/verify-claude');
      const data: ClaudeVerification = await response.json();
      setClaudeStatus(data);
    } catch (err) {
      setClaudeStatus({
        installed: false, authenticated: false, subscriptionType: null,
        accountEmail: null, version: null, error: 'Failed to verify Claude CLI',
      });
    } finally {
      setVerifyingClaude(false);
    }
  };

  const resetSetup = () => {
    localStorage.removeItem('ai-dev-platform-setup-complete');
    router.push('/setup');
  };

  const loadCredentials = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/credentials');
      if (!response.ok) throw new Error('Failed to load credentials');
      const data = await response.json();
      setConfigs(data.configs || []);
      setStatus(data.status || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const openAddDialog = (config: CredentialConfig) => {
    setSelectedConfig(config);
    setFormValues({});
    setShowPasswords({});
    setSaveError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedConfig) return;
    for (const field of selectedConfig.fields) {
      if (field.required && !formValues[field.key]) {
        setSaveError(`${field.label} is required`);
        return;
      }
    }
    try {
      setSaving(true);
      setSaveError(null);
      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedConfig.type, values: formValues }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save credentials');
      }
      await loadCredentials();
      setDialogOpen(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteType) return;
    try {
      setDeleting(true);
      const response = await fetch(`/api/credentials?type=${deleteType}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete credentials');
      await loadCredentials();
      setDeleteDialogOpen(false);
      setDeleteType(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setDeleting(false);
    }
  };

  const openViewDialog = async (config: CredentialConfig) => {
    setViewConfig(config);
    setViewRevealed({});
    setViewDialogOpen(true);
    setLoadingView(true);
    try {
      const response = await fetch(`/api/credentials/${config.type}`);
      const data = await response.json();
      setViewMasked(data.maskedValues || {});
      const revealResponse = await fetch(`/api/credentials/${config.type}?reveal=true`);
      const revealData = await revealResponse.json();
      setViewValues(revealData.values || {});
    } catch (err) {
      console.error('Error loading credential values:', err);
    } finally {
      setLoadingView(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const testCredential = async (type: string) => {
    try {
      setTesting(type);
      setTestResults(prev => { const u = { ...prev }; delete u[type]; return u; });
      const response = await fetch(`/api/credentials/${type}/test`, { method: 'POST' });
      const result = await response.json();
      setTestResults(prev => ({ ...prev, [type]: result }));
    } catch (err) {
      setTestResults(prev => ({
        ...prev,
        [type]: { success: false, message: err instanceof Error ? err.message : 'Test failed' },
      }));
    } finally {
      setTesting(null);
    }
  };

  const getIcon = (iconName: string) => ICONS[iconName] || Key;

  // Calculate status summary
  const configuredCredentials = Object.values(status).filter(Boolean).length;
  const totalCredentials = configs.length;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <Settings className="h-6 w-6 text-primary" />
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-sm text-muted-foreground">Configure AI services and integrations</p>
              </div>
            </div>
            {/* Quick Status */}
            <div className="hidden sm:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <StatusIndicator status={claudeStatus?.authenticated ? 'success' : claudeStatus?.installed ? 'warning' : 'error'} />
                <span className="text-muted-foreground">Claude</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator status={mlxStatus?.mlxAvailable && mlxStatus.model.available ? 'success' : mlxStatus?.mlxAvailable ? 'warning' : 'inactive'} />
                <span className="text-muted-foreground">MLX</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator status={ollamaStatus?.deepseekOcrAvailable ? 'success' : ollamaStatus?.ollamaAvailable ? 'warning' : 'inactive'} />
                <span className="text-muted-foreground">Ollama</span>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator status={epicStatus?.connected ? 'success' : epicStatus?.configured ? 'warning' : 'inactive'} />
                <span className="text-muted-foreground">Epic</span>
              </div>
              <Badge variant="outline" className="text-xs">
                {configuredCredentials}/{totalCredentials} Keys
              </Badge>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4">
        {error && (
          <Card className="border-red-500 bg-red-50 dark:bg-red-950/20 mb-4">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="services" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
            <TabsTrigger value="services" className="gap-2">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Services</span>
            </TabsTrigger>
            <TabsTrigger value="storage" className="gap-2">
              <HardDrive className="h-4 w-4" />
              <span className="hidden sm:inline">Storage</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Server className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="credentials" className="gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">API Keys</span>
            </TabsTrigger>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Agents</span>
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* SERVICES TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="services" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
            {/* Claude CLI Card */}
            <Card className={cn(
              claudeStatus?.authenticated ? 'border-green-500/50' :
              claudeStatus?.installed ? 'border-yellow-500/50' : 'border-red-500/50'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-lg',
                      claudeStatus?.authenticated ? 'bg-green-100 dark:bg-green-900/30' :
                      claudeStatus?.installed ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-red-100 dark:bg-red-900/30'
                    )}>
                      <Bot className={cn(
                        'h-5 w-5',
                        claudeStatus?.authenticated ? 'text-green-600' :
                        claudeStatus?.installed ? 'text-yellow-600' : 'text-red-600'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Claude Subscription</h3>
                      <p className="text-xs text-muted-foreground">Used for Fleet Builds</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={verifyClaude} disabled={verifyingClaude}>
                      <RefreshCw className={cn('h-4 w-4', verifyingClaude && 'animate-spin')} />
                    </Button>
                  </div>
                </div>

                {verifyingClaude ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </div>
                ) : claudeStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {claudeStatus.authenticated ? 'Connected' : claudeStatus.installed ? 'Not Logged In' : 'CLI Not Installed'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {claudeStatus.authenticated ? (
                            <>{claudeStatus.subscriptionType} {claudeStatus.accountEmail && `• ${claudeStatus.accountEmail}`}</>
                          ) : claudeStatus.installed ? 'Click Login to authenticate' : 'Install Claude Code CLI first'}
                        </p>
                      </div>
                      {claudeStatus.authenticated && (
                        <Badge className="bg-green-600 text-white text-xs"><Check className="h-3 w-3 mr-1" />Ready</Badge>
                      )}
                    </div>
                    {claudeStatus.version && (
                      <p className="text-xs text-muted-foreground">Version: {claudeStatus.version}</p>
                    )}
                    {/* Login / Switch Account Button */}
                    {claudeStatus.installed && (
                      <div className="pt-2 border-t border-border">
                        <Button
                          variant={claudeStatus.authenticated ? 'outline' : 'default'}
                          size="sm"
                          className="w-full"
                          onClick={startFleetLogin}
                          disabled={isLoggingIn}
                        >
                          {isLoggingIn ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Opening Browser...
                            </>
                          ) : claudeStatus.authenticated ? (
                            <>
                              <Users className="h-4 w-4 mr-2" />
                              Switch Account
                            </>
                          ) : (
                            <>
                              <ExternalLink className="h-4 w-4 mr-2" />
                              Login with Claude
                            </>
                          )}
                        </Button>
                        {fleetLoginProgress.length > 0 && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs space-y-1">
                            {fleetLoginProgress.slice(-2).map((msg, i) => (
                              <p key={i} className="text-muted-foreground">{msg}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* MLX Local AI Card */}
            <Card className={cn(
              mlxStatus?.mlxAvailable && mlxStatus.model.available ? 'border-green-500/50' :
              mlxStatus?.mlxAvailable ? 'border-yellow-500/50' : 'border-border'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-lg',
                      mlxStatus?.mlxAvailable && mlxStatus.model.available ? 'bg-green-100 dark:bg-green-900/30' :
                      mlxStatus?.mlxAvailable ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-muted'
                    )}>
                      <Cpu className={cn(
                        'h-5 w-5',
                        mlxStatus?.mlxAvailable && mlxStatus.model.available ? 'text-green-600' :
                        mlxStatus?.mlxAvailable ? 'text-yellow-600' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <AppleIcon className="h-4 w-4" />
                        Local AI (MLX)
                        <Badge variant="outline" className="text-xs font-normal">macOS</Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground">On-device OCR & Vision</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadMLXStatus} disabled={mlxLoading}>
                      <RefreshCw className={cn('h-4 w-4', mlxLoading && 'animate-spin')} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open('https://github.com/ml-explore/mlx-vlm', '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {mlxLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </div>
                ) : mlxStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {mlxStatus.mlxAvailable && mlxStatus.model.available ? 'Ready' :
                           mlxStatus.mlxAvailable ? 'Model Not Downloaded' : 'Not Installed'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {mlxStatus.mlxAvailable && mlxStatus.model.available ?
                            `${mlxStatus.model.name} • ~${mlxStatus.performance.approximate_tokens_per_second} tok/s` :
                            mlxStatus.error || 'Install mlx-vlm to enable'}
                        </p>
                      </div>
                      {mlxStatus.mlxAvailable && mlxStatus.model.available && (
                        <Badge className="bg-green-600 text-white text-xs"><Check className="h-3 w-3 mr-1" />Ready</Badge>
                      )}
                    </div>
                    {!mlxStatus.mlxAvailable && (
                      <div className="p-2.5 rounded-lg bg-muted/50 text-xs">
                        <code className="block p-2 bg-black/80 text-white rounded font-mono">pip install mlx-vlm</code>
                      </div>
                    )}
                    {mlxStatus.mlxAvailable && !mlxStatus.model.available && (
                      <div className="p-2.5 rounded-lg bg-muted/50 text-xs">
                        <code className="block p-2 bg-black/80 text-white rounded font-mono text-[10px]">
                          python -c &quot;from mlx_vlm import load; load(&apos;mlx-community/DeepSeek-OCR-4bit&apos;)&quot;
                        </code>
                      </div>
                    )}
                    {mlxStatus.mlxAvailable && mlxStatus.model.available && (
                      <div className="flex gap-1.5">
                        {mlxStatus.capabilities.map((cap) => {
                          const CapIcon = CAPABILITY_ICONS[cap] || Sparkles;
                          return (
                            <Badge key={cap} variant="secondary" className="text-xs gap-1">
                              <CapIcon className="h-3 w-3" />{cap}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Ollama Local AI Card (Windows/Linux) */}
            <Card className={cn(
              ollamaStatus?.deepseekOcrAvailable ? 'border-green-500/50' :
              ollamaStatus?.ollamaAvailable ? 'border-yellow-500/50' : 'border-border'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-lg',
                      ollamaStatus?.deepseekOcrAvailable ? 'bg-green-100 dark:bg-green-900/30' :
                      ollamaStatus?.ollamaAvailable ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-muted'
                    )}>
                      <Cpu className={cn(
                        'h-5 w-5',
                        ollamaStatus?.deepseekOcrAvailable ? 'text-green-600' :
                        ollamaStatus?.ollamaAvailable ? 'text-yellow-600' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        <WindowsIcon className="h-4 w-4" />
                        Local AI (Ollama)
                        <Badge variant="outline" className="text-xs font-normal">Windows</Badge>
                      </h3>
                      <p className="text-xs text-muted-foreground">DeepSeek OCR & Vision</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadOllamaStatus} disabled={ollamaLoading}>
                      <RefreshCw className={cn('h-4 w-4', ollamaLoading && 'animate-spin')} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open('https://ollama.ai', '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {ollamaLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Checking...
                  </div>
                ) : ollamaStatus ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">
                          {ollamaStatus.deepseekOcrAvailable ? 'Ready' :
                           ollamaStatus.ollamaAvailable ? 'Model Not Installed' : 'Ollama Not Running'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {ollamaStatus.deepseekOcrAvailable && ollamaStatus.deepseekModel ?
                            `${ollamaStatus.deepseekModel.displayName || ollamaStatus.deepseekModel.name} • ${ollamaStatus.deepseekModel.size}` :
                            ollamaStatus.ollamaAvailable ? 'Pull deepseek-ocr model to enable OCR' :
                            ollamaStatus.error || 'Start Ollama service'}
                        </p>
                      </div>
                      {ollamaStatus.deepseekOcrAvailable && (
                        <Badge className="bg-green-600 text-white text-xs"><Check className="h-3 w-3 mr-1" />Ready</Badge>
                      )}
                    </div>
                    {!ollamaStatus.ollamaAvailable && (
                      <div className="p-2.5 rounded-lg bg-muted/50 text-xs space-y-2">
                        <p className="text-muted-foreground">Install Ollama from ollama.ai</p>
                        <code className="block p-2 bg-black/80 text-white rounded font-mono">ollama serve</code>
                      </div>
                    )}
                    {ollamaStatus.ollamaAvailable && !ollamaStatus.deepseekOcrAvailable && (
                      <div className="p-2.5 rounded-lg bg-muted/50 text-xs">
                        <code className="block p-2 bg-black/80 text-white rounded font-mono">
                          ollama pull deepseek-ocr
                        </code>
                      </div>
                    )}
                    {ollamaStatus.deepseekOcrAvailable && ollamaStatus.capabilities.length > 0 && (
                      <div className="flex gap-1.5">
                        {ollamaStatus.capabilities.map((cap) => {
                          const CapIcon = CAPABILITY_ICONS[cap] || Sparkles;
                          return (
                            <Badge key={cap} variant="secondary" className="text-xs gap-1">
                              <CapIcon className="h-3 w-3" />{cap}
                            </Badge>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* STORAGE TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="storage" className="space-y-6">
            {/* Project Directory Card */}
            <Card className={cn(
              projectDirConfig?.directoryExists ? 'border-green-500/50' : 'border-yellow-500/50'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-lg',
                      projectDirConfig?.directoryExists ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'
                    )}>
                      <FolderCog className={cn(
                        'h-5 w-5',
                        projectDirConfig?.directoryExists ? 'text-green-600' : 'text-yellow-600'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold">Project Directory</h3>
                      <p className="text-xs text-muted-foreground">Where all new projects are saved</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadProjectDirConfig} disabled={projectDirLoading}>
                      <RefreshCw className={cn('h-4 w-4', projectDirLoading && 'animate-spin')} />
                    </Button>
                  </div>
                </div>

                {projectDirLoading && !projectDirConfig ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading...
                  </div>
                ) : projectDirConfig ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {projectDirConfig.isConfigured ? 'Custom Directory' : 'Default Directory'}
                        </p>
                        <p className="text-xs text-muted-foreground truncate" title={projectDirConfig.activeDirectory}>
                          {projectDirConfig.activeDirectory}
                        </p>
                      </div>
                      {projectDirConfig.directoryExists ? (
                        <Badge className="bg-green-600 text-white text-xs shrink-0"><Check className="h-3 w-3 mr-1" />Exists</Badge>
                      ) : (
                        <Badge className="bg-yellow-600 text-white text-xs shrink-0"><AlertCircle className="h-3 w-3 mr-1" />Not Found</Badge>
                      )}
                    </div>

                    {/* Current path display */}
                    <div className="p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-2 mb-2">
                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Active Path</span>
                      </div>
                      <code className="block text-xs font-mono bg-background p-2 rounded border break-all">
                        {projectDirConfig.activeDirectory}
                      </code>
                      {projectDirConfig.isConfigured && projectDirConfig.configuredAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Configured: {new Date(projectDirConfig.configuredAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {projectDirError && (
                      <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
                        <AlertCircle className="h-3 w-3" />{projectDirError}
                        <Button variant="ghost" size="sm" className="h-5 ml-auto text-xs" onClick={() => setProjectDirError(null)}>Dismiss</Button>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => {
                        setNewProjectDir(projectDirConfig.activeDirectory);
                        setProjectDirError(null);
                        setProjectDirDialogOpen(true);
                      }}>
                        <FolderCog className="h-3.5 w-3.5 mr-1.5" />
                        Change Directory
                      </Button>
                      {projectDirConfig.isConfigured && (
                        <Button size="sm" variant="outline" onClick={resetProjectDir} disabled={projectDirLoading}>
                          {projectDirLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                          Reset to Default
                        </Button>
                      )}
                    </div>

                    {/* Info about default */}
                    {!projectDirConfig.isConfigured && (
                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-xs">
                        <p className="text-blue-700 dark:text-blue-300">
                          <span className="font-medium">Tip:</span> You can set a custom directory where all new projects will be created.
                          The directory must already exist on your system.
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Storage Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2.5 rounded-lg bg-muted">
                    <HardDrive className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Storage Information</h3>
                    <p className="text-xs text-muted-foreground">How project data is organized</p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Project Files</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Each project gets its own folder with source code, config files, and build outputs in your configured directory.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="h-4 w-4 text-purple-500" />
                      <h4 className="font-medium text-sm">App Metadata</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Project metadata and platform config are stored in the app&apos;s data folder for quick access.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* INTEGRATIONS TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="integrations" className="space-y-6">
            {/* Epic Healthcare Card */}
            <Card className={cn(
              epicStatus?.connected ? 'border-green-500/50' :
              epicStatus?.configured && epicStatus?.hasPrivateKey ? 'border-blue-500/50' :
              epicStatus?.configured ? 'border-yellow-500/50' : 'border-border'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-lg',
                      epicStatus?.connected ? 'bg-green-100 dark:bg-green-900/30' :
                      epicStatus?.configured ? 'bg-yellow-100 dark:bg-yellow-900/30' : 'bg-muted'
                    )}>
                      <Heart className={cn(
                        'h-5 w-5',
                        epicStatus?.connected ? 'text-green-600' :
                        epicStatus?.configured ? 'text-yellow-600' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        Epic Healthcare
                        {epicStatus?.environment === 'sandbox' && (
                          <Badge variant="outline" className="text-xs font-normal bg-yellow-50 text-yellow-700 border-yellow-300">
                            <FlaskConical className="h-3 w-3 mr-1" />Sandbox
                          </Badge>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">FHIR API Integration</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadEpicStatus} disabled={epicLoading}>
                      <RefreshCw className={cn('h-4 w-4', epicLoading && 'animate-spin')} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open('https://fhir.epic.com', '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {epicStatus?.connected ? 'Connected' :
                         epicStatus?.configured && epicStatus?.hasPrivateKey ? 'Backend OAuth Ready' :
                         epicStatus?.configured ? 'Ready to Connect' : 'Not Configured'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {epicStatus?.connected && epicStatus.hasPrivateKey ? 'Auto-refresh enabled' :
                         epicStatus?.connected ? `Token expires: ${new Date(epicStatus.tokenInfo?.expiresAt || '').toLocaleString()}` :
                         epicStatus?.configured ? 'Click to connect' : 'Setup required'}
                      </p>
                    </div>
                    {epicStatus?.connected && (
                      <Badge className="bg-green-600 text-white text-xs"><Check className="h-3 w-3 mr-1" />Connected</Badge>
                    )}
                  </div>

                  {epicError && (
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />{epicError}
                      <Button variant="ghost" size="sm" className="h-5 ml-auto text-xs" onClick={() => setEpicError(null)}>Dismiss</Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {epicStatus?.connected ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setEpicTokenDialogOpen(true)}>
                          <Key className="h-3.5 w-3.5 mr-1.5" />Token
                        </Button>
                        <Button size="sm" variant="destructive" onClick={disconnectEpic} disabled={epicLoading}>
                          <Unplug className="h-3.5 w-3.5 mr-1.5" />Disconnect
                        </Button>
                      </>
                    ) : epicStatus?.configured ? (
                      <Button size="sm" onClick={() => setEpicTokenDialogOpen(true)}>
                        <Key className="h-3.5 w-3.5 mr-1.5" />Paste Token
                      </Button>
                    ) : (
                      <Button size="sm" onClick={setupEpicFromConfig} disabled={epicLoading}>
                        {epicLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                        Setup Epic
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Figma Integration Card */}
            <Card className={cn(
              figmaStatus?.configured ? 'border-purple-500/50' :
              figmaStatus?.hasEnvToken ? 'border-blue-500/50' : 'border-border'
            )}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2.5 rounded-lg',
                      figmaStatus?.configured ? 'bg-purple-100 dark:bg-purple-900/30' :
                      figmaStatus?.hasEnvToken ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-muted'
                    )}>
                      <Figma className={cn(
                        'h-5 w-5',
                        figmaStatus?.configured ? 'text-purple-600' :
                        figmaStatus?.hasEnvToken ? 'text-blue-600' : 'text-muted-foreground'
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold flex items-center gap-2">
                        Figma
                        {figmaStatus?.hasEnvToken && !figmaStatus?.configured && (
                          <Badge variant="outline" className="text-xs font-normal bg-blue-50 text-blue-700 border-blue-300">
                            ENV Token
                          </Badge>
                        )}
                      </h3>
                      <p className="text-xs text-muted-foreground">Design-to-Code Integration</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadFigmaStatus} disabled={figmaLoading}>
                      <RefreshCw className={cn('h-4 w-4', figmaLoading && 'animate-spin')} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open('https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens', '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">
                        {figmaStatus?.configured ? 'Connected' :
                         figmaStatus?.hasEnvToken ? 'Using Environment Token' : 'Not Configured'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {figmaStatus?.accountEmail ? figmaStatus.accountEmail :
                         figmaStatus?.configured ? `Last validated: ${new Date(figmaStatus.lastValidated || '').toLocaleDateString()}` :
                         figmaStatus?.hasEnvToken ? 'Token from FIGMA_PERSONAL_ACCESS_TOKEN' : 'Add your Figma token to enable design imports'}
                      </p>
                    </div>
                    {figmaStatus?.configured && (
                      <Badge className="bg-purple-600 text-white text-xs"><Check className="h-3 w-3 mr-1" />Connected</Badge>
                    )}
                  </div>

                  {figmaError && (
                    <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />{figmaError}
                      <Button variant="ghost" size="sm" className="h-5 ml-auto text-xs" onClick={() => setFigmaError(null)}>Dismiss</Button>
                    </div>
                  )}

                  {/* Test Result */}
                  {figmaTestResult && (
                    <div className={cn(
                      'p-2 rounded text-xs flex items-center gap-2',
                      figmaTestResult.success
                        ? 'bg-green-50 dark:bg-green-950/30 text-green-600'
                        : 'bg-red-50 dark:bg-red-950/30 text-red-600'
                    )}>
                      {figmaTestResult.success ? (
                        <>
                          <CheckCircle className="h-3 w-3" />
                          {figmaTestResult.message || 'Connection successful!'}
                          {figmaTestResult.user?.email && (
                            <span className="text-muted-foreground ml-1">({figmaTestResult.user.email})</span>
                          )}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3" />
                          {figmaTestResult.error || 'Connection failed'}
                        </>
                      )}
                      <Button variant="ghost" size="sm" className="h-5 ml-auto text-xs" onClick={() => setFigmaTestResult(null)}>Dismiss</Button>
                    </div>
                  )}

                  <div className="flex gap-2">
                    {figmaStatus?.configured || figmaStatus?.hasEnvToken ? (
                      <>
                        <Button size="sm" variant="outline" onClick={testFigmaConnection} disabled={figmaTesting}>
                          {figmaTesting ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : figmaTestResult?.success === true ? (
                            <CheckCircle className="h-3.5 w-3.5 mr-1.5 text-green-600" />
                          ) : figmaTestResult?.success === false ? (
                            <XCircle className="h-3.5 w-3.5 mr-1.5 text-red-600" />
                          ) : (
                            <Play className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          Test
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setFigmaDialogOpen(true)}>
                          <Key className="h-3.5 w-3.5 mr-1.5" />Update Token
                        </Button>
                        <Button size="sm" variant="destructive" onClick={disconnectFigma} disabled={figmaLoading}>
                          <Unplug className="h-3.5 w-3.5 mr-1.5" />Disconnect
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => setFigmaDialogOpen(true)} disabled={figmaLoading}>
                        {figmaLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1.5" />}
                        Add Token
                      </Button>
                    )}
                  </div>

                  {/* Info about Figma integration */}
                  <div className="mt-2 p-2 rounded bg-purple-50 dark:bg-purple-950/30 text-xs text-purple-700 dark:text-purple-300">
                    <p className="font-medium mb-1">Design-to-Code</p>
                    <p className="text-purple-600 dark:text-purple-400">
                      Connect Figma to import designs directly into the build flow. AI extracts layout, colors, and components to generate matching code.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* API CREDENTIALS TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="credentials" className="space-y-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {configs.map((config) => {
              const Icon = getIcon(config.icon);
              const isConfigured = status[config.type] || false;

              return (
                <Card
                  key={config.type}
                  className={cn('transition-all', isConfigured && 'border-green-500/50')}
                >
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-start gap-3 mb-3">
                      <div className={cn(
                        'p-2 rounded-lg shrink-0',
                        isConfigured ? 'bg-green-100 dark:bg-green-900/30' : 'bg-muted'
                      )}>
                        <Icon className={cn('h-4 w-4', isConfigured ? 'text-green-600' : 'text-muted-foreground')} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm truncate">{config.label}</h3>
                          {isConfigured && <CheckCircle className="h-3.5 w-3.5 text-green-600 shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{config.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {isConfigured ? (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => testCredential(config.type)} disabled={testing === config.type}>
                            {testing === config.type ? <Loader2 className="h-3 w-3 animate-spin" /> :
                             testResults[config.type]?.success === true ? <CheckCircle className="h-3 w-3 text-green-600" /> :
                             testResults[config.type]?.success === false ? <XCircle className="h-3 w-3 text-red-600" /> :
                             <Play className="h-3 w-3" />}
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openViewDialog(config)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => openAddDialog(config)}>Edit</Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-red-500 hover:text-red-600 ml-auto"
                            onClick={() => { setDeleteType(config.type); setDeleteDialogOpen(true); }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" className="h-7 text-xs" onClick={() => openAddDialog(config)}>
                          <Plus className="h-3 w-3 mr-1" />Add
                        </Button>
                      )}
                      {config.docsUrl && (
                        <Button variant="ghost" size="sm" className="h-7 px-2 ml-auto" onClick={() => window.open(config.docsUrl, '_blank')}>
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {testResults[config.type] && (
                      <div className={cn(
                        'mt-2 p-2 rounded text-xs',
                        testResults[config.type].success ? 'bg-green-50 dark:bg-green-950/30 text-green-700' : 'bg-red-50 dark:bg-red-950/30 text-red-700'
                      )}>
                        {testResults[config.type].message}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
            </div>
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════════════════ */}
          {/* AGENTS TAB */}
          {/* ═══════════════════════════════════════════════════════════════════ */}
          <TabsContent value="agents" className="space-y-6">
            {/* Agent Mode Toggle */}
            <Card className={cn(
              "border-2 transition-colors",
              agentMode === 'healthcare' ? "border-green-500/50 bg-green-500/5" : "border-border"
            )}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-2.5 rounded-lg",
                      agentMode === 'healthcare' ? "bg-green-100 dark:bg-green-900/30" : "bg-gray-100 dark:bg-gray-800"
                    )}>
                      <Heart className={cn(
                        "h-6 w-6",
                        agentMode === 'healthcare' ? "text-green-600" : "text-gray-500"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Agent Mode</h3>
                      <p className="text-sm text-muted-foreground">
                        {agentMode === 'healthcare'
                          ? "Healthcare mode: HIPAA-compliant, FHIR/EHR-aware prompts enabled"
                          : "Default mode: General-purpose development prompts"
                        }
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-sm font-medium",
                      agentMode === 'default' ? "text-foreground" : "text-muted-foreground"
                    )}>Default</span>
                    <Switch
                      checked={agentMode === 'healthcare'}
                      onCheckedChange={(checked) => saveAgentMode(checked ? 'healthcare' : 'default')}
                      disabled={agentModeLoading}
                    />
                    <span className={cn(
                      "text-sm font-medium",
                      agentMode === 'healthcare' ? "text-green-600" : "text-muted-foreground"
                    )}>Healthcare</span>
                  </div>
                </div>

                {/* Healthcare Settings (shown when healthcare mode is enabled) */}
                {agentMode === 'healthcare' && (
                  <div className="mt-6 pt-6 border-t border-border">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Healthcare Mode Settings
                    </h4>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">Include Epic FHIR APIs</p>
                          <p className="text-xs text-muted-foreground">Add Epic API patterns to coder prompts</p>
                        </div>
                        <Switch
                          checked={healthcareSettings.includeEpicAPIs}
                          onCheckedChange={(checked) => {
                            const newSettings = { ...healthcareSettings, includeEpicAPIs: checked };
                            setHealthcareSettings(newSettings);
                            saveAgentMode('healthcare', newSettings);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">Include Test Patients</p>
                          <p className="text-xs text-muted-foreground">Reference Epic sandbox test patient IDs</p>
                        </div>
                        <Switch
                          checked={healthcareSettings.includeTestPatients}
                          onCheckedChange={(checked) => {
                            const newSettings = { ...healthcareSettings, includeTestPatients: checked };
                            setHealthcareSettings(newSettings);
                            saveAgentMode('healthcare', newSettings);
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <p className="text-sm font-medium">Include FHIR Examples</p>
                          <p className="text-xs text-muted-foreground">Add FHIR R4 code examples to prompts</p>
                        </div>
                        <Switch
                          checked={healthcareSettings.includeFHIRExamples}
                          onCheckedChange={(checked) => {
                            const newSettings = { ...healthcareSettings, includeFHIRExamples: checked };
                            setHealthcareSettings(newSettings);
                            saveAgentMode('healthcare', newSettings);
                          }}
                        />
                      </div>
                      <div className="p-3 rounded-lg bg-muted/50">
                        <p className="text-sm font-medium mb-2">Compliance Level</p>
                        <Select
                          value={healthcareSettings.complianceLevel}
                          onValueChange={(value: 'hipaa' | 'hipaa-hitrust' | 'basic') => {
                            const newSettings = { ...healthcareSettings, complianceLevel: value };
                            setHealthcareSettings(newSettings);
                            saveAgentMode('healthcare', newSettings);
                          }}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="basic">Basic Security</SelectItem>
                            <SelectItem value="hipaa">HIPAA Compliant</SelectItem>
                            <SelectItem value="hipaa-hitrust">HIPAA + HITRUST</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Agent Configuration */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Bot className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Agent Configuration</h3>
                      <p className="text-sm text-muted-foreground">Customize AI agent behavior, prompts, and workflow settings</p>
                    </div>
                  </div>
                  <Link href="/settings/agents">
                    <Button>
                      <Settings className="h-4 w-4 mr-2" />
                      Open Editor
                    </Button>
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Agent Prompts</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Customize system prompts for Product Owner, Coder, Tester, Security, and Fixer agents.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <h4 className="font-medium text-sm">Model Selection</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Choose between Opus, Sonnet, and Haiku for each agent based on task complexity.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Settings className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-sm">Workflow Limits</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Set story limits, parallel workers, test coverage requirements, and retry policies.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Squad Configuration */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <Users className="h-6 w-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Squad Configuration</h3>
                      <p className="text-sm text-muted-foreground">Configure specialized agent squads and business domain experts</p>
                    </div>
                  </div>
                  <Link href="/settings/squads">
                    <Button>
                      <Settings className="h-4 w-4 mr-2" />
                      Configure Squads
                    </Button>
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Squad Templates</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      UI, Backend, Data, Security, DevOps and more specialized squad types with custom prompts.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Heart className="h-4 w-4 text-red-500" />
                      <h4 className="font-medium text-sm">Business Domains</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Healthcare, Finance, E-commerce domain experts with compliance and terminology knowledge.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-purple-500" />
                      <h4 className="font-medium text-sm">Role Prompts</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Detailed prompts for Coders, Testers, and Data agents tailored to each squad type.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Service Catalog */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <Server className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Service Catalog</h3>
                      <p className="text-sm text-muted-foreground">Manage APIs, MCP servers, and LLM providers available to agents</p>
                    </div>
                  </div>
                  <Link href="/settings/services">
                    <Button>
                      <Settings className="h-4 w-4 mr-2" />
                      Manage Services
                    </Button>
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Internal APIs</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      OCR, Epic FHIR, compliance scanning, and other platform APIs agents can use.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="h-4 w-4 text-purple-500" />
                      <h4 className="font-medium text-sm">MCP Servers</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Model Context Protocol servers for filesystem, database, search, and more.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Bot className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-sm">LLM Providers</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Claude, OpenAI, Ollama, Groq - configure which models agents can use.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Design Systems */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                      <Paintbrush className="h-6 w-6 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Design Systems</h3>
                      <p className="text-sm text-muted-foreground">Manage design systems for AI-generated UI code</p>
                    </div>
                  </div>
                  <Link href="/settings/design-systems">
                    <Button>
                      <Paintbrush className="h-4 w-4 mr-2" />
                      Manage Design Systems
                    </Button>
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Paintbrush className="h-4 w-4 text-pink-500" />
                      <h4 className="font-medium text-sm">Built-in Systems</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Modern Dark and Ochsner Health design systems included out of the box.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Code className="h-4 w-4 text-blue-500" />
                      <h4 className="font-medium text-sm">Token & Components</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Colors, typography, spacing, and component specs injected into agent prompts.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Cloud className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-sm">Upload Custom</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Import your own design system from JSON or Markdown files.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AI Configuration */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                      <Brain className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">AI Configuration</h3>
                      <p className="text-sm text-muted-foreground">Configure AI providers for built applications</p>
                    </div>
                  </div>
                  <Link href="/settings/ai">
                    <Button>
                      <Brain className="h-4 w-4 mr-2" />
                      Configure AI
                    </Button>
                  </Link>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-green-500" />
                      <h4 className="font-medium text-sm">Cloud Providers</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      OpenAI, Anthropic, Groq - add API keys for cloud LLMs.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Server className="h-4 w-4 text-cyan-500" />
                      <h4 className="font-medium text-sm">Local LLMs</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ollama, MLX - run models locally for free, private inference.
                    </p>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <h4 className="font-medium text-sm">Auto Fallback</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Built apps fallback to local LLMs when cloud fails.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Security Footer */}
        <footer className="flex items-center gap-3 p-4 mt-6 rounded-lg bg-muted/50 text-sm">
          <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">Secure Storage:</span>{' '}
            All credentials are encrypted at rest and only used to connect to services on your behalf.
          </p>
        </footer>
      </main>

      {/* ═══════════════════════════════════════════════════════════════════ */}
      {/* DIALOGS */}
      {/* ═══════════════════════════════════════════════════════════════════ */}

      {/* Add/Edit Credential Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedConfig && (
                <>
                  {(() => { const Icon = getIcon(selectedConfig.icon); return <Icon className="h-5 w-5" />; })()}
                  {selectedConfig.label} Credentials
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {selectedConfig?.description}
              {selectedConfig?.docsUrl && (
                <a href={selectedConfig.docsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline ml-1">
                  Learn more <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {selectedConfig?.fields.map((field) => (
              <div key={field.key} className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-1">
                  {field.label}{field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === 'select' ? (
                  <Select value={formValues[field.key] || ''} onValueChange={(v) => setFormValues(p => ({ ...p, [field.key]: v }))}>
                    <SelectTrigger><SelectValue placeholder={field.placeholder || 'Select...'} /></SelectTrigger>
                    <SelectContent>{field.options?.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <div className="relative">
                    <Input
                      type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                      placeholder={field.placeholder}
                      value={formValues[field.key] || ''}
                      onChange={(e) => setFormValues(p => ({ ...p, [field.key]: e.target.value }))}
                      className={cn(field.type === 'password' && 'pr-10')}
                    />
                    {field.type === 'password' && (
                      <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                        onClick={() => setShowPasswords(p => ({ ...p, [field.key]: !p[field.key] }))}>
                        {showPasswords[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {saveError && <div className="flex items-center gap-2 text-red-500 text-sm"><AlertCircle className="h-4 w-4" />{saveError}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Lock className="h-4 w-4 mr-2" />Save Securely</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><Trash2 className="h-5 w-5" />Delete Credentials</DialogTitle>
            <DialogDescription>Are you sure? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Deleting...</> : <><Trash2 className="h-4 w-4 mr-2" />Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Credentials Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewConfig && <>{(() => { const Icon = getIcon(viewConfig.icon); return <Icon className="h-5 w-5 text-primary" />; })()}{viewConfig.label} Credentials</>}
            </DialogTitle>
            <DialogDescription>Click the eye icon to reveal values.</DialogDescription>
          </DialogHeader>
          {loadingView ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="space-y-4 py-4">
              {viewConfig?.fields.map((field) => {
                const isRevealed = viewRevealed[field.key];
                const displayValue = isRevealed ? viewValues[field.key] || '' : viewMasked[field.key] || '****';
                return (
                  <div key={field.key} className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">{field.label}</label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <Input type="text" value={displayValue} readOnly className={cn('pr-20 font-mono text-sm', !isRevealed && 'text-muted-foreground')} />
                        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-1">
                          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0"
                            onClick={() => setViewRevealed(p => ({ ...p, [field.key]: !p[field.key] }))} title={isRevealed ? 'Hide' : 'Reveal'}>
                            {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                          {isRevealed && viewValues[field.key] && (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => copyToClipboard(viewValues[field.key])}>Copy</Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.values(viewRevealed).some(Boolean) && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-sm">
                  <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-amber-700 dark:text-amber-300">Be careful when revealing credentials.</span>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>Close</Button>
            <Button onClick={() => { setViewDialogOpen(false); if (viewConfig) openAddDialog(viewConfig); }}>Update Credentials</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Epic Token Dialog */}
      <Dialog open={epicTokenDialogOpen} onOpenChange={setEpicTokenDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Heart className="h-5 w-5 text-red-500" />Epic Bearer Token</DialogTitle>
            <DialogDescription>
              Paste a Bearer token from Epic&apos;s <a href="https://fhir.epic.com/Specifications" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Try It</a> feature.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Bearer Token <span className="text-red-500">*</span></label>
              <textarea
                className="w-full h-24 px-3 py-2 text-sm border rounded-md bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={epicTokenInput}
                onChange={(e) => setEpicTokenInput(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Patient FHIR ID <span className="text-muted-foreground">(optional)</span></label>
              <Input placeholder="e63wRTbPfr1p8UW81d8Seiw3" value={epicPatientIdInput} onChange={(e) => setEpicPatientIdInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEpicTokenDialogOpen(false); setEpicTokenInput(''); setEpicPatientIdInput(''); }}>Cancel</Button>
            <Button onClick={saveEpicToken} disabled={savingEpicToken || !epicTokenInput.trim()}>
              {savingEpicToken ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Check className="h-4 w-4 mr-2" />Save Token</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Figma Token Dialog */}
      <Dialog open={figmaDialogOpen} onOpenChange={setFigmaDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Figma className="h-5 w-5 text-purple-500" />
              Figma Personal Access Token
            </DialogTitle>
            <DialogDescription>
              Create a personal access token from{' '}
              <a href="https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                Figma Settings
              </a>{' '}
              to enable design imports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Personal Access Token <span className="text-red-500">*</span></label>
              <Input
                type="password"
                placeholder="figd_..."
                value={figmaTokenInput}
                onChange={(e) => setFigmaTokenInput(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Your token will be validated and stored securely. It needs at least &quot;File content&quot; read access.
              </p>
            </div>

            {figmaError && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {figmaError}
              </div>
            )}

            <div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-950/30">
              <p className="text-xs font-medium text-purple-700 dark:text-purple-300 mb-1">How to get a token:</p>
              <ol className="text-xs text-purple-600 dark:text-purple-400 list-decimal list-inside space-y-0.5">
                <li>Go to Figma Settings &gt; Account &gt; Personal access tokens</li>
                <li>Click &quot;Create new token&quot;</li>
                <li>Give it a name and select &quot;File content&quot; read access</li>
                <li>Copy and paste the token here</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setFigmaDialogOpen(false); setFigmaTokenInput(''); setFigmaError(null); }}>
              Cancel
            </Button>
            <Button onClick={saveFigmaToken} disabled={savingFigmaToken || !figmaTokenInput.trim()} className="bg-purple-600 hover:bg-purple-700">
              {savingFigmaToken ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Validating...</> : <><Check className="h-4 w-4 mr-2" />Save Token</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Directory Dialog */}
      <Dialog open={projectDirDialogOpen} onOpenChange={setProjectDirDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderCog className="h-5 w-5 text-primary" />
              Set Project Directory
            </DialogTitle>
            <DialogDescription>
              Enter the path where all new projects will be created. The directory must already exist on your system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Directory Path <span className="text-red-500">*</span></label>
              <Input
                placeholder={projectDirConfig?.defaultDirectory || '~/coding/ai-projects'}
                value={newProjectDir}
                onChange={(e) => setNewProjectDir(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                You can use ~ for your home directory (e.g., ~/projects)
              </p>
            </div>

            {projectDirConfig?.defaultDirectory && (
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Default directory:</p>
                <code className="text-xs font-mono">{projectDirConfig.defaultDirectory}</code>
              </div>
            )}

            {projectDirError && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="h-4 w-4" />
                {projectDirError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setProjectDirDialogOpen(false); setNewProjectDir(''); setProjectDirError(null); }}>
              Cancel
            </Button>
            <Button onClick={saveProjectDir} disabled={savingProjectDir || !newProjectDir.trim()}>
              {savingProjectDir ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
              ) : (
                <><Check className="h-4 w-4 mr-2" />Save Directory</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
