import { expect, test } from '@playwright/test';
import { createCanaries, detectCanaries, categories } from '../fixtures/canaries';
import { strictNetwork } from '../fixtures/network';
import { captureEvidence } from './capture';

test('@security-harness clean evidence and synthetic channel detection', async ({ page, context }) => {
  const network = await strictNetwork(context);
  const capture = captureEvidence(page);
  const canaries = createCanaries();
  await page.setContent('<main><h1>密码服务平台 Mock</h1><p>服务已失败关闭</p></main>');
  expect(detectCanaries(await capture.snapshot(), canaries)).toEqual([]);
  expect(detectCanaries(Object.values(canaries).join(' '), canaries)).toEqual([...categories]);
  await page.evaluate((value) => {
    document.querySelector('p')!.textContent = value;
    console.log(value);
  }, canaries.businessPlaintext);
  expect(detectCanaries(await capture.snapshot(), canaries)).toContain('businessPlaintext');
  await page.evaluate(async () => {
    try {
      await fetch('http://csp.test/health');
    } catch {
      /* expected abort */
    }
  });
  expect(() => network.assertClean()).toThrow('Unregistered mock network request');
});

test('@security-harness actual browser history URL network iframe performance and download capture', async ({ page, context }, testInfo) => {
  const network = await strictNetwork(context);
  const canaries = createCanaries();
  const capture = captureEvidence(page, () => testInfo.attachments.map(({ name, contentType, path }) => ({ name, contentType, path })));
  const origin = 'http://csp.test';
  const responseValue = canaries.privateKey;
  // Deliberate leaks are confined to explicitly fulfilled local negative-fixture routes and a local Blob.
  await page.route(`${origin}/csp/negative/document`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<html><body><main>Mock negative fixture</main></body></html>' })
  );
  await page.route(`${origin}/csp/negative/data*`, (route) => route.fulfill({ json: { result: responseValue } }));
  await page.route(`${origin}/csp/negative/redirect*`, (route) =>
    route.fulfill({ status: 302, headers: { location: `/csp/negative/data?probe=${canaries.physicalIndex}` } })
  );
  await page.goto(`${origin}/csp/negative/document`);
  await page.evaluate(async (values) => {
    history.replaceState({ marker: values.refreshToken }, '', `?probe=${values.JWT}`);
    await fetch(`/csp/negative/data?probe=${values.slot}`, { method: 'POST', body: values.PIN });
    await fetch(`/csp/negative/redirect?probe=${values.physicalIndex}`, { redirect: 'manual' });
    const frame = document.createElement('iframe');
    frame.src = `/csp/negative/document#${values.handle}`;
    document.body.append(frame);
  }, canaries);
  await expect(page.locator('iframe')).toHaveAttribute('src', `/csp/negative/document#${canaries.handle}`);
  const downloadReady = page.waitForEvent('download');
  await page.evaluate((value) => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([value], { type: 'text/plain' }));
    link.download = 'synthetic.txt';
    document.body.append(link);
    link.click();
  }, canaries.keyMaterial);
  const download = await downloadReady;
  expect(await download.failure()).toBeNull();
  await testInfo.attach(`trace-metadata-${canaries.reauthProof}`, { body: Buffer.from('synthetic metadata probe'), contentType: 'text/plain' });
  await testInfo.attach(`screenshot-metadata-${canaries.providerKeyRef}`, { body: await page.screenshot(), contentType: 'image/png' });
  const evidence = JSON.parse(await capture.snapshot());
  expect(detectCanaries(evidence.browser.url, canaries)).toContain('JWT');
  expect(detectCanaries(JSON.stringify(evidence.browser.history), canaries)).toContain('refreshToken');
  expect(detectCanaries(JSON.stringify(evidence.browser.frames), canaries)).toContain('handle');
  expect(detectCanaries(JSON.stringify(evidence.browser.performance), canaries)).toContain('slot');
  const captured = detectCanaries(JSON.stringify(evidence.events), canaries);
  expect(captured).toEqual(expect.arrayContaining(['PIN', 'privateKey', 'keyMaterial', 'slot', 'physicalIndex']));
  expect(detectCanaries(JSON.stringify(evidence.artifacts), canaries)).toEqual(expect.arrayContaining(['reauthProof', 'providerKeyRef']));
  network.assertClean();
});

for (const target of ['http://unregistered.invalid/csp/mock/status', 'http://csp.test/csp/mock/status?accessToken=synthetic']) {
  test(`@security-harness rejects forbidden target ${new URL(target).hostname} ${new URL(target).search ? 'credential query' : 'host'}`, async ({
    page,
    context
  }) => {
    const network = await strictNetwork(context);
    await page.setContent('<main>Mock negative network probe</main>');
    await page.evaluate(async (url) => {
      try {
        await fetch(url);
      } catch {
        /* The explicit rejection is asserted below. */
      }
    }, target);
    expect(network.failures).toHaveLength(1);
    expect(() => network.assertClean()).toThrow('Unregistered mock network request');
  });
}
