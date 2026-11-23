import { sortSubjectItems, typeMapping, type SubjectItem } from '@/components/CertSubject/index.vue';

interface ProfileRdn {
  type?: string | { oid?: string; description?: string; name?: string };
  minOccurs?: number;
  maxOccurs?: number;
  regex?: string;
}

const oidTypes: Record<string, string> = {
  '2.5.4.3': 'commonName',
  '2.5.4.4': 'surname',
  '2.5.4.5': 'serialNumber',
  '2.5.4.6': 'country',
  '2.5.4.7': 'locality',
  '2.5.4.8': 'stateOrProvince',
  '2.5.4.10': 'organization',
  '2.5.4.11': 'organizationalUnit',
  '2.5.4.12': 'title',
  '2.5.4.42': 'givenName',
  '0.9.2342.19200300.100.1.1': 'userId',
  '0.9.2342.19200300.100.1.25': 'domainComponent',
  '1.2.840.113549.1.9.1': 'emailAddress'
};

function normalizeType(value: string) {
  const name = value.trim().replace(/^OID\./i, '');
  const normalized = name.replace(/[\s_-]/g, '').toLowerCase();
  if (/^\d+\./.test(name) && oidTypes[name]) return oidTypes[name];
  if (normalized === 'sn' || normalized === '序列号(sn)') return 'serialNumber';
  if (normalized === 'stateorprovincename' || normalized === 'state') return 'stateOrProvince';
  if (normalized === 'localityname') return 'locality';
  if (normalized === 'email') return 'emailAddress';
  return Object.entries(typeMapping).find(([type, meta]) => type.toLowerCase() === normalized || meta.key.toLowerCase() === normalized)?.[0] ?? name;
}

export function buildIssueSubjectItems(configuration: ProfileRdn[] | { rdns?: ProfileRdn[] } | undefined, subject?: string | null) {
  const rdns = Array.isArray(configuration) ? configuration : configuration?.rdns;
  if (!Array.isArray(rdns)) return [];
  const values = new Map<string, string[]>();
  for (const rdn of subject?.match(/(?:\\.|[^\\,+])+/g) ?? []) {
    const index = rdn.indexOf('=');
    if (index < 1) continue;
    const key = normalizeType(rdn.slice(0, index));
    const value = rdn
      .slice(index + 1)
      .trim()
      .replace(/\\([,+"<>;=\\#])/g, '$1');
    const entries = values.get(key) ?? [];
    entries.push(value);
    values.set(key, entries);
  }
  const items: SubjectItem[] = [];
  for (const rdn of rdns) {
    const type = normalizeType(typeof rdn.type === 'string' ? rdn.type : rdn.type?.oid || rdn.type?.description || rdn.type?.name || '');
    if (!type) continue;
    const existing = values.get(type) ?? [];
    const minimum = rdn.minOccurs ?? 1;
    const count = Math.min(Math.max(1, minimum, existing.length), rdn.maxOccurs ?? Infinity);
    for (let i = 0; i < count; i++) {
      items.push({ type, value: existing[i] ?? '', minOccurs: i < minimum ? 1 : 0, maxOccurs: rdn.maxOccurs, regex: rdn.regex });
    }
  }
  return sortSubjectItems(items);
}

export function formatIssueSubject(items: SubjectItem[]) {
  return items
    .filter((item) => item.value?.trim())
    .map((item) => {
      const value = item.value!.trim().replace(/([,+"<>;=\\]|^#)/g, '\\$1');
      return `${typeMapping[item.type]?.key || item.type}=${value}`;
    })
    .join(',');
}
