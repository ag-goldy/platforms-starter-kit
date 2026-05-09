import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/context', () => ({
  getRequestContext: vi.fn(),
}));

import { AuthorizationError } from '@/lib/auth/permissions';

// We test the role-check logic directly since getRequestContext is hard to mock end-to-end.
// Extract the role check into a pure helper so it can be unit tested.
describe('checkInternalRole', () => {
  it('allows ADMIN when ADMIN is required', () => {
    expect(() => checkInternalRole('ADMIN', ['ADMIN'])).not.toThrow();
  });

  it('allows AGENT when AGENT is in allowedRoles', () => {
    expect(() => checkInternalRole('AGENT', ['AGENT', 'ADMIN'])).not.toThrow();
  });

  it('throws when role is not in allowedRoles', () => {
    expect(() => checkInternalRole('AGENT', ['ADMIN'])).toThrow(AuthorizationError);
  });

  it('allows any role when allowedRoles is empty', () => {
    expect(() => checkInternalRole('READONLY', [])).not.toThrow();
  });

  it('allows any role when allowedRoles is undefined', () => {
    expect(() => checkInternalRole('AGENT', undefined)).not.toThrow();
  });

  it('throws for customer roles even if somehow passed', () => {
    expect(() => checkInternalRole('REQUESTER', ['ADMIN', 'AGENT'])).toThrow(AuthorizationError);
  });
});

// Import the helper after writing it in step 3
import { checkInternalRole } from '@/lib/auth/permissions';
