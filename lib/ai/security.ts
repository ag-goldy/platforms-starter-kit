/**
 * AI Security Layer - Core security for Zeus AI
 * 
 * Enforces tenant isolation, data access control, and PII sanitization
 * across all three AI interfaces: public, customer, admin
 */

export type AIInterface = 'public' | 'customer' | 'admin';

export interface AISecurityContext {
  interface: AIInterface;
  orgId: string | null;         // null for public
  userId: string | null;        // null for anonymous
  userRole: string | null;      // ADMIN, AGENT, CUSTOMER_ADMIN, REQUESTER, VIEWER
  sessionId: string | null;
  ipAddress: string;
}

// DATA ACCESS MATRIX — what each interface can access
// This is the single source of truth for AI data permissions
const DATA_ACCESS_MATRIX = {
  public: {
    kbArticles: 'public_only',      // Only articles marked as public visibility
    tickets: 'none',                 // NEVER
    users: 'none',                   // NEVER
    organizations: 'none',           // NEVER
    assets: 'none',                  // NEVER
    services: 'none',                // NEVER
    auditLogs: 'none',              // NEVER
    internalNotes: 'none',          // NEVER
    attachments: 'none',            // NEVER
    automationRules: 'none',        // NEVER
    slaData: 'none',                // NEVER
  },
  customer: {
    kbArticles: 'org_scoped',       // Only this org's published articles
    tickets: 'org_scoped_limited',  // Only this org's tickets, summaries only, no internal notes
    users: 'none',                   // NEVER — don't reveal other users
    organizations: 'own_only',       // Only basic info about their own org
    assets: 'org_scoped',           // If allowed in org config
    services: 'org_scoped',         // If allowed in org config
    auditLogs: 'none',              // NEVER
    internalNotes: 'none',          // NEVER — this is critical
    attachments: 'none',            // NEVER through AI
    automationRules: 'none',        // NEVER
    slaData: 'none',                // NEVER
  },
  admin: {
    kbArticles: 'all',              // All articles across visibility levels
    tickets: 'all',                  // Full ticket data including internal notes
    users: 'all',                    // User data (but PII filtered in responses)
    organizations: 'all',            // Full org data
    assets: 'all',                   // Full asset data
    services: 'all',                 // Full service data
    auditLogs: 'read_only',         // Can query but AI cannot modify
    internalNotes: 'all',           // Full access
    attachments: 'metadata_only',   // File names and types, not content
    automationRules: 'read_only',   // Can explain rules, cannot modify
    slaData: 'all',                 // Full SLA data
  },
} as const;

type DataType = keyof typeof DATA_ACCESS_MATRIX['public'];

/**
 * Validate that an AI request is allowed to access specific data
 */
export function validateDataAccess(
  context: AISecurityContext,
  dataType: DataType,
  targetOrgId?: string
): { allowed: boolean; scope: string; reason?: string } {
  const access = DATA_ACCESS_MATRIX[context.interface][dataType];
  
  if (access === 'none') {
    return { allowed: false, scope: 'none', reason: `${dataType} access denied for ${context.interface} interface` };
  }
  
  // For customer interface, enforce org isolation
  if (context.interface === 'customer') {
    if (!context.orgId) {
      return { allowed: false, scope: 'none', reason: 'No org context for customer request' };
    }
    if (targetOrgId && targetOrgId !== context.orgId) {
      return { allowed: false, scope: 'none', reason: 'Cross-tenant access denied' };
    }
  }
  
  return { allowed: true, scope: access };
}

/**
 * Sanitize AI response before returning to user
 */
export function sanitizeResponse(
  response: string,
  context: AISecurityContext
): { sanitized: string; piiDetected: boolean; piiTypes: string[] } {
  const piiTypes: string[] = [];
  let sanitized = response;
  
  // Always strip these patterns regardless of interface
  const piiPatterns = [
    { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, type: 'email', replacement: '[email redacted]' },
    { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone', replacement: '[phone redacted]' },
    { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'ssn', replacement: '[SSN redacted]' },
    { pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g, type: 'credit_card', replacement: '[card redacted]' },
    { pattern: /\b[A-Z]\d{7}[A-Z]\b/gi, type: 'nric', replacement: '[NRIC redacted]' },
    { pattern: /\bpassword\s*[:=]\s*\S+/gi, type: 'password', replacement: '[password redacted]' },
    { pattern: /\b(?:api[_-]?key|secret[_-]?key|access[_-]?token)\s*[:=]\s*\S+/gi, type: 'api_key', replacement: '[credential redacted]' },
  ];
  
  // For public interface: strip ALL potentially identifying information
  if (context.interface === 'public') {
    piiPatterns.push(
      { pattern: /\b(?:Mr|Mrs|Ms|Dr)\.?\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, type: 'name', replacement: '[name redacted]' },
    );
  }
  
  // For customer interface: strip PII of OTHER organizations and internal users
  if (context.interface === 'customer') {
    piiPatterns.push(
      { pattern: /\b(?:agent|admin|internal)\s+\S+@\S+\b/gi, type: 'internal_email', replacement: '[staff]' },
    );
  }
  
  for (const { pattern, type, replacement } of piiPatterns) {
    const matches = sanitized.match(pattern);
    if (matches && matches.length > 0) {
      piiTypes.push(type);
      sanitized = sanitized.replace(pattern, replacement);
    }
  }
  
  return { sanitized, piiDetected: piiTypes.length > 0, piiTypes };
}

/**
 * Anonymize internal user names for customer-facing responses
 */
export function anonymizeInternalUser(content: string): string {
  // Replace patterns like "agent john" or "admin@srv.com" with generic terms
  return content
    .replace(/\b(agent|admin|staff|support engineer)\s+\S+@\S+/gi, 'support team')
    .replace(/\b(agent|admin|staff|support engineer)\s+[A-Z][a-z]+/gi, 'support team')
    .replace(/\b[A-Z][a-z]+\s+\(Agent\)/gi, 'support team')
    .replace(/\b[A-Z][a-z]+\s+\(Admin\)/gi, 'admin team');
}

/**
 * Strip internal notes from content
 */
export function stripInternalNotes(content: string): string {
  // Remove sections marked as internal or containing internal markers
  return content
    .replace(/\[Internal\].*?(?=\[|$)/gis, '')
    .replace(/\[INTERNAL\].*?(?=\[|$)/gis, '')
    .replace(/\(internal note\).*?(?=\(|$)/gis, '');
}
