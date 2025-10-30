/**
 * Unit tests for EncryptionService
 */

import { EncryptionService } from '../../src/services/encryption.service';

describe('EncryptionService', () => {
  const testKey = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'; // 64 hex chars = 32 bytes

  describe('Constructor', () => {
    it('should create instance with constructor parameter', () => {
      const service = new EncryptionService(testKey);
      expect(service).toBeInstanceOf(EncryptionService);
    });

    it('should create instance with env var when no parameter provided', () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = testKey;

      const service = new EncryptionService();
      expect(service).toBeInstanceOf(EncryptionService);

      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it('should throw error when no key is provided', () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => {
        new EncryptionService();
      }).toThrow('Encryption key is required');

      if (originalEnv) {
        process.env.ENCRYPTION_KEY = originalEnv;
      }
    });

    it('should accept raw string key and derive 32-byte key', () => {
      const service = new EncryptionService('my-secret-key');
      expect(service).toBeInstanceOf(EncryptionService);
      
      // Test that it can encrypt/decrypt
      const plaintext = 'test';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should accept hex key', () => {
      const service = new EncryptionService(testKey);
      expect(service).toBeInstanceOf(EncryptionService);
    });

    it('should accept base64 key', () => {
      const base64Key = Buffer.from(testKey, 'hex').toString('base64');
      const service = new EncryptionService(base64Key);
      expect(service).toBeInstanceOf(EncryptionService);
      
      // Test that it can encrypt/decrypt
      const plaintext = 'test';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should prefer constructor parameter over env var', () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = 'env-key';
      const constructorKey = 'constructor-key';

      const service = new EncryptionService(constructorKey);
      
      // Encrypt with constructor key
      const encrypted = service.encrypt('test');
      
      // Try to decrypt with a service using env key (should fail since keys are different)
      const envService = new EncryptionService();
      expect(() => {
        envService.decrypt(encrypted);
      }).toThrow('Decryption failed'); // Should throw error since keys are different

      // But decryption with original service should work
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe('test');

      process.env.ENCRYPTION_KEY = originalEnv;
    });
  });

  describe('Encryption/Decryption', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(testKey);
    });

    it('should encrypt and decrypt plaintext successfully', () => {
      const plaintext = 'Hello, World!';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64 format
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const encrypted = service.encrypt('');
      expect(encrypted).toBe('');
      
      const decrypted = service.decrypt('');
      expect(decrypted).toBe('');
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'same text';
      const encrypted1 = service.encrypt(plaintext);
      const encrypted2 = service.encrypt(plaintext);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same plaintext
      expect(service.decrypt(encrypted1)).toBe(plaintext);
      expect(service.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Unicode: 你好世界 🌍';
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'A'.repeat(10000);
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle JSON strings', () => {
      const jsonData = JSON.stringify({ name: 'John', age: 30, items: [1, 2, 3] });
      const encrypted = service.encrypt(jsonData);
      const decrypted = service.decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });
  });

  describe('Error Handling', () => {
    let service: EncryptionService;

    beforeEach(() => {
      service = new EncryptionService(testKey);
    });

    it('should throw error on invalid encrypted data', () => {
      expect(() => {
        service.decrypt('invalid-data');
      }).toThrow('Decryption failed');
    });

    it('should throw error on too short encrypted data', () => {
      const shortData = Buffer.from('short').toString('base64');
      expect(() => {
        service.decrypt(shortData);
      }).toThrow('Decryption failed');
    });

    it('should throw error on corrupted encrypted data', () => {
      const plaintext = 'test';
      const encrypted = service.encrypt(plaintext);
      
      // Corrupt the encrypted data
      const corrupted = encrypted.slice(0, -5) + 'XXXXX';
      
      expect(() => {
        service.decrypt(corrupted);
      }).toThrow('Decryption failed');
    });

    it('should throw error when using wrong key', () => {
      const service1 = new EncryptionService(testKey);
      const service2 = new EncryptionService('different-key-0123456789abcdef0123456789abcdef');

      const plaintext = 'test';
      const encrypted = service1.encrypt(plaintext);

      expect(() => {
        service2.decrypt(encrypted);
      }).toThrow('Decryption failed');
    });
  });

  describe('Key Derivation', () => {
    it('should derive same key from same input string', () => {
      const service1 = new EncryptionService('my-key');
      const service2 = new EncryptionService('my-key');

      const plaintext = 'test';
      const encrypted1 = service1.encrypt(plaintext);
      const encrypted2 = service2.encrypt(plaintext);

      // Different ciphertexts due to IV, but both decryptable with same key
      expect(service1.decrypt(encrypted1)).toBe(plaintext);
      expect(service1.decrypt(encrypted2)).toBe(plaintext);
      expect(service2.decrypt(encrypted1)).toBe(plaintext);
      expect(service2.decrypt(encrypted2)).toBe(plaintext);
    });
  });
});

