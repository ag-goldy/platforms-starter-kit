/**
 * GitHub Integration — NOT YET IMPLEMENTED
 *
 * TODO: Planned functionality
 * - testConnection: GET /user using personal access token or GitHub App JWT
 * - sendNotification: POST /repos/{owner}/{repo}/issues to create a GitHub issue
 *   - Link GitHub issue number back to Atlas ticket
 *   - Post Atlas ticket updates as issue comments
 * - syncData: Sync GitHub issues / PRs that reference Atlas ticket keys
 *   - Parse commit messages / PR titles for ticket keys (e.g. ATL-1234)
 *   - Update Atlas ticket status when linked PR is merged
 *
 * Setup required in integrationConfigs.config:
 * {
 *   accessToken: string;     // GitHub personal access token or App installation token
 *   owner: string;           // GitHub org or user name
 *   repo: string;            // Default repository name
 *   webhookSecret: string;   // Secret for validating GitHub webhook payloads
 * }
 */

import type { IntegrationConfig, IntegrationResult, IntegrationProvider } from './types';

export const githubIntegration: IntegrationProvider = {
  async testConnection(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'GitHub integration is not yet implemented' };
  },

  async sendNotification(_config: IntegrationConfig, _payload: unknown): Promise<IntegrationResult> {
    return { success: false, error: 'GitHub integration is not yet implemented' };
  },

  async syncData(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'GitHub integration is not yet implemented' };
  },
};
