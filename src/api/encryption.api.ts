/**
 * Encryption API client
 * Provides typed interface for security parameter encryption/decryption
 * Uses x-client-token authentication (automatic via HttpClient)
 */

import { HttpClient } from '../utils/http-client';
import { extractErrorInfo } from '../utils/error-extractor';
import { logErrorWithContext } from '../utils/console-logger';
import {
  EncryptRequest,
  EncryptResponse,
  DecryptRequest,
  DecryptResponse,
} from './types/encryption.types';

/**
 * Encryption API class
 * Centralizes security parameter encryption/decryption endpoint URLs
 * Note: Does NOT accept authStrategy - uses x-client-token only (automatic)
 */
export class EncryptionApi {
  // Centralize endpoint URLs as constants
  private static readonly ENCRYPT_ENDPOINT = '/api/security/parameters/encrypt';
  private static readonly DECRYPT_ENDPOINT = '/api/security/parameters/decrypt';

  constructor(private httpClient: HttpClient) {}

  /**
   * Encrypt a plaintext value and store as security parameter
   * @param params - Encrypt request with plaintext and parameterName
   * @returns Encrypt response with value reference (kv:// or enc://) and storage type
   */
  async encrypt(params: EncryptRequest): Promise<EncryptResponse> {
    try {
      return await this.httpClient.request<EncryptResponse>(
        'POST',
        EncryptionApi.ENCRYPT_ENDPOINT,
        params,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: EncryptionApi.ENCRYPT_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[EncryptionApi]');
      throw error;
    }
  }

  /**
   * Decrypt a security parameter reference to plaintext
   * @param params - Decrypt request with value reference and parameterName
   * @returns Decrypt response with plaintext value
   */
  async decrypt(params: DecryptRequest): Promise<DecryptResponse> {
    try {
      return await this.httpClient.request<DecryptResponse>(
        'POST',
        EncryptionApi.DECRYPT_ENDPOINT,
        params,
      );
    } catch (error) {
      const errorInfo = extractErrorInfo(error, {
        endpoint: EncryptionApi.DECRYPT_ENDPOINT,
        method: 'POST',
      });
      logErrorWithContext(errorInfo, '[EncryptionApi]');
      throw error;
    }
  }
}
