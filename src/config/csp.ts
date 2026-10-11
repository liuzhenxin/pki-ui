/** 产品来自构建配置，租户只作一致性约束；不从浏览器存储推断产品。 */
export const cspProduct = Object.freeze({
  code: 'csp',
  tenantId: '10',
  tenantCode: 'csp',
  name: '密码服务平台',
  version: '3.0.0-rc.1',
  setup: '/csp/setup',
  home: '/csp/overview'
});
export function assertCspProduct(product: unknown, tenant: unknown) {
  if (product !== cspProduct.code || tenant !== cspProduct.tenantId) throw new Error('CSP_PRODUCT_CONFIGURATION_INVALID');
}
