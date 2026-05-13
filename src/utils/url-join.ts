/**
 * URL join helpers for backend API URL construction.
 *
 * Single source of truth for joining a backend "root" URL with an API path.
 * Use the same `joinApiRoot` for every backend (controller, dataplane, custom apps).
 *
 * Decisions enforced by this module (see plan 57):
 *   - Prefer full URLs as the `root` (may include path, e.g. "https://domain.com/miso").
 *   - The `path` argument MUST start with "/".
 *   - There is exactly ONE join function for backend URLs. Do not introduce
 *     "controller join", "app join", or "auth join" duplicates.
 *   - No hardcoded virtual-directory segments (`/miso`, `/data`, `/myapp`, ...).
 *     Path literals come ONLY from configuration, never from this module.
 *   - In-app SPA routing/static assets are handled by Vite/React Router by the
 *     host application, not by this helper.
 */

/**
 * Normalize a "root" URL for use with {@link joinApiRoot}.
 *
 * - Accepts an absolute http(s) URL with optional path (e.g. "https://domain.com/miso").
 * - Strips trailing slashes from the path.
 * - Drops query string and hash; the root must not carry per-request state.
 * - Throws on empty / non-string / non-http(s) / unparseable inputs.
 *
 * @param root - Absolute base URL (may include a path).
 * @returns Normalized root URL with no trailing slash.
 * @throws {Error} If `root` is empty, not a string, not http/https, or unparseable.
 *
 * @example
 * normalizeRootUrl('https://domain.com/miso/');   // "https://domain.com/miso"
 * normalizeRootUrl('https://domain.com');         // "https://domain.com"
 * normalizeRootUrl('https://domain.com/data?x=1');// "https://domain.com/data"
 */
export function normalizeRootUrl(root: string): string {
  if (typeof root !== "string" || root.trim() === "") {
    throw new Error("normalizeRootUrl: root must be a non-empty string");
  }

  let parsed: URL;
  try {
    parsed = new URL(root);
  } catch {
    throw new Error(`normalizeRootUrl: invalid URL "${root}"`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `normalizeRootUrl: protocol must be http or https, got "${parsed.protocol}"`,
    );
  }

  let pathname = parsed.pathname;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    pathname = pathname.replace(/\/+$/, "");
  }
  if (pathname === "/") {
    pathname = "";
  }

  return `${parsed.protocol}//${parsed.host}${pathname}`;
}

/**
 * Detect a likely double-prefix between root path and the leading segment of
 * `path`. Used for an optional warning, not for silent de-duplication; the
 * caller is responsible for fixing config (e.g. drop `basePath` if `root`
 * already includes it).
 *
 * @internal
 */
export function isDoublePrefix(root: string, path: string): boolean {
  if (!path.startsWith("/")) return false;

  let rootPath: string;
  try {
    rootPath = new URL(root).pathname.replace(/\/+$/, "");
  } catch {
    return false;
  }
  if (rootPath === "" || rootPath === "/") return false;

  if (path === rootPath) return true;
  return path.startsWith(`${rootPath}/`);
}

/**
 * Join a full base URL with an API path.
 *
 * - `root` is a full URL and may include a virtual-directory path
 *   (e.g. "https://domain.com/miso", "https://domain.com/data", "https://domain.com").
 * - `path` MUST start with "/" (e.g. "/api/v1/health"). It is a relative
 *   API path defined by the caller / SDK constants; absolute URLs and protocol
 *   schemes are rejected so that callers do not accidentally bypass `root`.
 *
 * The function performs simple normalization:
 *   - Trims trailing slashes from `root`.
 *   - Concatenates `root + path`.
 *   - Does NOT silently strip a duplicate prefix; if you see double paths
 *     (e.g. "/miso/miso/api/..."), fix the configuration so that the
 *     virtual-directory segment lives in `root` exactly once.
 *
 * @param root - Full base URL (may include a path).
 * @param path - Path that must start with "/".
 * @returns Absolute URL string suitable for HTTP requests.
 * @throws {Error} If inputs are invalid.
 *
 * @example
 * joinApiRoot('https://domain.com/miso',  '/api/v1/health');
 * // "https://domain.com/miso/api/v1/health"
 *
 * joinApiRoot('https://domain.com',       '/api/v1/health');
 * // "https://domain.com/api/v1/health"
 *
 * joinApiRoot('https://domain.com/data/', '/api/items');
 * // "https://domain.com/data/api/items"
 */
export function joinApiRoot(root: string, path: string): string {
  if (typeof path !== "string") {
    throw new Error("joinApiRoot: path must be a string starting with '/'");
  }
  if (path === "" || !path.startsWith("/")) {
    throw new Error(
      `joinApiRoot: path must start with "/", got "${path}". ` +
        "Use a relative API path like '/api/v1/health'; absolute URLs must be passed directly.",
    );
  }
  if (/^https?:\/\//i.test(path)) {
    throw new Error(
      "joinApiRoot: path must be a relative API path starting with '/', not an absolute URL",
    );
  }

  const normalizedRoot = normalizeRootUrl(root);
  return `${normalizedRoot}${path}`;
}
