/**
 * Encryption Utility
 * AES-256-GCM encryption for sensitive database fields
 */

import crypto from "crypto";

export class EncryptionUtil {
  private static algorithm = "aes-256-gcm";
  private static key: Buffer;
  private static initialized = false;

  /**
   * Initialize encryption with key from environment
   * Must be called before encrypt/decrypt operations
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    const encryptionKey = process.env["ENCRYPTION_KEY"];
    if (!encryptionKey) {
      throw new Error("ENCRYPTION_KEY environment variable not configured");
    }

    // Validate key length (should be 64 hex characters = 32 bytes)
    if (encryptionKey.length !== 64) {
      throw new Error("ENCRYPTION_KEY must be 64 hex characters (32 bytes)");
    }

    try {
      this.key = Buffer.from(encryptionKey, "hex");
    } catch (error) {
      throw new Error("ENCRYPTION_KEY must be valid hex string");
    }

    this.initialized = true;
  }

  /**
   * Encrypt a string value
   * Returns: iv:authTag:encryptedData (all in hex)
   */
  static encrypt(text: string): string {
    if (!this.initialized) {
      throw new Error(
        "EncryptionUtil not initialized. Call initialize() first.",
      );
    }

    if (!text) {
      throw new Error("Cannot encrypt empty text");
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      this.algorithm,
      this.key,
      iv,
    ) as crypto.CipherGCM;

    let encrypted = cipher.update(text, "utf8", "hex");
    encrypted += cipher.final("hex");

    const authTag = cipher.getAuthTag();

    // Format: iv:authTag:encryptedData
    return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
  }

  /**
   * Decrypt an encrypted string
   * Expects format: iv:authTag:encryptedData (all in hex)
   */
  static decrypt(encryptedText: string): string {
    if (!this.initialized) {
      throw new Error(
        "EncryptionUtil not initialized. Call initialize() first.",
      );
    }

    if (!encryptedText) {
      throw new Error("Cannot decrypt empty text");
    }

    try {
      const parts = encryptedText.split(":");
      if (parts.length !== 3) {
        throw new Error("Invalid encrypted text format");
      }

      const iv = Buffer.from(parts[0] || "", "hex");
      const authTag = Buffer.from(parts[1] || "", "hex");
      const encrypted = parts[2] || "";

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.key,
        iv,
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      return decrypted;
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Generate a new encryption key (for setup/documentation)
   */
  static generateKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
