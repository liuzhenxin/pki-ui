import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';
import ts from 'typescript';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

test('business administrator renders large department trees without mounting every node', async ({ page }) => {
  const root = new URL('../', import.meta.url);
  const filename = 'src/views/ra/admin/index.vue';
  const descriptor = parse(readFileSync(new URL(filename, root), 'utf8'), { filename }).descriptor;
  const script = compileScript(descriptor, { id: 'ra-admin-layout' });
  const template = compileTemplate({ source: descriptor.template!.content, filename, id: 'ra-admin-layout',
    compilerOptions: { bindingMetadata: script.bindings } });
  expect(template.errors).toEqual([]);
  const style = compileStyle({ source: descriptor.styles[0].content, filename, id: 'ra-admin-layout',
    scoped: true, preprocessLang: 'scss' });
  expect(style.errors).toEqual([]);
  const js = ts.transpileModule(script.content + '\n' + template.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText.replaceAll('import.meta.env.VITE_APP_BASE_API', "'/api'");
  await page.setViewportSize({ width: 1400, height: 800 });
  page.on('pageerror', error => { throw error; });
  await page.setContent('<div id="app"></div>');
  const modules = new URL('node_modules/', root);
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  await page.addStyleTag({ content: style.code });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(asset, modules)) });
  }
  await page.addScriptTag({ content: `
    const {ref,shallowRef,computed,reactive,toRefs,nextTick,onMounted,onUnmounted,watch,getCurrentInstance}=Vue;
    const departments=[{id:'9007199254740993',name:'总部',children:Array.from({length:3905},(_,i)=>({
      id:String(i+1),name:i===0?'设备维护科室及生产设施管理与跨区域运行保障协调办公室':'科室'+i
    }))}];
    const calls=[];window.adminCalls=calls;
    const roles=[{roleId:'503',roleName:'录入员'},{roleId:'504',roleName:'审核员'},
      {roleId:'505',roleName:'制证员'},{roleId:'507',roleName:'机构（部门）管理员'}];
    const api={listDeptSelectTree:async()=>({data:departments}),getAssignableRaRoles:async()=>roles,
      listAdminUser:async query=>{calls.push('users');window.adminSelected=query.deptId;return {data:{records:[],total:0}};}};
    const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:
      name==='@/api/ra/dept/types'?{writableRaDepartments:rows=>rows}:
      name==='@/api/ra/adminUser'?{...api,RA_BUSINESS_ROLE_OPTIONS:roles}:
      name==='@/api/ra/dept'?api:name==='@/utils/auth'?{getToken:()=>''}:
      name==='@/api/ra/init'?api:name==='@/api/skf/skf_api'?{default:class{}}:
      name==='@/components/X509Cert/index.vue'||name==='@/components/CertSubject/index.vue'?{default:{render:()=>null}}:api;
    const module={exports:{}},exports=module.exports;${js}
    module.exports.default.render=exports.render;
    module.exports.default.__scopeId='data-v-ra-admin-layout';
    const app=Vue.createApp(module.exports.default).use(ElementPlus);
    app.config.globalProperties.useDict=()=>({sys_common_status:[]});
    app.config.globalProperties.addDateRange=q=>q;
    app.config.globalProperties.parseTime=v=>v;
    app.component('RightToolbar',{template:'<span />'});app.component('Pagination',{template:'<span />'});
    app.component('X509Cert',{render:()=>null});app.component('CertSubject',{render:()=>null});
    app.directive('hasPermi',{});const instance=app.mount('#app');
    window.adminRoleState=instance.$.setupState;` });
  await expect.poll(() => page.evaluate(() => (window as any).adminCalls.length)).toBe(1);
  const getRoles = () => page.evaluate(() => {
    const state = (window as any).adminRoleState;
    return {
      form: state.adminFormRoleOptions.map((role: { value: string }) => role.value),
      filter: state.raBizRoleOptions.map((role: { value: string }) => role.value),
      isRaAdministrator: state.isRaAdministrator
    };
  });
  await expect.poll(getRoles).toEqual({
    form: ['503', '504', '505'],
    filter: ['503', '504', '505', '507'],
    isRaAdministrator: true
  });
  await page.evaluate(() => {
    const state = (window as any).adminRoleState;
    state.form.id = '9007199254740993';
    state.form.roleIds = ['507'];
  });
  expect((await getRoles()).form).toEqual(['503', '504', '505', '507']);
  await page.evaluate(() => (window as any).adminRoleState.reset());
  await expect(page.getByText('总部', { exact: true })).toBeVisible();
  expect(await page.locator('.dept-tree .el-tree-node').count()).toBeLessThan(100);
  const tree = page.getByRole('tree', { name: '部门列表' });
  const headquarters = tree.getByRole('treeitem').filter({ hasText: '总部' });
  const expandIcon = headquarters.locator('.el-tree-node__expand-icon');
  const longName = '设备维护科室及生产设施管理与跨区域运行保障协调办公室';
  const longDepartment = page.getByText(longName, { exact: true });
  await expandIcon.click();
  await longDepartment.click();
  await expect.poll(() => page.evaluate(() => (window as any).adminSelected)).toBe('1');
  await expect(headquarters).toHaveAttribute('aria-expanded', 'true');
  await expect(tree.getByRole('treeitem').filter({ has: longDepartment })).toHaveClass(/is-current/);
  expect(await page.locator('.dept-tree .el-tree-node').count()).toBeLessThan(100);

  const treeViewport = tree.locator('.el-tree-virtual-list');
  await expect.poll(() => treeViewport.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeGreaterThan(0);
  await treeViewport.hover();
  await page.mouse.wheel(200, 0);
  await expect.poll(() => treeViewport.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
  await expect(longDepartment).toHaveAttribute('title', longName);
  await treeViewport.evaluate((el) => {
    el.scrollLeft = 0;
  });
  await page.mouse.wheel(0, 200);
  await expect.poll(() => treeViewport.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  await page.mouse.wheel(0, 1000000);
  await expect.poll(() => treeViewport.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
  const lastDepartment = page.getByText('科室3904', { exact: true });
  await expect(lastDepartment).toBeVisible();
  const lastBox = (await lastDepartment.locator('..').boundingBox())!;
  const viewportBox = (await treeViewport.boundingBox())!;
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(viewportBox.y + viewportBox.height - 12);
  await treeViewport.evaluate(el => { el.scrollTop = 0; });
  await expect.poll(() => treeViewport.evaluate((el) => el.scrollTop)).toBe(0);
  await expandIcon.click();
  await expect(longDepartment).toHaveCount(0);

  await page.getByPlaceholder('请输入部门名称').fill('科室3904');
  await expect(page.getByText('科室3904', { exact: true })).toBeVisible();
  await page.getByText('科室3904', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).adminSelected)).toBe('3905');
  await expect(page.getByText('科室3904', { exact: true })).toBeVisible();
  await page.getByPlaceholder('请输入部门名称').clear();
  const handle = page.getByRole('separator', { name: '调整部门列表宽度' });
  const deptBounds = (await page.locator('.dept-column').boundingBox())!;
  const handleBounds = (await handle.boundingBox())!;
  const contentBounds = (await page.locator('.admin-content').boundingBox())!;
  expect(handleBounds.x).toBeGreaterThan(deptBounds.x + deptBounds.width);
  expect(handleBounds.x + handleBounds.width).toBeLessThan(contentBounds.x);
  const before = (await page.locator('.dept-column').boundingBox())!.width;
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  expect((await page.locator('.dept-column').boundingBox())!.width).toBeGreaterThan(before);
  await page.screenshot({ path: test.info().outputPath('ra-admin-departments.png') });
});
