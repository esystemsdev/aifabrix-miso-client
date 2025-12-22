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
import { getValidatedRedirectUrl } from "./data-client-redirect";

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
    console.log("[getClientToken] Not in browser environment");
    return null;
  }

  // Check localStorage cache first
  const cachedToken = getLocalStorage("miso:client-token");
  const expiresAtStr = getLocalStorage("miso:client-token-expires-at");
  
  console.log("[getClientToken] Checking localStorage:", {
    hasToken: !!cachedToken,
    hasExpiresAt: !!expiresAtStr,
    expiresAt: expiresAtStr,
    currentTime: Date.now(),
  });
  
  if (cachedToken) {
    // If we have expiration timestamp, check it
    if (expiresAtStr) {
      const expiresAt = parseInt(expiresAtStr, 10);
      const now = Date.now();
      const timeUntilExpiry = expiresAt - now;
      const timeUntilExpirySeconds = Math.floor(timeUntilExpiry / 1000);
      
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
      
      if (isNaN(expiresAt)) {
        console.warn("[getClientToken] Invalid expiration timestamp format, assuming token is valid");
        return cachedToken;
      } else if (expiresAt > now) {
        console.log("[getClientToken] Returning valid cached token (checked expiration)");
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
          console.log("[getClientToken] Token expiration from JWT:", {
            jwtExpiresAt,
            jwtExpiresAtISO: new Date(jwtExpiresAt).toISOString(),
            now,
            nowISO: new Date(now).toISOString(),
            jwtTimeUntilExpiry,
            jwtTimeUntilExpirySeconds: Math.floor(jwtTimeUntilExpiry / 1000),
            jwtIsValid: jwtExpiresAt > now,
          });
          
          if (jwtExpiresAt > now) {
            console.log("[getClientToken] Returning valid cached token (checked JWT expiration)");
            return cachedToken;
          } else {
            console.warn("[getClientToken] Token expired (from JWT), removing from cache");
            removeLocalStorage("miso:client-token");
            removeLocalStorage("miso:client-token-expires-at");
          }
        } else {
          // Can't determine expiration - assume token is valid if it exists
          console.log("[getClientToken] No expiration info available, assuming token is valid");
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
    console.log("[getClientToken] Returning token from config");
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
 * Logout user and redirect
 * Calls logout API with x-client-token header, clears tokens from localStorage, clears cache, and redirects
 * @param redirectUrl - Optional redirect URL after logout (defaults to logoutUrl or loginUrl)
 */
export async function logout(
  config: DataClientConfig,
  getTokenFn: () => string | null,
  getClientTokenFn: () => Promise<string | null>,
  clearCacheFn: () => void,
  redirectUrl?: string,
): Promise<void> {
  if (!isBrowser()) return;
  
  const token = getTokenFn();
  
  // Build controller URL
  const controllerUrl = getControllerUrl(config.misoConfig);
  
  // Call logout API if controller URL available and token exists
  if (controllerUrl && token) {
    try {
      // Get client token
      const clientToken = await getClientTokenFn();
      
      // Build logout endpoint URL
      const logoutEndpoint = `${controllerUrl}/api/v1/auth/logout`;
      
      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add x-client-token header if available
      if (clientToken) {
        headers["x-client-token"] = clientToken;
      }
      
      // Make fetch request
      const response = await fetch(logoutEndpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({ token }),
        credentials: "include", // Include cookies for CORS
      });

      if (!response.ok) {
        // Log error but continue with cleanup (logout should always clear local state)
        const errorText = await response.text().catch(() => "Unknown error");
        console.error(`Logout API call failed: ${response.status} ${response.statusText}. ${errorText}`);
      }
    } catch (error) {
      // Log error but continue with cleanup (logout should always clear local state)
      console.error("Logout API call failed:", error);
    }
  }
  
  // Clear tokens from localStorage (always, even if API call failed)
  const keys = config.tokenKeys || ["token", "accessToken", "authToken"];
  keys.forEach(key => {
    try {
      const storage = (globalThis as unknown as { localStorage: { removeItem: (key: string) => void } }).localStorage;
      if (storage) {
        storage.removeItem(key);
      }
    } catch (e) {
      // Ignore localStorage errors (SSR, private browsing, etc.)
    }
  });
  
  // Clear HTTP cache
  clearCacheFn();
  
  // Determine redirect URL: redirectUrl param > logoutUrl config > loginUrl config > '/login'
  const finalRedirectUrl = redirectUrl || 
    config.logoutUrl || 
    config.loginUrl || 
    "/login";
  
  // Construct full URL (if relative, make absolute)
  let fullUrl: string;
  if (/^https?:\/\//i.test(finalRedirectUrl)) {
    fullUrl = finalRedirectUrl;
  } else {
    const origin = (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin;
    fullUrl = `${origin}${finalRedirectUrl.startsWith("/") ? finalRedirectUrl : `/${finalRedirectUrl}`}`;
  }
  
  // Validate URL before redirecting
  const validatedUrl = getValidatedRedirectUrl(fullUrl);
  if (!validatedUrl) {
    console.error("[logout] Invalid redirect URL, cannot redirect:", fullUrl);
    // Fallback to current origin/login if validation fails
    const origin = (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin;
    const fallbackUrl = `${origin}/login`;
    console.warn("[logout] Using fallback redirect URL:", fallbackUrl);
    (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fallbackUrl;
    return;
  }
  
  // Redirect to validated URL
  console.log("[logout] Redirecting to validated URL:", validatedUrl);
  try {
    (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = validatedUrl;
  } catch (redirectError) {
    console.error("[logout] Failed to redirect:", redirectError);
    // Fallback to current origin/login if redirect fails
    const origin = (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin;
    const fallbackUrl = `${origin}/login`;
    (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = fallbackUrl;
  }
}

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

