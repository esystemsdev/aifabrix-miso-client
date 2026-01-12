/**
 * Controller URL resolver utility
 * Resolves the appropriate controller URL based on environment (browser vs server)
 * and configuration (public vs private URLs)
 */

import { MisoClientConfig } from "../types/config.types";
import { KeycloakConfig } from "../types/token-validation.types";

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

  // Resolve localhost to 127.0.0.1 to force IPv4 and avoid IPv6 connection issues
  // This prevents axios from hanging on IPv6 (::1) connections
  if (resolvedUrl.includes('localhost')) {
    resolvedUrl = resolvedUrl.replace(/localhost/g, '127.0.0.1');
  }

  return resolvedUrl;
}

/**
 * Resolve Keycloak URL based on environment and configuration
 * 
 * Priority order:
 * 1. Environment-specific URL (authServerPublicUrl for browser, authServerPrivateUrl for server)
 * 2. Fallback to authServerUrl if environment-specific URL not provided
 * 3. Throw error if no URL available
 * 
 * @param config - KeycloakConfig object
 * @returns Resolved Keycloak URL string
 * @throws Error if no valid URL is available
 * 
 * @example
 * ```typescript
 * // Server environment - uses private URL
 * const config: KeycloakConfig = {
 *   authServerUrl: 'https://keycloak.example.com',
 *   authServerPrivateUrl: 'http://keycloak-internal:8080',
 *   realm: 'my-realm'
 * };
 * const url = resolveKeycloakUrl(config); // Returns: 'http://127.0.0.1:8080'
 * 
 * // Browser environment - uses public URL
 * const browserConfig: KeycloakConfig = {
 *   authServerUrl: 'https://keycloak.example.com',
 *   authServerPublicUrl: 'https://keycloak.example.com',
 *   realm: 'my-realm'
 * };
 * const browserUrl = resolveKeycloakUrl(browserConfig); // Returns: 'https://keycloak.example.com'
 * ```
 */
export function resolveKeycloakUrl(config: KeycloakConfig): string {
  const isBrowserEnv = isBrowser();
  let resolvedUrl: string | undefined;  // Step 1: Try environment-specific URL
  if (isBrowserEnv) {
    // Browser environment: use public URL
    resolvedUrl = config.authServerPublicUrl;
  } else {
    // Server environment: use private URL
    resolvedUrl = config.authServerPrivateUrl;
  }

  // Step 2: Fallback to authServerUrl if environment-specific URL not provided
  if (!resolvedUrl) {
    resolvedUrl = config.authServerUrl;
  }

  // Step 3: Validate and return (or throw error)
  if (!resolvedUrl) {
    throw new Error(
      `No Keycloak URL configured. Please provide ${
        isBrowserEnv ? "authServerPublicUrl" : "authServerPrivateUrl"
      } or authServerUrl in your Keycloak configuration.`
    );
  }

  // Validate URL format
  if (!validateUrl(resolvedUrl)) {
    throw new Error(
      `Invalid Keycloak URL format: "${resolvedUrl}". URL must be a valid HTTP or HTTPS URL.`
    );
  }

  // Resolve localhost to 127.0.0.1 to force IPv4 and avoid IPv6 connection issues
  // This prevents axios from hanging on IPv6 (::1) connections
  if (resolvedUrl.includes('localhost')) {
    resolvedUrl = resolvedUrl.replace(/localhost/g, '127.0.0.1');
  }

  return resolvedUrl;
}
