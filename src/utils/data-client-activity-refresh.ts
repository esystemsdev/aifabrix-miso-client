import { UserSessionTokenResult } from "../types/data-client.types";
import { getToken } from "./data-client-auth";
import { getLocalStorage, isBrowser } from "./data-client-utils";
import { UserTokenRefreshManager } from "./user-token-refresh";

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
  refreshManager: UserTokenRefreshManager;
  persistBrowserSession: (result: UserSessionTokenResult) => void;
  intervalMs: number;
}

export function hydrateBrowserRuntimeTokenState(
  tokenKeys: string[] | undefined,
  refreshManager: UserTokenRefreshManager,
): void {
  if (!isBrowser()) return;
  const accessToken = getToken(tokenKeys);
  if (accessToken) {
    refreshManager.storeAccessToken(
      "browser",
      accessToken,
      getLocalStorage("miso_token_expires_at") || undefined,
    );
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

export function setupActivityDrivenRefreshListener(
  options: ActivityRefreshSetupOptions,
): (() => void) | null {
  if (!isBrowser() || !options.onTokenRefresh) return null;
  const browserWindow = resolveBrowserWindow();
  if (!browserWindow) return null;

  options.refreshManager.registerRefreshCallback("browser", async () => {
    return (await options.onTokenRefresh?.()) || null;
  });

  let lastCheckMs = 0;
  const runRefreshCheck = async (): Promise<void> => {
    const nowMs = Date.now();
    if (nowMs - lastCheckMs < options.intervalMs) return;
    lastCheckMs = nowMs;
    const refreshed = await options.refreshManager.refreshIfDue(
      "browser",
      300,
      new Date(nowMs),
    );
    if (refreshed?.token) {
      options.persistBrowserSession({
        token: refreshed.token,
        expiresIn: refreshed.expiresIn,
        expiresAt: refreshed.expiresAt,
      });
    }
  };

  const activityHandler = (): void => {
    void runRefreshCheck();
  };
  const activityEvents = ["mousemove", "click", "keydown"];
  activityEvents.forEach((eventName) => {
    browserWindow.addEventListener(eventName, activityHandler, {
      passive: true,
    });
  });

  const teardown = (): void => {
    activityEvents.forEach((eventName) => {
      browserWindow.removeEventListener(eventName, activityHandler);
    });
    options.refreshManager.unregisterRefreshCallback("browser");
    browserWindow.removeEventListener("beforeunload", teardown);
  };
  browserWindow.addEventListener("beforeunload", teardown, { once: true });
  return teardown;
}
