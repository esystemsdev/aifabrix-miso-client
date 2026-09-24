import {
  BrowserSessionCallbackResult,
  BrowserSessionCallbackFailureReason,
  BrowserSessionLifecycleConfig,
  BrowserSessionRecoveredAuth,
  BrowserSessionRecoveryReason,
  BrowserSessionRecoveryResult,
  BrowserSessionRecoveryTrigger,
  UserSessionTokenResult,
} from "../types/data-client.types";

const DEFAULT_PERIODIC_INTERVAL_MS = 240_000;
const FAILURE_BACKOFF_MS = 30_000;
const MAX_RATE_LIMIT_BACKOFF_MS = 900_000;

interface BrowserEventTarget {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

interface BrowserDocumentTarget extends BrowserEventTarget {
  visibilityState?: string;
}

export interface BrowserSessionLifecycleDependencies {
  now?: () => number;
  setTimer?: (
    callback: () => void,
    delayMs: number,
  ) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  windowTarget?: BrowserEventTarget | null;
  documentTarget?: BrowserDocumentTarget | null;
  persistBearerSession?: (session: UserSessionTokenResult) => void;
}

interface InFlightRecovery {
  promise: Promise<BrowserSessionRecoveryResult>;
  triggers: Set<BrowserSessionRecoveryTrigger>;
}

function suppressedResult(
  trigger: BrowserSessionRecoveryTrigger,
  reason: BrowserSessionRecoveryReason,
): BrowserSessionRecoveryResult {
  return {
    trigger,
    outcome: "suppressed",
    attempted: false,
    recovered: false,
    reason,
  };
}

function isValidStatus(status: number | undefined): boolean {
  return (
    status === undefined ||
    (Number.isInteger(status) && status >= 400 && status <= 599)
  );
}

function isFailureReason(
  reason: unknown,
): reason is BrowserSessionCallbackFailureReason {
  return (
    reason === "unauthorized" ||
    reason === "network" ||
    reason === "rate-limited" ||
    reason === "server" ||
    reason === "invalid" ||
    reason === "unexpected"
  );
}

function normalizeFailureResult(
  result: Extract<BrowserSessionCallbackResult, { ok: false }>,
): BrowserSessionCallbackResult {
  const retryAfterValid =
    result.retryAfterMs === undefined ||
    (result.reason === "rate-limited" &&
      Number.isFinite(result.retryAfterMs) &&
      result.retryAfterMs > 0);
  return isFailureReason(result.reason) &&
    isValidStatus(result.status) &&
    retryAfterValid
    ? result
    : { ok: false, reason: "invalid" };
}

function normalizeSuccessAuth(
  auth: BrowserSessionRecoveredAuth | undefined,
): BrowserSessionCallbackResult {
  if (!auth || typeof auth !== "object") {
    return { ok: false, reason: "invalid" };
  }
  if (auth.kind === "bearer") {
    return auth.session &&
      typeof auth.session.token === "string" &&
      auth.session.token.length > 0
      ? { ok: true, auth }
      : { ok: false, reason: "invalid" };
  }
  if (auth.kind !== "cookie") {
    return { ok: false, reason: "invalid" };
  }
  const expiresInValid =
    auth.expiresIn === undefined ||
    (Number.isFinite(auth.expiresIn) && auth.expiresIn >= 0);
  const expiresAtValid =
    auth.expiresAt === undefined ||
    (typeof auth.expiresAt === "string" &&
      !Number.isNaN(Date.parse(auth.expiresAt)));
  return expiresInValid && expiresAtValid
    ? { ok: true, auth }
    : { ok: false, reason: "invalid" };
}

function normalizeCallbackResult(
  result: BrowserSessionCallbackResult,
): BrowserSessionCallbackResult {
  if (!result || typeof result !== "object" || typeof result.ok !== "boolean") {
    return { ok: false, reason: "invalid" };
  }
  if (!result.ok) {
    return normalizeFailureResult(result);
  }
  return normalizeSuccessAuth(result.auth);
}

function resolveGlobalWindow(): BrowserEventTarget | null {
  const target = (globalThis as { window?: BrowserEventTarget }).window;
  return target && typeof target.addEventListener === "function"
    ? target
    : null;
}

function resolveGlobalDocument(): BrowserDocumentTarget | null {
  const target = (globalThis as { document?: BrowserDocumentTarget }).document;
  return target && typeof target.addEventListener === "function"
    ? target
    : null;
}

export class BrowserSessionLifecycle {
  private readonly config: BrowserSessionLifecycleConfig;
  private readonly intervalMs: number;
  private readonly now: () => number;
  private readonly setTimer: BrowserSessionLifecycleDependencies["setTimer"];
  private readonly clearTimer: BrowserSessionLifecycleDependencies["clearTimer"];
  private readonly windowTarget: BrowserEventTarget | null;
  private readonly documentTarget: BrowserDocumentTarget | null;
  private readonly persistBearerSession?: (
    session: UserSessionTokenResult,
  ) => void;
  private nextDeadlineMs: number;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private dueRecovery: Promise<void> | null = null;
  private inFlight: InFlightRecovery | null = null;
  private failureBackoffUntilMs = 0;
  private rateLimitedUntilMs = 0;
  private disposed = false;
  private disposePromise: Promise<void> | null = null;

