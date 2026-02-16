/**
 * DataClient OAuth callback handling utilities
 * Handles OAuth token extraction from URL hash fragments with ISO 27001 compliance
 */

import { DataClientConfig } from "../types/data-client.types";
import { isBrowser, setLocalStorage } from "./data-client-utils";
import { extractErrorInfo } from "./error-extractor";
import { logErrorWithContext, writeWarn, writeErr } from "./console-logger";

/**
 * Clean up hash fragment from URL (security measure)
 */
function cleanupHash(): void {
  try {
    const window = globalThis as unknown as {
      window?: {
        location?: { pathname: string; search: string; hash: string };
        history?: { replaceState: (data: unknown, title: string, url: string) => void };
      };
    };
    if (!window.window?.location || !window.window.history) {
      writeWarn("[handleOAuthCallback] window not available for hash cleanup");
      return;
    }
    const cleanUrl = window.window.location.pathname + window.window.location.search;
    window.window.history.replaceState(null, "", cleanUrl);
  } catch (e) {
    writeWarn(`[handleOAuthCallback] Failed to clean up hash: ${String(e)}`);
  }
}

/**
 * Validate token format (basic validation - non-empty string with reasonable length)
 */
function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") return false;
  const trimmed = token.trim();
  return trimmed.length >= 5;
}

/**
 * Check if hostname is localhost or local network
 */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)
  );
}

function parseHashParams(hash: string): URLSearchParams | null {
  try {
    return new URLSearchParams(hash.substring(1));
  } catch (e) {
    writeWarn(`[handleOAuthCallback] Failed to parse hash: ${String(e)}`);
    return null;
  }
}

function getTokenFromParams(params: URLSearchParams): string | null {
  return params.get("token") || params.get("access_token") || params.get("accessToken");
}

function rejectInvalidToken(token: string): void {
  writeErr(
    `[handleOAuthCallback] Invalid token format - token rejected: ${JSON.stringify({
      tokenLength: token.length,
      isEmpty: !token || token.trim().length === 0,
      tooShort: token.length > 0 && token.length < 5,
      expectedFormat: "Non-empty string with at least 5 characters",
    })}`,
  );
  cleanupHash();
}

function checkHttpsInProduction(protocol: string, hostname: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  if (protocol === "https:") return true;
  return isLocalhost(hostname);
}

function storeTokenSecurely(tokenKeys: string[], token: string): void {
  tokenKeys.forEach((key) => {
    try {
      setLocalStorage(key, token);
    } catch (e) {
      writeWarn(`[handleOAuthCallback] Failed to store token in key ${key}: ${String(e)}`);
    }
  });
}

function resolveWindowLocation(): {
  hash: string;
  protocol: string;
  hostname: string;
  pathname: string;
} | null {
  const win = globalThis as unknown as {
    window?: { location?: { hash: string; protocol: string; hostname?: string; pathname?: string } };
  };
  if (!win.window?.location) return null;
  return {
    hash: win.window.location.hash,
    protocol: win.window.location.protocol,
    hostname: win.window.location.hostname || "",
    pathname: win.window.location.pathname || "/",
  };
}

function resolveCallbackToken(hash: string): string | null {
  if (!hash || hash.length <= 1) return null;
  const hashParams = parseHashParams(hash);
  if (!hashParams) return null;
  const token = getTokenFromParams(hashParams);
  if (!token) return null;
  if (!isValidTokenFormat(token)) {
    rejectInvalidToken(token);
    return null;
  }
  return token;
}

function logStoredOAuthToken(
  isDebug: boolean,
  token: string,
  tokenKeys: string[],
): void {
  if (!isDebug) return;
  writeWarn(
    `[handleOAuthCallback] OAuth token extracted and stored securely: ${JSON.stringify({
      tokenLength: token.length,
      tokenKeys,
      storedInKeys: tokenKeys.length,
    })}`,
  );
}

/**
 * Handle OAuth callback with ISO 27001 compliant security
 * Extracts token from URL hash fragment and stores securely
 *
 * Security features:
 * - Immediate hash cleanup (< 100ms)
 * - Token format validation
 * - HTTPS enforcement check
 * - Secure error handling
 *
 * @param config - DataClient configuration
 * @returns Extracted token or null if not found/invalid
 */
export function handleOAuthCallback(config: DataClientConfig): string | null {
  if (!isBrowser()) return null;

  const location = resolveWindowLocation();
  if (!location) return null;

  const token = resolveCallbackToken(location.hash);
  if (!token) return null;

  if (!checkHttpsInProduction(location.protocol, location.hostname)) {
    writeErr("[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production");
    cleanupHash();
    return null;
  }

  cleanupHash();
  const tokenKeys = config.tokenKeys || ["token", "accessToken", "authToken"];

  try {
    storeTokenSecurely(tokenKeys, token);
    logStoredOAuthToken(config.misoConfig?.logLevel === "debug", token, tokenKeys);
    return token;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    logErrorWithContext(
      extractErrorInfo(error, { endpoint: location.pathname, method: "GET" }),
      "[DataClient] [AUTH] [OAuthCallback]",
    );
    writeErr(`[handleOAuthCallback] Failed to store token: ${String(e)}`);
    return null;
  }
}
