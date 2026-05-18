/**
 * Shared types for all Atlas integration providers.
 */

export interface IntegrationResult {
  success: boolean;
  error?: string;
}

export interface IntegrationConfig {
  /** Raw config JSON stored in integrationConfigs.config column */
  [key: string]: unknown;
}

export interface IntegrationProvider {
  /** Test whether the stored credentials can reach the external service */
  testConnection(config: IntegrationConfig): Promise<IntegrationResult>;

  /** Send a notification (e.g., ticket created, status change) to the external service */
  sendNotification(
    config: IntegrationConfig,
    payload: unknown,
  ): Promise<IntegrationResult>;

  /** Sync data bidirectionally between Atlas and the external service */
  syncData(config: IntegrationConfig): Promise<IntegrationResult>;
}
