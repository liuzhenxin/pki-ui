/**
 * 证书查询对象类型
 */
export interface CertQuery {
  pageNum?: number;
  pageSize?: number;
  certSn?: string;       // 证书序列号
  subject?: string;      // 主题
  issuer?: string;       // 颁发者
  status?: string;       // 状态
  certType?: string;     // 证书类型
}

/**
 * 证书表单类型
 */
export interface CertForm {
  id?: string | number;
  certSn?: string;       // 证书序列号
  subject?: string;      // 主题
  issuer?: string;       // 颁发者
  cert?: string;         // 证书内容
  certType?: string;     // 证书类型
  status?: string;       // 状态
  notBefore?: string;    // 生效时间
  notAfter?: string;     // 失效时间
  remark?: string;       // 备注
}