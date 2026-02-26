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
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/index.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 75,
        branches: 65,
      },
    },
  },
  // Ensure dependencies are resolved correctly
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
