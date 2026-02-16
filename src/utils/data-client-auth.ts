/**
 * DataClient authentication utilities
 * Handles authentication, token management, and login/logout flows
 */

import { MisoClient } from "../index";
import { DataClientConfig, MisoClientConfig } from "../types/data-client.types";
import { isBrowser, getLocalStorage, setLocalStorage, removeLocalStorage } from "./data-client-utils";
import { extractClientTokenInfo, ClientTokenInfo } from "./token-utils";
import jwt from "jsonwebtoken";
import { shouldSkipAudit } from "./data-client-audit";
import { extractErrorInfo } from "./error-extractor";
import { logErrorWithContext, writeErr, writeWarn } from "./console-logger";
import { LoggerContextStorage } from "../services/logger/logger-context-storage";

// Re-export OAuth callback from dedicated module
export { handleOAuthCallback } from "./data-client-oauth";

/**
 * Get authentication token from localStorage
 */
export function getToken(tokenKeys?: string[]): string | null {
  if (!isBrowser()) return null;
  const keys = tokenKeys || ["token", "accessToken", "authToken"];
  for (const key of keys) {
    const token = getLocalStorage(key);
    if (token) return token;
  }
  return null;
}

/**
 * Check if client token is available (from localStorage cache or config)
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

  // Browser-side: check localStorage cache
  const cachedToken = getLocalStorage("miso:client-token");
  if (cachedToken) {
    const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (expiresAt > Date.now()) return true; // Valid cached token
    }
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
  return getToken(tokenKeys) !== null || hasClientToken(misoClient || null, misoConfig);
}

/**
 * Build controller URL from configuration
 */
export function getControllerUrl(misoConfig: MisoClientConfig | undefined): string | null {
  if (!misoConfig) return null;
  return misoConfig.controllerPublicUrl || misoConfig.controllerUrl || null;
}

function debugClientToken(isDebug: boolean, message: string): void {
  if (isDebug) writeWarn(message);
}

function clearCachedClientToken(): void {
  removeLocalStorage("miso:client-token");
  removeLocalStorage("miso:client-token-expires-at");
}

function getValidCachedClientToken(
  cachedToken: string | null,
  expiresAtStr: string | null,
  isDebug: boolean,
): string | null {
  if (!cachedToken) return null;
  if (!isCachedTokenValid(cachedToken, expiresAtStr)) {
    debugClientToken(isDebug, "[getClientToken] Token expired, removing from cache");
    clearCachedClientToken();
    return null;
  }
  debugClientToken(isDebug, "[getClientToken] Returning valid cached token");
  return cachedToken;
}

