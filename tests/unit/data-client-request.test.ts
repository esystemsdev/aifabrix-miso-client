import { executeHttpRequest } from "../../src/utils/data-client-request";
import { DataClientConfig } from "../../src/types/data-client.types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createBaseConfig(
  overrides?: Partial<DataClientConfig>,
): DataClientConfig {
  return {
    baseUrl: "https://api.example.com",
    misoConfig: {
      controllerUrl: "https://controller.example.com",
      clientId: "client",
    },
    ...overrides,
  };
}

function createBaseOptions(config: DataClientConfig) {
  return {
    method: "GET",
    fullUrl: "https://api.example.com/resource",
    endpoint: "/resource",
    config,
    cache: new Map(),
    cacheKey: "k1",
    cacheEnabled: false,
    startTime: Date.now(),
    misoClient: null,
    hasAnyToken: () => true,
    getToken: () => "token",
    handleAuthError: jest.fn(),
    restoreUserSession: jest.fn(),
    refreshUserToken: jest.fn(),
    interceptors: {},
    metrics: {
      totalRequests: 0,
      totalFailures: 0,
      responseTimes: [] as number[],
    },
    options: { skipAudit: true },
  };
}

describe("data-client-request auth recovery", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("uses restore callback before refresh on 401", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const config = createBaseConfig({
      onSessionRestore: async () => ({ token: "restored" }),
      onTokenRefresh: async () => ({ token: "refreshed" }),
    });
    const opts = createBaseOptions(config);
    (opts.restoreUserSession as jest.Mock).mockResolvedValue({
      token: "restored",
      expiresIn: 3600,
    });

    const result = await executeHttpRequest<{ ok: boolean }>(opts);
    expect(result.ok).toBe(true);
    expect(opts.restoreUserSession).toHaveBeenCalledTimes(1);
    expect(opts.refreshUserToken).not.toHaveBeenCalled();
    expect(opts.handleAuthError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to refresh when restore does not return token", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const config = createBaseConfig({
      onSessionRestore: async () => null,
      onTokenRefresh: async () => ({ token: "refreshed" }),
    });
    const opts = createBaseOptions(config);
    (opts.restoreUserSession as jest.Mock).mockResolvedValue(null);
    (opts.refreshUserToken as jest.Mock).mockResolvedValue({
      token: "refreshed",
      expiresIn: 3600,
    });

    const result = await executeHttpRequest<{ ok: boolean }>(opts);
    expect(result.ok).toBe(true);
    expect(opts.restoreUserSession).toHaveBeenCalledTimes(1);
    expect(opts.refreshUserToken).toHaveBeenCalledTimes(1);
    expect(opts.handleAuthError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not call restore or refresh for 403 responses", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "forbidden" }, 403));
    const config = createBaseConfig({
      onSessionRestore: async () => ({ token: "restored" }),
      onTokenRefresh: async () => ({ token: "refreshed" }),
    });
    const opts = createBaseOptions(config);

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(opts.restoreUserSession).not.toHaveBeenCalled();
    expect(opts.refreshUserToken).not.toHaveBeenCalled();
    expect(opts.handleAuthError).toHaveBeenCalledTimes(1);
  });

  it("shares one auth recovery across concurrent 401 flows", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true, requestId: 1 }, 200))
      .mockResolvedValueOnce(jsonResponse({ ok: true, requestId: 2 }, 200));

    const config = createBaseConfig({
      onSessionRestore: async () => ({ token: "restored" }),
    });

    const sharedRestore = jest.fn().mockResolvedValue({
      token: "restored",
      expiresIn: 3600,
    });
    const first = createBaseOptions(config);
    const second = createBaseOptions(config);
    first.restoreUserSession = sharedRestore;
    second.restoreUserSession = sharedRestore;

    const [firstResult, secondResult] = await Promise.all([
      executeHttpRequest<{ ok: boolean; requestId: number }>(first),
      executeHttpRequest<{ ok: boolean; requestId: number }>(second),
    ]);

    expect(firstResult.ok).toBe(true);
    expect(secondResult.ok).toBe(true);
    expect(sharedRestore).toHaveBeenCalledTimes(1);
  });

  it("does not attempt restore or refresh for 422 response", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({ message: "invalid payload" }, 422));

    const config = createBaseConfig({
      onSessionRestore: async () => ({ token: "restored" }),
      onTokenRefresh: async () => ({ token: "refreshed" }),
    });
    const opts = createBaseOptions(config);

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(opts.restoreUserSession).not.toHaveBeenCalled();
    expect(opts.refreshUserToken).not.toHaveBeenCalled();
  });
});
