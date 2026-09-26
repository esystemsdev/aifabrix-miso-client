import { MisoClient } from "../miso-client";
import type { MisoClientConfig } from "../types/config.types";
import { registerRuntimeGuard } from "../utils/runtime-guard";
import { abortable } from "./transport";
import { managedRequestPolicy } from "./request-policy";
import {
  BootstrapContext,
  BootstrapError,
  BootstrapSnapshot,
  RuntimeInvalidationReason,
  SecretsRuntime,
} from "./types";

/** Private state is deliberately absent from runtime diagnostics/serialization. */
export class RuntimeState {
  private values: Record<string, string> = Object.create(null);
  private snapshot?: BootstrapSnapshot;
  private rejectedToken?: string;
  private received = 0;
  private monotonic = 0;
  private reason?: RuntimeInvalidationReason;
  private changes = new Set<(keys: readonly string[]) => void>();
  private invalidations = new Set<
    (reason: RuntimeInvalidationReason) => void
  >();
  private controller = new AbortController();
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<void>;
  private nextAttempt = 0;
  private closing?: Promise<void>;
  private context?: Readonly<BootstrapContext>;

  constructor(
    private readonly fetch?: (
      signal: AbortSignal,
      token?: string | null,
    ) => Promise<BootstrapSnapshot>,
  ) {}

  async start(): Promise<void> {
    if (this.fetch) await this.refresh();
  }

