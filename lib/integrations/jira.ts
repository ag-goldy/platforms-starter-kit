/**
 * Jira Integration — NOT YET IMPLEMENTED
 *
 * TODO: Planned functionality
 * - testConnection: GET /rest/api/3/myself to verify API token + base URL
 * - sendNotification: POST /rest/api/3/issue to create a Jira issue from an Atlas ticket
 *   - Map Atlas priority → Jira priority
 *   - Link Jira issue ID back to Atlas ticket (custom field or comment)
 * - syncData: Bidirectional sync of ticket status
 *   - Atlas ticket resolved → Close linked Jira issue
 *   - Jira issue closed → Update Atlas ticket status
 *   - Sync comments between systems
 *
 * Setup required in integrationConfigs.config:
 * {
 *   baseUrl: string;         // e.g. https://myorg.atlassian.net
 *   email: string;           // Atlassian account email for Basic Auth
 *   apiToken: string;        // Atlassian API token
 *   projectKey: string;      // Default Jira project (e.g. "SUP")
 *   issueTypeId: string;     // Default issue type ID
 * }
 */

import type { IntegrationConfig, IntegrationResult, IntegrationProvider } from './types';

export const jiraIntegration: IntegrationProvider = {
  async testConnection(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'Jira integration is not yet implemented' };
  },

  async sendNotification(_config: IntegrationConfig, _payload: unknown): Promise<IntegrationResult> {
    return { success: false, error: 'Jira integration is not yet implemented' };
  },

  async syncData(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'Jira integration is not yet implemented' };
  },
};
