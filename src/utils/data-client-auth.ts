/**
 * DataClient authentication utilities
 * Handles authentication, token management, and login/logout flows
 */

import { MisoClient } from "../index";
import { DataClientConfig, MisoClientConfig } from "../types/data-client.types";
import {
  isBrowser,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
} from "./data-client-utils";
import { extractClientTokenInfo, ClientTokenInfo } from "./token-utils";
import jwt from "jsonwebtoken";
import { shouldSkipAudit } from "./data-client-audit";

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
 * Clean up hash fragment from URL (security measure)
 */
function cleanupHash(): void {
  try {
    const win = globalThis as unknown as {
      window?: {
        location: { pathname: string; search: string; hash: string };
        history: { replaceState: (data: unknown, title: string, url: string) => void };
      };
    };
    if (!win.window) {
      console.warn("[handleOAuthCallback] window not available for hash cleanup");
      return;
    }
    const cleanUrl = win.window.location.pathname + win.window.location.search;
    // Use replaceState to remove hash without adding to history
    win.window.history.replaceState(null, "", cleanUrl);
  } catch (e) {
    console.warn("[handleOAuthCallback] Failed to clean up hash:", e);
  }
}

/**
 * Validate token format (basic JWT format check)
 * @param token - Token string to validate
 * @returns True if token appears to be valid JWT format
 */
function isValidTokenFormat(token: string): boolean {
  if (!token || typeof token !== "string") {
    return false;
  }

  // Basic JWT format check (3 parts separated by dots)
  const parts = token.split(".");
  if (parts.length !== 3) {
    return false;
  }

  // Each part should be non-empty
  return parts.every((part) => part.length > 0);
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

  // CRITICAL: Extract hash IMMEDIATELY (synchronous)
  // Don't wait for async operations - token must be removed from URL ASAP
  const window = globalThis as unknown as {
    window?: { location?: { hash: string; protocol: string; hostname?: string } };
  };
  if (!window.window || !window.window.location) return null;

  const hash = window.window.location.hash;

  if (!hash || hash.length <= 1) {
    return null; // No hash or empty hash
  }

  // Parse hash synchronously (remove '#' prefix)
  const hashString = hash.substring(1);
  let hashParams: URLSearchParams;
  try {
    hashParams = new URLSearchParams(hashString);
  } catch (e) {
    console.warn("[handleOAuthCallback] Failed to parse hash:", e);
    return null;
  }

  // Extract token from various possible parameter names
  const token =
    hashParams.get("token") ||
    hashParams.get("access_token") ||
    hashParams.get("accessToken");

  if (!token) {
    return null; // No token in hash
  }

  // SECURITY: Validate token format (basic JWT check)
  if (!isValidTokenFormat(token)) {
    const tokenLength = token.length;
    const hasDots = token.includes(".");
    const parts = token.split(".");
    console.error(
      "[handleOAuthCallback] Invalid token format - token rejected",
      {
        tokenLength,
        hasDots,
        partsCount: parts.length,
        expectedFormat: "JWT (3 parts separated by dots)",
      },
    );
    // Still clean up hash even if token is invalid
    cleanupHash();
    return null;
  }

  // SECURITY: HTTPS enforcement (warn in production, but allow localhost)
  if (
    config.misoConfig?.logLevel === "debug" ||
    process.env.NODE_ENV === "production"
  ) {
    const isHttps = window.window.location.protocol === "https:";
    const hostname = window.window.location.hostname || "";
    
    // Check if running on localhost or local IP addresses
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("172.16.") ||
      hostname.startsWith("172.17.") ||
      hostname.startsWith("172.18.") ||
      hostname.startsWith("172.19.") ||
      hostname.startsWith("172.20.") ||
      hostname.startsWith("172.21.") ||
      hostname.startsWith("172.22.") ||
      hostname.startsWith("172.23.") ||
      hostname.startsWith("172.24.") ||
      hostname.startsWith("172.25.") ||
      hostname.startsWith("172.26.") ||
      hostname.startsWith("172.27.") ||
      hostname.startsWith("172.28.") ||
      hostname.startsWith("172.29.") ||
      hostname.startsWith("172.30.") ||
      hostname.startsWith("172.31.");
    
    // Only enforce HTTPS for production AND non-localhost URLs
    if (!isHttps && process.env.NODE_ENV === "production" && !isLocalhost) {
      console.error(
        "[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production",
      );
      cleanupHash();
      return null; // Reject tokens over HTTP in production (except localhost)
    }
  }

  // SECURITY: Remove hash IMMEDIATELY (before any async operations)
  // Use replaceState to avoid adding to history
  cleanupHash();

  // Store token in localStorage
  const tokenKeys = config.tokenKeys || ["token", "accessToken", "authToken"];
  try {
    const storage = globalThis as unknown as {
      localStorage?: { setItem: (key: string, value: string) => void };
    };
    if (!storage.localStorage) {
      console.warn("[handleOAuthCallback] localStorage not available");
      return null;
    }

    // Store in all tokenKeys for compatibility
    tokenKeys.forEach((key) => {
      try {
        storage.localStorage!.setItem(key, token);
      } catch (e) {
        console.warn(
          `[handleOAuthCallback] Failed to store token in key ${key}:`,
          e,
        );
      }
    });

    // Log security event (audit trail) - only in debug mode to avoid exposing token
    if (config.misoConfig?.logLevel === "debug") {
      console.log(
        "[handleOAuthCallback] OAuth token extracted and stored securely",
        {
          tokenLength: token.length,
          tokenKeys: tokenKeys,
          storedInKeys: tokenKeys.length,
        },
      );
    }

    return token;
  } catch (e) {
    console.error("[handleOAuthCallback] Failed to store token:", e);
    return null;
  }
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
    if (misoClient && misoConfig?.clientSecret) {
      return true;
    }
    return false;
  }
  
  // Browser-side: check localStorage cache
  const cachedToken = getLocalStorage("miso:client-token");
  if (cachedToken) {
    const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      if (expiresAt > Date.now()) {
        return true; // Valid cached token
      }
    }
  }
  
  // Check config token
  if (misoConfig?.clientToken) {
    return true;
  }
  
  // Check if misoClient config has onClientTokenRefresh callback (browser pattern)
  if (misoConfig?.onClientTokenRefresh) {
    return true; // Has means to get client token
  }
  
  // Check if misoClient config has clientSecret (server-side fallback)
  if (misoConfig?.clientSecret) {
    return true;
  }
  
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
 * Get client token for requests
 * Checks localStorage cache first, then config, then calls getEnvironmentToken() if needed
 * @returns Client token string or null if unavailable
 */
