import { describe, expect, it } from 'vitest';
import { bearerTokenMatches, constantTimeEquals } from '@/lib/security/secrets';

describe('security secret helpers', () => {
  it('compares equal strings successfully', () => {
    expect(constantTimeEquals('secret', 'secret')).toBe(true);
  });

  it('rejects different, empty, and missing values', () => {
    expect(constantTimeEquals('secret', 'other')).toBe(false);
    expect(constantTimeEquals('', 'secret')).toBe(false);
    expect(constantTimeEquals(null, 'secret')).toBe(false);
  });

  it('validates bearer tokens without direct string comparison at call sites', () => {
    expect(bearerTokenMatches('Bearer token-123', 'token-123')).toBe(true);
    expect(bearerTokenMatches('Bearer wrong', 'token-123')).toBe(false);
    expect(bearerTokenMatches(null, 'token-123')).toBe(false);
  });
});
