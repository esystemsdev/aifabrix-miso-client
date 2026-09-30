import { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Readable } from "stream";
import { InternalHttpClient } from "../../src/utils/internal-http-client";
import { HttpClient } from "../../src/utils/http-client";
import { ApiClient } from "../../src/api";
import { EncryptionService } from "../../src/services/encryption.service";
import { extractErrorInfo } from "../../src/utils/error-extractor";
import { LoggerService } from "../../src/services/logger";
import { RuntimeState, createRuntime } from "../../src/bootstrap/runtime";
import { BootstrapSnapshot } from "../../src/bootstrap/types";
import { MisoClientConfig, AuthStrategy } from "../../src/types/config.types";

const secret = "secret-sentinel-unique";
const token = "token-sentinel-unique";
const key = "key-sentinel-unique";
const plaintext = "plaintext-sentinel-unique";
const reference = "enc://reference-sentinel-unique";
function config(): MisoClientConfig {
  return {
    controllerUrl: "https://miso.test",
    clientId: "client-id-sentinel",
    clientSecret: secret,
    clientToken: token,
    clientTokenExpiresAt: new Date(Date.now() + 600000),
    encryptionKey: key,
    onClientTokenRefresh: async () => ({
      token: "refreshed-token",
      expiresIn: 300,
    }),
    validateResponses: false,
  };
}
function deny(
  request: InternalAxiosRequestConfig,
  status = 401,
  data: unknown = { code: "ordinary_401" },
  headers = {},
) {
  return new AxiosError(
    "Transport failure",
    "ERR_BAD_RESPONSE",
    request,
    undefined,
    {
      status,
      statusText: "Denied",
      data,
      headers,
      config: request,
    },
  );
}
function success(request: InternalAxiosRequestConfig): AxiosResponse {
  return {
    status: 200,
    statusText: "OK",
    data: { success: true },
    headers: {},
    config: request,
  };
}
const strategy: AuthStrategy = {
  methods: ["bearer", "client-token"],
  bearerToken: "user-token",
};

