// 请求者查询参数
export interface RequestorQuery {
  pageNum?: number;
  pageSize?: number;
  name?: string;
  requestorType?: string;
  type?: string;
}

// 请求者表单
export interface RequestorForm {
  id?: string | number;
  name?: string;
  requestorType?: string;
  type?: string;
  conf?: string; // 证书的PEM编码数据
  certificatePem?: string;
  subjectDn?: string;
  status?: string;
  remark?: string;
}

// 请求者对象
export interface RequestorCO {
  id: string | number;
  name: string;
  requestorType?: string;
  type?: string;
  conf?: string; // 证书的PEM编码数据
  status?: string;
  certificateFingerprint?: string;
  subjectDn?: string;
  issuerDn?: string;
  serialNumber?: string;
  notBefore?: string;
  notAfter?: string;
  remark?: string;
  createTime?: string;
  updateTime?: string;
}
