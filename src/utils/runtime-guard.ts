import type { AxiosRequestConfig } from "axios";
import type { MisoClientConfig } from "../types/config.types";

/** Internal opt-in boundary; ordinary SDK clients have no runtime guard. */
interface RuntimeGuard {
  token(): Promise<string | undefined>;
  prepare?(request: AxiosRequestConfig): void;
  response?(status: number, data: unknown, token: unknown): Promise<void>;
}
const guards = new WeakMap<MisoClientConfig, RuntimeGuard>();
export function registerRuntimeGuard(
  config: MisoClientConfig,
  guard: RuntimeGuard,
): void {
  guards.set(config, guard);
}
export function getRuntimeGuard(
  config: MisoClientConfig,
): RuntimeGuard | undefined {
  return guards.get(config);
}
