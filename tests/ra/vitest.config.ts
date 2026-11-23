import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), AutoImport({ imports: ['vue', 'vue-router', '@vueuse/core'] })],
  resolve: { alias: { '@': fileURLToPath(new URL('../../src', import.meta.url)) } },
  test: { include: ['tests/ra/*.test.ts'], environment: 'node' }
});
