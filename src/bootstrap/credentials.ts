import { joinApiRoot } from "../utils/url-join";
import { BootstrapError, BootstrapSnapshot } from "./types";
import { fetchSnapshot, mintClientToken } from "./transport";

/** Pin remote endpoints before any credential exchange; remote mode never loads dotenv. */
export function credentialSettings(): {
  controllerUrl: string;
  url: string;
  tokenUrl: string;
} {
  try {
    const root = new URL(process.env.MISO_CONTROLLER_URL || "");
    if (
      root.protocol !== "https:" ||
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
