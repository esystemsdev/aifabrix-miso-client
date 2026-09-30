/** Bounded, request-scoped sanitization before errors or diagnostic sinks escape. */
import type { AxiosRequestConfig } from "axios";
import type { MisoClientConfig } from "../types/config.types";
import { DataMasker } from "./data-masker";

const MASKED = "***MASKED***";
const LIMIT = 65536;
export type DiagnosticSanitizer = (value: unknown) => unknown;
const contexts = new WeakMap<object, DiagnosticSanitizer>();

function sensitive(key: string): boolean {
  if (key === "authMethod") return false;
  return (
    /^(plaintext|value|encryptionkey|clientid)$/i.test(key) ||
    DataMasker.isSensitiveField(key)
  );
}

/** Parse only bounded JSON, leaving ordinary text for value redaction. */
export function diagnosticData(value: unknown): unknown {
  if (typeof value !== "string") return value;
  if (value.length > LIMIT) return MASKED;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function collectSecrets(value: unknown, secrets: Set<string>): void {
  const seen = new WeakSet<object>();
  let nodes = 0;
  const visit = (item: unknown, depth: number): void => {
    if (
      !item ||
      typeof item !== "object" ||
      depth > 8 ||
      ++nodes > 2048 ||
      seen.has(item)
    )
      return;
    seen.add(item);
    for (const [key, field] of Object.entries(item).slice(0, 128)) {
      if (sensitive(key) && typeof field === "string" && field) {
        secrets.add(field);
        if (/^Bearer /i.test(field)) secrets.add(field.slice(7));
      } else if (typeof field === "object") visit(field, depth + 1);
    }
  };
  try {
    visit(value, 0);
  } catch {
    /* Unreadable fields are never exposed. */
  }
}

function redactor(secrets: Set<string>): (text: string) => string {
  const values = [...secrets]
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  return (text) => {
    if (text.length > LIMIT) return MASKED;
    for (const secret of values) text = text.split(secret).join(MASKED);
    return text;
  };
}

/** Create a sanitizer without storing credentials on the request or public exception. */
export function createDiagnosticSanitizer(
  config?: Partial<MisoClientConfig>,
  request?: AxiosRequestConfig,
): DiagnosticSanitizer {
  const secrets = new Set<string>();
  collectSecrets(
    {
      clientId: config?.clientId,
      clientSecret: config?.clientSecret,
      clientToken: config?.clientToken,
      encryptionKey: config?.encryptionKey,
    },
    secrets,
  );
  collectSecrets(request?.headers, secrets);
  collectSecrets(diagnosticData(request?.data), secrets);
  const redact = redactor(secrets);
  return (value) => {
    const seen = new WeakSet<object>();
    let nodes = 0;
    let size = 0;
    const visit = (item: unknown, depth: number): unknown => {
      if (++nodes > 2048 || depth > 12) return MASKED;
      if (typeof item === "string") {
        size += item.length;
        return size > LIMIT ? MASKED : redact(item);
      }
      if (item === null || typeof item !== "object") return item;
      if (seen.has(item)) return MASKED;
      seen.add(item);
      if (Array.isArray(item))
        return item.slice(0, 128).map((v) => visit(v, depth + 1));
      const result: Record<string, unknown> = {};
      for (const key of Object.keys(item).slice(0, 128)) {
        const safeKey = redact(key);
        if (["__proto__", "constructor", "prototype"].includes(safeKey))
          continue;
        result[safeKey] = sensitive(key)
          ? MASKED
          : visit((item as Record<string, unknown>)[key], depth + 1);
      }
      return result;
    };
    try {
      return visit(value, 0);
    } catch {
      return MASKED;
    }
  };
}

/** Weakly associate an error with its request's sanitizer for extraction overrides. */
export function bindDiagnosticSanitizer(
  target: object,
  sanitize: DiagnosticSanitizer,
): void {
  contexts.set(target, sanitize);
}
export function sanitizeErrorDiagnostic(
  error: object,
  value: unknown,
): unknown {
  return (contexts.get(error) ?? createDiagnosticSanitizer())(value);
}

/** Safe message for audit paths, including minimal and fallback logging. */
export function diagnosticMessage(
  error: { message?: string; config?: AxiosRequestConfig } | null,
  config: Partial<MisoClientConfig>,
): string | undefined {
  if (!error) return undefined;
  return createDiagnosticSanitizer(config, error.config)(error.message) as
    string | undefined;
}
