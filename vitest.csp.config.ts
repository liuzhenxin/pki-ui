import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/csp/unit/**/*.test.ts'],
    exclude: [
      'tests/csp/e2e/**',
      'tests/csp/a11y/**',
      'tests/csp/visual/**',
      'tests/csp/security/**',
      'tests/csp/contract/**',
      'remote-tests/**',
      'tests/**/*.spec.ts'
    ],
    passWithNoTests: false,
    maxWorkers: 2
  }
});
