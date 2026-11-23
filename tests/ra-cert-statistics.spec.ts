import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { compileScript, compileStyle, parse } from '@vue/compiler-sfc';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const componentUrl = new URL('../src/views/ra/statistics/cert/index.vue', import.meta.url);
const filename = fileURLToPath(componentUrl);
const { descriptor } = parse(readFileSync(componentUrl, 'utf8'), { filename });
const id = 'cert-statistics-test';
const script = compileScript(descriptor, { id, inlineTemplate: true });
const css = compileStyle({ id, filename, source: descriptor.styles[0].content, preprocessLang: 'scss' }).code;
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

async function mountStatistics(page: Page, hidden = false) {
  const assets = new URL('../node_modules/', import.meta.url);
  await page.setContent('<div id="host"><div id="app"></div></div>');
  await page.locator('#host').evaluate((el, hide) => {
    el.hidden = hide;
  }, hidden);
  await page.addStyleTag({ content: css });
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', assets)) });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js', 'echarts/dist/echarts.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(asset, assets)) });
  }

  await page.addScriptTag({
    content: `
      const vue = window.Vue;
      const empty = {
        overview: { totalCertCount: 0 },
        statusStats: [{ name: '有效', value: 0 }],
        trendStats: [{ date: '2026-11-19', value: 0 }, { date: '2026-11-20', value: 0 }]
      };
      const populated = {
        overview: { totalCertCount: 5, validCertCount: 5, newCertCount: 5 },
        statusStats: [{ name: '有效', value: 5 }],
        rootStats: [{ name: '测试根 CA', value: 5 }],
        profileStats: [{ name: '测试模板', value: 5 }],
        trendStats: [{ date: '2026-11-19', value: 0 }, { date: '2026-11-20', value: 5 }]
      };
      window.statisticsResponse = 'populated';
      const api = { async getRaCertStatistics() {
        if (window.statisticsResponse === 'error') throw new Error('request failed');
        return { code: 'OK', data: window.statisticsResponse === 'empty' ? empty : populated };
      }};
      const module = { exports: {} };
      new Function('require', 'exports', ${JSON.stringify(compiled)})(name => {
        if (name === 'vue') return vue;
        if (name === 'echarts') return window.echarts;
        return api;
      }, module.exports);
      vue.createApp(module.exports.default).use(window.ElementPlus).directive('hasPermi', {}).mount('#app');
    `
  });
}

test('charts render after the page becomes visible and resize with their container', async ({ page }) => {
  await mountStatistics(page, true);
  await expect(page.getByText('测试模板')).toBeAttached();
  await page.locator('#host').evaluate((host) => {
    host.hidden = false;
  });
  for (const title of ['证书状态分布', '根 CA 分布', '新增趋势']) {
    const section = page.locator('.chart-section').filter({ hasText: title });
    const canvas = section.locator('canvas').first();
    await expect.poll(async () => (await canvas.boundingBox())?.width ?? 0).toBeGreaterThan(250);
  }

  const rootChart = page.locator('.chart-section').filter({ hasText: '根 CA 分布' }).locator('canvas').first();
  const before = (await rootChart.boundingBox())!.width;
  await page.locator('#host').evaluate((host) => {
    host.style.width = '760px';
  });
  await expect.poll(async () => (await rootChart.boundingBox())?.width ?? before).not.toBe(before);
});

test('empty statistics and failed queries show distinct messages and retry restores the charts', async ({ page }) => {
  await mountStatistics(page);
  const query = page.getByRole('button', { name: '查询' });
  await expect(page.locator('.chart-section canvas')).toHaveCount(3);
  await page.evaluate(() => {
    Reflect.set(window, 'statisticsResponse', 'empty');
  });
  await query.click();
  await expect(page.getByText('暂无统计数据', { exact: true })).toHaveCount(3);
  await expect(page.locator('.chart-section canvas:visible')).toHaveCount(0);

  await page.evaluate(() => {
    Reflect.set(window, 'statisticsResponse', 'error');
  });
  await query.click();
  await expect(page.getByText('证书统计加载失败，请重新查询')).toBeVisible();
  await expect(page.locator('.chart-section .el-empty:visible')).toHaveCount(0);

  await page.evaluate(() => {
    Reflect.set(window, 'statisticsResponse', 'populated');
  });
  await query.click();
  await expect(page.locator('.chart-section canvas:visible')).toHaveCount(3);
  await expect(page.getByText('测试模板')).toBeVisible();
});
