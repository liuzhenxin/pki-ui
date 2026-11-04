// 产品由可信构建配置确定，不能从浏览器tenant/localStorage推断。
if (import.meta.env.VITE_APP_PRODUCT === 'csp') {
  void import('./products/csp/bootstrap');
} else {
  void import('./platform-main');
}
