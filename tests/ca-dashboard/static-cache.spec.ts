import { createServer } from 'node:http';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { versionStaticEntry } from '../../scripts/version-static-entry.mjs';

test('an existing immutable module cache upgrades without clearing browser data', async ({ page }) => {
  let stage: 'old' | 'overwritten' | 'versioned' = 'old';
  const requests: Record<string, number> = {};
  const entry =
    '<html><head><script type="module" src="/assets/entry.js"></script></head><body><b id="count"></b><i id="singleton"></i></body></html>';
  const server = createServer((request, response) => {
    const url = request.url || '/';
    requests[url] = (requests[url] || 0) + 1;
    if (url === '/') {
      response.setHeader('Content-Type', 'text/html');
      response.setHeader('Cache-Control', 'no-store');
      response.end(stage === 'versioned' ? versionStaticEntry(entry, 'ca-cache-fix') : entry);
      return;
    }
    response.setHeader('Content-Type', 'application/javascript');
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (url.endsWith('/entry.js')) {
      response.end(
        `import {runtime} from './runtime.js'; import('./home.js').then(({count, sameRuntime}) => { document.querySelector('#count').textContent=count; document.querySelector('#singleton').textContent=String(sameRuntime(runtime)); });`
      );
    } else if (url.endsWith('/home.js')) {
      response.end(
        `import {runtime} from './runtime.js'; export const count=${stage === 'old' ? 2000 : 39680}; export const sameRuntime=value=>value===runtime;`
      );
    } else if (url.endsWith('/runtime.js')) {
      response.end('export const runtime={};');
    } else {
      response.writeHead(404).end();
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    await page.goto(base);
    await expect(page.locator('#count')).toHaveText('2000');

    // Reproduce the original deployment error: changing bytes at an immutable URL.
    stage = 'overwritten';
    await page.goto(base);
    await expect(page.locator('#count')).toHaveText('2000');
    expect(requests['/assets/home.js']).toBe(1);

    stage = 'versioned';
    await page.goto(base);
    await expect(page.locator('#count')).toHaveText('39680');
    await expect(page.locator('#singleton')).toHaveText('true');
    expect(requests['/assets/home.js']).toBe(1);
    expect(requests['/releases/ca-cache-fix/assets/home.js']).toBe(1);
    expect(requests['/releases/ca-cache-fix/assets/runtime.js']).toBe(1);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