export async function getClientToken(
  misoConfig: MisoClientConfig | undefined,
  _baseUrl: string,
  _getEnvironmentToken: () => Promise<string>,
): Promise<string | null> {
  if (!isBrowser()) {
    // Server-side: return null (client token handled by MisoClient)
    return null;
  }

  const isDebug = misoConfig?.logLevel === "debug";

  // Check localStorage cache first
  const cachedToken = getLocalStorage("miso:client-token");
  const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
  
  if (isDebug) {
    console.log("[getClientToken] Checking localStorage:", {
      hasToken: !!cachedToken,
      hasExpiresAt: !!expiresAtStr,
      expiresAt: expiresAtStr,
      currentTime: Date.now(),
    });
  }
  
  if (cachedToken) {
    // If we have expiration timestamp, check it
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const timeUntilExpirySeconds = Math.floor(timeUntilExpiry / 1000);
      
      if (isDebug) {
        console.log("[getClientToken] Token expiration check:", {
          expiresAt,
          expiresAtISO: new Date(expiresAt).toISOString(),
          now,
          nowISO: new Date(now).toISOString(),
          timeUntilExpiry,
          timeUntilExpirySeconds,
          isValid: expiresAt > now,
          expired: expiresAt <= now,
          isNaN: isNaN(expiresAt),
        });
      }
      
      if (isNaN(expiresAt)) {
        console.warn("[getClientToken] Invalid expiration timestamp format, assuming token is valid");
        return cachedToken;
      } else if (expiresAt > now) {
        if (isDebug) {
          console.log("[getClientToken] Returning valid cached token (checked expiration)");
        }
        return cachedToken; // Valid cached token
      } else {
        console.warn("[getClientToken] Cached token expired, removing from cache");
        removeLocalStorage("miso:client-token");
        removeLocalStorage("miso:client-token-expires-at");
      }
    } else {
      // No expiration timestamp - try to decode JWT to check expiration
      try {
        // Decode JWT to check exp claim
        const decoded = jwt.decode(cachedToken) as { exp?: number } | null;
        if (decoded && decoded.exp) {
          const now = Date.now();
          const jwtExpiresAt = decoded.exp * 1000; // Convert to milliseconds
          const jwtTimeUntilExpiry = jwtExpiresAt - now;
          
          if (isDebug) {
            console.log("[getClientToken] Token expiration from JWT:", {
              jwtExpiresAt,
              jwtExpiresAtISO: new Date(jwtExpiresAt).toISOString(),
              now,
              nowISO: new Date(now).toISOString(),
              jwtTimeUntilExpiry,
              jwtTimeUntilExpirySeconds: Math.floor(jwtTimeUntilExpiry / 1000),
              jwtIsValid: jwtExpiresAt > now,
            });
          }
          
          if (jwtExpiresAt > now) {
            if (isDebug) {
              console.log("[getClientToken] Returning valid cached token (checked JWT expiration)");
            }
            return cachedToken;
          } else {
            console.warn("[getClientToken] Token expired (from JWT), removing from cache");
            removeLocalStorage("miso:client-token");
            removeLocalStorage("miso:client-token-expires-at");
          }
        } else {
          // Can't determine expiration - assume token is valid if it exists
          if (isDebug) {
            console.log("[getClientToken] No expiration info available, assuming token is valid");
          }
          return cachedToken;
        }
      } catch (error) {
        // Failed to decode token - assume it's valid if it exists
        console.warn("[getClientToken] Failed to decode token, assuming valid:", error);
        return cachedToken;
      }
    }
  }

  // Check config token
  if (misoConfig?.clientToken) {
    if (isDebug) {
      console.log("[getClientToken] Returning token from config");
    }
    return misoConfig.clientToken;
  }

  // Don't fetch client token if we don't have a cached token
  // This prevents unnecessary fetch calls during auth error handling
  // redirectToLogin can work without a client token (it's optional)
  console.warn("[getClientToken] No token available, returning null");
  return null;
}

