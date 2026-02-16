/**
 * DataClient redirect utilities
 * Handles redirect to login/logout flows
 */

import { MisoClient } from "../index";
import { DataClientConfig } from "../types/data-client.types";
import { getControllerUrl } from "./data-client-auth";
import { isBrowser } from "./data-client-utils";
import { writeWarn } from "./console-logger";

/**
 * Validate redirect URL for safety and format
 * Checks for valid URL format and safe protocols (http, https)
 * @param url - URL to validate
 * @returns Validated URL string or null if invalid
 */
function validateRedirectUrl(url: string | null): string | null {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return null;
  }

  const trimmedUrl = url.trim();

  // Check for dangerous protocols
  const dangerousProtocols = [
    // eslint-disable-next-line no-script-url -- Intentional protocol blocklist entry for URL validation
    "javascript:",
    "data:",
    "vbscript:",
    "file:",
    "about:",
  ];
  const lowerUrl = trimmedUrl.toLowerCase();
  for (const protocol of dangerousProtocols) {
    if (lowerUrl.startsWith(protocol)) {
      return null;
    }
  }

  // Try to parse as URL
  let parsedUrl: URL;
  try {
    // If it's a relative URL, create a full URL using current origin
    if (trimmedUrl.startsWith('/') || !trimmedUrl.includes('://')) {
      const origin = (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin;
      parsedUrl = new URL(trimmedUrl, origin);
    } else {
      parsedUrl = new URL(trimmedUrl);
    }
  } catch (error) {
    return null;
  }

  // Only allow http and https protocols
  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    return null;
  }

  // Return the validated URL (use href to get full URL)
  const validatedUrl = parsedUrl.href;
  return validatedUrl;
}

/**
 * Synchronously get and validate redirect URL
 * Validates the URL before returning it
 * @param url - URL to validate and return
 * @param fallbackUrl - Optional fallback URL if primary is invalid
 * @returns Validated URL string or null if both are invalid
 */
export function getValidatedRedirectUrl(url: string | null, fallbackUrl?: string | null): string | null {
  // Try primary URL first
  const validatedUrl = validateRedirectUrl(url);
  if (validatedUrl) {
    return validatedUrl;
  }

  // Try fallback URL if provided
  if (fallbackUrl) {
    const validatedFallback = validateRedirectUrl(fallbackUrl);
    if (validatedFallback) {
      return validatedFallback;
    }
  }

  // Both URLs invalid
  return null;
}

function resolveLoginPath(config: DataClientConfig): string {
  const path = config.loginUrl || "/login";
  if (path.startsWith("/api/")) {
    writeWarn(
      `⚠️ Warning: loginUrl is set to an API endpoint (${path}). ` +
      "redirectToLogin() should redirect to a login PAGE (e.g., '/login'), not an API endpoint. Using default '/login'.",
    );
    return "/login";
  }
  return path;
}

/**
 * Redirect to controller login page
 * Redirects user browser directly to controller's login URL with client token
 * NO API CALLS - just browser redirect
 *
 * Flow:
 * 1. User visits: http://localhost:4111/dataplane/
 * 2. redirectToLogin() redirects to: {controllerPublicUrl}{loginUrl}?redirect={redirectUrl}&x-client-token={token}
 * 3. Controller handles OAuth flow and redirects back after authentication
 * 4. Controller redirects to: {redirectUrl}#token={userToken}
 * 5. DataClient.handleOAuthCallback() extracts token from hash and stores securely
 *
 * Security:
 * - Token is passed in hash fragment (#token=...) not query parameter
 * - Hash fragments are NOT sent to server (not in logs)
 * - Hash fragments are NOT stored in browser history
 * - Token is immediately removed from URL after extraction
 *
 * @param config - DataClient configuration
 * @param getClientTokenFn - Function to get client token
 * @param redirectUrl - Optional redirect URL to return to after login (defaults to current page URL)
 */
