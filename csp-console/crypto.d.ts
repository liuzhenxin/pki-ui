declare module 'jsrsasign' {
  export class X509 {
    static getPublicKeyInfoPropOfCertPEM(pem: string): { keyhex: string };
  }
}
declare module 'sm-crypto' {
  const crypto: { sm3(input: number[]): string };
  export default crypto;
}
