import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const file = 'src/views/ra/employee/index.vue';
const scopeId = 'data-v-employee-org';
const departmentName = '发动机生产技术与质量保障项目现场联调组织科室DEEP_ENGINE_TEAM';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

for (const width of [1440, 390]) {
  test(`deep organization names and filtering work at ${width}px`, async ({ page }, info) => {
    const { descriptor, errors } = parse(readFileSync(new URL(file, root), 'utf8'), { filename: file });
    expect(errors).toEqual([]);
    const script = compileScript(descriptor, { id: scopeId });
    const template = compileTemplate({ source: descriptor.template!.content, filename: file, id: scopeId,
      scoped: true, compilerOptions: { bindingMetadata: script.bindings } });
    const style = compileStyle({ source: descriptor.styles[0].content, filename: file, id: scopeId, scoped: true, preprocessLang: 'scss' });
    expect(template.errors).toEqual([]);
    expect(style.errors).toEqual([]);
    const code = ts.transpileModule(script.content + '\n' + template.code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    await page.setViewportSize({ width, height: 880 });
    await page.setContent('<div id="app"></div>');
    const modules = new URL('node_modules/', root);
    await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
    await page.addStyleTag({ content: 'body{margin:0;font-family:Arial,sans-serif}*{box-sizing:border-box}.app-container{padding:16px}' + style.code });
    for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js', '@element-plus/icons-vue/dist/index.iife.min.js']) {
      await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
    }
    await page.addScriptTag({ content: `
      const node = (id,label,children=[]) => ({id,label,children,childCount:children.length});
      const ancestors = ${JSON.stringify(['总部', '生产部门', '发动机事业部', '技术部', '质量管理中心', '项目组', '工艺管理'])};
      let branch = node('target', ${JSON.stringify(departmentName)});
      for (let i=ancestors.length-1;i>=0;i--) branch=node('level-'+i,ancestors[i],[branch]);
      const other = node('other','外地分部',Array.from({length:3904},(_,i)=>node('branch-'+i,'区域分部'+i)));
      const employees = [];
      const importRow = {domainAccount:'from-file',birthday:'1990-01-01',cnName:'导入员工'};
      const api = new Proxy({
        getFawvwOrgTree:async()=>({data:[branch,other]}),
        getFawvwEmployeeSummary:async()=>({data:{departments:3913}}),
        getFawvwEmployee:async id=>({data:{id,cnName:'测试员工',identityStatus:'VALID',localEnabled:true,recordSource:'MANUAL',raUserId:'900'}}),
        getFawvwEmployeeActivity:async()=>({data:{applies:[],employeeCertificates:[]}}),
        listEmployeePublicKeys:async()=>({data:[]}),
        getUser:async id=>({data:{id,username:'employee-applicant',deptId:'37',deptName:'设备保障部',status:1}}),
        listDeptSelectTree:async()=>({data:[{id:'37',name:'设备保障部'}]}),
        createFawvwEmployee:async input=>{employees.push({...input,id:'77',recordSource:'MANUAL',identityStatus:'VALID',localEnabled:true});return {data:'77'};},
        createFawvwApplicant:async(id,input)=>{window.lastCreatedApplicant={id,departmentId:input.departmentId,username:input.username};employees.find(row=>row.id===id).raUserId='88';return {data:'88'};},
        downloadFawvwEmployeeImportTemplate:async()=>new Blob(['xlsx'],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
        previewFawvwEmployeeFile:async()=>({data:[importRow]}),
        importFawvwEmployees:async()=>{employees.push({...importRow,id:'79',recordSource:'IMPORT',identityStatus:'VALID',localEnabled:true});return {data:1};},
        deleteFawvwEmployee:async id=>{window.lastDeletedEmployee=id;employees.splice(employees.findIndex(row=>row.id===id),1);return {data:null};},
        pageFawvwEmployees:async query=>{window.lastEmployeeQuery=query;return {data:{records:[...employees],total:employees.length}};}
      },{get:(target,key)=>target[key]|| (async()=>({data:{}}))});
      const module={exports:{}},exports=module.exports;
      const employeePath='/ra-employees/ra-employee';
      const route=window.employeeRoute=Vue.reactive({path:employeePath,query:{}});
      const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:
        name==='@/hooks/useRaListRefreshOnReturn'?{useRaListRefreshOnReturn(){}}:
        name==='vue-router'?{useRoute:()=>route,useRouter:()=>({push:async target=>{window.lastDirectoryPush=target;}})}:
        name==='file-saver'?{default:{saveAs:(_blob,name)=>{window.lastEmployeeTemplate=name;}}}:
        name.endsWith('/fawvwEmployeeNavigation')?{employeeDirectoryPath:employeePath,applicantDirectoryPath:()=>'/ra-user/users',departmentDirectoryPath:()=>'/ra-dept/departments',directoryQueryId:v=>v}:api;
      ${code}
      module.exports.default.render=module.exports.render;
      module.exports.default.__scopeId=${JSON.stringify(scopeId)};
      const app=Vue.createApp(module.exports.default).use(ElementPlus);
      for(const [name,icon] of Object.entries(ElementPlusIconsVue))app.component(name,icon);
      app.component('Pagination',{template:'<div />'});app.component('RightToolbar',{template:'<div />'});
      app.directive('hasPermi',{});app.mount('#app');` });

    const tree = page.getByLabel('组织科室树');
    await expect(tree.getByText('总部', { exact: true })).toBeVisible();
    await expect(tree.getByRole('treeitem')).toHaveCount(3);
    const handle = page.getByRole('separator', { name: '调整组织科室宽度' });
    const panelEdgeDifference = () => page.evaluate(() => {
      const organization = document.querySelector('.org-panel')!.getBoundingClientRect();
      const employees = document.querySelector('.employee-panel')!.getBoundingClientRect();
      return Math.max(Math.abs(organization.top - employees.top), Math.abs(organization.bottom - employees.bottom));
    });
    if (width > 1060) {
      await expect.poll(panelEdgeDifference).toBeLessThan(2);
      const box = (await handle.boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2);
      await page.mouse.up();
      await expect(handle).toHaveAttribute('aria-valuenow', '400');
      await handle.press('ArrowLeft');
      await expect(handle).toHaveAttribute('aria-valuenow', '376');
      await expect.poll(panelEdgeDifference).toBeLessThan(2);
    } else {
      await expect(handle).toBeHidden();
    }
    const form = page.locator('.query-form');
    const fields = form.locator('.el-form-item');
    await expect(fields).toHaveCount(4);
    const fieldBounds = await fields.evaluateAll((items) => items.map((item) => item.getBoundingClientRect().toJSON()));
    expect(fieldBounds[0].top).toBe(fieldBounds[1].top);
    expect(fieldBounds[2].top).toBe(fieldBounds[3].top);
    expect(fieldBounds[0].top === fieldBounds[3].top).toBe(width > 1060);
    await fields.nth(3).getByText('全部状态', { exact: true }).click();
    await page.getByRole('option', { name: '在职', exact: true }).click();
    await form.getByRole('textbox', { name: '域账号' }).fill('vw00001');
    await form.getByRole('textbox', { name: '域账号' }).press('Enter');
    await expect.poll(() => page.evaluate(() => (window as any).lastEmployeeQuery)).toMatchObject({ domainAccount: 'vw00001', status: 'A' });
    await form.getByRole('button', { name: '重置' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).lastEmployeeQuery)).toMatchObject({ domainAccount: '', status: '' });

    for (const label of ['总部', '生产部门', '发动机事业部', '技术部', '质量管理中心', '项目组', '工艺管理']) {
      await tree.locator('.el-tree-node__content').filter({ has: page.getByText(label, { exact: true }) }).locator('.el-tree-node__expand-icon').click();
    }
    const deepLabel = tree.getByText(departmentName, { exact: true });
    await expect(deepLabel).toBeVisible();
    expect(await tree.evaluate((el) => {
      el.scrollLeft = el.scrollWidth;
      return el.scrollLeft;
    })).toBeGreaterThan(0);
    await expect.poll(() => deepLabel.evaluate((label) => {
      const viewport = label.closest('.org-viewport')!;
      return label.getBoundingClientRect().right <= viewport.getBoundingClientRect().right + 1;
    })).toBe(true);

    const search = page.getByRole('textbox', { name: '搜索组织科室' });
    await search.fill('deep_engine_team');
    const match = page.getByRole('button', { name: new RegExp(departmentName) });
    await expect(match).toContainText('总部 / 生产部门');
    await match.click();
    await expect(match).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => page.evaluate(() => (window as any).lastEmployeeQuery?.departmentId)).toBe('target');
    await expect(page.locator('.org-selection-path')).toContainText(departmentName);
    if (width > 1060) await expect.poll(panelEdgeDifference).toBeLessThan(2);
    await page.screenshot({ path: info.outputPath('employee-organization.png'), fullPage: true, animations: 'disabled' });

    await page.getByRole('button', { name: '清除科室筛选' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).lastEmployeeQuery?.departmentId)).toBe('');
    await search.fill('区域分部');
    await expect(page.locator('.org-results button')).toHaveCount(100);
    await expect(page.getByText('3904 个匹配科室，显示前 100 个')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

    if (width > 1060) {
      await page.getByRole('button', { name: 'RA 权限部门' }).click();
      expect(await page.evaluate(() => (window as any).lastDirectoryPush)).toBe('/ra-dept/departments');
      await page.getByRole('button', { name: '新增员工', exact: true }).click();
      const employeeForm = page.getByRole('dialog', { name: '新增员工' });
      await employeeForm.getByLabel('域账号').fill('local-user');
      await employeeForm.getByLabel('姓名').fill('手工员工');
      const birthday = employeeForm.getByLabel('生日');
      await birthday.fill('1990-01-02');
      await birthday.press('Enter');
      await employeeForm.getByRole('button', { name: '保存并开通账号' }).click();
      const accountForm = page.getByRole('dialog', { name: '开通个人申请用户' });
      await expect(accountForm.getByLabel('用户名')).toHaveValue('local-user');
      await accountForm.locator('.el-select__wrapper').click({ timeout: 5000 });
      await page.getByText('设备保障部', { exact: true }).click();
      await accountForm.getByLabel('初始密码').fill('test-password');
      await accountForm.getByRole('button', { name: '开通并关联' }).click();
      await expect.poll(() => page.evaluate(() => (window as any).lastCreatedApplicant)).toEqual({ id: '77', departmentId: '37', username: 'local-user' });
      await expect(accountForm).toBeHidden();
      await expect(page.getByRole('button', { name: '删除员工' })).toHaveCount(0);

      await page.getByRole('button', { name: '外部导入', exact: true }).click();
      const importForm = page.getByRole('dialog', { name: '外部导入员工' });
      await importForm.getByRole('button', { name: '下载模板' }).click();
      await expect.poll(() => page.evaluate(() => (window as any).lastEmployeeTemplate)).toBe('员工导入模板.xlsx');
      await importForm.getByLabel('员工导入文件').setInputFiles({ name: 'staff.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('xlsx') });
      await expect(importForm.getByText('导入员工', { exact: true })).toBeVisible();
      await importForm.getByRole('button', { name: '确认导入' }).click();
      await expect(importForm).toBeHidden();
      await page.getByRole('button', { name: '删除员工' }).click();
      await page.getByRole('button', { name: '取消', exact: true }).click();
      expect(await page.evaluate(() => (window as any).lastDeletedEmployee)).toBeUndefined();
      await page.getByRole('button', { name: '删除员工' }).click();
      await page.getByRole('button', { name: '删除', exact: true }).click();
      await expect.poll(() => page.evaluate(() => (window as any).lastDeletedEmployee)).toBe('79');
      await expect(page.getByRole('button', { name: '删除员工' })).toHaveCount(0);
    }

    await page.evaluate(() => { (window as any).employeeRoute.query = { employeeId: '45' }; });
    const drawer = page.getByRole('dialog', { name: '员工详情' });
    await expect(drawer.getByRole('tab', { name: 'RA 申请资格' })).toHaveAttribute('aria-selected', 'true');
    await expect(drawer.getByText('设备保障部', { exact: true })).toBeVisible();
    await drawer.getByRole('tab', { name: '申请与证书' }).click();
    await expect(drawer.getByRole('button', { name: '发起标准证书申请' })).toBeDisabled();
    await drawer.getByRole('tab', { name: 'RA 申请资格' }).click();
    await drawer.getByRole('button', { name: 'employee-applicant' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).lastDirectoryPush)).toMatchObject({ path: '/ra-user/users', query: { applicantId: '900', deptId: '37' } });
  });
}
