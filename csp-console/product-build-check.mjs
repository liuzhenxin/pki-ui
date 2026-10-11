import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../dist-csp/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
assert.match(html, /<html lang="zh-CN">/);
assert.match(html, /<title>密码服务平台 · CSP<\/title>/);
assert.match(html, /href="\/csp-mark.svg"/);
assert.doesNotMatch(html, /maximum-scale|user-scalable=no|VITE_APP_TITLE/);
assert.equal(
  createHash('sha256')
    .update(await readFile(new URL('csp-mark.svg', root)))
    .digest('hex'),
  '777b6b50d91930e1bff2dca625ed92acf9a798eddc62a2bdf021206bb574d76d'
);
const manifest = JSON.parse(await readFile(new URL('.vite/manifest.json', root), 'utf8'));
assert.ok(manifest['index.html']?.isEntry);
assert.equal(manifest['index.html'].dynamicImports.length, 1);
const bootstrap = manifest[manifest['index.html'].dynamicImports[0]];
assert.equal(bootstrap.name, 'bootstrap');
assert.equal(bootstrap.isDynamicEntry, true);
assert.ok(bootstrap.dynamicImports.includes('src/views/csp/login/index.vue'));
assert.ok(bootstrap.dynamicImports.includes('src/views/csp/setup/index.vue'));
assert.ok(bootstrap.dynamicImports.includes('src/views/csp/overview/index.vue'));
assert.equal(
  Object.keys(manifest).some((key) => /platform-main|permission\.ts|store\/modules\/user|utils\/request/.test(key)),
  false
);
const assets = await readdir(new URL('assets/', root));
for (const file of assets.filter((name) => name.endsWith('.js'))) {
  const text = await readFile(new URL('assets/' + file, root), 'utf8');
  // X.509依赖包含“Basic Constraints”等术语；检查认证载体，不把证书术语当成Basic认证。
  assert.equal(
    /localStorage|sessionStorage|resource\/sse|resource\/websocket|client_secret|Authorization/.test(text),
    false,
    `forbidden auth carrier: ${file}`
  );
}
assert.equal((await readdir(root)).includes('favicon.ico'), false);
console.log(`CSP_PRODUCT_BUILD_PASS chunks=${assets.length} approved_brand no_legacy_auth no_browser_token_storage zoom_enabled`);
