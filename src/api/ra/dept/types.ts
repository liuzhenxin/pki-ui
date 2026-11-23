export interface RaDeptQuery extends PageQuery {
  hideEmptyEmployeeOther?: boolean;
  name?: string;
}

export interface RaDeptVO {
  id?: number | string;
  pid?: number | string;
  name?: string;
  sort?: number;
  createTime?: string;
  children?: RaDeptVO[];
  organization?: boolean;
  writable?: boolean;
  movable?: boolean;
}

export interface RaDeptForm {
  id?: number | string;
  pid?: number | string;
  name?: string;
  sort?: number;
  organization?: boolean;
}

export interface RaDeptTreeOption {
  id: number | string;
  pid?: number | string;
  name: string;
  sort?: number;
  children?: RaDeptTreeOption[];
  organization?: boolean;
  writable?: boolean;
  movable?: boolean;
}

export function writableRaDepartments<T extends RaDeptTreeOption>(tree: T[]): T[] {
  return tree
    .filter((node) => node.writable === true)
    .map((node) => ({
      ...node,
      children: writableRaDepartments(node.children || [])
    }));
}

export function raDepartmentIsWritable(tree: RaDeptTreeOption[], id: string | number | undefined): boolean {
  if (id == null) return false;
  return tree.some((node) => (String(node.id) === String(id) ? node.writable === true : raDepartmentIsWritable(node.children || [], id)));
}
