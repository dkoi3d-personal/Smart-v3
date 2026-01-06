'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Database,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  MessageSquare,
  Wrench,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  RefreshCw,
  AlertTriangle,
  Zap,
  Server,
  Cloud,
} from 'lucide-react';

interface MigrationStep {
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  duration?: number;
  details?: string;
  error?: string;
}

interface DatabaseProvider {
  id: 'neon' | 'supabase' | 'postgresql' | 'sqlite';
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  free: boolean;
  requiresCredentials: boolean;
}

interface FixAgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface DatabaseSetupPanelProps {
  projectId: string;
  onDatabaseReady?: (connectionString: string) => void;
}

const PROVIDERS: DatabaseProvider[] = [
  {
    id: 'neon',
    name: 'Neon',
    description: 'Serverless PostgreSQL, scales to zero, free tier available',
    icon: <Zap className="w-5 h-5" />,
    color: 'text-cyan-400',
    free: true,
    requiresCredentials: true,
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'PostgreSQL + Auth + Realtime, generous free tier',
    icon: <Database className="w-5 h-5" />,
    color: 'text-green-400',
    free: true,
    requiresCredentials: true,
  },
  {
    id: 'postgresql',
    name: 'PostgreSQL',
    description: 'Direct connection to any PostgreSQL database',
    icon: <Server className="w-5 h-5" />,
    color: 'text-blue-400',
    free: false,
    requiresCredentials: false,
  },
  {
    id: 'sqlite',
    name: 'SQLite (Local)',
    description: 'File-based database for local development only',
    icon: <Database className="w-5 h-5" />,
    color: 'text-gray-400',
    free: true,
    requiresCredentials: false,
  },
];

