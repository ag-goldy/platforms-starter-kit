/**
 * Tenant-scoped query helper
 * 
 * Enforces orgId requirement at the type level to prevent data leaks.
 * All queries that access tenant data must use this helper.
 */

export class OrgScopeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrgScopeError';
  }
}

/**
 * Wraps a query function to ensure orgId is provided and valid
 * 
 * @param orgId - The organization ID (required, non-empty string)
 * @param queryFn - The query function that will receive the orgId
 * @returns The result of the query function
 * @throws OrgScopeError if orgId is missing or invalid
 */
export async function withOrgScope<T>(
  orgId: string,
  queryFn: (orgId: string) => Promise<T>
): Promise<T> {
  if (!orgId || typeof orgId !== 'string' || orgId.trim() === '') {
    throw new OrgScopeError('orgId is required for tenant-scoped queries and must be a non-empty string');
  }

  return queryFn(orgId);
}

/**
 * Type guard to ensure a value is a valid UUID string
 */
function isValidUUID(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

/**
 * Validates that orgId is a valid UUID format
 * 
 * @param orgId - The organization ID to validate
 * @throws OrgScopeError if orgId is not a valid UUID
 */
export function validateOrgId(orgId: string): void {
  if (!isValidUUID(orgId)) {
    throw new OrgScopeError(`Invalid orgId format: ${orgId}. Must be a valid UUID.`);
  }
}

/**
 * Wraps a query function with orgId validation
 * 
 * @param orgId - The organization ID (must be valid UUID)
 * @param queryFn - The query function that will receive the orgId
 * @returns The result of the query function
 * @throws OrgScopeError if orgId is missing, invalid, or not a UUID
 */
export async function withValidatedOrgScope<T>(
  orgId: string,
  queryFn: (orgId: string) => Promise<T>
): Promise<T> {
  validateOrgId(orgId);
  return withOrgScope(orgId, queryFn);
}

