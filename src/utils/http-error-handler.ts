/** HTTP error conversion: sanitize once before constructing public errors. */
import { AxiosError } from "axios";
import {
  ErrorResponse,
  isErrorResponse,
  AuthMethod,
  MisoClientConfig,
} from "../types/config.types";
import { MisoClientError } from "./errors";
import {
  bindDiagnosticSanitizer,
  createDiagnosticSanitizer,
  diagnosticData,
  DiagnosticSanitizer,
} from "./diagnostic-sanitizer";

const AUTH_METHODS = [
  "bearer",
  "client-token",
  "client-credentials",
  "api-key",
];
function authMethod(value: unknown): AuthMethod | undefined {
  return typeof value === "string" && AUTH_METHODS.includes(value)
    ? (value as AuthMethod)
    : undefined;
}
function text(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
function diagnostics(data: Record<string, unknown>, correlation?: string) {
  return {
    code: text(data.code),
    detail: text(data.detail),
    authMethod: authMethod(data.authMethod),
    clientIdentity: text(data.clientIdentity) ?? record(data.clientIdentity),
    correlationId: text(data.correlationId) ?? correlation,
  };
}
function structured(
  data: Record<string, unknown>,
  status?: number,
  url?: string,
): ErrorResponse | null {
  if (
    !isErrorResponse(data) &&
    !(
      typeof data.type === "string" &&
      typeof data.title === "string" &&
      typeof data.status === "number"
    )
  )
    return null;
  return {
    errors: Array.isArray(data.errors)
      ? data.errors.filter((e): e is string => typeof e === "string")
      : [text(data.detail) ?? String(data.title)],
    type: String(data.type),
    title: String(data.title),
    statusCode: status ?? Number(data.statusCode ?? data.status),
    instance: text(data.instance) ?? url,
    ...diagnostics(data),
  };
}

/** Detect attempted authentication only when the controller omits it. */
export function detectAuthMethodFromHeaders(
  headers?: Record<string, unknown>,
): AuthMethod | null {
  if (!headers) return null;
  const bag = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );
  if (bag.authorization) return "bearer";
  if (bag["x-client-token"]) return "client-token";
  if (bag["x-client-id"]) return "client-credentials";
  return null;
}

function safeResponse(
  error: AxiosError,
  sanitize: DiagnosticSanitizer,
  requestUrl?: string,
) {
  const data = sanitize(diagnosticData(error.response?.data));
  const body =
    record(data) ?? (typeof data === "string" ? { detail: data } : undefined);
  if (body && error.response) {
    if ("status" in body) body.status = error.response.status;
    if ("statusCode" in body) body.statusCode = error.response.status;
    const header = Object.entries(error.response.headers ?? {}).find(
      ([name]) => name.toLowerCase() === "x-correlation-id",
    )?.[1];
    body.correlationId = text(body.correlationId) ?? text(sanitize(header));
  }
  return {
    body,
    response: body
      ? structured(body, error.response?.status, text(sanitize(requestUrl)))
      : null,
  };
}

/** Parse bounded RFC/legacy structured errors without exposing raw response data. */
export function parseErrorResponse(
  error: AxiosError,
  requestUrl?: string,
): ErrorResponse | null {
  return safeResponse(
    error,
    createDiagnosticSanitizer(undefined, error.config),
    requestUrl,
  ).response;
}

/** Preserve status and safe diagnostics; never retain Axios request/config/cause. */
export function createMisoClientError(
  error: AxiosError,
  requestUrl?: string,
  config?: Partial<MisoClientConfig>,
): MisoClientError {
  const sanitize = createDiagnosticSanitizer(config, error.config);
  const { body, response } = safeResponse(error, sanitize, requestUrl);
  const status = error.response?.status;
  const method =
    authMethod(body?.authMethod) ??
    (status === 401
      ? detectAuthMethodFromHeaders(
          error.config?.headers as Record<string, unknown>,
        )
      : null);
  const message =
    text(sanitize(error.response?.statusText || error.message)) ??
    "Request failed";
  const result = new MisoClientError(
    message,
    response ?? undefined,
    body,
    status,
    method,
  );
  bindDiagnosticSanitizer(result, sanitize);
  return result;
}

/** Check Axios errors from this or another copy of Axios. */
export function isAxiosError(error: unknown): error is AxiosError {
  if (error instanceof AxiosError) return true;
  return (
    typeof error === "object" &&
    error !== null &&
    "isAxiosError" in error &&
    (error as AxiosError).isAxiosError === true
  );
}
