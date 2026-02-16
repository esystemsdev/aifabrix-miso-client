/**
 * DataClient Auto-Initialization Helper
 * Automatically fetches configuration from server and initializes DataClient
 *
 * Provides zero-config client-side setup for DataClient initialization
 */

import { DataClient } from "./data-client";
import { DataClientConfig } from "../types/data-client.types";
import { isBrowser, getLocalStorage, setLocalStorage, removeLocalStorage } from "./data-client-utils";
import { DataClientConfigResponse, ClientTokenResponse, hasConfig } from "../express/client-token-endpoint";

/**
 * Options for autoInitializeDataClient
 */
export interface AutoInitOptions {
  /** Client token endpoint URI (default: '/api/v1/auth/client-token') */
  clientTokenUri?: string;

  /** Override baseUrl detection (auto-detected from window.location if not provided) */
  baseUrl?: string;

  /** Error callback */
  onError?: (error: Error) => void;

  /** Whether to cache config in localStorage (default: true) */
  cacheConfig?: boolean;
}

/**
 * Cached config structure
 */
interface CachedConfig {
  config: DataClientConfigResponse;
  expiresAt: number;
}

/**
 * Get cached config from localStorage
 *
 * @returns Cached config or null if not found or expired
 */
function getCachedConfig(): CachedConfig | null {
  if (!isBrowser()) {
    return null;
  }

  try {
    const cachedStr = getLocalStorage("miso:dataclient-config");
    if (!cachedStr) {
      return null;
    }

    const cached: CachedConfig = JSON.parse(cachedStr);

    // Check if expired
    if (cached.expiresAt && cached.expiresAt < Date.now()) {
      removeLocalStorage("miso:dataclient-config");
      return null;
    }

    return cached;
  } catch {
    // Invalid cache, remove it
    removeLocalStorage("miso:dataclient-config");
    return null;
  }
}

/**
 * Get cached DataClient configuration from localStorage
 *
 * Returns the cached configuration that was stored by autoInitializeDataClient.
 * Useful for reading configuration without re-initializing DataClient.
 *
 * @returns Cached config or null if not found or expired
 *
 * @example
 * ```typescript
 * import { getCachedDataClientConfig } from '@aifabrix/miso-client';
 *
 * const cachedConfig = getCachedDataClientConfig();
 * if (cachedConfig) {
 *   console.log('Base URL:', cachedConfig.baseUrl);
 *   console.log('Controller URL:', cachedConfig.controllerUrl);
 *   console.log('Client ID:', cachedConfig.clientId);
 * }
 * ```
 */
export function getCachedDataClientConfig(): DataClientConfigResponse | null {
  const cached = getCachedConfig();
  return cached?.config || null;
}

/**
 * Cache config in localStorage
 *
 * @param config - Config to cache
 * @param expiresIn - Expiration time in seconds
 */
function cacheConfig(config: DataClientConfigResponse, expiresIn: number): void {
  if (!isBrowser()) {
    return;
  }

  try {
    const cached: CachedConfig = {
      config,
      expiresAt: Date.now() + expiresIn * 1000,
    };
    setLocalStorage("miso:dataclient-config", JSON.stringify(cached));
  } catch {
    // Ignore localStorage errors (SSR, private browsing, etc.)
  }
}

function buildConfigUrl(baseUrl: string, clientTokenUri: string): string {
  return /^https?:\/\//i.test(clientTokenUri)
    ? clientTokenUri
    : `${baseUrl}${clientTokenUri}`;
}

function createTimeoutController(timeout: number): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  if (typeof timeoutId.unref === "function") {
    timeoutId.unref();
  }
  return { controller, timeoutId };
}

function buildFetchError(
  fetchError: unknown,
  fullUrl: string,
  timeout: number,
): Error {
  const errorMessage =
    fetchError instanceof Error ? fetchError.message : String(fetchError);
  const errorName = fetchError instanceof Error ? fetchError.name : "Unknown";

  if (errorName === "AbortError" || errorMessage.includes("aborted")) {
    return new Error(
      `Request timeout: The client token endpoint did not respond within ${timeout}ms. ` +
        `Please check if the server is running and accessible at ${fullUrl}`,
    );
  }

  if (
    errorMessage.includes("ERR_EMPTY_RESPONSE") ||
    errorMessage.includes("empty response")
  ) {
    return new Error(
      `Connection error: The server closed the connection without sending a response. ` +
        `Please check if the server is running and accessible at ${fullUrl}`,
    );
  }

  if (
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("network")
  ) {
    return new Error(
      `Network error: Cannot connect to ${fullUrl}. ` +
        `Please check your network connection and ensure the server is running.`,
    );
  }

  return new Error(`Failed to fetch config: ${errorMessage}`);
}

