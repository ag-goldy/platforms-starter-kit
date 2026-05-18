import { describe, expect, it } from 'vitest';
import { redactPII } from '@/lib/ai/pii';

describe('AI PII redaction', () => {
  it('redacts common customer identifiers and reports counts', () => {
    const result = redactPII(
      'Contact jane@example.com at 415-555-1212 from 192.168.1.10. Card 4111 1111 1111 1111.'
    );

    expect(result.redacted).toContain('[REDACTED_EMAIL]');
    expect(result.redacted).toContain('[REDACTED_PHONE]');
    expect(result.redacted).toContain('[REDACTED_IP]');
    expect(result.redacted).toContain('[REDACTED_CARD]');
    expect(result.types).toEqual(expect.arrayContaining(['email', 'phone', 'ip_address', 'credit_card']));
    expect(result.counts.email).toBe(1);
  });

  it('does not mark ordinary ticket text as PII', () => {
    const result = redactPII('Switch port is down after scheduled maintenance.');

    expect(result.detected).toBe(false);
    expect(result.redacted).toBe('Switch port is down after scheduled maintenance.');
  });
});
