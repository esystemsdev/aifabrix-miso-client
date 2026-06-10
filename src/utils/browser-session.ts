/**
 * Cookie-first browser session restore/refresh against miso-controller.
 */
import type { UserSessionTokenResult } from "../types/data-client.types";
import {
  AUTH_BROWSER_SESSION_PATHS,
  type BrowserSessionClient,
  type BrowserSessionClientOptions,
  type SessionRestoreResult,
  type SessionRestoreSuccess,
} from "../types/browser-session.types";

type JsonRecord = Record<string, unknown>;

const DEFAULT_RETRY_DELAYS_MS = [250, 500, 1000];
const DEFAULT_TIMEOUT_MS = 10_000;

let restoreSessionInFlight: Promise<SessionRestoreResult> | null = null;
let refreshSessionInFlight: Promise<SessionRestoreResult> | null = null;

function normalizeExpiresAt(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return raw > 10_000_000_000 ? raw : raw * 1000;
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      return normalizeExpiresAt(Number(trimmed));
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function getNestedRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getSessionPayload(raw: unknown): JsonRecord {
  const record = getNestedRecord(raw) ?? {};
  return getNestedRecord(record.data) ?? record;
}

function getSessionToken(payload: JsonRecord): string | null {
  const token = payload.token ?? payload.accessToken ?? payload.authToken;
  return typeof token === "string" && token ? token : null;
}

function resolveTokenExpiresAt(
  payload: JsonRecord,
  preferredExpiresAt?: unknown,
): number | null {
  return (
    normalizeExpiresAt(preferredExpiresAt) ??
    normalizeExpiresAt(payload.expiresAt) ??
    (typeof payload.expiresIn === "number" && Number.isFinite(payload.expiresIn)
      ? Date.now() + payload.expiresIn * 1000
      : typeof payload.expiresIn === "string" && payload.expiresIn.trim()
        ? Date.now() + Number(payload.expiresIn) * 1000
        : null)
  );
}

function buildStatusError(
  message: string,
  status: number,
): Error & { status: number } {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
}

function getSessionErrorMessage(payload: JsonRecord, status: number): string {
  for (const key of ["detail", "message", "title", "error"] as const) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return `Browser auth request failed: ${status}`;
}

async function readJsonResponse(response: Response): Promise<JsonRecord> {
  try {
    const text = await response.text();
    if (!text) return {};
    const parsed = JSON.parse(text) as unknown;
    return getNestedRecord(parsed) ?? {};
  } catch {
    return {};
  }
}

function normalizeSessionFailure(
  error: unknown,
  fallbackMessage: string,
): Extract<SessionRestoreResult, { ok: false }> {
  if ((error as { name?: string } | null)?.name === "AbortError") {
    return {
      ok: false,
      reason: "network",
      message: "Browser auth request timed out",
    };
  }

  const status = (error as { status?: number } | null)?.status;
  const message = error instanceof Error ? error.message : fallbackMessage;

  if (
    status === 401 ||
    (status === 400 && /token is not active/i.test(message))
  ) {
    return { ok: false, status, reason: "unauthorized", message };
  }

  if (status === undefined) {
    return { ok: false, reason: "network", message };
  }

  if (status === 429 || status >= 500) {
    return { ok: false, status, reason: "server", message };
  }

  return { ok: false, status, reason: "invalid", message };
}

function isTransientSessionFailure(result: SessionRestoreResult): boolean {
  return (
    !result.ok &&
    (result.reason === "network" ||
      (result.reason === "server" && result.status !== 429))
  );
}

function formatExpiresAtIso(expiresAt: number | null): string | undefined {
  return expiresAt !== null ? new Date(expiresAt).toISOString() : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveSessionEndpoint(
  options: BrowserSessionClientOptions,
  path: string,
): string {
  const baseUrl = options.getBaseUrl().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}${path}` : path;
}

function buildSessionFetchInit(method: "GET" | "POST"): RequestInit {
  return {
    method,
    credentials: "include",
  };
}

async function fetchWithTimeout(
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(endpoint, { ...init, signal: controller.signal });
  } finally {
    globalThis.clearTimeout(timeoutId);
  }
}

function parseExpiresIn(payload: JsonRecord): number | undefined {
  if (
    typeof payload.expiresIn === "number" &&
    Number.isFinite(payload.expiresIn)
  ) {
    return payload.expiresIn;
  }
  if (typeof payload.expiresIn === "string" && payload.expiresIn.trim()) {
    return Number(payload.expiresIn);
  }
  return undefined;
}

function parseSessionSuccessPayload(payload: JsonRecord): SessionRestoreResult {
  const accessToken = getSessionToken(payload);
  if (!accessToken) {
    return {
      ok: false,
      reason: "invalid",
      message: "Browser auth response did not include an access token",
    };
  }

  const expiresAt = resolveTokenExpiresAt(payload, payload.expiresAt);
  return {
    ok: true,
    accessToken,
    expiresAt: formatExpiresAtIso(expiresAt),
    expiresIn: parseExpiresIn(payload),
    user: getNestedRecord(payload.user) ?? undefined,
  };
}

async function executeBrowserSessionAttempt(
  endpoint: string,
  method: "GET" | "POST",
  timeoutMs: number,
): Promise<SessionRestoreResult> {
  const response = await fetchWithTimeout(
    endpoint,
    buildSessionFetchInit(method),
    timeoutMs,
  );

  if (!response.ok) {
    const errorPayload = await readJsonResponse(response);
    throw buildStatusError(
      getSessionErrorMessage(errorPayload, response.status),
      response.status,
    );
  }

  const payload = getSessionPayload(await readJsonResponse(response));
  return parseSessionSuccessPayload(payload);
}

async function performBrowserSessionRequest(
  options: BrowserSessionClientOptions,
  path: string,
  method: "GET" | "POST",
): Promise<SessionRestoreResult> {
  const endpoint = resolveSessionEndpoint(options, path);
  const retryDelays = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retryDelays.length; attempt += 1) {
    try {
      return await executeBrowserSessionAttempt(endpoint, method, timeoutMs);
    } catch (error) {
      const failure = normalizeSessionFailure(
        error,
        "Browser auth request failed",
      );
      if (
        attempt === retryDelays.length ||
        !isTransientSessionFailure(failure)
      ) {
        return failure;
      }
      await sleep(retryDelays[attempt]);
    }
  }

  return {
    ok: false,
    reason: "server",
    message: "Browser auth request failed",
  };
}

function dedupeSessionRequest(
  currentPromise: Promise<SessionRestoreResult> | null,
  setPromise: (value: Promise<SessionRestoreResult> | null) => void,
  requestFactory: () => Promise<SessionRestoreResult>,
): Promise<SessionRestoreResult> {
  if (currentPromise) {
    return currentPromise;
  }

  const nextPromise = requestFactory().finally(() => {
    setPromise(null);
  });
  setPromise(nextPromise);
  return nextPromise;
}

/**
 * Create a browser session client (GET session / POST refresh with credentials).
 */
export function createBrowserSessionClient(
  options: BrowserSessionClientOptions,
): BrowserSessionClient {
  const sessionPath = options.sessionPath ?? AUTH_BROWSER_SESSION_PATHS.SESSION;
  const refreshPath = options.refreshPath ?? AUTH_BROWSER_SESSION_PATHS.REFRESH;

  return {
    restore: () =>
      dedupeSessionRequest(
        restoreSessionInFlight,
        (value) => {
          restoreSessionInFlight = value;
        },
        () => performBrowserSessionRequest(options, sessionPath, "GET"),
      ),
    refresh: () =>
      dedupeSessionRequest(
        refreshSessionInFlight,
        (value) => {
          refreshSessionInFlight = value;
        },
        () => performBrowserSessionRequest(options, refreshPath, "POST"),
      ),
  };
}

export function sessionRestoreToUserToken(
  result: SessionRestoreSuccess,
): UserSessionTokenResult {
  return {
    token: result.accessToken,
    expiresIn: result.expiresIn,
    expiresAt: result.expiresAt,
  };
}

export type CookieSessionCallbacksOptions = BrowserSessionClientOptions & {
  /** Optional hook after a successful restore/refresh (e.g. app in-memory token store). */
  onAccessToken?: (result: SessionRestoreSuccess) => void | Promise<void>;
};

/**
 * DataClient hooks for cookie-first controller auth.
 */
export function createCookieSessionCallbacks(
  options: CookieSessionCallbacksOptions,
): {
  onSessionRestore: () => Promise<UserSessionTokenResult | null>;
  onTokenRefresh: () => Promise<UserSessionTokenResult | null>;
} {
  const client = createBrowserSessionClient(options);

  const mapResult = async (
    operation: "restore" | "refresh",
  ): Promise<UserSessionTokenResult | null> => {
    const result =
      operation === "restore" ? await client.restore() : await client.refresh();
    if (!result.ok) {
      return null;
    }
    if (options.onAccessToken) {
      await options.onAccessToken(result);
    }
    return sessionRestoreToUserToken(result);
  };

  return {
    onSessionRestore: () => mapResult("restore"),
    onTokenRefresh: () => mapResult("refresh"),
  };
}

export type EnsureBrowserAccessTokenOptions = CookieSessionCallbacksOptions & {
  getAccessToken: () => string | null;
};

/**
 * Hydrate access token from cookie when memory is empty (e.g. after full page load).
 */
export async function ensureBrowserAccessToken(
  options: EnsureBrowserAccessTokenOptions,
): Promise<string | null> {
  const existing = options.getAccessToken();
  if (existing) {
    return existing;
  }

  const client = createBrowserSessionClient(options);
  let result = await client.restore();
  if (!result.ok) {
    result = await client.refresh();
  }
  if (!result.ok) {
    return null;
  }
  if (options.onAccessToken) {
    await options.onAccessToken(result);
  }
  return result.accessToken;
}
