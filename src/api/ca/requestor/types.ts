// 请求者查询参数
export interface RequestorQuery {
  pageNum?: number;
  pageSize?: number;
  name?: string;
  type?: string;
}

// 请求者表单
export interface RequestorForm {
  id?: string | number;
  name?: string;
  type?: string;
  conf?: string; // 证书的PEM编码数据
}

// 请求者对象
export interface RequestorCO {
  id: string | number;
  name: string;
  type?: string;
  conf?: string; // 证书的PEM编码数据
  createTime?: string;
  updateTime?: string;
}