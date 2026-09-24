import { getToken } from "./data-client-auth";
import { isBrowser } from "./data-client-utils";
import { UserTokenRefreshManager } from "./user-token-refresh";

export function hydrateBrowserRuntimeTokenState(
  tokenKeys: string[] | undefined,
  refreshManager: UserTokenRefreshManager,
): void {
  if (!isBrowser()) return;
  const accessToken = getToken(tokenKeys);
  if (accessToken) {
    refreshManager.storeAccessToken("browser", accessToken);
  }
}
