/**
 * Microsoft Teams Integration — NOT YET IMPLEMENTED
 *
 * TODO: Planned functionality
 * - testConnection: Call /me endpoint using Graph API token
 * - sendNotification: POST adaptive card to a Teams channel via webhook
 *   - Ticket created / updated / escalated
 *   - Maintenance window announcements
 * - syncData: Sync Teams users/groups with Atlas memberships
 *   - Import users from Azure AD groups
 *   - Auto-provision org memberships
 *
 * Setup required in integrationConfigs.config:
 * {
 *   webhookUrl: string;      // Incoming webhook URL for the Teams channel
 *   tenantId: string;        // Azure AD tenant ID (same as MICROSOFT_GRAPH_TENANT_ID)
 *   clientId: string;        // Azure app client ID
 *   clientSecret: string;    // Azure app client secret
 * }
 *
 * NOTE: The Microsoft Graph client in lib/email/graph-client.ts provides
 * auth primitives that can be reused here.
 */

import type {
  IntegrationConfig,
  IntegrationResult,
  IntegrationProvider,
} from "./types";

export const teamsIntegration: IntegrationProvider = {
  async testConnection(_config: IntegrationConfig): Promise<IntegrationResult> {
    return {
      success: false,
      error: "Microsoft Teams integration is not yet implemented",
    };
  },

  async sendNotification(
    _config: IntegrationConfig,
    _payload: unknown,
  ): Promise<IntegrationResult> {
    return {
      success: false,
      error: "Microsoft Teams integration is not yet implemented",
    };
  },

  async syncData(_config: IntegrationConfig): Promise<IntegrationResult> {
    return {
      success: false,
      error: "Microsoft Teams integration is not yet implemented",
    };
  },
};
