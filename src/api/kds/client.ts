import request from '@/utils/request';

/** KDS 统一由平台 BFF 代理；签名在 BFF 完成，前端不接触任何私钥或签名材料。 */
const PREFIX = '/platform/kds';

interface KdsEnvelope<T> {
  code?: string;
  msg?: string;
  data: T;
}

/** 调用 KDS 代理端点并解包 data；失败时抛出携带 code/msg 的错误。 */
export async function kdsPost<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const envelope = (await request({
    url: `${PREFIX}/${action}`,
    method: 'post',
    data: body
  })) as unknown as KdsEnvelope<T>;
  if (envelope && envelope.code && envelope.code !== '9000') {
    const error = new Error(envelope.msg || 'KDS 请求失败');
    (error as Error & { code?: string }).code = envelope.code;
    throw error;
  }
  return envelope ? envelope.data : (undefined as T);
}

export interface KdsError {
  code?: string;
  message: string;
}

export function toKdsError(error: unknown): KdsError {
  if (error instanceof Error) {
    return { code: (error as Error & { code?: string }).code, message: error.message };
  }
  return { message: 'KDS 请求失败' };
}
