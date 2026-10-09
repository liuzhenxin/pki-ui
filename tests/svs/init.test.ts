import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import Init from '@/views/svs/init/index.vue';
import * as api from '@/api/svs/init';
vi.mock('vue-router', () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock('@/api/svs/init', () => ({ getSvsInitPlan: vi.fn(), reviewSvsInitStep: vi.fn(), getSvsInitialization: vi.fn(), completeSvsInitialization: vi.fn(), getSvsInitAccounts: vi.fn(), validateSvsInitAccounts: vi.fn() }));
const ready = { locked: false, platformTenantValid: true, deviceReady: true, databaseReady: true, canInitialize: true, tenantId: 9, code: 'svs' };
const mountWizard = () => mount(Init, { global: { plugins: [ElementPlus] } });
const button = (w: ReturnType<typeof mountWizard>, label: string) => w.findAll('button').find(b => b.text() === label)!;
describe('SVS initialization wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getSvsInitPlan).mockResolvedValue({ nextStep: 0, keyId: 'sm2-test', keys: ['sm2-test'], hostType: 'STANDALONE', deploymentRevision: 'revision', deployment: { networkReady: 'true', securityReady: 'true' } });
    vi.mocked(api.reviewSvsInitStep).mockResolvedValue({ nextStep: 1, keyId: 'sm2-test', keys: ['sm2-test'], hostType: 'STANDALONE', deploymentRevision: 'revision', deployment: {} }); vi.mocked(api.getSvsInitialization).mockResolvedValue(ready);
    vi.mocked(api.getSvsInitAccounts).mockResolvedValue({ sys: 'SYSADMIN', sec1: 'SECADMIN', sec2: 'SECADMIN', audit: 'AUDITOR' });
    vi.mocked(api.validateSvsInitAccounts).mockResolvedValue({ ready: true, rows: [] });
    vi.mocked(api.completeSvsInitialization).mockResolvedValue();
  });
  it('blocks progress when a required environment check fails', async () => {
    vi.mocked(api.getSvsInitialization).mockResolvedValue({ ...ready, deviceReady: false });
    const w = mountWizard(); await flushPromises();
    expect(button(w, '下一步').attributes('disabled')).toBeDefined();
    expect(w.text()).toContain('请检查设备连接'); expect(api.completeSvsInitialization).not.toHaveBeenCalled();w.unmount();
  });
  it('validates independent accounts before confirmation and requires explicit final consent', async () => {
    const w = mountWizard(); await flushPromises();await button(w, '下一步').trigger('click');await flushPromises();
    await button(w, '下一步').trigger('click');await flushPromises();
    await button(w, '下一步').trigger('click');await flushPromises();
    expect(button(w, '下一步').attributes('disabled')).toBeDefined();
    (w.vm as any).reviewed = true;await flushPromises();await button(w, '下一步').trigger('click');await flushPromises();
    (w.vm as any).reviewed = true;await flushPromises();await button(w, '下一步').trigger('click');await flushPromises();
    expect(w.findAll('input[readonly]').map(input => (input.element as HTMLInputElement).value)).toEqual(['admin', 'secadmin', 'secadmin2', 'auditor']);
    await button(w, '校验并继续').trigger('click');await flushPromises();
    expect(api.validateSvsInitAccounts).toHaveBeenCalledWith({ admin: 'SYSADMIN', secadmin: 'SECADMIN', secadmin2: 'SECADMIN', auditor: 'AUDITOR' });
    expect(button(w, '确认并完成初始化').attributes('disabled')).toBeDefined();expect(api.completeSvsInitialization).not.toHaveBeenCalled();
    await button(w, '执行签名验签自测').trigger('click');await flushPromises();
    expect(api.reviewSvsInitStep).toHaveBeenLastCalledWith(6, 'sm2-test', 'revision');
    (w.vm as any).confirmed = true;await flushPromises();await button(w, '确认并完成初始化').trigger('click');await flushPromises();
    expect(api.completeSvsInitialization).toHaveBeenCalledTimes(1);expect(w.text()).toContain('初始化已完成');w.unmount();
  });
  it('does not accept a failed self-test or force completion', async () => {
    vi.mocked(api.getSvsInitPlan).mockResolvedValue({ nextStep: 6, keyId: 'sm2-test', keys: ['sm2-test'], hostType: 'STANDALONE', deploymentRevision: 'revision', deployment: {} });
    vi.mocked(api.reviewSvsInitStep).mockRejectedValue(new Error('设备签名验签自测未通过'));
    const w = mountWizard();await flushPromises();await button(w, '执行签名验签自测').trigger('click');await flushPromises();
    expect(w.text()).toContain('设备签名验签自测未通过');
    expect(button(w, '确认并完成初始化').attributes('disabled')).toBeDefined();
    expect(api.completeSvsInitialization).not.toHaveBeenCalled();w.unmount();
  });
  it('restores completion for a locked product and shows specific loading errors', async () => {
    vi.mocked(api.getSvsInitialization).mockResolvedValue({ ...ready, locked: true });
    const w = mountWizard();await flushPromises();expect(w.text()).toContain('进入管理台');w.unmount();
    vi.mocked(api.getSvsInitialization).mockRejectedValue(new Error('平台连接失败，请重试'));
    const failed = mountWizard();await flushPromises();expect(failed.text()).toContain('平台连接失败，请重试');failed.unmount();
  });
});
