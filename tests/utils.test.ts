import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatErrorMessage } from '@/lib/utils/errors';

describe('Error Utilities', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'production');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
      vi.stubEnv('NODE_ENV', 'production');
      const error = new Error('Something went wrong');
      const message = formatErrorMessage(error);
      expect(message).toBe('An unexpected error occurred. Please try again.');
    });

    it('should return error message in development', () => {
      vi.stubEnv('NODE_ENV', 'development');
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

describe('URL Helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function importUtils() {
    const mod = await import('@/lib/utils');
    return mod;
  }

  it('trims trailing whitespace from APP_BASE_URL', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://app.example.com  ');
    vi.stubEnv('SUPPORT_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'example.com');
    vi.stubEnv('NODE_ENV', 'production');
    const { appBaseUrl } = await importUtils();
    expect(appBaseUrl).toBe('https://app.example.com');
  });

  it('trims trailing newlines from SUPPORT_BASE_URL', async () => {
    vi.stubEnv('APP_BASE_URL', '');
    vi.stubEnv('SUPPORT_BASE_URL', 'https://support.example.com\n');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'example.com');
    vi.stubEnv('NODE_ENV', 'production');
    const { supportBaseUrl } = await importUtils();
    expect(supportBaseUrl).toBe('https://support.example.com');
  });

  it('preserves trailing slashes (current behavior)', async () => {
    vi.stubEnv('APP_BASE_URL', 'https://app.example.com/');
    vi.stubEnv('SUPPORT_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'example.com');
    vi.stubEnv('NODE_ENV', 'production');
    const { appBaseUrl } = await importUtils();
    expect(appBaseUrl).toBe('https://app.example.com/');
  });

  it('preserves http:// prefix when set in env', async () => {
    vi.stubEnv('APP_BASE_URL', 'http://localhost:3000');
    vi.stubEnv('SUPPORT_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'localhost:3000');
    vi.stubEnv('NODE_ENV', 'development');
    const { appBaseUrl, supportBaseUrl } = await importUtils();
    expect(appBaseUrl).toBe('http://localhost:3000');
    expect(supportBaseUrl).toBe('http://localhost:3000');
  });

  it('uses https:// fallback in production when env is missing', async () => {
    vi.stubEnv('APP_BASE_URL', '');
    vi.stubEnv('SUPPORT_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'example.com');
    vi.stubEnv('NODE_ENV', 'production');
    const { appBaseUrl, supportBaseUrl } = await importUtils();
    expect(appBaseUrl).toBe('https://example.com');
    expect(supportBaseUrl).toBe('https://example.com');
  });

  it('uses http:// fallback in development when env is missing', async () => {
    vi.stubEnv('APP_BASE_URL', '');
    vi.stubEnv('SUPPORT_BASE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_ROOT_DOMAIN', 'localhost:3000');
    vi.stubEnv('NODE_ENV', 'development');
    const { appBaseUrl, supportBaseUrl } = await importUtils();
    expect(appBaseUrl).toBe('http://localhost:3000');
    expect(supportBaseUrl).toBe('http://localhost:3000');
  });
});
