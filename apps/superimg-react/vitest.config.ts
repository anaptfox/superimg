import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.d.ts'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 0,
        branches: 0,
      },
    },
  },
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
