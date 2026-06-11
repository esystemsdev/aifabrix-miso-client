/**
 * DataClient authentication utilities
 * Handles authentication, token management, and login/logout flows
 */

import { MisoClient } from "../miso-client";
import { DataClientConfig, MisoClientConfig } from "../types/data-client.types";
import { isBrowser, removeLocalStorage } from "./data-client-utils";
import { extractClientTokenInfo, ClientTokenInfo } from "./token-utils";
import { shouldSkipAudit } from "./data-client-audit";
import { extractErrorInfo } from "./error-extractor";
import { logErrorWithContext, writeErr, writeWarn } from "./console-logger";
import { LoggerContextStorage } from "../services/logger/logger-context-storage";
import { joinApiRoot, mergeRootUrlWithBasePath } from "./url-join";
import { coerceControllerUrlToAbsolute } from "./controller-url-resolver";

// Re-export OAuth callback from dedicated module
export { handleOAuthCallback } from "./data-client-oauth";

const CANONICAL_ACCESS_TOKEN_KEY = "miso_token";
const CANONICAL_REFRESH_TOKEN_KEY = "miso:user-refresh-token";
const CANONICAL_EXPIRES_AT_KEY = "miso_token_expires_at";
const UNSUPPORTED_LEGACY_KEYS = new Set(["token", "accessToken", "authToken"]);
const DEFAULT_CLIENT_TOKEN_TTL_SECONDS = 3600;

type RuntimeClientTokenState = {
  token: string;
  expiresAtMs: number;
};

let runtimeClientTokenState: RuntimeClientTokenState | null = null;

type RuntimeUserTokenState = {
  token: string;
  expiresAt?: string;
};

let runtimeUserTokenState: RuntimeUserTokenState | null = null;

function resolveTokenKeys(tokenKeys?: string[]): string[] {
  if (!tokenKeys || tokenKeys.length === 0) {
    return [CANONICAL_ACCESS_TOKEN_KEY];
  }
  const filtered = tokenKeys.filter(
    (key) => key && !UNSUPPORTED_LEGACY_KEYS.has(key),
  );
  return filtered.length > 0 ? filtered : [CANONICAL_ACCESS_TOKEN_KEY];
}

/**
 * Get browser user token from runtime memory state.
 */
export function getToken(_tokenKeys?: string[]): string | null {
  if (!isBrowser()) return null;
  return runtimeUserTokenState?.token || null;
}

export function storeBrowserSessionTokens(params: {
  tokenKeys?: string[];
  accessToken: string;
  expiresAt?: string;
}): void {
  if (!isBrowser()) return;
  runtimeUserTokenState = {
    token: params.accessToken,
    expiresAt: params.expiresAt,
  };
}

export function clearCachedBrowserAuthState(tokenKeys?: string[]): void {
  if (!isBrowser()) return;
  runtimeUserTokenState = null;
  removeLocalStorage(CANONICAL_ACCESS_TOKEN_KEY);
  removeLocalStorage(CANONICAL_REFRESH_TOKEN_KEY);
  removeLocalStorage(CANONICAL_EXPIRES_AT_KEY);
  clearRuntimeClientToken();

  const keys = resolveTokenKeys(tokenKeys);
  for (const key of keys) {
    removeLocalStorage(key);
  }
}

function getRuntimeClientToken(): string | null {
  if (!runtimeClientTokenState) {
    return null;
  }

  if (runtimeClientTokenState.expiresAtMs <= Date.now()) {
    runtimeClientTokenState = null;
    return null;
  }

  return runtimeClientTokenState.token;
}

function setRuntimeClientToken(token: string, expiresInSeconds?: number): void {
  const ttlSeconds =
    typeof expiresInSeconds === "number" && Number.isFinite(expiresInSeconds)
      ? Math.max(0, expiresInSeconds)
      : DEFAULT_CLIENT_TOKEN_TTL_SECONDS;

  runtimeClientTokenState = {
    token,
    expiresAtMs: Date.now() + ttlSeconds * 1000,
  };
}

function clearRuntimeClientToken(): void {
  runtimeClientTokenState = null;
}

/**
 * Check if client token is available (runtime/config only).
 */
