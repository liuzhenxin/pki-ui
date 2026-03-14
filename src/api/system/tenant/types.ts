export interface TenantVO extends BaseEntity {
  id: number | string;
  name: string;
  code: string;
  status: number;
  sourceId: string | number;
  packageId: string | number;
  companyName?: string;
}

export interface TenantQuery extends PageQuery {
  name: string;
}

export interface TenantCO {
  id?: number | string;
  name?: string;
  code?: string;
  status?: number | string;
  sourceId?: string | number;
  packageId?: string | number;
}

export interface TenantForm {
  co?: TenantCO;
}
