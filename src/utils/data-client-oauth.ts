/**
 * DataClient OAuth callback handling utilities
 * Handles OAuth token extraction from URL hash fragments with ISO 27001 compliance
 */

import { DataClientConfig } from "../types/data-client.types";
import { isBrowser, setLocalStorage } from "./data-client-utils";
import { extractErrorInfo } from "./error-extractor";
import { logErrorWithContext } from "./console-logger";

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
      console.warn("[handleOAuthCallback] window not available for hash cleanup");
      return;
    }
    const cleanUrl = window.window.location.pathname + window.window.location.search;
    window.window.history.replaceState(null, "", cleanUrl);
  } catch (e) {
    console.warn("[handleOAuthCallback] Failed to clean up hash:", e);
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

  const window = globalThis as unknown as {
    window?: { location?: { hash: string; protocol: string; hostname?: string; pathname?: string; search?: string } };
  };
  if (!window.window?.location) return null;

  const hash = window.window.location.hash;
  if (!hash || hash.length <= 1) return null;

  // Parse hash synchronously
  const hashString = hash.substring(1);
  let hashParams: URLSearchParams;
  try {
    hashParams = new URLSearchParams(hashString);
  } catch (e) {
    console.warn("[handleOAuthCallback] Failed to parse hash:", e);
    return null;
  }

  // Extract token from various possible parameter names
  const token = hashParams.get("token") || hashParams.get("access_token") || hashParams.get("accessToken");
  if (!token) return null;

  // Validate token format
  if (!isValidTokenFormat(token)) {
    const tokenLength = token ? token.length : 0;
    console.error("[handleOAuthCallback] Invalid token format - token rejected", {
      tokenLength,
      isEmpty: !token || token.trim().length === 0,
      tooShort: tokenLength > 0 && tokenLength < 5,
      expectedFormat: "Non-empty string with at least 5 characters",
    });
    cleanupHash();
    return null;
  }

  // HTTPS enforcement in production (except localhost)
  if (config.misoConfig?.logLevel === "debug" || process.env.NODE_ENV === "production") {
    const isHttps = window.window.location.protocol === "https:";
    const hostname = window.window.location.hostname || "";

    if (!isHttps && process.env.NODE_ENV === "production" && !isLocalhost(hostname)) {
      console.error("[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production");
      cleanupHash();
      return null;
    }
  }

  // Clean up hash immediately
  cleanupHash();

  // Store token in localStorage
  const tokenKeys = config.tokenKeys || ["token", "accessToken", "authToken"];
  try {
    tokenKeys.forEach((key) => {
      try {
        setLocalStorage(key, token);
      } catch (e) {
        console.warn(`[handleOAuthCallback] Failed to store token in key ${key}:`, e);
      }
    });

    // Debug logging
    if (config.misoConfig?.logLevel === "debug") {
      console.log("[handleOAuthCallback] OAuth token extracted and stored securely", {
        tokenLength: token.length,
        tokenKeys: tokenKeys,
        storedInKeys: tokenKeys.length,
      });
    }

    return token;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    const pathname = window.window.location.pathname || "/";
    const errorInfo = extractErrorInfo(error, { endpoint: pathname, method: "GET" });
    logErrorWithContext(errorInfo, "[DataClient] [AUTH] [OAuthCallback]");
    console.error("[handleOAuthCallback] Failed to store token:", e);
    return null;
  }
}
