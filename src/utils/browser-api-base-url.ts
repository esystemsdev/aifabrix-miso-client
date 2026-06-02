/**
 * Resolve browser API base URL (split-port dev / Vite proxy vs direct controller).
 */

export type ResolveBrowserApiBaseUrlOptions = {
  /** Highest priority override (e.g. VITE_MISO_API_BASE_URL). */
  explicitMisoApiBaseUrl?: string;
  /** Configured API root (e.g. VITE_API_BASE_URL). */
  configuredApiBaseUrl?: string;
  /** Browser page origin; when omitted, uses window.location.origin when available. */
  pageOrigin?: string;
  /** Optional path prefix merged onto page origin (e.g. Vite BASE_URL). */
  basePath?: string;
};

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeBasePath(basePath: string | undefined): string {
  const raw = (basePath ?? "").trim();
  if (!raw || raw === "/") {
    return "";
  }
  const withLeading = raw.startsWith("/") ? raw : `/${raw}`;
  return trimTrailingSlashes(withLeading);
}

function mergeOriginWithBasePath(origin: string, basePath?: string): string {
  const normalizedOrigin = trimTrailingSlashes(origin);
  const path = normalizeBasePath(basePath);
  if (!path) {
    return normalizedOrigin;
  }
  return `${normalizedOrigin}${path}`;
}

function readDefaultPageOrigin(basePath?: string): string {
  if (typeof globalThis === "undefined") {
    return "";
  }
  const win = globalThis as {
    location?: { origin?: string };
  };
  const origin = win.location?.origin;
  if (typeof origin !== "string" || !origin.trim()) {
    return "";
  }
  return mergeOriginWithBasePath(origin, basePath);
}

/**
 * When configured API host differs from the page host, use the page origin so
 * requests go through the app proxy (split-port local dev).
 */
export function resolveBrowserApiBaseUrl(
  options: ResolveBrowserApiBaseUrlOptions = {},
): string {
  const explicit = trimTrailingSlashes(
    (options.explicitMisoApiBaseUrl ?? "").trim(),
  );
  if (explicit) {
    return explicit;
  }

  const configured = trimTrailingSlashes(
    (options.configuredApiBaseUrl ?? "").trim(),
  );
  const pageOrigin =
    options.pageOrigin !== undefined
      ? trimTrailingSlashes(options.pageOrigin)
      : readDefaultPageOrigin(options.basePath);

  if (!configured) {
    return pageOrigin;
  }

  if (!pageOrigin) {
    return configured;
  }

  try {
    const configuredHost = new URL(configured).host;
    const pageHost = new URL(pageOrigin).host;
    if (configuredHost !== pageHost) {
      return pageOrigin;
    }
  } catch {
    return configured;
  }

  return configured;
}
