/** 操作日志表单对象 */
export interface OperLogForm {
  id?: string | number;
  moduleName?: string;
  methodName?: string;
  operator?: string;
  ip?: string;
  address?: string;
  requestType?: string;
  uri?: string;
  requestParams?: string;
  errorMessage?: string;
  stackTrace?: string;
  status?: number;
  createTime?: string;
  costTime?: number;
  serviceId?: string;
  serviceAddress?: string;
  userAgent?: string;
}

/** 操作日志查询对象 */
export interface OperLogQuery {
  pageNum?: number;
  pageSize?: number;
  moduleName?: string;
  methodName?: string;
  operator?: string;
  status?: number;
  beginTime?: string;
  endTime?: string;
}