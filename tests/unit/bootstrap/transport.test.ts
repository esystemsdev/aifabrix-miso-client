import axios from "axios";
import { credentialSettings } from "../../../src/bootstrap/credentials";
import { fetchSnapshot } from "../../../src/bootstrap/transport";
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
const token = "miso-initial-token";
const settings = {
  url: "https://miso.test/miso/api/v1/auth/bootstrap",
  tokenUrl: "https://miso.test/miso/api/v1/auth/token",
};

describe("broker transport and validation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(epoch);
    post.mockReset();
    (axios.create as jest.Mock).mockReturnValue({ post });
  });
  afterEach(() => jest.useRealTimers());
  it("sends client-token-only request to fixed endpoint with bounded transport", async () => {
    post.mockResolvedValue({
      status: 200,
      headers: {},
      data: JSON.stringify({ success: true, data: data() }),
    });
    const result = await fetchSnapshot(
      token,
      settings,
      new AbortController().signal,
    );
    expect(result.clientToken).toBe("miso-sentinel");
    expect(post).toHaveBeenCalledWith(
      settings.url,
      { protocolVersion: 1 },
      expect.objectContaining({
        maxRedirects: 0,
        maxContentLength: 1048576,
        timeout: 5000,
        headers: expect.objectContaining({
          "x-client-token": token,
        }),
      }),
    );
  });
  it("rejects unknown envelope members consistently with the Python SDK", async () => {
    post.mockResolvedValue({
      status: 200,
      headers: {},
      data: JSON.stringify({
        success: true,
        data: data(),
        extra: "private-sentinel",
      }),
    });
    await expect(
      fetchSnapshot(token, settings, new AbortController().signal),
    ).rejects.toThrow("protocol-error");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([401, 403, 404, 302, 422])(
    "does not retry status %s or expose body",
    async (status) => {
      post.mockResolvedValue({ status, headers: {}, data: "secret-sentinel" });
      const error = await fetchSnapshot(
        token,
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
      fetchSnapshot(token, settings, new AbortController().signal),
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
      fetchSnapshot(token, settings, new AbortController().signal),
    ).rejects.toThrow("unavailable");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("does not make requests after cancellation", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      fetchSnapshot(token, settings, controller.signal),
    ).rejects.toThrow("unavailable");
    expect(post).not.toHaveBeenCalled();
  });
  it("rejects responses over the byte cap before parsing", async () => {
    post.mockResolvedValue({
      status: 200,
      headers: {},
      data: " ".repeat(1048577),
    });
    await expect(
      fetchSnapshot(token, settings, new AbortController().signal),
    ).rejects.toThrow("protocol-error");
    expect(post).toHaveBeenCalledTimes(1);
  });
  it("cancels a transport that ignores AbortSignal", async () => {
    post.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const work = fetchSnapshot(token, settings, controller.signal);
    controller.abort();
    await expect(work).rejects.toThrow("unavailable");
    expect(post).toHaveBeenCalledTimes(1);
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
  it("enforces configuration count, name and UTF-8 value boundaries", () => {
    const payload = data();
    const configuration = Object.fromEntries(
      Array.from({ length: 256 }, (_, n) => [`KEY_${n}`, "value"]),
    );
    expect(validateSnapshot({ ...payload, configuration })).toBeDefined();
    expect(() =>
      validateSnapshot({
        ...payload,
        configuration: { ...configuration, EXTRA: "value" },
      }),
    ).toThrow("protocol-error");
    expect(
      validateSnapshot({
        ...payload,
        configuration: {
          ["A".repeat(128)]: "é".repeat(32768),
        },
      }),
    ).toBeDefined();
    expect(() =>
      validateSnapshot({
        ...payload,
        configuration: {
          ["A".repeat(129)]: "value",
        },
      }),
    ).toThrow("protocol-error");
    expect(() =>
      validateSnapshot({
        ...payload,
        configuration: {
          KEY: "é".repeat(32768) + "a",
        },
      }),
    ).toThrow("protocol-error");
  });

  it.each([-30001, -30000, 30000, 30001])(
    "checks both clock-skew edges at %s milliseconds",
    (offset) => {
      jest.setSystemTime(epoch + offset);
      if (Math.abs(offset) <= 30000)
        expect(validateSnapshot(data())).toBeDefined();
      else expect(() => validateSnapshot(data())).toThrow("protocol-error");
    },
  );

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
    expect(credentialSettings()).toEqual({
      ...settings,
      controllerUrl: "https://miso.test/miso",
    });
    process.env.MISO_CONTROLLER_URL = "https://secret@miso.test";
    expect(() => credentialSettings()).toThrow("invalid-settings");
    process.env = previous;
  });
});
