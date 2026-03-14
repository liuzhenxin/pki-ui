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
  return array.map((e: any) => {
    let type = e[0].type;
    let val = e[0].value;
    return `${type} = ${val}`;
  }).join(', ');
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
  try { version = x509.getVersion(); } catch(e) {}
  
  text += `        Version: ${version} (0x${version - 1})\n`;

  let serialHex = '';
  try { serialHex = x509.getSerialNumberHex(); } catch(e) {}
  
  if (serialHex) {
    const formattedSerial = serialHex.toLowerCase().match(/.{1,2}/g)?.join(':') || '';
    text += `        Serial Number:\n            ${formattedSerial}\n`;
  }

  let sigAlgName = 'Unknown';
  try {
    sigAlgName = x509.getSignatureAlgorithmName();
  } catch (e) {}
  
  if (sigAlgName === '1.2.156.10197.1.501') {
    sigAlgName = 'sm2sign_with_sm3';
  } else if (sigAlgName === 'Unknown' || props.certPem.includes('SM2')) {
    sigAlgName = 'sm2sign_with_sm3';
  }

  text += `        Signature Algorithm: ${sigAlgName}\n`;

  let issuerStr = '';
  try { issuerStr = formatDN(x509.getIssuer().array); } catch(e) {}
  text += `        Issuer: ${issuerStr}\n`;

  text += `        Validity\n`;
  let notBefore = '', notAfter = '';
  try {
    notBefore = formatDateString(x509.getNotBefore());
    notAfter = formatDateString(x509.getNotAfter());
  } catch(e) {}
  text += `            Not Before: ${notBefore}\n`;
  text += `            Not After : ${notAfter}\n`;

  let subjectStr = '';
  try { subjectStr = formatDN(x509.getSubject().array); } catch(e) {}
  text += `        Subject: ${subjectStr}\n`;

  text += `        Subject Public Key Info:\n`;
  let pubKeyAlg = 'id-ecPublicKey';
  try {
    const pub = x509.getPublicKey();
    if (pub && (pub as any).type === 'EC') pubKeyAlg = 'id-ecPublicKey';
    else if (pub && (pub as any).type === 'RSA') pubKeyAlg = 'rsaEncryption';
  } catch (e) {}

  text += `            Public Key Algorithm: ${pubKeyAlg}\n`;
  
  if (pubKeyAlg === 'id-ecPublicKey' || props.certPem.includes('SM2')) {
    text += `                Public-Key: (256 bit)\n`;
  }

  let pub16 = '';
  try {
    pub16 = x509.getPublicKeyHex();
  } catch (e) {}

  if (pub16) {
    text += `                pub:\n                    ${formatHexWithColonLines(pub16, '                    ')}\n`;
    if (pubKeyAlg === 'id-ecPublicKey' || props.certPem.includes('SM2')) {
      text += `                ASN1 OID: SM2\n`;
    }
  }

  // Extensions
  try {
    const hex = x509.hex;
    const hasExts = hex.includes('0603551d') || hex.includes('0603551D'); 
    if (hasExts) {
      text += `        X509v3 extensions:\n`;
      
      try { 
        const bc = x509.getExtBasicConstraints(); 
        if (bc) {
          text += `            X509v3 Basic Constraints:\n`;
          let pathLen = bc.pathLen !== undefined ? `, pathlen:${bc.pathLen}` : '';
          text += `                CA:${String(bc.cA).toUpperCase()}${pathLen}\n`;
        } 
      } catch(e) {}
      
      try { 
        const ku = x509.getExtKeyUsageString(); 
        if (ku) {
          text += `            X509v3 Key Usage:\n                ${ku}\n`;
        } 
      } catch(e) {}
      
      try { 
        const eku = x509.getExtExtKeyUsageName(); 
        if (eku) {
          text += `            X509v3 Extended Key Usage:\n                ${eku.join(', ')}\n`;
        } 
      } catch(e) {}
      
      try { 
        const ski = x509.getExtSubjectKeyIdentifier(); 
        if (ski) {
          text += `            X509v3 Subject Key Identifier:\n                ${formatHexWithColonLines(ski.kid || ski, '                ', 15)}\n`;
        } 
      } catch(e) {}
      
      try { 
        const aki = x509.getExtAuthorityKeyIdentifier(); 
        if (aki && aki.kid) {
          text += `            X509v3 Authority Key Identifier:\n                keyid:${formatHexWithColonLines(aki.kid, '                ', 15)}\n`;
        } 
      } catch(e) {}
      
      try { 
        const san = x509.getExtSubjectAltName2(); 
        if (san && san.length > 0) {
          text += `            X509v3 Subject Alternative Name:\n`;
          const sanStr = san.map(s => {
            if (s.dns) return `DNS:${s.dns}`;
            if (s.ip) return `IP Address:${s.ip}`;
            if (s.rfc822) return `email:${s.rfc822}`;
            if (s.uri) return `URI:${s.uri}`;
            return Object.values(s)[0] || JSON.stringify(s);
          }).join(', ');
          text += `                ${sanStr}\n`;
        } 
      } catch(e) {}

      try {
        const cdp = x509.getExtCRLDistributionPointsURI();
        if (cdp && cdp.length > 0) {
          text += `            X509v3 CRL Distribution Points:\n`;
          text += `                Full Name:\n`;
          text += cdp.map(uri => `                  URI:${uri}`).join('\n') + '\n';
        }
      } catch(e) {}

      try {
        const aia = x509.getExtAuthorityInfoAccess();
        if (aia && (aia.ocsp || aia.caissuer)) {
          text += `            Authority Information Access:\n`;
          if (aia.ocsp) {
             text += aia.ocsp.map(uri => `                OCSP - URI:${uri}`).join('\n') + '\n';
          }
          if (aia.caissuer) {
             text += aia.caissuer.map(uri => `                CA Issuers - URI:${uri}`).join('\n') + '\n';
          }
        }
      } catch(e) {}

    }
  } catch(e) {}

  text += `    Signature Algorithm: ${sigAlgName}\n`;
  try {
    let sigHex = x509.getSignatureValueHex();
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
