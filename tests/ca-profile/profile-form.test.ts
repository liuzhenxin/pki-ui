// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ElForm, ElFormItem, ElMessage } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ProfileForm from '@/views/ca/profile/form.vue';
import { getProfile, listProfile, modifyProfile, saveProfile } from '@/api/ca/profile';

const router = vi.hoisted(() => ({ back: vi.fn() }));
vi.mock('vue-router', () => ({ useRouter: () => router, useRoute: () => ({ query: { id: '10' } }) }));
vi.mock('@/api/ca/profile', () => ({ getProfile: vi.fn(), listProfile: vi.fn(), modifyProfile: vi.fn(), saveProfile: vi.fn() }));
vi.mock('element-plus', async (original) => ({
  ...(await original<typeof import('element-plus')>()),
  ElMessage: { error: vi.fn(), success: vi.fn(), warning: vi.fn() }
}));

const slotStub = { template: '<div><slot name="header" /><slot name="title" /><slot /></div>' };
const Select = defineComponent({
  props: ['modelValue', 'disabled'],
  emits: ['update:modelValue', 'change'],
  setup(props, { slots, emit }) {
    return () =>
      h(
        'select',
        {
          value: props.modelValue,
          disabled: props.disabled,
          onChange: (event: Event) => {
            const value = (event.target as HTMLSelectElement).value;
            emit('update:modelValue', value);
            emit('change', value);
          }
        },
        slots.default?.()
      );
  }
});
const NumberInput = defineComponent({
  props: ['modelValue', 'min', 'max', 'precision'],
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('input', {
        type: 'number',
        value: props.modelValue ?? '',
        min: props.min,
        max: props.max,
        onInput: (event: Event) => {
          const value = (event.target as HTMLInputElement).value;
          emit('update:modelValue', value === '' ? undefined : Number(value));
        }
      });
  }
});

function fixture(validity = '10y', root = false) {
  return {
    id: '10',
    name: root ? '根CA证书模板' : '电子邮件证书模板',
    type: root ? 'RootCA' : 'EndEntity',
    conf: JSON.stringify({
      certLevel: root ? 'RootCA' : 'EndEntity',
      validity,
      keyAlgorithms: ['RSA-2048'],
      signatureAlgorithms: ['SHA256withRSA'],
      subject: [
        { type: { oid: '2.5.4.3', description: 'CN' }, minOccurs: 1 },
        ...(root ? [] : [{ type: { oid: '1.2.840.113549.1.9.1', description: 'emailAddress' }, minOccurs: 1 }])
      ],
      extensions: [
        {
          type: { oid: '2.5.29.15', description: 'KeyUsage' },
          keyUsage: { usages: (root ? ['keyCertSign', 'cRLSign'] : ['digitalSignature']).map((value) => ({ value, required: true })) }
        },
        ...(root
          ? []
          : [
              {
                type: { oid: '2.5.29.37', description: 'ExtendedKeyUsage' },
                extendedKeyUsage: { usages: [{ value: 'emailProtection', required: true }] }
              }
            ])
      ]
    })
  };
}

