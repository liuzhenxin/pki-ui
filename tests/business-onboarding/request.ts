export default async function request(options: { url: string; method: string; data?: unknown }) {
  const response = await fetch(options.url, {
    method: options.method,
    headers: { 'Content-Type': 'application/json' },
    body: options.data ? JSON.stringify(options.data) : undefined
  });
  if (!response.ok) throw new Error('request failed');
  return response.json();
}
