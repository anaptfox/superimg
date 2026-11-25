import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 1,
    resolve: {
      conditions: ['import', 'module', 'browser', 'default'],
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/**/index.ts', 'src/__tests__/**'],
      reporter: ['text', 'lcov'],
      thresholds: {
        statements: 50,
        branches: 45,
      },
    },
  },
  resolve: {
    alias: {
      '@superimg/stdlib/media': resolve(__dirname, '../superimg-stdlib/src/media.ts'),
      '@superimg/stdlib/svg/woff': resolve(__dirname, '../superimg-stdlib/src/svg/woff.ts'),
    },
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
