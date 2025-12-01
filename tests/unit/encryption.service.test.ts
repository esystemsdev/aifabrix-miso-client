/**
 * Unit tests for EncryptionUtil
 */

import { EncryptionUtil } from "../../src/express/encryption";

describe("EncryptionUtil", () => {
  const testKey =
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; // 64 hex chars = 32 bytes

  beforeEach(() => {
    // Reset initialization state before each test
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (EncryptionUtil as any).initialized = false;
  });

  describe("initialize()", () => {
    it("should initialize with env var", () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = testKey;

      expect(() => EncryptionUtil.initialize()).not.toThrow();

      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it("should throw error when no key is provided", () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      delete process.env.ENCRYPTION_KEY;

      expect(() => {
        EncryptionUtil.initialize();
      }).toThrow("ENCRYPTION_KEY environment variable not configured");

      if (originalEnv) {
        process.env.ENCRYPTION_KEY = originalEnv;
      }
    });

    it("should throw error when key length is invalid", () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = "short-key";

      expect(() => {
        EncryptionUtil.initialize();
      }).toThrow("ENCRYPTION_KEY must be 64 hex characters");

      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it("should accept valid hex key", () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = testKey;

      expect(() => EncryptionUtil.initialize()).not.toThrow();

      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it("should not reinitialize if already initialized", () => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = testKey;

      EncryptionUtil.initialize();
      expect(() => EncryptionUtil.initialize()).not.toThrow();

      process.env.ENCRYPTION_KEY = originalEnv;
    });
  });

  describe("Encryption/Decryption", () => {
    beforeEach(() => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = testKey;
      EncryptionUtil.initialize();
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it("should encrypt and decrypt plaintext successfully", () => {
      const plaintext = "Hello, World!";
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(encrypted).toMatch(/^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/); // Hex format: iv:authTag:ciphertext
      expect(decrypted).toBe(plaintext);
    });

    it("should handle empty string", () => {
      expect(() => EncryptionUtil.encrypt("")).toThrow(
        "Cannot encrypt empty text",
      );
      expect(() => EncryptionUtil.decrypt("")).toThrow(
        "Cannot decrypt empty text",
      );
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", () => {
      const plaintext = "same text";
      const encrypted1 = EncryptionUtil.encrypt(plaintext);
      const encrypted2 = EncryptionUtil.encrypt(plaintext);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to same plaintext
      expect(EncryptionUtil.decrypt(encrypted1)).toBe(plaintext);
      expect(EncryptionUtil.decrypt(encrypted2)).toBe(plaintext);
    });

    it("should handle special characters", () => {
      const plaintext = "Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?";
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle unicode characters", () => {
      const plaintext = "Unicode: 你好世界 🌍";
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle long strings", () => {
      const plaintext = "A".repeat(10000);
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("should handle JSON strings", () => {
      const jsonData = JSON.stringify({
        name: "John",
        age: 30,
        items: [1, 2, 3],
      });
      const encrypted = EncryptionUtil.encrypt(jsonData);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });
  });

  describe("Error Handling", () => {
    beforeEach(() => {
      const originalEnv = process.env.ENCRYPTION_KEY;
      process.env.ENCRYPTION_KEY = testKey;
      EncryptionUtil.initialize();
      process.env.ENCRYPTION_KEY = originalEnv;
    });

    it("should throw error when not initialized", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (EncryptionUtil as any).initialized = false;

      expect(() => {
        EncryptionUtil.encrypt("test");
      }).toThrow("EncryptionUtil not initialized");

      expect(() => {
        EncryptionUtil.decrypt("test:test:test");
      }).toThrow("EncryptionUtil not initialized");
    });

    it("should throw error on invalid encrypted data", () => {
      expect(() => {
        EncryptionUtil.decrypt("invalid-data");
      }).toThrow("Invalid encrypted text format");
    });

    it("should throw error on too short encrypted data", () => {
      expect(() => {
        EncryptionUtil.decrypt("aa:bb:cc");
      }).toThrow("Decryption failed");
    });

    it("should throw error on corrupted encrypted data", () => {
      const plaintext = "test";
      const encrypted = EncryptionUtil.encrypt(plaintext);

      // Corrupt the encrypted data
      const parts = encrypted.split(":");
      const corrupted = parts[0] + ":" + parts[1] + ":" + "XXXXXXXXXX";

      expect(() => {
        EncryptionUtil.decrypt(corrupted);
      }).toThrow("Decryption failed");
    });
  });

  describe("generateKey()", () => {
    it("should generate a valid 64-character hex key", () => {
      const key = EncryptionUtil.generateKey();
      expect(key).toMatch(/^[0-9a-f]{64}$/);
    });

    it("should generate unique keys", () => {
      const key1 = EncryptionUtil.generateKey();
      const key2 = EncryptionUtil.generateKey();
      expect(key1).not.toBe(key2);
    });

    it("generated key should be usable for encryption", () => {
      const key = EncryptionUtil.generateKey();
      const originalEnv = process.env.ENCRYPTION_KEY;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (EncryptionUtil as any).initialized = false;
      process.env.ENCRYPTION_KEY = key;
      EncryptionUtil.initialize();

      const plaintext = "test";
      const encrypted = EncryptionUtil.encrypt(plaintext);
      const decrypted = EncryptionUtil.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);

      process.env.ENCRYPTION_KEY = originalEnv;
    });
  });
});
