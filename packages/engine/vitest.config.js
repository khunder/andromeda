import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.js'],
    // separate from setupFiles: runs once in the main process before/after
    // the whole run (not per test file), which is what SINGLE_TEST_DB's
    // end-of-run cleanup needs , see test/global-teardown.js.
    globalSetup: ['./test/global-teardown.js'],
    pool: 'forks',  // Use forks instead of threads for better ESM compatibility
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'src/**/*.vitest.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'test/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      'node_modules',
      'dist',
      'cypress',
      '.idea',
      '.git',
      '.cache',
      'designer/**',
      'deployments/**'
    ],
    coverage: {
      provider: 'c8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'coverage/**',
        'dist/**',
        '**/*.config.*',
        '**/test/**',
        '**/tests/**',
        '**/*.test.*',
        '**/*.spec.*',
        '**/node_modules/**',
        'designer/**',
        'deployments/**'
      ],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});
