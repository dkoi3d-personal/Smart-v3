'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Heart,
  Check,
  ExternalLink,
  Loader2,
  Plug,
  Unplug,
  AlertCircle,
  Key,
  Clock,
  Play,
  User,
  Pill,
  Activity,
  FileText,
  Stethoscope,
  ChevronDown,
  Copy,
  CheckCircle2,
  Lock,
  Settings,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSettings } from '../SettingsContext';
import { ServiceCard } from '../shared/ServiceCard';

export function EpicSection() {
  const {
    epicStatus,
    epicLoading,
    epicError,
    loadEpicStatus,
    connectEpic,
    disconnectEpic,
    setEpicError,
  } = useSettings();

  const [tokenDialogOpen, setTokenDialogOpen] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [patientIdInput, setPatientIdInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  // Backend OAuth state
  const [backendOAuthDialogOpen, setBackendOAuthDialogOpen] = useState(false);
  const [privateKeyInput, setPrivateKeyInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [savingBackendOAuth, setSavingBackendOAuth] = useState(false);

  // Test API state
  const [testEndpoint, setTestEndpoint] = useState('Patient/erXuFYUfucBZaryVksYEcMg3');
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Test patient: Camila Lopez
  const TEST_PATIENT_ID = 'erXuFYUfucBZaryVksYEcMg3';

  const FHIR_ENDPOINTS = [
    { value: `Patient/${TEST_PATIENT_ID}`, label: 'Test Patient (Camila)', icon: User },
    { value: `Observation?patient=${TEST_PATIENT_ID}&_count=5`, label: 'Observations', icon: Activity },
    { value: `Condition?patient=${TEST_PATIENT_ID}&_count=5`, label: 'Conditions', icon: Stethoscope },
    { value: `MedicationRequest?patient=${TEST_PATIENT_ID}&_count=5`, label: 'Medications', icon: Pill },
    { value: `Encounter?patient=${TEST_PATIENT_ID}&_count=5`, label: 'Encounters', icon: FileText },
    { value: `AllergyIntolerance?patient=${TEST_PATIENT_ID}&_count=5`, label: 'Allergies', icon: AlertCircle },
    { value: 'metadata', label: 'Server Metadata', icon: FileText },
    { value: 'custom', label: 'Custom Endpoint', icon: ChevronDown },
  ];

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    setTestError(null);

    try {
      const endpoint = testEndpoint === 'custom' ? customEndpoint : testEndpoint;

      const response = await fetch('/api/epic/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = [data.error, data.details, data.hint].filter(Boolean).join(' - ');
        throw new Error(errorMsg || 'Test failed');
      }

      setTestResult(data);
    } catch (err: any) {
      setTestError(err.message);
    } finally {
      setTesting(false);
    }
  };

  const copyResult = () => {
    if (testResult) {
      navigator.clipboard.writeText(JSON.stringify(testResult, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const saveToken = async () => {
    if (!tokenInput.trim()) {
      setEpicError('Please paste a Bearer token');
      return;
    }
    setSavingToken(true);
    setEpicError(null);
    try {
      const response = await fetch('/api/epic', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: tokenInput.trim(),
          patientId: patientIdInput.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save token');
      }
      setTokenDialogOpen(false);
      setTokenInput('');
      setPatientIdInput('');
      await loadEpicStatus();
      // Immediately run a test to confirm it works
      setTestResult(null);
      setTestError(null);
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setSavingToken(false);
    }
  };

  const saveBackendOAuth = async () => {
    if (!privateKeyInput.trim()) {
      setEpicError('Please paste your private key');
      return;
    }
    if (!clientIdInput.trim()) {
      setEpicError('Please enter your Client ID');
      return;
    }
    setSavingBackendOAuth(true);
    setEpicError(null);
    try {
      const response = await fetch('/api/epic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privateKey: privateKeyInput.trim(),
          clientId: clientIdInput.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to configure Backend OAuth');
      }
      setBackendOAuthDialogOpen(false);
      setPrivateKeyInput('');
      setClientIdInput('');
      await loadEpicStatus();
    } catch (err: any) {
      setEpicError(err.message);
    } finally {
      setSavingBackendOAuth(false);
    }
  };

  const getStatus = () => {
    if (epicStatus?.connected) return 'success';
    if (epicStatus?.configured) return 'warning';
    return 'inactive';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Epic Healthcare</h2>
        <p className="text-muted-foreground">
          Connect to Epic EHR for FHIR-based healthcare data integration
        </p>
      </div>

      {/* Main Card */}
      <ServiceCard
        title="Epic FHIR API"
        description="EHR & Patient Data Access"
        icon={<Heart className="h-5 w-5" />}
        status={getStatus()}
        onRefresh={loadEpicStatus}
        loading={epicLoading}
        externalLinkUrl="https://fhir.epic.com"
      >
        {epicStatus && (
          <div className="space-y-4">
            {/* Status Display */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  {epicStatus.connected
                    ? 'Connected'
                    : epicStatus.configured
                    ? 'Configured (Token Expired)'
                    : 'Not Connected'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {epicStatus.connected
                    ? `Environment: ${epicStatus.environment}`
                    : epicStatus.configured
                    ? 'Reconnect to refresh your access token'
                    : 'Connect to Epic to enable healthcare data access'}
                </p>
              </div>
              {epicStatus.connected && (
                <Badge className="bg-green-600 text-white text-xs">
                  <Check className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              )}
            </div>

            {/* Connection Details */}
            {epicStatus.configured && (
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                {epicStatus.clientId && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Client ID:</span>
                    <code className="font-mono">
                      {epicStatus.clientId.substring(0, 8)}...
                    </code>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Environment:</span>
                  <Badge variant="outline" className="text-xs">
                    {epicStatus.environment}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Auth Method:</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${epicStatus.hasPrivateKey ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}`}
                  >
                    {epicStatus.hasPrivateKey ? (
                      <>
                        <Lock className="h-3 w-3 mr-1" />
                        Backend OAuth
                      </>
                    ) : (
                      'Manual Token'
                    )}
                  </Badge>
                </div>
                {epicStatus.tokenInfo && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Token Expires:</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(epicStatus.tokenInfo.expiresAt).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Error Display */}
            {epicError && (
              <div className="p-2 rounded bg-red-50 dark:bg-red-950/30 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="h-3 w-3" />
                {epicError}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 ml-auto text-xs"
                  onClick={() => setEpicError(null)}
                >
                  Dismiss
                </Button>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-wrap">
              {epicStatus.connected ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={disconnectEpic}
                  disabled={epicLoading}
                >
                  <Unplug className="h-3.5 w-3.5 mr-1.5" />
                  Disconnect
                </Button>
              ) : (
                <>
                  <Button size="sm" onClick={connectEpic} disabled={epicLoading}>
                    {epicLoading ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Plug className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Connect with OAuth
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setTokenDialogOpen(true)}
                  >
                    <Key className="h-3.5 w-3.5 mr-1.5" />
                    Paste Token
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setBackendOAuthDialogOpen(true)}
                  >
                    <Lock className="h-3.5 w-3.5 mr-1.5" />
                    Backend OAuth
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </ServiceCard>

      {/* Test API Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Play className="h-5 w-5 text-green-500" />
            Test FHIR API
          </CardTitle>
          <CardDescription>
            Test your Epic connection by querying FHIR endpoints
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Endpoint Selector */}
          <div className="flex gap-2">
            <Select value={testEndpoint} onValueChange={setTestEndpoint}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select endpoint" />
              </SelectTrigger>
              <SelectContent>
                {FHIR_ENDPOINTS.map((ep) => (
                  <SelectItem key={ep.value} value={ep.value}>
                    <div className="flex items-center gap-2">
                      <ep.icon className="h-4 w-4" />
                      {ep.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={runTest} disabled={testing || (!epicStatus?.configured && !epicStatus?.connected)}>
              {testing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Custom Endpoint Input */}
          {testEndpoint === 'custom' && (
            <Input
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              placeholder="e.g., Patient/erXuFYUfucBZaryVksYEcMg3"
              className="font-mono text-sm"
            />
          )}

          {/* Test Error */}
          {testError && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-red-600 text-sm space-y-2">
              <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="h-4 w-4" />
                Error
              </div>
              <pre className="text-xs whitespace-pre-wrap font-mono bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-auto max-h-32">
                {testError}
              </pre>
              {testError.includes('expired') || testError.includes('401') ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Epic sandbox tokens expire in ~5 minutes. Get a fresh token and try again quickly!
                </p>
              ) : null}
            </div>
          )}

          {/* Test Result */}
          {testResult && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">Success</span>
                  {testResult.total !== undefined && (
                    <Badge variant="secondary">{testResult.total} results</Badge>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={copyResult}>
                  {copied ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <ScrollArea className="h-64 rounded-lg border bg-muted/30">
                <pre className="p-3 text-xs font-mono whitespace-pre-wrap">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              </ScrollArea>
            </div>
          )}

          {/* Help Text */}
          {!testResult && !testError && !testing && (
            <p className="text-xs text-muted-foreground">
              {epicStatus?.configured || epicStatus?.connected
                ? 'Select an endpoint and click the play button to test your connection.'
                : 'Connect to Epic first to test the FHIR API.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Epic Integration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            The Epic integration enables access to FHIR-based healthcare data for building
            healthcare applications:
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Patient demographics and records</li>
            <li>Clinical data (conditions, medications, allergies)</li>
            <li>Appointment scheduling</li>
            <li>Lab results and observations</li>
          </ul>
          <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
            <p className="text-yellow-700 dark:text-yellow-300 text-xs">
              <span className="font-medium">Note:</span> Epic integration requires proper
              credentials and authorization. For development, you can use Epic's sandbox
              environment.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('https://fhir.epic.com/Documentation', '_blank')}
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            Epic FHIR Documentation
          </Button>
        </CardContent>
      </Card>

      {/* Token Dialog */}
      <Dialog open={tokenDialogOpen} onOpenChange={setTokenDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Paste Epic Bearer Token</DialogTitle>
            <DialogDescription>
              Get a token from Epic's sandbox "Try It" feature
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Instructions */}
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm space-y-2">
              <p className="font-medium text-blue-700 dark:text-blue-300">How to get a token:</p>
              <ol className="list-decimal list-inside text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>Go to <a href="https://fhir.epic.com/Specifications?api=972" target="_blank" rel="noopener noreferrer" className="underline">Epic Patient API</a></li>
                <li>Scroll to "Try It" section</li>
                <li>Select a test patient (e.g., Camila Lopez)</li>
                <li>Click "Get Data"</li>
                <li>Click "Raw Request" to expand</li>
                <li>Copy the token after "Bearer " in the Authorization header</li>
              </ol>
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 mt-2">
                <Clock className="h-3 w-3" />
                Tokens expire in ~5 minutes!
              </p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Bearer Token</label>
              <Textarea
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9..."
                rows={6}
                className="font-mono text-xs break-all overflow-wrap-anywhere"
                style={{ wordBreak: 'break-all', overflowWrap: 'anywhere' }}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Patient ID (Optional)</label>
              <Input
                value={patientIdInput}
                onChange={(e) => setPatientIdInput(e.target.value)}
                placeholder="e.g., erXuFYUfucBZaryVksYEcMg3"
              />
              <p className="text-xs text-muted-foreground">
                For patient-level access, provide the patient's FHIR ID
              </p>
            </div>
            {epicError && <p className="text-sm text-red-600">{epicError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTokenDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveToken} disabled={savingToken || !tokenInput.trim()}>
              {savingToken ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Save Token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Backend OAuth Dialog */}
      <Dialog open={backendOAuthDialogOpen} onOpenChange={setBackendOAuthDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Configure Backend OAuth
            </DialogTitle>
            <DialogDescription>
              Set up JWT-based authentication for automatic token refresh
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Benefits */}
            <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 text-sm space-y-2">
              <p className="font-medium text-green-700 dark:text-green-300">Benefits of Backend OAuth:</p>
              <ul className="list-disc list-inside text-xs text-green-600 dark:text-green-400 space-y-1">
                <li>Tokens auto-refresh (no 5-minute expiration!)</li>
                <li>No user interaction needed</li>
                <li>Best for production apps</li>
              </ul>
            </div>

            {/* Instructions */}
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm space-y-2">
              <p className="font-medium text-blue-700 dark:text-blue-300">How to set up:</p>
              <ol className="list-decimal list-inside text-xs text-blue-600 dark:text-blue-400 space-y-1">
                <li>Go to <a href="https://fhir.epic.com/Developer/Apps" target="_blank" rel="noopener noreferrer" className="underline">Epic Developer Portal</a></li>
                <li>Create or select a "Backend Systems" app</li>
                <li>Generate an RSA key pair (or upload your public key)</li>
                <li>Download the private key (PEM format)</li>
                <li>Copy your Client ID from the app details</li>
              </ol>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Client ID</label>
              <Input
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Private Key (PEM format)</label>
              <Textarea
                value={privateKeyInput}
                onChange={(e) => setPrivateKeyInput(e.target.value)}
                placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkq...&#10;-----END PRIVATE KEY-----"
                rows={8}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Your private key stays local and is never sent to Epic
              </p>
            </div>

            {epicError && <p className="text-sm text-red-600">{epicError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackendOAuthDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={saveBackendOAuth}
              disabled={savingBackendOAuth || !privateKeyInput.trim() || !clientIdInput.trim()}
            >
              {savingBackendOAuth ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Lock className="h-4 w-4 mr-2" />
              )}
              Configure
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
