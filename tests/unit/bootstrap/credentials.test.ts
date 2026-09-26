import axios from "axios";
import { validateSnapshot } from "../../../src/bootstrap";
import controllerFixture from "../../fixtures/bootstrap/controller-snapshot.json";
import { inspect } from "node:util";
import {
  credentialSettings,
  credentialSnapshot,
} from "../../../src/bootstrap/credentials";
import { RuntimeState } from "../../../src/bootstrap/runtime";
import { mintClientToken } from "../../../src/bootstrap/transport";
import { BootstrapSnapshot } from "../../../src/bootstrap";

jest.mock("axios");
const post = jest.fn();
const epoch = Date.parse("2030-01-01T00:00:00Z");
const snapshot = (token = "snapshot-token"): BootstrapSnapshot => ({
  protocolVersion: 1,
  issuedAt: new Date(Date.now()).toISOString(),
  context: { installationId: "i", applicationId: "a", environmentId: "e" },
  clientId: "client",
  clientToken: token,
  configuration: { DATABASE_URL: "secret-value" },
  refreshAfter: new Date(Date.now() + 120000).toISOString(),
  clientTokenExpiresAt: new Date(Date.now() + 300000).toISOString(),
  expiresAt: new Date(Date.now() + 900000).toISOString(),
});
const grant = () => ({
  status: 201,
  headers: {},
  data: JSON.stringify({
    data: {
      token: "grant-token",
      expiresIn: 900,
      expiresAt: new Date(Date.now() + 900000).toISOString(),
    },
  }),
});
const response = (token?: string) => ({
  status: 200,
  headers: {},
  data: JSON.stringify({ success: true, data: snapshot(token) }),
});

