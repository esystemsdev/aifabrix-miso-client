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
import { logErrorWithContext } from "./console-logger";

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

  if (isDebug) {
    console.log("[getClientToken] Cache check:", { hasToken: !!cachedToken, hasExpiresAt: !!expiresAtStr });
  }

  if (cachedToken) {
    if (isCachedTokenValid(cachedToken, expiresAtStr)) {
      if (isDebug) console.log("[getClientToken] Returning valid cached token");
      return cachedToken;
    }
    // Token expired - clean up
    if (isDebug) console.log("[getClientToken] Token expired, removing from cache");
    removeLocalStorage("miso:client-token");
    removeLocalStorage("miso:client-token-expires-at");
  }

  // Check config for static token
  if (misoConfig?.clientToken) {
    if (isDebug) console.log("[getClientToken] Returning token from config");
    return misoConfig.clientToken;
  }

  // Fetch new token
  try {
    if (isDebug) console.log("[getClientToken] Fetching new token via getEnvironmentToken()");
    const newToken = await _getEnvironmentToken();
    if (isDebug) console.log("[getClientToken] Got new token, length:", newToken?.length);
    return newToken;
  } catch (error) {
    console.error("[getClientToken] Failed to get environment token:", error);
    return null;
  }
}

// Re-export redirect functions for backward compatibility
export { redirectToLogin, logout } from "./data-client-redirect";

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

  const cacheKey = "miso:client-token";
  const expiresAtKey = "miso:client-token-expires-at";

  // Check cache first
  const cachedToken = getLocalStorage(cacheKey);
  const expiresAtStr = getLocalStorage(expiresAtKey);

  if (cachedToken && expiresAtStr) {
    const expiresAt = parseInt(expiresAtStr, 10);
    if (expiresAt > Date.now()) return cachedToken;
    removeLocalStorage(cacheKey);
    removeLocalStorage(expiresAtKey);
  }

  // Fetch from backend
  const clientTokenUri = config.misoConfig?.clientTokenUri || "/api/v1/auth/client-token";
  const fullUrl = /^https?:\/\//i.test(clientTokenUri) ? clientTokenUri : `${config.baseUrl}${clientTokenUri}`;

  try {
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get environment token: ${response.status} ${response.statusText}. ${errorText}`);
    }

    const data = (await response.json()) as {
      data?: { token?: string; expiresIn?: number };
      token?: string;
      accessToken?: string;
      access_token?: string;
      expiresIn?: number;
      expires_in?: number;
    };

    const token = data.data?.token || data.token || data.accessToken || data.access_token;
    if (!token || typeof token !== "string") {
      throw new Error("Invalid response format: token not found in response");
    }

    const expiresIn = data.data?.expiresIn || data.expiresIn || data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    setLocalStorage(cacheKey, token);
    setLocalStorage(expiresAtKey, expiresAt.toString());

    // Audit logging
    if (misoClient && !shouldSkipAudit(clientTokenUri, config.audit)) {
      try {
        await misoClient.log.audit("client.token.request.success", clientTokenUri, {
          method: "POST", url: clientTokenUri, statusCode: response.status, cached: false,
        }, {});
      } catch {
        // Silently fail audit logging
      }
    }

    return token;
  } catch (error) {
    const errorInfo = extractErrorInfo(error, {
      endpoint: clientTokenUri,
      method: "POST",
      correlationId: misoClient?.log?.generateCorrelationId?.(),
    });

    logErrorWithContext(errorInfo, "[DataClient] [AUTH] [ClientToken]");

    if (misoClient && !shouldSkipAudit(clientTokenUri, config.audit)) {
      try {
        await misoClient.log.audit("client.token.request.failed", clientTokenUri, {
          method: "POST", url: clientTokenUri, statusCode: errorInfo.statusCode || 0,
          error: error instanceof Error ? error.message : "Unknown error",
          cached: false, errorType: errorInfo.errorType, errorName: errorInfo.errorName,
        }, {
          errorCategory: "authentication",
          httpStatusCategory: errorInfo.statusCode && errorInfo.statusCode >= 500 ? "server-error" : "client-error",
          correlationId: errorInfo.correlationId,
        });
      } catch {
        // Silently fail audit logging
      }
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
