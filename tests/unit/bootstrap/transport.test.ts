import axios from "axios";
import { BootstrapError } from "../../../src/bootstrap/types";
import { azureSettings, fetchSnapshot } from "../../../src/bootstrap/transport";
import { validateSnapshot } from "../../../src/bootstrap/validation";
import { parseBrokerJson } from "../../../src/bootstrap/json";

jest.mock("axios");
const post = jest.fn();
const epoch = Date.parse("2030-01-01T00:00:00Z");
const data = () => ({
  protocolVersion: 1,
  issuedAt: new Date(epoch).toISOString(),
  context: { installationId: "i", applicationId: "a", environmentId: "e" },
  clientId: "c",
  clientToken: "miso-sentinel",
  configuration: { DATABASE_URL: "db-sentinel", EMPTY: "" },
  refreshAfter: new Date(epoch + 120000).toISOString(),
  clientTokenExpiresAt: new Date(epoch + 300000).toISOString(),
  expiresAt: new Date(epoch + 900000).toISOString(),
});
const provider = { getToken: jest.fn() };
const settings = {
  url: "https://miso.test/miso/api/v1/auth/bootstrap",
  scope: "api://miso/.default",
};

describe("broker transport and validation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(epoch);
    post.mockReset();
    (axios.create as jest.Mock).mockReturnValue({ post });
    provider.getToken.mockResolvedValue({
      token: "entra-sentinel",
      expiresAt: new Date(epoch + 600000),
    });
  });
  afterEach(() => jest.useRealTimers());
  it("sends identity-only request to fixed endpoint with bounded transport", async () => {
    post.mockResolvedValue({
      status: 200,
      headers: {},
      data: JSON.stringify({ success: true, data: data() }),
    });
    const result = await fetchSnapshot(
      provider,
      settings,
      new AbortController().signal,
    );
    expect(result.clientToken).toBe("miso-sentinel");
    expect(provider.getToken).toHaveBeenCalledWith(
      settings.scope,
      expect.any(AbortSignal),
    );
    expect(post).toHaveBeenCalledWith(
      settings.url,
      { protocolVersion: 1 },
      expect.objectContaining({
        maxRedirects: 0,
        maxContentLength: 1048576,
        timeout: 5000,
        headers: expect.objectContaining({
          Authorization: "Bearer entra-sentinel",
        }),
      }),
    );
  });
  it.each([401, 403, 404, 302, 422])(
    "does not retry status %s or expose body",
    async (status) => {
      post.mockResolvedValue({ status, headers: {}, data: "secret-sentinel" });
      const error = await fetchSnapshot(
        provider,
        settings,
        new AbortController().signal,
      ).catch((e) => e);
      expect(post).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(error)).not.toContain("secret-sentinel");
      expect(error.code).toBe(
        [401, 403].includes(status) ? "authorization-denied" : "protocol-error",
      );
    },
  );
  it("honors zero Retry-After and stops after third attempt", async () => {
    post.mockResolvedValue({
      status: 503,
      headers: { "retry-after": "0" },
      data: "secret",
    });
    await expect(
      fetchSnapshot(provider, settings, new AbortController().signal),
    ).rejects.toThrow("unavailable");
    expect(post).toHaveBeenCalledTimes(3);
  });
  it("does not wait or retry excessive Retry-After", async () => {
    post.mockResolvedValue({
      status: 429,
      headers: { "retry-after": "11" },
      data: "secret",
    });
    await expect(
      fetchSnapshot(provider, settings, new AbortController().signal),
    ).rejects.toThrow("unavailable");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("sanitizes identity failures without HTTP or fallback", async () => {
    provider.getToken.mockRejectedValue(new Error("entra-secret"));
    const error = await fetchSnapshot(
      provider,
      settings,
      new AbortController().signal,
    ).catch((e) => e);
    expect(String(error)).not.toContain("entra-secret");
    expect(error.cause).toBeUndefined();
    expect(post).not.toHaveBeenCalled();
  });
  it("sanitizes provider-supplied SDK-shaped errors", async () => {
    provider.getToken.mockRejectedValue(
      new BootstrapError("credential-sentinel"),
    );
    const error = await fetchSnapshot(
      provider,
      settings,
      new AbortController().signal,
    ).catch((e) => e);
    expect(String(error)).not.toContain("credential-sentinel");
    expect(error.code).toBe("unavailable");
    expect(post).not.toHaveBeenCalled();
  });
  it("does not invoke providers after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    provider.getToken.mockClear();
    await expect(
      fetchSnapshot(provider, settings, controller.signal),
    ).rejects.toThrow("unavailable");
    expect(provider.getToken).not.toHaveBeenCalled();
  });
  it("rejects responses over the byte cap before parsing", async () => {
    post.mockResolvedValue({
      status: 200,
      headers: {},
      data: " ".repeat(1048577),
    });
    await expect(
      fetchSnapshot(provider, settings, new AbortController().signal),
    ).rejects.toThrow("protocol-error");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("cancels a provider that ignores AbortSignal", async () => {
    provider.getToken.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const work = fetchSnapshot(provider, settings, controller.signal);
    controller.abort();
    await expect(work).rejects.toThrow("unavailable");
    expect(post).not.toHaveBeenCalled();
  });
  it.each([
    (d: ReturnType<typeof data>) => ({ ...d, clientSecret: "forbidden" }),
    (d: ReturnType<typeof data>) => ({
      ...d,
      configuration: { MISO_CONTROLLER_URL: "https://evil" },
    }),
    (d: ReturnType<typeof data>) => ({ ...d, configuration: { bad: "value" } }),
    (d: ReturnType<typeof data>) => ({
      ...d,
      clientTokenExpiresAt: new Date(epoch + 301000).toISOString(),
    }),
    (d: ReturnType<typeof data>) => ({
      ...d,
      context: { ...d.context, extra: "value" },
    }),
  ])("rejects malformed or privileged payload %#", (mutate) => {
    expect(() => validateSnapshot(mutate(data()))).toThrow("protocol-error");
  });
  it("enforces 30 second skew boundary", () => {
    jest.setSystemTime(epoch + 30000);
    expect(validateSnapshot(data())).toBeDefined();
    jest.setSystemTime(epoch + 31000);
    expect(() => validateSnapshot(data())).toThrow();
  });
  it("rejects duplicate JSON keys including escaped equivalents", () => {
    expect(() => parseBrokerJson('{"a":1,"\\u0061":2}')).toThrow();
    expect(parseBrokerJson('{"x":{"a":1},"y":{"a":2}}')).toEqual({
      x: { a: 1 },
      y: { a: 2 },
    });
  });
  it("rejects URL userinfo and preserves virtual directory", () => {
    const previous = { ...process.env };
    process.env.MISO_CONTROLLER_URL = "https://miso.test/miso";
    process.env.MISO_BOOTSTRAP_AUDIENCE = "api://miso";
    expect(azureSettings()).toEqual({
      ...settings,
      controllerUrl: "https://miso.test/miso",
    });
    process.env.MISO_CONTROLLER_URL = "https://secret@miso.test";
    expect(() => azureSettings()).toThrow("invalid-settings");
    process.env = previous;
  });
});
