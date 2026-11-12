import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [vue()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  optimizeDeps: { entries: ['csp-admin-preview.html'] },
  build: {
    outDir: 'target/csp-admin-preview',
    rollupOptions: { input: fileURLToPath(new URL('./csp-admin-preview.html', import.meta.url)) }
  },
  server: { host: '127.0.0.1', port: 5197, strictPort: true }
});
