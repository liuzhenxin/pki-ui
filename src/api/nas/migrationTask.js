import request from '@/utils/request';

// 查询迁移任务列表
export function listTask(query) {
  const pageNum = Number(query?.pageNum || 1);
  const pageSize = Number(query?.pageSize || 10);
  return request({
    url: '/nas/v1/migration-tasks/page',
    method: 'post',
    data: {
      ...query,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    }
  });
}

// 查询全部迁移任务列表
export function listAllTasks(query) {
  return request({
    url: '/nas/v1/migration-tasks/list',
    method: 'post',
    data: query || {}
  });
}

// 查询迁移任务详细
export function getTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id,
    method: 'get'
  });
}

// 新增迁移任务
export function addTask(data) {
  return request({
    url: '/nas/v1/migration-tasks',
    method: 'post',
    data: data
  });
}

// 修改迁移任务
export function updateTask(data) {
  return request({
    url: '/nas/v1/migration-tasks',
    method: 'put',
    data: data
  });
}

// 删除迁移任务
export function delTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id,
    method: 'delete'
  });
}

// 启动迁移任务
export function startTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id + '/start',
    method: 'post'
  });
}

// 停止迁移任务
export function stopTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id + '/stop',
    method: 'post'
  });
}

// 重新迁移任务
export function remigrateTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id + '/remigrate',
    method: 'post'
  });
}

// 获取源路径文件数
export function countSourceFiles(sourcePath) {
  return request({
    url: '/nas/v1/migration-tasks/source-file-count',
    method: 'post',
    data: { sourcePath }
  });
}

// 查询迁移失败记录列表
export function listFailureRecords(query) {
  const pageNum = Number(query?.pageNum || 1);
  const pageSize = Number(query?.pageSize || 10);
  return request({
    url: '/nas/v1/migration-failure-records/page',
    method: 'post',
    data: {
      ...query,
      pageNum,
      pageSize,
      pageIndex: (pageNum - 1) * pageSize
    }
  });
}

// 重新迁移失败记录
export function retryFailureRecord(id) {
  return request({
    url: '/nas/v1/migration-failure-records/' + id + '/retry',
    method: 'post'
  });
}
