import { PageQuery } from '@/api/types';

/**
 * 证书模板查询对象类型
 */
export interface ProfileQuery extends PageQuery {
  name?: string;
  type?: string;
  certLevel?: string;
}

/**
 * 证书模板表单类型
 */
export interface ProfileForm {
  id?: string | number;
  name: string;
  type?: string;
  certLevel?: string;
  description?: string;
  conf?: string;
  subjectItems?: any[];
  extensions?: any[];
}