import { describe, expect, it } from 'vitest';
import { resolveTemplateUsages } from '../../src/utils/raCertUsage';

const normalize = (values: any[]) => values.map((value) => (typeof value === 'string' ? value : value.value || value.oid));

describe('CA template certificate usages', () => {
  it('preserves mandatory usages from the production nested template form', () => {
    expect(resolveTemplateUsages({ usages: [{ required: ['digitalSignature', 'keyEncipherment', 'dataEncipherment'] }] }, normalize)).toEqual({
      requiredUsages: ['digitalSignature', 'keyEncipherment', 'dataEncipherment'],
      allowedUsages: ['digitalSignature', 'keyEncipherment', 'dataEncipherment']
    });
  });
  it('distinguishes mandatory server authentication from optional client authentication', () => {
    expect(resolveTemplateUsages({ required: ['serverAuth'], optional: ['clientAuth'] }, normalize)).toEqual({
      requiredUsages: ['serverAuth'],
      allowedUsages: ['serverAuth', 'clientAuth']
    });
  });
  it('supports individual required flags and removes duplicates', () => {
    expect(
      resolveTemplateUsages({ usages: [{ oid: 'serverAuth', required: true }, { oid: 'clientAuth' }, { oid: 'serverAuth' }] }, normalize)
    ).toEqual({ requiredUsages: ['serverAuth'], allowedUsages: ['serverAuth', 'clientAuth'] });
  });
  it('never invents allowed usages for an empty template', () => {
    expect(resolveTemplateUsages({}, normalize)).toEqual({ requiredUsages: [], allowedUsages: [] });
  });
});
