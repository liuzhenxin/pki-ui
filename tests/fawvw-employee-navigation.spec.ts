import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compileScript, compileStyle, compileTemplate, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import type { RouteRecordRaw } from 'vue-router';
import { shallowRef } from 'vue';
import { usePagedDepartmentTree } from '../src/hooks/usePagedDepartmentTree';
import { directoryQueryId, groupFawvwEmployeeNavigation } from '../src/utils/fawvwEmployeeNavigation';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

const department = { name: 'RaDept', path: 'departments', component: 'ra/dept/index', meta: { title: '部门列表' } } as unknown as RouteRecordRaw;
const departmentGroup = { path: '/ra-dept', children: [department] };
const employees = { path: '/ra-employees', children: [{ path: 'ra-employee' }] };

test('removes the department menu when the employee workspace is available', () => {
  const routes = [departmentGroup, employees];
  const navigation = groupFawvwEmployeeNavigation(routes);
  expect(navigation).toHaveLength(1);
  expect(navigation[0].children).toEqual(employees.children);
  expect(departmentGroup.children[0].path).toBe('departments');
});

test('keeps unrelated menu entries and never introduces a missing or hidden department route', () => {
  const other = { path: 'other', component: 'system/dept/index' } as unknown as RouteRecordRaw;
  expect(groupFawvwEmployeeNavigation([{ ...departmentGroup, children: [department, other] }, employees])[0].children).toEqual([other]);
  for (const routes of [[employees], [departmentGroup], [{ ...departmentGroup, hidden: true }, employees]]) {
    expect(groupFawvwEmployeeNavigation(routes)).toEqual(routes);
  }
});

test('hides only the RA applicant and department menus without mutating routes', () => {
  const applicant = { path: 'users', component: 'ra/user/index' } as unknown as RouteRecordRaw;
  const administrators = { path: 'administrators', component: 'ra/admin/index' } as unknown as RouteRecordRaw;
  const users = { path: 'ra-user', children: [applicant, administrators] };
  const result = groupFawvwEmployeeNavigation([users, departmentGroup, employees]);
  expect(result[0].children).toEqual([administrators]);
  expect(result[1].children?.map((route) => route.path)).toEqual(['ra-employee']);
  expect(users.children).toEqual([applicant, administrators]);
  expect(directoryQueryId('9223372036854775807')).toBe('9223372036854775807');
  expect(directoryQueryId(['1', '2'])).toBeUndefined();
});

