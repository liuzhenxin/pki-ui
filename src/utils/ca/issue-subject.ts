import { sortSubjectItems, typeMapping, type SubjectItem } from '@/components/CertSubject/index.vue';
import { formatSubjectTypeLabel, getSubjectTypeDisplay, getSubjectTypeOid, getSubjectTypeValue, type SubjectFieldType } from './profile-subject';

interface ProfileRdn {
  type?: SubjectFieldType;
  minOccurs?: number;
  maxOccurs?: number;
}

export function buildCaIssueSubjectItems(subject: ProfileRdn[] | { rdns?: ProfileRdn[] }): SubjectItem[] {
  const rdns = Array.isArray(subject) ? subject : subject.rdns;
  if (!Array.isArray(rdns)) return [];

  const items: SubjectItem[] = [];
  for (const rdn of rdns) {
    const type = getSubjectTypeValue(rdn.type);
    if (!type) continue;

    const label = formatSubjectTypeLabel(getSubjectTypeDisplay(rdn.type));
    const { minOccurs, maxOccurs } = rdn;
    const count = Math.max(1, minOccurs ?? 1);
    for (let i = 0; i < count; i++) {
      items.push({ type, label, value: '', minOccurs, maxOccurs });
    }
  }
  return sortSubjectItems(items);
}

export function formatCaIssueSubject(items: SubjectItem[]): string {
  return items
    .filter((item) => item.value)
    .map(({ type, value }) => {
      const key = typeMapping[type]?.key || getSubjectTypeOid(type) || type;
      return `${key}=${value}`;
    })
    .join(',');
}
