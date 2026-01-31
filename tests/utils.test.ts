import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { formatErrorMessage } from '@/lib/utils/errors';

describe('Error Utilities', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('formatErrorMessage', () => {
    it('should return user-friendly message for unauthorized errors', () => {
      const error = new Error('Unauthorized access denied');
      const message = formatErrorMessage(error);
      expect(message).toBe('You do not have permission to perform this action.');
    });

    it('should return user-friendly message for not found errors', () => {
      const error = new Error('Resource not found');
      const message = formatErrorMessage(error);
      expect(message).toBe('The requested resource was not found.');
    });

    it('should return user-friendly message for validation errors', () => {
      const error = new Error('Invalid input validation failed');
      const message = formatErrorMessage(error);
      expect(message).toBe('Please check your input and try again.');
    });

    it('should return user-friendly message for rate limit errors', () => {
      const error = new Error('Rate limit exceeded');
      const message = formatErrorMessage(error);
      expect(message).toBe('Too many requests. Please wait a moment and try again.');
    });

    it('should return generic message for unknown errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Something went wrong');
      const message = formatErrorMessage(error);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return error message in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Something went wrong');
      const message = formatErrorMessage(error);
      expect(message).toBe('Something went wrong');
    });

    it('should handle errors without messages', () => {
      const error = new Error();
      const message = formatErrorMessage(error);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should handle non-Error objects', () => {
      const message = formatErrorMessage('string error');
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });
  });
});

