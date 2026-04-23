import request from '@/utils/request'

// 查询迁移任务列表
export function listTask(query) {
  return request({
    url: '/nas/v1/migration-tasks/page',
    method: 'post',
    data: query
  })
}

// 查询迁移任务详细
export function getTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id,
    method: 'get'
  })
}

// 新增迁移任务
export function addTask(data) {
  return request({
    url: '/nas/v1/migration-tasks',
    method: 'post',
    data: data
  })
}

// 修改迁移任务
export function updateTask(data) {
  return request({
    url: '/nas/v1/migration-tasks',
    method: 'put',
    data: data
  })
}

// 删除迁移任务
export function delTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id,
    method: 'delete'
  })
}

// 启动迁移任务
export function startTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id + '/start',
    method: 'post'
  })
}

// 停止迁移任务
export function stopTask(id) {
  return request({
    url: '/nas/v1/migration-tasks/' + id + '/stop',
    method: 'post'
  })
}
