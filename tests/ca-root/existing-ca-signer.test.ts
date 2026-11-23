// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExistingCaDialog from '@/views/ca/root/ExistingCaDialog.vue';
import { bindExistingCaSigner, getExistingCaSigners, importExistingCa, previewExistingCa } from '@/api/ca/root';
import type { ExistingCaPreview, ExistingCaSigner } from '@/api/ca/root';

vi.mock('@/api/ca/root', () => ({
  importExistingCa: vi.fn(),
  previewExistingCa: vi.fn(),
  getExistingCaSigners: vi.fn(),
  bindExistingCaSigner: vi.fn()
}));
vi.mock('@/utils/ruoyi', () => ({ parseTime: (value: string) => value }));

const Select = defineComponent({
  props: ['modelValue', 'valueOnClear'],
  emits: ['update:modelValue', 'change'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'select',
        {
          value: props.modelValue ?? '',
          onChange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value || props.valueOnClear;
            emit('update:modelValue', value);
            emit('change', value);
          }
        },
        [h('option', { value: '' }), slots.default?.()]
      );
  }
});

const Option = defineComponent({
  props: ['value', 'label', 'disabled'],
  setup(props) {
    return () => h('option', { value: props.value, disabled: props.disabled }, props.label);
  }
});

const matching: ExistingCaSigner = { id: '101', name: '软件签发者', type: 'PKCS12', matching: true, publicKeyStatus: 'MATCH' };
const sdf: ExistingCaSigner = { id: '102', name: '密码机签发者', type: 'SDF', keyIndex: 12, matching: false, publicKeyStatus: 'UNVERIFIED' };
const mismatch: ExistingCaSigner = { id: '103', name: '其他签发者', type: 'SDF', keyIndex: 11, matching: false, publicKeyStatus: 'MISMATCH' };

function mountDialog() {
  return mount(ExistingCaDialog, {
    props: { parents: [] },
    global: {
      stubs: {
        ElDialog: { props: ['modelValue'], template: '<section v-if="modelValue"><slot /><slot name="footer" /></section>' },
        ElForm: { template: '<div><slot /></div>' },
        ElFormItem: { template: '<div><slot /></div>' },
        ElInput: true,
        ElDescriptions: { template: '<div><slot /></div>' },
        ElDescriptionsItem: { template: '<div><slot /></div>' },
        ElAlert: true,
        ElSelect: Select,
        ElOption: Option,
        ElButton: { template: '<button><slot /></button>' }
      }
    }
  });
}

const certificate = {
  subject: 'CN=Root-01',
  issuer: 'CN=Root-01',
  serialNumber: '01',
  notBefore: '2020-01-01',
  notAfter: '2040-01-01',
  signatureAlgorithm: 'SHA256withRSA',
  sha256: 'test-fingerprint'
};

let dialog: ReturnType<typeof mountDialog>;

beforeEach(() => {
  vi.resetAllMocks();
  dialog = mountDialog();
});

afterEach(() => dialog.unmount());

async function click(label: string) {
  const button = dialog.findAll('button').find((item) => item.text() === label);
  expect(button).toBeDefined();
  await button!.trigger('click');
  await flushPromises();
}

async function uploadCertificate(fileName: string) {
  const input = dialog.get('input[type="file"]');
  const file = new File(['fixture'], fileName);
  Object.defineProperty(input.element, 'files', { value: [file] });
  await input.trigger('change');
}

async function preview(signers: ExistingCaPreview['signers'], existingRootId?: ExistingCaPreview['existingRootId']) {
  vi.mocked(previewExistingCa).mockResolvedValue({
    data: { certificate, signers, existingRootId }
  } as Awaited<ReturnType<typeof previewExistingCa>>);
  dialog.vm.openImport(false);
  await flushPromises();
  await uploadCertificate('Root-01.pem');
  await click('预览证书');
}

