import type {
  BrowserSessionClient,
  SessionRestoreFailureReason,
  SessionRestoreResult,
  SessionRestoreSuccess,
} from "../../src/types/browser-session.types";
import {
  recoverBrowserSessionOrThrow,
  recoverBrowserSessionToUserToken,
  recoverBrowserSessionWithStaleCleanup,
  resolveSessionExpiresInSeconds,
} from "../../src/utils/browser-session-recovery";

function success(token: string, expiresIn?: number): SessionRestoreSuccess {
  return {
    ok: true,
    accessToken: token,
    expiresIn,
    expiresAt: expiresIn ? undefined : "2030-01-01T00:00:00.000Z",
  };
}

function failure(reason: SessionRestoreFailureReason): SessionRestoreResult {
  return { ok: false, reason, message: `failed:${reason}` };
}

function createMockClient(handlers: {
  refresh: () => Promise<SessionRestoreResult>;
  restore: () => Promise<SessionRestoreResult>;
}): BrowserSessionClient {
  return {
    refresh: handlers.refresh,
    restore: handlers.restore,
  };
}

describe("browser-session-recovery", () => {
  describe("resolveSessionExpiresInSeconds", () => {
    it("prefers numeric expiresIn", () => {
      expect(resolveSessionExpiresInSeconds(success("t", 120))).toBe(120);
    });

    it("derives seconds from expiresAt when expiresIn missing", () => {
      const future = new Date(Date.now() + 90_000).toISOString();
      expect(
        resolveSessionExpiresInSeconds({
          ok: true,
          accessToken: "t",
          expiresAt: future,
        }),
      ).toBeGreaterThanOrEqual(89);
    });

    it("returns zero when no expiry metadata", () => {
      expect(
        resolveSessionExpiresInSeconds({
          ok: true,
          accessToken: "t",
        }),
      ).toBe(0);
    });
  });

  describe("recoverBrowserSessionWithStaleCleanup", () => {
    it("returns refresh result when refresh succeeds", async () => {
      const client = createMockClient({
        refresh: async () => success("from-refresh"),
        restore: async () => failure("network"),
      });

      const result = await recoverBrowserSessionWithStaleCleanup({ client });
      expect(result).toEqual(success("from-refresh"));
    });

    it("falls back to restore when refresh fails", async () => {
      const client = createMockClient({
        refresh: async () => failure("network"),
        restore: async () => success("from-restore"),
      });

      const result = await recoverBrowserSessionWithStaleCleanup({ client });
      expect(result).toEqual(success("from-restore"));
    });

    it("clears stale state and retries on invalid/unauthorized", async () => {
      const clearStaleState = jest.fn();
      let refreshCount = 0;
      let restoreCount = 0;

      const client = createMockClient({
        refresh: async () => {
          refreshCount += 1;
          if (refreshCount === 1) {
            return failure("unauthorized");
          }
          return success("after-clear");
        },
        restore: async () => {
          restoreCount += 1;
          if (restoreCount === 1) {
            return failure("invalid");
          }
          return failure("network");
        },
      });

      const result = await recoverBrowserSessionWithStaleCleanup({
        client,
        clearStaleState,
      });

      expect(clearStaleState).toHaveBeenCalledTimes(1);
      expect(result).toEqual(success("after-clear"));
      expect(refreshCount).toBe(2);
      expect(restoreCount).toBe(1);
    });

    it("skips stale cleanup when failure is not stale", async () => {
      const clearStaleState = jest.fn();
      const client = createMockClient({
        refresh: async () => failure("network"),
        restore: async () => failure("server"),
      });

      const result = await recoverBrowserSessionWithStaleCleanup({
        client,
        clearStaleState,
      });

      expect(clearStaleState).not.toHaveBeenCalled();
      expect(result.ok).toBe(false);
    });
  });

  describe("recoverBrowserSessionToUserToken", () => {
    it("maps successful recovery to UserSessionTokenResult", async () => {
      const client = createMockClient({
        refresh: async () => success("token-1", 300),
        restore: async () => failure("network"),
      });

      await expect(
        recoverBrowserSessionToUserToken({ client }),
      ).resolves.toEqual({
        token: "token-1",
        expiresIn: 300,
        expiresAt: undefined,
      });
    });

    it("returns null when recovery fails", async () => {
      const client = createMockClient({
        refresh: async () => failure("network"),
        restore: async () => failure("network"),
      });

      await expect(
        recoverBrowserSessionToUserToken({ client }),
      ).resolves.toBeNull();
    });
  });

  describe("recoverBrowserSessionOrThrow", () => {
    it("throws when recovery fails", async () => {
      const client = createMockClient({
        refresh: async () => failure("network"),
        restore: async () => failure("network"),
      });

      await expect(recoverBrowserSessionOrThrow({ client })).rejects.toThrow(
        "Silent browser re-auth failed",
      );
    });

    it("returns token and expiresIn on success", async () => {
      const client = createMockClient({
        refresh: async () => success("ok-token", 60),
        restore: async () => failure("network"),
      });

      await expect(recoverBrowserSessionOrThrow({ client })).resolves.toEqual({
        token: "ok-token",
        expiresIn: 60,
      });
    });
  });
});
