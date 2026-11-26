import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, parse } from '@vue/compiler-sfc';
import ts from 'typescript';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

test('new applicant can choose a local headquarters department after coming from a synced department', async ({ page }) => {
  const root = new URL('../', import.meta.url);
  const filename = 'src/views/ra/employee/LocalDirectoryDialogs.vue';
  const nodeModules = new URL('node_modules/', root);
  const { descriptor } = parse(readFileSync(new URL(filename, root), 'utf8'));
  const script = compileScript(descriptor, { id: 'local-account', inlineTemplate: true });
  const compiled = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;

  await page.setContent('<div id="app"></div>');
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', nodeModules)) });
  for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(file, nodeModules)) });
  }
  await page.addScriptTag({ content: `
    const departments = [
      { id: 100, name: '在线同步部门', writable: false },
      { id: 200, name: '总部本地部门', writable: true }
    ];
    const require = name => name === 'vue' ? Vue : name === 'element-plus' ? ElementPlus :
      name === '@/plugins/auth' ? { default: { hasPermi: () => true } } :
      name === '@/api/ra/dept/types' ? {
        raDepartmentIsWritable: (options, id) => options.some(row => String(row.id) === String(id) && row.writable)
      } : {
        addUser: async account => {
          window.accountSave = { deptId: account.deptId, username: account.username, hasPassword: account.password.length >= 6 };
          return { data: '42' };
        }
      };
    const module = { exports: {} }, exports = module.exports;
    ${compiled}
    Vue.createApp({
      setup() {
        const dialogs = Vue.ref();
        return () => Vue.h('main', [
          Vue.h('button', { onClick: () => dialogs.value.openAccount('100') }, '新增用户'),
          Vue.h(module.exports.default, { ref: dialogs, departments })
        ]);
      }
    }).use(ElementPlus).mount('#app');
  ` });

  await page.getByRole('button', { name: '新增用户' }).click();
  const dialog = page.getByRole('dialog', { name: '新增申请用户' });
  await dialog.getByPlaceholder('请输入用户名').fill('fixture-applicant');
  await dialog.getByPlaceholder('请输入初始密码').fill('fixture-password');
  await dialog.getByText('请选择所属部门', { exact: true }).click();
  await page.getByText('总部本地部门', { exact: true }).click();
  await dialog.getByRole('button', { name: '保存' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).accountSave)).toEqual({
    deptId: '200', username: 'fixture-applicant', hasPassword: true
  });
});
