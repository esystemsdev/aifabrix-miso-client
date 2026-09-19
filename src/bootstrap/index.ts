import { BootstrapError, InitSecretsOptions, SecretsRuntime } from "./types";
import { createRuntime, RuntimeState } from "./runtime";
import { azureSettings, fetchSnapshot } from "./transport";

export type {
  BootstrapContext,
  BootstrapTokenProvider,
  InitSecretsOptions,
  SecretsRuntime,
  RuntimeInvalidationReason,
} from "./types";
export { BootstrapError } from "./types";

/**
 * Initialize one Node-only secrets runtime. Unset/local mode uses existing config
 * and never imports Azure Identity or contacts the broker. Azure mode is explicit.
 * @param options Optional caller-owned identity provider for controlled hosts/tests.
 * @returns Initialized client, secret accessors, subscriptions and close operation.
 */
export async function initSecrets(
  options: InitSecretsOptions = {},
): Promise<SecretsRuntime> {
  const mode = process.env.MISO_AUTH_MODE;
  if (mode === undefined || mode === "local") return localRuntime();
  if (mode !== "azure-managed-identity")
    throw new BootstrapError("unknown-auth-mode");
  const settings = azureSettings();
  const provider =
    options.tokenProvider ??
    (await (await import("./identity.js")).createIdentityProvider());
  const state = new RuntimeState((signal) =>
    fetchSnapshot(provider, settings, signal),
  );
  try {
    await state.start();
    return await createRuntime(state, state.config(settings.controllerUrl));
  } catch (error) {
    await state.close();
    throw error instanceof BootstrapError
      ? error
      : new BootstrapError("initialization-failed");
  }
}

async function localRuntime(): Promise<SecretsRuntime> {
  const state = new RuntimeState();
  try {
    const { loadConfig } = await import("../utils/config-loader.js");
    const config = loadConfig();
    state.local(process.env);
    return await createRuntime(state, config);
  } catch {
    await state.close();
    throw new BootstrapError("local-configuration");
  }
}
