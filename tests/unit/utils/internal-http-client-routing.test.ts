import { AxiosError, AxiosHeaders, AxiosResponse } from "axios";
import { InternalHttpClient } from "../../../src/utils/internal-http-client";
import { RuntimeState, createRuntime } from "../../../src/bootstrap/runtime";
import { BootstrapSnapshot } from "../../../src/bootstrap/types";

jest.mock("../../../src/miso-client", () => ({
  MisoClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));

type Adapter = jest.Mock;

function okAdapter(body: unknown = { success: true }): Adapter {
  return jest.fn(async (request) => ({
    data: body,
    status: 200,
    statusText: "OK",
    headers: new AxiosHeaders(),
    config: request,
  }));
}

function denyOnce(adapter: Adapter, status: number, data: unknown): void {
  adapter.mockImplementationOnce(async (request) => {
    const response: AxiosResponse = {
      data,
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
}

function legacyClient() {
  const http = new InternalHttpClient({
    controllerUrl: "https://miso.test",
    clientId: "client",
    clientToken: "cached-token",
    clientTokenExpiresAt: new Date(Date.now() + 3_600_000),
  });
  const controller = okAdapter();
  const external = okAdapter({ id: "1" });
  http.getAxiosInstance().defaults.adapter = controller;
  http.getExternalAxiosInstance().defaults.adapter = external;
  return { http, controller, external };
}

describe("InternalHttpClient routing by target origin", () => {
  it("sends the client token to controller targets only", async () => {
    const { http, controller, external } = legacyClient();
    await http.get("/api/v1/health");
    expect(controller).toHaveBeenCalledTimes(1);
    expect(controller.mock.calls[0][0].headers["x-client-token"]).toBe(
      "cached-token",
    );
    expect(external).not.toHaveBeenCalled();
  });

  it.each(["get", "post", "put", "delete"] as const)(
    "%s to an external origin carries no SDK credential",
    async (method) => {
      const { http, controller, external } = legacyClient();
      const url = "https://api.openai.com/v1/chat/completions";
      const config = {
        headers: {
          Authorization: "Bearer provider-key",
          "x-client-token": "copied-by-caller",
        },
      };
      const result =
        method === "get" || method === "delete"
          ? await http[method](url, config)
          : await http[method](url, { model: "m" }, config);
      expect(result).toEqual({ id: "1" });
      expect(controller).not.toHaveBeenCalled();
      const sent = external.mock.calls[0][0];
      expect(sent.url).toBe(url);
      expect(sent.baseURL).toBeUndefined();
      expect(sent.headers["Authorization"]).toBe("Bearer provider-key");
      expect(sent.headers["x-client-token"]).toBeUndefined();
    },
  );

  it("a provider 401 does not clear the cached client token", async () => {
    const { http, controller, external } = legacyClient();
    denyOnce(external, 401, { error: "Incorrect API key provided" });
    await expect(
      http.post("https://api.openai.com/v1/chat/completions", { model: "m" }),
    ).rejects.toThrow();
    await http.get("/api/v1/health");
    // [EDGE] the next controller call still carries the same token, no refetch
    expect(controller.mock.calls[0][0].headers["x-client-token"]).toBe(
      "cached-token",
    );
  });

  it("a baseURL override to a foreign origin is routed externally", async () => {
    const { http, controller, external } = legacyClient();
    await http.get("/api", { baseURL: "https://foreign.test" });
    expect(controller).not.toHaveBeenCalled();
    expect(external.mock.calls[0][0].headers["x-client-token"]).toBeUndefined();
  });
});

function snapshot(): BootstrapSnapshot {
  const now = Date.now();
  return {
    protocolVersion: 1,
    issuedAt: new Date(now).toISOString(),
    context: { installationId: "i", applicationId: "a", environmentId: "e" },
    clientId: "client",
    clientToken: "managed-token",
    configuration: { DATABASE_URL: "secret" },
    refreshAfter: new Date(now + 120000).toISOString(),
    clientTokenExpiresAt: new Date(now + 300000).toISOString(),
    expiresAt: new Date(now + 900000).toISOString(),
  };
}

describe("managed runtime routing", () => {
  it("external requests skip token, pin and bootstrap revocation handling", async () => {
    const fetch = jest.fn().mockResolvedValue(snapshot());
    const state = new RuntimeState(fetch);
    await state.start();
    const config = state.config("https://miso.test");
    const runtime = await createRuntime(state, config);
    const http = new InternalHttpClient(config);
    const controller = okAdapter();
    const external = okAdapter();
    http.getAxiosInstance().defaults.adapter = controller;
    http.getExternalAxiosInstance().defaults.adapter = external;
    const invalidated = jest.fn();
    runtime.onInvalidated(invalidated);

    // [EDGE] a provider replying with a bootstrap-looking body cannot revoke our runtime
    denyOnce(external, 401, { code: "bootstrap_token_invalid" });
    await expect(
      http.get("https://api.hubapi.com/crm/v3/objects/deals"),
    ).rejects.toThrow();
    expect(invalidated).not.toHaveBeenCalled();
    expect(runtime.secrets.get("DATABASE_URL")).toBe("secret");
    expect(external.mock.calls[0][0].headers["x-client-token"]).toBeUndefined();
    expect(controller).not.toHaveBeenCalled();

    await http.get("/api/resource");
    expect(controller.mock.calls[0][0].headers["x-client-token"]).toBe(
      "managed-token",
    );
    await runtime.close();
  });
});
