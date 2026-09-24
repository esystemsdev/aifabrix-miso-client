import { DataClient } from "../../src/utils/data-client";
import { BrowserSessionCallbackResult } from "../../src/types/data-client.types";
import { clearCachedBrowserAuthState } from "../../src/utils/data-client-auth";

function createClient(
  restore: () => Promise<BrowserSessionCallbackResult>,
): DataClient {
  return new DataClient({
    baseUrl: "https://api.example.com",
    misoConfig: {
      controllerUrl: "https://controller.example.com",
      clientId: "client",
    },
    audit: { enabled: false },
    retry: { enabled: false, maxRetries: 0 },
    browserSession: {
      restore,
      periodicRefreshIntervalMs: 240_000,
    },
  });
}

describe("DataClient browser-session public lifecycle", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exposes manual recovery with cookie success", async () => {
    const client = createClient(async () => ({
      ok: true,
      auth: { kind: "cookie", expiresIn: 300 },
    }));

    await expect(client.recoverBrowserSession("manual")).resolves.toEqual({
      trigger: "manual",
      outcome: "recovered",
      attempted: true,
      recovered: true,
    });
    await client.dispose();
  });

  it("reports disposed even when lifecycle configuration was absent", async () => {
    const client = new DataClient({
      baseUrl: "https://api.example.com",
      misoConfig: {
        controllerUrl: "https://controller.example.com",
        clientId: "client",
      },
    });

    await client.dispose();
    await expect(client.recoverBrowserSession("manual")).resolves.toMatchObject(
      {
        reason: "disposed",
        attempted: false,
      },
    );
  });

  it("persists bearer recovery in memory when Web Storage is unavailable", async () => {
    const originalWindow = (globalThis as { window?: unknown }).window;
    const originalLocalStorage = (globalThis as { localStorage?: unknown })
      .localStorage;
    (globalThis as { window?: unknown }).window = {
      location: {
        hash: "",
        protocol: "https:",
        hostname: "example.com",
        pathname: "/",
      },
    };
    delete (globalThis as { localStorage?: unknown }).localStorage;

    try {
      const client = createClient(async () => ({
        ok: true,
        auth: { kind: "bearer", session: { token: "runtime-only-token" } },
      }));
      await client.recoverBrowserSession("manual");

      expect(client.isAuthenticated()).toBe(true);
      expect(
        (globalThis as { localStorage?: unknown }).localStorage,
      ).toBeUndefined();
      await client.dispose();
      clearCachedBrowserAuthState();
    } finally {
      if (originalWindow === undefined) {
        delete (globalThis as { window?: unknown }).window;
      } else {
        (globalThis as { window?: unknown }).window = originalWindow;
      }
      if (originalLocalStorage !== undefined) {
        (globalThis as { localStorage?: unknown }).localStorage =
          originalLocalStorage;
      }
    }
  });

  it("returns the same disposal promise and drains active recovery", async () => {
    let settle!: (result: BrowserSessionCallbackResult) => void;
    const pending = new Promise<BrowserSessionCallbackResult>((resolve) => {
      settle = resolve;
    });
    const client = createClient(() => pending);
    const recovery = client.recoverBrowserSession("manual");

    const first = client.dispose();
    const second = client.dispose();
    expect(first).toBe(second);
    settle({ ok: true, auth: { kind: "cookie" } });

    await first;
    await expect(recovery).resolves.toMatchObject({
      recovered: false,
      reason: "disposed",
    });
    await expect(client.recoverBrowserSession("manual")).resolves.toMatchObject(
      {
        outcome: "suppressed",
        reason: "disposed",
      },
    );
  });

  it("uses raw replay feedback to suppress a subsequent unauthorized recovery", async () => {
    const restore = jest.fn().mockResolvedValue({
      ok: true,
      auth: { kind: "cookie" },
    });
    const client = createClient(restore);

    await client.recoverBrowserSession("unauthorized");
    client.recordBrowserSessionReplayUnauthorized();
    await expect(
      client.recoverBrowserSession("unauthorized"),
    ).resolves.toMatchObject({
      outcome: "suppressed",
      reason: "failure-backoff",
    });
    expect(restore).toHaveBeenCalledTimes(1);
    await client.dispose();
  });

  it("routes request 401 recovery and replay through its coordinator", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    const restore = jest.fn().mockResolvedValue({
      ok: true,
      auth: { kind: "cookie" },
    });
    const client = createClient(restore);

    await expect(
      client.get("/resource", {
        credentials: "include",
        skipAudit: true,
      }),
    ).resolves.toEqual({ ok: true });
    expect(restore).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((fetchMock.mock.calls[1][1] as RequestInit).credentials).toBe(
      "include",
    );
    await client.dispose();
  });
});
