/**
 * Credential Requirements Helper
 *
 * Provides utilities for API routes to check and retrieve credentials.
 * Returns user-friendly error responses when credentials are missing.
 */

import { NextResponse } from 'next/server';
import { getCredential, CredentialType, CREDENTIAL_CONFIGS } from './credentials-store';

/**
 * Result of a credential check
 */
export interface CredentialResult<T extends Record<string, string>> {
  success: boolean;
  values?: T;
  errorResponse?: NextResponse;
}

/**
 * Check if a credential is configured and return its values
 * If not configured, returns an appropriate error response
 */
export async function requireCredential<T extends Record<string, string>>(
  type: CredentialType,
  userId: string = 'default'
): Promise<CredentialResult<T>> {
  const values = await getCredential(type, userId);

  if (!values) {
    const config = CREDENTIAL_CONFIGS.find(c => c.type === type);
    const label = config?.label || type;

    return {
      success: false,
      errorResponse: NextResponse.json(
        {
          error: `${label} credentials required`,
          code: 'CREDENTIALS_REQUIRED',
          credentialType: type,
          message: `Please configure your ${label} credentials in Settings to use this feature.`,
          settingsUrl: '/settings',
        },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    values: values as T,
  };
}

/**
 * Get AWS credentials if configured
 */
export async function getAWSCredentials(userId: string = 'default') {
  return requireCredential<{
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  }>('aws', userId);
}

/**
 * Get GitHub credentials if configured
 */
export async function getGitHubCredentials(userId: string = 'default') {
  return requireCredential<{
    token: string;
    username?: string;
  }>('github', userId);
}

/**
 * Get Anthropic credentials if configured
 */
export async function getAnthropicCredentials(userId: string = 'default') {
  return requireCredential<{
    apiKey: string;
  }>('anthropic', userId);
}

/**
 * Get Databricks credentials if configured
 */
export async function getDatabricksCredentials(userId: string = 'default') {
  return requireCredential<{
    host: string;
    token: string;
  }>('databricks', userId);
}

/**
 * Get OpenShift credentials if configured
 */
export async function getOpenShiftCredentials(userId: string = 'default') {
  return requireCredential<{
    serverUrl: string;
    token: string;
    namespace?: string;
  }>('openshift', userId);
}

/**
 * Get Azure credentials if configured
 */
export async function getAzureCredentials(userId: string = 'default') {
  return requireCredential<{
    subscriptionId: string;
    tenantId: string;
    clientId: string;
    clientSecret: string;
  }>('azure', userId);
}

/**
 * Get GCP credentials if configured
 */
export async function getGCPCredentials(userId: string = 'default') {
  return requireCredential<{
    projectId: string;
    serviceAccountKey: string;
  }>('gcp', userId);
}

/**
 * Get Docker registry credentials if configured
 */
export async function getDockerCredentials(userId: string = 'default') {
  return requireCredential<{
    registry: string;
    username: string;
    password: string;
  }>('docker', userId);
}

/**
 * Check if a credential is configured (without returning values)
 */
export async function hasCredentialConfigured(
  type: CredentialType,
  userId: string = 'default'
): Promise<boolean> {
  const values = await getCredential(type, userId);
  return values !== null;
}

export default {
  requireCredential,
  getAWSCredentials,
  getGitHubCredentials,
  getAnthropicCredentials,
  getDatabricksCredentials,
  getOpenShiftCredentials,
  getAzureCredentials,
  getGCPCredentials,
  getDockerCredentials,
  hasCredentialConfigured,
};
