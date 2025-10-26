/**
 * Data masker utility for client-side sensitive data protection
 * Implements ISO 27001 data protection controls
 */

export class DataMasker {
  private static readonly MASKED_VALUE = '***MASKED***';

  private static readonly sensitiveFields = new Set([
    'password',
    'passwd',
    'pwd',
    'secret',
    'token',
    'key',
    'auth',
    'authorization',
    'cookie',
    'session',
    'ssn',
    'creditcard',
    'cc',
    'cvv',
    'pin',
    'otp',
    'apikey',
    'accesstoken',
    'refreshtoken',
    'privatekey',
    'secretkey'
  ]);

  /**
   * Check if a field name indicates sensitive data
   */
  static isSensitiveField(key: string): boolean {
    const lowerKey = key.toLowerCase().replace(/[_-]/g, '');

    // Check exact match
    if (this.sensitiveFields.has(lowerKey)) {
      return true;
    }

    // Check if field contains sensitive keywords
    for (const sensitiveField of this.sensitiveFields) {
      if (lowerKey.includes(sensitiveField)) {
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
    if (typeof data !== 'object') {
      return data;
    }

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map((item) => this.maskSensitiveData(item));
    }

    // Handle objects
    const masked: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (this.isSensitiveField(key)) {
        // Mask sensitive field
        masked[key] = this.MASKED_VALUE;
      } else if (typeof value === 'object' && value !== null) {
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
  static maskValue(value: string, showFirst: number = 0, showLast: number = 0): string {
    if (!value || value.length <= showFirst + showLast) {
      return this.MASKED_VALUE;
    }

    const first = value.substring(0, showFirst);
    const last = value.substring(value.length - showLast);
    const masked = '*'.repeat(Math.min(8, value.length - showFirst - showLast));

    return `${first}${masked}${last}`;
  }

  /**
   * Check if data contains sensitive information
   */
  static containsSensitiveData(data: unknown): boolean {
    if (data === null || data === undefined || typeof data !== 'object') {
      return false;
    }

    if (Array.isArray(data)) {
      return data.some((item) => this.containsSensitiveData(item));
    }

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (this.isSensitiveField(key)) {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        if (this.containsSensitiveData(value)) {
          return true;
        }
      }
    }

    return false;
  }
}
