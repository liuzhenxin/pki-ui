export interface TenantVO extends BaseEntity {
  id: number | string;
  name: string;
  code: string;
  status: number;
  sourceId: string | number;
  packageId: string | number;
}

export interface TenantQuery extends PageQuery {
  name: string;
}

export interface TenantForm {
  id: number | string | undefined;
  name: string;
  code: string;
  sourceId: string | number;
  packageId: string | number;
}
