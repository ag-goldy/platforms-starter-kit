import { defineConfig } from 'vitest/config';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local for tests
dotenv.config({ path: '.env.local' });

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**/*.test.ts'], // Exclude e2e tests from vitest (use playwright)
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    setupFiles: ['tests/setup.ts'],
    fileParallelism: false,
  },
});
