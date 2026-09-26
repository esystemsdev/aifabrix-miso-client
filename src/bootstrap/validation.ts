import { BootstrapError, BootstrapSnapshot } from "./types";

const FIELDS = [
  "protocolVersion",
  "issuedAt",
  "context",
  "clientId",
  "clientToken",
  "clientTokenExpiresAt",
  "configuration",
  "refreshAfter",
  "expiresAt",
];
const CONTEXT = ["installationId", "applicationId", "environmentId"];
const RESERVED = new Set([
  "MISO_AUTH_MODE",
  "MISO_CONTROLLER_URL",
  "MISO_CLIENTID",
  "MISO_CLIENT_ID",
  "MISO_CLIENTSECRET",
  "MISO_CLIENT_SECRET",
  "MISO_AUTH_STRATEGY",
  "MISO_CLIENT_TOKEN_URI",
]);

function invalid(): never {
  throw new BootstrapError("protocol-error");
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]): void {
  if (
    Object.keys(value).length !== keys.length ||
    keys.some((k) => !Object.prototype.hasOwnProperty.call(value, k))
  )
    invalid();
}
function text(value: unknown, max: number): void {
  if (typeof value !== "string" || !value.length || value.length > max)
    invalid();
}
function timestamp(value: unknown): number {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)
  )
    invalid();
  const date = Date.parse(value);
  if (
    !Number.isFinite(date) ||
    new Date(date).toISOString().replace(".000Z", "Z") !==
      value.replace(".000Z", "Z")
  )
    invalid();
  return date;
}
function configuration(value: unknown): void {
  const entries = Object.entries(record(value));
  if (entries.length > 256) invalid();
  for (const [key, item] of entries) {
    if (!/^[A-Z][A-Z0-9_]{0,127}$/.test(key) || RESERVED.has(key)) invalid();
    if (typeof item !== "string" || Buffer.byteLength(item) > 65536) invalid();
  }
}
/**
 * Validate v1 snapshot data against its schema and current clock.
 * @param value Untrusted snapshot data (not the response envelope).
 * @returns Validated snapshot; callers must not log or serialize its secrets.
 * @throws BootstrapError when the schema, timestamps or configuration are invalid.
 */
export function validateSnapshot(value: unknown): BootstrapSnapshot {
  const data = record(value);
  exact(data, FIELDS);
  if (data.protocolVersion !== 1) invalid();
  const context = record(data.context);
  exact(context, CONTEXT);
  CONTEXT.forEach((key) => text(context[key], 128));
  text(data.clientId, 256);
  text(data.clientToken, 65536);
  configuration(data.configuration);
  validateTimes(data);
  return data as unknown as BootstrapSnapshot;
}
function validateTimes(data: Record<string, unknown>): void {
  const issue = timestamp(data.issuedAt);
  if (Math.abs(Date.now() - issue) > 30000) invalid();
  const deltas = {
    refreshAfter: 120000,
    clientTokenExpiresAt: 300000,
    expiresAt: 900000,
  };
  for (const [key, delta] of Object.entries(deltas)) {
    if (timestamp(data[key]) !== issue + delta) invalid();
  }
  if (timestamp(data.refreshAfter) <= Date.now()) invalid();
}
