/** 登录日志表单对象 */
export interface LoginLogForm {
  id?: string | number;
  username?: string;
  ip?: string;
  address?: string;
  browser?: string;
  os?: string;
  status?: number;
  errorMessage?: string;
  createTime?: string;
}

/** 登录日志查询对象 */
export interface LoginLogQuery {
  pageNum?: number;
  pageSize?: number;
  ip?: string;
  username?: string;
  status?: number;
  beginTime?: string;
  endTime?: string;
}