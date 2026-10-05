import { randomUUID } from 'node:crypto';

export const categories = [
  'password',
  'PIN',
  'Bearer',
  'JWT',
  'refreshToken',
  'reauthProof',
  'privateKey',
  'keyMaterial',
  'businessPlaintext',
  'slot',
  'handle',
  'physicalIndex',
  'providerKeyRef'
] as const;
export const createCanaries = () => Object.fromEntries(categories.map((category) => [category, `CSP_SYNTHETIC_${category}_${randomUUID()}`]));
export const detectCanaries = (content: string | Buffer, values: Record<string, string>) => {
  const text = content.toString();
  return Object.entries(values)
    .filter(([, value]) => text.includes(value))
    .map(([category]) => category);
};
