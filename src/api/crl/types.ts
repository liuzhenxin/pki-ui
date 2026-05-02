/**
 * CRL查询对象类型
 */
export interface CrlQuery {
  pageNum?: number;
  pageSize?: number;
  rootId?: string | number;
  crlNo?: string;
  deltaCrl?: number | string;
  crlName?: string; // 兼容旧字段
  issuer?: string; // 兼容旧字段
  status?: string; // 兼容旧字段
}

/**
 * CRL表单类型
 */
export interface CrlForm {
  id?: string | number;
  rootId?: string | number;
  crlScope?: number;
  crlNo?: string;
  crlName?: string; // 兼容旧字段
  issuer?: string; // 兼容旧字段
  crl?: string;
  status?: string; // 兼容旧字段
  thisUpdate?: string;
  nextBefore?: string;
  nextUpdate?: string; // 兼容旧字段
  deltaCrl?: number;
  baseCrlNo?: string | number;
  sha1?: string;
  remark?: string;
}

export interface CrlGenForm {
  rootId?: string | number;
  crlScope?: number;
  deltaCrl?: boolean;
}

export interface CrlPublishForm {
  crlId?: string | number;
  publisherId?: string | number;
}