test('standard certificate application finds employees by department and domain account', async () => {
  const filename = 'src/views/ra/apply/index.vue';
  const { descriptor } = parse(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), { filename });
  const script = compileScript(descriptor, { id: 'apply-employee-picker' });
  expect(compileTemplate({ source: descriptor.template!.content, filename, id: 'apply-employee-picker',
    compilerOptions: { bindingMetadata: script.bindings } }).errors).toEqual([]);
  const code = ts.transpileModule(script.content, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022
  } }).outputText;
  const vue = await import('vue');
  const module = { exports: {} as any };
  const queries: any[] = [];
  const employee = { id: 'employee-id', identityKey: 'identity', raUserId: 'applicant-id', cnName: '员工甲', domainAccount: 'vw00001',
    recordSource: 'API', sourceStatus: '3', identityStatus: 'VALID', localEnabled: true };
  const applicant = { id: 'applicant-id', username: 'ra-system-user', userCategory: 'individual', deptName: 'RA部门', status: 0 };
  const directoryRow = { employee, applicant, name: '员工甲', source: 'API', eligible: true };
  const applyPath = '/ra-certificate/ra-cert-apply';
  const issuePath = '/ra-cert-management/ra-employee-cert-issue';
  const route = vue.reactive<{ path: string; fullPath: string; query: Record<string, string> }>({ path: applyPath, fullPath: applyPath, query: {} });
  const local = { ...applicant, id: 'local-prefill', username: 'local-prefill', userCategory: 'device' };
  const employeeLookups: string[] = [];
  let finishOptions: (() => void) | undefined;
  let delayOptions = false;
  const api = {
    listDeptSelectTree: async () => ({ data: [{ id: 'ra-1', name: 'RA部门' }] }),
    listMyUserCertScopeOptions: async () => {
      if (delayOptions) await new Promise<void>((resolve) => { finishOptions = resolve; });
      return { data: [] };
    },
    getFawvwEmployee: async (id: string) => { employeeLookups.push(id); return { data: employee }; },
    getFawvwEmployeeApplicant: async () => ({ data: applicant }),
    getEmployeeDirectoryDetails: async (id: string) => ({ data: { person: { applicant: { ...local, id }, name: local.username, eligible: true } } }),
    pageEmployeeDirectory: async (query: any) => { queries.push(query); return { data: { records: [directoryRow], total: 1 } }; }
  };
  new Function('require', 'module', 'exports', 'ref', 'reactive', 'computed', 'shallowRef', 'watch', 'onMounted', 'getCurrentInstance', code)(
    (name: string) => name === 'vue' ? vue : name === 'vue-router' ? { useRoute: () => route }
      : name === '@/hooks/useRaListRefreshOnReturn' ? { useRaListRefreshOnReturn: () => {} }
      : name === '@/plugins/auth' ? { default: { hasPermi: () => true } }
      : name === '@/utils/fawvwEmployeeStatus' ? { isFawvwEmployeeSourceActive: (status: string) => status === '3' } : api,
    module, module.exports, vue.ref, vue.reactive, vue.computed, vue.shallowRef, vue.watch, () => {}, () => ({ proxy: {} })
  );
  const picker = module.exports.default.setup({}, { expose: () => {} });
  await picker.openUserPicker();
  expect(picker.pickerTree.value[0].children[0].name).toBe('RA部门');
  expect(queries.at(-1)).toMatchObject({ departmentId: undefined });
  picker.userPickerQuery.domainAccount = ' vw00001 ';
  await picker.handlePickerDeptClick({ id: 'ra-1' });
  expect(queries.at(-1)).toMatchObject({ departmentId: 'ra-1', domainAccount: 'vw00001' });
  expect(picker.pickerBlockReason({ ...directoryRow, eligible: false })).toBe('不可办理');
  await picker.selectPickerRow(picker.userPickerList.value[0]);
  expect(picker.form).toMatchObject({ userId: 'applicant-id', userName: '员工甲', deptName: 'RA部门', userCategory: 'individual' });
  picker.form.userCategory = 'organization';
  await picker.openUserPicker();
  picker.userPickerQuery.domainAccount = 'local.domain';
  await picker.handleUserPickerQuery();
  expect(queries.at(-1)).toMatchObject({ domainAccount: 'local.domain', userCategory: 'organization' });
  picker.selectPickerRow({ applicant: { ...applicant, id: 'local-id', username: 'local-tester', userCategory: 'organization' }, eligible: true });
  expect(picker.form).toMatchObject({ userId: 'local-id', userName: 'local-tester', userCategory: 'organization' });
  route.query = { applicantId: local.id };
  route.fullPath = applyPath + '?applicantId=local-prefill';
  await expect.poll(() => picker.form.userId).toBe(local.id);
  expect(picker.form).toMatchObject({ userId: local.id, userName: local.username, userCategory: 'device' });
  expect(picker.open.value).toBe(true);
  picker.open.value = false;
  Object.assign(route, { path: issuePath, fullPath: issuePath + '?employeeId=employee-id&identityKey=identity',
    query: { employeeId: employee.id, identityKey: employee.identityKey } });
  await vue.nextTick();
  expect(employeeLookups).toEqual([]);
  expect(picker.open.value).toBe(false);

  delayOptions = true;
  Object.assign(route, { path: applyPath, fullPath: applyPath + '?employeeId=employee-id',
    query: { employeeId: employee.id } });
  await expect.poll(() => Boolean(finishOptions)).toBe(true);
  Object.assign(route, { path: issuePath, fullPath: issuePath + '?employeeId=employee-id',
    query: { employeeId: employee.id, identityKey: employee.identityKey } });
  await vue.nextTick();
  finishOptions!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(employeeLookups).toEqual([employee.id]);
  expect(picker.open.value).toBe(false);
});

