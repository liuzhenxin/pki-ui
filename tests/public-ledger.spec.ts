import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import ts from 'typescript';
import { publicCertDomainRequired, publicCertUsageError, selectCertificateMaintainer } from '../src/utils/publicCertForm';

test.use({ channel: process.env.PLAYWRIGHT_CHANNEL });

const read = (name: string) => readFileSync(new URL(`../src/views/ra/${name}`, import.meta.url), 'utf8');

test('ledger forms and shared employee and usage selectors compile', () => {
  for (const name of ['intranet-cert/index.vue', 'public-cert/index.vue', 'public-cert/self.vue', 'public-cert/EmployeeSelect.vue', 'public-cert/UsageTable.vue']) {
    const { descriptor, errors } = parse(read(name), { filename: name });
    expect(errors).toEqual([]);
    const script = compileScript(descriptor, { id: name });
    expect(compileTemplate({ source: descriptor.template!.content, filename: name, id: name,
      compilerOptions: { bindingMetadata: script.bindings } }).errors).toEqual([]);
  }
});

test('only mobile certificate types allow missing domains and usage rows require selected owners', () => {
  for (const type of ['IOS', 'ANDROID', 'HARMONY']) expect(publicCertDomainRequired(type)).toBe(false);
  for (const type of ['SINGLE_DOMAIN', 'WILDCARD_DOMAIN', 'MULTI_DOMAIN', 'CUSTOM']) expect(publicCertDomainRequired(type)).toBe(true);
  expect(publicCertUsageError([])).toBeTruthy();
  expect(publicCertUsageError([{ systemName: 'System' }])).toBeTruthy();
  expect(publicCertUsageError([{ systemName: 'System', businessOwnerEmployeeId: 1 }])).toBeUndefined();
  const form: any = { businessOwnerEmail: 'old@example.invalid', departmentName: 'Old' };
  selectCertificateMaintainer(form, { id: 2, cnName: 'Current', domainAccount: 'current', email: 'new@example.invalid', departmentName: 'New' });
  expect(form.businessOwnerEmail).toBe('new@example.invalid');
  expect(form.departmentName).toBe('New');
});

test('editing then creating a ledger never retains old record or source IDs', () => {
  for (const name of ['intranet-cert/index.vue', 'public-cert/index.vue', 'public-cert/self.vue']) {
    const source = read(name);
    const body = source.slice(source.indexOf('function resetForm()'), source.indexOf('\n}', source.indexOf('function resetForm()')) + 2);
    const code = ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const form = { id: 4, sourceCertId: 10, applicantEmployeeId: 1 };
    new Function('form', 'emptyForm', 'formRef', 'pendingAttachments', 'formAttachments', 'originalRecorder', code + '; resetForm();')(
      form, () => ({ domainName: '', usages: [] }), { value: { clearValidate() {} } }, {}, {}, { value: undefined }
    );
    expect(form).not.toHaveProperty('id');
    expect(form).not.toHaveProperty('sourceCertId');
    expect(form).not.toHaveProperty('applicantEmployeeId');
  }
});

test('attachment retry keeps the saved ledger ID and does not resubmit accepted files', async () => {
  const source = read('public-cert/index.vue');
  const method = source.slice(source.indexOf('async function submitForm('), source.indexOf('async function handleRemove('));
  const code = ts.transpileModule(method, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const form: any = {};
  const pending = { value: [{ uid: 1, raw: { name: 'one.zip' } }, { uid: 2, raw: { name: 'two.zip' } }] };
  const calls: string[] = [];
  let fail = true;
  const submit = new Function('form', 'pendingAttachments', 'savePublicCert', 'uploadPublicCertAttachment', `
    const formRef = {value: {validate: async () => true}}, saving = {}, formOpen = {}, formAttachments = {value: []};
    const unwrap = x => x, beforeUpload = () => true, loadList = () => {};
    const ElMessage = { success() {} };
    ${code}
    return submitForm;
  `)(form, pending, async (payload: any) => { calls.push(`save:${payload.id || 'new'}`); return { cert: { id: 9 } }; },
    async (_id: number, file: File) => { if (file.name === 'two.zip' && fail) throw new Error('upload failed'); calls.push(`upload:${file.name}`); return {}; });
  await expect(submit()).rejects.toThrow('upload failed');
  expect(form.id).toBe(9);
  expect(pending.value.map((file) => file.uid)).toEqual([2]);
  fail = false;
  await submit();
  expect(calls).toEqual(['save:new', 'upload:one.zip', 'save:9', 'upload:two.zip']);
  expect(source).not.toContain('submitPublicCert');
});

function browserComponent(name: string) {
  const { descriptor } = parse(read(`public-cert/${name}.vue`));
  const script = compileScript(descriptor, { id: name });
  const template = compileTemplate({ source: descriptor.template!.content, filename: `${name}.vue`, id: name,
    compilerOptions: { bindingMetadata: script.bindings } });
  const code = ts.transpileModule(script.content + '\n' + template.code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  return `(function(){ const module={exports:{}}; const exports=module.exports;
    const require=name => name==='vue'? Vue : name==='element-plus'? ElementPlus : {__esModule:true,default:window.LedgerEmployeeSelect};
    ${code}; module.exports.default.render=module.exports.render; return module.exports.default; })()`;
}

for (const width of [1280, 390]) {
  test(`usage table remains editable and scrollable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 780 });
    await page.setContent('<div id="app"></div>');
    const root = new URL('../node_modules/', import.meta.url);
    await page.addStyleTag({ path: fileURLToPath(new URL('element-plus/dist/index.css', root)) });
    await page.addScriptTag({ path: fileURLToPath(new URL('vue/dist/vue.global.prod.js', root)) });
    await page.addScriptTag({ path: fileURLToPath(new URL('element-plus/dist/index.full.min.js', root)) });
    await page.addScriptTag({ content: `window.LedgerEmployeeSelect=${browserComponent('EmployeeSelect')}; window.LedgerUsageTable=${browserComponent('UsageTable')};
      const rows=Vue.ref([{systemName:'',usageDomain:'a.invalid\\nb.invalid',usageScene:'Intranet'}]); window.ledgerRows=rows;
      Vue.createApp({components:{UsageTable:window.LedgerUsageTable},setup(){return {rows,lookup:async()=>[{id:1,cnName:'Current',domainAccount:'current',departmentName:'Dept'}]}},
      template:'<UsageTable v-model="rows" :lookup="lookup" />'}).use(ElementPlus).mount('#app');` });
    await page.getByPlaceholder('必填', { exact: true }).fill('Portal');
    await page.getByRole('combobox').fill('current');
    await page.getByRole('option', { name: 'Current (current)' }).click();
    await expect.poll(() => page.evaluate(() => (window as any).ledgerRows.value[0].businessOwnerEmployeeId)).toBe(1);
    await page.getByPlaceholder('必填', { exact: true }).click();
    await expect(page.getByRole('option', { name: 'Current (current)' })).toBeHidden();
    if (width < 800) {
      const scroll = page.locator('.el-table__body-wrapper .el-scrollbar__wrap');
      expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
      await scroll.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
    }
    await page.screenshot({ path: testInfo.outputPath('usage-table.png') });
  });
}
