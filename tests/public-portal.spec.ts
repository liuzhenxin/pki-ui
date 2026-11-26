import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, compileScript, compileTemplate, compileStyle } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as sass from 'sass';
import { certificateExpiryText, effectivePortalIdleMinutes, publicNoticeStatus } from '../src/utils/publicCertForm';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });
const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const transpile = (source: string) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;

test('expiry displays real day counts and queue states never claim final delivery', () => {
  const now = Date.parse('2030-01-01T00:00:00Z');
  expect(certificateExpiryText('2030-01-03T00:00:00Z', now)).toBe('剩余 2 天');
  expect(certificateExpiryText('2029-12-29T00:00:00Z', now)).toBe('已过期 3 天');
  expect(certificateExpiryText(undefined, now)).toContain('未填写');
  expect(certificateExpiryText('2030-01-01 09:30:00', Date.parse('2030-01-01T09:00:00'))).toBe('今天到期');
  expect(certificateExpiryText('2030-01-01 08:30:00', Date.parse('2030-01-01T09:00:00'))).toBe('今天已过期');
  expect(publicNoticeStatus(0)).toBe('待发送');
  expect(publicNoticeStatus(1)).toBe('接口已受理');
  expect(publicNoticeStatus(4)).toBe('结果未知');
});

test('employee sessions use the administrator idle timeout', () => {
  expect(effectivePortalIdleMinutes(45)).toBe(45);
  expect(effectivePortalIdleMinutes(5)).toBe(5);
  expect(effectivePortalIdleMinutes(2)).toBe(30);
  expect(effectivePortalIdleMinutes()).toBe(30);
});

test('canceling the final employee distribution confirmation sends nothing', async () => {
  const source = read('src/views/ra/employee-cert/DistributionDialog.vue');
  const method = source.slice(source.indexOf('async function submit()'), source.indexOf('defineExpose('));
  const submit = new Function('ElMessageBox', 'submitEmployeeDistribution', `
    const options={value:{messageType:'MIXED',maxAttachmentBytes:10000}}, submitting={},selectedAttachments={value:[]},resetAttachments=()=>{},
      selected={ids:[1]},target={value:'Person'},visible={value:true},ElMessage={warning(){},info(){}},emit=()=>{};
    ${transpile(method)}; return submit;
  `);
  let calls = 0;
  await submit({ confirm: async () => { throw new Error('cancel'); } }, async () => calls++)();
  expect(calls).toBe(0);
  await submit({ confirm: async () => {} }, async () => calls++)();
  expect(calls).toBe(1);
});

test('expired responses identify their original session and cannot log out a newly logged-in employee', async () => {
  const api = read('src/api/ra/publicCertPortal.ts');
  const code = transpile(api.slice(api.indexOf('function unwrap<T>'), api.indexOf('const cleanQuery')));
  const events: any[] = [];
  const request = new Function('window', 'CustomEvent', `${code}; return portalRequest;`)(
    { dispatchEvent: (event: any) => events.push(event) }, class { constructor(public type: string, public options: any) { Object.assign(this, options); } }
  );
  await expect(request(Promise.resolve({ config: { headers: { 'X-FAW-VW-Portal-Token': 'old-token' } },
    data: { code: 'PUBLIC_CERT_PORTAL_INVALID', msg: '登录已失效，请重新输入域账号认证' } }))).rejects.toThrow('登录已失效');
  expect(events[0].detail.token).toBe('old-token');
  const source = read('src/views/ra/public-cert/self.vue');
  const method = transpile(source.slice(source.indexOf('function onSessionExpired('), source.indexOf('const activityEvents')));
  let resets = 0;
  const expire = new Function('portalToken', 'portalReady', 'resetPortal', 'ElMessage', `${method}; return onSessionExpired;`)(
    { value: 'new-token' }, { value: true }, () => resets++, { warning() {} }
  );
  expire(events[0]);
  expect(resets).toBe(0);
  expire({ detail: { token: 'new-token' } });
  expect(resets).toBe(1);
});

test('employee save failures remain visible and keep the form open for retry', async () => {
  const source = read('src/views/ra/public-cert/self.vue');
  const code = transpile(source.slice(source.indexOf('async function submitForm('), source.indexOf('async function handleSubmit(')));
  const messages: string[] = [];
  const form = { domainName: 'keep.invalid' }, formOpen = { value: true }, saving = { value: false };
  const submit = new Function('form', 'formOpen', 'saving', 'ElMessage', `${code};
    const formRef={value:{validate:async()=>true}}, pendingAttachments={value:[]}, portalToken={value:'same-token'},portalReady={value:true};
    const beforeUpload=()=>true, saveAndSubmitPublicCertPortal=async()=>{throw new Error('该记录已更新，请重新打开后再修改');}; return submitForm;`
  )(form, formOpen, saving, { error: (message: string) => messages.push(message) });
  await submit();
  expect(messages).toContain('该记录已更新，请重新打开后再修改');
  expect(formOpen.value).toBe(true);
  expect(form.domainName).toBe('keep.invalid');
  expect(saving.value).toBe(false);
  for (const name of ['self.vue', 'index.vue']) {
    const page = read(`src/views/ra/public-cert/${name}`);
    expect(page).toContain(':close-on-press-escape="!saving"');
    expect(page).toContain(':disabled="saving" @click="formOpen = false"');
  }
});

