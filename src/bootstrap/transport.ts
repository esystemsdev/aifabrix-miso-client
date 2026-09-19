import axios from "axios";
import { setTimeout as delay } from "node:timers/promises";
import { joinApiRoot } from "../utils/url-join";
import {
  BootstrapError,
  BootstrapSnapshot,
  BootstrapTokenProvider,
} from "./types";
import { validateSnapshot } from "./validation";
import { parseBrokerJson } from "./json";

/** Deployment settings are required only for explicitly enabled Azure mode. */
export function azureSettings(): {
  controllerUrl: string;
  url: string;
  scope: string;
} {
  try {
    const root = new URL(process.env.MISO_CONTROLLER_URL || "");
    const audience = process.env.MISO_BOOTSTRAP_AUDIENCE;
    if (
      root.protocol !== "https:" ||
      root.username ||
      root.password ||
      root.search ||
      root.hash ||
      !audience
    )
      throw new Error();
    return {
      controllerUrl: root.href,
      url: joinApiRoot(root.href, "/api/v1/auth/bootstrap"),
      scope: `${audience.replace(/\/$/, "")}/.default`,
    };
  } catch {
    throw new BootstrapError("invalid-settings");
  }
}

/** Bound even providers that fail to honor cancellation. */
export async function abortable<T>(
  work: Promise<T>,
  signal: AbortSignal,
): Promise<T> {
  if (signal.aborted) {
    void work.catch(() => undefined);
    throw new BootstrapError("unavailable");
  }
  let abort: () => void = () => undefined;
  const cancelled = new Promise<never>((_, reject) => {
    abort = () => reject(new BootstrapError("unavailable"));
    signal.addEventListener("abort", abort, { once: true });
  });
  try {
    return await Promise.race([work, cancelled]);
  } finally {
    signal.removeEventListener("abort", abort);
  }
}

function retryDelay(header: unknown, attempt: number): number {
  if (typeof header !== "string") return Math.random() * attempt * 1000;
  const seconds = /^\d+$/.test(header)
    ? Number(header)
    : (Date.parse(header) - Date.now()) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0)
    return Math.random() * attempt * 1000;
  if (seconds > 10) throw new BootstrapError("unavailable");
  return seconds * 1000;
}

class AttemptTimeout extends Error {}

async function request(url: string, token: string, signal: AbortSignal) {
  const client = axios.create();
  const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  try {
    return await abortable(
      client.post(
        url,
        { protocolVersion: 1 },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: attemptSignal,
          timeout: 5000,
          maxRedirects: 0,
          maxContentLength: 1048576,
          maxBodyLength: 1048576,
          responseType: "text",
          transformResponse: [(data) => data],
          validateStatus: () => true,
        },
      ),
      attemptSignal,
    );
  } catch (error) {
    if (attemptSignal.aborted && !signal.aborted) throw new AttemptTimeout();
    throw error;
  }
}

async function attemptRequest(
  url: string,
  token: string,
  signal: AbortSignal,
  attempt: number,
): Promise<BootstrapSnapshot | number> {
  const response = await request(url, token, signal);
  if (response.status === 401 || response.status === 403)
    throw new BootstrapError("authorization-denied");
  if ([429, 502, 503, 504].includes(response.status))
    return retryDelay(response.headers["retry-after"], attempt);
  if (response.status !== 200) throw new BootstrapError("protocol-error");
  if (
    typeof response.data !== "string" ||
    Buffer.byteLength(response.data) > 1048576
  )
    throw new BootstrapError("protocol-error");
  const body = parseBrokerJson(response.data) as {
    success?: unknown;
    data?: unknown;
  };
  if (body?.success !== true) throw new BootstrapError("protocol-error");
  return validateSnapshot(body.data);
}

function networkFailure(error: unknown): boolean {
  return (
    error instanceof AttemptTimeout ||
    (axios.isAxiosError(error) &&
      [
        "ECONNRESET",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ECONNABORTED",
        "EAI_AGAIN",
        "ENOTFOUND",
      ].includes(error.code || ""))
  );
}

async function attempts(
  url: string,
  token: string,
  signal: AbortSignal,
): Promise<BootstrapSnapshot> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    let wait: number;
    try {
      const result = await attemptRequest(url, token, signal, attempt);
      if (typeof result !== "number") return result;
      wait = result;
    } catch (error) {
      if (error instanceof BootstrapError) throw error;
      if (!networkFailure(error)) throw new BootstrapError("protocol-error");
      wait = Math.random() * attempt * 1000;
    }
    if (attempt < 3) await delay(wait, undefined, { signal });
  }
  throw new BootstrapError("unavailable");
}

/** Provider errors are untrusted, even if they resemble SDK error classes. */
async function acquireIdentity(
  provider: BootstrapTokenProvider,
  scope: string,
  signal: AbortSignal,
) {
  try {
    if (signal.aborted) throw new Error();
    const identity = await abortable(provider.getToken(scope, signal), signal);
    if (
      typeof identity.token !== "string" ||
      !identity.token ||
      !Number.isFinite(identity.expiresAt.getTime()) ||
      identity.expiresAt.getTime() <= Date.now()
    )
      throw new Error();
    return identity;
  } catch {
    throw new BootstrapError("unavailable");
  }
}

/** One bounded identity+HTTP operation; never retains raw errors. */
export async function fetchSnapshot(
  provider: BootstrapTokenProvider,
  settings: { url: string; scope: string },
  signal: AbortSignal,
): Promise<BootstrapSnapshot> {
  const operation = AbortSignal.any([signal, AbortSignal.timeout(30000)]);
  try {
    const identitySignal = AbortSignal.any([
      operation,
      AbortSignal.timeout(5000),
    ]);
    const identity = await acquireIdentity(
      provider,
      settings.scope,
      identitySignal,
    );
    return await abortable(
      attempts(settings.url, identity.token, operation),
      operation,
    );
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError("unavailable");
  }
}
