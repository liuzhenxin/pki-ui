import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const source = readFileSync('src/views/ra/employee/index.vue', 'utf8');
const template = source.match(/<el-pagination\s[\s\S]*?<\/el-pagination>/)?.[0];
if (!template) throw new Error('员工分页组件未找到');
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<div id="app"></div>');
  await page.addScriptTag({ path: 'node_modules/vue/dist/vue.global.js' });
  await page.addScriptTag({ path: 'node_modules/element-plus/dist/index.full.js' });
  await page.evaluate((markup) => {
    const app = Vue.createApp({
      template: markup,
      setup() {
        const queryParams = Vue.reactive({ pageNum: 1, pageSize: 10 });
        window.paginationState = queryParams;
        const total = Vue.ref(100);
        const employeePageItems = Vue.computed(() => [1, 2, 10].map(page => ({ key: page, page })));
        function changeEmployeePagination(page, size) {
          queryParams.pageNum = page;
          queryParams.pageSize = size;
        }
        return { queryParams, total, employeePageItems, changeEmployeePagination };
      }
    });
    app.use(ElementPlus).mount('#app');
  }, template);
  await page.locator('.employee-pager button').first().waitFor();
  await page.getByRole('button', { name: '第 2 页' }).click();
  if (await page.getByRole('button', { name: '第 2 页' }).getAttribute('aria-current') !== 'page') throw new Error('点击页码未更新');
  await page.locator('.btn-next').click();
  if (await page.locator('.el-pagination__jump input').inputValue() !== '3') throw new Error('下一页未更新');
  const jumper = page.locator('.el-pagination__jump input');
  await jumper.fill('5');
  await jumper.press('Enter');
  if (await jumper.inputValue() !== '5') throw new Error('跳页未更新');
  await page.locator('.el-pagination__sizes .el-select').click();
  await page.getByRole('option', { name: /20/ }).click();
  if (await page.evaluate(() => window.paginationState.pageSize) !== 20) throw new Error('每页数量未更新');
  console.log('员工分页显示、页码和下一页检查通过');
} finally {
  await browser.close();
}
