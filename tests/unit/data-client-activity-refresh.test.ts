import {
  setupSessionRecoveryOrchestrationListener,
  ActivityRefreshSetupOptions,
} from "../../src/utils/data-client-activity-refresh";
import { UserTokenRefreshManager } from "../../src/utils/user-token-refresh";

type Listener = (event: Event) => void;

describe("data-client-activity-refresh", () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  const originalDocument = (globalThis as { document?: unknown }).document;
  const originalLocalStorage = (globalThis as { localStorage?: unknown })
    .localStorage;
  const originalFetch = (globalThis as { fetch?: unknown }).fetch;

  let listeners: Record<string, Listener | undefined>;
  let mockWindow: {
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
  };
  let mockDocument: {
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
    visibilityState: "visible" | "hidden";
  };

  beforeEach(() => {
    listeners = {};
    mockWindow = {
      addEventListener: jest.fn((eventName: string, handler: Listener) => {
        listeners[eventName] = handler;
      }),
      removeEventListener: jest.fn(),
    };
    mockDocument = {
      addEventListener: jest.fn((eventName: string, handler: Listener) => {
        listeners[eventName] = handler;
      }),
      removeEventListener: jest.fn(),
      visibilityState: "visible",
    };

    (globalThis as { window?: unknown }).window = mockWindow;
    (globalThis as { document?: unknown }).document = mockDocument;
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };
    (globalThis as { fetch?: unknown }).fetch = jest.fn();
  });

  afterEach(() => {
    (globalThis as { window?: unknown }).window = originalWindow;
    (globalThis as { document?: unknown }).document = originalDocument;
    (globalThis as { localStorage?: unknown }).localStorage =
      originalLocalStorage;
    (globalThis as { fetch?: unknown }).fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function setup(options: Partial<ActivityRefreshSetupOptions>) {
    const refreshManager =
      options.refreshManager ?? new UserTokenRefreshManager();
    return setupSessionRecoveryOrchestrationListener({
      refreshManager,
      persistBrowserSession: jest.fn(),
      intervalMs: 60_000,
      ...options,
    });
  }

  it("wires visibility and online triggers in addition to activity", () => {
    const teardown = setup({
      onTokenRefresh: jest.fn().mockResolvedValue(null),
    });

    expect(typeof listeners.mousemove).toBe("function");
    expect(typeof listeners.click).toBe("function");
    expect(typeof listeners.keydown).toBe("function");
    expect(typeof listeners.visibilitychange).toBe("function");
    expect(typeof listeners.online).toBe("function");

    teardown?.();
  });

  it("uses onSessionRestore when browser token is missing", async () => {
    const onSessionRestore = jest.fn().mockResolvedValue({
      token: "restored-token",
      expiresIn: 3600,
    });
    const persistBrowserSession = jest.fn();
    const refreshManager = new UserTokenRefreshManager();

    setupSessionRecoveryOrchestrationListener({
      refreshManager,
      persistBrowserSession,
      intervalMs: 60_000,
      onSessionRestore,
    });

    listeners.mousemove?.(new Event("mousemove"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onSessionRestore).toHaveBeenCalledTimes(1);
    expect(persistBrowserSession).toHaveBeenCalledWith({
      token: "restored-token",
      expiresIn: 3600,
    });
  });
});
