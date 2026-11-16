import request from '@/utils/request';
import type { Result } from '@/api/types';
import type { UserForm, UserQuery, UserVO } from '@/api/system/user/types';

const auditorUsersUrl = '/ra/v1/auditor-users';

export function listAuditorUsers(query: UserQuery) {
  return request<unknown, Result<{ rows?: UserVO[]; records?: UserVO[]; total: number }>>({
    url: auditorUsersUrl + '/page',
    method: 'post',
    data: query
  });
}

export function getAuditorUser(id: string | number) {
  return request<unknown, Result<UserVO & Pick<UserForm, 'deptId'>>>({ url: auditorUsersUrl + '/' + id, method: 'get' });
}

export function addAuditorUser(form: UserForm) {
  return request({ url: auditorUsersUrl, method: 'post', data: { co: form } });
}

export function updateAuditorUser(form: UserForm) {
  return request({ url: auditorUsersUrl, method: 'put', data: { co: form } });
}

export function deleteAuditorUsers(ids: string | number | Array<string | number>) {
  return request({ url: auditorUsersUrl, method: 'delete', data: Array.isArray(ids) ? ids : [ids] });
}

export function resetAuditorPassword(id: string | number, password: string) {
  return request({
    url: auditorUsersUrl + '/reset-pwd',
    method: 'put',
    headers: { isEncrypt: true, repeatSubmit: false },
    data: { co: { id, password } }
  });
}

export function updateAuditorStatus(id: string | number, status: number) {
  return request({ url: auditorUsersUrl + '/status', method: 'put', data: { co: { id, status } } });
}