export default function DatabaseSetupPanel({ projectId, onDatabaseReady }: DatabaseSetupPanelProps) {
  // State
  const [selectedProvider, setSelectedProvider] = useState<DatabaseProvider | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [steps, setSteps] = useState<MigrationStep[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionString, setConnectionString] = useState<string | null>(null);
  const [showConnectionString, setShowConnectionString] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState<'none' | 'mock' | 'real'>('mock');

  // Fix Agent state
  const [showFixAgent, setShowFixAgent] = useState(false);
  const [fixAgentMessages, setFixAgentMessages] = useState<FixAgentMessage[]>([]);
  const [fixAgentInput, setFixAgentInput] = useState('');
  const [fixAgentLoading, setFixAgentLoading] = useState(false);

  // Custom connection string for direct PostgreSQL
  const [customConnectionString, setCustomConnectionString] = useState('');

  // Refs
  const logsEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check database status on mount
  useEffect(() => {
    checkDatabaseStatus();
  }, [projectId]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const checkDatabaseStatus = async () => {
    try {
      const response = await fetch(`/api/database/provision?projectId=${projectId}`);
      const data = await response.json();
      setDatabaseStatus(data.hasDatabase ? 'real' : 'mock');
      if (data.connectionString) {
        setConnectionString(data.connectionString);
      }
    } catch {
      setDatabaseStatus('mock');
    }
  };

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const startMigration = async () => {
    if (!selectedProvider) return;

    setMigrating(true);
    setError(null);
    setSteps([]);
    setLogs([]);
    addLog(`Starting database migration with ${selectedProvider.name}...`);

    // Handle direct PostgreSQL connection
    if (selectedProvider.id === 'postgresql') {
      await handleDirectPostgres();
      return;
    }

    // Use SSE for real-time progress
    const url = `/api/database/migrate?projectId=${projectId}&provider=${selectedProvider.id}`;

    eventSourceRef.current = new EventSource(url);

    eventSourceRef.current.addEventListener('start', (e) => {
      const data = JSON.parse(e.data);
      addLog(`Migration started at ${data.startedAt}`);
    });

    eventSourceRef.current.addEventListener('step', (e) => {
      const step: MigrationStep = JSON.parse(e.data);
      setSteps(prev => {
        const existing = prev.findIndex(s => s.name === step.name);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = step;
          return updated;
        }
        return [...prev, step];
      });

      if (step.status === 'running') {
        addLog(`▶ ${step.name}...`);
      } else if (step.status === 'completed') {
        addLog(`✓ ${step.name} (${step.duration}ms)${step.details ? ` - ${step.details}` : ''}`);
      } else if (step.status === 'failed') {
        addLog(`✗ ${step.name} FAILED: ${step.error}`);
      }
    });

    eventSourceRef.current.addEventListener('complete', (e) => {
      const result = JSON.parse(e.data);
      setMigrating(false);
      eventSourceRef.current?.close();

      if (result.success) {
        addLog('✓ Migration completed successfully!');
        setConnectionString(result.connectionString);
        setDatabaseStatus('real');
        onDatabaseReady?.(result.connectionString);
      } else {
        setError(result.error || 'Migration failed');
        addLog(`✗ Migration failed: ${result.error}`);
        // Offer fix agent
        initializeFixAgent(result.error);
      }
    });

    // Handle custom error events from our API
    eventSourceRef.current.addEventListener('migration-error', (e) => {
      const messageEvent = e as MessageEvent;
      try {
        const errorData = JSON.parse(messageEvent.data);
        setMigrating(false);
        eventSourceRef.current?.close();
        setError(errorData.message || 'Migration failed');
        addLog(`✗ Error: ${errorData.message}`);
        if (errorData.needsCredentials) {
          addLog('→ Please configure API credentials in Settings → Credentials');
        }
        initializeFixAgent(errorData.message);
      } catch {
        setMigrating(false);
        eventSourceRef.current?.close();
        setError('Unknown error occurred');
        addLog('✗ Error: Unknown error occurred');
      }
    });

    // Handle native EventSource errors (connection issues)
    eventSourceRef.current.addEventListener('error', () => {
      setMigrating(false);
      eventSourceRef.current?.close();
      setError('Connection to migration service failed');
      addLog('✗ Error: Connection to migration service failed');
    });
  };

  const handleDirectPostgres = async () => {
    if (!customConnectionString) {
      setError('Please enter a PostgreSQL connection string');
      setMigrating(false);
      return;
    }

    addLog('Testing connection to PostgreSQL...');

    try {
      const response = await fetch('/api/database/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          connectionString: customConnectionString,
        }),
      });

      const result = await response.json();

      if (result.success) {
        addLog('✓ Connection successful!');
        addLog('Running migrations...');

        // Run the actual migration
        const migrateResponse = await fetch('/api/database/migrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId,
            provider: 'postgresql',
            connectionString: customConnectionString,
          }),
        });

        const migrateResult = await migrateResponse.json();

        if (migrateResult.success) {
          addLog('✓ Database setup complete!');
          setConnectionString(customConnectionString);
          setDatabaseStatus('real');
          onDatabaseReady?.(customConnectionString);
        } else {
          throw new Error(migrateResult.error);
        }
      } else {
        throw new Error(result.error || 'Connection failed');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMsg);
      addLog(`✗ Error: ${errorMsg}`);
      initializeFixAgent(errorMsg);
    } finally {
      setMigrating(false);
    }
  };

  const initializeFixAgent = (errorMessage: string) => {
    setShowFixAgent(true);
    setFixAgentMessages([
      {
        role: 'system',
        content: `Database migration failed with error: ${errorMessage}`,
        timestamp: new Date(),
      },
      {
        role: 'assistant',
        content: `I see there was an error during database setup: "${errorMessage}"\n\nI can help you fix this. Here are some common causes:\n\n1. **Missing credentials** - Check if API keys are configured in Settings\n2. **Connection issues** - Verify your network can reach the database provider\n3. **Schema conflicts** - There might be incompatible data types\n\nWould you like me to:\n- Check your credentials and configuration?\n- Analyze the error in detail?\n- Try an alternative approach?\n\nJust describe what you'd like me to do.`,
        timestamp: new Date(),
      },
    ]);
  };

  const sendToFixAgent = async () => {
    if (!fixAgentInput.trim() || fixAgentLoading) return;

    const userMessage = fixAgentInput.trim();
    setFixAgentInput('');

    setFixAgentMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    }]);

    setFixAgentLoading(true);

    try {
      const response = await fetch('/api/agent/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          context: 'database-migration',
          error: error,
          userMessage,
          history: fixAgentMessages,
        }),
      });

      const result = await response.json();

      setFixAgentMessages(prev => [...prev, {
        role: 'assistant',
        content: result.message || result.response || 'I apologize, but I encountered an issue. Please try again.',
        timestamp: new Date(),
      }]);

      // If the agent suggests a fix that can be applied automatically
      if (result.action === 'retry') {
        addLog('Fix agent suggested retry - attempting again...');
        startMigration();
      } else if (result.action === 'configure') {
        addLog(`Fix agent suggests: ${result.suggestion}`);
      }

    } catch (err) {
      setFixAgentMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I had trouble processing that. Please try describing the issue again.',
        timestamp: new Date(),
      }]);
    } finally {
      setFixAgentLoading(false);
    }
  };

  const copyConnectionString = () => {
    if (connectionString) {
      navigator.clipboard.writeText(connectionString);
    }
  };

  const retryMigration = () => {
    setError(null);
    setShowFixAgent(false);
    setFixAgentMessages([]);
    startMigration();
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className={`p-4 rounded-lg border ${
        databaseStatus === 'real'
          ? 'bg-green-900/20 border-green-700/50'
          : 'bg-blue-900/20 border-blue-700/50'
      }`}>
        <div className="flex items-center gap-3">
          {databaseStatus === 'real' ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-400" />
              <div>
                <p className="font-medium text-green-200">Database Connected</p>
                <p className="text-xs text-green-400">Your app is using a real database</p>
              </div>
            </>
          ) : (
            <>
              <Cloud className="w-5 h-5 text-blue-400" />
              <div>
                <p className="font-medium text-blue-200">Using Mock Data</p>
                <p className="text-xs text-blue-400">Set up a database for production use</p>
              </div>
            </>
          )}
        </div>

        {connectionString && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type={showConnectionString ? 'text' : 'password'}
              value={connectionString}
              readOnly
              className="flex-1 px-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-xs font-mono"
            />
            <button
              onClick={() => setShowConnectionString(!showConnectionString)}
              className="p-1.5 hover:bg-gray-700 rounded"
            >
              {showConnectionString ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={copyConnectionString}
              className="p-1.5 hover:bg-gray-700 rounded"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Provider Selection */}
      {databaseStatus === 'mock' && !migrating && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-200">Choose Database Provider</h3>
          <div className="grid grid-cols-2 gap-3">
            {PROVIDERS.map((provider) => (
              <button
                key={provider.id}
                onClick={() => setSelectedProvider(provider)}
                className={`p-4 rounded-lg border text-left transition-all ${
                  selectedProvider?.id === provider.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg bg-gray-700 ${provider.color}`}>
                    {provider.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-200">{provider.name}</span>
                      {provider.free && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-400 rounded">
                          Free Tier
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{provider.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Direct PostgreSQL connection string input */}
          {selectedProvider?.id === 'postgresql' && (
            <div className="space-y-2">
              <label className="text-xs text-gray-400">Connection String</label>
              <input
                type="text"
                placeholder="postgresql://user:password@host:5432/database"
                value={customConnectionString}
                onChange={(e) => setCustomConnectionString(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
              />
            </div>
          )}

          {/* Start Button */}
          {selectedProvider && (
            <button
              onClick={startMigration}
              disabled={migrating || (selectedProvider.id === 'postgresql' && !customConnectionString)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
            >
              <Play className="w-4 h-4" />
              Set Up Database with {selectedProvider.name}
            </button>
          )}
        </div>
      )}

      {/* Migration Progress */}
      {(migrating || steps.length > 0) && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            {migrating && <Loader2 className="w-4 h-4 animate-spin" />}
            Migration Progress
          </h3>

          <div className="space-y-2">
            {steps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center gap-3 p-3 rounded-lg ${
                  step.status === 'completed' ? 'bg-green-900/20' :
                  step.status === 'running' ? 'bg-blue-900/20' :
                  step.status === 'failed' ? 'bg-red-900/20' :
                  'bg-gray-800'
                }`}
              >
                {step.status === 'completed' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {step.status === 'running' && <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />}
                {step.status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
                {step.status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-gray-600" />}

                <div className="flex-1">
                  <p className="text-sm text-gray-200">{step.name}</p>
                  {step.details && <p className="text-xs text-gray-400">{step.details}</p>}
                  {step.error && <p className="text-xs text-red-400">{step.error}</p>}
                </div>

                {step.duration && (
                  <span className="text-xs text-gray-500">{step.duration}ms</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-200">Logs</h3>
          <div className="h-48 overflow-y-auto bg-gray-900 rounded-lg p-3 font-mono text-xs space-y-1">
            {logs.map((log, index) => (
              <div
                key={index}
                className={
                  log.includes('✓') ? 'text-green-400' :
                  log.includes('✗') ? 'text-red-400' :
                  log.includes('▶') ? 'text-blue-400' :
                  'text-gray-400'
                }
              >
                {log}
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}

      {/* Error with Fix Agent */}
      {error && (
        <div className="space-y-4">
          <div className="p-4 bg-red-900/20 border border-red-700/50 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 flex-none" />
              <div className="flex-1">
                <p className="text-sm text-red-200 font-medium">Migration Failed</p>
                <p className="text-xs text-red-400 mt-1">{error}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={retryMigration}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
              <button
                onClick={() => setShowFixAgent(!showFixAgent)}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              >
                <Wrench className="w-3 h-3" />
                {showFixAgent ? 'Hide Fix Agent' : 'Get Help'}
              </button>
            </div>
          </div>

          {/* Fix Agent Chat */}
          {showFixAgent && (
            <div className="border border-gray-700 rounded-lg overflow-hidden">
              <div className="p-3 bg-gray-800 border-b border-gray-700 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-gray-200">Fix Agent</span>
                <span className="text-xs text-gray-500">- Describe your issue and I&apos;ll help fix it</span>
              </div>

              <div className="h-64 overflow-y-auto p-4 space-y-4 bg-gray-900">
                {fixAgentMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg text-sm ${
                        msg.role === 'user'
                          ? 'bg-blue-600 text-white'
                          : msg.role === 'system'
                          ? 'bg-red-900/30 text-red-300 border border-red-700/50'
                          : 'bg-gray-800 text-gray-200'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                      <p className="text-xs opacity-50 mt-1">
                        {msg.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {fixAgentLoading && (
                  <div className="flex items-center gap-2 text-gray-400">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Thinking...</span>
                  </div>
                )}
              </div>

              <div className="p-3 bg-gray-800 border-t border-gray-700">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={fixAgentInput}
                    onChange={(e) => setFixAgentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendToFixAgent()}
                    placeholder="Describe what you need help with..."
                    className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded text-sm"
                  />
                  <button
                    onClick={sendToFixAgent}
                    disabled={fixAgentLoading || !fixAgentInput.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 rounded text-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
