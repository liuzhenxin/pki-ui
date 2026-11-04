import type { BrowserContext } from '@playwright/test';
import { profile } from './auth';
import { navigation } from './menu';

export async function strictNetwork(context: BrowserContext) {
  const failures: string[] = [];
  const routes = new Map<string, Record<string, unknown>>([
    ['POST /admin/v1/menus/list-tree-user', { code: 'OK', msg: 'ok', data: navigation }],
    ['GET /admin/v1/users/profile', profile],
    ['GET /csp/mock/status', { evidenceKind: 'mock', state: 'FAIL_CLOSED' }]
  ]);
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = routes.get(`${request.method()} ${url.pathname}`);
    if (url.origin !== 'http://csp.test' || !body || [...url.searchParams.keys()].some((key) => /authorization|secret|credential|token/i.test(key))) {
      failures.push(`${request.method()} ${url.origin}${url.pathname}`);
      await route.abort();
    } else {
      await route.fulfill({ json: body, headers: { 'access-control-allow-origin': '*' } });
    }
  });
  await context.routeWebSocket('**/*', (socket) => {
    failures.push('Unregistered realtime connection');
    socket.close();
  });
  return {
    assertClean() {
      if (failures.length) throw new Error('Unregistered mock network request');
    },
    failures
  };
}
