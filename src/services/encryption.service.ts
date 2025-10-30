/**
 * Encryption service for symmetric encryption using AES-256-GCM
 */

import * as crypto from 'crypto';

export class EncryptionService {
  private key: Buffer;
  private algorithm = 'aes-256-gcm';

  /**
   * Create an EncryptionService instance
   * @param encryptionKey - Optional encryption key. If not provided, reads from ENCRYPTION_KEY env var.
   *                        Supports hex, base64, or raw string format.
   *                        If string length is not 32 bytes, derives a 32-byte key using SHA-256.
   */
  constructor(encryptionKey?: string) {
    const keyString = encryptionKey || process.env.ENCRYPTION_KEY;

    if (!keyString) {
      throw new Error(
        'Encryption key is required. Provide via constructor parameter or set ENCRYPTION_KEY environment variable.'
      );
    }

    // Derive a 32-byte key from the provided key
    this.key = this.deriveKey(keyString);
  }

  /**
   * Derive a 32-byte key from the provided key string
   * Supports hex, base64, or raw string format
   */
  private deriveKey(keyString: string): Buffer {
    // Try to parse as hex (64 hex chars = 32 bytes)
    if (/^[0-9a-fA-F]{64}$/.test(keyString)) {
      return Buffer.from(keyString, 'hex');
    }

    // Try to parse as base64
    try {
      const base64Decoded = Buffer.from(keyString, 'base64');
      if (base64Decoded.length === 32) {
        return base64Decoded;
      }
    } catch {
      // Not valid base64, continue
    }

    // Use SHA-256 to derive a 32-byte key from the string
    return crypto.createHash('sha256').update(keyString, 'utf8').digest();
  }

  /**
   * Encrypt plaintext and return base64-encoded string
   * @param plaintext - The plaintext string to encrypt
   * @returns Base64-encoded encrypted string (format: iv:authTag:ciphertext)
   */
  encrypt(plaintext: string): string {
    if (plaintext === '') {
      return '';
    }

    try {
      // Generate random IV (12 bytes for GCM)
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv(this.algorithm, this.key, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(plaintext, 'utf8');
      encrypted = Buffer.concat([encrypted, cipher.final()]);

      // Get authentication tag
      const authTag = cipher.getAuthTag();

      // Combine IV, authTag, and ciphertext, then base64 encode
      const combined = Buffer.concat([iv, authTag, encrypted]);
      return combined.toString('base64');
    } catch (error) {
      throw new Error(
        `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Decrypt base64-encoded encrypted string
   * @param encryptedText - Base64-encoded encrypted string (format: iv:authTag:ciphertext)
   * @returns Decrypted plaintext string
   */
  decrypt(encryptedText: string): string {
    if (encryptedText === '') {
      return '';
    }

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedText, 'base64');

      // Extract IV (12 bytes), authTag (16 bytes), and ciphertext
      if (combined.length < 28) {
        throw new Error('Invalid encrypted data: too short');
      }

      const iv = combined.subarray(0, 12);
      const authTag = combined.subarray(12, 28);
      const ciphertext = combined.subarray(28);

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

