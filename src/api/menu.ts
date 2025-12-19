import request from '@/utils/request';
import { AxiosPromise } from 'axios';
import { RouteRecordRaw } from 'vue-router';
import { Result } from '@/api/types';

// 获取路由
export function getRouters(): Promise<Result<RouteRecordRaw[]>> {
  return request({
    url: '/system/menu/getRouters',
    method: 'get'
  }) as any;
}

// 获取初始化路由
export function getInitRouters(): Promise<Result<RouteRecordRaw[]>> {
  return request({
    url: '/admin/api/v1/menus/list-tree-init',
    method: 'post'
  }) as any;
}
