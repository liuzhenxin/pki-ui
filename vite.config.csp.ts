import { defineConfig, mergeConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { assertCspProduct } from './src/config/csp';
import platformConfig from './vite.config';
import { verifyCspBrand } from './vite/csp-brand';
assertCspProduct(process.env.VITE_APP_PRODUCT, process.env.VITE_APP_TENANT_IDS);
verifyCspBrand();
export default defineConfig(async (env) =>
  mergeConfig(await platformConfig(env), {
    publicDir: false,
    plugins: [
      {
        name: 'csp-product-html',
        buildStart() {
          this.emitFile({
            type: 'asset',
            fileName: 'csp-mark.svg',
            source: readFileSync(new URL('./src/assets/brand/csp-mark.svg', import.meta.url))
          });
        },
        transformIndexHtml(html) {
          return html
            .replace('<html>', '<html lang="zh-CN">')
            .replace(/<link rel="icon"[^>]*>/, '<link rel="icon" type="image/svg+xml" href="/csp-mark.svg" />')
            .replace(/<title>.*?<\/title>/, '<title>密码服务平台 · CSP</title>')
            .replace(/, maximum-scale=1, user-scalable=no/, '');
        }
      } satisfies Plugin
    ],
    define: { 'import.meta.env.VITE_APP_PRODUCT': JSON.stringify('csp'), 'import.meta.env.VITE_APP_TENANT_IDS': JSON.stringify('10') },
    build: { outDir: 'dist-csp', emptyOutDir: true, sourcemap: false, manifest: true },
    server: { host: '127.0.0.1', port: 5185, strictPort: true, open: false }
  })
);
