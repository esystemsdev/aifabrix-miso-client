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

const SELF_PRIVATE_BOOTSTRAP_REFERENCES = new Set([
  "url://internal",
  "url://private",
  "url://host-internal",
  "url://host-private",
  "url://vdir-internal",
  "url://vdir-private",
]);

function splitOrigins(origins?: string[]): string[] {
  return (origins ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

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
  bootstrapOrigins?: string[];
  authStrategy?: AuthStrategy;
}): Promise<string[] | undefined> {
  if (!params.origins) return undefined;
  const bootstrapOrigins = splitOrigins(params.bootstrapOrigins);
  const logicalOrigins = splitOrigins(params.origins);
  const resolved = await Promise.all(
    logicalOrigins.map(async (entry, index) => {
        const value = entry;
        if (!value.startsWith("url://")) return value;
        if (SELF_PRIVATE_BOOTSTRAP_REFERENCES.has(value)) {
          const bootstrap = bootstrapOrigins[index];
          if (!bootstrap || bootstrap.startsWith("url://")) {
            throw new Error(
              "Concrete private CORS bootstrap origin is unavailable",
            );
          }
          return new URL(bootstrap).origin;
        }
        const publicUrl = await resolvePublicApplicationUrl({
          ...params,
          reference: value,
        });
        return new URL(publicUrl).origin;
      }),
  );
  return [...new Set(resolved.filter(Boolean))];
}