test('certificate application search, reset and add align at normal zoom', async ({ page }) => {
  const root = new URL('../', import.meta.url);
  const filename = 'src/views/ra/apply/index.vue';
  const { descriptor } = parse(readFileSync(new URL(filename, root), 'utf8'), { filename });
  const template = descriptor.template!.content.split('<el-table v-loading=')[0] + '</div>';
  const style = descriptor.styles[0];
  const styles = compileStyle({ source: style.content, filename, id: 'apply-layout', preprocessLang: style.lang as 'scss', scoped: true });
  expect(styles.errors).toEqual([]);
  await page.setContent('<div id="app"></div>');
  const modules = new URL('node_modules/', root);
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  await page.addStyleTag({ content: 'body{margin:0}*{box-sizing:border-box}.app-container{padding:20px}@media(min-width:769px){#app{margin-left:220px}}' + styles.code });
  for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js', '@element-plus/icons-vue/dist/index.iife.min.js'])
    await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
  await page.addScriptTag({ content: `window.applyActions=[];
    const app=Vue.createApp({__scopeId:'data-v-apply-layout',template:${JSON.stringify(template)},
      data:()=>({showSearch:true,queryParams:{},dateRange:[],applyStatusOptions:[]}),
      methods:{handleQuery(){applyActions.push('search')},resetQuery(){applyActions.push('reset')},handleAdd(){applyActions.push('add')}}
    });
    app.component('RightToolbar',{props:['showSearch'],template:${JSON.stringify(`<button type="button" @click="$emit('update:showSearch', !showSearch)">切换搜索栏</button>` )}});
    app.directive('hasPermi',{});
    for(const [name,icon] of Object.entries(ElementPlusIconsVue))app.component(name,icon);
    app.use(ElementPlus);app.mount('#app');` });
  const buttons = ['搜索', '重置', '新增申请'].map((name) => page.getByRole('button', { name, exact: true }));
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const [search, reset, add] = await Promise.all(buttons.map((button) => button.boundingBox()));
    expect(search!.y).toBe(reset!.y);
    expect(reset!.y).toBe(add!.y);
    expect(search!.x + search!.width).toBeLessThan(reset!.x);
    expect(reset!.x + reset!.width).toBeLessThan(add!.x);
  }
  for (const button of buttons) await button.click();
  expect(await page.evaluate(() => (window as any).applyActions)).toEqual(['search', 'reset', 'add']);
  await page.getByRole('button', { name: '切换搜索栏' }).click();
  await expect(buttons[0]).toBeHidden();
  await expect(buttons[1]).toBeHidden();
  await expect(buttons[2]).toBeVisible();
});

