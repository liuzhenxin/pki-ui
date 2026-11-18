import type { Router } from 'vue-router';

export function intranetCertSyncLocation(router: Router, sourceCertId?: string | number, serialNumber?: string) {
  const paths = ['/ra-cert-management/ra-intranet-cert', '/ra-certificate/ra-intranet-cert'];
  const path = paths.find((candidate) => router.getRoutes().some((route) => route.path === candidate));
  if (!path || (!sourceCertId && !serialNumber)) return;
  return { path, query: sourceCertId ? { sourceCertId: String(sourceCertId) } : { serialNumber } };
}
