/**
 * Statuspage.io API Client
 *
 * Documentation: https://developer.statuspage.io/
 *
 * Features:
 * - Page management (status pages)
 * - Component management (services)
 * - Incident creation and updates
 * - Metrics submission
 * - Subscriber management
 */

const STATUSPAGE_API_BASE = "https://api.statuspage.io/v1";

export interface StatuspageConfig {
  apiKey: string;
  pageId?: string;
}

export interface StatuspagePage {
  id: string;
  name: string;
  url: string;
  time_zone: string;
  updated_at: string;
}

export interface StatuspageComponent {
  id: string;
  name: string;
  description: string | null;
  status:
    | "operational"
    | "degraded_performance"
    | "partial_outage"
    | "major_outage"
    | "under_maintenance";
  position: number;
  group_id: string | null;
  group: boolean;
  created_at: string;
  updated_at: string;
}

export interface StatuspageIncident {
  id: string;
  name: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  impact: "none" | "minor" | "major" | "critical";
  components: StatuspageComponent[];
  created_at: string;
  updated_at: string;
  started_at: string;
  resolved_at: string | null;
  shortlink: string;
  incident_updates: {
    id: string;
    status: string;
    body: string;
    created_at: string;
    updated_at: string;
  }[];
}

export interface CreateIncidentData {
  name: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  impact: "none" | "minor" | "major" | "critical";
  body: string;
  component_ids?: string[];
  components?: Record<
    string,
    "operational" | "degraded_performance" | "partial_outage" | "major_outage"
  >;
}

export interface UpdateIncidentData {
  status?: "investigating" | "identified" | "monitoring" | "resolved";
  body?: string;
  impact?: "none" | "minor" | "major" | "critical";
  component_ids?: string[];
  components?: Record<
    string,
    "operational" | "degraded_performance" | "partial_outage" | "major_outage"
  >;
}

export class StatuspageClient {
  private apiKey: string;
  private pageId: string | null;

