import type { MisoClient } from "../miso-client";

/** Server-assigned application context. Local mode has no trusted context. */
export interface BootstrapContext {
  readonly installationId: string;
  readonly applicationId: string;
  readonly environmentId: string;
}

export type RuntimeInvalidationReason =
  "authorization-denied" | "snapshot-expired" | "protocol-error" | "closed";

/** Injectable identity source; the caller retains ownership. */
export interface BootstrapTokenProvider {
  getToken(
    scope: string,
    abortSignal: AbortSignal,
  ): Promise<{
    token: string;
    expiresAt: Date;
  }>;
}

/** Production callers normally use deployment settings and no options. */
export interface InitSecretsOptions {
  tokenProvider?: BootstrapTokenProvider;
}

/** One initialized application runtime. Values must never be logged or serialized. */
export interface SecretsRuntime {
  readonly client: MisoClient;
  readonly context: Readonly<BootstrapContext> | undefined;
  readonly secrets: {
    require(name: string): string;
    get(name: string): string | undefined;
  };
  onSecretsChanged(handler: (keys: readonly string[]) => void): () => void;
  onInvalidated(
    handler: (reason: RuntimeInvalidationReason) => void,
  ): () => void;
  close(): Promise<void>;
}

export interface BootstrapSnapshot {
  protocolVersion: 1;
  issuedAt: string;
  context: BootstrapContext;
  clientId: string;
  clientToken: string;
  clientTokenExpiresAt: string;
  configuration: Record<string, string>;
  refreshAfter: string;
  expiresAt: string;
}

/** Fixed messages prevent transport/identity errors from exposing credentials. */
export class BootstrapError extends Error {
  constructor(public readonly code: string) {
    super(`Miso initialization failed (${code})`);
    this.name = "BootstrapError";
  }
}
