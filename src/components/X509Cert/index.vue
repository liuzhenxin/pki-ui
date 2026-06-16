<template>
  <div class="cert-container openssl-style">
    <div class="cert-details">
      <pre><code>{{ certText }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { X509, KEYUTIL, KJUR, ASN1HEX } from 'jsrsasign';
import { computed } from 'vue';

const props = defineProps({
  certPem: {
    type: String,
    default: ''
  }
});

const formatHexWithColonLines = (hex: string, indent: string, chunkLen = 15) => {
  if (!hex) return '';
  let res = '';
  // Convert hex to lowercase for typical OpenSSL style
  const chars = hex.toLowerCase().match(/.{1,2}/g) || [];
  for (let i = 0; i < chars.length; i += chunkLen) {
    const chunk = chars.slice(i, i + chunkLen).join(':');
    res += (i > 0 ? '\n' + indent : '') + chunk + (i + chunkLen < chars.length ? ':' : '');
  }
  return res;
};

const formatDateString = (zStr: string) => {
  try {
    let y, m, d, h, min, s;
    if (zStr.length === 13) {
      y = '20' + zStr.substring(0, 2);
      m = parseInt(zStr.substring(2, 4)) - 1;
      d = zStr.substring(4, 6);
      h = zStr.substring(6, 8);
      min = zStr.substring(8, 10);
      s = zStr.substring(10, 12);
    } else {
      y = zStr.substring(0, 4);
      m = parseInt(zStr.substring(4, 6)) - 1;
      d = zStr.substring(6, 8);
      h = zStr.substring(8, 10);
      min = zStr.substring(10, 12);
      s = zStr.substring(12, 14);
    }
    const date = new Date(Date.UTC(y as any, m, d as any, h as any, min as any, s as any));
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const pad = (n: number) => (n < 10 ? '0' + n : n);
    const padSpace = (n: number) => (n < 10 ? ' ' + n : n);
    return `${months[date.getUTCMonth()]} ${padSpace(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} ${date.getUTCFullYear()} GMT`;
  } catch (e) {
    return zStr;
  }
};

const formatDN = (array: any[]) => {
  if (!array || array.length === 0) return '';
  return array
    .map((e: any) => {
      const type = e[0].type;
      const val = e[0].value;
      return `${type} = ${val}`;
    })
    .join(', ');
};

const extensionNameMap: Record<string, string> = {
  subjectKeyIdentifier: 'X509v3 Subject Key Identifier',
  keyUsage: 'X509v3 Key Usage',
  subjectAltName: 'X509v3 Subject Alternative Name',
  issuerAltName: 'X509v3 Issuer Alternative Name',
  basicConstraints: 'X509v3 Basic Constraints',
  nameConstraints: 'X509v3 Name Constraints',
  cRLDistributionPoints: 'X509v3 CRL Distribution Points',
  certificatePolicies: 'X509v3 Certificate Policies',
  policyMappings: 'X509v3 Policy Mappings',
  authorityKeyIdentifier: 'X509v3 Authority Key Identifier',
  policyConstraints: 'X509v3 Policy Constraints',
  extKeyUsage: 'X509v3 Extended Key Usage',
  inhibitAnyPolicy: 'X509v3 Inhibit Any Policy',
  authorityInfoAccess: 'Authority Information Access',
  cRLNumber: 'X509v3 CRL Number',
  cRLReason: 'X509v3 CRL Reason',
  subjectDirectoryAttributes: 'X509v3 Subject Directory Attributes',
  ocspNonce: 'OCSP Nonce',
  ocspNoCheck: 'OCSP No Check',
  adobeTimeStamp: 'Adobe Timestamp',
  '1.3.6.1.5.5.7.1.11': 'Subject Information Access',
  '2.5.29.46': 'X509v3 Freshest CRL'
};

const generalNameToString = (name: any) => {
  if (!name) return '';
  if (name.dns) return `DNS:${name.dns}`;
  if (name.ip) return `IP Address:${name.ip}`;
  if (name.rfc822) return `email:${name.rfc822}`;
  if (name.uri) return `URI:${name.uri}`;
  if (name.dn?.str) return `DirName:${name.dn.str}`;
  if (name.dn) return `DirName:${JSON.stringify(name.dn)}`;
  if (name.other) return `otherName:${name.other.oid || ''}:${JSON.stringify(name.other.value || '')}`;
  return JSON.stringify(name);
};

const formatJsonBlock = (value: any, indent: string) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return text
    .split('\n')
    .map((line) => `${indent}${line}`)
    .join('\n');
};

