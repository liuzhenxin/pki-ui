import { isAxiosError } from 'axios';

export function isRaActionUnavailable(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  const code = error.response?.data?.code;
  return status === 404 || status === 405 || ['404', '405', 'Not_Found', 'Method_Not_Allowed'].includes(String(code));
}
