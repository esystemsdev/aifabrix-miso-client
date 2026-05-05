/**
 * Sensitive fields configuration loader for ISO 27001 compliance.
 * Aligns with miso-client Python `sensitive_fields_loader` / packaged JSON shape.
 */

import * as fs from "fs";
import * as path from "path";
import defaultConfig from "./sensitive-fields.config.json";

/** Normalized field name (lowercase, no underscores or hyphens). */
export function normalizeFieldName(field: string): string {
  return field.toLowerCase().replace(/[_-]/g, "");
}

/**
 * Hardcoded sensitive tokens when JSON cannot be loaded or mergeWithHardcodedDefaults is true.
 * Omits bare `key` and `cc` to reduce false positives (e.g. datasource `key`, `success`).
 */
export const HARDCODED_SENSITIVE_FIELDS: ReadonlySet<string> = new Set([
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "auth",
  "authorization",
  "cookie",
  "session",
  "ssn",
  "creditcard",
  "cvv",
  "pin",
  "otp",
  "apikey",
  "accesstoken",
  "refreshtoken",
  "privatekey",
  "secretkey",
]);

function isBrowserEnvironment(): boolean {
  return (
    typeof globalThis !== "undefined" &&
    "window" in globalThis &&
    typeof (globalThis as Record<string, unknown>).window !== "undefined"
  );
}

function resolveConfigFilePath(customPath?: string): string | null {
  if (customPath) {
    return path.isAbsolute(customPath)
      ? customPath
      : path.resolve(process.cwd(), customPath);
  }
  const envPath = process.env.MISO_SENSITIVE_FIELDS_CONFIG;
  if (envPath) {
    return path.isAbsolute(envPath)
      ? envPath
      : path.resolve(process.cwd(), envPath);
  }
  return path.join(__dirname, "sensitive-fields.config.json");
}

function readJsonFile(filePath: string): Record<string, unknown> {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/**
 * Load raw sensitive-fields JSON by priority: customPath, MISO_SENSITIVE_FIELDS_CONFIG, packaged default file, then bundled import.
 */
export function loadSensitiveFieldsConfigDict(
  customPath?: string,
): Record<string, unknown> {
  if (isBrowserEnvironment()) {
    return {};
  }
  if (typeof process === "undefined" || !process.env) {
    return {};
  }

  try {
    const filePath = resolveConfigFilePath(customPath);
    if (filePath && fs.existsSync(filePath)) {
      const fromDisk = readJsonFile(filePath);
      if (Object.keys(fromDisk).length > 0) {
        return fromDisk;
      }
    }
  } catch {
    /* fall through */
  }

  try {
    const bundled = defaultConfig as unknown as Record<string, unknown>;
    if (bundled && typeof bundled === "object") {
      return bundled;
    }
  } catch {
    /* fall through */
  }

  return {};
}

function uniqueFieldsPreservingOrder(fields: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const field of fields) {
    const k = field.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(field);
  }
  return out;
}

/**
 * Flatten `fields` or legacy `categories` from config into display names (not yet normalized).
 */
export function getSensitiveFieldNamesFromDict(
  cfg: Record<string, unknown>,
): string[] {
  const bucket = (cfg.fields ?? cfg.categories) as unknown;
  if (!bucket || typeof bucket !== "object" || Array.isArray(bucket)) {
    return [];
  }
  const all: string[] = [];
  for (const v of Object.values(bucket as Record<string, unknown>)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (typeof item === "string" && item.trim()) {
          all.push(item);
        }
      }
    }
  }
  return uniqueFieldsPreservingOrder(all);
}

export function neverMaskFieldsFromCfg(
  cfg: Record<string, unknown>,
): Set<string> {
  const raw = cfg.neverMaskFields;
  const out = new Set<string>();
  if (!Array.isArray(raw)) return out;
  for (const x of raw) {
    if (typeof x === "string" && x.trim()) {
      out.add(normalizeFieldName(x));
    }
  }
  return out;
}

export function substringMinLengthFromCfg(
  cfg: Record<string, unknown>,
): number {
  const sm = cfg.substringMinLength ?? 4;
  try {
    const n = Number(sm);
    if (!Number.isFinite(n)) return 4;
    return Math.max(1, Math.min(Math.trunc(n), 64));
  } catch {
    return 4;
  }
}

export function mergeWithHardcodedDefaultsFromCfg(
  cfg: Record<string, unknown>,
): boolean {
  return cfg.mergeWithHardcodedDefaults !== false;
}

function fieldPatternsFromCfg(cfg: Record<string, unknown>): string[] {
  const p = cfg.fieldPatterns;
  return Array.isArray(p)
    ? p.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
}

/**
 * Build merged normalized sensitive tokens (hardcoded + JSON fields + fieldPatterns).
 */
export function buildMergedSensitiveTokens(
  cfg: Record<string, unknown>,
): Set<string> {
  const merge = mergeWithHardcodedDefaultsFromCfg(cfg);
  const merged = new Set<string>();

  if (merge) {
    HARDCODED_SENSITIVE_FIELDS.forEach((f) => merged.add(f));
  }

  for (const field of getSensitiveFieldNamesFromDict(cfg)) {
    merged.add(normalizeFieldName(field));
  }

  for (const pattern of fieldPatternsFromCfg(cfg)) {
    merged.add(normalizeFieldName(pattern));
  }

  if (!merge && merged.size === 0) {
    HARDCODED_SENSITIVE_FIELDS.forEach((f) => merged.add(f));
  }

  return merged;
}

/**
 * Merged sensitive field tokens for the resolved config (used by DataMasker helpers).
 */
export function loadSensitiveFieldsConfig(customPath?: string): Set<string> {
  if (isBrowserEnvironment()) {
    return new Set(HARDCODED_SENSITIVE_FIELDS);
  }
  if (typeof process === "undefined" || !process.env) {
    return new Set(HARDCODED_SENSITIVE_FIELDS);
  }

  const cfg = loadSensitiveFieldsConfigDict(customPath);
  return buildMergedSensitiveTokens(cfg);
}

export function getFieldPatterns(customPath?: string): string[] {
  if (isBrowserEnvironment()) {
    return [];
  }
  if (typeof process === "undefined" || !process.env) {
    return [];
  }

  const cfg = loadSensitiveFieldsConfigDict(customPath);
  const fromFile = fieldPatternsFromCfg(cfg);
  return fromFile.length > 0 ? fromFile : [];
}

export function getSensitiveFieldsArray(customPath?: string): string[] {
  return Array.from(loadSensitiveFieldsConfig(customPath));
}
