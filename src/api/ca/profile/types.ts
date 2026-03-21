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
  metadata?: {
    category: string;
    details: string;
  };
  maxSize?: number;
  validity?: string;
  notBeforeTime?: string;
  keyAlgorithms?: string[];
  signatureAlgorithms?: string[];
  keypairGeneration?: {
    inheritCA: boolean;
    forbidden: boolean;
  };
  conf?: string;
  subjectItems?: any[];
  subjectToSubjectAltNames?: any[];
  extensions?: any[];
}