test('administrator creation confirms the direct ledger write and shows the expired reminder warning', async () => {
  const source = read('src/views/ra/public-cert/index.vue');
  const code = transpile(source.slice(source.indexOf('async function submitForm('), source.indexOf('async function handleRemove(')));
  const form = { domainName: 'expired.example.test' };
  const formOpen = { value: true };
  const saving = { value: false };
  const writes: unknown[] = [];
  const messages: string[] = [];
  let confirmed = false;
  const submit = new Function('form', 'formOpen', 'saving', 'writes', 'messages', 'confirm', `${code};
    const formRef={value:{validate:async()=>true}}, pendingAttachments={value:[]};
    const unwrap=x=>x, businessCertificateExpired=()=>true, loadList=()=>{};
    const ElMessageBox={confirm,alert:async message=>messages.push(message)};
    const createPublicCertLedger=async (data,files)=>{
      writes.push({data:{...data},files});
      return {cert:{id:1,version:0,notAfter:'2025-01-01 00:00:00'}};
    }; return submitForm;`
  )(form, formOpen, saving, writes, messages, async () => {
    if (!confirmed) throw new Error('cancel');
  });
  await submit();
  expect(writes).toHaveLength(0);
  expect(formOpen.value).toBe(true);
  confirmed = true;
  await submit();
  expect(writes).toEqual([{ data: { domainName: 'expired.example.test' }, files: [] }]);
  expect(messages[0]).toContain('自动通知已关闭');
  expect(formOpen.value).toBe(false);
});

test('switching the ledger and audit tabs ignores older query responses', async () => {
  const source = read('src/views/ra/public-cert/index.vue');
  const code = transpile(source.slice(source.indexOf('async function loadList('), source.indexOf('async function loadTypes(')));
  let resolveOld: (value: any) => void;
  let calls = 0;
  const rows = { value: [] }, total = { value: 0 };
  const pagePublicCerts = () => ++calls === 1 ? new Promise((resolve) => (resolveOld = resolve))
    : Promise.resolve({ records: [{ id: 2 }], total: 1 });
  const load = new Function('pagePublicCerts', 'rows', 'total', `${code};
    let listVersion=0; const loading={},queryParams={},notAfterRange={value:[]},managementTab={value:'records'},selectedRows={},noticeStates={};
    const unwrap=x=>x,getPublicNoticeStates=async()=>[],queryPayload=()=>({});return loadList;`
  )(pagePublicCerts, rows, total);
  const old = load();
  await load();
  resolveOld!({ records: [{ id: 1 }], total: 99 });
  await old;
  expect(rows.value).toEqual([{ id: 2 }]);
  expect(total.value).toBe(1);
});

test('employee portal returns to a valid page after submitting the last record on a page', async () => {
  const source = read('src/views/ra/public-cert/self.vue');
  const code = transpile(source.slice(source.indexOf('async function loadList('), source.indexOf('function handleQuery(')));
  const query = { pageNum: 3, pageSize: 10, domainName: 'example.invalid', approvalStatus: 'DRAFT' };
  const rows = { value: [{ id: 21 }] }, total = { value: 21 }, loading = { value: false };
  const requests: (typeof query)[] = [];
  const pagePublicCertPortal = async (_token: string, params: typeof query) => {
    requests.push(params);
    return { records: params.pageNum === 2 ? [{ id: 11 }] : [], total: 20 };
  };
  const load = new Function('pagePublicCertPortal', 'queryParams', 'rows', 'total', 'loading', `${code};
    let listVersion=0; const portalToken={value:'test-token'},portalReady={value:true},portalSection={value:'records'},access={value:{granted:true}};
    return loadList;`
  )(pagePublicCertPortal, query, rows, total, loading);
  await load();
  expect(requests).toEqual([{ ...query, pageNum: 3 }, { ...query, pageNum: 2 }]);
  expect(query.pageNum).toBe(2);
  expect(rows.value).toEqual([{ id: 11 }]);
  expect(total.value).toBe(20);
  expect(loading.value).toBe(false);
});

