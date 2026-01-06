/**
 * Credentials Store
 *
 * Secure storage for API keys and credentials for database providers and cloud services.
 * Credentials are stored in data/credentials.json (which should be in .gitignore)
 */

import * as fs from 'fs/promises';
import * as path from 'path';

const CREDENTIALS_FILE = path.join(process.cwd(), 'data', 'credentials.json');

/**
 * Simple encryption/decryption for stored credentials
 * In production, use proper encryption with secure key management
 */
export async function encryptData(data: string): Promise<string> {
  // Simple base64 encoding - replace with proper encryption in production
  return Buffer.from(data).toString('base64');
}

export async function decryptData(data: string): Promise<string> {
  // Simple base64 decoding - replace with proper decryption in production
  try {
    return Buffer.from(data, 'base64').toString('utf-8');
  } catch {
    return data; // Return as-is if not encoded
  }
}

// Provider types for database credentials
export type ProviderType = 'neon' | 'supabase' | 'aws' | 'vercel' | 'azure' | 'epic' | 'github' | 'openai' | 'anthropic' | 'gcp' | 'docker' | 'openshift' | 'databricks';

// CredentialType is an alias for ProviderType for API compatibility
export type CredentialType = ProviderType;

export interface NeonCredentials {
  apiKey: string;
  projectId?: string;
}

export interface SupabaseCredentials {
  accessToken: string;
  projectRef?: string;
  anonKey?: string;
  serviceRoleKey?: string;
}

export interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  region: string;
}

export interface VercelCredentials {
  token: string;
  teamId?: string;
}

export interface AzureCredentials {
  subscriptionId: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

export interface EpicCredentials {
  clientId: string;
  privateKey?: string;
  publicKey?: string;
  fhirBaseUrl?: string;
}

export interface GitHubCredentials {
  token: string;
  username?: string;
}

export interface OpenAICredentials {
  apiKey: string;
}

export interface AnthropicCredentials {
  apiKey: string;
}

// CredentialData is a simple key-value map for flexibility
// Use specific interfaces (NeonCredentials, etc.) for type safety in specific contexts
export type CredentialData = Record<string, string>;

interface CredentialField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'textarea';
  required: boolean;
  placeholder?: string;
}

interface CredentialConfig {
  type: CredentialType;
  label: string;
  description: string;
  icon?: string;
  fields: CredentialField[];
}

// Configuration for all credential types
export const CREDENTIAL_CONFIGS: CredentialConfig[] = [
  {
    type: 'neon',
    label: 'Neon',
    description: 'Serverless PostgreSQL database',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'neon-api-key...' },
      { key: 'projectId', label: 'Project ID', type: 'text', required: false, placeholder: 'optional' },
    ],
  },
  {
    type: 'supabase',
    label: 'Supabase',
    description: 'PostgreSQL with auth and realtime',
    fields: [
      { key: 'accessToken', label: 'Access Token', type: 'password', required: true, placeholder: 'sbp_...' },
      { key: 'projectRef', label: 'Project Ref', type: 'text', required: false },
      { key: 'anonKey', label: 'Anon Key', type: 'password', required: false },
      { key: 'serviceRoleKey', label: 'Service Role Key', type: 'password', required: false },
    ],
  },
  {
    type: 'aws',
    label: 'AWS',
    description: 'Amazon Web Services',
    fields: [
      { key: 'accessKeyId', label: 'Access Key ID', type: 'password', required: true },
      { key: 'secretAccessKey', label: 'Secret Access Key', type: 'password', required: true },
      { key: 'region', label: 'Region', type: 'text', required: true, placeholder: 'us-east-1' },
    ],
  },
  {
    type: 'azure',
    label: 'Azure',
    description: 'Microsoft Azure',
    fields: [
      { key: 'subscriptionId', label: 'Subscription ID', type: 'text', required: true },
      { key: 'tenantId', label: 'Tenant ID', type: 'text', required: true },
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
  },
  {
    type: 'vercel',
    label: 'Vercel',
    description: 'Deployment platform',
    fields: [
      { key: 'token', label: 'API Token', type: 'password', required: true },
      { key: 'teamId', label: 'Team ID', type: 'text', required: false },
    ],
  },
  {
    type: 'epic',
    label: 'Epic FHIR',
    description: 'Epic Healthcare FHIR API',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'privateKey', label: 'Private Key', type: 'textarea', required: false },
      { key: 'publicKey', label: 'Public Key', type: 'textarea', required: false },
      { key: 'fhirBaseUrl', label: 'FHIR Base URL', type: 'text', required: false, placeholder: 'https://fhir.epic.com/...' },
    ],
  },
  {
    type: 'github',
    label: 'GitHub',
    description: 'GitHub API',
    fields: [
      { key: 'token', label: 'Personal Access Token', type: 'password', required: true },
      { key: 'username', label: 'Username', type: 'text', required: false },
    ],
  },
  {
    type: 'openai',
    label: 'OpenAI',
    description: 'OpenAI API',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-...' },
    ],
  },
  {
    type: 'anthropic',
    label: 'Anthropic',
    description: 'Anthropic Claude API',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'sk-ant-...' },
    ],
  },
  {
    type: 'gcp',
    label: 'Google Cloud',
    description: 'Google Cloud Platform',
    fields: [
      { key: 'projectId', label: 'Project ID', type: 'text', required: true },
      { key: 'keyFile', label: 'Service Account Key', type: 'textarea', required: true },
    ],
  },
  {
    type: 'docker',
    label: 'Docker Hub',
    description: 'Docker container registry',
    fields: [
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password/Token', type: 'password', required: true },
    ],
  },
  {
    type: 'openshift',
    label: 'OpenShift',
    description: 'Red Hat OpenShift',
    fields: [
      { key: 'serverUrl', label: 'Server URL', type: 'text', required: true },
      { key: 'token', label: 'API Token', type: 'password', required: true },
    ],
  },
  {
    type: 'databricks',
    label: 'Databricks',
    description: 'Databricks workspace',
    fields: [
      { key: 'host', label: 'Workspace URL', type: 'text', required: true },
      { key: 'token', label: 'Access Token', type: 'password', required: true },
    ],
  },
];

