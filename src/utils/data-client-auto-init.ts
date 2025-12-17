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
  // Build full URL
  const fullUrl = /^https?:\/\//i.test(clientTokenUri)
    ? clientTokenUri
    : `${baseUrl}${clientTokenUri}`;

  try {
    // Try POST first (standard), fallback to GET
    let response = await fetch(fullUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    // If POST fails with 405, try GET
    if (response.status === 405) {
      response = await fetch(fullUrl, {
        method: "GET",
        credentials: "include",
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch config: ${response.status} ${response.statusText}. ${errorText}`,
      );
    }

    const data = (await response.json()) as ClientTokenResponse;

    // Check if response has config
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
    clientTokenUri: "/api/v1/auth/client-token",
    cacheConfig: true,
    ...options,
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

