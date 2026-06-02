/**
 * Orchestrated browser session recovery (refresh → restore → stale cleanup → retry).
 */
import type { UserSessionTokenResult } from "../types/data-client.types";
import type {
  BrowserSessionClient,
  SessionRestoreResult,
  SessionRestoreSuccess,
} from "../types/browser-session.types";
import { isStaleBrowserSessionFailure } from "./auth-browser-errors";
import { sessionRestoreToUserToken } from "./browser-session";

export type RecoverBrowserSessionOptions = {
  client: BrowserSessionClient;
  clearStaleState?: () => void | Promise<void>;
};

export function resolveSessionExpiresInSeconds(
  result: SessionRestoreSuccess,
): number {
  if (
    typeof result.expiresIn === "number" &&
    Number.isFinite(result.expiresIn)
  ) {
    return result.expiresIn;
  }
  if (result.expiresAt) {
    return Math.max(
      Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000),
      0,
    );
  }
  return 0;
}

/**
 * Cookie-first silent recovery policy shared by dataplane and DataClient hooks.
 */
export async function recoverBrowserSessionWithStaleCleanup(
  options: RecoverBrowserSessionOptions,
): Promise<SessionRestoreResult> {
  let result = await options.client.refresh();
  if (!result.ok) {
    result = await options.client.restore();
  }

  if (isStaleBrowserSessionFailure(result) && options.clearStaleState) {
    await options.clearStaleState();
    result = await options.client.refresh();
    if (!result.ok) {
      result = await options.client.restore();
    }
  }

  return result;
}

/**
 * Same as {@link recoverBrowserSessionWithStaleCleanup} mapped to DataClient token shape.
 */
export async function recoverBrowserSessionToUserToken(
  options: RecoverBrowserSessionOptions,
): Promise<UserSessionTokenResult | null> {
  const result = await recoverBrowserSessionWithStaleCleanup(options);
  if (!result.ok) {
    return null;
  }
  return sessionRestoreToUserToken(result);
}

/**
 * Silent recovery for request retry (throws when recovery fails).
 */
export async function recoverBrowserSessionOrThrow(
  options: RecoverBrowserSessionOptions,
): Promise<{ token: string; expiresIn: number }> {
  const result = await recoverBrowserSessionWithStaleCleanup(options);
  if (!result.ok) {
    throw new Error("Silent browser re-auth failed");
  }
  return {
    token: result.accessToken,
    expiresIn: resolveSessionExpiresInSeconds(result),
  };
}
