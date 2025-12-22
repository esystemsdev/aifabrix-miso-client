/**
 * Controller URL resolver utility
 * Resolves the appropriate controller URL based on environment (browser vs server)
 * and configuration (public vs private URLs)
 */

import { MisoClientConfig } from "../types/config.types";

/**
 * Check if running in browser environment
 * Detects browser by checking for window, localStorage, and fetch globals
 */
export function isBrowser(): boolean {
  return (
    typeof (globalThis as { window?: unknown }).window !== "undefined" &&
    typeof (globalThis as { localStorage?: unknown }).localStorage !==
      "undefined" &&
    typeof (globalThis as { fetch?: unknown }).fetch !== "undefined"
  );
}

/**
 * Validate URL format
 * Ensures URL is a valid HTTP or HTTPS URL
 * 
 * @param url - URL string to validate
 * @returns true if URL is valid HTTP or HTTPS, false otherwise
 * 
 * @example
 * ```typescript
 * validateUrl('https://example.com'); // true
 * validateUrl('http://localhost:3000'); // true
 * validateUrl('ftp://example.com'); // false
 * validateUrl('invalid'); // false
 * ```
 */
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Resolve controller URL based on environment and configuration
 * 
 * Priority order:
 * 1. Environment-specific URL (controllerPublicUrl for browser, controllerPrivateUrl for server)
 * 2. Fallback to controllerUrl if environment-specific URL not provided
 * 3. Throw error if no URL available
 * 
 * @param config - MisoClientConfig object
 * @returns Resolved controller URL string
 * @throws Error if no valid URL is available
 */
export function resolveControllerUrl(config: MisoClientConfig): string {
  const isBrowserEnv = isBrowser();
  let resolvedUrl: string | undefined;

  // Step 1: Try environment-specific URL
  if (isBrowserEnv) {
    // Browser environment: use public URL
    resolvedUrl = config.controllerPublicUrl;
  } else {
    // Server environment: use private URL
    resolvedUrl = config.controllerPrivateUrl;
  }

  // Step 2: Fallback to controllerUrl if environment-specific URL not provided
  if (!resolvedUrl) {
    resolvedUrl = config.controllerUrl;
  }

  // Step 3: Validate and return (or throw error)
  if (!resolvedUrl) {
    throw new Error(
      `No controller URL configured. Please provide ${
        isBrowserEnv ? "controllerPublicUrl" : "controllerPrivateUrl"
      } or controllerUrl in your configuration.`
    );
  }

  // Validate URL format
  if (!validateUrl(resolvedUrl)) {
    throw new Error(
      `Invalid controller URL format: "${resolvedUrl}". URL must be a valid HTTP or HTTPS URL.`
    );
  }

  return resolvedUrl;
}

