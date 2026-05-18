/**
 * Integration Registry
 *
 * Maps provider names (as stored in integrationConfigs.provider) to their
 * implementation modules. All providers currently return stub responses.
 *
 * Usage:
 *   import { getIntegration } from '@/lib/integrations';
 *   const provider = getIntegration('slack');
 *   const result = await provider.testConnection(config.config);
 */

import type { IntegrationProvider } from './types';
import { slackIntegration } from './slack';
import { teamsIntegration } from './teams';
import { jiraIntegration } from './jira';
import { githubIntegration } from './github';
import { salesforceIntegration } from './salesforce';

export type IntegrationProviderName = 'slack' | 'teams' | 'jira' | 'github' | 'salesforce';

const REGISTRY: Record<IntegrationProviderName, IntegrationProvider> = {
  slack: slackIntegration,
  teams: teamsIntegration,
  jira: jiraIntegration,
  github: githubIntegration,
  salesforce: salesforceIntegration,
};

/**
 * Returns the integration provider for the given name.
 * Throws if the provider is unknown.
 */
export function getIntegration(provider: string): IntegrationProvider {
  const impl = REGISTRY[provider as IntegrationProviderName];
  if (!impl) {
    throw new Error(`Unknown integration provider: ${provider}`);
  }
  return impl;
}

/**
 * Returns true if the provider is known (even if not yet implemented).
 */
export function isKnownProvider(provider: string): provider is IntegrationProviderName {
  return provider in REGISTRY;
}

export { type IntegrationProvider, type IntegrationProviderName as ProviderName };
export * from './types';
