import { AttemptRequestParams } from "./data-client-request.types";

const authRecoveryInFlightByConfig = new WeakMap<object, Promise<boolean>>();

async function runRestoreThenRefresh(
  params: AttemptRequestParams,
): Promise<boolean> {
  const canRestore =
    params.config.preferCookieSessionRestore !== false &&
    params.config.onSessionRestore &&
    params.restoreUserSession;
  if (canRestore) {
    const restoreResult = await params.restoreUserSession();
    if (restoreResult?.token) {
      return true;
    }
  }

  const canRefresh = params.config.onTokenRefresh && params.refreshUserToken;
  if (canRefresh) {
    const refreshResult = await params.refreshUserToken();
    if (refreshResult?.token) {
      return true;
    }
  }

  return false;
}

export async function runSingleFlightAuthRecovery(
  params: AttemptRequestParams,
): Promise<boolean> {
  const configKey = params.config as object;
  const inFlight = authRecoveryInFlightByConfig.get(configKey);
  if (inFlight) {
    return inFlight;
  }

  const nextRecovery = runRestoreThenRefresh(params).finally(() => {
    authRecoveryInFlightByConfig.delete(configKey);
  });
  authRecoveryInFlightByConfig.set(configKey, nextRecovery);
  return nextRecovery;
}
