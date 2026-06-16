export interface LicenseVO {
  id: string | number;
  tenantId?: string | number;
  licenseId: string;
  customerId?: string | number;
  customerName: string;
  productId?: string | number;
  product: string;
  productVersion?: string;
  edition: string;
  issuedAt?: string;
  notBefore?: string;
  notAfter?: string;
  features: string[];
  maxUsers?: number;
  maxDevices?: number;
  maxServerNodes?: number;
  offlineDays?: number;
  bindingType?: string;
  fingerprintHash?: string;
  auditPolicy?: string;
  status?: string;
  licenseJson?: string;
  remark?: string;
}

export interface LicenseForm {
  customerName: string;
  contact?: string;
  phone?: string;
  email?: string;
  product: string;
  productVersion: string;
  edition: string;
  notBefore: string;
  notAfter: string;
  features: string[];
  maxUsers: number;
  maxDevices: number;
  maxServerNodes: number;
  offlineDays: number;
  bindingType: string;
  fingerprintHash: string;
  auditPolicy: string;
  remark?: string;
}

export interface LicenseQuery extends PageQuery {
  customerName?: string;
  product?: string;
  edition?: string;
  status?: string;
}

export interface LicenseVerifyForm {
  licenseJson: string;
  product?: string;
  feature?: string;
  fingerprintHash?: string;
}

export interface LicenseVerifyVO {
  valid: boolean;
  licenseId?: string;
  product?: string;
  customer?: string;
  edition?: string;
  status?: string;
  features: string[];
  checks: string[];
  errors: string[];
}

export interface ProductVO {
  id?: string | number;
  name: string;
  productVersion?: string;
  remark?: string;
}

export interface ProductQuery extends PageQuery {
  name?: string;
  productVersion?: string;
}
