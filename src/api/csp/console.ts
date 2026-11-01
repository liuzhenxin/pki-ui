export interface SetupView {
  workflow: 'SERVICE_ACTIVATION_V3';
  initialized: boolean;
  draftVersion: number;
  step: number;
  attempted: boolean;
  serviceVersion: string;
  environment: string;
  checkedAt: string | null;
  checks: { group: 'ENVIRONMENT' | 'RESOURCES' | 'POLICY'; code: string; ready: boolean }[];
  enabledCapabilities: 'RANDOM'[];
}
export type SetupAction = 'CHECK_ENV' | 'CHECK_RESOURCES' | 'CHECK_POLICY';
/** 固定同源BFF契约；浏览器不持有Auth令牌或OAuth客户端秘密。 */
export interface ConsoleResponses {
  session: { csrf: string; authenticated: boolean; initializationAttempted?: boolean; certificateLoginEnabled?: boolean; httpTestMode?: boolean };
  challenge: { csrf: string; captchaEnabled: boolean; image: string };
  login: { authenticated: boolean };
  'certificate-challenge': { challengeId: string; signData: string; sm2UserId: string };
  'certificate-login': { authenticated: boolean };
  state: { initialized: boolean };
  setup: SetupView;
  'setup-advance': SetupView;
  'setup-complete': SetupView;
  environment: { checks: { name: string; ok: boolean }[] };
  initialize: { initialized: boolean; reauthenticationRequired: boolean };
  logout: { authenticated: boolean };
}
export interface ConsoleCommands {
  session: undefined;
  challenge: undefined;
  login: { username: string; password: string; captcha: string };
  'certificate-challenge': { certificate: string };
  'certificate-login': { challengeId: string; signature: string };
  state: undefined;
  setup: undefined;
  'setup-advance': { draftVersion: number; action: SetupAction };
  'setup-complete': { draftVersion: number; confirm: true };
  environment: undefined;
  initialize: { confirm: true };
  logout: Record<string, never>;
}
const endpoints = [
  'session',
  'challenge',
  'login',
  'certificate-challenge',
  'certificate-login',
  'state',
  'setup',
  'setup-advance',
  'setup-complete',
  'environment',
  'initialize',
  'logout'
];
export class ConsoleRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}
export async function consoleRequest<K extends keyof ConsoleResponses>(
  path: K,
  csrf: string,
  body?: ConsoleCommands[K]
): Promise<ConsoleResponses[K]> {
  if (!endpoints.includes(path)) throw new Error('请求不受支持。');
  const response = await fetch('/console-api/' + path, {
    method: body ? 'POST' : 'GET',
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await response.json();
  if (!response.ok) throw new ConsoleRequestError(typeof data?.message === 'string' ? data.message : '请求未完成，请稍后手动重试。', response.status);
  return data;
}
