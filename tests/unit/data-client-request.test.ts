import { executeHttpRequest } from "../../src/utils/data-client-request";
import {
  BrowserSessionRecoveryResult,
  DataClientConfig,
} from "../../src/types/data-client.types";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function recovered(): BrowserSessionRecoveryResult {
  return {
    trigger: "unauthorized",
    outcome: "recovered",
    attempted: true,
    recovered: true,
  };
}

function createBaseConfig(): DataClientConfig {
  return {
    baseUrl: "https://api.example.com",
    misoConfig: {
      controllerUrl: "https://controller.example.com",
      clientId: "client",
    },
  };
}

function createBaseOptions(overrides: Record<string, unknown> = {}) {
  return {
    method: "GET",
    fullUrl: "https://api.example.com/resource",
    endpoint: "/resource",
    config: createBaseConfig(),
    cache: new Map(),
    cacheKey: "k1",
    cacheEnabled: false,
    startTime: Date.now(),
    misoClient: null,
    hasAnyToken: () => true,
    getToken: () => "token",
    handleAuthError: jest.fn(),
    recoverBrowserSession: jest.fn().mockResolvedValue(recovered()),
    recordBrowserSessionReplayUnauthorized: jest.fn(),
    interceptors: {},
    metrics: {
      totalRequests: 0,
      totalFailures: 0,
      responseTimes: [] as number[],
    },
    options: { skipAudit: true },
    ...overrides,
  };
}

describe("data-client-request auth recovery", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it.each(["GET", "HEAD"])(
    "recovers and replays %s exactly once",
    async (method) => {
      const fetchMock = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(jsonResponse({ message: "unauthorized" }, 401))
        .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
      const opts = createBaseOptions({ method });

      await expect(executeHttpRequest<{ ok: boolean }>(opts)).resolves.toEqual({
        ok: true,
      });
      expect(opts.recoverBrowserSession).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(opts.handleAuthError).not.toHaveBeenCalled();
    },
  );

  it("uses the bearer persisted by recovery on replay", async () => {
    let token = "expired";
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const opts = createBaseOptions({
      getToken: () => token,
      recoverBrowserSession: jest.fn(async () => {
        token = "recovered";
        return recovered();
      }),
    });

    await executeHttpRequest(opts);
    const replayInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(new Headers(replayInit.headers).get("authorization")).toBe(
      "Bearer recovered",
    );
  });

  it("preserves credentialed cookie transport without injecting a bearer", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({ ok: true }, 200));
    const opts = createBaseOptions({
      getToken: () => null,
      options: {
        skipAudit: true,
        credentials: "include" as RequestCredentials,
      },
    });

    await executeHttpRequest(opts);
    const replayInit = fetchMock.mock.calls[1][1] as RequestInit;
    expect(replayInit.credentials).toBe("include");
    expect(new Headers(replayInit.headers).has("authorization")).toBe(false);
  });

  it("preserves the original 401 when recovery fails", async () => {
    const firstResponse = jsonResponse({ message: "unauthorized" }, 401);
    jest.spyOn(globalThis, "fetch").mockResolvedValueOnce(firstResponse);
    const opts = createBaseOptions({
      recoverBrowserSession: jest.fn().mockResolvedValue({
        trigger: "unauthorized",
        outcome: "failed",
        attempted: true,
        recovered: false,
        reason: "network",
      }),
    });

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      statusCode: 401,
      response: firstResponse,
    });
    expect(opts.handleAuthError).toHaveBeenCalledTimes(1);
  });

  it("never recovers on 403", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 403));
    const opts = createBaseOptions();

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      statusCode: 403,
    });
    expect(opts.recoverBrowserSession).not.toHaveBeenCalled();
  });

  it("never recovers on an auth endpoint 401", async () => {
    jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 401));
    const opts = createBaseOptions({ endpoint: "/api/v1/auth/session" });

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(opts.recoverBrowserSession).not.toHaveBeenCalled();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE"])(
    "recovers future state but does not replay %s",
    async (method) => {
      const fetchMock = jest
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(jsonResponse({}, 401));
      const opts = createBaseOptions({ method });

      await expect(executeHttpRequest(opts)).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(opts.recoverBrowserSession).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(opts.handleAuthError).not.toHaveBeenCalled();
    },
  );

  it("makes a replayed 401 final and reports it to the coordinator", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401));
    const opts = createBaseOptions();

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect(opts.recoverBrowserSession).toHaveBeenCalledTimes(1);
    expect(opts.recordBrowserSessionReplayUnauthorized).toHaveBeenCalledTimes(
      1,
    );
    expect(opts.handleAuthError).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns a replay network failure without generic retry", async () => {
    const fetchMock = jest
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockRejectedValueOnce(new Error("offline"));
    const opts = createBaseOptions();

    await expect(executeHttpRequest(opts)).rejects.toMatchObject({
      name: "NetworkError",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
