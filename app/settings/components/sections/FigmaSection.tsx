'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  Figma,
  Check,
  ExternalLink,
  Loader2,
  Plug,
  Unplug,
  Play,
  CheckCircle,
  XCircle,
  AlertCircle,
  Bot,
} from 'lucide-react';
import { useSettings } from '../SettingsContext';
import { ServiceCard } from '../shared/ServiceCard';

export function FigmaSection() {
  const {
    figmaStatus,
    figmaLoading,
    figmaError,
    loadFigmaStatus,
    saveFigmaToken,
    disconnectFigma,
    testFigmaConnection,
    setFigmaError,
    mcpConfig,
    mcpLoading,
    saveMcpConfig,
  } = useSettings();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [togglingMcp, setTogglingMcp] = useState(false);
  const [testingMcp, setTestingMcp] = useState(false);
  const [mcpTestResult, setMcpTestResult] = useState<{
    success: boolean;
    errors?: string[];
    figmaToken?: { available: boolean; masked?: string };
  } | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
    user?: { email: string };
    recentFile?: { name: string; key: string; thumbnail: string };
  } | null>(null);

  const handleToggleFigmaMcp = async (enabled: boolean) => {
    setTogglingMcp(true);
    setMcpTestResult(null);
    await saveMcpConfig({ figmaMcpEnabled: enabled });
    setTogglingMcp(false);
  };

  const handleTestMcp = async () => {
    setTestingMcp(true);
    setMcpTestResult(null);
    try {
      const response = await fetch('/api/settings/mcp/test');
      const result = await response.json();
      setMcpTestResult(result);
    } catch {
      setMcpTestResult({ success: false, errors: ['Failed to test MCP configuration'] });
    }
    setTestingMcp(false);
  };

  const handleSave = async () => {
    if (!tokenInput.trim()) return;
    setSaving(true);
    const success = await saveFigmaToken(tokenInput);
    if (success) {
      setDialogOpen(false);
      setTokenInput('');
    }
    setSaving(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await testFigmaConnection();
    setTestResult(result);
    setTesting(false);
  };

  const getStatus = () => {
    return figmaStatus?.configured ? 'success' : 'inactive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Figma Integration</h2>
        <p className="text-muted-foreground">
          Connect Figma to import designs directly into your projects
        </p>
      </div>

      {/* Main Card */}
      <ServiceCard
        title="Figma API"
        description="Design imports and extraction"
        icon={<Figma className="h-5 w-5" />}
        status={getStatus()}
        onRefresh={loadFigmaStatus}
        loading={figmaLoading}
        externalLinkUrl="https://www.figma.com/developers/api"
      >
        {figmaStatus && (
          <div className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {figmaStatus.configured ? 'Connected' : 'Not Connected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {figmaStatus.configured
                    ? figmaStatus.accountEmail || 'Personal Access Token configured'
                    : 'Add a Figma Personal Access Token to enable design imports'}
                </p>
              </div>
              {figmaStatus.configured && (
                <Badge className="bg-green-600 text-white text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>

            {/* Token Info */}
            {figmaStatus.configured && figmaStatus.tokenMasked && (
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Token</p>
                    <code className="text-xs font-mono">{figmaStatus.tokenMasked}</code>
                  </div>
                  {figmaStatus.lastValidated && (
                    <p className="text-xs text-muted-foreground">
                      Validated: {new Date(figmaStatus.lastValidated).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Error Display */}
            {figmaError && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {figmaError}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 ml-auto text-xs"
                  onClick={() => setFigmaError(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={`p-3 rounded-lg ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-950/30'
                    : 'bg-red-50 dark:bg-red-950/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  {testResult.success ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      testResult.success ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                  </span>
                </div>
                {testResult.user && (
                  <p className="text-xs text-muted-foreground">
                    Authenticated as: {testResult.user.email}
                  </p>
                )}
                {testResult.error && (
                  <p className="text-xs text-red-600">{testResult.error}</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2">
              {figmaStatus.configured ? (
                <>
                  <Button size="sm" variant="outline" onClick={handleTest} disabled={testing}>
                    {testing ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Play className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Test Connection
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDialogOpen(true)}
                  >
                    Update Token
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={disconnectFigma}
                    disabled={figmaLoading}
                  >
                    <Unplug className="h-3.5 w-3.5 mr-1.5" />
                    Disconnect
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plug className="h-3.5 w-3.5 mr-1.5" />
                  Connect Figma
                </Button>
              )}
            </div>
          </div>
        )}
      </ServiceCard>

      {/* Agent MCP Access */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Agent Access (MCP)
          </CardTitle>
          <CardDescription>
            Allow AI agents to access Figma directly during builds via Model Context Protocol
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <div className="text-sm font-medium">Enable Figma MCP for Agents</div>
              <p className="text-xs text-muted-foreground">
                Agents can fetch design data and download images directly from Figma during builds
              </p>
            </div>
            <Switch
              checked={mcpConfig?.figmaMcpEnabled ?? false}
              onCheckedChange={handleToggleFigmaMcp}
              disabled={togglingMcp || mcpLoading || !figmaStatus?.configured}
            />
          </div>
          {!figmaStatus?.configured && (
            <p className="text-xs text-amber-600">
              Connect Figma above to enable agent access
            </p>
          )}
          {mcpConfig?.figmaMcpEnabled && figmaStatus?.configured && (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-sm">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span className="font-medium">Figma MCP Active</span>
                </div>
                <p className="text-xs text-green-600 dark:text-green-500 mt-1">
                  Agents can now use <code className="bg-green-100 dark:bg-green-900 px-1 rounded">mcp__figma__get_figma_data</code> and <code className="bg-green-100 dark:bg-green-900 px-1 rounded">mcp__figma__download_figma_images</code> during builds.
                </p>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={handleTestMcp}
                disabled={testingMcp}
              >
                {testingMcp ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                )}
                Test MCP Setup
              </Button>

              {mcpTestResult && (
                <div
                  className={`p-3 rounded-lg text-sm ${
                    mcpTestResult.success
                      ? 'bg-green-50 dark:bg-green-950/30'
                      : 'bg-red-50 dark:bg-red-950/30'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {mcpTestResult.success ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <span
                      className={`font-medium ${
                        mcpTestResult.success ? 'text-green-700' : 'text-red-700'
                      }`}
                    >
                      {mcpTestResult.success ? 'MCP Ready' : 'MCP Configuration Issue'}
                    </span>
                  </div>
                  {mcpTestResult.figmaToken?.available && (
                    <p className="text-xs text-muted-foreground">
                      Token: {mcpTestResult.figmaToken.masked}
                    </p>
                  )}
                  {mcpTestResult.errors?.map((err, i) => (
                    <p key={i} className="text-xs text-red-600 mt-1">
                      {err}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How to get Token */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Getting a Figma Personal Access Token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>Go to your Figma account settings</li>
            <li>Navigate to the "Personal Access Tokens" section</li>
            <li>Click "Generate new token"</li>
            <li>Give it a descriptive name (e.g., "AI Platform")</li>
            <li>Copy the token and paste it here</li>
          </ol>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              window.open('https://www.figma.com/developers/api#access-tokens', '_blank')
            }
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Figma API Documentation
          </Button>
        </CardContent>
      </Card>

      {/* Token Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {figmaStatus?.configured ? 'Update Figma Token' : 'Connect Figma'}
            </DialogTitle>
            <DialogDescription>
              Enter your Figma Personal Access Token to enable design imports.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Personal Access Token</label>
              <Input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="figd_xxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </div>
            {figmaError && <p className="text-sm text-red-600">{figmaError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !tokenInput.trim()}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
