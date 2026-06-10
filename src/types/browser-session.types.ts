/**
 * Cookie-first browser session types (controller HttpOnly refresh cookie).
 */

export {
  AUTH_BROWSER_SESSION_PATHS,
  AUTH_CONTROLLER_PATHS,
} from "./auth-browser.types";
export type { AuthControllerPath } from "./auth-browser.types";
import type { AuthControllerPath } from "./auth-browser.types";

export type BrowserSessionPath = AuthControllerPath;

export type SessionRestoreFailureReason =
  | "unauthorized"
  | "network"
  | "server"
  | "invalid";

export type SessionRestoreSuccess = {
  ok: true;
  accessToken: string;
  expiresAt?: string;
  expiresIn?: number;
  user?: Record<string, unknown>;
};

export type SessionRestoreFailure = {
  ok: false;
  status?: number;
  reason: SessionRestoreFailureReason;
  message?: string;
};

export type SessionRestoreResult =
  | SessionRestoreSuccess
  | SessionRestoreFailure;

export type BrowserSessionClientOptions = {
  /** Resolves controller public base URL (no trailing slash). */
  getBaseUrl: () => string;
  sessionPath?: string;
  refreshPath?: string;
  timeoutMs?: number;
  retryDelaysMs?: number[];
};

export type BrowserSessionClient = {
  restore: () => Promise<SessionRestoreResult>;
  refresh: () => Promise<SessionRestoreResult>;
};
