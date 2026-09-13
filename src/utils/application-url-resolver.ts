import type { AuthStrategy } from "../types/config.types";
import type { ApplicationStatusResponse } from "../api/types/applications.types";

type UrlSurface = "full" | "host" | "vdir";

interface ParsedUrlReference {
  targetKey?: string;
  surface: UrlSurface;
}

interface ApplicationStatusReader {
  getApplicationStatus(
    envKey: string,
    appKey: string,
    authStrategy?: AuthStrategy,
  ): Promise<ApplicationStatusResponse>;
}

const EXACT_PUBLIC_REFERENCES: Record<string, UrlSurface> = {
  public: "full",
  "host-public": "host",
  "vdir-public": "vdir",
};

const PUBLIC_SUFFIXES: Array<{ suffix: string; surface: UrlSurface }> = [
  { suffix: "-host-public", surface: "host" },
  { suffix: "-vdir-public", surface: "vdir" },
  { suffix: "-public", surface: "full" },
];

export function parsePublicApplicationUrlReference(
  reference: string,
): ParsedUrlReference {
  if (!reference.startsWith("url://")) {
    throw new Error("URL reference must start with url://");
  }
  const token = reference.slice("url://".length).trim();
  const exact = EXACT_PUBLIC_REFERENCES[token];
  if (exact) return { surface: exact };
  if (
    token === "internal" ||
    token === "private" ||
    token.endsWith("-internal") ||
    token.endsWith("-private")
  ) {
    throw new Error("Runtime clients can resolve only public URL references");
  }
  for (const descriptor of PUBLIC_SUFFIXES) {
    if (!token.endsWith(descriptor.suffix)) continue;
    const targetKey = token.slice(0, -descriptor.suffix.length);
    if (!targetKey) throw new Error("URL reference target is required");
    return { targetKey, surface: descriptor.surface };
  }
  // Preserve Builder's historical fallback: an unknown token means this app's public URL.
  return { surface: "full" };
}

function projectPublicUrl(value: string, surface: UrlSurface): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Canonical application URL must use HTTP or HTTPS");
  }
  if (url.username || url.password) {
    throw new Error("Canonical application URL must not contain credentials");
  }
  if (surface === "host") return url.origin;
  if (surface === "vdir") return url.pathname.replace(/\/+$/, "") || "/";
  url.hash = "";
  return url.toString().replace(/\/$/, url.pathname === "/" ? "" : "/");
}

export async function resolvePublicApplicationUrl(params: {
  reader: ApplicationStatusReader;
  envKey: string;
  ownAppKey: string;
  reference: string;
  authStrategy?: AuthStrategy;
}): Promise<string> {
  const parsed = parsePublicApplicationUrlReference(params.reference);
  const status = await params.reader.getApplicationStatus(
    params.envKey,
    parsed.targetKey ?? params.ownAppKey,
    params.authStrategy,
  );
  if (!status.url)
    throw new Error("Referenced application public URL is unavailable");
  return projectPublicUrl(status.url, parsed.surface);
}

export async function resolvePublicOrigins(params: {
  reader: ApplicationStatusReader;
  envKey: string;
  ownAppKey: string;
  origins?: string[];
  authStrategy?: AuthStrategy;
}): Promise<string[] | undefined> {
  if (!params.origins) return undefined;
  const resolved = await Promise.all(
    params.origins
      .flatMap((value) => value.split(","))
      .map(async (entry) => {
        const value = entry.trim();
        if (!value.startsWith("url://")) return value;
        const publicUrl = await resolvePublicApplicationUrl({
          ...params,
          reference: value,
        });
        return new URL(publicUrl).origin;
      }),
  );
  return [...new Set(resolved.filter(Boolean))];
}
