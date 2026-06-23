import { UserSessionTokenResult } from "../types/data-client.types";
import { getToken } from "./data-client-auth";
import { isBrowser } from "./data-client-utils";
import { UserTokenRefreshManager } from "./user-token-refresh";
import {
  createSessionRecoveryOrchestrator,
  SessionRecoveryTelemetryEvent,
  SessionRecoveryTrigger,
} from "./session-recovery-orchestration";

interface BrowserLikeWindow {
  addEventListener: (
    type: string,
    listener: (event: Event) => void,
    options?: AddEventListenerOptions,
  ) => void;
  removeEventListener: (type: string, listener: (event: Event) => void) => void;
  window?: BrowserLikeWindow;
}

export interface ActivityRefreshSetupOptions {
  onTokenRefresh?: () => Promise<UserSessionTokenResult | null>;
  onSessionRestore?: () => Promise<UserSessionTokenResult | null>;
  refreshManager: UserTokenRefreshManager;
  persistBrowserSession: (result: UserSessionTokenResult) => void;
  intervalMs: number;
  postRecoveryDedupeMs?: number;
  onTelemetry?: (event: SessionRecoveryTelemetryEvent) => void;
}

const SESSION_REFRESH_ACTIVITY_EVENTS = [
  "mousemove",
  "click",
  "keydown",
] as const;
const DEFAULT_POST_RECOVERY_DEDUPE_MS = 1_500;

export function hydrateBrowserRuntimeTokenState(
  tokenKeys: string[] | undefined,
  refreshManager: UserTokenRefreshManager,
): void {
  if (!isBrowser()) return;
  const accessToken = getToken(tokenKeys);
  if (accessToken) {
    refreshManager.storeAccessToken("browser", accessToken);
  }
}

function resolveBrowserWindow(): BrowserLikeWindow | null {
  const root = (globalThis as { window?: unknown }).window as
    | BrowserLikeWindow
    | undefined;
  if (!root) return null;
  if (typeof root.addEventListener === "function") return root;
  if (root.window && typeof root.window.addEventListener === "function") {
    return root.window;
  }
  return null;
}

function registerTokenRefreshCallback(
  options: ActivityRefreshSetupOptions,
): void {
  if (!options.onTokenRefresh) {
    return;
  }
  options.refreshManager.registerRefreshCallback("browser", async () => {
    return (await options.onTokenRefresh?.()) || null;
  });
}

function createRecoveryRunner(
  options: ActivityRefreshSetupOptions,
): (trigger: SessionRecoveryTrigger) => Promise<boolean> {
  return async (_trigger: SessionRecoveryTrigger): Promise<boolean> => {
    const currentToken = options.refreshManager.getAccessToken("browser");
    if (!currentToken && options.onSessionRestore) {
      const restored = await options.onSessionRestore();
      if (restored?.token) {
        options.persistBrowserSession(restored);
        return true;
      }
      return false;
    }

    const refreshed = await options.refreshManager.refreshIfDue(
      "browser",
      300,
      new Date(),
    );
    if (!refreshed?.token) {
      return false;
    }

    options.persistBrowserSession({
      token: refreshed.token,
      expiresIn: refreshed.expiresIn,
      expiresAt: refreshed.expiresAt,
    });
    return true;
  };
}

function resolveBrowserDocument(): Document | undefined {
  return (globalThis as { document?: Document }).document;
}

export function setupSessionRecoveryOrchestrationListener(
  options: ActivityRefreshSetupOptions,
): (() => void) | null {
  if (!isBrowser() || (!options.onTokenRefresh && !options.onSessionRestore)) {
    return null;
  }
  const browserWindow = resolveBrowserWindow();
  if (!browserWindow) return null;

  registerTokenRefreshCallback(options);
  const runRecovery = createRecoveryRunner(options);

  const orchestrator = createSessionRecoveryOrchestrator({
    cooldownMs: options.intervalMs,
    postRecoveryDedupeMs:
      options.postRecoveryDedupeMs ?? DEFAULT_POST_RECOVERY_DEDUPE_MS,
    executeRecovery: runRecovery,
    onTelemetry: options.onTelemetry,
  });

  const activityHandler = (): void => {
    void orchestrator.triggerRecovery("activity");
  };

  const visibilityHandler = (): void => {
    const currentDocument = (globalThis as { document?: Document }).document;
    if (currentDocument?.visibilityState === "visible") {
      void orchestrator.triggerRecovery("visibilitychange");
    }
  };

  const onlineHandler = (): void => {
    void orchestrator.triggerRecovery("online");
  };

  SESSION_REFRESH_ACTIVITY_EVENTS.forEach((eventName) => {
    browserWindow.addEventListener(eventName, activityHandler, {
      passive: true,
    });
  });
  const currentDocument = resolveBrowserDocument();
  currentDocument?.addEventListener("visibilitychange", visibilityHandler);
  browserWindow.addEventListener("online", onlineHandler);

  const teardown = (): void => {
    SESSION_REFRESH_ACTIVITY_EVENTS.forEach((eventName) => {
      browserWindow.removeEventListener(eventName, activityHandler);
    });
    currentDocument?.removeEventListener("visibilitychange", visibilityHandler);
    browserWindow.removeEventListener("online", onlineHandler);
    options.refreshManager.unregisterRefreshCallback("browser");
    browserWindow.removeEventListener("beforeunload", teardown);
  };
  browserWindow.addEventListener("beforeunload", teardown, { once: true });
  return teardown;
}