export function hasClientToken(
  misoClient: MisoClient | null,
  misoConfig: MisoClientConfig | undefined,
): boolean {
  if (!isBrowser()) {
    // Server-side: check if misoClient config has clientSecret
    if (misoClient && misoConfig?.clientSecret) return true;
    return false;
  }

  if (getRuntimeClientToken()) {
    return true;
  }

  // Check config token
  if (misoConfig?.clientToken) return true;

  // Check if misoClient config has onClientTokenRefresh callback (browser pattern)
  if (misoConfig?.onClientTokenRefresh) return true;

  // Check if misoClient config has clientSecret (server-side fallback)
  if (misoConfig?.clientSecret) return true;

  return false;
}

/**
 * Check if any authentication token is available (user token OR client token)
 */
export function hasAnyToken(
  tokenKeys?: string[],
  misoClient?: MisoClient | null,
  misoConfig?: MisoClientConfig,
): boolean {
  return (
    getToken(tokenKeys) !== null ||
    hasClientToken(misoClient || null, misoConfig)
  );
}

/**
 * Build controller URL from configuration
 */
export function getControllerUrl(
  misoConfig: MisoClientConfig | undefined,
): string | null {
  if (!misoConfig) return null;
  const raw =
    misoConfig.controllerPublicUrl || misoConfig.controllerUrl || null;
  if (!raw) return null;
  const absolute = coerceControllerUrlToAbsolute(raw, isBrowser());
  return mergeRootUrlWithBasePath(absolute, misoConfig.controllerBasePath);
}

function debugClientToken(isDebug: boolean, message: string): void {
  if (isDebug) writeWarn(message);
}

async function fetchClientTokenFromEnvironment(
  isDebug: boolean,
  getEnvironmentTokenFn: () => Promise<string>,
): Promise<string | null> {
  try {
    debugClientToken(
      isDebug,
      "[getClientToken] Fetching new token via getEnvironmentToken()",
    );
    const newToken = await getEnvironmentTokenFn();
    debugClientToken(
      isDebug,
      `[getClientToken] Got new token, length: ${newToken?.length}`,
    );
    return newToken;
  } catch (error) {
    writeErr(
      `[getClientToken] Failed to get environment token: ${JSON.stringify({
        method: "POST",
        path: "/api/v1/auth/token",
        errorMessage: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
      })}`,
    );
    return null;
  }
}

/**
 * Get client token for requests
 * Checks runtime cache first, then config, then calls getEnvironmentToken() if needed
 */
export async function getClientToken(
  misoConfig: MisoClientConfig | undefined,
  _baseUrl: string,
  _getEnvironmentToken: () => Promise<string>,
): Promise<string | null> {
  if (!isBrowser()) return null;

  const isDebug = misoConfig?.logLevel === "debug";
  const cachedToken = getRuntimeClientToken();
  debugClientToken(
    isDebug,
    `[getClientToken] Runtime cache check: ${JSON.stringify({ hasToken: !!cachedToken })}`,
  );

  if (cachedToken) {
    debugClientToken(
      isDebug,
      "[getClientToken] Returning runtime cached token",
    );
    return cachedToken;
  }

  // Check config for static token
  if (misoConfig?.clientToken) {
    debugClientToken(isDebug, "[getClientToken] Returning token from config");
    return misoConfig.clientToken;
  }

  const environmentToken = await fetchClientTokenFromEnvironment(
    isDebug,
    _getEnvironmentToken,
  );
  if (environmentToken) {
    setRuntimeClientToken(environmentToken);
  }
  return environmentToken;
}

// Re-export redirect functions for backward compatibility
export { redirectToLogin, logout } from "./data-client-redirect";

function getCachedEnvToken(): string | null {
  return getRuntimeClientToken();
}

function parseTokenResponse(data: Record<string, unknown>): {
  token: string;
  expiresIn: number;
} {
  const token =
    (data.data as { token?: string })?.token ||
    data.token ||
    data.accessToken ||
    data.access_token;
  if (!token || typeof token !== "string") {
    throw new Error("Invalid response format: token not found in response");
  }
  const dataExp = (data.data as { expiresIn?: number })?.expiresIn;
  const expiresIn = dataExp ?? data.expiresIn ?? data.expires_in ?? 3600;
  return { token, expiresIn: Number(expiresIn) };
}

