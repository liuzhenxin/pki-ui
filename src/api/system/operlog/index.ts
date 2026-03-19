import request from '@/utils/request';

/** 查询操作日志列表 */
export function list(query: any) {
  return request({
    url: '/admin/api/v1/operate-logs/page',
    method: 'post',
    data: query
  });
}

/** 查询操作日志详细 */
export function getOperLog(id: string | number) {
  return request({
    url: `/admin/api/v1/operate-logs/${id}`,
    method: 'get'
  });
}

/** 新增操作日志 */
export function addOperLog(data: any) {
  return request({
    url: '/admin/api/v1/operate-logs',
    method: 'post',
    data: data
  });
}

/** 修改操作日志 */
export function updateOperLog(data: any) {
  return request({
    url: '/admin/api/v1/operate-logs',
    method: 'put',
    data: data
  });
}

/** 删除操作日志 */
export function delOperLog(ids: (string | number)[]) {
  return request({
    url: '/admin/api/v1/operate-logs',
    method: 'delete',
    data: ids
  });
}

/** 导出操作日志 */
export function exportOperLog(query: any) {
  return request({
    url: '/admin/api/v1/operate-logs/export',
    method: 'post',
    data: query,
    responseType: 'blob'
  });
}