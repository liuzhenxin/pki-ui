// @vitest-environment jsdom
import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import CertSubject from '@/components/CertSubject/index.vue';
import { buildCaIssueSubjectItems, formatCaIssueSubject } from '@/utils/ca/issue-subject';

const rdns = [
  { type: { oid: '2.5.4.3' } },
  { type: 'O' },
  { type: { oid: '2.5.4.6', description: 'CN' } },
  { type: '2.5.4.97' },
  { type: { oid: '1.3.6.1.4.1.99999.1', description: '企业内部编号' }, minOccurs: 2, maxOccurs: 3 },
  { type: { oid: '1.3.6.1.4.1.99999.2' }, minOccurs: 0 },
  { type: null }
];

describe('CA issuance subject mapping', () => {
  it.each([{ subject: rdns }, { subject: { rdns } }])('renders OID names and retains the matching DN keys', ({ subject }) => {
    const items = buildCaIssueSubjectItems(subject);
    const wrapper = mount(CertSubject, {
      props: { modelValue: items },
      global: {
        stubs: {
          ElFormItem: { props: ['label'], template: '<label>{{ label }}<slot /></label>' },
          ElInput: true,
          ElSelect: { template: '<select />' },
          ElOption: true
        }
      }
    });

    expect(wrapper.findAll('label').map((label) => label.text())).toEqual([
      '通用名称(CN)',
      '组织(O)',
      '国家(C)',
      '组织标识符 (2.5.4.97)',
      '企业内部编号 (1.3.6.1.4.1.99999.1)',
      '企业内部编号 (1.3.6.1.4.1.99999.1)',
      '1.3.6.1.4.1.99999.2'
    ]);
    expect(wrapper.find('select').exists()).toBe(true);
    expect(items[4]).toMatchObject({ minOccurs: 2, maxOccurs: 3 });

    const values = ['Alice', 'Example', 'CN', 'ORG-001', 'ABC', 'DEF'];
    values.forEach((value, index) => (items[index].value = value));
    expect(formatCaIssueSubject(items)).toBe('CN=Alice,O=Example,C=CN,2.5.4.97=ORG-001,1.3.6.1.4.1.99999.1=ABC,1.3.6.1.4.1.99999.1=DEF');
  });
});
