/**
 * Browser auth error classification helpers (401, inactive token messages).
 */

/**
 * Returns true when an API/SDK error represents HTTP 401 Unauthorized.
 */
export function isUnauthorizedApiError(error: unknown): boolean {
  if (error === null || error === undefined) {
    return false;
  }

  const candidate = error as Error & {
    status?: number;
    statusCode?: number;
    response?: {
      status?: number;
      statusCode?: number;
      data?: {
        status?: number;
        statusCode?: number;
      };
    };
  };

  if (candidate.status === 401) {
    return true;
  }
  if (candidate.statusCode === 401) {
    return true;
  }
  if (candidate.response?.status === 401) {
    return true;
  }
  if (candidate.response?.statusCode === 401) {
    return true;
  }
  if (candidate.response?.data?.status === 401) {
    return true;
  }
  if (candidate.response?.data?.statusCode === 401) {
    return true;
  }

  const message = candidate.message ?? "";
  return /401|Unauthorized/i.test(message);
}

/**
 * Keycloak-style inactive access token message (often surfaced as 400).
 */
export function isInactiveTokenMessage(
  message: string | null | undefined,
): boolean {
  return typeof message === "string" && /token is not active/i.test(message);
}

/**
 * Session restore failure that should trigger stale-state cleanup before retry.
 */
export function isStaleBrowserSessionFailure(result: {
  ok: boolean;
  reason?: string;
}): boolean {
  return (
    !result.ok &&
    (result.reason === "invalid" || result.reason === "unauthorized")
  );
}
