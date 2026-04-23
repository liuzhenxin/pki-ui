import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { RouteRecordRaw } from 'vue-router';
import { Result } from '@/api/types';

// 获取路由
export function getRouters(query?: any): Promise<Result<RouteRecordRaw[]>> {
  return request({
    url: '/admin/v1/menus/list-tree-user',
    method: 'post',
    data: query
  }) as any;
}

// 获取初始化路由
export function getInitRouters(query?: any): Promise<Result<RouteRecordRaw[]>> {
  return request({
    url: '/admin/v1/menus/list-tree-init',
    method: 'post',
    data: query
  }) as any;
}