async function fetchClientTokenFromEnvironment(
  isDebug: boolean,
  getEnvironmentTokenFn: () => Promise<string>,
): Promise<string | null> {
  try {
    debugClientToken(isDebug, "[getClientToken] Fetching new token via getEnvironmentToken()");
    const newToken = await getEnvironmentTokenFn();
    debugClientToken(isDebug, `[getClientToken] Got new token, length: ${newToken?.length}`);
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
 * Decode JWT token to check expiration
 */
function decodeTokenExpiration(token: string): number | null {
  try {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    return decoded?.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Check if cached token is valid (not expired)
 */
function isCachedTokenValid(cachedToken: string | null, expiresAtStr: string | null): boolean {
  if (!cachedToken) return false;

  const now = Date.now();

  // Check explicit expiration timestamp
  if (expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10);
    if (!isNaN(expiresAt) && expiresAt <= now) {
      return false; // Expired
    }
    return true;
  }

  // Check JWT expiration
  const jwtExpiresAt = decodeTokenExpiration(cachedToken);
  if (jwtExpiresAt && jwtExpiresAt <= now) {
    return false; // Expired
  }

  return true; // Valid or can't determine expiration
}

/**
 * Get client token for requests
 * Checks localStorage cache first, then config, then calls getEnvironmentToken() if needed
 */
export async function getClientToken(
  misoConfig: MisoClientConfig | undefined,
  _baseUrl: string,
  _getEnvironmentToken: () => Promise<string>,
): Promise<string | null> {
  if (!isBrowser()) return null;

  const isDebug = misoConfig?.logLevel === "debug";
  const cachedToken = getLocalStorage("miso:client-token");
  const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
  debugClientToken(
    isDebug,
    `[getClientToken] Cache check: ${JSON.stringify({ hasToken: !!cachedToken, hasExpiresAt: !!expiresAtStr })}`,
  );

  const validCachedToken = getValidCachedClientToken(cachedToken, expiresAtStr, isDebug);
  if (validCachedToken) return validCachedToken;

  // Check config for static token
  if (misoConfig?.clientToken) {
    debugClientToken(isDebug, "[getClientToken] Returning token from config");
    return misoConfig.clientToken;
  }

  return fetchClientTokenFromEnvironment(isDebug, _getEnvironmentToken);
}

// Re-export redirect functions for backward compatibility
export { redirectToLogin, logout } from "./data-client-redirect";

const CACHE_KEY = "miso:client-token";
const EXPIRES_AT_KEY = "miso:client-token-expires-at";

function getCachedEnvToken(): string | null {
  const cachedToken = getLocalStorage(CACHE_KEY);
  const expiresAtStr = getLocalStorage(EXPIRES_AT_KEY);
  if (!cachedToken || !expiresAtStr) return null;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (expiresAt <= Date.now()) {
    removeLocalStorage(CACHE_KEY);
    removeLocalStorage(EXPIRES_AT_KEY);
    return null;
  }
  return cachedToken;
}

function parseTokenResponse(
  data: Record<string, unknown>,
): { token: string; expiresIn: number } {
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
        await misoClient.log.audit("client.token.request.failed", clientTokenUri, {
          method: "POST",
          url: clientTokenUri,
          statusCode: errorInfo.statusCode || 0,
          error: errorInfo.message,
          cached: false,
          errorType: errorInfo.errorType,
          errorName: errorInfo.errorName,
        }, {
          errorCategory: "authentication",
          httpStatusCategory:
            errorInfo.statusCode && errorInfo.statusCode >= 500 ? "server-error" : "client-error",
        });
      },
    );
  } catch {
    // Silently fail audit logging
  }
}

function buildClientTokenFetchUrl(
  config: DataClientConfig,
): { clientTokenUri: string; fullUrl: string } {
  const clientTokenUri = config.misoConfig?.clientTokenUri || "/api/v1/auth/client-token";
  const fullUrl = /^https?:\/\//i.test(clientTokenUri)
    ? clientTokenUri
    : `${config.baseUrl}${clientTokenUri}`;
  return { clientTokenUri, fullUrl };
}

function storeEnvironmentToken(
  token: string,
  expiresIn: number,
): void {
  const expiresAt = Date.now() + expiresIn * 1000;
  setLocalStorage(CACHE_KEY, token);
  setLocalStorage(EXPIRES_AT_KEY, expiresAt.toString());
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
 * Checks localStorage cache first, then calls backend endpoint if needed
 */
export async function getEnvironmentToken(
  config: DataClientConfig,
  misoClient: MisoClient | null,
): Promise<string> {
  if (!isBrowser()) {
    throw new Error("getEnvironmentToken() is only available in browser environment");
  }

  const cached = getCachedEnvToken();
  if (cached) return cached;

  const { clientTokenUri, fullUrl } = buildClientTokenFetchUrl(config);

  try {
    const { response, data } = await requestEnvironmentToken(fullUrl);
    const { token, expiresIn } = parseTokenResponse(data);
    storeEnvironmentToken(token, expiresIn);

    if (misoClient) {
      await auditTokenSuccess(misoClient, clientTokenUri, response.status, config);
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
export function getClientTokenInfo(misoConfig: MisoClientConfig | undefined): ClientTokenInfo | null {
  if (!isBrowser()) return null;

  const cachedToken = getLocalStorage("miso:client-token");
  if (cachedToken) return extractClientTokenInfo(cachedToken);

  const configToken = misoConfig?.clientToken;
  if (configToken) return extractClientTokenInfo(configToken);

  return null;
}
