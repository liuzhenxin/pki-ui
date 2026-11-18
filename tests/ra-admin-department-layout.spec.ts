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
    const departments=[{id:'9007199254740993',name:'总部',children:Array.from({length:3905},(_,i)=>({id:String(i+1),name:'科室'+i}))}];
    const calls=[];window.adminCalls=calls;
    const api={listDeptSelectTree:async()=>({data:departments}),getAssignableRaRoles:async()=>[],
      listAdminUser:async query=>{calls.push('users');window.adminSelected=query.deptId;return {data:{records:[],total:0}};}};
    const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:
      name==='@/api/ra/dept/types'?{writableRaDepartments:rows=>rows}:
      name==='@/api/ra/adminUser'?{...api,RA_BUSINESS_ROLE_OPTIONS:[]}:
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
    app.directive('hasPermi',{});app.mount('#app');` });
  await expect.poll(() => page.evaluate(() => (window as any).adminCalls.length)).toBe(1);
  await expect(page.getByText('总部', { exact: true })).toBeVisible();
  expect(await page.locator('.dept-tree .el-tree-node').count()).toBeLessThan(100);
  await page.getByPlaceholder('请输入部门名称').fill('科室3904');
  await expect(page.getByText('科室3904', { exact: true })).toBeVisible();
  await page.getByText('科室3904', { exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).adminSelected)).toBe('3905');
  await page.getByPlaceholder('请输入部门名称').clear();
  const handle = page.getByRole('separator', { name: '调整部门列表宽度' });
  const before = (await page.locator('.dept-column').boundingBox())!.width;
  await handle.focus();
  await page.keyboard.press('ArrowRight');
  expect((await page.locator('.dept-column').boundingBox())!.width).toBeGreaterThan(before);
  await page.screenshot({ path: test.info().outputPath('ra-admin-departments.png') });
});