describe('导入已有根 CA 的签名者选择', () => {
  it('打开导入弹窗即可看到签发者入口，预览后可选择并随证书登记', async () => {
    dialog.vm.openImport(false);
    await flushPromises();
    expect(dialog.get<HTMLSelectElement>('select').element.disabled).toBe(true);
    expect(dialog.text()).toContain('预览证书后选择签发者');

    await preview([matching, sdf]);
    const select = dialog.get<HTMLSelectElement>('select');
    expect(select.element.disabled).toBe(false);
    await select.setValue(sdf.id);
    vi.mocked(importExistingCa).mockResolvedValue({ data: '900' } as Awaited<ReturnType<typeof importExistingCa>>);
    await click('确认导入');

    expect(importExistingCa).toHaveBeenCalledWith(expect.objectContaining({ signerId: sdf.id, subordinate: false }));
    expect(dialog.emitted('completed')).toEqual([['900']]);
  });

  it('已登记的停用根 CA 未绑定时可直接验签绑定，不再提交导入', async () => {
    await dialog.setProps({ parents: [{ id: '900', name: 'Root-01', cert: '', imported: true, caStatus: 'inactive' }] });
    await preview([matching, sdf, mismatch], 900);

    expect(dialog.get<HTMLOptionElement>('option[value="103"]').element.disabled).toBe(true);
    await dialog.get<HTMLSelectElement>('select').setValue(sdf.id);
    await click('验证并绑定');

    expect(bindExistingCaSigner).toHaveBeenCalledWith(900, sdf.id);
    expect(importExistingCa).not.toHaveBeenCalled();
    expect(dialog.emitted('completed')).toEqual([[900]]);
  });

  it('已绑定的根 CA 仅查看原记录，不能在导入弹窗覆盖签发者', async () => {
    await dialog.setProps({ parents: [{ id: '900', name: 'Root-01', cert: '', imported: true, caStatus: 'inactive', signerId: '101' }] });
    await preview([matching, sdf], '900');

    expect(dialog.find('select').exists()).toBe(false);
    await click('查看已有记录');
    expect(dialog.emitted('completed')).toEqual([['900']]);
    expect(bindExistingCaSigner).not.toHaveBeenCalled();
  });

  it('预选唯一匹配项，禁选明确不匹配项，并允许清空后登记', async () => {
    await preview([matching, sdf, mismatch]);

    const select = dialog.get<HTMLSelectElement>('select');
    expect(select.element.value).toBe(matching.id);
    expect(dialog.get<HTMLOptionElement>('option[value="103"]').element.disabled).toBe(true);
    expect(dialog.get('option[value="103"]').text()).toContain('索引 11 · 公钥不匹配');
    expect(dialog.get('option[value="102"]').text()).toContain('索引 12 · 待验证');

    await select.setValue('');
    vi.mocked(importExistingCa).mockResolvedValue({ data: '900' } as Awaited<ReturnType<typeof importExistingCa>>);
    await click('确认导入');

    expect(importExistingCa).toHaveBeenCalledWith(expect.objectContaining({ signerId: undefined, subordinate: false }));
    expect(dialog.emitted('completed')).toEqual([['900']]);
  });

  it('多项匹配时等待用户选择，并将待验证项交由后端验签', async () => {
    const pending = { ...sdf, id: '104', keyIndex: 13 };
    await preview([matching, { ...sdf, matching: true, publicKeyStatus: 'MATCH' }, pending]);

    const select = dialog.get<HTMLSelectElement>('select');
    expect(select.element.value).toBe('');
    expect(dialog.get('option[value="102"]').text()).toContain('SDF · 索引 12 · 公钥匹配');
    await select.setValue('104');
    expect(dialog.text()).toContain('保存时将用原 CA 证书验证签名');
    vi.mocked(importExistingCa).mockRejectedValueOnce(new Error('challenge rejected'));
    await click('确认导入');

    expect(importExistingCa).toHaveBeenCalledWith(expect.objectContaining({ signerId: '104' }));
    expect(dialog.emitted('completed')).toBeUndefined();
    expect(select.element.value).toBe('104');
  });

  it('补绑时使用相同规则预选并禁选', async () => {
    vi.mocked(getExistingCaSigners).mockResolvedValue({ data: [sdf, matching, mismatch] } as Awaited<ReturnType<typeof getExistingCaSigners>>);
    await dialog.vm.openBinding({ id: '900', name: 'Root-01', cert: '' });
    await flushPromises();

    expect(dialog.get<HTMLSelectElement>('select').element.value).toBe(matching.id);
    expect(dialog.get<HTMLOptionElement>('option[value="103"]').element.disabled).toBe(true);
  });
});

describe('导入已有子 CA 的签发者选择', () => {
  const parents = [
    { id: '21', name: 'Root-01', cert: '' },
    { id: '22', name: 'Root-02', cert: '' }
  ];

  it('先选择父 CA 并预览，更换父 CA 后清空签发者并重新校验证书链', async () => {
    await dialog.setProps({ parents });
    dialog.vm.openImport(true);
    await flushPromises();
    await uploadCertificate('Sub-01.pem');

    const parent = dialog.get<HTMLSelectElement>('[label="父 CA"] select');
    const signer = dialog.get<HTMLSelectElement>('[label="签发者"] select');
    expect(signer.element.disabled).toBe(true);
    expect(
      dialog
        .findAll('button')
        .find((button) => button.text() === '预览证书')
        ?.attributes('disabled')
    ).toBeDefined();
    await parent.setValue('21');
    vi.mocked(previewExistingCa).mockResolvedValue({ data: { certificate, signers: [matching, sdf] } } as Awaited<
      ReturnType<typeof previewExistingCa>
    >);
    await click('预览证书');
    expect(previewExistingCa).toHaveBeenLastCalledWith(expect.objectContaining({ subordinate: true, parentRootId: '21' }));
    await signer.setValue(sdf.id);

    await parent.setValue('22');
    expect(signer.element.value).toBe('');
    expect(signer.element.disabled).toBe(true);
    expect(dialog.text()).not.toContain('确认导入');
    await click('预览证书');
    expect(previewExistingCa).toHaveBeenLastCalledWith(expect.objectContaining({ subordinate: true, parentRootId: '22', signerId: undefined }));
    await signer.setValue(sdf.id);
    vi.mocked(importExistingCa).mockResolvedValue({ data: '910' } as Awaited<ReturnType<typeof importExistingCa>>);
    await click('确认导入');

    expect(importExistingCa).toHaveBeenCalledWith(expect.objectContaining({ subordinate: true, parentRootId: '22', signerId: sdf.id }));
    expect(dialog.emitted('completed')).toEqual([['910']]);
  });

  it('已登记的停用子 CA 可以从导入弹窗补绑签发者', async () => {
    await dialog.setProps({ parents: [...parents, { id: '910', name: 'Sub-01', cert: '', imported: true, caStatus: 'inactive' }] });
    dialog.vm.openImport(true);
    await flushPromises();
    await uploadCertificate('Sub-01.pem');
    await dialog.get<HTMLSelectElement>('[label="父 CA"] select').setValue('21');
    vi.mocked(previewExistingCa).mockResolvedValue({
      data: { certificate, signers: [sdf], existingRootId: '910' }
    } as Awaited<ReturnType<typeof previewExistingCa>>);
    await click('预览证书');
    await dialog.get<HTMLSelectElement>('[label="签发者"] select').setValue(sdf.id);
    await click('验证并绑定');

    expect(bindExistingCaSigner).toHaveBeenCalledWith('910', sdf.id);
    expect(importExistingCa).not.toHaveBeenCalled();
  });
});
