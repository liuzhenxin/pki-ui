import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), AutoImport({ imports: ['vue'], dts: false })],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  test: {
    include: ['tests/ops/*.test.ts'],
    env: { VITE_APP_BASE_API: '/api-gateway' }
  }
});
