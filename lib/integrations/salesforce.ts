/**
 * Salesforce Integration — NOT YET IMPLEMENTED
 *
 * TODO: Planned functionality
 * - testConnection: GET /services/data/v57.0/ with OAuth token to verify connection
 * - sendNotification: POST /services/data/v57.0/sobjects/Case to create Salesforce Case
 *   - Map Atlas ticket fields → Salesforce Case fields
 *   - Sync case number back to Atlas ticket
 * - syncData: Bidirectional contact + case sync
 *   - Import Salesforce Contacts as Atlas org members
 *   - Sync Atlas ticket status → Salesforce Case Status
 *   - Pull Salesforce case updates into Atlas as ticket comments
 *
 * Setup required in integrationConfigs.config:
 * {
 *   instanceUrl: string;     // e.g. https://myorg.my.salesforce.com
 *   clientId: string;        // Connected App consumer key
 *   clientSecret: string;    // Connected App consumer secret
 *   username: string;        // Salesforce username for JWT flow
 *   privateKey: string;      // PEM private key for JWT Bearer flow
 * }
 */

import type { IntegrationConfig, IntegrationResult, IntegrationProvider } from './types';

export const salesforceIntegration: IntegrationProvider = {
  async testConnection(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'Salesforce integration is not yet implemented' };
  },

  async sendNotification(_config: IntegrationConfig, _payload: unknown): Promise<IntegrationResult> {
    return { success: false, error: 'Salesforce integration is not yet implemented' };
  },

  async syncData(_config: IntegrationConfig): Promise<IntegrationResult> {
    return { success: false, error: 'Salesforce integration is not yet implemented' };
  },
};
