/**
 * DataClient redirect utilities
 * Handles redirect to login/logout flows
 */

import { MisoClient } from "../index";
import { DataClientConfig } from "../types/data-client.types";
import { getControllerUrl } from "./data-client-auth";
import { isBrowser } from "./data-client-utils";

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

  // Check for dangerous protocols (javascript:, data:, etc.)
  const dangerousProtocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:'];
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
  if (!isBrowser()) {
    return;
  }

  const currentUrl = (globalThis as unknown as { window: { location: { href: string } } }).window.location.href;
  const finalRedirectUrl = redirectUrl || currentUrl;
  
  // Get controller public URL (for browser environments)
  const controllerUrl = getControllerUrl(config.misoConfig);

  if (!controllerUrl) {
    const error = new Error("Controller URL is not configured. Please configure controllerUrl or controllerPublicUrl in your DataClient configuration.") as Error & { details?: unknown };
    error.details = {
      hasMisoConfig: !!config.misoConfig,
      controllerUrl: config.misoConfig?.controllerUrl,
      controllerPublicUrl: config.misoConfig?.controllerPublicUrl,
      controllerPrivateUrl: config.misoConfig?.controllerPrivateUrl,
    };
    throw error;
  }
  
  // Get client token
  const clientToken = await getClientTokenFn();
  
  // Get login URL from config (defaults to '/login')
  // Validate that loginUrl is not an API endpoint (should be a page, not /api/...)
  let loginPath = config.loginUrl || '/login';
  
  // Warn if loginUrl looks like an API endpoint (common mistake)
  if (loginPath.startsWith('/api/')) {
    console.warn(
      `⚠️ Warning: loginUrl is set to an API endpoint (${loginPath}). ` +
      `redirectToLogin() should redirect to a login PAGE (e.g., '/login'), not an API endpoint. ` +
      `Using default '/login' instead.`
    );
    loginPath = '/login';
  }
  
  // Build full controller login URL
  // If loginPath is already a full URL, use it; otherwise prepend controllerUrl
  let loginUrl: URL;
  if (/^https?:\/\//i.test(loginPath)) {
    loginUrl = new URL(loginPath);
  } else {
    loginUrl = new URL(loginPath, controllerUrl);
  }
  
  // Add redirect parameter
  loginUrl.searchParams.set('redirect', finalRedirectUrl);
  
  // Add client token as query parameter (controller will read it)
  if (clientToken) {
    loginUrl.searchParams.set('x-client-token', clientToken);
  }
  
  // Redirect user directly to controller login page
  // Controller handles OAuth flow and redirects back after authentication
  (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = loginUrl.toString();
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
  
  // Get tokens BEFORE clearing (needed for passing to controller)
  const token = getTokenFn();
  const clientToken = await getClientTokenFn();
  
  // Clear tokens from localStorage
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
  
  // Get controller public URL (for browser environments)
  const controllerUrl = getControllerUrl(config.misoConfig);
  
  if (!controllerUrl) {
    // Fallback to local redirect if controller URL not configured
    const finalRedirectUrl = redirectUrl || config.logoutUrl || config.loginUrl || "/login";
    const origin = (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin;
    const fullUrl = /^https?:\/\//i.test(finalRedirectUrl)
      ? finalRedirectUrl
      : `${origin}${finalRedirectUrl.startsWith("/") ? finalRedirectUrl : `/${finalRedirectUrl}`}`;
    
    const validatedUrl = getValidatedRedirectUrl(fullUrl);
    if (validatedUrl) {
      (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = validatedUrl;
    }
    return;
  }
  
  // Get logout URL from config (defaults to '/logout' or falls back to '/login')
  const logoutPath = config.logoutUrl || config.loginUrl || '/logout';
  
  // Build full controller logout URL
  // If logoutPath is already a full URL, use it; otherwise prepend controllerUrl
  let logoutUrl: URL;
  if (/^https?:\/\//i.test(logoutPath)) {
    logoutUrl = new URL(logoutPath);
  } else {
    logoutUrl = new URL(logoutPath, controllerUrl);
  }
  
  // Determine redirect URL: redirectUrl param > logoutUrl config > loginUrl config > '/login'
  const finalRedirectUrl = redirectUrl || config.logoutUrl || config.loginUrl || "/login";
  
  // Construct full redirect URL (if relative, make absolute)
  let fullRedirectUrl: string;
  if (/^https?:\/\//i.test(finalRedirectUrl)) {
    fullRedirectUrl = finalRedirectUrl;
  } else {
    const origin = (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin;
    fullRedirectUrl = `${origin}${finalRedirectUrl.startsWith("/") ? finalRedirectUrl : `/${finalRedirectUrl}`}`;
  }
  
  logoutUrl.searchParams.set('redirect', fullRedirectUrl);
  
  // Add client token as query parameter (controller will read it)
  if (clientToken) {
    logoutUrl.searchParams.set('x-client-token', clientToken);
  }
  
  // Add user token as query parameter if available (controller will read it)
  // Token was retrieved before clearing localStorage
  if (token) {
    logoutUrl.searchParams.set('token', token);
  }
  
  // Redirect user directly to controller logout page
  // Controller handles logout process and redirects back
  (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = logoutUrl.toString();
}
