/**
 * Unit tests for EncryptionService
 */

import { EncryptionService, EncryptResult } from '../../../src/services/encryption.service';
import { EncryptionError } from '../../../src/utils/encryption-error';
import { ApiClient } from '../../../src/api';

// Mock ApiClient
jest.mock('../../../src/api');

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let mockApiClient: jest.Mocked<ApiClient>;

  beforeEach(() => {
    mockApiClient = {
      encryption: {
        encrypt: jest.fn(),
        decrypt: jest.fn(),
      },
    } as unknown as jest.Mocked<ApiClient>;

    encryptionService = new EncryptionService(mockApiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('encrypt', () => {
    it('should encrypt and return result with keyvault storage', async () => {
      mockApiClient.encryption.encrypt.mockResolvedValue({
        value: 'kv://my-param',
        storage: 'keyvault',
      });

      const result = await encryptionService.encrypt('secret', 'my-param');

      expect(result).toEqual({ value: 'kv://my-param', storage: 'keyvault' });
      expect(mockApiClient.encryption.encrypt).toHaveBeenCalledWith({
        plaintext: 'secret',
        parameterName: 'my-param',
      });
    });

    it('should encrypt and return result with local storage', async () => {
      mockApiClient.encryption.encrypt.mockResolvedValue({
        value: 'enc://v1:base64data',
        storage: 'local',
      });

      const result = await encryptionService.encrypt('secret', 'my-param');

      expect(result).toEqual({ value: 'enc://v1:base64data', storage: 'local' });
    });

    it('should throw EncryptionError for invalid parameter name with spaces', async () => {
      await expect(
        encryptionService.encrypt('secret', 'invalid name with spaces'),
      ).rejects.toThrow(EncryptionError);

      await expect(
        encryptionService.encrypt('secret', 'invalid name with spaces'),
      ).rejects.toMatchObject({
        code: 'INVALID_PARAMETER_NAME',
        parameterName: 'invalid name with spaces',
      });
    });

    it('should throw EncryptionError for empty parameter name', async () => {
      await expect(
        encryptionService.encrypt('secret', ''),
      ).rejects.toThrow(EncryptionError);
    });

    it('should propagate API errors', async () => {
      const apiError = new Error('API error');
      mockApiClient.encryption.encrypt.mockRejectedValue(apiError);

      await expect(
        encryptionService.encrypt('secret', 'valid-param'),
      ).rejects.toThrow('API error');
    });
  });

  describe('decrypt', () => {
    it('should decrypt and return plaintext', async () => {
      mockApiClient.encryption.decrypt.mockResolvedValue({
        plaintext: 'decrypted-secret',
      });

      const result = await encryptionService.decrypt('kv://my-param', 'my-param');

      expect(result).toBe('decrypted-secret');
      expect(mockApiClient.encryption.decrypt).toHaveBeenCalledWith({
        value: 'kv://my-param',
        parameterName: 'my-param',
      });
    });

    it('should decrypt enc:// reference', async () => {
      mockApiClient.encryption.decrypt.mockResolvedValue({
        plaintext: 'my-secret',
      });

      const result = await encryptionService.decrypt('enc://v1:base64', 'my-param');

      expect(result).toBe('my-secret');
    });

    it('should throw EncryptionError for invalid parameter name', async () => {
      await expect(
        encryptionService.decrypt('kv://param', ''),
      ).rejects.toThrow(EncryptionError);
    });

    it('should propagate API errors', async () => {
      const apiError = new Error('Decryption failed');
      mockApiClient.encryption.decrypt.mockRejectedValue(apiError);

      await expect(
        encryptionService.decrypt('kv://my-param', 'my-param'),
      ).rejects.toThrow('Decryption failed');
    });
  });

  describe('parameter name validation', () => {
    const validNames = [
      'simple',
      'with-dash',
      'with_underscore',
      'with.dot',
      'Mixed123',
      'a',
      'A',
      '123',
      'a'.repeat(128),
      'param-name_with.all-valid_chars.123',
    ];

    const invalidNames = [
      '',
      'has space',
      'has/slash',
      'has\\backslash',
      'has@symbol',
      'has#hash',
      'has$dollar',
      'has%percent',
      'has&ampersand',
      'has*asterisk',
      'has(paren)',
      'has[bracket]',
      'has{brace}',
      'has<angle>',
      'has+plus',
      'has=equals',
      'has!exclaim',
      'has?question',
      'has:colon',
      'has;semicolon',
      'has\'quote',
      'has"doublequote',
      'has`backtick',
      'has~tilde',
      'has|pipe',
      'a'.repeat(129), // Too long
    ];

    describe('valid names', () => {
      validNames.forEach((name) => {
        it(`should accept valid name: "${name.substring(0, 30)}${name.length > 30 ? '...' : ''}"`, async () => {
          mockApiClient.encryption.encrypt.mockResolvedValue({
            value: 'enc://v1:test',
            storage: 'local',
          });

          await expect(
            encryptionService.encrypt('secret', name),
          ).resolves.toBeDefined();
        });
      });
    });

    describe('invalid names', () => {
      invalidNames.forEach((name) => {
        it(`should reject invalid name: "${name.substring(0, 30)}${name.length > 30 ? '...' : ''}"`, async () => {
          await expect(
            encryptionService.encrypt('secret', name),
          ).rejects.toThrow(EncryptionError);
        });
      });
    });
  });
});
