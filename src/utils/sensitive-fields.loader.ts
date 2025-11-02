/**
 * Sensitive fields configuration loader
 * Loads ISO 27001 compliant sensitive fields from JSON configuration file
 */

import * as fs from 'fs';
import * as path from 'path';
import defaultConfig from './sensitive-fields.config.json';

export interface SensitiveFieldsConfig {
  version: string;
  description: string;
  categories: {
    authentication: string[];
    pii: string[];
    financial: string[];
    security: string[];
  };
  fieldPatterns: string[];
}

/**
 * Get default sensitive fields (fallback if JSON file cannot be loaded)
 */
function getDefaultSensitiveFields(): Set<string> {
  return new Set([
    // Authentication & Authorization
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
    'apikey',
    'accesstoken',
    'refreshtoken',
    // PII (ISO 27001)
    'email',
    'emailaddress',
    'phone',
    'phonenumber',
    'telephone',
    'mobile',
    'cellphone',
    'ssn',
    'socialsecuritynumber',
    'taxid',
    'taxidentification',
    // Financial Information
    'creditcard',
    'cc',
    'cardnumber',
    'cvv',
    'cvv2',
    'cvc',
    'pin',
    'bankaccount',
    'bankaccountnumber',
    'routingnumber',
    'iban',
    'swift',
    'accountnumber',
    // Security & Sensitive Data
    'otp',
    'onetimepassword',
    'privatekey',
    'publickey',
    'encryptionkey',
    'decryptionkey'
  ]);
}

/**
 * Get default field patterns (fallback if JSON file cannot be loaded)
 */
function getDefaultFieldPatterns(): string[] {
  return ['password', 'secret', 'token', 'key', 'ssn', 'creditcard', 'bankaccount', 'accountnumber'];
}

/**
 * Load sensitive fields configuration from JSON file
 * Supports Node.js (fs) and browser environments (falls back to defaults in browser)
 */
export function loadSensitiveFieldsConfig(customPath?: string): Set<string> {
  // Browser environment - return defaults
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    const globalWindow = (globalThis as Record<string, unknown>).window;
    if (typeof globalWindow !== 'undefined') {
      return getDefaultSensitiveFields();
    }
  }
  if (typeof process === 'undefined' || !process.env) {
    return getDefaultSensitiveFields();
  }

  try {
    // If custom path provided, load from filesystem
    if (customPath || process.env.MISO_SENSITIVE_FIELDS_CONFIG) {
      let configPath: string;
      if (customPath) {
        configPath = path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
      } else {
        const envPath = process.env.MISO_SENSITIVE_FIELDS_CONFIG!;
        configPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
      }

      if (!fs.existsSync(configPath)) {
        // Config file not found, use defaults
        return getDefaultSensitiveFields();
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const config: SensitiveFieldsConfig = JSON.parse(configContent);

      // Combine all categories into a single set (lowercase for case-insensitive matching)
      const allFields = new Set<string>();
      Object.values(config.categories).forEach((fields: string[]) => {
        fields.forEach((field) => allFields.add(field.toLowerCase()));
      });

      // Also add default fields to ensure we have all base fields
      const defaults = getDefaultSensitiveFields();
      defaults.forEach((field) => allFields.add(field));

      return allFields;
    }

    // No custom path - try to load default config as module (works in compiled code)
    try {
      const config = defaultConfig as unknown as SensitiveFieldsConfig;
      const allFields = new Set<string>();
      Object.values(config.categories).forEach((fields: string[]) => {
        fields.forEach((field) => allFields.add(field.toLowerCase()));
      });
      // Also add default fields to ensure we have all base fields
      const defaults = getDefaultSensitiveFields();
      defaults.forEach((field) => allFields.add(field));
      return allFields;
    } catch {
      // If module import fails, try filesystem path (for development/source code)
      const configPath = path.join(__dirname, 'sensitive-fields.config.json');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config: SensitiveFieldsConfig = JSON.parse(configContent);
        const allFields = new Set<string>();
        Object.values(config.categories).forEach((fields: string[]) => {
          fields.forEach((field) => allFields.add(field.toLowerCase()));
        });
        const defaults = getDefaultSensitiveFields();
        defaults.forEach((field) => allFields.add(field));
        return allFields;
      }
    }
    
    // Fallback to defaults if nothing worked
    return getDefaultSensitiveFields();
  } catch (error) {
    // Failed to load config, use defaults
    return getDefaultSensitiveFields();
  }
}

/**
 * Get field patterns for pattern matching
 */
export function getFieldPatterns(customPath?: string): string[] {
  // Browser environment - return defaults
  if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
    const globalWindow = (globalThis as Record<string, unknown>).window;
    if (typeof globalWindow !== 'undefined') {
      return getDefaultFieldPatterns();
    }
  }
  if (typeof process === 'undefined' || !process.env) {
    return getDefaultFieldPatterns();
  }

  try {
    // If custom path provided, load from filesystem
    if (customPath || process.env.MISO_SENSITIVE_FIELDS_CONFIG) {
      let configPath: string;
      if (customPath) {
        configPath = path.isAbsolute(customPath) ? customPath : path.resolve(process.cwd(), customPath);
      } else {
        const envPath = process.env.MISO_SENSITIVE_FIELDS_CONFIG!;
        configPath = path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
      }

      if (!fs.existsSync(configPath)) {
        return getDefaultFieldPatterns();
      }

      const configContent = fs.readFileSync(configPath, 'utf8');
      const config: SensitiveFieldsConfig = JSON.parse(configContent);
      return config.fieldPatterns || getDefaultFieldPatterns();
    }

    // No custom path - try to load default config as module (works in compiled code)
    try {
      const config = defaultConfig as unknown as SensitiveFieldsConfig;
      return config.fieldPatterns || getDefaultFieldPatterns();
    } catch {
      // If module import fails, try filesystem path (for development/source code)
      const configPath = path.join(__dirname, 'sensitive-fields.config.json');
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8');
        const config: SensitiveFieldsConfig = JSON.parse(configContent);
        return config.fieldPatterns || getDefaultFieldPatterns();
      }
    }

    return getDefaultFieldPatterns();
  } catch (error) {
    // Failed to load config, use defaults
    return getDefaultFieldPatterns();
  }
}

/**
 * Get all sensitive fields as array (for DataMasker)
 */
export function getSensitiveFieldsArray(customPath?: string): string[] {
  const fieldsSet = loadSensitiveFieldsConfig(customPath);
  return Array.from(fieldsSet);
}

