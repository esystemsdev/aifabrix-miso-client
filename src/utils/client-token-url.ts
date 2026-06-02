/**
 * Extract/remove x-client-token from browser URL query or hash.
 */

export type ClientTokenUrlSource = {
  href: string;
  search: string;
  hash: string;
};

export type ExtractClientTokenFromUrlOptions = {
  /** When omitted, uses window.location in browser environments. */
  location?: ClientTokenUrlSource;
  paramName?: string;
};

export type RemoveClientTokenFromUrlOptions =
  ExtractClientTokenFromUrlOptions & {
    replaceUrl?: (nextHref: string) => void;
  };

function readDefaultLocation(): ClientTokenUrlSource | null {
  if (typeof globalThis === "undefined") {
    return null;
  }
  const win = globalThis as { location?: ClientTokenUrlSource };
  if (!win.location?.href) {
    return null;
  }
  return win.location;
}

function extractFromParams(
  params: URLSearchParams,
  paramName: string,
): string | null {
  const value = params.get(paramName);
  return value && value.length > 0 ? value : null;
}

/**
 * Read client token from query string, then hash fragment.
 */
export function extractClientTokenFromUrl(
  options: ExtractClientTokenFromUrlOptions = {},
): string | null {
  const paramName = options.paramName ?? "x-client-token";
  const location = options.location ?? readDefaultLocation();
  if (!location) {
    return null;
  }

  const fromQuery = extractFromParams(
    new URLSearchParams(location.search),
    paramName,
  );
  if (fromQuery) {
    return fromQuery;
  }

  const hashBody = location.hash.startsWith("#")
    ? location.hash.substring(1)
    : location.hash;
  return extractFromParams(new URLSearchParams(hashBody), paramName);
}

/**
 * Remove client token param from URL without navigation.
 */
export function removeClientTokenFromUrl(
  options: RemoveClientTokenFromUrlOptions = {},
): void {
  const paramName = options.paramName ?? "x-client-token";
  const location = options.location ?? readDefaultLocation();
  if (!location) {
    return;
  }

  const url = new URL(location.href);
  url.searchParams.delete(paramName);

  if (url.hash) {
    const hashBody = url.hash.startsWith("#")
      ? url.hash.substring(1)
      : url.hash;
    const hashParams = new URLSearchParams(hashBody);
    hashParams.delete(paramName);
    url.hash = hashParams.toString() ? `#${hashParams.toString()}` : "";
  }

  const nextHref = url.toString();
  if (options.replaceUrl) {
    options.replaceUrl(nextHref);
    return;
  }

  const history = (
    globalThis as {
      history?: {
        replaceState?: (state: object, unused: string, url: string) => void;
      };
    }
  ).history;
  history?.replaceState?.({}, "", nextHref);
}
