declare module 'jsrsasign' {
  export class X509 {
    static getPublicKeyInfoPropOfCertPEM(pem: string): { keyhex: string };
  }
  export const KJUR: {
    asn1: {
      cms: {
        SignedData: new (parameters: {
          fixed: boolean;
          version: number;
          hashalgs: string[];
          econtent: { type: string };
          certs: string[];
          sinfos: unknown[];
        }) => { getContentInfoEncodedHex(): string };
      };
    };
  };
  export function hextob64(hex: string): string;
}
declare module 'sm-crypto' {
  const crypto: { sm3(input: number[]): string };
  export default crypto;
}
