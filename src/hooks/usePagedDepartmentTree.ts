import { computed, ref, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';

export function usePagedDepartmentTree<T extends { children?: T[] }>(
  tree: Readonly<Ref<T[]>>,
  getId: (node: T) => number | string | undefined
) {
  const page = ref(1);
  const pageSize = 50;
  const expandAll = ref(false);
  const overrides = shallowRef(new Set<string>());

  const visibleRows = computed(() => {
    const rows: Array<{ id: string; dept: T; depth: number; hasChildren: boolean; expanded: boolean }> = [];
    function visit(branch: T[], depth: number) {
      for (const dept of branch) {
        const id = String(getId(dept));
        const children = dept.children || [];
        const expanded = expandAll.value !== overrides.value.has(id);
        rows.push({ id, dept, depth, hasChildren: children.length > 0, expanded });
        if (expanded && children.length) visit(children, depth + 1);
      }
    }
    visit(tree.value, 0);
    return rows;
  });

  const total = computed(() => visibleRows.value.length);
  const rows = computed(() => visibleRows.value.slice((page.value - 1) * pageSize, page.value * pageSize));

  watch(total, (count) => {
    page.value = Math.min(page.value, Math.max(1, Math.ceil(count / pageSize)));
  }, { flush: 'sync' });

  function toggle(id: string) {
    const next = new Set(overrides.value);
    if (!next.delete(id)) next.add(id);
    overrides.value = next;
  }

  function reset(expanded = false) {
    page.value = 1;
    expandAll.value = expanded;
    overrides.value = new Set();
  }

  return { page, pageSize, total, rows, toggle, reset, toggleAll: () => reset(!expandAll.value) };
}
