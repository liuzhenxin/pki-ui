export interface ReserveKeyVO {
  id: string | number;
  strategyId?: string | number;
  keyType: string;
  keyBits: number;
  keyStatus?: number;
  createTime?: string;
}

export interface ReserveKeyForm {
  id?: string | number;
  strategyId?: string | number;
  keyType: string;
  keyBits: number;
  keyStatus?: number;
}

export interface ReserveKeyQuery extends PageQuery {
  keyType?: string;
  keyStatus?: number;
}
