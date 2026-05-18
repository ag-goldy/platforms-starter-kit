/**
 * Slack Integration — NOT YET IMPLEMENTED
 *
 * TODO: Planned functionality
 * - testConnection: POST /api/auth.test with bot token to verify workspace access
 * - sendNotification: POST /chat.postMessage to a configured channel
 *   - Ticket created / assigned / status changed
 *   - Critical alerts from Zabbix
 * - syncData: Sync Slack users with Atlas users (user provisioning)
 *   - Import users from Slack workspace
 *   - Map Slack users to Atlas memberships
 *
 * Setup required in integrationConfigs.config:
 * {
 *   botToken: string;        // xoxb-... Slack Bot Token
 *   channelId: string;       // Default notification channel
 *   signingSecret: string;   // For verifying incoming webhooks
 * }
 */

import type { IntegrationConfig, IntegrationResult, IntegrationProvider } from './types';

export const slackIntegration: IntegrationProvider = {
  async testConnection(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'Slack integration is not yet implemented' };
  },

  async sendNotification(_config: IntegrationConfig, _payload: unknown): Promise<IntegrationResult> {
    return { success: false, error: 'Slack integration is not yet implemented' };
  },

  async syncData(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'Slack integration is not yet implemented' };
  },
};