async function auditTokenSuccess(
  misoClient: MisoClient,
  clientTokenUri: string,
  statusCode: number,
  config: DataClientConfig,
): Promise<void> {
  if (shouldSkipAudit(clientTokenUri, config.audit)) return;
  try {
    await misoClient.log.audit(
      "client.token.request.success",
      clientTokenUri,
      { method: "POST", url: clientTokenUri, statusCode, cached: false },
      {},
    );
  } catch {
    // Silently fail audit logging
  }
}

async function auditTokenFailure(
  misoClient: MisoClient,
  config: DataClientConfig,
  errorInfo: ReturnType<typeof extractErrorInfo>,
  clientTokenUri: string,
): Promise<void> {
  if (shouldSkipAudit(clientTokenUri, config.audit)) return;
  try {
    const contextStorage = LoggerContextStorage.getInstance();
    await contextStorage.runWithContextAsync(
      { correlationId: errorInfo.correlationId },
      async () => {
        await misoClient.log.audit(
          "client.token.request.failed",
          clientTokenUri,
          {
            method: "POST",
            url: clientTokenUri,
            statusCode: errorInfo.statusCode || 0,
            error: errorInfo.message,
            cached: false,
            errorType: errorInfo.errorType,
            errorName: errorInfo.errorName,
          },
          {
            errorCategory: "authentication",
            httpStatusCategory:
              errorInfo.statusCode && errorInfo.statusCode >= 500
                ? "server-error"
                : "client-error",
          },
        );
      },
    );
  } catch {
    // Silently fail audit logging
  }
}

function buildClientTokenFetchUrl(config: DataClientConfig): {
  clientTokenUri: string;
  fullUrl: string;
} {
  const clientTokenUri =
    config.misoConfig?.clientTokenUri || "/api/v1/auth/client-token";
  const fullUrl = /^https?:\/\//i.test(clientTokenUri)
    ? clientTokenUri
    : joinApiRoot(config.baseUrl, clientTokenUri);
  return { clientTokenUri, fullUrl };
}

function storeEnvironmentToken(token: string, expiresIn: number): void {
  setRuntimeClientToken(token, expiresIn);
}

async function requestEnvironmentToken(
  fullUrl: string,
): Promise<{ response: Response; data: Record<string, unknown> }> {
  const response = await fetch(fullUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get environment token: ${response.status} ${response.statusText}. ${errorText}`,
    );
  }
  const data = (await response.json()) as Record<string, unknown>;
  return { response, data };
}

/**
 * Get environment token (browser-side)
 * Checks runtime cache first, then calls backend endpoint if needed.
 */
export async function getEnvironmentToken(
  config: DataClientConfig,
  misoClient: MisoClient | null,
): Promise<string> {
  if (!isBrowser()) {
    throw new Error(
      "getEnvironmentToken() is only available in browser environment",
    );
  }

  const cached = getCachedEnvToken();
  if (cached) return cached;

  const { clientTokenUri, fullUrl } = buildClientTokenFetchUrl(config);

  try {
    const { response, data } = await requestEnvironmentToken(fullUrl);
    const { token, expiresIn } = parseTokenResponse(data);
    storeEnvironmentToken(token, expiresIn);

    if (misoClient) {
      await auditTokenSuccess(
        misoClient,
        clientTokenUri,
        response.status,
        config,
      );
    }
    return token;
  } catch (error) {
    const errorInfo = extractErrorInfo(error, {
      endpoint: clientTokenUri,
      method: "POST",
      correlationId: misoClient?.log?.generateCorrelationId?.(),
    });
    logErrorWithContext(errorInfo, "[DataClient] [AUTH] [ClientToken]");
    if (misoClient) {
      await auditTokenFailure(misoClient, config, errorInfo, clientTokenUri);
    }
    throw error;
  }
}

/**
 * Get client token information (browser-side)
 */
export function getClientTokenInfo(
  misoConfig: MisoClientConfig | undefined,
): ClientTokenInfo | null {
  if (!isBrowser()) return null;

  const cachedToken = getRuntimeClientToken();
  if (cachedToken) return extractClientTokenInfo(cachedToken);

  const configToken = misoConfig?.clientToken;
  if (configToken) return extractClientTokenInfo(configToken);

  return null;
}