  private readonly visibilityHandler = (): void => {
    if (this.documentTarget?.visibilityState === "visible") {
      this.wakeIfOverdue("visibilitychange");
    }
  };

  private readonly onlineHandler = (): void => {
    this.wakeIfOverdue("online");
  };

  constructor(
    config: BrowserSessionLifecycleConfig,
    dependencies: BrowserSessionLifecycleDependencies = {},
  ) {
    if (typeof config.restore !== "function") {
      throw new Error(
        "DataClient configuration error: browserSession.restore must be a function.",
      );
    }
    const intervalMs =
      config.periodicRefreshIntervalMs ?? DEFAULT_PERIODIC_INTERVAL_MS;
    if (
      !Number.isFinite(intervalMs) ||
      !Number.isInteger(intervalMs) ||
      intervalMs <= 0
    ) {
      throw new Error(
        "DataClient configuration error: browserSession.periodicRefreshIntervalMs must be a finite positive integer.",
      );
    }
    this.config = config;
    this.intervalMs = intervalMs;
    this.now = dependencies.now ?? (() => Date.now());
    this.setTimer =
      dependencies.setTimer ??
      ((callback, delayMs) => setTimeout(callback, delayMs));
    this.clearTimer =
      dependencies.clearTimer ?? ((timer) => clearTimeout(timer));
    this.windowTarget = dependencies.windowTarget ?? resolveGlobalWindow();
    this.documentTarget =
      dependencies.documentTarget ?? resolveGlobalDocument();
    this.persistBearerSession = dependencies.persistBearerSession;
    this.nextDeadlineMs = this.now() + this.intervalMs;

    this.windowTarget?.addEventListener("online", this.onlineHandler);
    this.documentTarget?.addEventListener(
      "visibilitychange",
      this.visibilityHandler,
    );
    this.scheduleNextDeadline();
  }

  recover(
    trigger: BrowserSessionRecoveryTrigger,
  ): Promise<BrowserSessionRecoveryResult> {
    if (this.disposed) {
      return Promise.resolve(suppressedResult(trigger, "disposed"));
    }
    const nowMs = this.now();
    if (nowMs < this.rateLimitedUntilMs) {
      return Promise.resolve(suppressedResult(trigger, "rate-limited"));
    }
    if (trigger !== "periodic" && nowMs < this.failureBackoffUntilMs) {
      return Promise.resolve(suppressedResult(trigger, "failure-backoff"));
    }
    if (this.inFlight) {
      this.inFlight.triggers.add(trigger);
      return this.inFlight.promise.then((owner) => ({
        trigger,
        outcome: "coalesced",
        attempted: false,
        recovered: owner.recovered,
        ...(owner.reason ? { reason: owner.reason } : {}),
      }));
    }

    const triggers = new Set<BrowserSessionRecoveryTrigger>([trigger]);
    const promise = this.executeRecovery(trigger, triggers).finally(() => {
      this.inFlight = null;
    });
    this.inFlight = { promise, triggers };
    return promise;
  }

  recordReplayUnauthorized(): void {
    if (!this.disposed) {
      this.failureBackoffUntilMs = this.now() + FAILURE_BACKOFF_MS;
    }
  }

  dispose(): Promise<void> {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true;
    if (this.timer) {
      this.clearTimer?.(this.timer);
      this.timer = null;
    }
    this.windowTarget?.removeEventListener("online", this.onlineHandler);
    this.documentTarget?.removeEventListener(
      "visibilitychange",
      this.visibilityHandler,
    );
    const drain = this.inFlight?.promise;
    this.disposePromise = drain
      ? drain.then(
          () => undefined,
          () => undefined,
        )
      : Promise.resolve();
    return this.disposePromise;
  }

