/**
 * DataClient audit logging utilities
 * Handles ISO 27001 compliant audit logging for HTTP requests
 */

import { MisoClient } from "../index";
import { AuditConfig } from "../types/data-client.types";
import { LoggerContextStorage } from "../services/logger/logger-context-storage";
import { DataMasker } from "./data-masker";
import { truncatePayload, extractUserIdFromToken } from "./data-client-utils";
import { writeWarn } from "./console-logger";

/**
 * Check if endpoint should skip audit logging
 */
export function shouldSkipAudit(
  endpoint: string,
  auditConfig: AuditConfig | undefined,
): boolean {
  if (!auditConfig?.enabled) return true;
  const skipEndpoints = auditConfig.skipEndpoints || [];
  return skipEndpoints.some((skip) => endpoint.includes(skip));
}

/**
 * Check if any authentication token is available
 */
export type HasAnyTokenFn = () => boolean;

/**
 * Get user token
 */
export type GetTokenFn = () => string | null;

/** Internal options for logDataClientAudit */
interface LogAuditOpts {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  misoClient: MisoClient;
  auditConfig: AuditConfig | undefined;
  getToken: GetTokenFn;
  requestSize?: number;
  responseSize?: number;
  error?: Error;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
}

function maskPayload(data: unknown, maxSize: number, mask: boolean): unknown {
  const truncated = truncatePayload(data, maxSize);
  return mask && !truncated.truncated
    ? DataMasker.maskSensitiveData(truncated.data)
    : truncated.data;
}

function isExpectedAuditError(
  err: Error & { statusCode?: number; response?: { status?: number }; code?: string },
): boolean {
  const statusCode = err.statusCode || err.response?.status;
  const msg = err.message || String(err);
  const code = err.code;
  const isNetwork =
    code === "ECONNREFUSED" ||
    code === "ENOTFOUND" ||
    msg.includes("ERR_CONNECTION_REFUSED") ||
    msg.includes("Failed to fetch") ||
    msg.includes("NetworkError") ||
    msg.includes("network error");
  return statusCode === 401 || Boolean(isNetwork);
}

async function runWithTokenContext(
  token: string | null,
  handler: () => Promise<void>,
): Promise<void> {
  if (!token) {
    await handler();
    return;
  }
  const ctx = LoggerContextStorage.getInstance();
  await ctx.runWithContextAsync({ token }, handler);
}

async function performAudit(
  misoClient: MisoClient,
  token: string | null,
  method: string,
  url: string,
  auditContext: Record<string, unknown>,
): Promise<void> {
  await runWithTokenContext(token, async () => {
    await misoClient.log.audit(`http.request.${method.toLowerCase()}`, url, auditContext);
  });
}

function addStandardAuditContext(
  ctx: Record<string, unknown>,
  opts: LogAuditOpts,
): void {
  const maxResp = opts.auditConfig?.maxResponseSize || 10000;
  const maxMask = opts.auditConfig?.maxMaskingSize || 50000;
  ctx.requestBody = opts.requestBody !== undefined ? maskPayload(opts.requestBody, maxMask, true) : undefined;
  ctx.responseBody = opts.responseBody !== undefined ? maskPayload(opts.responseBody, maxResp, true) : undefined;
  ctx.requestHeaders = opts.requestHeaders ? (DataMasker.maskSensitiveData(opts.requestHeaders) as Record<string, string>) : undefined;
  ctx.responseHeaders = opts.responseHeaders ? (DataMasker.maskSensitiveData(opts.responseHeaders) as Record<string, string>) : undefined;
}

function addDetailedAuditContext(
  ctx: Record<string, unknown>,
  opts: LogAuditOpts,
  level: string,
): void {
  if (level !== "detailed" && level !== "full") return;
  if (opts.requestSize !== undefined) ctx.requestSize = opts.requestSize;
  if (opts.responseSize !== undefined) ctx.responseSize = opts.responseSize;
}

function buildFullContext(opts: LogAuditOpts): Record<string, unknown> {
  const { method, url, statusCode, duration } = opts;
  const token = opts.getToken();
  const userId = token ? extractUserIdFromToken(token) : undefined;
  const level = opts.auditConfig?.level || "standard";
  const ctx: Record<string, unknown> = { method, url, statusCode, duration, ...(userId && { userId }) };
  if (level === "minimal") return ctx;

  addStandardAuditContext(ctx, opts);
  addDetailedAuditContext(ctx, opts, level);
  if (opts.error) ctx.error = DataMasker.maskSensitiveData({ message: opts.error.message, name: opts.error.name, stack: opts.error.stack });
  return ctx;
}

async function logAuditInternal(opts: LogAuditOpts): Promise<void> {
  const { method, url, misoClient, getToken } = opts;
  const ctx = buildFullContext(opts);
  await performAudit(misoClient, getToken(), method, url, ctx);
}

/** Parameters for logDataClientAudit */
export interface LogDataClientAuditParams {
  method: string;
  url: string;
  statusCode: number;
  duration: number;
  misoClient: MisoClient | null;
  auditConfig: AuditConfig | undefined;
  hasAnyToken: HasAnyTokenFn;
  getToken: GetTokenFn;
  requestSize?: number;
  responseSize?: number;
  error?: Error;
  requestHeaders?: Record<string, string>;
  responseHeaders?: Record<string, string>;
  requestBody?: unknown;
  responseBody?: unknown;
}

/**
 * Log audit event (ISO 27001 compliance)
 * Skips audit logging if no authentication token is available (user token OR client token)
 */
export async function logDataClientAudit(params: LogDataClientAuditParams): Promise<void> {
  const { url, auditConfig, misoClient, hasAnyToken } = params;
  if (shouldSkipAudit(url, auditConfig) || !misoClient || !hasAnyToken()) return;

  try {
    await logAuditInternal({
      method: params.method,
      url,
      statusCode: params.statusCode,
      duration: params.duration,
      misoClient,
      auditConfig,
      getToken: params.getToken,
      requestSize: params.requestSize,
      responseSize: params.responseSize,
      error: params.error,
      requestHeaders: params.requestHeaders,
      responseHeaders: params.responseHeaders,
      requestBody: params.requestBody,
      responseBody: params.responseBody,
    });
  } catch (auditError) {
    const err = auditError as Error & { statusCode?: number; response?: { status?: number }; code?: string };
    if (isExpectedAuditError(err)) return;
    writeWarn(`Failed to log audit event: ${String(auditError)}`);
  }
}
