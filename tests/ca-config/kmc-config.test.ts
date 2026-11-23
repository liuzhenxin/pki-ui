import { flushPromises, mount } from '@vue/test-utils';
import ElementPlus from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CaConfig from '@/views/ca/config/index.vue';
import { getCaConfig, saveCaConfig } from '@/api/ca/config';
import { listRootCa } from '@/api/ca/root';
import { listProfile } from '@/api/ca/profile';

vi.mock('@/api/ca/config', () => ({
  getCaConfig: vi.fn(),
  saveCaConfig: vi.fn(),
  testCaConfig: vi.fn(),
  getArchiveStats: vi.fn(),
  triggerArchive: vi.fn()
}));
vi.mock('@/api/ca/root', () => ({ issueCaIdentityCert: vi.fn(), listRootCa: vi.fn() }));
vi.mock('@/api/ca/profile', () => ({ listProfile: vi.fn() }));
vi.mock('@/components/X509Cert/index.vue', () => ({ default: { template: '<div />' } }));

const baseUrl = 'http://kmc.example.test/api-gateway/kmc';
let config: Record<string, unknown>;
let page: ReturnType<typeof mount>;

beforeEach(() => {
  vi.resetAllMocks();
  config = { enabled: true, kmcBaseUrl: baseUrl, kmcCaName: 'CA' };
  vi.mocked(getCaConfig).mockImplementation(
    async (type) =>
      ({
        data: { id: '2113435093965266945', type, config: JSON.stringify(type === 'KMC_SERVER' ? config : {}) }
      }) as Awaited<ReturnType<typeof getCaConfig>>
  );
  vi.mocked(saveCaConfig).mockImplementation(async (payload) => {
    config = JSON.parse(payload.config);
    return { data: null } as Awaited<ReturnType<typeof saveCaConfig>>;
  });
  vi.mocked(listRootCa).mockResolvedValue({ data: [] } as any);
  vi.mocked(listProfile).mockResolvedValue({ data: [] } as any);
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  page = mount(CaConfig, { global: { plugins: [ElementPlus], directives: { hasPermi: () => {} } } });
});

afterEach(() => {
  page.unmount();
  vi.unstubAllGlobals();
});

async function openKmc() {
  await flushPromises();
  const tab = page.findAll('[role="tab"]').find((item) => item.text() === 'KMC服务配置');
  expect(tab).toBeDefined();
  await tab!.trigger('click');
  await flushPromises();
}

function nameInput() {
  const field = page.findAll('.el-form-item').find((item) => item.find('.el-form-item__label').text() === '机构名称');
  expect(field, 'KMC服务配置应提供机构名称输入项').toBeDefined();
  return field!.get<HTMLInputElement>('input');
}

async function click(label: string) {
  const button = page.findAll('button').find((item) => item.text() === label);
  expect(button).toBeDefined();
  await button!.trigger('click');
  await flushPromises();
}

describe('CA KMC登记机构名称配置', () => {
  it('保存其他配置时保留数据库已有的机构名称', async () => {
    await openKmc();
    await click('保存配置');
    expect(saveCaConfig).toHaveBeenCalledTimes(1);
    const payload = vi.mocked(saveCaConfig).mock.calls[0][0];
    expect(payload).toMatchObject({ id: '2113435093965266945', type: 'KMC_SERVER' });
    expect(JSON.parse(payload.config)).toEqual({ enabled: true, kmcBaseUrl: baseUrl, kmcCaName: 'CA' });
  });

  it('旧配置可在页面填写机构名称并在保存刷新后保留', async () => {
    delete config.kmcCaName;
    await openKmc();
    expect(nameInput().element.value).toBe('');
    await nameInput().setValue('CA');
    await click('保存配置');
    expect(config.kmcCaName).toBe('CA');
    expect(nameInput().element.value).toBe('CA');
  });

  it('提交前去掉机构名称两端的空格', async () => {
    await openKmc();
    expect(nameInput().element.value).toBe('CA');
    await nameInput().setValue('  FAW-VW-CA  ');
    await click('保存配置');
    expect(config.kmcCaName).toBe('FAW-VW-CA');
  });

  it('刷新缺少机构名称的旧配置时清空过时的表单值', async () => {
    await openKmc();
    expect(nameInput().element.value).toBe('CA');
    delete config.kmcCaName;
    await click('刷新');
    expect(nameInput().element.value).toBe('');
    await click('保存配置');
    expect(config.kmcCaName).toBe('');
  });
});
