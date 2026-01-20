/**
 * Encryption API request and response type definitions
 * All types use camelCase naming convention for public API outputs
 */

/**
 * Storage backend type for encrypted parameters
 */
export type EncryptionStorage = 'keyvault' | 'local';

/**
 * Encrypt request parameters
 */
export interface EncryptRequest {
  /** The plaintext value to encrypt (max 32KB) */
  plaintext: string;
  /** Name identifier for the parameter (alphanumeric, dots, underscores, hyphens, 1-128 chars) */
  parameterName: string;
}

/**
 * Encrypt response with storage reference
 */
export interface EncryptResponse {
  /** Encrypted reference (kv://paramName or enc://v1:base64) */
  value: string;
  /** Storage backend used */
  storage: EncryptionStorage;
}

/**
 * Decrypt request parameters
 */
export interface DecryptRequest {
  /** Encrypted reference (kv:// or enc://v1:) */
  value: string;
  /** Name identifier for the parameter (must match encryption) */
  parameterName: string;
}

/**
 * Decrypt response with plaintext value
 */
export interface DecryptResponse {
  /** The decrypted plaintext value */
  plaintext: string;
}