test('public certificate exports share the current tab filters and date range', () => {
  const source = read('src/views/ra/public-cert/index.vue');
  const method = transpile(source.slice(source.indexOf('function queryPayload('), source.indexOf('async function loadList(')));
  const tab = { value: 'audit' };
  const params = { approvalStatus: 'REJECTED', domainName: 'filtered.invalid' };
  const query = new Function('managementTab', 'queryParams', 'notAfterRange', `${method}; return queryPayload;`)(
    tab, params, { value: ['2030-01-01', '2030-01-31'] }
  );
  expect(query()).toMatchObject({ approvalStatus: 'PENDING', domainName: 'filtered.invalid', notAfterStart: '2030-01-01', notAfterEnd: '2030-01-31' });
  tab.value = 'records';
  expect(query().approvalStatus).toBe('APPROVED');
  tab.value = 'handled';
  expect(query().approvalStatus).toBe('REJECTED');
  params.approvalStatus = '';
  expect(query().approvalStatus).toBe('HANDLED');
  expect(source.slice(source.indexOf('async function handleExport('), source.indexOf('function onTypeChange('))).toContain('exportPublicCerts(queryPayload())');
});

function component(path: string, scoped = false) {
  const { descriptor } = parse(read(path), { filename: path });
  const script = compileScript(descriptor, { id: 'portal-proof' });
  const template = compileTemplate({ source: descriptor.template!.content, filename: path, id: 'portal-proof', scoped, compilerOptions: { bindingMetadata: script.bindings } });
  expect(template.errors).toEqual([]);
  return `(function(){const module={exports:{}};const exports=module.exports;
    const {ref,reactive,computed,onMounted,onUnmounted,watch}=Vue;
    const useRoute=()=>({query:{}}),useRouter=()=>({replace:async()=>{}});
    const require=name=>name==='vue'?Vue:name==='element-plus'?ElementPlus:name==='@element-plus/icons-vue'?ElementPlusIconsVue:
      name==='@vueuse/core'?{useMediaQuery:query=>Vue.ref(matchMedia(query).matches)}:
      name==='@/hooks/useRaListRefreshOnReturn'?{useRaListRefreshOnReturn(){}}:
      name==='@/utils/publicCertForm'?window.portalUtils:name==='@/api/ra/publicCertPortal'?window.portalApi:
      name==='@/utils/businessCertificateNotice'?{businessCertificateNoticeBlocked:()=>false,businessCertificateExpired:()=>false}:
      name==='@/api/ra/businessNoticeSettings'?window.adminApi:
      name.endsWith('/BusinessNoticeSettingsDialog.vue')?{__esModule:true,default:window.BusinessNoticeSettingsDialog}:
      name==='@/api/ra/publicCert'||name==='@/api/ra/employee'?window.adminApi:
      name==='@/plugins/auth'?{__esModule:true,default:{hasPermi:()=>true}}:
      name==='file-saver'?{__esModule:true,default:{saveAs(){}}}:
      name.endsWith('/CertRowAction.vue')?{__esModule:true,default:window.CertRowAction}:
      name.endsWith('/ManagementFrame.vue')?{__esModule:true,default:window.ManagementFrame}:
      {__esModule:true,default:name.includes('EmployeeSelect')?window.EmployeeChoice:window.UsageChoice};
    ${transpile(script.content + '\n' + template.code)}
    module.exports.default.render=module.exports.render;
    ${scoped ? "module.exports.default.__scopeId='data-v-portal-proof';" : ''}
    return module.exports.default;})()`;
}

const rowActionPath = 'src/views/ra/components/CertRowAction.vue';

test('certificate row actions show tooltips without triggering disabled actions or opening format menus on hover', async ({ page }) => {
  await page.setContent('<div id="app" style="padding: 80px"></div>');
  const modules = new URL('node_modules/', root);
  await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
  for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js', '@element-plus/icons-vue/dist/index.iife.min.js'])
    await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
  const { descriptor } = parse(read(rowActionPath));
  const style = compileStyle({ source: descriptor.styles[0].content, filename: rowActionPath, id: 'portal-proof', scoped: true });
  expect(style.errors).toEqual([]);
  await page.addStyleTag({ content: style.code });
  await page.addScriptTag({ content: `const Action=${component(rowActionPath, true)};
    window.actions=[];
    const app=Vue.createApp({template:\`
      <Action label="查看任务详情" icon="View" @click="log('detail')" />
      <Action label="执行签发" icon="Stamp" disabled @click="log('issue')" />
      <Action label="下载证书" icon="Download" @command="log">
        <template #dropdown><el-dropdown-menu><el-dropdown-item command="pem">PEM 证书</el-dropdown-item></el-dropdown-menu></template>
      </Action>\`,methods:{log(value){window.actions.push(value);}}});
    app.component('Action',Action);
    for(const [name,icon] of Object.entries(ElementPlusIconsVue))app.component(name,icon);
    app.use(ElementPlus);app.mount('#app');` });
  const detail = page.getByRole('button', { name: '查看任务详情' });
  await expect(detail).toHaveText('');
  await detail.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: '查看任务详情' })).toBeVisible();
  await detail.click();
  const issue = page.getByRole('button', { name: '执行签发' });
  await expect(issue).toBeDisabled();
  await issue.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: '执行签发' })).toBeVisible();
  await issue.evaluate((button) => (button as HTMLButtonElement).click());
  const download = page.getByRole('button', { name: '下载证书' });
  await download.hover();
  await expect(page.getByRole('tooltip').filter({ hasText: '下载证书' })).toBeVisible();
  const format = page.getByRole('menuitem', { name: 'PEM 证书' });
  await expect(format).toBeHidden();
  await download.click();
  await format.click();
  expect(await page.evaluate(() => (window as any).actions)).toEqual(['detail', 'pem']);
});

