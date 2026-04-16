export interface ArchiveKeyVO {
  id: string | number;
  caId?: string | number;
  keyType: string;
  keyBits: number;
  serialNumber?: string;
  subject?: string;
  useTime?: string;
  expirTime?: string;
  remark?: string;
  archiveTime?: string;
}

export interface ArchiveKeyForm {
  id?: string | number;
  caId?: string | number;
  keyType: string;
  keyBits: number;
  serialNumber?: string;
  subject?: string;
  useTime?: string;
  expirTime?: string;
  remark?: string;
  archiveTime?: string;
}

export interface ArchiveKeyQuery extends PageQuery {
  keyType?: string;
  subject?: string;
  serialNumber?: string;
}
