/** Ordered explicit authentication attempts; token ownership stays in the HTTP client. */
import { AxiosRequestConfig } from "axios";
import { AuthStrategy } from "../types/config.types";
import { AuthStrategyHandler } from "./auth-strategy";
import { diagnosticData } from "./diagnostic-sanitizer";
import { MisoClientError } from "./errors";

/** Clear previous/caller authentication case-insensitively without mutating input. */
export function strategyHeaders(config?: AxiosRequestConfig) {
  const names = [
    "authorization",
    "x-client-id",
    "x-client-secret",
    "x-client-token",
  ];
  return Object.fromEntries(
    Object.entries(config?.headers ?? {}).filter(
      ([name]) => !names.includes(name.toLowerCase()),
    ),
  );
}

function replayable(value: unknown, seen = new WeakSet<object>()): boolean {
  if (!value || typeof value !== "object") return true;
  if (seen.has(value)) return false;
  seen.add(value);
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return true;
  if (
    Object.getPrototypeOf(value) !== Object.prototype &&
    !Array.isArray(value)
  )
    return false;
  return Object.values(value).every((item) => replayable(item, seen));
}

const ordinaryFailures = new WeakSet<object>();
/** Only dispatched ordinary HTTP 401s may advance a strategy (never grant failures). */
export function markOrdinaryAuthFailure(
  error: object,
  status?: number,
  data?: unknown,
): void {
  data = diagnosticData(data);
  const code =
    data && typeof data === "object"
      ? (data as { code?: unknown }).code
      : undefined;
  if (
    status === 401 &&
    !(typeof code === "string" && code.startsWith("bootstrap_"))
  )
    ordinaryFailures.add(error);
}
function canFallback(error: unknown): boolean {
  if (!(error instanceof MisoClientError) || !ordinaryFailures.has(error))
    return false;
  const code = error.errorBody?.code ?? error.errorResponse?.code;
  return typeof code !== "string" || !code.startsWith("bootstrap_");
}

export async function executeAuthStrategy<T>(
  strategy: AuthStrategy,
  data: unknown,
  config: AxiosRequestConfig | undefined,
  attempt: (strategy: AuthStrategy) => Promise<T>,
): Promise<T> {
  const methods = strategy.methods.filter((method) =>
    AuthStrategyHandler.shouldTryMethod(method, strategy),
  );
  if (!methods.length) return attempt({ ...strategy, methods: [] });
  for (let index = 0; index < methods.length; index++) {
    try {
      return await attempt({ ...strategy, methods: [methods[index]] });
    } catch (error) {
      if (
        index === methods.length - 1 ||
        !canFallback(error) ||
        config?.signal?.aborted ||
        config?.cancelToken?.reason ||
        !replayable(data ?? config?.data)
      )
        throw error;
    }
  }
  throw new Error("Authentication strategy exhausted");
}

/** Build one attempt using a token resolved by the existing HTTP/runtime owner. */
export function buildAuthStrategyConfig(
  strategy: AuthStrategy,
  token: string | null,
  config?: AxiosRequestConfig,
): AxiosRequestConfig {
  return {
    ...config,
    headers: {
      ...strategyHeaders(config),
      ...AuthStrategyHandler.buildAuthHeaders(strategy, token),
    },
  };
}
