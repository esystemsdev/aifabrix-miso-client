import { AUTH_BROWSER_SESSION_PATHS } from "../../src/types/browser-session.types";
import {
  createBrowserSessionClient,
  createCookieSessionCallbacks,
  sessionRestoreToUserToken,
} from "../../src/utils/browser-session";

describe("browser-session utilities", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("exports controller session paths", () => {
    expect(AUTH_BROWSER_SESSION_PATHS.SESSION).toBe("/api/v1/auth/session");
    expect(AUTH_BROWSER_SESSION_PATHS.REFRESH).toBe("/api/v1/auth/refresh");
  });

  it("restores session with credentials and nested data payload", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            accessToken: "access-1",
            expiresIn: 300,
            user: { id: "u1" },
          },
        }),
    } as Response);

    const client = createBrowserSessionClient({
      getBaseUrl: () => "http://localhost:3600",
    });

    const result = await client.restore();

    expect(result).toEqual({
      ok: true,
      accessToken: "access-1",
      expiresIn: 300,
      expiresAt: expect.any(String),
      user: { id: "u1" },
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3600/api/v1/auth/session",
      expect.objectContaining({
        method: "GET",
        credentials: "include",
      }),
    );
  });

  it("maps unauthorized failures", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: "Unauthorized" }),
    } as Response);

    const client = createBrowserSessionClient({
      getBaseUrl: () => "http://localhost:3600",
      retryDelaysMs: [],
    });

    const result = await client.refresh();

    expect(result).toEqual({
      ok: false,
      status: 401,
      reason: "unauthorized",
      message: "Unauthorized",
    });
  });

  it("refresh request uses cookie credentials with no JSON body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          data: {
            accessToken: "access-from-refresh",
            expiresIn: 180,
          },
        }),
    } as Response);

    const client = createBrowserSessionClient({
      getBaseUrl: () => "http://localhost:3600",
      retryDelaysMs: [],
    });

    const result = await client.refresh();

    expect(result).toEqual({
      ok: true,
      accessToken: "access-from-refresh",
      expiresIn: 180,
      expiresAt: expect.any(String),
      user: undefined,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:3600/api/v1/auth/refresh",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
      }),
    );
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init as RequestInit).body).toBeUndefined();
  });

  it("createCookieSessionCallbacks returns null when session fails", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ detail: "Unauthorized" }),
    } as Response);

    const callbacks = createCookieSessionCallbacks({
      getBaseUrl: () => "http://localhost:3600",
      retryDelaysMs: [],
    });

    await expect(callbacks.onSessionRestore()).resolves.toBeNull();
  });

  it("sessionRestoreToUserToken maps access token fields", () => {
    expect(
      sessionRestoreToUserToken({
        ok: true,
        accessToken: "t1",
        expiresIn: 120,
        expiresAt: "2026-06-03T12:00:00.000Z",
      }),
    ).toEqual({
      token: "t1",
      expiresIn: 120,
      expiresAt: "2026-06-03T12:00:00.000Z",
    });
  });
});