for (const width of [1440, 390]) {
  test(`public ledger audit and notice configuration at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 950 });
    await page.setContent('<div id="app"></div>');
    const modules = new URL('node_modules/', root);
    await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
    for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js', '@element-plus/icons-vue/dist/index.iife.min.js'])
      await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
    const path = 'src/views/ra/public-cert/index.vue';
    const { descriptor } = parse(read(path));
    const styles = descriptor.styles.map((style) => compileStyle({
      source: style.content, filename: path, id: 'portal-proof', scoped: style.scoped, preprocessLang: style.lang as 'scss' | undefined
    }));
    expect(styles.flatMap((style) => style.errors)).toEqual([]);
    const inlineLabelStyle = read('src/assets/styles/element-ui.scss').match(/\.el-form--inline \.el-form-item__label\s*\{[^}]+\}/)?.[0] || '';
    await page.addStyleTag({ content: 'body{margin:0;font-family:Arial,"Microsoft YaHei",sans-serif}*{box-sizing:border-box}.app-container{padding:20px}.mb8{margin-bottom:8px}' + inlineLabelStyle + styles.map((style) => style.code).join('\n') });
    const utils = transpile(read('src/utils/publicCertForm.ts'));
    await page.addScriptTag({ content: `window.portalUtils=(function(){const module={exports:{}};const exports=module.exports;${utils};return module.exports;})();
      const statuses=['APPROVED','PENDING','DRAFT','REJECTED'];
      const certs=statuses.map((status,index)=>({id:index+1,version:0,domainName:status.toLowerCase()+'.invalid',certTypeName:'Domain',businessOwnerName:'Current',notAfter:'2030-01-01 00:00:00',approvalStatus:status,certStatus:'NORMAL',reminderEnabled:true}));
      const grants=[{id:91,employeeId:5,employeeName:'Granted Employee',domainAccount:'grant-one',enabled:true}];
      window.revokedIds=[];
      window.adminApi=new Proxy({
        pagePublicCerts:async query=>{
          window.adminQuery=query;
          const records=certs.filter(cert=>query.approvalStatus==='HANDLED' ? cert.approvalStatus!=='PENDING' : cert.approvalStatus===query.approvalStatus);
          return {data:{records,total:records.length}};
        },
        getPublicNoticeStates:async()=>({data:[{id:1,emailStatus:1,dingtalkStatus:2}]}),
        listPublicCertTypes:async()=>({data:[]}),
        pagePublicCertPermissions:async query=>{
          window.grantQuery=query;
          const records=grants.filter(row=>row.domainAccount.includes(query.keyword || ''));
          return {data:{records,total:records.length}};
        },
        revokePublicCertPermission:async id=>{window.revokedIds.push(id);grants.splice(grants.findIndex(row=>row.id===id),1);},
        pageFawvwEmployees:async query=>{
          window.employeePickerQuery=query;
          const records=query.keyword ? [{id:5,cnName:'Search Employee',domainAccount:query.keyword,sourceStatus:'A'}] : [];
          return {data:{records,total:records.length}};
        },
        getPublicPortalSessionPolicy:async()=>({data:{idleMinutes:30}}),
        getPublicCertPortalConfig:async()=>({data:{requireIam:true,iamEnabled:false}}),
        getBusinessNoticeSettings:async()=>({data:{departure:false,approval:false,administrators:true,owner:true,departureIntervalDays:30,templates:[],automatic:false,email:true,dingtalk:true,days:'30,7,1,0',time:'09:00',portalUrl:'https://example.invalid/ra-public-cert',subject:'Certificate notice',emailContent:'Reminder',dingContent:'Reminder'}})
      },{get:(target,key)=>target[key]||(()=>Promise.resolve({data:[]}))});
      window.EmployeeChoice=${component('src/views/ra/public-cert/EmployeeSelect.vue')};window.UsageChoice=${component('src/views/ra/public-cert/UsageTable.vue')};
      window.CertRowAction=${component(rowActionPath)};
      window.BusinessNoticeSettingsDialog=${component('src/views/ra/components/BusinessNoticeSettingsDialog.vue')};
      const app=Vue.createApp(${component(path, true)}); app.component('Pagination',{template:'<div />'});app.component('RightToolbar',{template:'<div />'});
      for(const [name,icon] of Object.entries(ElementPlusIconsVue))app.component(name,icon);
      app.directive('hasPermi',{});app.use(ElementPlus);app.mount('#app');` });
    const expectOwnerLabelAligned = async () => {
      const owner = page.locator('.public-cert-query .el-form-item').filter({ hasText: '证书维护人' });
      await expect(owner).toBeVisible();
      expect(await owner.evaluate((item, narrow) => {
        const label = item.querySelector('.el-form-item__label')!;
        const range = document.createRange();
        range.selectNodeContents(label);
        const [text] = Array.from(range.getClientRects());
        const field = item.querySelector('input')!.getBoundingClientRect();
        return range.getClientRects().length === 1 && (narrow
          ? text.bottom <= field.top + 1
          : text.right <= field.left && text.top >= field.top && text.bottom <= field.bottom);
      }, width <= 560)).toBe(true);
    };
    await expectOwnerLabelAligned();
    await expect(page.getByRole('button', { name: '通过选中' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增草稿' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增', exact: true })).toBeVisible();
    await expect(page.getByText('approved.invalid', { exact: true })).toBeVisible();
    await expect(page.getByText(/pending\.invalid|draft\.invalid|rejected\.invalid/)).toHaveCount(0);
    await page.getByRole('tab', { name: '审核中心' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).adminQuery?.approvalStatus)).toBe('PENDING');
    await expectOwnerLabelAligned();
    await expect(page.getByRole('button', { name: '通过选中' })).toBeVisible();
    await expect(page.getByRole('button', { name: '新增草稿' })).toHaveCount(0);
    await expect(page.getByText('pending.invalid', { exact: true })).toBeVisible();
    await expect(page.getByText(/approved\.invalid|draft\.invalid|rejected\.invalid/)).toHaveCount(0);
    for (const name of ['证书类型', '录入授权', '通知设置']) {
      await expect(page.getByRole('button', { name, exact: true })).toHaveCount(0);
    }
    await page.getByRole('tab', { name: '已办记录' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).adminQuery?.approvalStatus)).toBe('HANDLED');
    for (const status of ['approved', 'draft', 'rejected']) {
      await expect(page.getByText(`${status}.invalid`, { exact: true })).toBeVisible();
    }
    await expect(page.getByText('pending.invalid', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '新增', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '通过选中' })).toHaveCount(0);
    await page.getByRole('tab', { name: '证书台账' }).click();
    await page.getByRole('button', { name: '通知设置', exact: true }).click();
    await expect(page.getByRole('dialog', { name: '证书通知设置' })).toBeVisible();
    await expect(page.getByText('提前提醒天数', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath('admin-notices.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('dialog', { name: '证书通知设置' }).getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('button', { name: '录入授权', exact: true }).click();
    const grants = page.getByRole('dialog', { name: '证书录入授权' });
    const policy = grants.getByRole('region', { name: '自助登录策略' });
    await expect(policy.getByRole('spinbutton', { name: '登录空闲超时（分钟）' })).toHaveValue('30');
    await expect(policy.getByRole('switch', { name: 'IAM 登录认证' })).toBeChecked();
    expect(await policy.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
    await grants.screenshot({ path: info.outputPath('admin-authorization.png'), animations: 'disabled' });
    if (width === 1440) {
      const keyword = grants.getByPlaceholder('姓名/域账号', { exact: true });
      await keyword.fill('grant-one');
      await keyword.press('Enter');
      await expect.poll(() => page.evaluate(() => (window as any).grantQuery?.keyword)).toBe('grant-one');
      await grants.getByRole('button', { name: '新增授权' }).click();
      const picker = page.getByRole('dialog', { name: '选择员工' });
      const employeeKeyword = picker.getByPlaceholder('姓名/域账号/工号', { exact: true });
      await employeeKeyword.fill('search-one');
      await employeeKeyword.press('Enter');
      await expect(picker.getByText('search-one', { exact: true })).toBeVisible();
      await employeeKeyword.fill('search-two');
      await picker.getByRole('button', { name: '搜索', exact: true }).click();
      await expect(picker.getByText('search-two', { exact: true })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(picker).toBeHidden();
      const remove = grants.getByRole('button', { name: '移除授权' });
      await remove.click();
      const confirm = page.getByRole('dialog', { name: '移除录入授权' });
      await expect(confirm).toContainText('Granted Employee');
      await page.keyboard.press('Escape');
      await expect(confirm).toBeHidden();
      expect(await page.evaluate(() => (window as any).revokedIds)).toEqual([]);
      await remove.click();
      await confirm.locator('.el-button--primary').click();
      await expect(grants.getByText('Granted Employee', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).revokedIds)).toEqual([91]);
    }
  });
}

for (const width of [1280, 834, 390]) {
  for (const authenticated of [false, true]) {
    test(`portal ${authenticated ? 'workspace' : 'login'} at ${width}px`, async ({ page }, info) => {
      await page.setViewportSize({ width, height: 850 });
      if (authenticated) await page.clock.install();
      await page.route('http://portal.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<div id="app"></div>' }));
      await page.goto('http://portal.test');
      const modules = new URL('node_modules/', root);
      await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', modules)) });
      for (const file of ['vue/dist/vue.global.prod.js', 'element-plus/dist/index.full.min.js', '@element-plus/icons-vue/dist/index.iife.min.js'])
        await page.addScriptTag({ path: fileURLToPath(new URL(file, modules)) });
      const { descriptor } = parse(read('src/views/ra/public-cert/self.vue'));
      const style = compileStyle({ source: descriptor.styles[0].content, filename: 'self.vue', id: 'portal-proof', scoped: true, preprocessLang: 'scss' });
      expect(style.errors).toEqual([]);
      const layoutStyle = sass.compile(fileURLToPath(new URL('src/assets/styles/sidebar.scss', root))).css;
      await page.addStyleTag({ content: 'body{margin:0;font-family:Arial,"Microsoft YaHei",sans-serif;box-sizing:border-box}*{box-sizing:border-box}' + layoutStyle + style.code });
      const utils = transpile(read('src/utils/publicCertForm.ts'));
      await page.addScriptTag({ content: `window.portalUtils=(function(){const module={exports:{}};const exports=module.exports;${utils};return module.exports;})();
        const baseCert={certTypeName:'Domain',notAfter:'2030-01-01 00:00:00',certStatus:'NORMAL'};
        const portalRows=[
          {...baseCert,id:1,domainName:'rejected.invalid\\nalt.rejected.invalid',serialNumber:'FAW-123',issuer:'Test CA',vendor:'Test Vendor',
            businessOwnerName:'Test Maintainer',businessOwnerEmail:'maintainer@example.invalid',departmentName:'Test Department',businessOwnerAccount:'employee1',
            remark:'First line\\nSecond line',approvalStatus:'REJECTED',approvalComment:'请补充证书压缩包。\\n域名需要和附件中的证书一致。'},
          {...baseCert,id:2,domainName:'pending.invalid',approvalStatus:'PENDING',approvalComment:'不应展示的旧驳回原因'},
          {...baseCert,id:3,domainName:'approved.invalid',approvalStatus:'APPROVED',approvalComment:'已核对证书附件。'},
          {...baseCert,id:4,domainName:'draft.invalid',approvalStatus:'DRAFT'}
        ];
        window.portalApi={
          startPublicCertPortalIam:async(account,callback)=>({iamEnabled:true,authorizeUrl:'/iam-authorize?'+new URLSearchParams({account,callback})}),
          getPublicCertPortalAccess:async()=>({granted:true,employeeName:'Test',domainAccount:'employee1',idleMinutes:30}),
          listPublicCertPortalTypes:async()=>[],
          searchPublicCertPortalEmployees:async()=>[],
          getPublicCertPortal:async(_token,id)=>({cert:portalRows.find(row=>row.id===id),recorderDisplay:'Original-user2',
            usages:[{systemName:'Usage System',businessOwnerName:'System Owner',usageDomain:'usage.invalid',usageScene:'Test Scene'}],
            attachments:[{id:1,originalName:'certificates.zip',fileSize:1024}],auditLogs:[
              {id:3,action:'REJECT',operatorName:'reviewer',createTime:'2026-11-16T14:00:00'},
              {id:2,action:'UPDATE',operatorName:'maintainer1',createTime:'2026-11-16T13:00:00'},
              {id:1,action:'UPDATE',operatorName:'earlier-editor',createTime:'2026-11-16T12:00:00'}
            ]}),
          pagePublicCertPortal:async(_token,query)=>{
            window.lastPortalQuery=query;
            const groups={RECORDS:['DRAFT','APPROVED'],TODO:['PENDING','REJECTED']};
            const statuses=groups[query.approvalStatus] || [query.approvalStatus];
            const records=portalRows.filter(row=>statuses.includes(row.approvalStatus));
            return {records,total:records.length};
          }
        };
        ${authenticated ? "sessionStorage.setItem('fawvw-public-cert-portal-token','test-token');sessionStorage.setItem('fawvw-public-cert-idle:employee1','5');" : ''}
        window.EmployeeChoice=${component('src/views/ra/public-cert/EmployeeSelect.vue')};
        window.UsageChoice=${component('src/views/ra/public-cert/UsageTable.vue')};
        window.ManagementFrame=${component('src/layout/components/ManagementFrame.vue')};
        const app=Vue.createApp(${component('src/views/ra/public-cert/self.vue', true)});
        for(const [name,icon] of Object.entries(ElementPlusIconsVue))app.component(name,icon);
        app.component('Pagination',{template:'<div />'});app.use(ElementPlus);app.mount('#app');` });
      await expect(page.getByRole('heading', { name: '证书统一管理', exact: true })).toBeVisible();
      if (authenticated) {
        const selectSection = async (name: string) => {
          if (width <= 960) await page.getByRole('button', { name: '切换菜单' }).click();
          await page.getByRole('menuitem', { name }).click();
        };
        const reviewTags = page.locator('.portal-review-cell .el-tag');
        await expect(reviewTags.filter({ hasText: '草稿' })).toBeVisible();
        await expect(reviewTags.filter({ hasText: '已通过' })).toHaveClass(/el-tag--success/);
        await expect(reviewTags.filter({ hasText: /已驳回|待审核/ })).toHaveCount(0);
        await expect(page.locator('.portal-count')).toHaveText('共 2 条');
        const ledger = page.getByRole('region', { name: '录入信息' });
        await expect(ledger.getByRole('heading', { name: '录入记录' })).toBeVisible();
        await expect(ledger).toHaveCSS('border-radius', '10px');
        const search = ledger.getByRole('button', { name: '搜索' });
        await expect(search).toBeInViewport();
        await ledger.getByPlaceholder('请输入域名').fill('approved.invalid');
        await search.click();
        await expect.poll(() => page.evaluate(() => (window as any).lastPortalQuery?.domainName)).toBe('approved.invalid');
        await ledger.getByRole('button', { name: '重置' }).click();
        await expect(ledger.getByPlaceholder('请输入域名')).toHaveValue('');
        await expect(ledger.getByRole('columnheader', { name: '域名 / 审核结果' })).toBeInViewport();
        if (width <= 960) {
          await expect(ledger.getByRole('columnheader', { name: '证书类型' })).toHaveCount(0);
          await expect(ledger.getByRole('row').filter({ hasText: 'approved.invalid' }).locator('.portal-review-meta')).toContainText('2030-01-01');
          const actions = ledger.getByRole('row').filter({ hasText: 'draft.invalid' }).locator('.portal-row-actions button');
          await expect(actions).toHaveCount(3);
          expect(await actions.evaluateAll((buttons) => new Set(buttons.map((button) => button.getBoundingClientRect().top)).size)).toBe(1);
        } else {
          await expect(ledger.getByRole('columnheader', { name: '证书类型' })).toBeInViewport();
          const navigation = page.locator('.portal-sidebar');
          await expect(navigation).toHaveCSS('background-color', 'rgb(255, 255, 255)');
          await expect(navigation.getByRole('menuitem', { name: '录入信息' })).toHaveCSS('color', 'rgb(43, 100, 126)');
        }
        await expect(page.getByRole('button', { name: '账户菜单' })).toContainText('employee1');
        await page.screenshot({ path: info.outputPath('records-workspace.png'), fullPage: true, animations: 'disabled' });
        await selectSection('待办详情');
        await expect(reviewTags.filter({ hasText: '已驳回' })).toHaveClass(/el-tag--danger/);
        await expect(reviewTags.filter({ hasText: '待审核' })).toHaveClass(/el-tag--warning/);
        await expect(reviewTags.filter({ hasText: /草稿|已通过/ })).toHaveCount(0);
        await expect(page.locator('.portal-count')).toHaveText('共 2 条');
        await expect(page.getByText('不应展示的旧驳回原因')).toHaveCount(0);
        const rejection = page.getByRole('button', { name: '查看驳回原因' });
        await expect(rejection).toBeInViewport();
        await expect(rejection).toContainText('请补充证书压缩包');
        await rejection.click();
        const detailDrawer = page.getByRole('dialog', { name: '证书详情' });
        await expect(detailDrawer.locator('.portal-recorder')).toHaveText([
          '录入人：Original-user2', '修改人：maintainer1', '修改时间：2026-11-16 13:00:00'
        ]);
        await expect(detailDrawer.getByRole('alert')).toHaveClass(/el-alert--error/);
        await expect(detailDrawer.getByRole('alert')).toContainText('域名需要和附件中的证书一致');
        for (const [label, value] of [
          ['证书类型', 'Domain'], ['证书序列号', 'FAW-123'], ['颁发机构', 'Test CA'], ['供应商', 'Test Vendor'],
          ['有效期止', '2030-01-01 00:00:00'], ['证书维护人', 'Test Maintainer'], ['维护人邮箱', 'maintainer@example.invalid'],
          ['科室', 'Test Department'], ['维护人账号', 'employee1'], ['录入说明', 'First line Second line']
        ]) {
          await expect(detailDrawer.getByRole('row').filter({ hasText: label })).toContainText(value);
        }
        const domains = detailDrawer.getByText('rejected.invalid alt.rejected.invalid', { exact: true });
        await expect(domains).toHaveCSS('white-space', 'pre-line');
        await expect(detailDrawer.getByRole('row').filter({ hasText: 'Usage System' })).toContainText('usage.invalid');
        await expect(detailDrawer.getByRole('row').filter({ hasText: 'certificates.zip' })).toBeVisible();
        await page.screenshot({ path: info.outputPath('rejected-review.png'), animations: 'disabled' });
        await page.keyboard.press('Escape');
        await expect(detailDrawer).toBeHidden();
        await page.getByRole('row').filter({ hasText: 'rejected.invalid' }).getByRole('button', { name: '修改' }).click();
        const editDrawer = page.getByRole('dialog', { name: '修改证书录入' });
        await expect(editDrawer.locator('.portal-recorder')).toHaveText('录入人：Original-user2');
        await expect(editDrawer.getByRole('alert')).toContainText('请补充证书压缩包');
        await expect(editDrawer.getByRole('button', { name: '保存并提交' })).toBeVisible();
        await editDrawer.getByRole('button', { name: '取消' }).click();
        await expect(editDrawer).toBeHidden();
        await selectSection('录入信息');
        await page.getByRole('button', { name: '新增录入' }).click();
        const drawer = page.getByRole('dialog', { name: '新增证书录入' });
        await expect(drawer).toBeVisible();
        await expect(drawer.locator('.portal-recorder')).toHaveText('录入人：Test-employee1');
        await expect(drawer.getByText(/请先将证书打包为 ZIP 或 RAR 压缩包/)).toBeVisible();
        await drawer.getByLabel('颁发机构', { exact: true }).fill('   ');
        await expect(drawer.getByRole('button', { name: '保存草稿' })).toHaveCount(0);
        await drawer.getByRole('button', { name: '保存并提交' }).click();
        await expect(drawer.getByText('请输入颁发机构', { exact: true })).toBeVisible();
        await expect(drawer.getByText('请输入供应商', { exact: true })).toBeVisible();
        await expect(drawer.getByText('请补充证书压缩包。', { exact: false })).toHaveCount(0);
        await drawer.getByRole('button', { name: '取消' }).click();
        await expect(drawer).toBeHidden();
        await page.getByRole('button', { name: '账户菜单' }).click();
        await expect(page.getByRole('menuitem', { name: '退出登录' })).toBeVisible();
        await expect(page.getByRole('menuitem', { name: '登录设置' })).toHaveCount(0);
        await page.keyboard.press('Escape');
        await selectSection('待办详情');
        if (width > 960) await expect(page.getByRole('menuitem', { name: '待办详情' })).toHaveClass(/is-active/);
        await expect.poll(() => page.evaluate(() => (window as any).lastPortalQuery?.approvalStatus)).toBe('TODO');
        await expect(page.getByLabel('当前位置')).toContainText('待办详情');
        await expect(page.getByRole('button', { name: '新增录入' })).toHaveCount(0);
        await expect(page.getByRole('columnheader', { name: '使用系统', exact: true })).toHaveCount(0);
        await expect(page.getByText(/剩余 \d+ 天/).first()).toBeVisible();
      } else {
        await expect(page.locator('.portal-login-brand-logo')).toHaveText('RA');
        await expect(page.locator('.portal-login-copy')).toContainText('证书统一管理');
        await expect(page.locator('.portal-login-copy')).toContainText('统一管理录入证书有效期');
        await expect(page.locator('.portal-login-title')).toContainText('输入您的账户信息以进入统一证书管理');
        await expect(page.locator('.portal-login-mode')).toHaveText('账号登录');
        await expect(page.getByRole('textbox', { name: '当前系统' })).toHaveValue('证书统一管理');
        await expect(page.getByRole('textbox', { name: '域账号' })).toHaveAttribute('placeholder', '请输入域账号');
        await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
        await expect(page.locator('.portal-login-visual')).toBeVisible();
        for (const label of ['证书登录', '验证码', '记住我', '加密传输', '版本信息']) {
          await expect(page.getByText(label, { exact: false })).toHaveCount(0);
        }
        await expect(page.getByRole('textbox', { name: '密码' })).toHaveCount(0);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
      await page.screenshot({ path: info.outputPath('portal.png'), fullPage: true, animations: 'disabled' });
      if (authenticated) {
        await page.clock.fastForward(10 * 60_000);
        await expect(page.getByRole('heading', { name: '待办详情' })).toBeVisible();
        await page.clock.fastForward(20 * 60_000 + 1000);
        await expect(page.getByRole('button', { name: '登录', exact: true })).toBeVisible();
        expect(await page.evaluate(() => sessionStorage.getItem('fawvw-public-cert-portal-token'))).toBeNull();
      } else {
        const account = page.getByRole('textbox', { name: '域账号' });
        await account.fill('employee1');
        await account.press('Enter');
        await expect(page).toHaveURL(/\/iam-authorize\?/);
        expect(Object.fromEntries(new URL(page.url()).searchParams)).toEqual({ account: 'employee1', callback: 'http://portal.test/ra-public-cert' });
      }
    });
  }
}
