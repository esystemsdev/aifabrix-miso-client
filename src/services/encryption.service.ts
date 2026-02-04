/**
 * Encryption service for security parameter management
 * Provides client-side validation and wraps EncryptionApi
 */

import { ApiClient } from '../api';
import { EncryptionError } from '../utils/encryption-error';

/**
 * Result of encryption operation
 */
export interface EncryptResult {
  /** Encrypted reference (kv://paramName or enc://v1:base64) */
  value: string;
  /** Storage backend used */
  storage: 'keyvault' | 'local';
}

/**
 * Encryption service class
 * Provides encrypt/decrypt methods with client-side parameter validation
 */
export class EncryptionService {
  /** Parameter name validation regex (matches controller validation) */
  private static readonly PARAMETER_NAME_REGEX = /^[a-zA-Z0-9._-]{1,128}$/;

  /** Encryption key for server-side validation */
  private encryptionKey: string | undefined;

  /**
   * Create encryption service
   * @param apiClient - API client for controller communication
   * @param encryptionKey - Encryption key for server-side validation (from ENCRYPTION_KEY)
   */
  constructor(private apiClient: ApiClient, encryptionKey?: string) {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Encrypt a plaintext value and store as security parameter
   * @param plaintext - The value to encrypt (max 32KB)
   * @param parameterName - Name identifier (alphanumeric, dots, underscores, hyphens, 1-128 chars)
   * @returns Encrypt result with value reference and storage type
   * @throws EncryptionError if encryption key is missing, parameter name is invalid, or encryption fails
   */
  async encrypt(plaintext: string, parameterName: string): Promise<EncryptResult> {
    this.validateEncryptionKey();
    this.validateParameterName(parameterName);

    const response = await this.apiClient.encryption.encrypt({
      plaintext,
      parameterName,
      encryptionKey: this.encryptionKey!,
    });

    return {
      value: response.value,
      storage: response.storage,
    };
  }

  /**
   * Decrypt a security parameter reference to plaintext
   * @param value - Encrypted reference (kv:// or enc://v1:)
   * @param parameterName - Name identifier (must match encryption)
   * @returns Decrypted plaintext value
   * @throws EncryptionError if encryption key is missing, parameter name is invalid, or decryption fails
   */
  async decrypt(value: string, parameterName: string): Promise<string> {
    this.validateEncryptionKey();
    this.validateParameterName(parameterName);

    const response = await this.apiClient.encryption.decrypt({
      value,
      parameterName,
      encryptionKey: this.encryptionKey!,
    });

    return response.plaintext;
  }

  /**
   * Validate that encryption key is configured
   * @throws EncryptionError if encryption key is not set
   */
  private validateEncryptionKey(): void {
    if (!this.encryptionKey) {
      throw new EncryptionError(
        'Encryption key is required. Set ENCRYPTION_KEY environment variable or provide encryptionKey in config.',
        'ENCRYPTION_KEY_REQUIRED',
      );
    }
  }

  /**
   * Validate parameter name against allowed pattern
   * @param name - Parameter name to validate
   * @throws EncryptionError if name is invalid
   */
  private validateParameterName(name: string): void {
    if (!EncryptionService.PARAMETER_NAME_REGEX.test(name)) {
      throw new EncryptionError(
        'Invalid parameter name. Must be 1-128 characters, alphanumeric with dots, underscores, hyphens only.',
        'INVALID_PARAMETER_NAME',
        name,
      );
    }
  }
}