describe("real SDK authentication boundaries", () => {
  it.each(["strategy", "authenticated"])(
    "clears stale mixed-case auth for %s without mutating caller config",
    async (entry) => {
      const http = new InternalHttpClient(config());
      const adapter = jest.fn(async (r: InternalAxiosRequestConfig) =>
        success(r),
      );
      adapter.mockImplementationOnce(async (r) => {
        throw deny(r);
      });
      http.getAxiosInstance().defaults.adapter = adapter;
      const base = {
        headers: {
          aUtHoRiZaTiOn: "Bearer stale",
          "X-Client-Id": "stale-id",
          "X-Client-Secret": "stale-secret",
          "X-Client-Token": "stale-token",
          "x-custom": "retained",
        },
      };
      const before = JSON.stringify(base);
      if (entry === "strategy")
        await http.requestWithAuthStrategy(
          "POST",
          "/api/test",
          strategy,
          { action: true },
          base,
        );
      else
        await http.authenticatedRequest(
          "POST",
          "/api/test",
          "unused",
          { action: true },
          base,
          strategy,
        );
      expect(adapter).toHaveBeenCalledTimes(2);
      expect(adapter.mock.calls[0][0].headers.get("Authorization")).toBe(
        "Bearer user-token",
      );
      expect(
        adapter.mock.calls[1][0].headers.get("Authorization"),
      ).toBeUndefined();
      for (const [request] of adapter.mock.calls) {
        expect(request.headers.get("x-client-id")).toBeUndefined();
        expect(request.headers.get("x-client-secret")).toBeUndefined();
        expect(request.headers.get("x-custom")).toBe("retained");
      }
      expect(adapter.mock.calls[1][0].headers.get("x-client-token")).toBe(
        "refreshed-token",
      );
      expect(JSON.stringify(base)).toBe(before);
    },
  );
  it("never falls back implicitly for authenticatedRequest", async () => {
    const http = new InternalHttpClient(config());
    const adapter = jest.fn(async (r: InternalAxiosRequestConfig) => {
      throw deny(r);
    });
    http.getAxiosInstance().defaults.adapter = adapter;
    await expect(
      http.authenticatedRequest("GET", "/api/test", "user"),
    ).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
  it.each(["network", "cancel", "stream"])(
    "does not replay %s failure",
    async (kind) => {
      const http = new InternalHttpClient(config());
      const abort = new AbortController();
      const adapter = jest.fn(async (r: InternalAxiosRequestConfig) => {
        if (kind === "cancel") abort.abort();
        if (kind === "network")
          throw new AxiosError("offline", "ECONNRESET", r);
        throw deny(r);
      });
      http.getAxiosInstance().defaults.adapter = adapter;
      await expect(
        http.requestWithAuthStrategy(
          "POST",
          "/api/test",
          strategy,
          kind === "stream" ? Readable.from(["body"]) : {},
          { signal: abort.signal },
        ),
      ).rejects.toThrow();
      expect(adapter).toHaveBeenCalledTimes(1);
    },
  );
  it("does not dispatch when already cancelled", async () => {
    const http = new InternalHttpClient(config());
    const adapter = jest.fn(async (r: InternalAxiosRequestConfig) =>
      success(r),
    );
    http.getAxiosInstance().defaults.adapter = adapter;
    const abort = new AbortController();
    abort.abort();
    await expect(
      http.requestWithAuthStrategy("GET", "/api/test", strategy, undefined, {
        signal: abort.signal,
      }),
    ).rejects.toThrow();
    expect(adapter).not.toHaveBeenCalled();
  });
  it("skips unavailable methods and retains one attempt when none are eligible", async () => {
    const http = new InternalHttpClient(config());
    const adapter = jest.fn(async (r: InternalAxiosRequestConfig) =>
      success(r),
    );
    http.getAxiosInstance().defaults.adapter = adapter;
    await http.requestWithAuthStrategy("GET", "/api/test", {
      methods: ["bearer", "api-key", "client-token"],
    });
    expect(
      adapter.mock.calls[0][0].headers.get("Authorization"),
    ).toBeUndefined();
    adapter.mockImplementation(async (r) => {
      throw deny(r);
    });
    await expect(
      http.requestWithAuthStrategy("GET", "/api/test", { methods: [] }),
    ).rejects.toThrow();
    expect(adapter).toHaveBeenCalledTimes(2);
  });
  it("exhaustion preserves final safe diagnostics", async () => {
    const http = new InternalHttpClient(config());
    let index = 0;
    http.getAxiosInstance().defaults.adapter = async (r) => {
      throw deny(r, 401, {
        code: `attempt-${++index}`,
        detail: secret,
        correlationId: `correlation-${index}`,
      });
    };
    await expect(
      http.requestWithAuthStrategy("GET", "/api/test", strategy),
    ).rejects.toMatchObject({
      statusCode: 401,
      errorBody: {
        code: "attempt-2",
        detail: "***MASKED***",
        correlationId: "correlation-2",
      },
    });
  });
  it("external strategy calls acquire no SDK token or credentials", async () => {
    const cfg = config();
    const refresh = jest.fn();
    cfg.onClientTokenRefresh = refresh;
    const http = new InternalHttpClient(cfg);
    const adapter = jest.fn(async (r: InternalAxiosRequestConfig) =>
      success(r),
    );
    http.getExternalAxiosInstance().defaults.adapter = adapter;
    await http.requestWithAuthStrategy(
      "GET",
      "https://external.test/test",
      strategy,
      undefined,
      { headers: { "X-Client-Secret": secret, "x-client-token": token } },
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(
      adapter.mock.calls[0][0].headers.get("x-client-token"),
    ).toBeUndefined();
    expect(
      adapter.mock.calls[0][0].headers.get("x-client-secret"),
    ).toBeUndefined();
    expect(
      adapter.mock.calls[0][0].headers.get("Authorization"),
    ).toBeUndefined();
  });
  it("coalesces 24 failed refreshes and permits a later refresh", async () => {
    const cfg = config();
    delete cfg.clientToken;
    const refresh = jest
      .fn()
      .mockRejectedValueOnce(new Error("refresh failed"))
      .mockResolvedValue({ token, expiresIn: 300 });
    cfg.onClientTokenRefresh = refresh;
    const http = new InternalHttpClient(cfg);
    http.getAxiosInstance().defaults.adapter = async (r) => success(r);
    const results = await Promise.allSettled(
      Array.from({ length: 24 }, () =>
        http.requestWithAuthStrategy("GET", "/api/test", strategy),
      ),
    );
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.status === "rejected")).toBe(true);
    await http.requestWithAuthStrategy("GET", "/api/test", strategy);
    expect(refresh).toHaveBeenCalledTimes(2);
  });
});

function snapshot(currentToken = token): BootstrapSnapshot {
  return {
    protocolVersion: 1,
    issuedAt: new Date().toISOString(),
    context: { installationId: "i", applicationId: "a", environmentId: "e" },
    clientId: "managed-id",
    clientToken: currentToken,
    configuration: { ENCRYPTION_KEY: key },
    clientTokenExpiresAt: new Date(Date.now() + 300000).toISOString(),
    refreshAfter: new Date(Date.now() + 120000).toISOString(),
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  };
}
describe("managed fallback with actual runtime state", () => {
  it.each(["bootstrap_token_invalid", "bootstrap_token_expired"])(
    "never replays %s",
    async (code) => {
      const fetch = jest.fn().mockResolvedValue(snapshot());
      const state = new RuntimeState(fetch);
      await state.start();
      const cfg = state.config("https://miso.test");
      const runtime = await createRuntime(state, cfg);
      const http = new InternalHttpClient(cfg);
      const adapter = jest.fn(async (r: InternalAxiosRequestConfig) => {
        throw deny(r, 401, { code });
      });
      http.getAxiosInstance().defaults.adapter = adapter;
      try {
        await expect(
          http.requestWithAuthStrategy("POST", "/api/test", strategy, {}),
        ).rejects.toThrow();
        expect(adapter).toHaveBeenCalledTimes(1);
        if (code.endsWith("invalid")) {
          expect(() => runtime.secrets.get("ENCRYPTION_KEY")).toThrow(
            "authorization-denied",
          );
          await expect(
            http.requestWithAuthStrategy("POST", "/api/test", strategy, {}),
          ).rejects.toThrow("authorization-denied");
          expect(adapter).toHaveBeenCalledTimes(1);
        }
      } finally {
        await runtime.close();
      }
    },
  );
});

describe("public encryption safe diagnostics across real layers", () => {
  let consoleSpy: jest.SpyInstance;
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    consoleSpy.mockRestore();
  });
  it.each(["rfc", "legacy", "json", "plaintext", "invalid-json"])(
    "sanitizes encrypt/decrypt %s responses and all sinks",
    async (shape) => {
      const logger = {
        audit: jest.fn().mockResolvedValue(undefined),
        debug: jest.fn().mockResolvedValue(undefined),
      };
      const cfg = {
        ...config(),
        logLevel: "debug" as const,
        audit: { level: "full" as const, maxMaskingSize: 1 },
      };
      const http = new HttpClient(cfg, logger as unknown as LoggerService);
      const api = new ApiClient(http);
      const encryption = new EncryptionService(api, key, null, 0);
      const internal = (
        http as unknown as { internalClient: InternalHttpClient }
      ).internalClient;
      const echoed = [
        secret,
        token,
        key,
        plaintext,
        reference,
        cfg.clientId,
      ].join(" ");
      const base = {
        code: "KEY_DENIED",
        detail: echoed,
        authMethod: "client-token",
        clientIdentity: { label: "safe-identity", detail: echoed },
        instance: "/api/encryption",
        correlationId: "body-correlation",
        clientSecret: secret,
      };
      const data =
        shape === "rfc"
          ? { ...base, type: "/Errors/KeyDenied", title: echoed, status: 422 }
          : shape === "legacy"
            ? {
                ...base,
                type: "/Errors/KeyDenied",
                title: echoed,
                statusCode: 422,
                errors: [echoed],
              }
            : shape === "json"
              ? base
              : shape === "plaintext"
                ? echoed
                : `{invalid: ${echoed}`;
      internal.getAxiosInstance().defaults.adapter = async (r) => {
        throw deny(r, 422, data, { "x-correlation-id": "header-correlation" });
      };
      for (const operation of [
        () => encryption.encrypt(plaintext, "param"),
        () => encryption.decrypt(reference, "param"),
      ]) {
        let error: any;
        try {
          await operation();
        } catch (e) {
          error = e;
        }
        expect(error).toBeDefined();
        const info = extractErrorInfo(error);
        if (["rfc", "legacy"].includes(shape)) {
          expect(error.errorResponse).toMatchObject({
            code: "KEY_DENIED",
            authMethod: "client-token",
            correlationId: "body-correlation",
            clientIdentity: { label: "safe-identity" },
          });
          expect(info.responseBody).toMatchObject({
            code: "KEY_DENIED",
            authMethod: "client-token",
          });
        }
        expect(info.correlationId).toBe(
          ["plaintext", "invalid-json"].includes(shape)
            ? "header-correlation"
            : "body-correlation",
        );
        expect(error.cause).toBeUndefined();
        const serialized = JSON.stringify({
          error,
          info,
          message: error.message,
          stack: error.stack,
        });
        // Only values available to this request can be redacted by exact value.
        for (const value of [secret, token, key, cfg.clientId])
          expect(serialized).not.toContain(value);
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
      const logged = JSON.stringify([
        consoleSpy.mock.calls,
        logger.audit.mock.calls,
        logger.debug.mock.calls,
      ]);
      for (const value of [secret, token, key, cfg.clientId])
        expect(logged).not.toContain(value);
      expect(logger.audit).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalled();
    },
  );
});

