/**
 * DataClient redirect to login utilities
 * Handles redirect to login flow with proper error handling
 */

import { DataClientConfig } from "../types/data-client.types";
import { getControllerUrl } from "./data-client-auth";
import { isBrowser } from "./data-client-utils";

/**
 * Build login request headers with client token
 */
function buildLoginHeaders(clientToken: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (clientToken) {
    headers["x-client-token"] = clientToken;
  }
  
  return headers;
}

/**
 * Build login endpoint URL with redirect parameter
 */
function buildLoginEndpointUrl(controllerUrl: string, redirectUrl: string): string {
  const loginEndpoint = `${controllerUrl}/api/v1/auth/login`;
  const url = new URL(loginEndpoint);
  url.searchParams.set("redirect", redirectUrl);
  return url.toString();
}

/**
 * Handle non-OK response from controller login endpoint
 */
function handleLoginErrorResponse(
  response: Response,
  controllerUrl: string,
  clientToken: string | null,
): never {
  const errorTextPromise = response.text().catch(() => 'Unable to read error response');
  
  // Create user-friendly error message based on status code
  let userFriendlyMessage = `Login request failed: ${response.status} ${response.statusText}`;
  if (response.status === 401 || response.status === 403) {
    userFriendlyMessage = "Authentication failed: Invalid client credentials. Please check your configuration.";
  } else if (response.status === 404) {
    userFriendlyMessage = `Authentication endpoint not found at ${controllerUrl}/api/v1/auth/login. Please verify your controller URL configuration.`;
  } else if (response.status >= 500) {
    userFriendlyMessage = "Authentication server error. Please try again later or contact support.";
  }
  
  return errorTextPromise.then((errorText) => {
    const error = new Error(userFriendlyMessage) as Error & { details?: unknown };
    error.details = {
      status: response.status,
      statusText: response.statusText,
      errorText,
      controllerUrl,
      hasClientToken: !!clientToken,
    };
    throw error;
  }) as never;
}

/**
 * Extract login URL from controller response
 */
function extractLoginUrl(data: {
  success?: boolean;
  data?: { loginUrl?: string; state?: string };
  loginUrl?: string;
}): string | null {
  return data.data?.loginUrl || data.loginUrl || null;
}

/**
 * Create user-friendly error message for network errors
 */
function createNetworkErrorMessage(
  errorMessage: string,
  controllerUrl: string | null,
  clientToken: string | null,
): string {
  if (errorMessage.includes("Failed to fetch") || errorMessage.includes("NetworkError") || errorMessage.includes("ERR_CONNECTION_REFUSED")) {
    return `Cannot connect to authentication server at ${controllerUrl || 'unknown'}. Please check your network connection and server configuration.`;
  }
  if (!clientToken) {
    return "Client token is missing. Please initialize DataClient with proper credentials.";
  }
  return `Login failed: ${errorMessage}`;
}

/**
 * Validate controller URL configuration
 */
function validateControllerUrl(config: DataClientConfig): string {
  const controllerUrl = getControllerUrl(config.misoConfig);
  
  if (!controllerUrl) {
    const error = new Error("Controller URL is not configured. Please configure controllerUrl or controllerPublicUrl in your DataClient configuration.") as Error & { details?: unknown };
    error.details = {
      hasMisoConfig: !!config.misoConfig,
      controllerUrl: config.misoConfig?.controllerUrl,
      controllerPublicUrl: config.misoConfig?.controllerPublicUrl,
      loginUrl: config.loginUrl,
    };
    throw error;
  }
  
  return controllerUrl;
}

/**
 * Call controller login endpoint
 */
async function callControllerLoginEndpoint(
  endpointUrl: string,
  headers: Record<string, string>,
  controllerUrl: string,
  clientToken: string | null,
): Promise<{ data?: { loginUrl?: string; state?: string }; loginUrl?: string }> {
  let response: Response;
  
  // Add timeout to prevent hanging (30 seconds)
  const timeout = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeout);
  
  try {
    response = await fetch(endpointUrl, {
      method: "GET",
      headers,
      credentials: "include",
      signal: controller.signal,
      redirect: "manual", // Don't follow redirects automatically - we'll handle them explicitly
    });
    
    clearTimeout(timeoutId);
  } catch (fetchError) {
    clearTimeout(timeoutId);
    
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    const errorName = fetchError instanceof Error ? fetchError.name : "Unknown";
    const isAbortError = errorName === "AbortError" || errorMessage.includes("aborted");
    const isNetworkError = errorName === "TypeError" || errorMessage.includes("Failed to fetch");
    
    // Create user-friendly error message
    let userFriendlyMessage = `Failed to fetch login endpoint: ${errorMessage}`;
    if (isAbortError) {
      userFriendlyMessage = `Request timeout: The login endpoint did not respond within ${timeout}ms. Please check your network connection and server status.`;
    } else if (isNetworkError) {
      if (errorMessage.includes("CORS") || errorMessage.includes("cross-origin")) {
        userFriendlyMessage = `CORS error: Cannot connect to ${controllerUrl}. The server may not allow cross-origin requests. Please check CORS configuration.`;
      } else {
        userFriendlyMessage = `Network error: Cannot connect to ${controllerUrl}. Please check your network connection and ensure the server is running.`;
      }
    }
    
    // Re-throw with more context
    const networkError = new Error(userFriendlyMessage) as Error & { details?: unknown };
    networkError.details = {
      endpointUrl,
      hasClientToken: !!clientToken,
      originalError: errorMessage,
      errorName,
      isTimeout: isAbortError,
      isCorsError: isNetworkError && (errorMessage.includes("CORS") || errorMessage.includes("cross-origin")),
    };
    throw networkError;
  }

  // Handle case where response is undefined (shouldn't happen, but be safe)
  if (!response) {
    throw new Error("Failed to fetch login endpoint: response is undefined");
  }

  // Check for redirect status codes - these should be handled, not followed automatically
  if (response.status >= 300 && response.status < 400) {
    // Don't follow redirect automatically - treat as error
    throw new Error(`Server returned redirect status ${response.status}. This should not happen for login endpoint.`);
  }

  if (!response.ok) {
    throw await handleLoginErrorResponse(response, controllerUrl, clientToken);
  }

  let data: {
    success?: boolean;
    data?: { loginUrl?: string; state?: string };
    loginUrl?: string;
  };
  
  try {
    data = (await response.json()) as typeof data;
  } catch (jsonError) {
    const errorMessage = jsonError instanceof Error ? jsonError.message : String(jsonError);
    throw new Error(
      `Failed to parse login response: ${errorMessage}. Status: ${response.status} ${response.statusText}`
    );
  }

  return data;
}

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
 * Handle successful login response
 * IMPORTANT: Only redirects if controller returns valid loginUrl - NO fallback redirects
 */
