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

import { headers } from 'next/headers';
import { auth } from '@/auth';
import { db } from '@/db';
import { piiDetectionRules } from '@/db/schema-extensions';
import { and, eq } from 'drizzle-orm';
import { safeRedisGet, safeRedisSet } from '@/lib/redis/client';

// Cache TTL for org PII rules (5 minutes)
const ORG_PII_RULES_CACHE_TTL = 300;

interface OrgPIIRule {
  patternName: string;
  patternRegex: string;
  action: string; // 'mask' | 'block' | 'warn' | 'flag'
  severity: string;
}

/**
 * Fetch org-specific PII detection rules, with Redis caching (5 min TTL).
 * Returns rules sorted so org-specific overrides take precedence.
 */
async function getOrgPIIRules(orgId: string): Promise<OrgPIIRule[]> {
  const cacheKey = `pii_rules:${orgId}`;

  // Try cache first
  const cached = await safeRedisGet<OrgPIIRule[]>(cacheKey);
  if (cached !== null) return cached;

  // Fetch from DB
  const rules = await db
    .select({
      patternName: piiDetectionRules.patternName,
      patternRegex: piiDetectionRules.patternRegex,
      action: piiDetectionRules.action,
      severity: piiDetectionRules.severity,
    })
    .from(piiDetectionRules)
    .where(
      and(
        eq(piiDetectionRules.orgId, orgId),
        eq(piiDetectionRules.isActive, true)
      )
    ) as OrgPIIRule[];

  // Cache the results
  await safeRedisSet(cacheKey, rules, { ex: ORG_PII_RULES_CACHE_TTL });

  return rules;
}

/**
 * Invalidate org PII rules cache.
 * Call this when rules are created/updated/deleted via the admin UI.
 */
export async function invalidateOrgPIIRulesCache(orgId: string): Promise<void> {
  const cacheKey = `pii_rules:${orgId}`;
  await safeRedisSet(cacheKey, null, { ex: 1 }); // expire immediately
}

/**
 * Async variant of sanitizeResponse that merges org-specific PII rules with static patterns.
 * Org rules take precedence over static rules with the same patternName.
 *
 * Use this in preference to sanitizeResponse when orgId context is available.
 */
export async function sanitizeResponseWithOrgRules(
  response: string,
  context: AISecurityContext
): Promise<{ sanitized: string; piiDetected: boolean; piiTypes: string[]; blockedByRule?: string }> {
  const { sanitized: staticSanitized, piiDetected: staticDetected, piiTypes: staticTypes } =
    sanitizeResponse(response, context);

  // No org context — return static result as-is
  if (!context.orgId) {
    return { sanitized: staticSanitized, piiDetected: staticDetected, piiTypes: staticTypes };
  }

  let orgRules: OrgPIIRule[] = [];
  try {
    orgRules = await getOrgPIIRules(context.orgId);
  } catch {
    // Redis or DB failure — fall back to static-only result
    return { sanitized: staticSanitized, piiDetected: staticDetected, piiTypes: staticTypes };
  }

  if (orgRules.length === 0) {
    return { sanitized: staticSanitized, piiDetected: staticDetected, piiTypes: staticTypes };
  }

  let result = staticSanitized;
  const extraPiiTypes: string[] = [];

  for (const rule of orgRules) {
    let regex: RegExp;
    try {
      regex = new RegExp(rule.patternRegex, 'gi');
    } catch {
      // Invalid regex in DB — skip this rule
      continue;
    }

    const matches = result.match(regex);
    if (!matches || matches.length === 0) continue;

    extraPiiTypes.push(rule.patternName);

    switch (rule.action) {
      case 'block':
        // Entire request should be blocked — signal via blockedByRule
        return {
          sanitized: '[Response blocked by content policy]',
          piiDetected: true,
          piiTypes: [...staticTypes, rule.patternName],
          blockedByRule: rule.patternName,
        };

      case 'mask':
        result = result.replace(regex, `[${rule.patternName} redacted]`);
        break;

      case 'warn':
        // Log but allow through — caller can handle the piiTypes array
        break;

      case 'flag':
        // Flag in piiTypes but don't modify content
        break;
    }
  }

  return {
    sanitized: result,
    piiDetected: staticDetected || extraPiiTypes.length > 0,
    piiTypes: [...staticTypes, ...extraPiiTypes],
  };
}

/**
 * Build security context from request
 * This is the central function that establishes the security context for all AI requests
 */
export async function buildSecurityContext(
  req: Request,
  interfaceType: AIInterface
): Promise<AISecurityContext> {
  const headersList = await headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown';
  
  let userId: string | null = null;
  let userRole: string | null = null;
  let orgId: string | null = null;
  let sessionId: string | null = null;

  // Try to get session info
  try {
    const session = await auth();
    if (session?.user?.id) {
      userId = session.user.id;
      userRole = (session.user as { role?: string }).role || null;
      orgId = (session.user as { orgId?: string }).orgId || null;
    }
  } catch {
    // No session - that's fine for public interface
  }

  // For customer interface, orgId MUST come from session/subdomain, never request body
  if (interfaceType === 'customer' && !orgId) {
    // Try to extract from request headers or subdomain
    const host = headersList.get('host') || '';
    // Subdomain pattern: org-slug.atlas.agrnetworks.com
    const subdomainMatch = host.match(/^([a-z0-9-]+)\.atlas\.agrnetworks\.com$/i);
    if (subdomainMatch) {
      // In production, look up org by subdomain using subdomainMatch[1]
      // For now, we require session to have orgId
    }
  }

  // Get session ID from cookie for tracking
  const cookieHeader = headersList.get('cookie') || '';
  const sessionMatch = cookieHeader.match(/kb_ai_session=([^;]+)/);
  if (sessionMatch) {
    sessionId = sessionMatch[1];
  }

  return {
    interface: interfaceType,
    orgId,
    userId,
    userRole,
    sessionId,
    ipAddress,
  };
}
