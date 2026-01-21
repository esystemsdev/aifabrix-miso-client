/**
 * Unit tests for EncryptionApi
 */

import { EncryptionApi } from '../../../src/api/encryption.api';
import { HttpClient } from '../../../src/utils/http-client';
import { EncryptRequest, EncryptResponse, DecryptRequest, DecryptResponse } from '../../../src/api/types/encryption.types';

// Mock HttpClient
jest.mock('../../../src/utils/http-client');

describe('EncryptionApi', () => {
  let encryptionApi: EncryptionApi;
  let mockHttpClient: jest.Mocked<HttpClient>;
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = jest.fn();
    mockHttpClient = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;

    encryptionApi = new EncryptionApi(mockHttpClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
    console.error = originalConsoleError;
  });

  describe('encrypt', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const mockResponse: EncryptResponse = {
        value: 'enc://v1:abc123',
        storage: 'local',
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const params: EncryptRequest = {
        plaintext: 'secret-value',
        parameterName: 'my-param',
        encryptionKey: 'test-encryption-key',
      };

      const result = await encryptionApi.encrypt(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/security/parameters/encrypt',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should return keyvault storage type', async () => {
      const mockResponse: EncryptResponse = {
        value: 'kv://my-param',
        storage: 'keyvault',
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await encryptionApi.encrypt({
        plaintext: 'secret',
        parameterName: 'my-param',
        encryptionKey: 'test-encryption-key',
      });

      expect(result.storage).toBe('keyvault');
      expect(result.value).toBe('kv://my-param');
    });

    it('should log and rethrow errors', async () => {
      const error = new Error('Encryption failed');
      mockHttpClient.request.mockRejectedValue(error);

      await expect(encryptionApi.encrypt({
        plaintext: 'secret',
        parameterName: 'param',
        encryptionKey: 'test-encryption-key',
      })).rejects.toThrow('Encryption failed');

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle network errors', async () => {
      const networkError = new Error('Network error');
      mockHttpClient.request.mockRejectedValue(networkError);

      await expect(encryptionApi.encrypt({
        plaintext: 'test',
        parameterName: 'test-param',
        encryptionKey: 'test-encryption-key',
      })).rejects.toThrow('Network error');
    });
  });

  describe('decrypt', () => {
    it('should call HttpClient.request with correct parameters', async () => {
      const mockResponse: DecryptResponse = {
        plaintext: 'decrypted-value',
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const params: DecryptRequest = {
        value: 'enc://v1:abc123',
        parameterName: 'my-param',
        encryptionKey: 'test-encryption-key',
      };

      const result = await encryptionApi.decrypt(params);

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        'POST',
        '/api/security/parameters/decrypt',
        params,
      );
      expect(result).toEqual(mockResponse);
    });

    it('should decrypt keyvault reference', async () => {
      const mockResponse: DecryptResponse = {
        plaintext: 'my-secret-value',
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await encryptionApi.decrypt({
        value: 'kv://my-param',
        parameterName: 'my-param',
        encryptionKey: 'test-encryption-key',
      });

      expect(result.plaintext).toBe('my-secret-value');
    });

    it('should log and rethrow errors', async () => {
      const error = new Error('Decryption failed');
      mockHttpClient.request.mockRejectedValue(error);

      await expect(encryptionApi.decrypt({
        value: 'enc://v1:abc',
        parameterName: 'param',
        encryptionKey: 'test-encryption-key',
      })).rejects.toThrow('Decryption failed');

      expect(console.error).toHaveBeenCalled();
    });

    it('should handle 404 not found error', async () => {
      const notFoundError = new Error('Parameter not found');
      mockHttpClient.request.mockRejectedValue(notFoundError);

      await expect(encryptionApi.decrypt({
        value: 'kv://nonexistent',
        parameterName: 'nonexistent',
        encryptionKey: 'test-encryption-key',
      })).rejects.toThrow('Parameter not found');
    });
  });
});
