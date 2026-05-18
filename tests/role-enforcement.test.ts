/**
 * Role enforcement tests
 *
 * Ensures that requireInternalRole, requireInternalAdmin, and requireOrgMemberRole
 * correctly enforce role boundaries and that platform admins always pass internal checks.
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import {
  requireInternalRole,
  requireInternalAdmin,
  requireOrgMemberRole,
  AuthorizationError,
} from '@/lib/auth/permissions';
import { getRequestContext, type RequestContext } from '@/lib/auth/context';

vi.mock('@/lib/auth/context', () => ({
  getRequestContext: vi.fn(),
}));

// Use vi.hoisted so mock references are available before vi.mock factory runs
const { mockDbWhere, mockFindFirst } = vi.hoisted(() => ({
  mockDbWhere: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
  mockFindFirst: vi.fn().mockResolvedValue(null),
}));

// Stub db for:
//   - internalGroupMemberships queries (requireInternalRole allowedRoles check)
//   - memberships.findFirst (requireOrgMemberRole fallback)
vi.mock('@/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        innerJoin: vi.fn().mockReturnValue({
          where: mockDbWhere,
        }),
      }),
    }),
    query: {
      memberships: { findFirst: mockFindFirst },
    },
  },
}));

const mockGetRequestContext = getRequestContext as unknown as MockedFunction<
  typeof getRequestContext
>;

function makeContext(overrides: Partial<RequestContext> = {}): RequestContext {
  return {
    user: null,
    platformAdmin: null,
    isInternal: false,
    isPlatformAdmin: false,
    org: null,
    orgId: null,
    membership: null,
    subdomain: null,
    ip: '127.0.0.1',
    ...overrides,
  } as RequestContext;
}

describe('requireInternalRole', () => {
  it('throws when unauthenticated (redirects to login)', async () => {
    // requireInternalRole calls redirect() when there's no session — Next.js redirect
    // throws a special NEXT_REDIRECT error, not AuthorizationError
    mockGetRequestContext.mockResolvedValueOnce(makeContext());
    await expect(requireInternalRole()).rejects.toThrow();
  });

  it('throws for external (customer) users', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({ user: { id: 'u1', isInternal: false } as any })
    );
    await expect(requireInternalRole()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('allows internal users with no role restriction', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: 'u1', isInternal: true, internalRole: 'AGENT' } as any,
        isInternal: true,
      })
    );
    await expect(requireInternalRole()).resolves.toBeDefined();
  });

  it('allows internal users that have ADMIN group membership', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: 'u1', isInternal: true, role: 'ADMIN' } as any,
        isInternal: true,
      })
    );
    await expect(requireInternalRole(['ADMIN'])).resolves.toBeDefined();
  });

  it('throws for internal users with no group memberships when ADMIN is required', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: 'u1', isInternal: true, role: 'AGENT' } as any,
        isInternal: true,
      })
    );
    await expect(requireInternalRole(['ADMIN'])).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('allows platform admins regardless of role restriction', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        platformAdmin: { id: 'pa1' } as any,
        isInternal: true,
        isPlatformAdmin: true,
      })
    );
    // Even with a restrictive role list, platform admins should pass
    await expect(requireInternalRole(['ADMIN'])).resolves.toBeDefined();
  });
});

describe('requireInternalAdmin', () => {
  it('throws when unauthenticated (redirects to login)', async () => {
    mockGetRequestContext.mockResolvedValueOnce(makeContext());
    await expect(requireInternalAdmin()).rejects.toThrow();
  });

  it('throws for non-internal users', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({ user: { id: 'u1', isInternal: false } as any })
    );
    await expect(requireInternalAdmin()).rejects.toBeInstanceOf(AuthorizationError);
  });

  it('allows platform admins', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        platformAdmin: { id: 'pa1', email: 'admin@example.com', name: 'Admin' } as any,
        isInternal: true,
        isPlatformAdmin: true,
      })
    );
    await expect(requireInternalAdmin()).resolves.toBeDefined();
  });
});

describe('requireOrgMemberRole', () => {
  it('throws when user has no membership', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: 'u1', isInternal: false } as any,
        orgId: 'org1',
        membership: null,
      })
    );
    await expect(requireOrgMemberRole('org1', ['ADMIN'])).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it('throws when membership role is insufficient', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: 'u1', isInternal: false } as any,
        orgId: 'org1',
        membership: { userId: 'u1', orgId: 'org1', role: 'VIEWER', isActive: true } as any,
      })
    );
    await expect(requireOrgMemberRole('org1', ['ADMIN', 'AGENT'])).rejects.toBeInstanceOf(
      AuthorizationError
    );
  });

  it('allows members with sufficient role', async () => {
    mockGetRequestContext.mockResolvedValueOnce(
      makeContext({
        user: { id: 'u1', isInternal: false } as any,
        orgId: 'org1',
        membership: { userId: 'u1', orgId: 'org1', role: 'AGENT', isActive: true } as any,
      })
    );
    await expect(requireOrgMemberRole('org1', ['ADMIN', 'AGENT'])).resolves.toBeDefined();
  });
});