test('employee workspace switches sources and adds an applicant to the selected local department', async ({ page }) => {
  test.setTimeout(60_000);
  const root = new URL('../', import.meta.url);
  const component = (filename: string) => {
    const { descriptor } = parse(readFileSync(new URL(filename, root), 'utf8'), { filename });
    const script = compileScript(descriptor, { id: filename });
    const template = compileTemplate({ source: descriptor.template!.content, filename, id: filename, compilerOptions: { bindingMetadata: script.bindings } });
    expect(template.errors).toEqual([]);
    const js = ts.transpileModule(script.content + '\n' + template.code, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText;
    return `(() => { const module={exports:{}},exports=module.exports; ${js}; module.exports.default.render=exports.render; return module.exports.default; })()`;
  };
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.setContent('<div class="hasTagsView"><header style="height:84px"></header><div id="app"></div></div>');
  const modules = new URL('node_modules/', root);
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  const globalStyles = readFileSync(new URL('src/assets/styles/index.scss', root), 'utf8');
  await page.addStyleTag({ content: 'body{margin:0}html{box-sizing:border-box}*,*:before,*:after{box-sizing:inherit}.app-container{padding:20px}'
    + globalStyles.slice(globalStyles.indexOf('.ra-list-viewport {'), globalStyles.indexOf('// search')) });
  const filename = 'src/views/ra/employee/index.vue';
  const { descriptor } = parse(readFileSync(new URL(filename, root), 'utf8'), { filename });
  const style = descriptor.styles[0];
  const compiled = compileStyle({ source: style.content, filename, id: 'employee-layout-test', preprocessLang: style.lang as 'scss', scoped: true });
  expect(compiled.errors).toEqual([]);
  await page.addStyleTag({ content: compiled.code });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(asset, modules)) });
  }
  await page.addScriptTag({ content: `
    const route=Vue.reactive({path:'/ra-employees/ra-employee',query:{}});
    const department={id:'9007199254740993',name:'本地测试部门',children:[{id:'9007199254740994',name:'空子部门'}]};
    const employee={id:'1',cnName:'同步员工甲',recordSource:'API',sourceStatus:'3',sourceStatusName:'在职',identityStatus:'VALID',localEnabled:true};
    const accounts=[{id:'24',username:'local-no-domain',userCategory:'individual',deptName:department.name,status:0}];
    const localRow=applicant=>({applicant,source:'LOCAL',name:applicant.username,eligible:true,
      employee:applicant.domainAccount?{id:'25',identityKey:'local-identity-23',recordSource:'LOCAL_USER',identityStatus:'VALID',localEnabled:true}:undefined});
    const empty=async()=>({data:{}});
    let firstSummaryRequest=true;
    const api={getFawvwEmployeeSummary:async()=>{
        if(firstSummaryRequest){firstSummaryRequest=false;throw new Error('summary timeout');}
        return {data:{localEmployees:accounts.length,activeEmployees:12,chineseEmployees:10,foreignEmployees:2,
          latestSyncStatus:'SUCCESS',latestSyncTime:'2026-11-17T10:20:30',latestSyncEmployees:12}};
      },getFawvwSyncConfig:empty,pageFawvwSyncLogs:empty,
      listDeptSelectTree:async()=>({data:[department,{id:'2',name:'大众测试科室'}]}),
      pageEmployeeDirectory:async(query,signal)=>{
        const deptId=query.departmentId;
        window.lastDirectory={query,deptId};
        if(window.delayDirectory && deptId===department.id){
          window.pendingDirectory=true;
          await new Promise((_,reject)=>signal.addEventListener('abort',()=>{
            window.cancelledDirectory=true;
            reject(new Error('cancelled'));
          },{once:true}));
        }
        if(window.largeDirectory){
          const size=query.pageSize;
          return {data:{records:Array.from({length:size},(_,i)=>({employee:{...employee,id:String(i+1),cnName:'批量员工'+(i+1)}})),total:40}};
        }
        const records=[...(!deptId||deptId==='2'?[{employee,applicant:{deptName:'大众测试科室'}}]:[]),
          ...(!deptId||deptId===department.id?accounts.map(localRow):[])];
        return {data:{records,total:records.length}};
      },
      addUser:async (form,domainAccount)=>{window.savedDept=form.deptId;accounts.push({...form,domainAccount,id:'23',deptName:department.name});},
      removeDept:async ids=>{window.removedDept=ids[0];department.children=[];return {data:true};},
      getUser:async id=>({data:accounts.find(item=>item.id===id)}),
      getEmployeeDirectoryDetails:async id=>({data:{person:localRow(accounts.find(item=>item.id===id)),activity:{applies:[{id:'108',status:0}],employeeCertificates:[]}}}),
      listEmployeePublicKeys:async id=>{window.lastPublicKeysId=id;return {data:[]};}};
    const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:
      name==='@/hooks/useRaListRefreshOnReturn'?{useRaListRefreshOnReturn(){}}:
      name==='vue-router'?{useRoute:()=>route,useRouter:()=>({push:target=>{window.lastEmployeePush=target;}})}:
      name==='@/plugins/auth'?{default:{hasPermi:p=>p!=='write',hasPermiAnd:ps=>!ps.includes('write')}}:
      name.endsWith('/fawvwEmployeeNavigation')?{employeeDirectoryPath:route.path,directoryQueryId:()=>undefined}:
      name.endsWith('/fawvwEmployeeStatus')?{isFawvwEmployeeSourceActive:value=>['A','3'].includes(value)}:
      name==='./LocalDirectoryDialogs.vue'?{default:Dialogs}:api;
    const Dialogs=${component('src/views/ra/employee/LocalDirectoryDialogs.vue')};
    const Employee=${component('src/views/ra/employee/index.vue')};
    Employee.__scopeId='data-v-employee-layout-test';
    const app=Vue.createApp(Employee).use(ElementPlus);
    app.component('RightToolbar',{template:'<span />'});
    app.component('Pagination',{emits:['update:limit','pagination'],setup:(_, {emit})=>()=>Vue.h('div',{'data-testid':'employee-pager',style:'height:32px'},
      [Vue.h('button',{onClick:()=>{emit('update:limit',20);emit('pagination');}},'20条/页')])});
    app.directive('hasPermi',{});app.mount('#app');` });
  const list = page.locator('.employee-table');
  await expect(list.getByText('同步员工甲', { exact: true })).toBeVisible();
  const metrics = page.locator('.summary-strip .metric-label');
  await expect(metrics).toHaveText(['可办理员工', '中方员工', '外方员工', '本地员工', '最近同步']);
  await expect(page.getByText('统计加载失败', { exact: true })).toBeVisible();
  await expect(page.locator('.summary-strip .metric').filter({ hasText: '可办理员工' }).locator('strong')).toHaveText('—');
  await page.getByRole('button', { name: '重试统计' }).click();
  await expect(page.locator('.summary-strip .metric').filter({ hasText: '可办理员工' }).locator('strong')).toHaveText('12');
  await expect(page.getByText('同步成功 / 12人', { exact: true })).toBeVisible();
  await expect(page.getByText('2026-11-17 10:20:30', { exact: true })).toBeVisible();
  const localCount = page.locator('.summary-strip .metric').filter({ hasText: '本地员工' }).locator('strong');
  await expect(localCount).toHaveText('1');
  const filters = page.locator('.query-panel');
  const search = filters.getByRole('button', { name: '搜索', exact: true });
  const reset = filters.getByRole('button', { name: '重置', exact: true });
  for (const width of [1600, 1360, 1220, 1080, 980, 600]) {
    await page.setViewportSize({ width, height: 900 });
    const panel = (await filters.boundingBox())!;
    const searchBox = (await search.boundingBox())!;
    const resetBox = (await reset.boundingBox())!;
    expect(resetBox.y).toBeCloseTo(searchBox.y, 0);
    expect(resetBox.x).toBeGreaterThanOrEqual(searchBox.x + searchBox.width);
    expect(resetBox.x + resetBox.width).toBeLessThanOrEqual(panel.x + panel.width);
    expect(await filters.locator('.el-form-item').evaluateAll(items => items.every(item => {
      const label = item.querySelector('.el-form-item__label');
      const control = item.querySelector('.el-form-item__content');
      if (!label || !control) return true;
      const labelBox = label.getBoundingClientRect();
      const controlBox = control.getBoundingClientRect();
      return labelBox.right <= controlBox.left + 1 && Math.abs(labelBox.top - controlBox.top) <= 1;
    }))).toBe(true);
  }
  await page.setViewportSize({ width: 1360, height: 900 });
  const domainFilter = filters.getByPlaceholder('请输入域账号');
  await domainFilter.fill('local.domain');
  await search.click();
  await expect.poll(() => page.evaluate(() => (window as any).lastDirectory?.query.domainAccount)).toBe('local.domain');
  await reset.click();
  await expect(domainFilter).toHaveValue('');
  await expect.poll(() => page.evaluate(() => (window as any).lastDirectory?.query.domainAccount)).toBe('');
  const pager = page.getByTestId('employee-pager');
  expect((await pager.boundingBox())!.y).toBeGreaterThanOrEqual((await list.boundingBox())!.y + (await list.boundingBox())!.height - 1);
  const local = page.getByRole('treeitem', { name: '本地测试部门', exact: true });
  await page.evaluate(() => { (window as any).delayDirectory = true; });
  await local.click();
  await expect.poll(() => page.evaluate(() => (window as any).pendingDirectory)).toBe(true);
  await page.getByRole('treeitem', { name: '大众测试科室', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).cancelledDirectory)).toBe(true);
  await expect(list.getByText('同步员工甲', { exact: true })).toBeVisible();
  await page.evaluate(() => { (window as any).delayDirectory = false; });
  await local.click();
  await expect.poll(() => page.evaluate(() => (window as any).lastDirectory?.deptId)).toBe('9007199254740993');
  await expect(page.getByRole('button', { name: '删除部门', exact: true })).toHaveCount(0);
  if (await local.getAttribute('aria-expanded') === 'false') await local.locator('.el-tree-node__expand-icon').first().click();
  await page.getByText('空子部门', { exact: true }).click();
  await page.getByRole('button', { name: '删除部门', exact: true }).click();
  await page.getByRole('button', { name: '删除', exact: true }).click();
  await expect(page.getByText('空子部门', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).removedDept)).toBe('9007199254740994');
  await expect(page.getByRole('dialog', { name: '删除部门' })).toHaveCount(0);
  await page.getByRole('treeitem', { name: '本地测试部门', exact: true }).click();
  await page.getByRole('button', { name: '新增用户', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新增申请用户' });
  await dialog.locator('.el-form-item').filter({ hasText: '用户名' }).locator('input').fill('local-tester');
  await dialog.locator('input[type=password]').fill('TestPassword1!');
  await expect(dialog.getByText('本地测试部门', { exact: true })).toBeVisible();
  await dialog.getByPlaceholder('请输入员工制证使用的域账号').fill('local.domain');
  await dialog.getByRole('button', { name: '保存', exact: true }).click();
  await expect(list.getByText('local-tester', { exact: true })).toBeVisible();
  await expect(list.getByText('local.domain', { exact: true })).toBeVisible();
  await expect(localCount).toHaveText('2');
  expect(await page.evaluate(() => (window as any).savedDept)).toBe('9007199254740993');
  await list.getByRole('row').filter({ hasText: 'local-tester' }).getByRole('button', { name: '员工详情' }).click();
  const details = page.getByRole('dialog', { name: '员工详情' });
  await details.getByRole('tab', { name: '申请与证书' }).click();
  await expect(details.getByText('108', { exact: true })).toBeVisible();
  await details.getByRole('button', { name: '员工证书制作' }).click();
  expect(await page.evaluate(() => (window as any).lastEmployeePush.query)).toMatchObject({ employeeId: '25', identityKey: 'local-identity-23' });
  await details.getByRole('button', { name: '发起标准证书申请' }).click();
  expect(await page.evaluate(() => (window as any).lastEmployeePush.query)).toMatchObject({ employeeId: '25' });
  await details.getByRole('tab', { name: '办理状态' }).click();
  await expect(details.getByRole('button', { name: '管理本地账号' })).toBeVisible();
  await page.keyboard.press('Escape');
  await list.getByRole('row').filter({ hasText: 'local-no-domain' }).getByRole('button', { name: '员工详情' }).click();
  await details.getByRole('tab', { name: '申请与证书' }).click();
  await expect(details.getByRole('button', { name: '员工证书制作' })).toHaveCount(0);
  await details.getByRole('button', { name: '发起标准证书申请' }).click();
  expect(await page.evaluate(() => (window as any).lastEmployeePush.query)).toMatchObject({ applicantId: '24' });
  await page.keyboard.press('Escape');
  await page.getByRole('treeitem', { name: '大众测试科室', exact: true }).click();
  await expect(list.getByText('local-tester', { exact: true })).toHaveCount(0);
  await expect(list.getByText('同步员工甲', { exact: true })).toBeVisible();
  await page.getByRole('treeitem', { name: '全部部门', exact: true }).click();
  await expect(list.getByText('local-tester', { exact: true })).toBeVisible();

  await page.evaluate(() => { (window as any).largeDirectory = true; });
  await pager.getByRole('button', { name: '20条/页' }).click();
  const rows = list.locator('tr.el-table__row');
  await expect(rows).toHaveCount(20);
  await expect(rows.last()).toContainText('批量员工20');
  expect(await page.locator('.org-panel').evaluate((org) => {
    const employees = document.querySelector('.employee-panel')!.getBoundingClientRect();
    return Math.abs(org.getBoundingClientRect().bottom - employees.bottom);
  })).toBeLessThanOrEqual(1);
  for (const viewport of [{ width: 1360, height: 900 }, { width: 980, height: 660 }]) {
    await page.setViewportSize(viewport);
    await page.evaluate(() => { window.scrollTo(0, 0); });
    expect((await rows.last().boundingBox())!.y).toBeGreaterThan(viewport.height);
    const body = list.locator('.el-scrollbar__wrap').first();
    expect(await body.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await pager.scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await expect(rows.last()).toBeInViewport();
    await expect(pager).toBeInViewport();
    const lastRow = (await rows.last().boundingBox())!;
    expect((await pager.boundingBox())!.y).toBeGreaterThanOrEqual(lastRow.y + lastRow.height - 1);
  }
});

test('department paging preserves large IDs, indentation and the current page bounds', () => {
  type Department = { id: string; children?: Department[] };
  const rootId = '9007199254740993';
  const tree = shallowRef<Department[]>([{ id: rootId, children: Array.from({ length: 5000 }, (_, id) => ({ id: String(id) })) }]);
  const { rows, total, page, toggle, reset, toggleAll } = usePagedDepartmentTree(tree, (row) => row.id);
  expect(rows.value.map((row) => row.id)).toEqual([rootId]);
  toggle(rootId);
  expect(total.value).toBe(5001);
  expect(rows.value).toHaveLength(50);
  expect(rows.value[1]).toMatchObject({ id: '0', depth: 1 });
  page.value = 101;
  expect(rows.value.map((row) => row.id)).toEqual(['4999']);
  toggle(rootId);
  expect(page.value).toBe(1);
  reset(true);
  expect(total.value).toBe(5001);
  toggleAll();
  expect(total.value).toBe(1);
});

test('department bounds mounted rows and opens scoped applicants', async ({ page }) => {
  const root = new URL('../', import.meta.url);
  const transpile = (source: string) => ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const component = (filename: string) => {
    const { descriptor } = parse(readFileSync(new URL(filename, root), 'utf8'), { filename });
    const script = compileScript(descriptor, { id: filename });
    const template = compileTemplate({ source: descriptor.template!.content, filename, id: filename, compilerOptions: { bindingMetadata: script.bindings } });
    expect(template.errors).toEqual([]);
    const js = transpile(script.content + '\n' + template.code);
    return `(() => { const module={exports:{}},exports=module.exports; ${js}; module.exports.default.render=exports.render; return module.exports.default; })()`;
  };
  component('src/views/system/dept/index.vue');
  const treeHook = transpile(readFileSync(new URL('src/hooks/usePagedDepartmentTree.ts', root), 'utf8'));
  await page.setViewportSize({ width: 1280, height: 850 });
  await page.setContent('<div id="app"></div>');
  const modules = new URL('node_modules/', root);
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  for (const asset of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js']) {
    await page.addScriptTag({ path: fileURLToPath(new URL(asset, modules)) });
  }
  await page.addScriptTag({ content: `
    const {computed,ref,reactive,toRefs,onMounted,watch,nextTick,getCurrentInstance}=Vue;
    const parseTime=value=>value;
    const employeeDirectoryPath='/ra-employees/ra-employee', userPath='/ra-user/users', deptId='9007199254740993';
    const route=Vue.reactive({path:'/ra-dept/departments',query:{},meta:{}});
    const router={getRoutes:()=>[{path:employeeDirectoryPath,meta:{}},{path:userPath,meta:{fawvwApplicantDirectory:true}}],
      push:async target=>{window.lastPush=target;route.path=target.path;route.query=target.query;route.meta={fawvwApplicantDirectory:target.path===userPath};}};
    const department={id:deptId,name:'设备保障部',sort:1,children:Array.from({length:5000},(_,i)=>({id:String(i+1),name:'科室'+i,sort:i}))};
    const applicant={id:'5017',username:'employee-applicant',userCategory:'individual',deptName:department.name,status:0};
    const api={listDeptTree:async()=>({data:[department]}),listDeptSelectTree:async()=>({data:[{...department,children:[]}]}),
      listUser:async query=>{window.lastApplicantQuery=query;return {data:{records:[applicant],total:1}};},
      getUser:async()=>({data:applicant}),getFawvwEmployeeIdByApplicant:async id=>{window.lastApplicantId=id;return {data:'45'};}};
    const departmentPaging=(()=>{const exports={},require=()=>Vue;${treeHook};return exports;})();
    const require=name=>name==='vue'?Vue:name==='vue-router'?{useRoute:()=>route,useRouter:()=>router}:
      name==='@/hooks/usePagedDepartmentTree'?departmentPaging:
      name==='@/store/modules/user'?{useUserStore:()=>({permissions:[]})}:
      name==='@/api/ra/dept/types'?{raDepartmentIsWritable:()=>true,writableRaDepartments:rows=>rows}:
      name==='@/hooks/useRaListRefreshOnReturn'?{useRaListRefreshOnReturn(){}}:
      name==='@/plugins/auth'?{default:{hasPermi:()=>true}}:name.endsWith('/fawvwEmployeeNavigation')?
      {employeeDirectoryPath,applicantDirectoryPath:()=>userPath,directoryQueryId:value=>typeof value==='string'?value:undefined}:api;
    const Dept=${component('src/views/ra/dept/index.vue')}, User=${component('src/views/ra/user/index.vue')};
    const app=Vue.createApp({setup:()=>()=>Vue.h(route.path===userPath?User:Dept)}).use(ElementPlus);
    app.config.globalProperties.animate={searchAnimate:{enter:'',leave:''}};
    app.config.globalProperties.useDict=()=>({sys_common_status:[]});
    app.config.globalProperties.parseTime=parseTime;
    app.component('RightToolbar',{template:'<span />'});app.component('Pagination',{template:'<span />'});
    app.directive('hasPermi',{});app.mount('#app');` });
  const rows = page.locator('.el-table__body tbody tr');
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: '展开下级部门' }).click();
  await expect(rows).toHaveCount(50);
  await page.getByRole('button', { name: '折叠下级部门' }).click();
  await expect(rows).toHaveCount(1);
  await page.getByRole('button', { name: '申请用户', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).lastApplicantQuery?.deptId)).toBe('9007199254740993');
  await page.getByRole('button', { name: '申请用户详情' }).click();
  const detail = page.getByRole('dialog', { name: '申请用户详情' });
  await expect(detail.getByText('设备保障部', { exact: true })).toBeVisible();
  await detail.getByRole('button', { name: '查看关联员工' }).click();
  expect(await page.evaluate(() => (window as any).lastApplicantId)).toBe('5017');
  expect(await page.evaluate(() => (window as any).lastPush)).toMatchObject({ path: '/ra-employees/ra-employee', query: { employeeId: '45' } });
});
