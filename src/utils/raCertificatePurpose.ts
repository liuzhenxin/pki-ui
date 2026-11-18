const extendedUsages: Record<string, string> = {
  '1.3.6.1.5.5.7.3.1': '服务器身份验证',
  serverAuth: '服务器身份验证',
  '1.3.6.1.5.5.7.3.2': '客户端身份验证',
  clientAuth: '客户端身份验证',
  '1.3.6.1.5.5.7.3.3': '代码签名',
  codeSigning: '代码签名',
  '1.3.6.1.5.5.7.3.4': '电子邮件保护',
  emailProtection: '电子邮件保护',
  '1.3.6.1.5.5.7.3.8': '时间戳',
  timeStamping: '时间戳',
  '1.3.6.1.5.5.7.3.9': 'OCSP 签名',
  OCSPSigning: 'OCSP 签名',
  '2.5.29.37.0': '任意增强密钥用法',
  anyExtendedKeyUsage: '任意增强密钥用法'
};

const templatePurposes: Record<string, string> = {
  EMAIL: '电子邮件保护',
  SMIME: '电子邮件保护',
  'S/MIME': '电子邮件保护',
  TLS: 'TLS',
  TLS_SERVER: '服务器身份验证',
  TLS_CLIENT: '客户端身份验证',
  TLS_ENC: 'TLS 加密',
  OCSP: 'OCSP 签名'
};

export function extendedUsageText(usages?: string[]) {
  return [...new Set((usages || []).map((usage) => extendedUsages[usage] ?? usage))].join('、');
}

export function templatePurpose(profile?: { profileType?: string; extendedKeyUsages?: string[] }) {
  if (!profile) return '';
  return extendedUsageText(profile.extendedKeyUsages) || templatePurposes[profile.profileType?.trim().toUpperCase() || ''] || '未声明具体用途';
}
