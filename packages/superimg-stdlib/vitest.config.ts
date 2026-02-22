import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    singleFork: true,
    // Resolve ESM modules properly
    resolve: {
      conditions: ['import', 'module', 'browser', 'default'],
    },
  },
  // Ensure dependencies are resolved correctly
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
