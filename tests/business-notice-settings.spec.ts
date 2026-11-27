import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { compileScript, compileTemplate, parse } from '@vue/compiler-sfc';
import ts from 'typescript';
import * as vue from 'vue';

test('business notification settings keep module values and templates isolated', async () => {
  const filename = 'src/views/ra/components/BusinessNoticeSettingsDialog.vue';
  const { descriptor, errors } = parse(readFileSync(filename, 'utf8'), { filename });
  expect(errors).toEqual([]);
  const compiled = compileScript(descriptor, { id: 'notice-settings' });
  expect(compileTemplate({ source: descriptor.template!.content, filename, id: 'notice-settings',
    compilerOptions: { bindingMetadata: compiled.bindings } }).errors).toEqual([]);
  const code = ts.transpileModule(compiled.content, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const defaults = { automatic: false, departure: false, approval: false, email: false, dingtalk: false,
    administrators: true, owner: false, days: '30,7,0', time: '09:00', departureIntervalDays: 30, templates: [] };
  const stored: Record<string, any> = { root: structuredClone(defaults), intranet: structuredClone(defaults) };
  const mod = { exports: {} as any };
  new Function('require', 'module', 'exports', code)((name: string) => {
    if (name === 'vue') return vue;
    if (name === 'element-plus') return { ElMessage: { success: () => {} } };
    if (name === '@/api/ra/businessNoticeSettings') return {
      getBusinessNoticeSettings: async (key: string) => ({ data: structuredClone(stored[key]) }),
      saveBusinessNoticeSettings: async (key: string, data: any) => {
        stored[key] = structuredClone(vue.toRaw(data));
        return { data: stored[key] };
      }
    };
    throw new Error(name);
  }, mod, mod.exports);
  let exposed: any;
  const component = mod.exports.default.setup({ module: 'root' }, { expose: (value: any) => { exposed = value; } });
  await exposed.open();
  component.form.days = '3650,30,7,0';
  component.addTemplate('EXPIRY', 'EMAIL');
  component.addTemplate('EXPIRY', 'EMAIL');
  component.addTemplate('EXPIRY', 'DINGTALK');
  component.form.templates[1].content = '钉钉通知';
  component.form.templates[0].content = '证书状态';
  await component.save();
  expect(stored.root.days).toBe('3650,30,7,0');
  expect(stored.root.templates.map((entry: { channel: string }) => entry.channel)).toEqual(['EMAIL', 'DINGTALK']);
  expect(descriptor.template!.content).toContain('hasTemplate(category.value, channel.value)');
  expect(component.variable('serialNumber')).toBe('${root.serialNumber}');
  expect(component.noticeVariables.value).toContainEqual(['serialNumber', '证书序列号']);
  expect(stored.intranet.days).toBe('30,7,0');
  expect(stored.intranet.templates).toEqual([]);
});
