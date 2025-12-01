/**
 * Data masker utility for client-side sensitive data protection
 * Implements ISO 27001 data protection controls
 */

import {
  loadSensitiveFieldsConfig,
  getFieldPatterns,
} from "./sensitive-fields.loader";

export class DataMasker {
  private static readonly MASKED_VALUE = "***MASKED***";
  private static cachedFields: Set<string> | null = null;
  private static cachedFieldPatterns: string[] | null = null;
  private static configPath: string | undefined = undefined;

  /**
   * Initialize sensitive fields from JSON configuration
   * Loads configuration on first use and caches it
   */
  private static initializeSensitiveFields(customPath?: string): Set<string> {
    // If config path changed, reload
    if (this.configPath !== customPath) {
      this.cachedFields = null;
      this.cachedFieldPatterns = null;
      this.configPath = customPath;
    }

    // Return cached if available
    if (this.cachedFields) {
      return this.cachedFields;
    }

    // Load from JSON config (with fallback to defaults)
    this.cachedFields = loadSensitiveFieldsConfig(customPath);
    this.cachedFieldPatterns = getFieldPatterns(customPath);

    return this.cachedFields;
  }

  /**
   * Get sensitive fields set (lazy loaded from JSON config)
   */
  private static getSensitiveFields(): Set<string> {
    return this.initializeSensitiveFields(this.configPath);
  }

  /**
   * Get field patterns (lazy loaded from JSON config)
   */
  private static getFieldPatterns(): string[] {
    if (!this.cachedFieldPatterns) {
      this.cachedFieldPatterns = getFieldPatterns(this.configPath);
    }
    return this.cachedFieldPatterns;
  }

  /**
   * Set custom configuration path (call before first use if needed)
   */
  static setConfigPath(customPath: string): void {
    this.configPath = customPath;
    this.cachedFields = null;
    this.cachedFieldPatterns = null;
  }

  /**
   * Check if a field name indicates sensitive data
   */
  static isSensitiveField(key: string): boolean {
    const sensitiveFields = this.getSensitiveFields();
    const fieldPatterns = this.getFieldPatterns();
    const lowerKey = key.toLowerCase().replace(/[_-]/g, "");

    // Check exact match
    if (sensitiveFields.has(lowerKey)) {
      return true;
    }

    // Check if field contains sensitive keywords (from fieldPatterns)
    for (const pattern of fieldPatterns) {
      if (lowerKey.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  }

  /**
   * Mask sensitive data in objects, arrays, or primitives
   * Returns a masked copy without modifying the original
   */
  static maskSensitiveData(data: unknown): unknown {
    // Handle null and undefined
    if (data === null || data === undefined) {
      return data;
    }

    // Handle primitives (string, number, boolean)
    if (typeof data !== "object") {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    // Handle objects
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (this.isSensitiveField(key)) {
        // Mask sensitive field
        masked[key] = this.MASKED_VALUE;
      } else if (typeof value === "object" && value !== null) {
        // Recursively mask nested objects
        masked[key] = this.maskSensitiveData(value);
      } else {
        // Keep non-sensitive value as-is
        masked[key] = value;
      }
    }

    return masked;
  }

  /**
   * Mask specific value (useful for masking individual strings)
   */
  static maskValue(
    value: string,
    showFirst: number = 0,
    showLast: number = 0,
  ): string {
    if (!value || value.length <= showFirst + showLast) {
      return this.MASKED_VALUE;
    }

    const first = value.substring(0, showFirst);
    const last = value.substring(value.length - showLast);
    const masked = "*".repeat(Math.min(8, value.length - showFirst - showLast));

    return `${first}${masked}${last}`;
  }

  /**
   * Check if data contains sensitive information
   */
  static containsSensitiveData(data: unknown): boolean {
    if (data === null || data === undefined || typeof data !== "object") {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.containsSensitiveData(item));
    }

    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (this.isSensitiveField(key)) {
        return true;
      }
      if (typeof value === "object" && value !== null) {
        if (this.containsSensitiveData(value)) {
          return true;
        }
      }
    }

    return false;
  }
}
