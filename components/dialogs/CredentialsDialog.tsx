'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Key,
  Eye,
  EyeOff,
  ExternalLink,
  Loader2,
  AlertCircle,
  Lock,
  Github,
  Cloud,
  Bot,
  Database,
  Container,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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
};

interface CredentialsDialogProps {
  type: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
}

/**
 * Reusable credentials dialog component
 * Can be triggered from anywhere in the app when credentials are needed
 */
export function CredentialsDialog({
  type,
  open,
  onOpenChange,
  onSuccess,
  title,
  description,
}: CredentialsDialogProps) {
  const [config, setConfig] = useState<CredentialConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load credential config when dialog opens
  useEffect(() => {
    if (open && type) {
      loadConfig();
    }
  }, [open, type]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/credentials/${type}`);
      if (!response.ok) throw new Error('Failed to load credential config');

      const data = await response.json();
      setConfig(data.config);
      setFormValues({});
      setShowPasswords({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    // Validate required fields
    for (const field of config.fields) {
      if (field.required && !formValues[field.key]) {
        setError(`${field.label} is required`);
        return;
      }
    }

    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: config.type,
          values: formValues,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save credentials');
      }

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (iconName: string) => {
    return ICONS[iconName] || Key;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {config ? (
              <>
                {(() => {
                  const Icon = getIcon(config.icon);
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
                {title || `${config.label} Credentials Required`}
              </>
            ) : (
              <>
                <Key className="h-5 w-5 text-primary" />
                Credentials Required
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {description ||
              (config &&
                `Please enter your ${config.label} credentials to continue.`)}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : config ? (
          <>
            {/* Security notice */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
              <Shield className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <span className="text-blue-700 dark:text-blue-300">
                Your credentials are encrypted and stored securely. They will only be
                used to connect to {config.label} on your behalf.
              </span>
            </div>

            <div className="space-y-4 py-2">
              {config.fields.map((field) => (
                <div key={field.key} className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-1">
                    {field.label}
                    {field.required && <span className="text-red-500">*</span>}
                  </label>

                  {field.type === 'select' ? (
                    <Select
                      value={formValues[field.key] || ''}
                      onValueChange={(value) =>
                        setFormValues((prev) => ({ ...prev, [field.key]: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder || 'Select...'} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="relative">
                      <Input
                        type={
                          field.type === 'password' && !showPasswords[field.key]
                            ? 'password'
                            : 'text'
                        }
                        placeholder={field.placeholder}
                        value={formValues[field.key] || ''}
                        onChange={(e) =>
                          setFormValues((prev) => ({
                            ...prev,
                            [field.key]: e.target.value,
                          }))
                        }
                        className={cn(field.type === 'password' && 'pr-10')}
                      />
                      {field.type === 'password' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                          onClick={() =>
                            setShowPasswords((prev) => ({
                              ...prev,
                              [field.key]: !prev[field.key],
                            }))
                          }
                        >
                          {showPasswords[field.key] ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {config.docsUrl && (
                <a
                  href={config.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  How to get your {config.label} credentials
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}

              {error && (
                <div className="flex items-center gap-2 text-red-500 text-sm">
                  <AlertCircle className="h-4 w-4" />
                  {error}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Save & Continue
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="py-8 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
            <p>Failed to load credential configuration</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to manage credential requirements
 * Returns a function to check and prompt for credentials
 */
export function useCredentials() {
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    type: string;
    onSuccess?: () => void;
  }>({
    open: false,
    type: '',
  });

  const requireCredential = async (
    type: string,
    onSuccess?: () => void
  ): Promise<boolean> => {
    // Check if credential exists
    try {
      const response = await fetch(`/api/credentials/${type}`);
      const data = await response.json();

      if (data.configured) {
        // Credential exists, proceed
        onSuccess?.();
        return true;
      }

      // Credential not configured, show dialog
      setDialogState({ open: true, type, onSuccess });
      return false;
    } catch {
      setDialogState({ open: true, type, onSuccess });
      return false;
    }
  };

  const CredentialsDialogComponent = () => (
    <CredentialsDialog
      type={dialogState.type}
      open={dialogState.open}
      onOpenChange={(open) => setDialogState((prev) => ({ ...prev, open }))}
      onSuccess={dialogState.onSuccess}
    />
  );

  return {
    requireCredential,
    CredentialsDialog: CredentialsDialogComponent,
  };
}

export default CredentialsDialog;