const formatUnknownExtensionValue = (ext: any, indent = '                ') => {
  if (typeof ext.extn === 'string') {
    return `${indent}${formatHexWithColonLines(ext.extn, indent, 15)}`;
  }
  if (ext.extn !== undefined) {
    return formatJsonBlock(ext.extn, indent);
  }
  return formatJsonBlock(ext, indent);
};

const formatGenericExtension = (ext: any) => {
  const name = extensionNameMap[ext.extname] || ext.extname || 'Unknown Extension';
  const critical = ext.critical ? ' critical' : '';
  let text = `            ${name}:${critical}\n`;

  try {
    if (ext.extname === 'issuerAltName' && ext.array) {
      text += `                ${ext.array.map(generalNameToString).filter(Boolean).join(', ')}\n`;
      return text;
    }

    if (ext.extname === 'certificatePolicies' && ext.array) {
      ext.array.forEach((policy: any) => {
        text += `                Policy: ${policy.policyoid || '-'}\n`;
        (policy.array || []).forEach((qualifier: any) => {
          if (qualifier.cps) text += `                  CPS: ${qualifier.cps}\n`;
          if (qualifier.unotice) text += `                  User Notice: ${JSON.stringify(qualifier.unotice)}\n`;
        });
      });
      return text;
    }

    if (ext.extname === 'policyMappings' && ext.array) {
      ext.array.forEach((mapping: any[]) => {
        text += `                ${mapping[0]}:${mapping[1]}\n`;
      });
      return text;
    }

    if (ext.extname === 'policyConstraints') {
      const values = [];
      if (ext.reqexp !== undefined) values.push(`Require Explicit Policy:${ext.reqexp}`);
      if (ext.inhibit !== undefined) values.push(`Inhibit Policy Mapping:${ext.inhibit}`);
      text += `                ${values.join(', ') || '-'}\n`;
      return text;
    }

    if (ext.extname === 'inhibitAnyPolicy') {
      text += `                Skip Certs:${ext.skip ?? '-'}\n`;
      return text;
    }

    if (ext.extname === 'nameConstraints') {
      if (ext.permit) text += `                Permitted:\n${formatJsonBlock(ext.permit, '                  ')}\n`;
      if (ext.exclude) text += `                Excluded:\n${formatJsonBlock(ext.exclude, '                  ')}\n`;
      if (!ext.permit && !ext.exclude) text += `${formatUnknownExtensionValue(ext)}\n`;
      return text;
    }

    if (ext.extname === 'subjectDirectoryAttributes' && ext.array) {
      ext.array.forEach((attr: any) => {
        text += `                ${attr.attr}: ${JSON.stringify(attr.array || [])}\n`;
      });
      return text;
    }

    if (ext.extname === 'cRLNumber') {
      text += `                ${ext.num?.hex || ext.num || '-'}\n`;
      return text;
    }

    if (ext.extname === 'cRLReason') {
      text += `                Reason Code:${ext.code ?? '-'}\n`;
      return text;
    }

    if (ext.extname === 'ocspNonce') {
      text += `                ${formatHexWithColonLines(ext.hex || '', '                ', 15)}\n`;
      return text;
    }

    if (ext.extname === 'ocspNoCheck') {
      text += `                Yes\n`;
      return text;
    }

    if (ext.extname === 'adobeTimeStamp') {
      if (ext.uri) text += `                URI:${ext.uri}\n`;
      if (ext.reqauth !== undefined) text += `                Requires Auth:${ext.reqauth}\n`;
      return text;
    }
  } catch (e) {
    // fall back to raw rendering below
  }

  text += `${formatUnknownExtensionValue(ext)}\n`;
  return text;
};

