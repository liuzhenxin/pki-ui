import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const approvedBrand = {
  'csp-logo.svg': '33aa424eff4b0534142def63f4d80e9941d51730e673fc1e4da4fa975faff95a',
  'csp-mark-inverse.svg': '86bbc29c3fd6bee82614f99ef3c712d34da3a5a4c8c40133cd25a95ed21b79b4'
};
for (const [name, digest] of Object.entries(approvedBrand)) {
  const bytes = readFileSync(new URL('../src/assets/brand/' + name, import.meta.url));
  if (createHash('sha256').update(bytes).digest('hex') !== digest) throw new Error('CSP_BRAND_NOT_APPROVED');
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [vue()],
  build: { outDir: '../dist-csp-console', emptyOutDir: true, sourcemap: false },
  server: { host: '127.0.0.1', port: 5185 }
});
