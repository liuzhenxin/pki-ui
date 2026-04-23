import request from '@/utils/request';

/** 查询登录日志列表 */
export function list(query: any) {
  return request({
    url: '/admin/v1/login-logs/page',
    method: 'post',
    data: query
  });
}

/** 查询登录日志详细 */
export function getLoginLog(id: string | number) {
  return request({
    url: `/admin/v1/login-logs/${id}`,
    method: 'get'
  });
}

/** 新增登录日志 */
export function addLoginLog(data: any) {
  return request({
    url: '/admin/v1/login-logs',
    method: 'post',
    data: data
  });
}

/** 修改登录日志 */
export function updateLoginLog(data: any) {
  return request({
    url: '/admin/v1/login-logs',
    method: 'put',
    data: data
  });
}

/** 删除登录日志 */
export function delLoginLog(ids: (string | number)[]) {
  return request({
    url: '/admin/v1/login-logs',
    method: 'delete',
    data: ids
  });
}

/** 导出登录日志 */
export function exportLoginLog(query: any) {
  return request({
    url: '/admin/v1/login-logs/export',
    method: 'post',
    data: query,
    responseType: 'blob'
  });
}