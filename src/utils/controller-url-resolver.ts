/**
 * Controller URL resolver utility
 * Resolves the appropriate controller URL based on environment (browser vs server)
 * and configuration (public vs private URLs)
 */

import { MisoClientConfig } from "../types/config.types";
import { KeycloakConfig } from "../types/token-validation.types";
import { mergeRootUrlWithBasePath } from "./url-join";

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

function readBrowserLocationOrigin(): string | null {
  try {
    const win = (globalThis as { window?: { location?: { origin?: string } } })
      .window;
    const origin = win?.location?.origin;
    if (typeof origin === "string" && origin.trim() !== "") {
      return origin.trim();
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Normalize a controller root string to an absolute http(s) URL.
 *
 * - **Full URL:** unchanged when it passes {@link validateUrl}.
 * - **Browser, path-only:** a string starting with `/` (but not `//`) is
 *   resolved against `window.location.origin` (same-origin controller UI).
 * - **Server:** path-only values are rejected; use a full internal URL.
 *
 * @param raw - `controllerPublicUrl`, `controllerPrivateUrl`, or `controllerUrl` value
 * @param isBrowserEnv - Result of {@link isBrowser}
 */
export function coerceControllerUrlToAbsolute(
  raw: string,
  isBrowserEnv: boolean,
): string {
  const resolvedUrl = raw.trim();
  if (resolvedUrl === "") {
    throw new Error("Controller URL must be a non-empty string.");
  }
  if (validateUrl(resolvedUrl)) {
    return resolvedUrl;
  }
  if (
    isBrowserEnv &&
    resolvedUrl.startsWith("/") &&
    !resolvedUrl.startsWith("//")
  ) {
    const origin = readBrowserLocationOrigin();
    if (!origin) {
      throw new Error(
        'Path-only controller URL (e.g. "/miso") requires window.location.origin. ' +
          "Set a full https:// URL, or ensure the page exposes a valid location.",
      );
    }
    try {
      return new URL(resolvedUrl, origin).href;
    } catch {
      throw new Error(
        `Invalid path-only controller URL: "${raw}". Could not resolve against origin "${origin}".`,
      );
    }
  }
  throw new Error(
    `Invalid controller URL format: "${raw}". Use a full http(s) URL${
      isBrowserEnv
        ? ', or in the browser a path starting with "/" (same origin as the app, not protocol-relative "//")'
        : ""
    }.`,
  );
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
 *
 * In the **browser**, `controllerPublicUrl` / `controllerUrl` may be a **path-only**
 * same-origin root (e.g. `"/miso"`), resolved with `window.location.origin`.
 * On the **server**, values must be full `http(s)` URLs.
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
      } or controllerUrl in your configuration.`,
    );
  }

  resolvedUrl = coerceControllerUrlToAbsolute(resolvedUrl, isBrowserEnv);

  resolvedUrl = mergeRootUrlWithBasePath(
    resolvedUrl,
    config.controllerBasePath,
  );

  // Resolve localhost to 127.0.0.1 to force IPv4 and avoid IPv6 connection issues
  // This prevents axios from hanging on IPv6 (::1) connections
  if (resolvedUrl.includes("localhost")) {
    resolvedUrl = resolvedUrl.replace(/localhost/g, "127.0.0.1");
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
  let resolvedUrl: string | undefined; // Step 1: Try environment-specific URL
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
      } or authServerUrl in your Keycloak configuration.`,
    );
  }

  // Validate URL format
  if (!validateUrl(resolvedUrl)) {
    throw new Error(
      `Invalid Keycloak URL format: "${resolvedUrl}". URL must be a valid HTTP or HTTPS URL.`,
    );
  }

  // Resolve localhost to 127.0.0.1 to force IPv4 and avoid IPv6 connection issues
  // This prevents axios from hanging on IPv6 (::1) connections
  if (resolvedUrl.includes("localhost")) {
    resolvedUrl = resolvedUrl.replace(/localhost/g, "127.0.0.1");
  }

  return resolvedUrl;
}
