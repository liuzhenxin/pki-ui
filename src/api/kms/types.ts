export type KeyAlgorithm = 'SM4_128' | 'AES_256';
export type KeyState =
  | 'PRE_ACTIVE'
  | 'ENABLED'
  | 'DISABLED'
  | 'COMPROMISED'
  | 'PENDING_DELETION'
  | 'DESTROYING'
  | 'DESTROYED'
  | 'DESTROYED_COMPROMISED';
export interface KeyMetadata {
  keyId: string;
  arn: string;
  alias: string;
  algorithm: KeyAlgorithm;
  keyUsage: 'ENCRYPT_DECRYPT';
  state: KeyState;
  currentVersion: number;
  createdAt: string;
}
export interface KeyVersion {
  version: number;
  state: 'PRE_ACTIVE' | 'ACTIVE' | 'RETIRED' | 'DESTROYED';
  provider: string;
  createdAt: string;
  retiredAt?: string;
  destroyedAt?: string;
}
export interface KeyDetail extends KeyMetadata {
  pendingDeletionAt?: string;
  updatedAt: string;
  versions: KeyVersion[];
}
export interface CreateKeyRequest {
  alias: string;
  algorithm: KeyAlgorithm;
  keyUsage: 'ENCRYPT_DECRYPT';
  description: string;
}
export interface KeyStateResult {
  keyId: string;
  state: KeyState;
  currentVersion: number;
  pendingDeletionAt?: string;
  updatedAt: string;
}
export type KeyAction = 'rotate' | 'enable' | 'disable' | 'schedule-deletion' | 'cancel-deletion';
export type CryptoOperation = 'encrypt' | 'decrypt' | 'data-key';
export interface CryptoResult {
  keyId: string;
  keyVersion: number;
  plaintext?: string;
  ciphertextBlob?: string;
}
export type EncryptionContext = Record<string, string>;
