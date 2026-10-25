import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/global-setup.js'],
    setupFiles: ['./tests/setup.js'],
    fileParallelism: false,
    hookTimeout: 120_000
  }
});