  local(values: NodeJS.ProcessEnv): void {
    this.values = Object.fromEntries(
      Object.entries(values).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
  }

  private now(): number {
    return Math.max(
      Date.now(),
      this.received + performance.now() - this.monotonic,
    );
  }

  private assertValid(): void {
    if (
      !this.reason &&
      this.snapshot &&
      this.now() >= Date.parse(this.snapshot.expiresAt) - 30000
    )
      this.invalidate("snapshot-expired");
    if (this.reason) throw new BootstrapError(this.reason);
  }

  async token(): Promise<string | undefined> {
    this.assertValid();
    if (!this.fetch) return undefined;
    if (
      !this.snapshot ||
      this.snapshot.clientToken === this.rejectedToken ||
      this.now() >= Date.parse(this.snapshot.clientTokenExpiresAt) - 30000
    )
      await this.refresh();
    this.assertValid();
    if (
      !this.snapshot ||
      this.snapshot.clientToken === this.rejectedToken ||
      this.now() >= Date.parse(this.snapshot.clientTokenExpiresAt) - 30000
    )
      throw new BootstrapError("unavailable");
    return this.snapshot.clientToken;
  }

  /** Handle only typed bootstrap failures; never replay the failed operation. */
  async response(status: number, data: unknown, token: unknown): Promise<void> {
    if (!this.fetch || this.reason || !token) return;
    if (!data || typeof data !== "object" || Array.isArray(data)) return;
    const code = (data as { code?: unknown }).code;
    if (
      (status === 403 &&
        (code === "bootstrap_identity_disabled" ||
          code === "bootstrap_binding_mismatch")) ||
      (status === 401 && code === "bootstrap_token_invalid")
    ) {
      this.invalidate("authorization-denied");
    } else if (
      status === 401 &&
      code === "bootstrap_token_expired" &&
      token === this.snapshot?.clientToken
    ) {
      this.rejectedToken = this.snapshot.clientToken;
      // Retain the original API failure; later requests obey the refresh cooldown.
      await this.token().catch(() => undefined);
    }
  }

  requestPolicy(controllerUrl: string) {
    return this.fetch ? managedRequestPolicy(controllerUrl) : undefined;
  }

  private async refresh(): Promise<void> {
    this.assertValid();
    if (this.pending) return this.pending;
    if (performance.now() < this.nextAttempt)
      return Promise.reject(new BootstrapError("unavailable"));
    this.nextAttempt = performance.now() + 30000;
    this.pending = this.performRefresh().finally(() => {
      this.pending = undefined;
    });
    return this.pending;
  }

  /** Never recursively refresh to obtain the credential for refresh itself. */
  private refreshAuthorization(): string | null | undefined {
    if (!this.snapshot) return undefined;
    if (
      this.snapshot.clientToken === this.rejectedToken ||
      this.now() >= Date.parse(this.snapshot.clientTokenExpiresAt) - 30000
    )
      return null;
    return this.snapshot.clientToken;
  }

  private async performRefresh(): Promise<void> {
    try {
      const snapshot = await this.fetch!(
        this.controller.signal,
        this.refreshAuthorization(),
      );
      this.assertValid();
      this.accept(snapshot);
    } catch (error) {
      this.handleFailure(error);
      throw error instanceof BootstrapError
        ? error
        : new BootstrapError("unavailable");
    }
  }

  private accept(snapshot: BootstrapSnapshot): void {
    if (
      this.context &&
      Object.keys(this.context).some(
        (key) =>
          this.context![key as keyof BootstrapContext] !==
          snapshot.context[key as keyof BootstrapContext],
      )
    )
      throw new BootstrapError("protocol-error");
    if (this.snapshot && this.snapshot.clientId !== snapshot.clientId)
      throw new BootstrapError("protocol-error");
    const names = new Set([
      ...Object.keys(this.values),
      ...Object.keys(snapshot.configuration),
    ]);
    const changed = [...names].filter(
      (key) => this.values[key] !== snapshot.configuration[key],
    );
    this.snapshot = snapshot;
    this.context = Object.freeze({ ...snapshot.context });
    this.values = { ...snapshot.configuration };
    this.received = Date.now();
    this.monotonic = performance.now();
    this.schedule(
      Math.max(
        1,
        Date.parse(snapshot.refreshAfter) - this.now() - Math.random() * 10000,
      ),
    );
    this.emit(this.changes, Object.freeze(changed));
  }

  private schedule(ms: number): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.refresh().catch(() => undefined);
    }, ms);
    this.timer.unref();
  }

  private handleFailure(error: unknown): void {
    if (
      error instanceof BootstrapError &&
      ["authorization-denied", "protocol-error"].includes(error.code)
    ) {
      this.invalidate(error.code as RuntimeInvalidationReason);
    } else if (!this.reason && this.snapshot) {
      this.schedule(
        Math.min(
          30000,
          Math.max(1, Date.parse(this.snapshot.expiresAt) - 30000 - this.now()),
        ),
      );
    }
  }

  private invalidate(reason: RuntimeInvalidationReason): void {
    if (this.reason === reason || (this.reason && reason !== "closed")) return;
    this.reason = reason;
    this.values = Object.create(null);
    this.snapshot = undefined;
    clearTimeout(this.timer);
    this.controller.abort();
    this.emit(this.invalidations, reason);
  }

  private emit<T>(listeners: Set<(value: T) => void>, value: T): void {
    for (const listener of [...listeners]) {
      try {
        listener(value);
      } catch {
        /* Never expose listener errors or secret values. */
      }
    }
  }

  private subscribe<T>(
    listeners: Set<(value: T) => void>,
    handler: (value: T) => void,
  ): () => void {
    this.assertValid();
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }

  config(url: string): MisoClientConfig {
    this.assertValid();
    if (!this.snapshot) throw new BootstrapError("unavailable");
    return {
      clientId: this.snapshot.clientId,
      controllerUrl: url,
      onClientTokenRefresh: async () => ({
        token: (await this.token())!,
        expiresIn: Math.max(
          1,
          Math.floor(
            (Date.parse(this.snapshot!.clientTokenExpiresAt) -
              30000 -
              this.now()) /
              1000,
          ),
        ),
      }),
    };
  }

  private get(name: string): string | undefined {
    this.assertValid();
    return Object.prototype.hasOwnProperty.call(this.values, name)
      ? this.values[name]
      : undefined;
  }

  runtime(client: MisoClient): SecretsRuntime {
    const runtime = {
      client,
      context: this.context,
      secrets: Object.freeze({
        get: (name: string) => this.get(name),
        require: (name: string) => {
          const value = this.get(name);
          if (!value) throw new BootstrapError("missing-secret");
          return value;
        },
      }),
      onSecretsChanged: (handler: (keys: readonly string[]) => void) =>
        this.subscribe(this.changes, handler),
      onInvalidated: (handler: (reason: RuntimeInvalidationReason) => void) =>
        this.subscribe(this.invalidations, handler),
      close: () => this.close(client),
    };
    Object.defineProperty(runtime, "client", { enumerable: false });
    return Object.freeze(runtime);
  }

  close(client?: MisoClient): Promise<void> {
    if (this.closing) return this.closing;
    this.closing = Promise.resolve()
      .then(() =>
        abortable(
          client?.disconnect() ?? Promise.resolve(),
          AbortSignal.timeout(5000),
        ),
      )
      .catch(() => {
        throw new BootstrapError("cleanup-failed");
      });
    this.invalidate("closed");
    this.changes.clear();
    this.invalidations.clear();
    return this.closing;
  }
}

/** Construct SDK connections only after provider initialization succeeds. */
export async function createRuntime(
  state: RuntimeState,
  config: MisoClientConfig,
): Promise<SecretsRuntime> {
  registerRuntimeGuard(config, {
    token: () => state.token(),
    prepare: state.requestPolicy(config.controllerUrl || ""),
    response: (status, data, token) => state.response(status, data, token),
  });
  const client = new MisoClient(config);
  try {
    await client.initialize();
    return state.runtime(client);
  } catch {
    await state.close(client);
    throw new BootstrapError("initialization-failed");
  }
}
