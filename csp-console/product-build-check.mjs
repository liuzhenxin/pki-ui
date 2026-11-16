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
const entry = manifest['index.html'];
for (const page of ['src/views/login.vue', 'src/views/csp/setup/index.vue', 'src/views/csp/overview/index.vue']) {
  assert.ok(entry.dynamicImports.includes(page), `missing platform route entry: ${page}`);
}
assert.equal(Object.hasOwn(manifest, 'src/views/csp/login/index.vue'), false);
const assets = await readdir(new URL('assets/', root));
for (const file of assets.filter((name) => name.endsWith('.js'))) {
  const text = await readFile(new URL('assets/' + file, root), 'utf8');
  assert.doesNotMatch(text, /\/console-api\//, `obsolete CSP API: ${file}`);
}
assert.equal((await readdir(root)).includes('favicon.ico'), false);
console.log('CSP_PRODUCT_BUILD_PASS shared_platform_login gateway_apis approved_brand zoom_enabled');
