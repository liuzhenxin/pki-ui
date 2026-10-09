// 仅允许用户主动调用固定 loopback SKF 服务，不向平台发送 PIN。
let connection: WebSocket | null = null;
let sequence = 0;
export function closeSkf() {
  connection?.close();
  connection = null;
}
export async function skfCall(method: 'FindCertificates' | 'CheckPIN' | 'SignData', params: string[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const socket = connection || new WebSocket('ws://127.0.0.1:9001');
    connection = socket;
    const id = ++sequence;
    const timer = setTimeout(() => finish(new Error('本机 SKF 服务超时，请手动重试。')), 15000);
    let settled = false;
    function finish(error?: Error, value?: unknown) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.onmessage = null;
      socket.onopen = null;
      if (error) {
        closeSkf();
        reject(error);
      } else resolve(value);
    }
    const send = () => {
      socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
      params = [];
    };
    socket.onopen = send;
    if (socket.readyState === WebSocket.OPEN) send();
    socket.onerror = () => finish(new Error('无法连接本机 SKF 服务，请确认服务已启动。'));
    socket.onclose = () => finish(new Error('本机 SKF 服务已断开。'));
    socket.onmessage = (event) => {
      try {
        if (typeof event.data !== 'string' || event.data.length > 1024 * 1024) throw new Error();
        const reply = JSON.parse(event.data);
        if (reply.id !== id) return;
        if (reply.error) finish(new Error('USB Key 操作未通过，请检查设备；不会自动重试 PIN。'));
        else finish(undefined, reply.result);
      } catch {
        finish(new Error('本机 SKF 响应无效。'));
      }
    };
  });
}
