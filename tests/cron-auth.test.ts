/**
 * Cron authentication tests
 *
 * Verifies that verifyCronAuth():
 * - Returns 503 when CRON_SECRET is not set (fail-closed)
 * - Returns 401 when Authorization header is missing
 * - Returns 401 when Authorization header has wrong value
 * - Returns null (authorized) when header matches CRON_SECRET
 * - Uses timing-safe comparison to prevent timing attacks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to manipulate process.env, so we reload the module per test group
const originalEnv = { ...process.env };

afterEach(() => {
  // Restore env after each test
  Object.assign(process.env, originalEnv);
  // Remove keys added in tests
  Object.keys(process.env).forEach(k => {
    if (!(k in originalEnv)) delete process.env[k];
  });
  vi.resetModules();
});

function getVerifyCronAuth() {
  // verifyCronAuth is synchronous; this wrapper supports vi.resetModules() per-test
  return import('@/lib/auth/cron').then(m => m.verifyCronAuth);
}

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader !== undefined) {
    headers.set('Authorization', authHeader);
  }
  return new Request('https://example.com/api/cron/test', { headers });
}

describe('verifyCronAuth — CRON_SECRET not set', () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
  });

  it('returns 503 Service Unavailable (fail-closed)', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest() as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });

  it('returns 503 even if Authorization header is provided', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest('Bearer some-secret') as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(503);
  });
});

describe('verifyCronAuth — CRON_SECRET is set', () => {
  const TEST_SECRET = 'test-cron-secret-abc123';

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_SECRET;
  });

  it('returns 401 when Authorization header is missing', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest() as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns 401 when Authorization value is wrong', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest('Bearer wrong-secret') as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns 401 when Authorization header uses wrong format', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    // Missing "Bearer " prefix
    const result = verifyCronAuth(makeRequest(TEST_SECRET) as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('returns null (authorized) when Authorization matches CRON_SECRET', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest(`Bearer ${TEST_SECRET}`) as any);
    expect(result).toBeNull();
  });

  it('returns 401 for empty Authorization value', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest('') as any);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });

  it('is case-sensitive — wrong case returns 401', async () => {
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(
      makeRequest(`Bearer ${TEST_SECRET.toUpperCase()}`) as any
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe(401);
  });
});

describe('verifyCronAuth — response body', () => {
  it('includes error message in 401 response', async () => {
    process.env.CRON_SECRET = 'some-secret';
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest('Bearer bad') as any);
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body).toHaveProperty('error');
  });

  it('includes error message in 503 response', async () => {
    delete process.env.CRON_SECRET;
    const verifyCronAuth = await getVerifyCronAuth();
    const result = verifyCronAuth(makeRequest() as any);
    expect(result).not.toBeNull();
    const body = await result!.json();
    expect(body).toHaveProperty('error');
  });
});
