import { BootstrapError, SecretsRuntime } from "./types";
import { createRuntime, RuntimeState } from "./runtime";
import { credentialSettings, credentialSnapshot } from "./credentials";

export type {
  BootstrapContext,
  BootstrapSnapshot,
  SecretsRuntime,
  RuntimeInvalidationReason,
} from "./types";
export { BootstrapError } from "./types";
export { validateSnapshot } from "./validation";

/**
 * Initialize a Node-only secrets runtime using deployment settings.
 * Unset/local mode loads local config; client-credentials mode fetches remote secrets.
 * @returns Initialized client, secret accessors, subscriptions and close operation.
 * @throws BootstrapError for invalid settings, denied access or unavailable snapshots.
 */
export async function initSecrets(): Promise<SecretsRuntime> {
  const mode = process.env.MISO_AUTH_MODE;
  if (mode === undefined || mode === "local") return localRuntime();
  if (mode !== "client-credentials")
    throw new BootstrapError("unknown-auth-mode");
  const settings = credentialSettings();
  const state = new RuntimeState((signal, token) =>
    credentialSnapshot(settings, signal, token),
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
