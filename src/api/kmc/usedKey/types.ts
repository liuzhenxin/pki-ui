export interface UsedKeyVO {
  id: string | number;
  caId?: string | number;
  keyType: string;
  keyBits: number;
  serialNumber?: string;
  subject?: string;
  useTime?: string;
  expirTime?: string;
  status?: string;
  remark?: string;
}

export interface UsedKeyForm {
  id?: string | number;
  caId?: string | number;
  keyType: string;
  keyBits: number;
  serialNumber?: string;
  subject?: string;
  useTime?: string;
  expirTime?: string;
  status?: string;
  remark?: string;
}

export interface UsedKeyQuery extends PageQuery {
  keyType?: string;
  subject?: string;
  serialNumber?: string;
  status?: string;
}