const certText = computed(() => {
  if (!props.certPem) return '';

  const x509 = new X509();
  try {
    x509.readCertPEM(props.certPem);
  } catch (e) {
    console.error('Failed to read cert PEM', e);
    return 'Error parsing certificate';
  }

  let text = 'Certificate:\n';
  text += '    Data:\n';

  let version = 3;
  try {
    version = x509.getVersion();
  } catch (e) {}

  text += `        Version: ${version} (0x${version - 1})\n`;

  let serialHex = '';
  try {
    serialHex = x509.getSerialNumberHex();
  } catch (e) {}

  if (serialHex) {
    const formattedSerial =
      serialHex
        .toLowerCase()
        .match(/.{1,2}/g)
        ?.join(':') || '';
    text += `        Serial Number:\n            ${formattedSerial}\n`;
  }

  const algMap: Record<string, string> = {
    '1.2.156.10197.1.501': 'sm2sign_with_sm3',
    '1.2.156.10197.1.301': 'SM2',
    '2.16.840.1.101.3.4.3.17': 'ML-DSA-44',
    '2.16.840.1.101.3.4.3.18': 'ML-DSA-65',
    '2.16.840.1.101.3.4.3.19': 'ML-DSA-87',
    '1.3.101.112': 'Ed25519',
    '1.3.101.113': 'Ed448',
    '1.2.840.113549.1.1.1': 'rsaEncryption',
    '1.2.840.10045.2.1': 'id-ecPublicKey'
  };

  let sigAlgName = 'Unknown';
  try {
    sigAlgName = x509.getSignatureAlgorithmName();
  } catch (e) {}

  if (algMap[sigAlgName]) {
    sigAlgName = algMap[sigAlgName];
  } else if (sigAlgName === 'Unknown' || props.certPem.includes('SM2')) {
    sigAlgName = 'sm2sign_with_sm3';
  }

  text += `        Signature Algorithm: ${sigAlgName}\n`;

  let issuerStr = '';
  try {
    issuerStr = formatDN(x509.getIssuer().array);
  } catch (e) {}
  text += `        Issuer: ${issuerStr}\n`;

  text += `        Validity\n`;
  let notBefore = '',
    notAfter = '';
  try {
    notBefore = formatDateString(x509.getNotBefore());
    notAfter = formatDateString(x509.getNotAfter());
  } catch (e) {}
  text += `            Not Before: ${notBefore}\n`;
  text += `            Not After : ${notAfter}\n`;

  let subjectStr = '';
  try {
    subjectStr = formatDN(x509.getSubject().array);
  } catch (e) {}
  text += `        Subject: ${subjectStr}\n`;

  text += `        Subject Public Key Info:\n`;
  let pubKeyAlg = 'Unknown';
  let pubKeyOID = '';
  try {
    // 尝试提取公钥 OID
    // 路径 [0, 6, 0, 0] 对应 Certificate -> tbsCertificate (idx 0) -> subjectPublicKeyInfo (idx 6) -> algorithm (idx 0) -> algorithm (idx 0)
    // 如果没有 Version 字段，subjectPublicKeyInfo 的索引可能会变成 5
    let oidHex = ASN1HEX.getVbyList(x509.hex, 0, [0, 6, 0, 0]);
    if (!oidHex || oidHex.length < 2) {
      oidHex = ASN1HEX.getVbyList(x509.hex, 0, [0, 5, 0, 0]);
    }

    if (oidHex) {
      pubKeyOID = ASN1HEX.hextooidstr(oidHex);
      pubKeyAlg = algMap[pubKeyOID] || pubKeyOID || 'Unknown';
    }
  } catch (e) {}

  if (pubKeyAlg === 'Unknown' || pubKeyAlg.startsWith('2.')) {
    try {
      const pub = x509.getPublicKey();
      if (pub && (pub as any).type === 'EC') pubKeyAlg = 'id-ecPublicKey';
      else if (pub && (pub as any).type === 'RSA') pubKeyAlg = 'rsaEncryption';
      else if (pub && (pub as any).type) pubKeyAlg = (pub as any).type;
    } catch (e) {}
  }

  text += `            Public Key Algorithm: ${pubKeyAlg}\n`;

  if (pubKeyAlg === 'id-ecPublicKey' || pubKeyOID === '1.2.156.10197.1.301' || (pubKeyAlg === 'Unknown' && props.certPem.includes('SM2'))) {
    text += `                Public-Key: (256 bit)\n`;
  } else if (pubKeyAlg === 'rsaEncryption') {
    try {
      const pub = x509.getPublicKey();
      if (pub && (pub as any).n) {
        text += `                Public-Key: (${(pub as any).n.bitLength()} bit)\n`;
      }
    } catch (e) {}
  }

  let pub16 = '';
  try {
    pub16 = x509.getPublicKeyHex();
  } catch (e) {}

  if (pub16) {
    text += `                pub:\n                    ${formatHexWithColonLines(pub16, '                    ')}\n`;
    if (pubKeyOID === '1.2.156.10197.1.301' || (pubKeyAlg === 'id-ecPublicKey' && props.certPem.includes('SM2'))) {
      text += `                ASN1 OID: SM2\n`;
    }
  }

  // Extensions
  try {
    const hex = x509.hex;
    const hasExts = hex.includes('0603551d') || hex.includes('0603551D');
    if (hasExts) {
      text += `        X509v3 extensions:\n`;
      const renderedExtNames = new Set<string>();

      try {
        const bc = x509.getExtBasicConstraints();
        if (bc) {
          renderedExtNames.add('basicConstraints');
          text += `            X509v3 Basic Constraints:\n`;
          const pathLen = bc.pathLen !== undefined ? `, pathlen:${bc.pathLen}` : '';
          text += `                CA:${String(bc.cA).toUpperCase()}${pathLen}\n`;
        }
      } catch (e) {}

      try {
        const ku = x509.getExtKeyUsageString();
        if (ku) {
          renderedExtNames.add('keyUsage');
          text += `            X509v3 Key Usage:\n                ${ku}\n`;
        }
      } catch (e) {}

      try {
        const eku = x509.getExtExtKeyUsageName();
        if (eku) {
          renderedExtNames.add('extKeyUsage');
          text += `            X509v3 Extended Key Usage:\n                ${eku.join(', ')}\n`;
        }
      } catch (e) {}

      try {
        const ski = x509.getExtSubjectKeyIdentifier();
        if (ski) {
          renderedExtNames.add('subjectKeyIdentifier');
          text += `            X509v3 Subject Key Identifier:\n                ${formatHexWithColonLines(ski.kid || ski, '                ', 15)}\n`;
        }
      } catch (e) {}

      try {
        const aki = x509.getExtAuthorityKeyIdentifier();
        if (aki && aki.kid) {
          renderedExtNames.add('authorityKeyIdentifier');
          text += `            X509v3 Authority Key Identifier:\n                keyid:${formatHexWithColonLines(aki.kid, '                ', 15)}\n`;
        }
      } catch (e) {}

      try {
        const san = x509.getExtSubjectAltName2();
        if (san && san.length > 0) {
          renderedExtNames.add('subjectAltName');
          text += `            X509v3 Subject Alternative Name:\n`;
          const sanStr = san
            .map((s) => {
              if (s.dns) return `DNS:${s.dns}`;
              if (s.ip) return `IP Address:${s.ip}`;
              if (s.rfc822) return `email:${s.rfc822}`;
              if (s.uri) return `URI:${s.uri}`;
              return Object.values(s)[0] || JSON.stringify(s);
            })
            .join(', ');
          text += `                ${sanStr}\n`;
        }
      } catch (e) {}

      try {
        const cdp = x509.getExtCRLDistributionPointsURI();
        if (cdp && cdp.length > 0) {
          renderedExtNames.add('cRLDistributionPoints');
          text += `            X509v3 CRL Distribution Points:\n`;
          text += `                Full Name:\n`;
          text += cdp.map((uri) => `                  URI:${uri}`).join('\n') + '\n';
        }
      } catch (e) {}

      try {
        const aia = x509.getExtAuthorityInfoAccess();
        if (aia && (aia.ocsp || aia.caissuer)) {
          renderedExtNames.add('authorityInfoAccess');
          text += `            Authority Information Access:\n`;
          if (aia.ocsp) {
            text += aia.ocsp.map((uri) => `                OCSP - URI:${uri}`).join('\n') + '\n';
          }
          if (aia.caissuer) {
            text += aia.caissuer.map((uri) => `                CA Issuers - URI:${uri}`).join('\n') + '\n';
          }
        }
      } catch (e) {}

      try {
        const extParams = (x509 as any).getExtParamArray?.() || [];
        extParams
          .filter((ext: any) => ext?.extname && !renderedExtNames.has(ext.extname))
          .forEach((ext: any) => {
            text += formatGenericExtension(ext);
          });
      } catch (e) {}
    }
  } catch (e) {}

  text += `    Signature Algorithm: ${sigAlgName}\n`;
  try {
    const sigHex = x509.getSignatureValueHex();
    if (sigHex) {
      text += `         ${formatHexWithColonLines(sigHex, '         ', 15)}\n`;
    }
  } catch (e) {}

  return text;
});

