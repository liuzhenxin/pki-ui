import { expect, test } from '@playwright/test';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const transpile = (source: string) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;

test('returning to cached RA review refreshes once, keeps the query and ignores an older response', async ({ page }) => {
  const filename = 'src/views/ra/workflow/todo/index.vue';
  const { descriptor } = parse(read(filename), { filename });
  const script = compileScript(descriptor, { id: 'review-refresh' });
  const template = compileTemplate({
    filename, id: 'review-refresh', compilerOptions: { bindingMetadata: script.bindings },
    source: `<input aria-label="筛选" v-model="queryParams.keyword">
      <button type="button" @click="handleQuery">查询</button>
      <output>{{ taskList.map(task => task.id).join(',') }}</output>`
  });
  expect(template.errors).toEqual([]);
  await page.setContent('<div id="app"></div>');
  await page.addScriptTag({ path: fileURLToPath(new URL('node_modules/vue/dist/vue.global.prod.js', root)) });
  await page.addScriptTag({ content: `
    const { ref, reactive, onMounted, getCurrentInstance, KeepAlive, h } = Vue;
    const refresh = (() => {
      const exports = {};
      const require = () => Vue;
      ${transpile(read('src/hooks/useRaListRefreshOnReturn.ts'))}
      return exports;
    })();
    const requests = window.requests = [];
    const api = {
      pageRaWorkflowTodo: query => new Promise(resolve => requests.push({ query, resolve }))
    };
    const review = (() => {
      const exports = {};
      const require = name => name === 'vue' ? Vue : name.includes('useRaListRefreshOnReturn') ? refresh : api;
      ${transpile(script.content + '\n' + template.code)}
      exports.default.render = exports.render;
      return exports.default;
    })();
    const selected = ref(true);
    const other = { render: () => h('p', '证书申请') };
    Vue.createApp({
      render: () => h('main', [
        h('button', { onClick: () => { selected.value = !selected.value; } }, '切换业务'),
        h(KeepAlive, null, { default: () => h(selected.value ? review : other) })
      ])
    }).mount('#app');
  ` });
  const requestCount = () => page.evaluate(() => (window as any).requests.length);
  const resolve = (index: number, id: string) => page.evaluate(([n, taskId]) => {
    (window as any).requests[n].resolve({ data: { records: [{ id: taskId }], total: 1 } });
  }, [index, id] as const);
  await expect.poll(requestCount).toBe(1);
  await resolve(0, 'old');
  await expect(page.locator('output')).toHaveText('old');
  await page.getByLabel('筛选').fill('保留条件');
  await page.getByRole('button', { name: '查询' }).click();
  await expect.poll(requestCount).toBe(2);
  await page.getByRole('button', { name: '切换业务' }).click();
  await expect(page.getByText('证书申请')).toBeVisible();
  expect(await requestCount()).toBe(2);
  await page.getByRole('button', { name: '切换业务' }).click();
  await expect.poll(requestCount).toBe(3);
  await expect(page.getByLabel('筛选')).toHaveValue('保留条件');
  expect(await page.evaluate(() => (window as any).requests[2].query.keyword)).toBe('保留条件');
  await resolve(2, 'latest');
  await resolve(1, 'stale');
  await expect(page.locator('output')).toHaveText('latest');
});
