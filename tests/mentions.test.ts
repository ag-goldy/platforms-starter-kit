import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseMentions, formatMentionsForDisplay } from '@/lib/mentions';

describe('Mentions System', () => {
  describe('parseMentions', () => {
    it('should parse single mention', () => {
      const text = 'Hello @[John Doe](user-123)';
      const mentions = parseMentions(text);
      expect(mentions).toEqual(['user-123']);
    });

    it('should parse multiple mentions', () => {
      const text = 'Hey @[John](user-1) and @[Jane](user-2), check this out';
      const mentions = parseMentions(text);
      expect(mentions).toEqual(['user-1', 'user-2']);
    });

    it('should return empty array for no mentions', () => {
      const text = 'Hello everyone, no mentions here';
      const mentions = parseMentions(text);
      expect(mentions).toEqual([]);
    });

    it('should handle mentions with special characters in name', () => {
      const text = 'Hello @[John O\'Connor](user-123)';
      const mentions = parseMentions(text);
      expect(mentions).toEqual(['user-123']);
    });

    it('should handle empty text', () => {
      const mentions = parseMentions('');
      expect(mentions).toEqual([]);
    });

    it('should not parse incomplete mentions', () => {
      const text = 'Hello @[John Doe](user-123 and more text';
      const mentions = parseMentions(text);
      expect(mentions).toEqual([]);
    });
  });

  describe('formatMentionsForDisplay', () => {
    it('should format single mention for display', () => {
      const text = 'Hello @[John Doe](user-123)';
      const formatted = formatMentionsForDisplay(text);
      expect(formatted).toBe('Hello @John Doe');
    });

    it('should format multiple mentions for display', () => {
      const text = 'Hey @[John](user-1) and @[Jane Smith](user-2)!';
      const formatted = formatMentionsForDisplay(text);
      expect(formatted).toBe('Hey @John and @Jane Smith!');
    });

    it('should return original text when no mentions', () => {
      const text = 'Hello everyone';
      const formatted = formatMentionsForDisplay(text);
      expect(formatted).toBe('Hello everyone');
    });

    it('should handle mixed content', () => {
      const text = 'Hello @[John](user-1), please review with @[Jane](user-2). Thanks!';
      const formatted = formatMentionsForDisplay(text);
      expect(formatted).toBe('Hello @John, please review with @Jane. Thanks!');
    });
  });
});