// Register SM2 curve
KJUR.crypto.ECParameterDB.regist(
  'sm2p256v1',
  256,
  'FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFF',
  'FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF00000000FFFFFFFFFFFFFFFC',
  '28E9FA9E9D9F5E344D5A9E4BCF6509A7F39789F515AB8F92DDBCBD414D940E93',
  'FFFFFFFEFFFFFFFFFFFFFFFFFFFFFFFF7203DF6B21C6052B53BBF40939D54123',
  '1',
  '32C4AE2C1F1981195F9904466A39C9948FE30BBFF2660BE1715A4589334C74C7',
  'BC3736A2F4F6779C59BDCEE36B692153D0A9877CC62A474002DF32E52139F0A0',
  [],
  '1.2.156.10197.1.301'
);

KJUR.crypto.ECDSA.getName = function (s: any) {
  if (s === '2a811ccf5501822d') return 'sm2p256v1';
  if (s === '2b8104001f') return 'secp192k1';
  if (s === '2a8648ce3d030107') return 'secp256r1';
  if (s === '2b8104000a') return 'secp256k1';
  if (s === '2b81040021') return 'secp224r1';
  if (s === '2b81040022') return 'secp384r1';
  if ('|secp256r1|NIST P-256|P-256|prime256v1|'.indexOf(s) !== -1) return 'secp256r1';
  if ('|secp256k1|'.indexOf(s) !== -1) return 'secp256k1';
  if ('|secp224r1|NIST P-224|P-224|'.indexOf(s) !== -1) return 'secp224r1';
  if ('|secp384r1|NIST P-384|P-384|'.indexOf(s) !== -1) return 'secp384r1';
  return null;
};
</script>

<style scoped lang="scss">
.cert-container.openssl-style {
  padding: 15px;
  background-color: #f2f5fa;
  border-radius: 4px;
}

.cert-details {
  background-color: transparent;
  width: 100%;

  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-all;
    font-family: Consolas, Monaco, monospace;
    font-size: 13px;
    line-height: 1.5;
    color: #333;
  }
}
</style>
