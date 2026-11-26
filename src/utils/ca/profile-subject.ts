export const subjectFieldOptions = [
  { value: 'country', label: '国家(C)', oid: '2.5.4.6' },
  { value: 'organization', label: '组织(O)', oid: '2.5.4.10' },
  { value: 'organizationalUnit', label: '组织单位(OU)', oid: '2.5.4.11' },
  { value: 'commonName', label: '通用名称(CN)', oid: '2.5.4.3' },
  { value: 'stateOrProvince', label: '省/州(ST)', oid: '2.5.4.8' },
  { value: 'locality', label: '城市(L)', oid: '2.5.4.7' },
  { value: 'streetAddress', label: '街道地址', oid: '2.5.4.9' },
  { value: 'postalCode', label: '邮政编码', oid: '2.5.4.17' },
  { value: 'serialNumber', label: '序列号', oid: '2.5.4.5' },
  { value: 'emailAddress', label: '邮箱(E)', oid: '1.2.840.113549.1.9.1' },
  { value: 'givenName', label: '名字(GN)', oid: '2.5.4.42' },
  { value: 'surname', label: '姓氏(SN)', oid: '2.5.4.4' },
  { value: 'initials', label: '姓名首字母', oid: '2.5.4.43' },
  { value: 'generationQualifier', label: '代际限定符', oid: '2.5.4.44' },
  { value: 'title', label: '头衔(T)', oid: '2.5.4.12' },
  { value: 'userId', label: '用户ID(UID)', oid: '0.9.2342.19200300.100.1.1' },
  { value: 'uniqueIdentifier', label: '唯一标识符', oid: '2.5.4.45' },
  { value: 'dnQualifier', label: 'DN限定符', oid: '2.5.4.46' },
  { value: 'pseudonym', label: '假名', oid: '2.5.4.65' },
  { value: 'domainComponent', label: '域名组件(DC)', oid: '0.9.2342.19200300.100.1.25' },
  { value: 'businessCategory', label: '业务类别', oid: '2.5.4.15' },
  { value: 'unstructuredName', label: '非结构化名称', oid: '1.2.840.113549.1.9.2' },
  { value: 'unstructuredAddress', label: '非结构化地址', oid: '1.2.840.113549.1.9.8' },
  { value: 'jurisdictionLocalityName', label: '管辖城市', oid: '1.3.6.1.4.1.311.60.2.1.1' },
  { value: 'jurisdictionStateOrProvinceName', label: '管辖省/州', oid: '1.3.6.1.4.1.311.60.2.1.2' },
  { value: 'jurisdictionCountryName', label: '管辖国家', oid: '1.3.6.1.4.1.311.60.2.1.3' },
  { value: 'organizationIdentifier', label: '组织标识符', oid: '2.5.4.97' },
  { value: 'description', label: '描述', oid: '2.5.4.13' },
  { value: 'postalAddress', label: '邮政地址', oid: '2.5.4.16' },
  { value: 'telephoneNumber', label: '电话号码', oid: '2.5.4.20' },
  { value: 'name', label: '姓名', oid: '2.5.4.41' },
  { value: 'nameAtBirth', label: '出生时姓名', oid: '1.3.36.8.3.14' },
  { value: 'dmdName', label: '目录管理域名称', oid: '2.5.4.54' },
  { value: 'dateOfBirth', label: '出生日期', oid: '1.3.6.1.5.5.7.9.1' },
  { value: 'placeOfBirth', label: '出生地', oid: '1.3.6.1.5.5.7.9.2' },
  { value: 'gender', label: '性别', oid: '1.3.6.1.5.5.7.9.3' },
  { value: 'countryOfCitizenship', label: '国籍', oid: '1.3.6.1.5.5.7.9.4' },
  { value: 'countryOfResidence', label: '居住国', oid: '1.3.6.1.5.5.7.9.5' }
];

export type SubjectFieldType = string | { oid?: string; description?: string } | null | undefined;

const fieldAliases = new Map(
  Object.entries({
    c: 'country',
    countryName: 'country',
    o: 'organization',
    organizationName: 'organization',
    ou: 'organizationalUnit',
    organizationUnit: 'organizationalUnit',
    organizationalUnitName: 'organizationalUnit',
    cn: 'commonName',
    st: 'stateOrProvince',
    s: 'stateOrProvince',
    state: 'stateOrProvince',
    stateOrProvinceName: 'stateOrProvince',
    l: 'locality',
    localityName: 'locality',
    street: 'streetAddress',
    sn: 'surname',
    e: 'emailAddress',
    email: 'emailAddress',
    gn: 'givenName',
    i: 'initials',
    t: 'title',
    uid: 'userId',
    x500UniqueIdentifier: 'uniqueIdentifier',
    dnq: 'dnQualifier',
    dc: 'domainComponent',
    oi: 'organizationIdentifier',
    telephone: 'telephoneNumber',
    jil: 'jurisdictionLocalityName',
    jis: 'jurisdictionStateOrProvinceName',
    jic: 'jurisdictionCountryName',
    jurIncorporationLocality: 'jurisdictionLocalityName',
    jurIncorporationState: 'jurisdictionStateOrProvinceName',
    jurIncorporationCountry: 'jurisdictionCountryName',
    jurisdictionOfIncorporationLocalityName: 'jurisdictionLocalityName',
    jurisdictionOfIncorporationStateOrProvinceName: 'jurisdictionStateOrProvinceName',
    jurisdictionOfIncorporationCountryName: 'jurisdictionCountryName'
  }).map(([alias, value]) => [alias.toLowerCase(), value])
);

const isOid = (value: string) => /^[0-2](?:\.\d+)+$/.test(value);

function resolveSubjectField(type: SubjectFieldType) {
  const text = typeof type === 'string' ? type.trim() : type?.description?.trim() || '';
  const oid = (typeof type === 'string' ? '' : type?.oid?.trim()) || (isOid(text) ? text : '');
  const name = fieldAliases.get(text.toLowerCase()) || text.toLowerCase();
  const field = oid
    ? subjectFieldOptions.find((item) => item.oid === oid)
    : subjectFieldOptions.find((item) => item.value.toLowerCase() === name.toLowerCase());
  return { oid: field?.oid || oid, field, text };
}

export function getSubjectTypeDisplay(type: SubjectFieldType) {
  const { oid, field, text } = resolveSubjectField(type);
  return { oid, label: field?.label || text || oid };
}

export function getSubjectTypeValue(type: SubjectFieldType) {
  const { oid, field, text } = resolveSubjectField(type);
  return field?.value || oid || text;
}

export function formatSubjectTypeLabel({ oid, label }: { oid: string; label: string }) {
  return oid && oid !== label ? `${label} (${oid})` : label;
}

export function getSubjectTypeOid(value: string) {
  return resolveSubjectField(value).oid;
}
