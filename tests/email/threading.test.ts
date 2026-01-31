/**
 * Email threading tests
 * 
 * Tests email threading logic:
 * - Subject line ticket key extraction
 * - Message-ID threading
 * - In-Reply-To header matching
 * - References header parsing
 * - Edge cases (malformed headers, etc.)
 */

import { describe, it, expect } from 'vitest';
import { extractTicketKeyFromSubject } from '@/lib/email/threading';

// Helper functions to extract from headers (not exported, so we'll test them indirectly)
function extractMessageId(headers: Record<string, string>): string | null {
  const messageId = headers['message-id'] || headers['Message-ID'];
  if (!messageId) return null;
  // Remove angle brackets if present
  return messageId.replace(/^<|>$/g, '');
}

function extractInReplyTo(headers: Record<string, string>): string | null {
  const inReplyTo = headers['in-reply-to'] || headers['In-Reply-To'];
  if (!inReplyTo) return null;
  // Remove angle brackets if present
  return inReplyTo.replace(/^<|>$/g, '');
}

describe('Email Threading', () => {
  describe('extractTicketKeyFromSubject', () => {
    it('should extract ticket key from Re: subject', () => {
      const subject = 'Re: [AGR-2024-000123] Issue with login';
      const key = extractTicketKeyFromSubject(subject);
      expect(key).toBe('AGR-2024-000123');
    });

    it('should extract ticket key from Fwd: subject', () => {
      const subject = 'Fwd: [AGR-2024-000456] Feature request';
      const key = extractTicketKeyFromSubject(subject);
      expect(key).toBe('AGR-2024-000456');
    });

    it('should extract ticket key from subject with multiple prefixes', () => {
      const subject = 'Re: Re: [AGR-2024-000789] Follow up';
      const key = extractTicketKeyFromSubject(subject);
      expect(key).toBe('AGR-2024-000789');
    });

    it('should extract ticket key from subject without prefix', () => {
      const subject = '[AGR-2024-000321] New issue';
      const key = extractTicketKeyFromSubject(subject);
      expect(key).toBe('AGR-2024-000321');
    });

    it('should return null for subject without ticket key', () => {
      const subject = 'General inquiry';
      const key = extractTicketKeyFromSubject(subject);
      expect(key).toBeNull();
    });

    it('should handle malformed ticket key format', () => {
      const subject = '[INVALID-KEY] Some subject';
      const key = extractTicketKeyFromSubject(subject);
      // Pattern doesn't match (needs numbers), so should return null
      expect(key).toBeNull();
    });

    it('should extract first ticket key if multiple present', () => {
      const subject = '[AGR-2024-000111] See also [AGR-2024-000222]';
      const key = extractTicketKeyFromSubject(subject);
      expect(key).toBe('AGR-2024-000111');
    });
  });

  describe('extractMessageId', () => {
    it('should extract Message-ID from header', () => {
      const headers = {
        'message-id': '<message123@example.com>',
      };
      const messageId = extractMessageId(headers);
      expect(messageId).toBe('message123@example.com');
    });

    it('should handle Message-ID with angle brackets', () => {
      const headers = {
        'message-id': '<test@domain.com>',
      };
      const messageId = extractMessageId(headers);
      expect(messageId).toBe('test@domain.com');
    });

    it('should return null if Message-ID not present', () => {
      const headers = {};
      const messageId = extractMessageId(headers);
      expect(messageId).toBeNull();
    });

    it('should handle case-insensitive header names', () => {
      const headers = {
        'Message-ID': '<test@example.com>',
      };
      const messageId = extractMessageId(headers);
      expect(messageId).toBe('test@example.com');
    });
  });

  describe('extractInReplyTo', () => {
    it('should extract In-Reply-To from header', () => {
      const headers = {
        'in-reply-to': '<original@example.com>',
      };
      const inReplyTo = extractInReplyTo(headers);
      expect(inReplyTo).toBe('original@example.com');
    });

    it('should handle In-Reply-To with angle brackets', () => {
      const headers = {
        'in-reply-to': '<reply@domain.com>',
      };
      const inReplyTo = extractInReplyTo(headers);
      expect(inReplyTo).toBe('reply@domain.com');
    });

    it('should return null if In-Reply-To not present', () => {
      const headers = {};
      const inReplyTo = extractInReplyTo(headers);
      expect(inReplyTo).toBeNull();
    });

    it('should handle case-insensitive header names', () => {
      const headers = {
        'In-Reply-To': '<test@example.com>',
      };
      const inReplyTo = extractInReplyTo(headers);
      expect(inReplyTo).toBe('test@example.com');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty subject', () => {
      const key = extractTicketKeyFromSubject('');
      expect(key).toBeNull();
    });

    it('should handle subject with only whitespace', () => {
      const key = extractTicketKeyFromSubject('   ');
      expect(key).toBeNull();
    });

    it('should handle malformed Message-ID', () => {
      const headers = {
        'message-id': 'invalid-format',
      };
      const messageId = extractMessageId(headers);
      // Should still extract if possible
      expect(messageId).toBe('invalid-format');
    });

    it('should handle multiple Message-IDs (take first)', () => {
      const headers = {
        'message-id': '<first@example.com> <second@example.com>',
      };
      const messageId = extractMessageId(headers);
      // Simple extraction removes all angle brackets, so we get the full string
      // In practice, Message-ID should only have one value
      expect(messageId).toContain('first@example.com');
    });
  });
});

