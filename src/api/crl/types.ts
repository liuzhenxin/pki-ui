/**
 * CRL查询对象类型
 */
export interface CrlQuery {
  pageNum?: number;
  pageSize?: number;
  crlName?: string;     // CRL名称
  issuer?: string;      // 颁发者
  status?: string;      // 状态
}

/**
 * CRL表单类型
 */
export interface CrlForm {
  id?: string | number;
  crlName?: string;     // CRL名称
  issuer?: string;      // 颁发者
  crl?: string;         // CRL内容
  status?: string;      // 状态
  thisUpdate?: string;  // 本次更新时间
  nextUpdate?: string;  // 下次更新时间
  remark?: string;      // 备注
}