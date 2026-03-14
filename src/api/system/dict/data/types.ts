export interface DictDataQuery extends PageQuery {
  name: string;
  type: string;
  label: string;
}

export interface DictDataVO extends BaseEntity {
  id: string;
  label: string;
  value: string;
  cssClass: string;
  listClass: ElTagType;
  sort: number;
  remark: string;
}

export interface DictDataForm {
  type?: string;
  id: string | undefined;
  label: string;
  value: string;
  cssClass: string;
  listClass: ElTagType;
  dort: number;
  remark: string;
}
