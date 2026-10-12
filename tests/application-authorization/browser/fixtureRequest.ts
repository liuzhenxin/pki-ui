export default async function request(options: {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, unknown>;
}) {
  const params = new URLSearchParams(
    Object.entries(options.params ?? {})
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, String(value)])
  );
  const response = await fetch('/__fixture' + options.url + (params.size ? '?' + params : ''), {
    method: options.method.toUpperCase(),
    headers: {
      'Content-Type': 'application/json',
      ...Object.fromEntries(Object.entries(options.headers ?? {}).map(([key, value]) => [key, String(value)]))
    },
    body: options.data === undefined ? undefined : JSON.stringify(options.data)
  });
  if (!response.ok) throw new Error('Fixture HTTP denial');
  return response.json();
}
