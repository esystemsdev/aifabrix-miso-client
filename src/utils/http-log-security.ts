/** Security-route policy for HTTP diagnostic records. */

const SECURITY_PATH = /(?:^|\/)api\/security(?:\/|$)/i;
const SECURITY_ERROR_MESSAGE = "Security request failed";
const TEST_SIGNAL_SENSITIVE_KEYS = new Set([
  "password",
  "pass",
  "secret",
  "token",
  "accessToken",
  "refreshToken",
  "email",
]);

/** Return true only when the actual request pathname targets the security API. */
export function isSecurityHttpTarget(target: string, baseURL = ""): boolean {
  try {
    const absolute = /^https?:\/\//i.test(target)
      ? target
      : `${baseURL.replace(/\/+$/, "")}/${target.replace(/^\/+/, "")}`;
    return SECURITY_PATH.test(new URL(absolute, "http://miso.local").pathname);
  } catch {
    return SECURITY_PATH.test(target.split(/[?#]/, 1)[0]);
  }
}

/** Remove security request/response bodies before masking or formatting. */
export function securitySafeBodies(
  target: string,
  baseURL: string,
  requestBody: unknown,
  responseBody: unknown,
): { requestBody: unknown; responseBody: unknown } {
  return isSecurityHttpTarget(target, baseURL)
    ? { requestBody: undefined, responseBody: undefined }
    : { requestBody, responseBody };
}

/** Avoid response-only secrets echoed into security-route error messages. */
export function securitySafeErrorMessage(
  target: string,
  baseURL: string,
  message: string | undefined,
): string | undefined {
  return message && isSecurityHttpTarget(target, baseURL)
    ? SECURITY_ERROR_MESSAGE
    : message;
}

/** Preserve the test signal path's legacy field masking without mutating input. */
export function maskKnownDiagnosticFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(maskKnownDiagnosticFields);
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [key, fieldValue] of Object.entries(
    value as Record<string, unknown>,
  )) {
    result[key] = TEST_SIGNAL_SENSITIVE_KEYS.has(key)
      ? "***MASKED***"
      : maskKnownDiagnosticFields(fieldValue);
  }
  return result;
}
