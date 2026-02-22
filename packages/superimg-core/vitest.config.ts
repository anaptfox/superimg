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
  },
  resolve: {
    conditions: ['import', 'module', 'browser', 'default'],
  },
});
