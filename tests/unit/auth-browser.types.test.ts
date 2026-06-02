import {
  AUTH_BROWSER_SESSION_PATHS,
  AUTH_CONTROLLER_PATHS,
} from "../../src/types/auth-browser.types";

describe("auth-browser.types", () => {
  it("exposes controller auth paths under /api/v1/auth", () => {
    expect(AUTH_CONTROLLER_PATHS.SESSION).toBe("/api/v1/auth/session");
    expect(AUTH_CONTROLLER_PATHS.REFRESH).toBe("/api/v1/auth/refresh");
    expect(AUTH_CONTROLLER_PATHS.LOGIN).toBe("/api/v1/auth/login");
    expect(AUTH_CONTROLLER_PATHS.CALLBACK).toBe("/api/v1/auth/callback");
    expect(AUTH_CONTROLLER_PATHS.LOGOUT).toBe("/api/v1/auth/logout");
    expect(AUTH_CONTROLLER_PATHS.CLIENT_TOKEN).toBe(
      "/api/v1/auth/client-token",
    );
  });

  it("keeps browser session paths aligned with controller paths", () => {
    expect(AUTH_BROWSER_SESSION_PATHS.SESSION).toBe(
      AUTH_CONTROLLER_PATHS.SESSION,
    );
    expect(AUTH_BROWSER_SESSION_PATHS.REFRESH).toBe(
      AUTH_CONTROLLER_PATHS.REFRESH,
    );
  });
});
