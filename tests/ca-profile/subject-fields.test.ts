// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { ElForm, ElFormItem, ElMessage } from 'element-plus';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CaProfileForm from '@/views/ca/profile/form.vue';
import RaProfileForm from '@/views/ra/profile/form.vue';
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

let wrapper: ReturnType<typeof mount>;
let component = CaProfileForm;
let subject: Array<{ type: string | { oid?: string; description?: string }; minOccurs: number; maxOccurs: number }> = [];
async function open(name = '通用证书模板') {
  const profile = {
    id: '10',
    name,
    type: 'EndEntity',
    conf: JSON.stringify({
      certLevel: 'EndEntity',
      validity: '1y',
      subject,
      keyAlgorithms: ['RSA-2048'],
      signatureAlgorithms: ['SHA256withRSA'],
      extensions: [{ type: { oid: '2.5.29.15', description: 'KeyUsage' }, keyUsage: { usages: [{ value: 'digitalSignature', required: true }] } }]
    })
  };
  vi.mocked(getProfile).mockResolvedValue({ data: profile } as any);
  wrapper = mount(component, {
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
        ElTag: { template: '<button class="quick-tag"><slot /></button>' },
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
        ElButton: { template: '<button type="button"><slot /></button>' }
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

const dc = (description = 'DC') => ({ type: { oid: '0.9.2342.19200300.100.1.25', description }, minOccurs: 1, maxOccurs: 1 });

describe.each([
  ['CA', CaProfileForm],
  ['RA', RaProfileForm]
])('%s subject field definitions', (_name, formComponent) => {
  beforeEach(() => {
    component = formComponent;
    subject = [{ type: { oid: '2.5.4.3', description: 'CN' }, minOccurs: 1, maxOccurs: 1 }];
  });

  it('does not append the same DC field twice through quick add', async () => {
    await open();
    const button = wrapper.findAll('.quick-add-section .quick-tag').find((item) => item.text() === '域名组件(DC)')!;
    await button.trigger('click');
    await button.trigger('click');
    expect(wrapper.findAll('.rdn-item')).toHaveLength(2);
    expect(ElMessage.warning).toHaveBeenCalledWith(expect.stringContaining('最大出现次数'));
    await save();
    expect(savedConf().subject.filter((item: any) => item.type.oid === dc().type.oid)).toHaveLength(1);
  });

  it('blocks existing duplicate DC rules with different descriptions before requesting save', async () => {
    subject.push(dc(), dc('domainComponent'));
    await open();
    await save();
    expect(modifyProfile).not.toHaveBeenCalled();
    expect(saveProfile).not.toHaveBeenCalled();
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('主题字段重复：域名组件(DC)'));
  });

  it.each([{ oid: '0.9.2342.19200300.100.1.25', description: 'display label' }, '0.9.2342.19200300.100.1.25', 'domainComponent'])(
    'recognizes DC by its OID or canonical field name: %j',
    async (type) => {
      subject.push({ type, minOccurs: 0, maxOccurs: 3 });
      await open();
      await save();
      expect(savedConf().subject[1]).toMatchObject({ type: { oid: dc().type.oid }, minOccurs: 0, maxOccurs: 3 });
    }
  );

  it('shows the name and OID for a saved field outside the template suggestions', async () => {
    subject.push({ type: { oid: '2.5.4.16' }, minOccurs: 0, maxOccurs: 1 });
    await open('TLS服务器证书模板');
    const rdn = wrapper.findAll('.rdn-item')[1];
    expect(rdn.get('.rdn-title').text()).toBe('邮政地址');
    expect(rdn.get('option[value="postalAddress"]').text()).toBe('邮政地址 (2.5.4.16)');
    expect(rdn.get('select').element.value).toBe('postalAddress');
    expect(wrapper.findAll('.rdn-item')[0].find('option[value="postalAddress"]').exists()).toBe(false);
  });

  it('preserves the OID and description of an existing custom field when saved', async () => {
    const type = { oid: '1.3.6.1.4.1.99999.1', description: '企业内部编号' };
    subject.push({ type, minOccurs: 0, maxOccurs: 1 });
    await open();
    const rdn = wrapper.findAll('.rdn-item')[1];
    expect(rdn.get('.rdn-title').text()).toBe(type.description);
    expect(rdn.get('select').element.selectedOptions[0].text).toBe('企业内部编号 (1.3.6.1.4.1.99999.1)');
    await save();
    expect(savedConf().subject[1].type).toEqual(type);
  });

  it('preserves one DC rule that permits multiple values', async () => {
    subject.push({ ...dc(), minOccurs: 2, maxOccurs: 3 });
    await open();
    await save();
    expect(savedConf().subject.find((item: any) => item.type.oid === dc().type.oid)).toMatchObject({ minOccurs: 2, maxOccurs: 3 });
  });

  it('blocks duplicate fields selected manually and permits saving after removing the duplicate', async () => {
    await open();
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '添加字段')!
      .trigger('click');
    const rdns = wrapper.findAll('.rdn-item');
    expect(rdns).toHaveLength(2);
    await rdns[1].get('select').setValue('commonName');
    await save();
    expect(modifyProfile).not.toHaveBeenCalled();
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('主题字段重复：通用名称(CN)'));
    await wrapper
      .findAll('.rdn-item')[1]
      .findAll('button')
      .find((button) => button.text() === '删除')!
      .trigger('click');
    await save();
    expect(savedConf().subject).toHaveLength(1);
  });
});
