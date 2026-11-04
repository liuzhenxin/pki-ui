import type { Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

export function captureEvidence(page: Page, artifactMetadata: () => unknown = () => []) {
  const events: string[] = [];
  const pending: Promise<void>[] = [];
  page.on('console', (message) => events.push(message.text()));
  page.on('pageerror', (error) => events.push(error.message));
  page.on('request', (request) => events.push(request.url(), request.postData() ?? '', JSON.stringify(request.headers())));
  page.on('response', (response) => {
    pending.push(
      (async () => {
        events.push(response.url(), JSON.stringify(response.headers()));
        try {
          events.push((await response.body()).toString());
        } catch {
          events.push('response-unavailable');
        }
      })()
    );
  });
  page.on('download', (download) => {
    pending.push(
      (async () => {
        events.push(download.suggestedFilename(), download.url());
        const path = await download.path();
        if (path) events.push((await readFile(path)).toString());
      })()
    );
  });
  return {
    events,
    async snapshot() {
      for (let offset = 0; offset < pending.length; ) {
        const batch = pending.slice(offset);
        offset += batch.length;
        await Promise.all(batch);
      }
      const browser = await page.evaluate(() => ({
        dom: document.documentElement.outerHTML,
        url: location.href,
        history: history.state,
        frames: [...document.querySelectorAll('iframe')].map((frame) => frame.src),
        performance: performance.getEntriesByType('resource').map((entry) => entry.toJSON())
      }));
      return JSON.stringify({ browser, events, artifacts: artifactMetadata() });
    }
  };
}
