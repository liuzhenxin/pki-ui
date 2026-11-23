import { expect, test } from '@playwright/test';
import { compileStyle, parse } from '@vue/compiler-sfc';
import { readFileSync } from 'node:fs';
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
  const employeeFile = fileURLToPath(new URL('src/views/ra/employee/index.vue', root));
  const { descriptor } = parse(readFileSync(employeeFile, 'utf8'), { filename: employeeFile });
  const statusFilter = descriptor.template!.content.match(/prop="status">([\s\S]*?)<\/el-form-item>/)?.[1];
  expect(statusFilter).toContain('v-model="queryParams.status"');
  expect(statusFilter).not.toContain('el-tooltip');
  const employeeStyles = compileStyle({
    id: 'employee-list-zoom',
    filename: employeeFile,
    source: descriptor.styles[0].content,
    scoped: true,
    preprocessLang: 'scss'
  });
  expect(employeeStyles.errors).toEqual([]);
  await page.addStyleTag({ content: employeeStyles.code });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(asset, modules)) });
  }
  await page.addScriptTag({ content: `
    Vue.createApp({
      __scopeId: 'data-v-employee-list-zoom',
      data: () => ({ rows: Array.from({ length: 40 }, (_, i) => ({ name: 'Certificate ' + i })) }),
      template: ${JSON.stringify(`
        <div class="app-container fawvw-employee-page">
          <el-card>
            <div class="query-panel">
              <el-form class="query-form" label-width="100px">
                <el-form-item v-for="i in 8" :key="i" :label="'筛选条件 ' + i">
                  <el-input :placeholder="'条件 ' + i" />
                </el-form-item>
              </el-form>
            </div>
            <el-row class="toolbar-row">
              <el-col :span="1.5"><el-button>新增用户</el-button></el-col>
              <el-col :span="1.5"><el-button>立即同步</el-button></el-col>
            </el-row>
            <el-table class="employee-table" :data="rows">
              <el-table-column prop="name" label="证书" min-width="440" />
            </el-table>
            <div class="pagination-container employee-pagination">
              <el-pagination layout="total, sizes, prev, pager, next, jumper" :total="35060" />
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
    const left = (await page.locator('.query-panel').boundingBox())!.x;
    await expect(page.locator('.query-panel')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(page.locator('.query-panel')).toHaveCSS('border-radius', '6px');
    expect((await page.getByRole('button', { name: '新增用户' }).boundingBox())!.x).toBeCloseTo(left, 0);
    expect((await page.locator('.employee-table').boundingBox())!.x).toBeCloseTo(left, 0);
    await page.locator('.pagination-container').scrollIntoViewIfNeeded();
    const pagination = page.locator('.employee-pagination');
    const controls = pagination.locator('.btn-prev, .el-pager, .btn-next, .el-pagination__jump');
    const centers = await controls.evaluateAll((elements) =>
      elements.map((el) => (el.getBoundingClientRect().top + el.getBoundingClientRect().bottom) / 2)
    );
    expect(centers).toHaveLength(4);
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(2);
    if (viewport.width === 390) {
      expect(await pagination.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    }
    const next = pagination.locator('.btn-next');
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(viewport.width);
  }
});
