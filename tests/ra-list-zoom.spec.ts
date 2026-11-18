import { expect, test } from '@playwright/test';
import { fileURLToPath } from 'node:url';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

test('RA main list expands with its rows and the page scrolls to pagination', async ({ page }) => {
  const root = new URL('../', import.meta.url);
  const modules = new URL('node_modules/', root);
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.setContent('<main><header></header><section class="app-main"><div id="app"></div></section></main>');
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  await page.addStyleTag({ content: `
    body { margin: 0; }
    * { box-sizing: border-box; }
    header { height: 84px; }
    .app-main { overflow: hidden; }
    .app-container { padding: 20px; }
    .query-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 310px), 1fr)); gap: 12px 16px; }
    .query-form .el-form-item { min-width: 0; margin: 0; }
    .query-form .el-input { width: 100%; }
    .el-pagination { justify-content: flex-end; }
  ` });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(asset, modules)) });
  }
  await page.addScriptTag({ content: `
    Vue.createApp({
      data: () => ({ rows: Array.from({ length: 40 }, (_, i) => ({ name: 'Certificate ' + i })) }),
      template: ${JSON.stringify(`
        <div class="app-container">
          <el-card>
            <el-form class="query-form" label-width="100px">
              <el-form-item v-for="i in 8" :key="i" :label="'筛选条件 ' + i">
                <el-input :placeholder="'条件 ' + i" />
              </el-form-item>
            </el-form>
            <el-table :data="rows">
              <el-table-column prop="name" label="证书" min-width="440" />
            </el-table>
            <div class="pagination-container">
              <el-pagination layout="total, sizes, prev, pager, next, jumper" :total="180" />
            </div>
          </el-card>
        </div>
      `)}
    }).use(ElementPlus).mount('#app');
  ` });

  for (const viewport of [{ width: 1360, height: 900 }, { width: 980, height: 480 }, { width: 390, height: 480 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.locator('.el-table__body tr')).toHaveCount(40);
    expect((await page.locator('.el-table').boundingBox())!.height).toBeGreaterThan(1200);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeGreaterThan(viewport.height);
    await page.locator('.pagination-container').scrollIntoViewIfNeeded();
    await expect(page.locator('.pagination-container .btn-next')).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});