export async function redirectToLogin(
  config: DataClientConfig,
  getClientTokenFn: () => Promise<string | null>,
  redirectUrl?: string,
): Promise<void> {
  if (!isBrowser()) return;

  const currentUrl = getWindowLocation().href;
  const finalRedirectUrl = redirectUrl || currentUrl;
  const controllerUrl = getControllerUrl(config.misoConfig);

  if (!controllerUrl) {
    const err = new Error("Controller URL is not configured. Please configure controllerUrl or controllerPublicUrl in your DataClient configuration.") as Error & { details?: unknown };
    err.details = {
      hasMisoConfig: !!config.misoConfig,
      controllerUrl: config.misoConfig?.controllerUrl,
      controllerPublicUrl: config.misoConfig?.controllerPublicUrl,
      controllerPrivateUrl: config.misoConfig?.controllerPrivateUrl,
    };
    throw err;
  }

  const clientToken = await getClientTokenFn();
  const loginPath = resolveLoginPath(config);
  const loginUrl = /^https?:\/\//i.test(loginPath)
    ? new URL(loginPath)
    : new URL(loginPath, controllerUrl);

  loginUrl.searchParams.set("redirect", finalRedirectUrl);
  if (clientToken) loginUrl.searchParams.set("x-client-token", clientToken);
  performRedirect(loginUrl.toString());
}

function getWindowLocation(): { href: string; origin: string } {
  return (globalThis as unknown as { window: { location: { href: string; origin: string } } })
    .window.location;
}

function performRedirect(url: string): void {
  getWindowLocation().href = url;
}

function clearLocalStorageTokens(keys: string[]): void {
  const storage = (globalThis as unknown as { localStorage?: { removeItem: (k: string) => void } })
    .localStorage;
  if (!storage) return;
  keys.forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore localStorage errors
    }
  });
}

function buildAbsoluteRedirectUrl(relativeOrAbsolute: string): string {
  if (/^https?:\/\//i.test(relativeOrAbsolute)) return relativeOrAbsolute;
  const origin = getWindowLocation().origin;
  const path = relativeOrAbsolute.startsWith("/") ? relativeOrAbsolute : `/${relativeOrAbsolute}`;
  return `${origin}${path}`;
}

/**
 * Logout user and redirect to controller logout page
 * Clears tokens from localStorage, clears cache, and redirects to controller logout URL
 * NO API CALLS - just browser redirect
 * Controller handles the logout process
 *
 * @param config - DataClient configuration
 * @param getTokenFn - Function to get user token
 * @param getClientTokenFn - Function to get client token
 * @param clearCacheFn - Function to clear HTTP cache
 * @param redirectUrl - Optional redirect URL after logout (defaults to logoutUrl or loginUrl)
 * @param _misoClient - MisoClient instance (not used, kept for API compatibility)
 */
export async function logout(
  config: DataClientConfig,
  getTokenFn: () => string | null,
  getClientTokenFn: () => Promise<string | null>,
  clearCacheFn: () => void,
  redirectUrl?: string,
  _misoClient?: MisoClient | null,
): Promise<void> {
  if (!isBrowser()) return;

  const token = getTokenFn();
  const clientToken = await getClientTokenFn();
  clearLocalStorageTokens(config.tokenKeys || ["token", "accessToken", "authToken"]);
  clearCacheFn();

  const controllerUrl = getControllerUrl(config.misoConfig);
  const finalRedirectUrl = redirectUrl || config.logoutUrl || config.loginUrl || "/login";

  if (!controllerUrl) {
    const fullUrl = buildAbsoluteRedirectUrl(finalRedirectUrl);
    const validatedUrl = getValidatedRedirectUrl(fullUrl);
    if (validatedUrl) performRedirect(validatedUrl);
    return;
  }

  const logoutPath = config.logoutUrl || config.loginUrl || "/logout";
  const logoutUrl = /^https?:\/\//i.test(logoutPath)
    ? new URL(logoutPath)
    : new URL(logoutPath, controllerUrl);

  logoutUrl.searchParams.set("redirect", buildAbsoluteRedirectUrl(finalRedirectUrl));
  if (clientToken) logoutUrl.searchParams.set("x-client-token", clientToken);
  if (token) logoutUrl.searchParams.set("token", token);
  performRedirect(logoutUrl.toString());
}
