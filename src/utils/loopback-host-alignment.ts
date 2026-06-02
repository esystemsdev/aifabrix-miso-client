/**
 * Align loopback hostnames with the browser page (localhost vs 127.0.0.1).
 */

export type AlignLoopbackHostnameOptions = {
  /** Test hook: override detected page hostname. */
  pageHostname?: string;
};

function readBrowserHostname(): string | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const win = globalThis as { location?: { hostname?: string } };
  const hostname = win.location?.hostname;
  if (typeof hostname !== "string" || !hostname.trim()) {
    return null;
  }
  return hostname.toLowerCase();
}

/**
 * When the app is on localhost, rewrite 127.0.0.1 → localhost (same port/path).
 * When the app is on 127.0.0.1, rewrite localhost → 127.0.0.1.
 */
export function alignLoopbackHostnameWithPage(
  url: string,
  options: AlignLoopbackHostnameOptions = {},
): string {
  const raw = (url || "").trim();
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return raw;
  }

  const pageHost = (
    options.pageHostname ?? readBrowserHostname()
  )?.toLowerCase();
  if (!pageHost) {
    return raw;
  }

  try {
    const parsed = new URL(raw);
    const targetHost = parsed.hostname.toLowerCase();
    if (pageHost === "localhost" && targetHost === "127.0.0.1") {
      parsed.hostname = "localhost";
    } else if (pageHost === "127.0.0.1" && targetHost === "localhost") {
      parsed.hostname = "127.0.0.1";
    }
    return parsed.href.replace(/\/$/, "") || parsed.href;
  } catch {
    return raw;
  }
}
