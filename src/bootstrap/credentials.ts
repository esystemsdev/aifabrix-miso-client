import { isIP } from "node:net";
import { joinApiRoot } from "../utils/url-join";
import { BootstrapError, BootstrapSnapshot } from "./types";
import { fetchSnapshot, mintClientToken } from "./transport";

function isPrivateIp(host: string): boolean {
  const normalized = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(normalized) === 4) {
    const [first, second] = normalized.split(".").map(Number);
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }
  return (
    isIP(normalized) === 6 &&
    (normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      /^fe[89ab]/.test(normalized))
  );
}

function isInternalHttpHost(hostname: string): boolean {
  const host = hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "")
    .toLowerCase();
  return (
    isPrivateIp(host) ||
    host === "localhost" ||
    !host.includes(".") ||
    [".localhost", ".internal", ".local", ".svc"].some((suffix) =>
      host.endsWith(suffix),
    )
  );
}

/** Pin remote endpoints before any credential exchange; remote mode never loads dotenv. */
export function credentialSettings(): {
  controllerUrl: string;
  url: string;
  tokenUrl: string;
} {
  try {
    const root = new URL(process.env.MISO_CONTROLLER_URL || "");
    const trustedProtocol =
      root.protocol === "https:" ||
      (root.protocol === "http:" && isInternalHttpHost(root.hostname));
    if (
      !trustedProtocol ||
      root.username ||
      root.password ||
      root.search ||
      root.hash
    )
      throw new Error();
    return {
      controllerUrl: root.href,
      url: joinApiRoot(root.href, "/api/v1/auth/bootstrap"),
      tokenUrl: joinApiRoot(root.href, "/api/v1/auth/token"),
    };
  } catch {
    throw new BootstrapError("invalid-settings");
  }
}

/** Undefined starts a session; null means an existing session has no usable token. */
export async function credentialSnapshot(
  settings: ReturnType<typeof credentialSettings>,
  signal: AbortSignal,
  token?: string | null,
): Promise<BootstrapSnapshot> {
  if (token === null || signal.aborted) throw new BootstrapError("unavailable");
  const operation = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  const clientToken =
    token ?? (await mintClientToken(settings.tokenUrl, operation));
  return fetchSnapshot(clientToken, settings, operation);
}