let wrapper: ReturnType<typeof mount>;
async function open(validity = '10y', root = false) {
  vi.mocked(getProfile).mockResolvedValue({ data: fixture(validity, root) } as any);
  wrapper = mount(ProfileForm, {
    global: {
      components: { ElForm, ElFormItem },
      stubs: {
        ElCard: slotStub,
        ElRow: slotStub,
        ElCol: slotStub,
        ElTabs: slotStub,
        ElTabPane: slotStub,
        ElDescriptions: slotStub,
        ElDescriptionsItem: slotStub,
        ElSpace: slotStub,
        ElTag: slotStub,
        ElAlert: slotStub,
        ElIcon: true,
        ElDivider: true,
        ElInput: true,
        ElCheckboxGroup: true,
        ElCheckbox: true,
        ElCheckboxButton: true,
        ElEmpty: true,
        ElInputNumber: NumberInput,
        ElSelect: Select,
        ElOption: { props: ['value', 'label'], template: '<option :value="value">{{ label }}</option>' },
        ElButton: { template: '<button><slot /></button>' }
      },
      config: { warnHandler: () => {} }
    }
  });
  await flushPromises();
}
async function save() {
  vi.mocked(ElMessage.error).mockClear();
  vi.mocked(ElMessage.warning).mockClear();
  vi.mocked(ElMessage.success).mockClear();
  await wrapper
    .findAll('button')
    .find((button) => button.text() === '保存')!
    .trigger('click');
  await flushPromises();
  await vi.waitFor(() =>
    expect(
      vi.mocked(ElMessage.error).mock.calls.length + vi.mocked(ElMessage.warning).mock.calls.length + vi.mocked(ElMessage.success).mock.calls.length
    ).toBeGreaterThan(0)
  );
}
function savedConf() {
  expect(modifyProfile).toHaveBeenCalledTimes(1);
  return JSON.parse(vi.mocked(modifyProfile).mock.calls[0][0].co.conf!);
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProfile).mockResolvedValue({ data: [] } as any);
  vi.mocked(modifyProfile).mockResolvedValue({} as any);
});
afterEach(() => wrapper?.unmount());

describe('editable CA maximum validity', () => {
  it('round-trips an existing 10-year email limit instead of applying the old 730-day ceiling', async () => {
    await open();
    expect(wrapper.text()).toContain('最大有效期为 10 年');
    expect(wrapper.text()).not.toContain('不能超过 730 天');
    await save();
    expect(savedConf().validity).toBe('10y');
    expect(router.back).toHaveBeenCalledOnce();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it('saves an edited maximum and displays the same limit after reopening', async () => {
    await open();
    await wrapper.get('.validity-input-group input').setValue('20');
    expect(wrapper.text()).toContain('最大有效期为 20 年');
    await save();
    const validity = savedConf().validity;
    wrapper.unmount();
    await open(validity);
    expect((wrapper.get('.validity-input-group input').element as HTMLInputElement).value).toBe('20');
    expect(wrapper.text()).toContain('最大有效期为 20 年');
  });

  it('accepts a 50-year root template and a day-based duration above the former input ceiling', async () => {
    await open('50y', true);
    await save();
    expect(savedConf().validity).toBe('50y');
    vi.mocked(modifyProfile).mockClear();
    await wrapper.get('.validity-input-group select').setValue('d');
    await wrapper.get('.validity-input-group input').setValue('21900');
    await save();
    expect(savedConf().validity).toBe('21900d');
  });

  it('preserves legacy minute-based limits and keeps the amount when changing units', async () => {
    await open('12m');
    expect(wrapper.text()).toContain('最大有效期为 12 分钟');
    expect(wrapper.findAll('.validity-input-group option').map((option) => option.text())).not.toContain('月');
    await save();
    expect(savedConf().validity).toBe('12m');
    vi.mocked(modifyProfile).mockClear();
    await wrapper.get('.validity-input-group select').setValue('y');
    await save();
    expect(savedConf().validity).toBe('12y');
  });

  it('keeps the selected unit while the amount is cleared and entered again', async () => {
    await open('21900d');
    await wrapper.get('.validity-input-group input').setValue('');
    expect((wrapper.get('.validity-input-group select').element as HTMLSelectElement).value).toBe('d');
    await wrapper.get('.validity-input-group input').setValue('3650');
    await save();
    expect(savedConf().validity).toBe('3650d');
  });

  it.each(['0', ''])('blocks saving an invalid maximum: %s', async (value) => {
    await open();
    await wrapper.get('.validity-input-group input').setValue(value);
    await save();
    expect(modifyProfile).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
    expect(vi.mocked(ElMessage.warning).mock.calls.length + vi.mocked(ElMessage.error).mock.calls.length).toBeGreaterThan(0);
  });
});