async function fetchWithTimeout(
  fullUrl: string,
  method: "GET" | "POST",
  timeout: number,
  headers?: Record<string, string>,
): Promise<Response> {
  const { controller, timeoutId } = createTimeoutController(timeout);
  try {
    const response = await fetch(fullUrl, {
      method,
      headers,
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (fetchError) {
    clearTimeout(timeoutId);
    throw buildFetchError(fetchError, fullUrl, timeout);
  }
}

async function fetchConfigResponse(
  fullUrl: string,
  timeout: number,
): Promise<Response> {
  const response = await fetchWithTimeout(fullUrl, "POST", timeout, {
    "Content-Type": "application/json",
  });

  if (response.status !== 405) {
    return response;
  }

  return fetchWithTimeout(fullUrl, "GET", timeout);
}

async function buildHttpErrorMessage(response: Response): Promise<string> {
  let errorMessage = `Failed to fetch config: ${response.status} ${response.statusText}`;
  let errorDetails: string | undefined;

  try {
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const errorData =
        (await response.json().catch(() => null)) as Record<string, unknown> | null;
      if (errorData) {
        if (typeof errorData.message === "string") {
          errorMessage = errorData.message;
        } else if (typeof errorData.error === "string") {
          errorMessage = errorData.error;
        }

        if (errorData.details) {
          if (typeof errorData.details === "string") {
            errorDetails = errorData.details;
          } else if (
            typeof errorData.details === "object" &&
            errorData.details !== null
          ) {
            const details = errorData.details as Record<string, unknown>;
            if (typeof details.suggestion === "string") {
              errorDetails = details.suggestion;
            } else if (typeof details.controllerUrl === "string") {
              errorDetails = `Controller URL: ${details.controllerUrl}`;
            }
          }
        }
      }
    } else {
      const errorText = await response.text().catch(
        () => "Unable to read error response",
      );
      if (errorText && errorText !== "Unable to read error response") {
        errorMessage = `${errorMessage}. ${errorText}`;
      }
    }
  } catch {
    try {
      const errorText = await response.text().catch(() => "");
      if (errorText) {
        errorMessage = `${errorMessage}. ${errorText}`;
      }
    } catch {
      // Ignore errors reading response
    }
  }

  return errorDetails ? `${errorMessage}. ${errorDetails}` : errorMessage;
}

/**
 * Fetch config from server endpoint
 *
 * @param baseUrl - Base URL for the API
 * @param clientTokenUri - Client token endpoint URI
 * @returns Config response
 */
async function fetchConfig(
  baseUrl: string,
  clientTokenUri: string,
): Promise<DataClientConfigResponse> {
  const fullUrl = buildConfigUrl(baseUrl, clientTokenUri);
  const timeout = 30000;

  try {
    const response = await fetchConfigResponse(fullUrl, timeout);
    if (!response.ok) {
      throw new Error(await buildHttpErrorMessage(response));
    }

    const data = (await response.json()) as ClientTokenResponse;
    if (!hasConfig(data)) {
      throw new Error(
        "Invalid response format: config not found in response. " +
          "Make sure your server endpoint uses createClientTokenEndpoint() helper.",
      );
    }

    return data.config;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Network error: ${String(error)}`);
  }
}

/**
 * Auto-initialize DataClient with server-provided configuration
 *
 * Automatically:
 * 1. Detects if running in browser
 * 2. Checks localStorage cache first
 * 3. Fetches config from server endpoint if needed
 * 4. Initializes DataClient with server-provided config
 * 5. Caches config for future use
 *
 * @param options - Optional configuration
 * @returns Initialized DataClient instance
 * @throws Error if initialization fails
 *
 * @example
 * ```typescript
 * import { autoInitializeDataClient } from '@aifabrix/miso-client';
 *
 * // One line - everything is automatic
 * const dataClient = await autoInitializeDataClient();
 * ```
 */
export async function autoInitializeDataClient(
  options?: AutoInitOptions,
): Promise<DataClient> {
  // Check if running in browser
  if (!isBrowser()) {
    throw new Error(
      "autoInitializeDataClient() is only available in browser environment",
    );
  }

  const opts = {
    clientTokenUri: options?.clientTokenUri || "/api/v1/auth/client-token",
    cacheConfig: options?.cacheConfig ?? true,
    baseUrl: options?.baseUrl,
    onError: options?.onError,
  };

  try {
    // Auto-detect baseUrl from window.location if not provided
    const baseUrl =
      opts.baseUrl ||
      (isBrowser()
        ? (globalThis as unknown as { window: { location: { origin: string } } }).window.location.origin
        : "");

    if (!baseUrl) {
      throw new Error(
        "Unable to detect baseUrl. Please provide baseUrl option.",
      );
    }

    let config: DataClientConfigResponse | null = null;

    // Check cache first if enabled
    if (opts.cacheConfig) {
      const cached = getCachedConfig();
      if (cached) {
        config = cached.config;
      }
    }

    // Fetch from server if not cached
    if (!config) {
      config = await fetchConfig(baseUrl, opts.clientTokenUri);

      // Cache config if enabled (use expiresIn from token response if available)
      // Default to 30 minutes (1800 seconds) if not available
      if (opts.cacheConfig) {
        cacheConfig(config, 1800);
      }
    }

    // Build DataClient config
    const dataClientConfig: DataClientConfig = {
      baseUrl: config.baseUrl,
      misoConfig: {
        clientId: config.clientId,
        controllerUrl: config.controllerUrl,
        controllerPublicUrl: config.controllerPublicUrl,
        clientTokenUri: config.clientTokenUri,
      },
    };

    // Initialize and return DataClient
    return new DataClient(dataClientConfig);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Call error callback if provided
    if (opts.onError) {
      opts.onError(err);
    }

    throw err;
  }
}

