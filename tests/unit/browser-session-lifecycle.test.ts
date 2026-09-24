import {
  BrowserSessionLifecycle,
  BrowserSessionLifecycleDependencies,
} from "../../src/utils/browser-session-lifecycle";
import { BrowserSessionCallbackResult } from "../../src/types/data-client.types";

class EventTargetStub {
  visibilityState = "visible";
  private readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: string): void {
    this.listeners.get(type)?.forEach((listener) => listener());
  }

  count(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function bearer(token = "recovered"): BrowserSessionCallbackResult {
  return { ok: true, auth: { kind: "bearer", session: { token } } };
}

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function noScheduleDependencies(
  overrides: BrowserSessionLifecycleDependencies = {},
): BrowserSessionLifecycleDependencies {
  return {
    setTimer: () => ({ unref: jest.fn() }) as unknown as NodeJS.Timeout,
    clearTimer: jest.fn(),
    windowTarget: null,
    documentTarget: null,
    ...overrides,
  };
}

describe("BrowserSessionLifecycle", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts at the four-minute deadline without bootstrap recovery", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const restore = jest.fn().mockResolvedValue(bearer());
    const lifecycle = new BrowserSessionLifecycle({ restore });

    expect(restore).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(239_999);
    expect(restore).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(restore).toHaveBeenCalledTimes(1);
    await lifecycle.dispose();
  });

  it("stays within four scheduled recoveries and eight callback attempts", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(0);
    const restore = jest.fn().mockResolvedValue({
      ok: false,
      reason: "unauthorized",
      status: 401,
    });
    const refresh = jest.fn().mockResolvedValue(bearer());
    const lifecycle = new BrowserSessionLifecycle({ restore, refresh });

    await jest.advanceTimersByTimeAsync(16 * 60_000);
    expect(restore).toHaveBeenCalledTimes(4);
    expect(refresh).toHaveBeenCalledTimes(4);
    await lifecycle.dispose();
  });

  it("coalesces simultaneous triggers and preserves waiter trigger metadata", async () => {
    const pending = deferred<BrowserSessionCallbackResult>();
    const restore = jest.fn(() => pending.promise);
    const lifecycle = new BrowserSessionLifecycle(
      { restore },
      noScheduleDependencies(),
    );

    const owner = lifecycle.recover("manual");
    const waiter = lifecycle.recover("unauthorized");
    pending.resolve(bearer());

    await expect(owner).resolves.toEqual({
      trigger: "manual",
      outcome: "recovered",
      attempted: true,
      recovered: true,
    });
    await expect(waiter).resolves.toEqual({
      trigger: "unauthorized",
      outcome: "coalesced",
      attempted: false,
      recovered: true,
    });
    expect(restore).toHaveBeenCalledTimes(1);
  });

  it("coalesces unauthorized recovery with a periodic owner during failure backoff", async () => {
    const periodicResult = deferred<BrowserSessionCallbackResult>();
    let callCount = 0;
    const restore = jest.fn((): Promise<BrowserSessionCallbackResult> => {
      callCount += 1;
      return callCount === 1
        ? Promise.resolve({ ok: false, reason: "network" })
        : periodicResult.promise;
    });
    const lifecycle = new BrowserSessionLifecycle(
      { restore },
      noScheduleDependencies({ now: () => 1_000 }),
    );

    await expect(lifecycle.recover("unauthorized")).resolves.toMatchObject({
      outcome: "failed",
      reason: "network",
    });

    const owner = lifecycle.recover("periodic");
    const waiter = lifecycle.recover("unauthorized");
    periodicResult.resolve(bearer("periodic-token"));

    await expect(owner).resolves.toEqual({
      trigger: "periodic",
      outcome: "recovered",
      attempted: true,
      recovered: true,
    });
    await expect(waiter).resolves.toEqual({
      trigger: "unauthorized",
      outcome: "coalesced",
      attempted: false,
      recovered: true,
    });
    expect(restore).toHaveBeenCalledTimes(2);

    await lifecycle.dispose();
  });

  it("coalesces with a failed periodic owner during failure backoff", async () => {
    const periodicResult = deferred<BrowserSessionCallbackResult>();
    let callCount = 0;
    const restore = jest.fn((): Promise<BrowserSessionCallbackResult> => {
      callCount += 1;
      return callCount === 1
        ? Promise.resolve({ ok: false, reason: "network" })
        : periodicResult.promise;
    });
    const lifecycle = new BrowserSessionLifecycle(
      { restore },
      noScheduleDependencies({ now: () => 1_000 }),
    );

    await lifecycle.recover("unauthorized");
    const owner = lifecycle.recover("periodic");
    const waiter = lifecycle.recover("manual");
    periodicResult.resolve({ ok: false, reason: "server", status: 503 });

    await expect(owner).resolves.toEqual({
      trigger: "periodic",
      outcome: "failed",
      attempted: true,
      recovered: false,
      reason: "server",
    });
    await expect(waiter).resolves.toEqual({
      trigger: "manual",
      outcome: "coalesced",
      attempted: false,
      recovered: false,
      reason: "server",
    });
    expect(restore).toHaveBeenCalledTimes(2);

    await lifecycle.dispose();
  });

  it("falls back only for unauthorized or invalid restore failures", async () => {
    const refresh = jest.fn().mockResolvedValue(bearer("refreshed"));
    const clearCachedAuthState = jest.fn();
    const lifecycle = new BrowserSessionLifecycle(
      {
        restore: jest.fn().mockResolvedValue({
          ok: false,
          reason: "unauthorized",
          status: 401,
        }),
        refresh,
        clearCachedAuthState,
      },
      noScheduleDependencies(),
    );

    await expect(lifecycle.recover("unauthorized")).resolves.toMatchObject({
      recovered: true,
    });
    expect(clearCachedAuthState).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);

    const networkRefresh = jest.fn();
    const networkLifecycle = new BrowserSessionLifecycle(
      {
        restore: jest.fn().mockResolvedValue({ ok: false, reason: "network" }),
        refresh: networkRefresh,
      },
      noScheduleDependencies(),
    );
    await expect(networkLifecycle.recover("manual")).resolves.toMatchObject({
      recovered: false,
      reason: "network",
    });
    expect(networkRefresh).not.toHaveBeenCalled();
  });

  it("normalizes thrown and malformed callback results", async () => {
    const thrown = new BrowserSessionLifecycle(
      { restore: jest.fn().mockRejectedValue(new Error("secret detail")) },
      noScheduleDependencies(),
    );
    await expect(thrown.recover("manual")).resolves.toMatchObject({
      outcome: "failed",
      reason: "unexpected",
    });

    const malformed = new BrowserSessionLifecycle(
      {
        restore: jest.fn().mockResolvedValue({
          ok: true,
          auth: { kind: "bearer", session: { token: "" } },
        }),
      },
      noScheduleDependencies(),
    );
    await expect(malformed.recover("manual")).resolves.toMatchObject({
      outcome: "failed",
      reason: "invalid",
    });
  });

  it("does not suppress unauthorized recovery after scheduled success", async () => {
    const restore = jest.fn().mockResolvedValue(bearer());
    const lifecycle = new BrowserSessionLifecycle(
      { restore },
      noScheduleDependencies(),
    );

    await lifecycle.recover("periodic");
    await expect(lifecycle.recover("unauthorized")).resolves.toMatchObject({
      recovered: true,
      attempted: true,
    });
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it("applies failed-unauthorized backoff and replay feedback", async () => {
    let now = 1_000;
    const restore = jest
      .fn()
      .mockResolvedValue({ ok: false, reason: "network" });
    const lifecycle = new BrowserSessionLifecycle(
      { restore },
      noScheduleDependencies({ now: () => now }),
    );

    await lifecycle.recover("unauthorized");
    await expect(lifecycle.recover("unauthorized")).resolves.toMatchObject({
      outcome: "suppressed",
      reason: "failure-backoff",
    });
    now += 30_000;
    await lifecycle.recover("unauthorized");
    expect(restore).toHaveBeenCalledTimes(2);

    now += 30_000;
    restore.mockResolvedValueOnce(bearer());
    await lifecycle.recover("unauthorized");
    lifecycle.recordReplayUnauthorized();
    await expect(lifecycle.recover("unauthorized")).resolves.toMatchObject({
      outcome: "suppressed",
      reason: "failure-backoff",
    });
  });

  it("honors and caps rate-limit suppression", async () => {
    let now = 0;
    const restore = jest.fn().mockResolvedValue({
      ok: false,
      reason: "rate-limited",
      status: 429,
      retryAfterMs: 2_000_000,
    });
    const lifecycle = new BrowserSessionLifecycle(
      { restore },
      noScheduleDependencies({ now: () => now }),
    );

    await lifecycle.recover("manual");
    now = 899_999;
    await expect(lifecycle.recover("manual")).resolves.toMatchObject({
      reason: "rate-limited",
      attempted: false,
    });
    now = 900_000;
    await lifecycle.recover("manual");
    expect(restore).toHaveBeenCalledTimes(2);
  });

  it("uses visibility and online only for one overdue catch-up", async () => {
    let now = 0;
    const windowTarget = new EventTargetStub();
    const documentTarget = new EventTargetStub();
    const restore = jest.fn().mockResolvedValue(bearer());
    const lifecycle = new BrowserSessionLifecycle(
      { restore, periodicRefreshIntervalMs: 1_000 },
      noScheduleDependencies({
        now: () => now,
        windowTarget,
        documentTarget,
      }),
    );

    windowTarget.dispatch("online");
    documentTarget.dispatch("visibilitychange");
    expect(restore).not.toHaveBeenCalled();
    expect(windowTarget.count("mousemove")).toBe(0);
    expect(windowTarget.count("click")).toBe(0);
    expect(windowTarget.count("keydown")).toBe(0);

    now = 5_000;
    windowTarget.dispatch("online");
    documentTarget.dispatch("visibilitychange");
    await Promise.resolve();
    await Promise.resolve();
    expect(restore).toHaveBeenCalledTimes(1);
    await lifecycle.dispose();
    expect(windowTarget.count("online")).toBe(0);
    expect(documentTarget.count("visibilitychange")).toBe(0);
  });

  it("marks disposal terminal synchronously and drains without late commit", async () => {
    const pending = deferred<BrowserSessionCallbackResult>();
    const persistBearerSession = jest.fn();
    const refresh = jest.fn();
    const lifecycle = new BrowserSessionLifecycle(
      {
        restore: () => pending.promise,
        refresh,
      },
      noScheduleDependencies({ persistBearerSession }),
    );

    const recovery = lifecycle.recover("manual");
    const firstDispose = lifecycle.dispose();
    const secondDispose = lifecycle.dispose();
    expect(firstDispose).toBe(secondDispose);
    await expect(lifecycle.recover("manual")).resolves.toMatchObject({
      reason: "disposed",
      attempted: false,
    });

    pending.resolve(bearer());
    await expect(firstDispose).resolves.toBeUndefined();
    await expect(recovery).resolves.toMatchObject({
      reason: "disposed",
      recovered: false,
    });
    expect(persistBearerSession).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects invalid periodic intervals", () => {
    expect(
      () =>
        new BrowserSessionLifecycle(
          { restore: jest.fn(), periodicRefreshIntervalMs: 0 },
          noScheduleDependencies(),
        ),
    ).toThrow("must be a finite positive integer");
  });

  it("rejects a missing restore callback at runtime", () => {
    expect(
      () =>
        new BrowserSessionLifecycle(
          { restore: undefined } as never,
          noScheduleDependencies(),
        ),
    ).toThrow("browserSession.restore must be a function");
  });
});
