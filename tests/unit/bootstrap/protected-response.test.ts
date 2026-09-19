import { AxiosError, AxiosHeaders, AxiosResponse } from "axios";
import { RuntimeState, createRuntime } from "../../../src/bootstrap/runtime";
import { BootstrapSnapshot } from "../../../src/bootstrap/types";
import { InternalHttpClient } from "../../../src/utils/internal-http-client";

jest.mock("../../../src/miso-client", () => ({
  MisoClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

function snapshot(token = "original-token"): BootstrapSnapshot {
  const now = Date.now();
  return {
    protocolVersion: 1,
    issuedAt: new Date(now).toISOString(),
    context: { installationId: "i", applicationId: "a", environmentId: "e" },
    clientId: "client",
    clientToken: token,
    configuration: { DATABASE_URL: "secret" },
    refreshAfter: new Date(now + 120000).toISOString(),
    clientTokenExpiresAt: new Date(now + 300000).toISOString(),
    expiresAt: new Date(now + 900000).toISOString(),
  };
}

async function setup(local = false) {
  const fetch = jest.fn().mockResolvedValue(snapshot());
  const state = new RuntimeState(local ? undefined : fetch);
  if (local) state.local({ DATABASE_URL: "secret" });
  await state.start();
  const config = local
    ? {
        controllerUrl: "https://miso.test",
        clientId: "local",
        clientToken: "local-token",
      }
    : state.config("https://miso.test");
  const runtime = await createRuntime(state, config);
  const http = new InternalHttpClient(config);
  const adapter = jest.fn(async (request) => ({
    data: { success: true },
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: request,
  }));
  http.getAxiosInstance().defaults.adapter = adapter;
  const deny = (status: number, code?: string) => {
    adapter.mockImplementationOnce(async (request) => {
      const response: AxiosResponse = {
        data: { code },
        status,
        statusText: "Denied",
        headers: new AxiosHeaders(),
        config: request,
      };
      throw new AxiosError(
        "Denied",
        "ERR_BAD_RESPONSE",
        request,
        undefined,
        response,
      );
    });
  };
  return { fetch, state, runtime, http, adapter, deny };
}

describe("protected API bootstrap lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2030-01-01T00:00:00Z"));
  });
  afterEach(() => jest.useRealTimers());

  it.each([
    [403, "bootstrap_identity_disabled"],
    [403, "bootstrap_binding_mismatch"],
    [401, "bootstrap_token_invalid"],
  ])(
    "invalidates secrets and blocks cached outbound calls for %s %s",
    async (status, code) => {
      const { runtime, http, adapter, deny } = await setup();
      const event = jest.fn();
      runtime.onInvalidated(event);
      await http.get("/api/resource");
      deny(Number(status), String(code));
      await expect(http.get("/api/resource")).rejects.toThrow();
      expect(event).toHaveBeenCalledWith("authorization-denied");
      expect(() => runtime.secrets.get("DATABASE_URL")).toThrow(
        "authorization-denied",
      );
      await expect(http.get("/api/resource")).rejects.toThrow(
        "authorization-denied",
      );
      expect(adapter).toHaveBeenCalledTimes(2);
      await runtime.close();
    },
  );

  it.each([
    [401, undefined],
    [403, "permission_denied"],
    [503, "bootstrap_registry_unavailable"],
    [403, "bootstrap_token_invalid"],
    [401, "bootstrap_identity_disabled"],
  ])(
    "preserves valid state for non-revocation response %s %s",
    async (status, code) => {
      const { runtime, http, fetch, deny } = await setup();
      deny(status as number, code as string | undefined);
      await expect(http.get("/api/resource")).rejects.toThrow();
      expect(runtime.secrets.get("DATABASE_URL")).toBe("secret");
      await expect(http.get("/api/resource")).resolves.toEqual({
        success: true,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      await runtime.close();
    },
  );

  it("leaves local clients unchanged even for bootstrap-shaped failures", async () => {
    const { runtime, http, deny, fetch } = await setup(true);
    deny(403, "bootstrap_identity_disabled");
    await expect(http.get("/api/resource")).rejects.toThrow();
    expect(runtime.secrets.get("DATABASE_URL")).toBe("secret");
    await http.get("/api/resource");
    expect(fetch).not.toHaveBeenCalled();
    await runtime.close();
  });

  it("refreshes expiry without replaying the failed operation", async () => {
    const { runtime, http, fetch, deny, adapter } = await setup();
    await jest.advanceTimersByTimeAsync(30000);
    fetch.mockResolvedValue(snapshot("replacement-token"));
    deny(401, "bootstrap_token_expired");
    await expect(
      http.post("/api/resource", { mutate: true }),
    ).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await http.get("/api/resource");
    expect(adapter.mock.calls[1][0].headers["x-client-token"]).toBe(
      "replacement-token",
    );
    await runtime.close();
  });

  it("blocks rejected tokens during cooldown and failed refresh while retaining secrets", async () => {
    const { runtime, http, fetch, deny, adapter } = await setup();
    deny(401, "bootstrap_token_expired");
    await expect(http.get("/api/resource")).rejects.toThrow();
    await expect(http.get("/api/resource")).rejects.toThrow("unavailable");
    expect(fetch).toHaveBeenCalledTimes(1);
    fetch.mockRejectedValue(new Error("outage"));
    await jest.advanceTimersByTimeAsync(30000);
    await expect(http.get("/api/resource")).rejects.toThrow("unavailable");
    expect(runtime.secrets.get("DATABASE_URL")).toBe("secret");
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
    await runtime.close();
  });

  it("coalesces concurrent expiry and ignores late expiry for the old token", async () => {
    const { runtime, state, fetch } = await setup();
    await jest.advanceTimersByTimeAsync(30000);
    let resolve!: (value: BootstrapSnapshot) => void;
    fetch.mockImplementation(
      () =>
        new Promise<BootstrapSnapshot>((r) => {
          resolve = r;
        }),
    );
    const expired = { code: "bootstrap_token_expired" };
    const first = state.response(401, expired, "original-token");
    const second = state.response(401, expired, "original-token");
    expect(fetch).toHaveBeenCalledTimes(2);
    resolve(snapshot("replacement-token"));
    await Promise.all([first, second]);
    await state.response(401, expired, "original-token");
    expect(await state.token()).toBe("replacement-token");
    expect(fetch).toHaveBeenCalledTimes(2);
    await runtime.close();
  });

  it.each([
    { url: "https://foreign.test/api" },
    { url: "//foreign.test/api" },
    { url: "/api", baseURL: "https://foreign.test" },
    { url: "https://user:password@miso.test/api" },
    { url: "/api", auth: { username: "user", password: "password" } },
  ])(
    "blocks unsafe managed request options %# before dispatch",
    async (options) => {
      const { runtime, http, adapter } = await setup();
      await expect(http.getAxiosInstance().request(options)).rejects.toThrow(
        "untrusted-request-target",
      );
      expect(adapter).not.toHaveBeenCalled();
      await runtime.close();
    },
  );

  it("pins the startup origin and disables redirects despite request overrides", async () => {
    const { runtime, http, adapter } = await setup();
    await http
      .getAxiosInstance()
      .get("https://miso.test/api", { maxRedirects: 5 });
    expect(adapter.mock.calls[0][0].maxRedirects).toBe(0);
    http.config.controllerUrl = "https://foreign.test";
    await expect(
      http.getAxiosInstance().get("https://foreign.test/api"),
    ).rejects.toThrow("untrusted-request-target");
    expect(adapter).toHaveBeenCalledTimes(1);
    await runtime.close();
  });

  it("does not reuse a rejected token returned by refresh", async () => {
    const { runtime, state, fetch } = await setup();
    await jest.advanceTimersByTimeAsync(30000);
    await state.response(
      401,
      { code: "bootstrap_token_expired" },
      "original-token",
    );
    await expect(state.token()).rejects.toThrow("unavailable");
    expect(fetch).toHaveBeenCalledTimes(2);
    await runtime.close();
  });
});