/**
 * Build controller URL from configuration
 * Uses controllerPublicUrl (browser) or controllerUrl (fallback)
 * @returns Controller base URL or null if not configured
 */
export function getControllerUrl(misoConfig: MisoClientConfig | undefined): string | null {
  if (!misoConfig) {
    return null;
  }

  // Browser: prefer controllerPublicUrl, fallback to controllerUrl
  if (isBrowser()) {
    return misoConfig.controllerPublicUrl || 
           misoConfig.controllerUrl || 
           null;
  }

  // Server: prefer controllerPrivateUrl, fallback to controllerUrl
  return misoConfig.controllerPrivateUrl || 
         misoConfig.controllerUrl || 
         null;
}

/**
 * Redirect to login page via controller
 * Re-exported from data-client-redirect for backward compatibility
 */
export { redirectToLogin } from "./data-client-redirect";

/**
 * Logout user and redirect to controller logout page
 * Re-exported from data-client-redirect for backward compatibility
 */
export { logout } from "./data-client-redirect";

/**
 * Get environment token (browser-side)
 * Checks localStorage cache first, then calls backend endpoint if needed
 * Uses clientTokenUri from config or defaults to /api/v1/auth/client-token
 * 
 * @returns Client token string
 * @throws Error if token fetch fails
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
    const now = Date.now();

    // If token is still valid, return cached token
    if (expiresAt > now) {
      return cachedToken;
    }

    // Token expired, remove from cache
    removeLocalStorage(cacheKey);
    removeLocalStorage(expiresAtKey);
  }

  // Cache miss or expired - fetch from backend
  const clientTokenUri =
    config.misoConfig?.clientTokenUri || "/api/v1/auth/client-token";

  // Build full URL
  const fullUrl = /^https?:\/\//i.test(clientTokenUri)
    ? clientTokenUri
    : `${config.baseUrl}${clientTokenUri}`;

  try {
    // Make request to backend endpoint
    const response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include", // Include cookies for CORS
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to get environment token: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      data?: { token?: string; expiresIn?: number };
      token?: string;
      accessToken?: string;
      access_token?: string;
      expiresIn?: number;
      expires_in?: number;
    };

    // Extract token from response (support both nested and flat formats)
    const token =
      data.data?.token || data.token || data.accessToken || data.access_token;

    if (!token || typeof token !== "string") {
      throw new Error(
        "Invalid response format: token not found in response",
      );
    }

    // Calculate expiration time (default to 1 hour if not provided)
    const expiresIn =
      data.data?.expiresIn || data.expiresIn || data.expires_in || 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    // Cache token
    setLocalStorage(cacheKey, token);
    setLocalStorage(expiresAtKey, expiresAt.toString());

    // Log audit event if misoClient available
    if (misoClient && !shouldSkipAudit(clientTokenUri, config.audit)) {
      try {
        await misoClient.log.audit(
          "client.token.request.success",
          clientTokenUri,
          {
            method: "POST",
            url: clientTokenUri,
            statusCode: response.status,
            cached: false,
          },
          {},
        );
      } catch (auditError) {
        // Silently fail audit logging to avoid breaking requests
        console.warn("Failed to log audit event:", auditError);
      }
    }

    return token;
  } catch (error) {
    // Log audit event for error if misoClient available
    if (misoClient && !shouldSkipAudit(clientTokenUri, config.audit)) {
      try {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        await misoClient.log.audit(
          "client.token.request.failed",
          clientTokenUri,
          {
            method: "POST",
            url: clientTokenUri,
            statusCode: 0,
            error: errorMessage,
            cached: false,
          },
          {},
        );
      } catch (auditError) {
        // Silently fail audit logging to avoid breaking requests
        console.warn("Failed to log audit event:", auditError);
      }
    }

    throw error;
  }
}

/**
 * Get client token information (browser-side)
 * Extracts application and environment info from client token
 * 
 * @returns Client token info or null if token not available
 */
export function getClientTokenInfo(
  misoConfig: MisoClientConfig | undefined,
): ClientTokenInfo | null {
  if (!isBrowser()) {
    return null;
  }

  // Try to get token from cache first
  const cachedToken = getLocalStorage("miso:client-token");
  if (cachedToken) {
    return extractClientTokenInfo(cachedToken);
  }

  // Try to get token from config (if provided)
  const configToken = misoConfig?.clientToken;
  if (configToken) {
    return extractClientTokenInfo(configToken);
  }

  // No token available
  return null;
}