describe("managed expiry and encryption regression coverage", () => {
  it("refreshes an expired managed token without replay, then uses the new token", async () => {
    jest.useFakeTimers();
    const fetch = jest.fn().mockResolvedValue(snapshot());
    const state = new RuntimeState(fetch);
    await state.start();
    const cfg = state.config("https://miso.test");
    const runtime = await createRuntime(state, cfg);
    const http = new InternalHttpClient(cfg);
    const adapter = jest.fn(async (request: InternalAxiosRequestConfig) =>
      success(request),
    );
    adapter.mockImplementationOnce(async (request) => {
      throw deny(request, 401, { code: "bootstrap_token_expired" });
    });
    http.getAxiosInstance().defaults.adapter = adapter;
    try {
      await jest.advanceTimersByTimeAsync(30001);
      fetch.mockResolvedValue(snapshot("current-managed-token"));
      await expect(
        http.requestWithAuthStrategy("POST", "/api/test", strategy, {}),
      ).rejects.toThrow();
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledTimes(2);
      await http.requestWithAuthStrategy("POST", "/api/test", strategy, {});
      expect(adapter.mock.calls[1][0].headers["x-client-token"]).toBe(
        "current-managed-token",
      );
    } finally {
      await runtime.close();
      jest.useRealTimers();
    }
  });
  it.each(["rfc", "legacy", "json"])(
    "preserves safe %s encryption errors under the managed runtime guard",
    async (shape) => {
      const state = new RuntimeState(async () => snapshot());
      await state.start();
      const cfg = {
        ...state.config("https://miso.test"),
        encryptionKey: key,
        validateResponses: false,
      };
      const runtime = await createRuntime(state, cfg);
      const logs = jest.spyOn(console, "error").mockImplementation(() => {});
      const logger = {
        audit: jest.fn().mockResolvedValue(undefined),
        debug: jest.fn().mockResolvedValue(undefined),
      };
      const http = new HttpClient(cfg, logger as unknown as LoggerService);
      const encryption = new EncryptionService(
        new ApiClient(http),
        key,
        null,
        0,
      );
      const internal = (
        http as unknown as { internalClient: InternalHttpClient }
      ).internalClient;
      internal.getAxiosInstance().defaults.adapter = async (request) => {
        const payload = JSON.parse(request.data);
        const detail = [token, key, payload.plaintext || payload.value].join(
          " ",
        );
        const body = {
          code: "KEY_DENIED",
          detail,
          correlationId: "managed-correlation",
        };
        const data =
          shape === "rfc"
            ? { ...body, type: "about:blank", title: detail, status: 422 }
            : shape === "legacy"
              ? {
                  ...body,
                  type: "about:blank",
                  title: detail,
                  statusCode: 422,
                  errors: [detail],
                }
              : body;
        throw deny(request, 422, data);
      };
      try {
        for (const operation of [
          () => encryption.encrypt(plaintext, "param"),
          () => encryption.decrypt(reference, "param"),
        ]) {
          await expect(operation()).rejects.toMatchObject({
            errorBody: {
              code: "KEY_DENIED",
              correlationId: "managed-correlation",
              detail: "***MASKED*** ***MASKED*** ***MASKED***",
            },
          });
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
        const text = JSON.stringify([logs.mock.calls, logger.audit.mock.calls]);
        for (const sentinel of [token, key, plaintext, reference])
          expect(text).not.toContain(sentinel);
        expect(runtime.secrets.require("ENCRYPTION_KEY")).toBe(key);
      } finally {
        logs.mockRestore();
        await runtime.close();
      }
    },
  );
});
