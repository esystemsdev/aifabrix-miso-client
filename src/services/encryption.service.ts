/**
 * Encryption service for security parameter management
 * Provides client-side validation and wraps EncryptionApi
 * Supports optional response caching to reduce controller calls.
 */

import crypto from 'crypto';
import { ApiClient } from '../api';
import { EncryptionError } from '../utils/encryption-error';
import type { CacheService } from './cache.service';

/**
 * Result of encryption operation
 */
export interface EncryptResult {
  /** Encrypted reference (kv://paramName or enc://v1:base64) */
  value: string;
  /** Storage backend used */
  storage: 'keyvault' | 'local';
}

const ENCRYPT_KEY_PREFIX = 'encryption:encrypt:';
const DECRYPT_KEY_PREFIX = 'encryption:decrypt:';

/**
 * Build cache key from inputs using SHA-256 (no plaintext in key for encrypt).
 */
function buildCacheKey(prefix: string, part1: string, part2: string): string {
  const hash = crypto.createHash('sha256').update(part1 + part2, 'utf8').digest('hex');
  return prefix + hash;
}

/**
 * Encryption service class
 * Provides encrypt/decrypt methods with client-side parameter validation
 * and optional response caching (when CacheService and encryptionCacheTTL > 0).
 */
export class EncryptionService {
  /** Parameter name validation regex (matches controller validation) */
  private static readonly PARAMETER_NAME_REGEX = /^[a-zA-Z0-9._-]{1,128}$/;

  /** Encryption key for server-side validation */
  private encryptionKey: string | undefined;

  /** Optional cache; when null or TTL 0, caching is disabled */
  private cache: CacheService | null;
  /** TTL in seconds; 0 means cache disabled */
  private cacheTTL: number;

  /**
   * Create encryption service
   * @param apiClient - API client for controller communication
   * @param encryptionKey - Encryption key for server-side validation (from ENCRYPTION_KEY)
   * @param cacheService - Optional cache service for encrypt/decrypt response caching
   * @param encryptionCacheTTL - Cache TTL in seconds; 0 or undefined when no cache = disabled
   */
  constructor(
    private apiClient: ApiClient,
    encryptionKey?: string,
    cacheService?: CacheService | null,
    encryptionCacheTTL?: number,
  ) {
    this.encryptionKey = encryptionKey;
    this.cache = cacheService ?? null;
    const ttl = encryptionCacheTTL ?? 0;
    this.cacheTTL = ttl > 0 ? ttl : 0;
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

    const cacheKey =
      this.cache && this.cacheTTL > 0
        ? buildCacheKey(ENCRYPT_KEY_PREFIX, plaintext, parameterName)
        : null;

    if (cacheKey) {
      const cached = await this.cache!.get<EncryptResult>(cacheKey);
      if (cached) return cached;
    }

    const response = await this.apiClient.encryption.encrypt({
      plaintext,
      parameterName,
      encryptionKey: this.encryptionKey!,
    });

    const result: EncryptResult = { value: response.value, storage: response.storage };
    if (cacheKey) {
      await this.cache!.set(cacheKey, result, this.cacheTTL);
    }
    return result;
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

    const cacheKey =
      this.cache && this.cacheTTL > 0
        ? buildCacheKey(DECRYPT_KEY_PREFIX, value, parameterName)
        : null;

    if (cacheKey) {
      const cached = await this.cache!.get<string>(cacheKey);
      if (cached !== null && cached !== undefined) return cached;
    }

    const response = await this.apiClient.encryption.decrypt({
      value,
      parameterName,
      encryptionKey: this.encryptionKey!,
    });

    if (cacheKey) {
      await this.cache!.set(cacheKey, response.plaintext, this.cacheTTL);
    }
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
