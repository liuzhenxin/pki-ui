export interface RaDeptQuery extends PageQuery {
  name?: string;
}

export interface RaDeptVO {
  id?: number | string;
  pid?: number | string;
  name?: string;
  sort?: number;
  createTime?: string;
  children?: RaDeptVO[];
}

export interface RaDeptForm {
  id?: number | string;
  pid?: number | string;
  name?: string;
  sort?: number;
}

export interface RaDeptTreeOption {
  id: number | string;
  pid?: number | string;
  name: string;
  sort?: number;
  children?: RaDeptTreeOption[];
}