  constructor(config: StatuspageConfig) {
    this.apiKey = config.apiKey;
    this.pageId = config.pageId || null;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${STATUSPAGE_API_BASE}${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `OAuth ${this.apiKey}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Statuspage API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  // ==================== Pages ====================

  /**
   * List all pages for the account
   */
  async listPages(): Promise<StatuspagePage[]> {
    return this.request<StatuspagePage[]>("/pages");
  }

  /**
   * Get a specific page
   */
  async getPage(pageId?: string): Promise<StatuspagePage> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");
    return this.request<StatuspagePage>(`/pages/${id}`);
  }

  // ==================== Components ====================

  /**
   * List all components for a page
   */
  async listComponents(pageId?: string): Promise<StatuspageComponent[]> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");
    return this.request<StatuspageComponent[]>(`/pages/${id}/components`);
  }

  /**
   * Get a specific component
   */
  async getComponent(
    componentId: string,
    pageId?: string,
  ): Promise<StatuspageComponent> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");
    return this.request<StatuspageComponent>(
      `/pages/${id}/components/${componentId}`,
    );
  }

  /**
   * Create a new component
   */
  async createComponent(
    data: {
      name: string;
      description?: string;
      status?: StatuspageComponent["status"];
      group_id?: string;
    },
    pageId?: string,
  ): Promise<StatuspageComponent> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    return this.request<StatuspageComponent>(`/pages/${id}/components`, {
      method: "POST",
      body: JSON.stringify({ component: data }),
    });
  }

  /**
   * Update a component
   */
  async updateComponent(
    componentId: string,
    data: Partial<StatuspageComponent>,
    pageId?: string,
  ): Promise<StatuspageComponent> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    return this.request<StatuspageComponent>(
      `/pages/${id}/components/${componentId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ component: data }),
      },
    );
  }

  /**
   * Delete a component
   */
  async deleteComponent(componentId: string, pageId?: string): Promise<void> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    await this.request<void>(`/pages/${id}/components/${componentId}`, {
      method: "DELETE",
    });
  }

  // ==================== Incidents ====================

  /**
   * List all incidents for a page
   */
  async listIncidents(
    options: { status?: string; limit?: number } = {},
    pageId?: string,
  ): Promise<StatuspageIncident[]> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    const params = new URLSearchParams();
    if (options.status) params.append("status", options.status);
    if (options.limit) params.append("limit", options.limit.toString());

    const query = params.toString() ? `?${params.toString()}` : "";
    return this.request<StatuspageIncident[]>(`/pages/${id}/incidents${query}`);
  }

  /**
   * Get a specific incident
   */
  async getIncident(
    incidentId: string,
    pageId?: string,
  ): Promise<StatuspageIncident> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");
    return this.request<StatuspageIncident>(
      `/pages/${id}/incidents/${incidentId}`,
    );
  }

  /**
   * Create a new incident
   */
  async createIncident(
    data: CreateIncidentData,
    pageId?: string,
  ): Promise<StatuspageIncident> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    return this.request<StatuspageIncident>(`/pages/${id}/incidents`, {
      method: "POST",
      body: JSON.stringify({ incident: data }),
    });
  }

  /**
   * Update an incident
   */
  async updateIncident(
    incidentId: string,
    data: UpdateIncidentData,
    pageId?: string,
  ): Promise<StatuspageIncident> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    return this.request<StatuspageIncident>(
      `/pages/${id}/incidents/${incidentId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ incident: data }),
      },
    );
  }

  /**
   * Delete an incident
   */
  async deleteIncident(incidentId: string, pageId?: string): Promise<void> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    await this.request<void>(`/pages/${id}/incidents/${incidentId}`, {
      method: "DELETE",
    });
  }

  // ==================== Metrics ====================

  /**
   * Submit metric data point
   */
  async submitMetric(
    metricId: string,
    data: { timestamp: number; value: number },
    pageId?: string,
  ): Promise<void> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    await this.request<void>(`/pages/${id}/metrics/${metricId}/data`, {
      method: "POST",
      body: JSON.stringify({ data }),
    });
  }

  // ==================== Subscribers ====================

  /**
   * List subscribers
   */
  async listSubscribers(pageId?: string): Promise<unknown[]> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");
    return this.request<unknown[]>(`/pages/${id}/subscribers`);
  }

  /**
   * Create a subscriber
   */
  async createSubscriber(
    data: { email: string; webhook_url?: string; endpoint?: string },
    pageId?: string,
  ): Promise<unknown> {
    const id = pageId || this.pageId;
    if (!id) throw new Error("Page ID required");

    return this.request<unknown>(`/pages/${id}/subscribers`, {
      method: "POST",
      body: JSON.stringify({ subscriber: data }),
    });
  }

  // ==================== Helpers ====================

  /**
   * Map Atlas service status to Statuspage component status
   */
  mapServiceStatus(atlasStatus: string): StatuspageComponent["status"] {
    const mapping: Record<string, StatuspageComponent["status"]> = {
      operational: "operational",
      degraded: "degraded_performance",
      partial_outage: "partial_outage",
      major_outage: "major_outage",
      maintenance: "under_maintenance",
    };
    return mapping[atlasStatus] || "operational";
  }

  /**
   * Map Atlas ticket priority to Statuspage incident impact
   */
  mapImpact(priority: string): CreateIncidentData["impact"] {
    const mapping: Record<string, CreateIncidentData["impact"]> = {
      P1: "critical",
      P2: "major",
      P3: "minor",
      P4: "none",
    };
    return mapping[priority] || "minor";
  }
}

// Factory function for creating client with org config
export async function createStatuspageClient(
  orgId: string,
): Promise<StatuspageClient | null> {
  const { db } = await import("@/db");
  const { statuspageConfigs } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  const config = await db.query.statuspageConfigs?.findFirst({
    where: eq(statuspageConfigs.orgId, orgId),
  });

  if (!config?.apiKey) {
    return null;
  }

  return new StatuspageClient({
    apiKey: config.apiKey,
    pageId: config.pageId || undefined,
  });
}
