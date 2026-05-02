export interface KmcCaVO {
  id: string | number;
  name: string;
  type?: string;
  status?: string;
  description?: string;
}

export interface KmcCaForm {
  id?: string | number;
  name: string;
  type?: string;
  status?: string;
  description?: string;
}

export interface KmcCaQuery extends PageQuery {
  name?: string;
  type?: string;
  status?: string;
}

