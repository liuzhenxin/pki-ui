import { expect, test } from 'vitest';

test('@csp-smoke-unit DOM environment', () => {
  const element = document.createElement('main');
  element.textContent = '密码服务平台';
  expect(element.textContent).toBe('密码服务平台');
});