describe("Miso credential bootstrap", () => {
  let previous: NodeJS.ProcessEnv;
  beforeEach(() => {
    previous = process.env;
    process.env = {
      MISO_CONTROLLER_URL: "https://miso.test/miso",
      MISO_CLIENTID: "client",
      MISO_CLIENTSECRET: "credential-sentinel",
    };
    jest.useFakeTimers();
    jest.setSystemTime(epoch);
    post.mockReset();
    (axios.create as jest.Mock).mockReturnValue({ post });
  });
  afterEach(() => {
    process.env = previous;
    jest.useRealTimers();
  });

  it("accepts an actual controller-produced fixture through the public validator", () => {
    expect(validateSnapshot(controllerFixture.snapshot).clientToken).toBe(
      "synthetic-token",
    );
  });

  it("mints once, hands off accepted tokens, rotates secrets, and never re-reads credentials", async () => {
    const settings = credentialSettings();
    post
      .mockResolvedValueOnce(grant())
      .mockResolvedValueOnce(response("first-token"))
      .mockImplementation(() => Promise.resolve(response("second-token")));
    const state = new RuntimeState((signal, token) =>
      credentialSnapshot(settings, signal, token),
    );
    await state.start();
    expect(state.config(settings.controllerUrl).clientSecret).toBeUndefined();
    expect(post.mock.calls[0][2].headers).toEqual({
      "x-client-id": "client",
      "x-client-secret": "credential-sentinel",
      "Content-Type": "application/json",
    });
    expect(post.mock.calls[1][2].headers["x-client-token"]).toBe("grant-token");
    process.env = {};
    await jest.advanceTimersByTimeAsync(120000);
    expect(post.mock.calls[2][2].headers).toEqual({
      "x-client-token": "first-token",
      "Content-Type": "application/json",
    });
    await jest.advanceTimersByTimeAsync(120000);
    expect(post.mock.calls[3][2].headers["x-client-token"]).toBe(
      "second-token",
    );
    expect(
      post.mock.calls.filter(([url]) => url.endsWith("/auth/token")),
    ).toHaveLength(1);
    expect(await state.token()).toBe("second-token");
    await state.close();
  });

  it.each([401, 403])(
    "never re-mints after snapshot denial %s; reinitialization reads new credentials",
    async (status) => {
      const settings = credentialSettings();
      post
        .mockResolvedValueOnce(grant())
        .mockResolvedValueOnce(response())
        .mockResolvedValue({ status, headers: {}, data: "private" });
      const state = new RuntimeState((signal, token) =>
        credentialSnapshot(settings, signal, token),
      );
      await state.start();
      await jest.advanceTimersByTimeAsync(120000);
      await expect(state.token()).rejects.toThrow("authorization-denied");
      const calls = post.mock.calls.length;
      await jest.advanceTimersByTimeAsync(900000);
      expect(post).toHaveBeenCalledTimes(calls);
      await state.close();
      process.env.MISO_CLIENTSECRET = "rotated";
      post.mockResolvedValueOnce(grant()).mockResolvedValueOnce(response());
      await credentialSnapshot(settings, new AbortController().signal);
      expect(post.mock.calls[calls][2].headers["x-client-secret"]).toBe(
        "rotated",
      );
    },
  );

  it("does not send an expired snapshot token or mint after a prolonged outage", async () => {
    const settings = credentialSettings();
    post
      .mockResolvedValueOnce(grant())
      .mockResolvedValueOnce(response())
      .mockResolvedValue({
        status: 503,
        headers: { "retry-after": "0" },
        data: "",
      });
    const state = new RuntimeState((signal, token) =>
      credentialSnapshot(settings, signal, token),
    );
    await state.start();
    // A clock jump models suspension: no timer refresh can run before expiry.
    jest.setSystemTime(epoch + 270000);
    await expect(state.token()).rejects.toThrow("unavailable");
    await jest.advanceTimersByTimeAsync(120000);
    await expect(state.token()).rejects.toThrow("unavailable");
    expect(post).toHaveBeenCalledTimes(2);
    await state.close();
  });

  it("never reuses an explicitly rejected token to fetch its replacement", async () => {
    const settings = credentialSettings();
    post.mockResolvedValueOnce(grant()).mockResolvedValueOnce(response());
    const state = new RuntimeState((signal, token) =>
      credentialSnapshot(settings, signal, token),
    );
    await state.start();
    await state.response(
      401,
      { code: "bootstrap_token_expired" },
      "snapshot-token",
    );
    await jest.advanceTimersByTimeAsync(120000);
    await expect(state.token()).rejects.toThrow("unavailable");
    expect(post).toHaveBeenCalledTimes(2);
    await state.close();
  });

  it.each(["MISO_CLIENTID", "MISO_CLIENTSECRET"])(
    "fails safely without %s",
    async (key) => {
      delete process.env[key];
      await expect(
        credentialSnapshot(credentialSettings(), new AbortController().signal),
      ).rejects.toThrow("invalid-settings");
      expect(post).not.toHaveBeenCalled();
    },
  );

  it("supports underscore aliases and prefers nonempty canonical names", async () => {
    process.env.MISO_CLIENT_ID = "alias-id";
    process.env.MISO_CLIENT_SECRET = "alias-secret";
    post.mockResolvedValue(grant());
    await mintClientToken(
      credentialSettings().tokenUrl,
      new AbortController().signal,
    );
    expect(post.mock.calls[0][2].headers["x-client-id"]).toBe("client");
    delete process.env.MISO_CLIENTID;
    delete process.env.MISO_CLIENTSECRET;
    await mintClientToken(
      credentialSettings().tokenUrl,
      new AbortController().signal,
    );
    expect(post.mock.calls[1][2].headers["x-client-id"]).toBe("alias-id");
    expect(post.mock.calls[1][2].headers["x-client-secret"]).toBe(
      "alias-secret",
    );
  });

  it.each([
    null,
    {},
    { token: "" },
    { token: "t", expiresIn: 900, expiresAt: "invalid" },
    {
      token: "t",
      expiresIn: 0,
      expiresAt: new Date(epoch + 900000).toISOString(),
    },
    { token: "t", expiresIn: 900, expiresAt: new Date(epoch).toISOString() },
  ])("rejects malformed grants %#", async (data) => {
    post.mockResolvedValue({
      status: 201,
      headers: {},
      data: JSON.stringify({ data }),
    });
    await expect(
      credentialSnapshot(credentialSettings(), new AbortController().signal),
    ).rejects.toThrow("protocol-error");
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each([200, 302, 401, 403])(
    "rejects grant status %s without retry or leaking raw diagnostics",
    async (status) => {
      post.mockResolvedValue({
        status,
        headers: {},
        data: "credential-sentinel",
      });
      const error = await credentialSnapshot(
        credentialSettings(),
        new AbortController().signal,
      ).catch((e) => e);
      expect(error.code).toBe(
        [401, 403].includes(status) ? "authorization-denied" : "protocol-error",
      );
      expect(
        String(error) + JSON.stringify(error) + inspect(error),
      ).not.toContain("credential-sentinel");
      expect(post).toHaveBeenCalledTimes(1);
    },
  );

  it("sanitizes raw Axios errors and cancels transport that ignores its signal", async () => {
    post.mockRejectedValueOnce(
      Object.assign(new Error("credential-sentinel"), {
        config: { headers: { secret: "credential-sentinel" } },
      }),
    );
    const error = await credentialSnapshot(
      credentialSettings(),
      new AbortController().signal,
    ).catch((e) => e);
    expect(inspect(error)).not.toContain("credential-sentinel");
    expect(error.cause).toBeUndefined();
    post.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const work = credentialSnapshot(credentialSettings(), controller.signal);
    controller.abort();
    await expect(work).rejects.toThrow("unavailable");
  });

  it("honors cancellation before starting either endpoint", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      credentialSnapshot(credentialSettings(), controller.signal),
    ).rejects.toThrow("unavailable");
    expect(post).not.toHaveBeenCalled();
  });

  it.each([
    "http://miso.test",
    "https://id:secret@miso.test",
    "https://miso.test?token=secret",
    "https://miso.test#secret",
  ])("rejects unsafe controller URL %s", (url) => {
    process.env.MISO_CONTROLLER_URL = url;
    expect(() => credentialSettings()).toThrow("invalid-settings");
  });
});
