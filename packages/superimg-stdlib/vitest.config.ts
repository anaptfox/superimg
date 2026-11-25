import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 1,
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
        // Package floor. New product files below must stay at 90% statements.
        statements: 75,
        branches: 65,
        "src/tree/primitives.ts": { statements: 90 },
        "src/tree/h.ts": { statements: 90 },
        "src/director/create-director.ts": { statements: 80 },
      },
    },
  },
  // Ensure dependencies are resolved correctly
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
