import axios from "axios";
import { setTimeout as delay } from "node:timers/promises";
import { BootstrapError, BootstrapSnapshot } from "./types";
import { validateSnapshot } from "./validation";
import { parseBrokerJson } from "./json";

interface BootstrapRequest<T> {
  url: string;
  headers: Record<string, string>;
  body?: { protocolVersion: number };
  status: number;
  parse: (body: unknown) => T;
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

async function request<T>(input: BootstrapRequest<T>, signal: AbortSignal) {
  const client = axios.create();
  const attemptSignal = AbortSignal.any([signal, AbortSignal.timeout(5000)]);
  try {
    return await abortable(
      client.post(input.url, input.body, {
        headers: {
          ...input.headers,
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
      }),
      attemptSignal,
    );
  } catch (error) {
    if (attemptSignal.aborted && !signal.aborted) throw new AttemptTimeout();
    throw error;
  }
}

async function attemptRequest<T>(
  input: BootstrapRequest<T>,
  signal: AbortSignal,
  attempt: number,
): Promise<{ value: T } | number> {
  const response = await request(input, signal);
  if (response.status === 401 || response.status === 403)
    throw new BootstrapError("authorization-denied");
  if ([429, 502, 503, 504].includes(response.status))
    return retryDelay(response.headers["retry-after"], attempt);
  if (response.status !== input.status)
    throw new BootstrapError("protocol-error");
  if (
    typeof response.data !== "string" ||
    Buffer.byteLength(response.data) > 1048576
  )
    throw new BootstrapError("protocol-error");
  return { value: input.parse(parseBrokerJson(response.data)) };
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

async function attempts<T>(
  input: BootstrapRequest<T>,
  signal: AbortSignal,
): Promise<T> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    if (signal.aborted) throw new BootstrapError("unavailable");
    let wait: number;
    try {
      const result = await attemptRequest(input, signal, attempt);
      if (typeof result !== "number") return result.value;
      wait = result;
    } catch (error) {
      if (signal.aborted) throw new BootstrapError("unavailable");
      if (error instanceof BootstrapError) throw error;
      if (!networkFailure(error)) throw new BootstrapError("protocol-error");
      wait = Math.random() * attempt * 1000;
    }
    if (attempt < 3) await delay(wait, undefined, { signal });
  }
  throw new BootstrapError("unavailable");
}

/** One bounded HTTP operation; never retains raw transport errors. */
async function bounded<T>(
  input: BootstrapRequest<T>,
  signal: AbortSignal,
): Promise<T> {
  try {
    return await abortable(attempts(input, signal), signal);
  } catch (error) {
    if (
      error instanceof BootstrapError &&
      ["unavailable", "protocol-error", "authorization-denied"].includes(
        error.code,
      )
    )
      throw new BootstrapError(error.code);
    throw new BootstrapError("unavailable");
  }
}

function grantToken(body: unknown): string {
  const data = (
    body as {
      data?: { token?: unknown; expiresIn?: unknown; expiresAt?: unknown };
    }
  )?.data;
  if (
    !data ||
    typeof data.token !== "string" ||
    !data.token.length ||
    data.token.length > 65536 ||
    typeof data.expiresIn !== "number" ||
    !Number.isFinite(data.expiresIn) ||
    data.expiresIn <= 0 ||
    typeof data.expiresAt !== "string" ||
    !Number.isFinite(Date.parse(data.expiresAt)) ||
    Date.parse(data.expiresAt) <= Date.now()
  )
    throw new BootstrapError("protocol-error");
  return data.token;
}

/** Initial credentials are read only for the grant and never stored in runtime config. */
export async function mintClientToken(
  url: string,
  signal: AbortSignal,
): Promise<string> {
  const clientId = process.env.MISO_CLIENTID || process.env.MISO_CLIENT_ID;
  const clientSecret =
    process.env.MISO_CLIENTSECRET || process.env.MISO_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new BootstrapError("invalid-settings");
  return bounded(
    {
      url,
      status: 201,
      headers: { "x-client-id": clientId, "x-client-secret": clientSecret },
      parse: grantToken,
    },
    signal,
  );
}

/** Fetch a snapshot with a Miso client token, never with credentials or a Bearer token. */
export async function fetchSnapshot(
  token: string,
  settings: { url: string },
  signal: AbortSignal,
): Promise<BootstrapSnapshot> {
  return bounded(
    {
      url: settings.url,
      status: 200,
      headers: { "x-client-token": token },
      body: { protocolVersion: 1 },
      parse: (body) => {
        const envelope = body as { success?: unknown; data?: unknown };
        if (envelope?.success !== true || Object.keys(envelope).length !== 2)
          throw new BootstrapError("protocol-error");
        return validateSnapshot(envelope.data);
      },
    },
    signal,
  );
}