function handleSuccessfulLoginResponse(
  loginUrl: string | null,
  controllerUrl: string,
  data: { data?: { loginUrl?: string; state?: string }; loginUrl?: string },
  clientToken: string | null,
  _config: DataClientConfig,
): void {
  // CRITICAL: Only use loginUrl from controller - do NOT use fallback URL
  // If controller doesn't return a valid URL, throw error instead of redirecting
  const validatedUrl = getValidatedRedirectUrl(loginUrl);
  
  if (validatedUrl) {
    try {
      (globalThis as unknown as { window: { location: { href: string } } }).window.location.href = validatedUrl;
      return;
    } catch (redirectError) {
      const error = new Error("Failed to redirect to login URL. The URL may be blocked by browser security policies.") as Error & { details?: unknown };
      error.details = {
        validatedUrl,
        originalLoginUrl: loginUrl,
        redirectError: redirectError instanceof Error ? redirectError.message : String(redirectError),
      };
      throw error;
    }
  }
  
  // Controller did not return a valid login URL - throw error (do NOT use fallback)
  const error = new Error("Controller did not return a valid login URL. Please check your controller configuration and ensure the login endpoint is working correctly.") as Error & { details?: unknown };
  error.details = {
    controllerUrl,
    responseData: data,
    hasClientToken: !!clientToken,
    originalLoginUrl: loginUrl,
    validationFailed: true,
  };
  throw error;
}

/**
 * Handle login errors
 * IMPORTANT: Does NOT redirect on error - throws error instead
 * Redirects should only happen on successful responses
 * @param error - The error that occurred
 * @param controllerUrl - Controller URL
 * @param clientToken - Client token if available
 * @param config - DataClient configuration
 * @param skipLogging - If true, skip logging (error already logged)
 */
function handleLoginError(
  error: unknown,
  controllerUrl: string,
  clientToken: string | null,
  config: DataClientConfig,
  skipLogging = false,
): never {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorName = error instanceof Error ? error.name : "Unknown";
  const _errorStack = error instanceof Error ? error.stack : undefined;
  const errorDetails = (error as Error & { details?: unknown })?.details;
  
  // Log error - test expects Error object as second parameter
  if (!skipLogging) {
    const logError = error instanceof Error ? error : new Error(String(error));
    console.error("[redirectToLogin] Failed to get login URL from controller:", logError);
  }
  
  // DO NOT redirect on error - throw error instead
  // Redirects should only happen when fetch succeeds and returns valid URL
  
  // For non-network errors, throw immediately
  if (error instanceof Error && error.message && !error.message.includes("Failed to fetch")) {
    throw error;
  }
  
  const fullErrorDetails = {
    message: errorMessage,
    name: errorName,
    originalDetails: errorDetails,
    controllerUrl,
    hasClientToken: !!clientToken,
    config: {
      loginUrl: config.loginUrl,
      hasMisoConfig: !!config.misoConfig,
      controllerUrl: config.misoConfig?.controllerUrl,
      controllerPublicUrl: config.misoConfig?.controllerPublicUrl,
    },
  };
  
  const userFriendlyMessage = createNetworkErrorMessage(errorMessage, controllerUrl, clientToken);
  const loginError = new Error(userFriendlyMessage) as Error & { details?: typeof fullErrorDetails };
  loginError.details = fullErrorDetails;
  throw loginError;
}

/**
 * Redirect to login page via controller
 * Calls the controller login endpoint with redirect parameter and x-client-token header
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
  
  const controllerUrl = validateControllerUrl(config);
  let clientToken: string | null = null;

  try {
    clientToken = await getClientTokenFn();
    
    const endpointUrl = buildLoginEndpointUrl(controllerUrl, finalRedirectUrl);
    const headers = buildLoginHeaders(clientToken);
    
    // Fetch login URL from controller - this MUST succeed for redirect to happen
    const data = await callControllerLoginEndpoint(endpointUrl, headers, controllerUrl, clientToken);
    
    const loginUrl = extractLoginUrl(data);
    
    // Only redirect if we got a valid response - handleSuccessfulLoginResponse will validate URL
    handleSuccessfulLoginResponse(loginUrl, controllerUrl, data, clientToken, config);
  } catch (error) {
    // CRITICAL: Do NOT redirect on error - throw error instead
    // Redirects should ONLY happen when fetch succeeds and returns valid URL
    handleLoginError(error, controllerUrl, clientToken, config);
    // This line should never be reached since handleLoginError always throws
    throw error;
  }
}