  private async executeRecovery(
    trigger: BrowserSessionRecoveryTrigger,
    triggers: Set<BrowserSessionRecoveryTrigger>,
  ): Promise<BrowserSessionRecoveryResult> {
    const callbackResult = await this.runCallbacks();
    if (!callbackResult) return suppressedResult(trigger, "disposed");
    return callbackResult.ok
      ? this.completeSuccess(trigger, triggers, callbackResult.auth)
      : this.completeFailure(trigger, triggers, callbackResult);
  }

  private async runCallbacks(): Promise<BrowserSessionCallbackResult | null> {
    const restoreResult = await this.invokeCallback(this.config.restore);
    if (this.disposed) return null;
    if (!this.shouldFallback(restoreResult)) return restoreResult;

    try {
      await this.config.clearCachedAuthState?.();
    } catch {
      return { ok: false, reason: "unexpected" };
    }
    if (this.disposed) return null;
    const refresh = this.config.refresh;
    if (!refresh) return restoreResult;
    const refreshResult = await this.invokeCallback(refresh);
    return this.disposed ? null : refreshResult;
  }

  private shouldFallback(result: BrowserSessionCallbackResult): boolean {
    return (
      !result.ok &&
      (result.reason === "unauthorized" || result.reason === "invalid") &&
      typeof this.config.refresh === "function"
    );
  }

  private completeSuccess(
    trigger: BrowserSessionRecoveryTrigger,
    triggers: Set<BrowserSessionRecoveryTrigger>,
    auth: BrowserSessionRecoveredAuth,
  ): BrowserSessionRecoveryResult {
    try {
      if (auth.kind === "bearer") {
        this.persistBearerSession?.(auth.session);
      }
    } catch {
      return this.completeFailure(trigger, triggers, {
        ok: false,
        reason: "unexpected",
      });
    }
    this.failureBackoffUntilMs = 0;
    return {
      trigger,
      outcome: "recovered",
      attempted: true,
      recovered: true,
    };
  }

  private completeFailure(
    trigger: BrowserSessionRecoveryTrigger,
    triggers: Set<BrowserSessionRecoveryTrigger>,
    failure: Extract<BrowserSessionCallbackResult, { ok: false }>,
  ): BrowserSessionRecoveryResult {
    if (failure.reason === "rate-limited") {
      const retryAfterMs = Math.min(
        failure.retryAfterMs ?? FAILURE_BACKOFF_MS,
        MAX_RATE_LIMIT_BACKOFF_MS,
      );
      this.rateLimitedUntilMs = this.now() + retryAfterMs;
    } else if (triggers.has("unauthorized")) {
      this.failureBackoffUntilMs = this.now() + FAILURE_BACKOFF_MS;
    }
    return {
      trigger,
      outcome: "failed",
      attempted: true,
      recovered: false,
      reason: failure.reason,
    };
  }

  private async invokeCallback(
    callback: () => Promise<BrowserSessionCallbackResult>,
  ): Promise<BrowserSessionCallbackResult> {
    try {
      return normalizeCallbackResult(await callback());
    } catch {
      return { ok: false, reason: "unexpected" };
    }
  }

  private wakeIfOverdue(trigger: "visibilitychange" | "online"): void {
    if (!this.disposed && this.now() >= this.nextDeadlineMs) {
      this.runDueRecovery(trigger);
    }
  }

  private runDueRecovery(
    trigger: "periodic" | "visibilitychange" | "online",
  ): void {
    if (this.disposed || this.dueRecovery) return;
    if (this.timer) {
      this.clearTimer?.(this.timer);
      this.timer = null;
    }
    this.dueRecovery = this.recover(trigger)
      .then(() => undefined)
      .finally(() => {
        this.advanceDeadline();
        this.dueRecovery = null;
        this.scheduleNextDeadline();
      });
  }

  private advanceDeadline(): void {
    const nowMs = this.now();
    do {
      this.nextDeadlineMs += this.intervalMs;
    } while (this.nextDeadlineMs <= nowMs);
  }

  private scheduleNextDeadline(): void {
    if (this.disposed) return;
    const delayMs = Math.max(0, this.nextDeadlineMs - this.now());
    this.timer =
      this.setTimer?.(() => {
        this.timer = null;
        this.runDueRecovery("periodic");
      }, delayMs) ?? null;
    if (this.timer && typeof this.timer.unref === "function") {
      this.timer.unref();
    }
  }
}

export function disabledBrowserSessionRecoveryResult(
  trigger: "unauthorized" | "manual",
): BrowserSessionRecoveryResult {
  return suppressedResult(trigger, "disabled");
}
