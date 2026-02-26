import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    singleFork: true,
    resolve: {
      conditions: ['import', 'module', 'browser', 'default'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/index.ts', 'src/**/__test-utils__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 50,
        branches: 45,
      },
    },
  },
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
