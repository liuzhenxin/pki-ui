// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { defineComponent, h, inject, provide, type InjectionKey } from 'vue';
import { describe, expect, it } from 'vitest';
import CertProfile from '@/components/CertProfile/index.vue';

const tableRows: InjectionKey<unknown[]> = Symbol('tableRows');
const Table = defineComponent({
  props: { data: { type: Array, required: true } },
  setup(props, { slots }) {
    provide(tableRows, props.data);
    return () => h('div', slots.default?.());
  }
});
const TableColumn = defineComponent({
  setup(_, { slots }) {
    const rows = inject(tableRows, []);
    return () =>
      h(
        'div',
        rows.map((row) => slots.default?.({ row }))
      );
  }
});

const rdns = [
  { type: '2.5.4.97' },
  { type: { oid: '2.5.4.42', description: 'CN' } },
  { type: 'stateOrProvinceName' },
  { type: { oid: '1.3.6.1.5.5.7.9.1' } },
  { type: { oid: '1.3.6.1.4.1.99999.1', description: '企业内部编号' } },
  { type: { oid: '1.3.6.1.4.1.99999.2' } },
  { type: null }
];

describe('certificate profile subject display', () => {
  it.each([{ subject: rdns }, { subject: { rdns } }])('shows names and OIDs for existing profile formats', (profile) => {
    const wrapper = mount(CertProfile, {
      props: { profile },
      global: {
        stubs: {
          ElDescriptions: true,
          ElDescriptionsItem: true,
          ElIcon: true,
          ElTabs: { template: '<div><slot /></div>' },
          ElTabPane: { template: '<div><slot /></div>' },
          ElTable: Table,
          ElTableColumn: TableColumn,
          ElCollapse: true,
          ElCollapseItem: true,
          ElTag: true,
          ElEmpty: true
        }
      }
    });

    expect(wrapper.findAll('.type-label').map((label) => label.text())).toEqual([
      '组织标识符',
      '名字(GN)',
      '省/州(ST)',
      '出生日期',
      '企业内部编号',
      '1.3.6.1.4.1.99999.2',
      '-'
    ]);
    expect(wrapper.findAll('.type-code').map((code) => code.text())).toEqual([
      '(2.5.4.97)',
      '(2.5.4.42)',
      '(2.5.4.8)',
      '(1.3.6.1.5.5.7.9.1)',
      '(1.3.6.1.4.1.99999.1)'
    ]);
    wrapper.unmount();
  });
});
