import request from '@/utils/request';
import { Result } from '@/api/types';

export function pagePublisher(query: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/publishers/page',
    method: 'post',
    data: query
  }) as any;
}

export function getPublisher(id: string | number): Promise<Result<any>> {
  return request({
    url: `/ca/v1/publishers/${id}`,
    method: 'get'
  }) as any;
}

export function savePublisher(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/publishers',
    method: 'post',
    data
  }) as any;
}

export function modifyPublisher(data: any): Promise<Result<any>> {
  return request({
    url: '/ca/v1/publishers',
    method: 'put',
    data
  }) as any;
}

export function removePublisher(ids: (string | number)[]): Promise<Result<any>> {
  return request({
    url: '/ca/v1/publishers',
    method: 'delete',
    data: ids
  }) as any;
}

export function importPublisher(formData: FormData): Promise<Result<any>> {
  return request({
    url: '/ca/v1/publishers/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  }) as any;
}

export function exportPublisher(query: any): Promise<any> {
  return request({
    url: '/ca/v1/publishers/export',
    method: 'post',
    data: query,
    responseType: 'blob'
  }) as any;
}
