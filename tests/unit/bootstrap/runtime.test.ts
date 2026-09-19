import { RuntimeState, createRuntime } from "../../../src/bootstrap/runtime";
import {
  BootstrapError,
  BootstrapSnapshot,
} from "../../../src/bootstrap/types";
import { getRuntimeGuard } from "../../../src/utils/runtime-guard";
import { MisoClientConfig } from "../../../src/types/config.types";

jest.mock("../../../src/miso-client", () => ({
  MisoClient: jest.fn().mockImplementation(() => ({
    initialize: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
  })),
}));
const epoch = Date.parse("2030-01-01T00:00:00Z");
function snapshot(value = "sentinel"): BootstrapSnapshot {
  return {
    protocolVersion: 1,
    issuedAt: new Date(Date.now()).toISOString(),
    context: { installationId: "i", applicationId: "a", environmentId: "e" },
    clientId: "client",
    clientToken: "miso-token",
    configuration: { DATABASE_URL: value },
    refreshAfter: new Date(Date.now() + 120000).toISOString(),
    clientTokenExpiresAt: new Date(Date.now() + 300000).toISOString(),
    expiresAt: new Date(Date.now() + 900000).toISOString(),
  };
}

describe("secrets lifecycle", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(epoch);
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("preserves local snapshot and optional values, makes close idempotent and guards retained client", async () => {
    const state = new RuntimeState();
    state.local({ DATABASE_URL: "local-sentinel", EMPTY: "" });
    const config: MisoClientConfig = {
      clientId: "legacy",
      clientSecret: "legacy",
    };
    const runtime = await createRuntime(state, config);
    expect(runtime.context).toBeUndefined();
    expect(runtime.secrets.require("DATABASE_URL")).toBe("local-sentinel");
    expect(runtime.secrets.get("EMPTY")).toBe("");
    expect(runtime.secrets.get("toString")).toBeUndefined();
    expect(() => runtime.secrets.require("EMPTY")).toThrow("missing-secret");
    const invalidated = jest.fn();
    runtime.onInvalidated(invalidated);
    await runtime.close();
    await runtime.close();
    expect(invalidated).toHaveBeenCalledTimes(1);
    expect(runtime.client.disconnect).toHaveBeenCalledTimes(1);
    await expect(getRuntimeGuard(config)!.token()).rejects.toThrow("closed");
    expect(() => runtime.secrets.get("missing")).toThrow("closed");
  });

  it("keeps close idempotent when an invalidation listener closes recursively", async () => {
    const state = new RuntimeState();
    state.local({ KEY: "secret" });
    const runtime = await createRuntime(state, {
      clientId: "local",
      clientSecret: "local",
    });
    runtime.onInvalidated(() => {
      void runtime.close();
    });
    await runtime.close();
    expect(runtime.client.disconnect).toHaveBeenCalledTimes(1);
  });

  it("does not extend deadlines when the wall clock moves backward", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValue(new BootstrapError("unavailable"));
    const state = new RuntimeState(fetch);
    await state.start();
    const runtime = await createRuntime(
      state,
      state.config("https://miso.test"),
    );
    await jest.advanceTimersByTimeAsync(269000);
    expect(await state.token()).toBe("miso-token");
    jest.setSystemTime(epoch);
    await jest.advanceTimersByTimeAsync(1000);
    await expect(state.token()).rejects.toThrow("unavailable");
    expect(runtime.secrets.get("DATABASE_URL")).toBe("sentinel");
    await runtime.close();
  });

  it("atomically rotates secrets and isolates listener failures", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockImplementation(() => Promise.resolve(snapshot("new-sentinel")));
    const state = new RuntimeState(fetch);
    await state.start();
    const runtime = await createRuntime(
      state,
      state.config("https://miso.test"),
    );
    runtime.onSecretsChanged(() => {
      throw new Error("secret listener error");
    });
    const changed = jest.fn();
    const unsubscribe = runtime.onSecretsChanged(changed);
    await jest.advanceTimersByTimeAsync(120000);
    expect(changed).toHaveBeenCalledWith(["DATABASE_URL"]);
    expect(runtime.secrets.require("DATABASE_URL")).toBe("new-sentinel");
    unsubscribe();
    await runtime.close();
  });

  it.each(["authorization-denied", "protocol-error"])(
    "invalidates cached tokens and secrets on %s",
    async (code) => {
      const fetch = jest
        .fn()
        .mockResolvedValueOnce(snapshot())
        .mockRejectedValue(new BootstrapError(code));
      const state = new RuntimeState(fetch);
      await state.start();
      const config = state.config("https://miso.test");
      const runtime = await createRuntime(state, config);
      const event = jest.fn();
      runtime.onInvalidated(event);
      await jest.advanceTimersByTimeAsync(120000);
      await expect(getRuntimeGuard(config)!.token()).rejects.toThrow(code);
      expect(() => runtime.secrets.get("DATABASE_URL")).toThrow(code);
      expect(event).toHaveBeenCalledWith(code);
      await runtime.close();
    },
  );

  it("keeps independent deadlines during outage and rate-limits refresh", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockRejectedValue(new BootstrapError("unavailable"));
    const state = new RuntimeState(fetch);
    await state.start();
    const runtime = await createRuntime(
      state,
      state.config("https://miso.test"),
    );
    await jest.advanceTimersByTimeAsync(270000);
    await expect(state.token()).rejects.toThrow("unavailable");
    expect(runtime.secrets.get("DATABASE_URL")).toBe("sentinel");
    const calls = fetch.mock.calls.length;
    await Promise.allSettled([state.token(), state.token(), state.token()]);
    expect(fetch.mock.calls.length).toBe(calls);
    await jest.advanceTimersByTimeAsync(600000);
    expect(() => runtime.secrets.get("DATABASE_URL")).toThrow(
      "snapshot-expired",
    );
    await runtime.close();
  });

  it("does not resurrect state when closed during refresh", async () => {
    let resolve!: (value: BootstrapSnapshot) => void;
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockImplementation(
        () =>
          new Promise((r) => {
            resolve = r;
          }),
      );
    const state = new RuntimeState(fetch);
    await state.start();
    const runtime = await createRuntime(
      state,
      state.config("https://miso.test"),
    );
    await jest.advanceTimersByTimeAsync(120000);
    await runtime.close();
    resolve(snapshot("late"));
    await Promise.resolve();
    expect(() => runtime.secrets.get("DATABASE_URL")).toThrow("closed");
    expect(jest.getTimerCount()).toBe(0);
  });

  it("rejects changed context before replacing state", async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(snapshot())
      .mockImplementation(async () => ({
        ...snapshot(),
        context: {
          installationId: "other",
          applicationId: "a",
          environmentId: "e",
        },
      }));
    const state = new RuntimeState(fetch);
    await state.start();
    const runtime = await createRuntime(
      state,
      state.config("https://miso.test"),
    );
    await jest.advanceTimersByTimeAsync(120000);
    expect(() => runtime.secrets.get("DATABASE_URL")).toThrow("protocol-error");
    await runtime.close();
  });
});