interface CredentialsStore {
  [key: string]: Record<string, Record<string, string>>;
}

/**
 * Load credentials store from disk
 */
async function loadStore(): Promise<CredentialsStore> {
  try {
    const data = await fs.readFile(CREDENTIALS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save credentials store to disk
 */
async function saveStore(store: CredentialsStore): Promise<void> {
  // Ensure data directory exists
  const dataDir = path.dirname(CREDENTIALS_FILE);
  await fs.mkdir(dataDir, { recursive: true });

  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(store, null, 2));
}

/**
 * Get credentials for a specific provider
 */
export async function getCredential<T extends CredentialData>(
  provider: ProviderType,
  userId: string = 'default'
): Promise<T | null> {
  const store = await loadStore();
  const providerStore = store[provider];
  if (!providerStore) return null;
  return (providerStore[userId] as T) || null;
}

/**
 * Save credentials for a specific provider (alias: setCredential)
 */
export async function saveCredential<T extends CredentialData>(
  provider: ProviderType,
  credentials: T,
  userId: string = 'default'
): Promise<void> {
  const store = await loadStore();
  if (!store[provider]) {
    store[provider] = {};
  }
  store[provider][userId] = credentials as Record<string, string>;
  await saveStore(store);
}

// Alias for API compatibility
export const setCredential = saveCredential;

/**
 * Delete credentials for a specific provider
 */
export async function deleteCredential(
  provider: ProviderType,
  userId: string = 'default'
): Promise<void> {
  const store = await loadStore();
  if (store[provider]) {
    delete store[provider][userId];
    await saveStore(store);
  }
}

/**
 * List all credential names for a provider
 */
export async function listCredentials(provider: ProviderType): Promise<string[]> {
  const store = await loadStore();
  return Object.keys(store[provider] || {});
}

/**
 * Check if credentials exist for a provider
 */
export async function hasCredential(
  provider: ProviderType,
  userId: string = 'default'
): Promise<boolean> {
  const cred = await getCredential(provider, userId);
  return cred !== null;
}

/**
 * Get credential status for all types for a user
 */
export async function getCredentialStatus(
  userId: string = 'default'
): Promise<Record<CredentialType, boolean>> {
  const store = await loadStore();
  const result: Record<string, boolean> = {};

  for (const config of CREDENTIAL_CONFIGS) {
    const providerStore = store[config.type];
    result[config.type] = !!(providerStore && providerStore[userId]);
  }

  return result as Record<CredentialType, boolean>;
}

/**
 * Get all credentials (masked for display)
 */
export async function getAllCredentialsMasked(): Promise<Record<ProviderType, Record<string, { exists: boolean }>>> {
  const store = await loadStore();
  const result: Record<string, Record<string, { exists: boolean }>> = {};

  for (const provider of Object.keys(store)) {
    result[provider] = {};
    for (const userId of Object.keys(store[provider])) {
      result[provider][userId] = { exists: true };
    }
  }

  return result as Record<ProviderType, Record<string, { exists: boolean }>>;
}

/**
 * Helper function to load all database-related credentials
 * Used by migration and provisioning APIs
 */
export async function loadDatabaseCredentials(): Promise<{
  neonApiKey?: string;
  supabaseAccessToken?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  awsRegion?: string;
  azureSubscriptionId?: string;
  azureResourceGroup?: string;
  azureTenantId?: string;
  azureClientId?: string;
  azureClientSecret?: string;
}> {
  const neonCreds = await getCredential('neon', 'default');
  const supabaseCreds = await getCredential('supabase', 'default');
  const awsCreds = await getCredential('aws', 'default');
  const azureCreds = await getCredential('azure', 'default');

  return {
    neonApiKey: neonCreds?.apiKey,
    supabaseAccessToken: supabaseCreds?.accessToken,
    awsAccessKeyId: awsCreds?.accessKeyId,
    awsSecretAccessKey: awsCreds?.secretAccessKey,
    awsRegion: awsCreds?.region,
    azureSubscriptionId: azureCreds?.subscriptionId,
    azureResourceGroup: azureCreds?.resourceGroup,
    azureTenantId: azureCreds?.tenantId,
    azureClientId: azureCreds?.clientId,
    azureClientSecret: azureCreds?.clientSecret,
  };
}

export default {
  getCredential,
  saveCredential,
  setCredential,
  deleteCredential,
  listCredentials,
  hasCredential,
  getCredentialStatus,
  getAllCredentialsMasked,
  loadDatabaseCredentials,
  CREDENTIAL_CONFIGS,
};
