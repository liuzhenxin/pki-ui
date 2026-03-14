import request from '@/utils/request';
import { Result } from '@/api/types';

// 获取环境信息
export function getEnvInfo(): Promise<Result<any>> {
  // 模拟 API 返回
  const envInfo = {
    os: { name: '操作系统', value: 'Linux', status: 'success' },
    database: { name: '数据库连接', value: '正常', status: 'success' },
    redis: { name: 'Redis连接', value: '正常', status: 'success' }
  };
  return Promise.resolve({
    code: 'OK',
    data: envInfo,
    msg: '请求成功'
  });
}

// 初始化管理员
export function initAdmin(data: any): Promise<Result<any>> {
  console.log('调用初始化管理员接口', data);
  // 模拟成功返回
  return Promise.resolve({
    code: 'OK',
    data: null,
    msg: '设置成功'
  });
}
