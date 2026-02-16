/**
 * Sensitive fields configuration loader
 * Loads ISO 27001 compliant sensitive fields from JSON configuration file
 */

import * as fs from "fs";
import * as path from "path";
import defaultConfig from "./sensitive-fields.config.json";

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
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "key",
    "auth",
    "authorization",
    "cookie",
    "session",
    "apikey",
    "accesstoken",
    "refreshtoken",
    // PII (ISO 27001)
    "email",
    "emailaddress",
    "phone",
    "phonenumber",
    "telephone",
    "mobile",
    "cellphone",
    "ssn",
    "socialsecuritynumber",
    "taxid",
    "taxidentification",
    // Financial Information
    "creditcard",
    "cc",
    "cardnumber",
    "cvv",
    "cvv2",
    "cvc",
    "pin",
    "bankaccount",
    "bankaccountnumber",
    "routingnumber",
    "iban",
    "swift",
    "accountnumber",
    // Security & Sensitive Data
    "otp",
    "onetimepassword",
    "privatekey",
    "publickey",
    "encryptionkey",
    "decryptionkey",
  ]);
}

/**
 * Get default field patterns (fallback if JSON file cannot be loaded)
 */
function getDefaultFieldPatterns(): string[] {
  return [
    "password",
    "secret",
    "token",
    "key",
    "ssn",
    "creditcard",
    "bankaccount",
    "accountnumber",
  ];
}

function resolveConfigPath(customPath?: string): string | null {
  const envPath = customPath || process.env.MISO_SENSITIVE_FIELDS_CONFIG;
  if (!envPath) return null;
  return path.isAbsolute(envPath) ? envPath : path.resolve(process.cwd(), envPath);
}

function fieldsFromConfig(config: SensitiveFieldsConfig): Set<string> {
  const allFields = new Set<string>();
  Object.values(config.categories).forEach((fields: string[]) => {
    fields.forEach((field) => allFields.add(field.toLowerCase()));
  });
  getDefaultSensitiveFields().forEach((field) => allFields.add(field));
  return allFields;
}

function loadConfigFromPath(configPath: string): Set<string> | null {
  if (!fs.existsSync(configPath)) return null;
  const configContent = fs.readFileSync(configPath, "utf8");
  const config: SensitiveFieldsConfig = JSON.parse(configContent);
  return fieldsFromConfig(config);
}

function loadConfigFromModule(): Set<string> | null {
  try {
    const config = defaultConfig as unknown as SensitiveFieldsConfig;
    return fieldsFromConfig(config);
  } catch {
    const configPath = path.join(__dirname, "sensitive-fields.config.json");
    return loadConfigFromPath(configPath);
  }
}

export function loadSensitiveFieldsConfig(customPath?: string): Set<string> {
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    const globalWindow = (globalThis as Record<string, unknown>).window;
    if (typeof globalWindow !== "undefined") return getDefaultSensitiveFields();
  }
  if (typeof process === "undefined" || !process.env) return getDefaultSensitiveFields();

  try {
    const configPath = resolveConfigPath(customPath);
    if (configPath) {
      const result = loadConfigFromPath(configPath);
      if (result) return result;
    }
    const moduleResult = loadConfigFromModule();
    return moduleResult ?? getDefaultSensitiveFields();
  } catch {
    return getDefaultSensitiveFields();
  }
}

function loadFieldPatternsFromPath(configPath: string): string[] | null {
  if (!fs.existsSync(configPath)) return null;
  const configContent = fs.readFileSync(configPath, "utf8");
  const config: SensitiveFieldsConfig = JSON.parse(configContent);
  return config.fieldPatterns || getDefaultFieldPatterns();
}

function loadFieldPatternsFromModule(): string[] | null {
  try {
    const config = defaultConfig as unknown as SensitiveFieldsConfig;
    return config.fieldPatterns || getDefaultFieldPatterns();
  } catch {
    const configPath = path.join(__dirname, "sensitive-fields.config.json");
    return loadFieldPatternsFromPath(configPath);
  }
}

export function getFieldPatterns(customPath?: string): string[] {
  if (typeof globalThis !== "undefined" && "window" in globalThis) {
    const globalWindow = (globalThis as Record<string, unknown>).window;
    if (typeof globalWindow !== "undefined") return getDefaultFieldPatterns();
  }
  if (typeof process === "undefined" || !process.env) return getDefaultFieldPatterns();

  try {
    const configPath = resolveConfigPath(customPath);
    if (configPath) {
      const result = loadFieldPatternsFromPath(configPath);
      if (result) return result;
    }
    const moduleResult = loadFieldPatternsFromModule();
    return moduleResult ?? getDefaultFieldPatterns();
  } catch {
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
