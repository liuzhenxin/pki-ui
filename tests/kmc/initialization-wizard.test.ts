import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { beforeEach, expect, it, vi } from 'vitest';
import Wizard from '@/views/kmc/init/index.vue';

const { getInitStatus, getTenant, getIdentity, getEnvInfo, replace, setTenantInitStatus } = vi.hoisted(() => ({
  getInitStatus: vi.fn(),
  getTenant: vi.fn(),
  getIdentity: vi.fn(),
  getEnvInfo: vi.fn(),
  replace: vi.fn(),
  setTenantInitStatus: vi.fn()
}));

vi.mock('@/api/kmc/init', () => ({ getInitStatus, getIdentity, getEnvInfo }));
vi.mock('@/api/system/tenant', () => ({ getTenant }));
vi.mock('vue-router', () => ({ useRouter: () => ({ replace }) }));
vi.mock('@/store/modules/user', () => ({ useUserStore: () => ({ tenantId: '3', setTenantInitStatus }) }));
vi.mock('@/components/Agreement/index.vue', () => ({ default: { template: '<div>用户协议</div>' } }));

const refreshWizard = async () => {
  const wizard = mount(Wizard, { global: { plugins: [ElementPlus] } });
  await flushPromises();
  const heading = wizard.find('.step-content h2');
  const step = heading.exists() ? heading.text() : undefined;
  wizard.unmount();
  return step;
};

beforeEach(() => {
  vi.resetAllMocks();
  getEnvInfo.mockResolvedValue({ data: [] });
  getIdentity.mockResolvedValue({ data: { configured: false } });
  getTenant.mockResolvedValue({ data: { status: 1 } });
});

it('恢复到账号初始化，即使平台仍返回旧状态', async () => {
  getInitStatus.mockResolvedValue({ data: { tenantStatus: 1, initialized: false, identity: { configured: true } } });
  getTenant.mockResolvedValue({ data: { status: 0 } });
  expect(await refreshWizard()).toBe('账号初始化');
  expect(getInitStatus).toHaveBeenCalledOnce();
});

it('KMC 状态接口不可用时，用平台状态和当前身份恢复账号初始化', async () => {
  getInitStatus.mockRejectedValue(new Error('status unavailable'));
  getIdentity.mockResolvedValue({ data: { configured: true } });
  expect(await refreshWizard()).toBe('账号初始化');
});

it('身份尚未激活时保留环境检查步骤', async () => {
  getInitStatus.mockResolvedValue({ data: { tenantStatus: 1, initialized: false, identity: { configured: false } } });
  expect(await refreshWizard()).toBe('环境检查');
});

it('后端确认已完成时退出向导并同步路由所用的租户状态', async () => {
  getInitStatus.mockResolvedValue({ data: { tenantStatus: -1, initialized: true } });
  await refreshWizard();
  expect(setTenantInitStatus).toHaveBeenCalledWith(-1);
  expect(replace).toHaveBeenCalledWith('/index');
});
