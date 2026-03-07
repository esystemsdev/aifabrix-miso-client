/**
 * Unit tests for EncryptionService
 */

import { EncryptionService, EncryptResult } from '../../../src/services/encryption.service';
import { EncryptionError } from '../../../src/utils/encryption-error';
import { ApiClient } from '../../../src/api';
import type { CacheService } from '../../../src/services/cache.service';

// Mock ApiClient
jest.mock('../../../src/api');

function createMockCache(): jest.Mocked<Pick<CacheService, 'get' | 'set'>> {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
  };
}

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let encryptionServiceWithoutKey: EncryptionService;
  let mockApiClient: jest.Mocked<ApiClient>;
  const testEncryptionKey = 'test-encryption-key-12345';

  beforeEach(() => {
    mockApiClient = {
      encryption: {
        encrypt: jest.fn(),
        decrypt: jest.fn(),
      },
    } as unknown as jest.Mocked<ApiClient>;

    // Service with encryption key (no cache)
    encryptionService = new EncryptionService(mockApiClient, testEncryptionKey);
    // Service without encryption key (for testing ENCRYPTION_KEY_REQUIRED)
    encryptionServiceWithoutKey = new EncryptionService(mockApiClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('encryption key validation', () => {
    it('should throw ENCRYPTION_KEY_REQUIRED when encrypting without key', async () => {
      await expect(
        encryptionServiceWithoutKey.encrypt('secret', 'my-param'),
      ).rejects.toThrow(EncryptionError);

      await expect(
        encryptionServiceWithoutKey.encrypt('secret', 'my-param'),
      ).rejects.toMatchObject({
        code: 'ENCRYPTION_KEY_REQUIRED',
      });
    });

    it('should throw ENCRYPTION_KEY_REQUIRED when decrypting without key', async () => {
      await expect(
        encryptionServiceWithoutKey.decrypt('kv://my-param', 'my-param'),
      ).rejects.toThrow(EncryptionError);

      await expect(
        encryptionServiceWithoutKey.decrypt('kv://my-param', 'my-param'),
      ).rejects.toMatchObject({
        code: 'ENCRYPTION_KEY_REQUIRED',
      });
    });

    it('should include helpful error message for missing key', async () => {
      await expect(
        encryptionServiceWithoutKey.encrypt('secret', 'my-param'),
      ).rejects.toThrow('Encryption key is required. Set ENCRYPTION_KEY environment variable or provide encryptionKey in config.');
    });
  });

  describe('encrypt', () => {
    it('should encrypt and return result with keyvault storage', async () => {
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'kv://my-param',
        storage: 'keyvault',
      });

      const result = await encryptionService.encrypt('secret', 'my-param');

      expect(result).toEqual({ value: 'kv://my-param', storage: 'keyvault' });
      expect(mockApiClient.encryption.encrypt).toHaveBeenCalledWith({
        plaintext: 'secret',
        parameterName: 'my-param',
        encryptionKey: testEncryptionKey,
      });
    });

    it('should encrypt and return result with local storage', async () => {
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'enc://v1:base64data',
        storage: 'local',
      });

      const result = await encryptionService.encrypt('secret', 'my-param');

      expect(result).toEqual({ value: 'enc://v1:base64data', storage: 'local' });
    });

    it('should include encryptionKey in API call', async () => {
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'enc://v1:test',
        storage: 'local',
      });

      await encryptionService.encrypt('secret', 'test-param');

      expect(mockApiClient.encryption.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          encryptionKey: testEncryptionKey,
        }),
      );
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
      (mockApiClient.encryption.encrypt as jest.Mock).mockRejectedValue(apiError);

      await expect(
        encryptionService.encrypt('secret', 'valid-param'),
      ).rejects.toThrow('API error');
    });
  });

  describe('decrypt', () => {
    it('should decrypt and return plaintext', async () => {
      (mockApiClient.encryption.decrypt as jest.Mock).mockResolvedValue({
        plaintext: 'decrypted-secret',
      });

      const result = await encryptionService.decrypt('kv://my-param', 'my-param');

      expect(result).toBe('decrypted-secret');
      expect(mockApiClient.encryption.decrypt).toHaveBeenCalledWith({
        value: 'kv://my-param',
        parameterName: 'my-param',
        encryptionKey: testEncryptionKey,
      });
    });

    it('should decrypt enc:// reference', async () => {
      (mockApiClient.encryption.decrypt as jest.Mock).mockResolvedValue({
        plaintext: 'my-secret',
      });

      const result = await encryptionService.decrypt('enc://v1:base64', 'my-param');

      expect(result).toBe('my-secret');
    });

    it('should include encryptionKey in API call', async () => {
      (mockApiClient.encryption.decrypt as jest.Mock).mockResolvedValue({
        plaintext: 'test',
      });

      await encryptionService.decrypt('kv://test-param', 'test-param');

      expect(mockApiClient.encryption.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          encryptionKey: testEncryptionKey,
        }),
      );
    });

    it('should throw EncryptionError for invalid parameter name', async () => {
      await expect(
        encryptionService.decrypt('kv://param', ''),
      ).rejects.toThrow(EncryptionError);
    });

    it('should propagate API errors', async () => {
      const apiError = new Error('Decryption failed');
      (mockApiClient.encryption.decrypt as jest.Mock).mockRejectedValue(apiError);

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
          (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
            value: 'enc://v1:test',
            storage: 'local',
          });

          // Use encryptionService which has the encryption key set
          await expect(
            encryptionService.encrypt('secret', name),
          ).resolves.toBeDefined();
        });
      });
    });

    describe('invalid names', () => {
      invalidNames.forEach((name) => {
        it(`should reject invalid name: "${name.substring(0, 30)}${name.length > 30 ? '...' : ''}"`, async () => {
          // Use encryptionService which has the encryption key set
          // Invalid parameter name check happens before encryption key check
          await expect(
            encryptionService.encrypt('secret', name),
          ).rejects.toThrow(EncryptionError);
        });
      });
    });
  });

  describe('encryption cache', () => {
    // 1. Encrypt cache miss: first encrypt calls API and cache.set with correct TTL
    it('encrypt cache miss: first encrypt calls API and cache.set with correct TTL', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'kv://my-param',
        storage: 'keyvault',
      });

      const result = await svc.encrypt('secret', 'my-param');

      expect(result).toEqual({ value: 'kv://my-param', storage: 'keyvault' });
      expect(mockApiClient.encryption.encrypt).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^encryption:encrypt:[a-f0-9]{64}$/),
        { value: 'kv://my-param', storage: 'keyvault' },
        300,
      );
    });

    // 2. Encrypt cache hit: second encrypt with same input returns cached result, API not called again
    it('encrypt cache hit: second encrypt returns cached result, API not called again', async () => {
      const mockCache = createMockCache();
      const cachedResult: EncryptResult = { value: 'kv://cached', storage: 'keyvault' };
      (mockCache.get as jest.Mock).mockResolvedValue(cachedResult);
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);

      const result = await svc.encrypt('secret', 'my-param');

      expect(result).toEqual(cachedResult);
      expect(mockApiClient.encryption.encrypt).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalled();
    });

    // 3. Decrypt cache miss: first decrypt calls API and cache.set with correct TTL
    it('decrypt cache miss: first decrypt calls API and cache.set with correct TTL', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);
      (mockApiClient.encryption.decrypt as jest.Mock).mockResolvedValue({ plaintext: 'decrypted-secret' });

      const result = await svc.decrypt('kv://my-param', 'my-param');

      expect(result).toBe('decrypted-secret');
      expect(mockApiClient.encryption.decrypt).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledTimes(1);
      expect(mockCache.set).toHaveBeenCalledWith(
        expect.stringMatching(/^encryption:decrypt:[a-f0-9]{64}$/),
        'decrypted-secret',
        300,
      );
    });

    // 4. Decrypt cache hit: second decrypt returns cached plaintext, API not called again
    it('decrypt cache hit: second decrypt returns cached plaintext, API not called again', async () => {
      const mockCache = createMockCache();
      (mockCache.get as jest.Mock).mockResolvedValue('cached-plaintext');
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);

      const result = await svc.decrypt('kv://my-param', 'my-param');

      expect(result).toBe('cached-plaintext');
      expect(mockApiClient.encryption.decrypt).not.toHaveBeenCalled();
      expect(mockCache.get).toHaveBeenCalled();
    });

    // 5. TTL: cache.set invoked with configured TTL
    it('TTL: cache.set invoked with configured encryptionCacheTTL', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 600);
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'enc://v1:x',
        storage: 'local',
      });

      await svc.encrypt('x', 'p');

      expect(mockCache.set).toHaveBeenCalledWith(expect.any(String), expect.any(Object), 600);
    });

    // 6. Cache disabled (TTL 0): no cache.get or cache.set, API called every time
    it('cache disabled (TTL 0): no cache get/set, API called every time', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 0);
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'enc://v1:a',
        storage: 'local',
      });

      await svc.encrypt('a', 'p');
      await svc.encrypt('a', 'p');

      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(mockApiClient.encryption.encrypt).toHaveBeenCalledTimes(2);
    });

    // 7. No CacheService: no cache read/write, API called every time
    it('no CacheService: no cache read/write, API called every time', async () => {
      const svc = new EncryptionService(mockApiClient, testEncryptionKey);
      (mockApiClient.encryption.encrypt as jest.Mock).mockResolvedValue({
        value: 'enc://v1:b',
        storage: 'local',
      });

      await svc.encrypt('b', 'p');
      await svc.encrypt('b', 'p');

      expect(mockApiClient.encryption.encrypt).toHaveBeenCalledTimes(2);
    });

    // 8. Controller error: cache.set is not called
    it('controller error on encrypt: cache.set is not called', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);
      (mockApiClient.encryption.encrypt as jest.Mock).mockRejectedValue(new Error('API error'));

      await expect(svc.encrypt('secret', 'my-param')).rejects.toThrow('API error');
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('controller error on decrypt: cache.set is not called', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);
      (mockApiClient.encryption.decrypt as jest.Mock).mockRejectedValue(new Error('Decrypt failed'));

      await expect(svc.decrypt('kv://x', 'x')).rejects.toThrow('Decrypt failed');
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    // 9. Validation error: no cache get/set (invalid param before any API call)
    it('validation error: no cache get or set', async () => {
      const mockCache = createMockCache();
      const svc = new EncryptionService(mockApiClient, testEncryptionKey, mockCache as unknown as CacheService, 300);

      await expect(svc.encrypt('secret', 'invalid name')).rejects.toThrow(EncryptionError);

      expect(mockCache.get).not.toHaveBeenCalled();
      expect(mockCache.set).not.toHaveBeenCalled();
      expect(mockApiClient.encryption.encrypt).not.toHaveBeenCalled();
    });
  });
});
