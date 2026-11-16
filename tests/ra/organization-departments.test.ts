import { describe, expect, it } from 'vitest';
import { raDepartmentIsWritable, writableRaDepartments } from '@/api/ra/dept/types';

const tree = [
  {
    id: '90071992547409930',
    name: '机构',
    organization: true,
    writable: true,
    children: [
      { id: '90071992547409931', name: '内部部门', writable: true },
      {
        id: '90071992547409932',
        name: '下级机构',
        writable: false,
        children: [{ id: '90071992547409933', name: '下级机构内部部门', writable: false }]
      }
    ]
  }
];

describe('RA organization department selection', () => {
  it('keeps independent subtrees available for read-only navigation while excluding them from edit forms', () => {
    expect(writableRaDepartments(tree)[0].children?.map((node) => node.id)).toEqual(['90071992547409931']);
    expect(raDepartmentIsWritable(tree, '90071992547409931')).toBe(true);
    expect(raDepartmentIsWritable(tree, '90071992547409933')).toBe(false);
  });
});
