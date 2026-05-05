import jwt from "jsonwebtoken";
import {
  normalizeExpiresAt,
  getJwtExpiresAt,
  getEffectiveUserTokenRefreshBuffer,
  getUserTokenRefreshDueAt,
  isUserTokenRefreshDue,
  isUserTokenExpired,
  storeAccessToken,
  storeRefreshToken,
  clearStoredAccessToken,
  clearStoredRefreshToken,
  clearStoredSessionTokens,
  getStoredRefreshToken,
  getUserTokenExpiresAt,
  UserTokenRefreshManager,
} from "../../src/utils/user-token-refresh";

jest.mock("jsonwebtoken", () => ({
  decode: jest.fn(),
}));

const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe("user-token-refresh utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedJwt.decode.mockReturnValue(null);
  });

  describe("normalizeExpiresAt", () => {
    it("normalizes epoch seconds", () => {
      const result = normalizeExpiresAt(1714881000);
      expect(result?.toISOString()).toBe("2024-05-05T03:50:00.000Z");
    });

    it("normalizes epoch milliseconds", () => {
      const result = normalizeExpiresAt(1714881000000);
      expect(result?.toISOString()).toBe("2024-05-05T03:50:00.000Z");
    });

    it("normalizes ISO string with Z", () => {
      const result = normalizeExpiresAt("2026-05-05T10:00:00Z");
      expect(result?.toISOString()).toBe("2026-05-05T10:00:00.000Z");
    });

    it("returns null for invalid values", () => {
      expect(normalizeExpiresAt("bad-date")).toBeNull();
      expect(normalizeExpiresAt(undefined)).toBeNull();
    });
  });

  describe("JWT expiration helpers", () => {
    it("extracts expiration from exp claim", () => {
      mockedJwt.decode.mockReturnValue({ exp: 1714881000 } as any);
      const result = getJwtExpiresAt("token");
      expect(result?.toISOString()).toBe("2024-05-05T03:50:00.000Z");
    });

    it("supports expiresAt/expires_at claim aliases", () => {
      mockedJwt.decode.mockReturnValue({
        expires_at: "2026-05-05T10:00:00Z",
      } as any);
      const result = getJwtExpiresAt("token");
      expect(result?.toISOString()).toBe("2026-05-05T10:00:00.000Z");
    });
  });

  describe("refresh timing", () => {
    const now = new Date("2026-05-05T10:00:00.000Z");

    it("uses adaptive buffer with min/max clamp", () => {
      const expiresAt = new Date("2026-05-05T10:10:00.000Z");
      const issuedAt = new Date("2026-05-05T10:00:00.000Z");
      const result = getEffectiveUserTokenRefreshBuffer(
        expiresAt,
        5,
        issuedAt,
        now,
      );
      expect(result).toBe(60);
    });

    it("falls back to default buffer when expiry is invalid", () => {
      const result = getEffectiveUserTokenRefreshBuffer(
        "invalid",
        120,
        undefined,
        now,
      );
      expect(result).toBe(120);
    });

    it("calculates due timestamp and due checks", () => {
      const expiresAt = new Date("2026-05-05T10:05:00.000Z");
      const dueAt = getUserTokenRefreshDueAt(expiresAt, 60, undefined, now);
      expect(dueAt?.toISOString()).toBe("2026-05-05T10:04:00.000Z");
      expect(isUserTokenRefreshDue(expiresAt, 60, undefined, now)).toBe(false);
      expect(
        isUserTokenRefreshDue(
          expiresAt,
          60,
          undefined,
          new Date("2026-05-05T10:04:01.000Z"),
        ),
      ).toBe(true);
    });

    it("checks expiration", () => {
      expect(
        isUserTokenExpired(
          "2026-05-05T09:59:59.000Z",
          new Date("2026-05-05T10:00:00.000Z"),
        ),
      ).toBe(true);
      expect(
        isUserTokenExpired(
          "2026-05-05T10:00:01.000Z",
          new Date("2026-05-05T10:00:00.000Z"),
        ),
      ).toBe(false);
    });
  });

  describe("storage lifecycle", () => {
    it("stores/reads refresh token with compatibility keys", () => {
      const storage: Record<string, unknown> = {};
      storeRefreshToken(storage, "r1");
      expect(getStoredRefreshToken(storage)).toBe("r1");
      expect(storage["refreshToken"]).toBe("r1");
      expect(storage["miso:user-refresh-token"]).toBe("r1");
    });

    it("preserves expiry metadata when token is unchanged", () => {
      const storage: Record<string, unknown> = {};
      storeAccessToken(storage, "a1", "2026-05-05T10:10:00Z");
      storeAccessToken(storage, "a1");
      expect(getUserTokenExpiresAt(storage)?.toISOString()).toBe(
        "2026-05-05T10:10:00.000Z",
      );
    });

    it("clears expiry metadata when token changes without expiry", () => {
      const storage: Record<string, unknown> = {};
      storeAccessToken(storage, "a1", "2026-05-05T10:10:00Z");
      storeAccessToken(storage, "a2");
      expect(getUserTokenExpiresAt(storage)).toBeNull();
    });

    it("clears stored values", () => {
      const storage: Record<string, unknown> = {};
      storeAccessToken(storage, "a1", "2026-05-05T10:10:00Z");
      storeRefreshToken(storage, "r1");

      clearStoredAccessToken(storage);
      expect(storage["token"]).toBeUndefined();
      expect(storage["miso_token_expires_at"]).toBeUndefined();

      storeAccessToken(storage, "a2");
      storeRefreshToken(storage, "r2");
      clearStoredRefreshToken(storage);
      expect(storage["refreshToken"]).toBeUndefined();

      storeAccessToken(storage, "a3");
      storeRefreshToken(storage, "r3");
      clearStoredSessionTokens(storage);
      expect(storage["token"]).toBeUndefined();
      expect(storage["refreshToken"]).toBeUndefined();
    });
  });

  describe("UserTokenRefreshManager", () => {
    it("refreshes token when due", async () => {
      const manager = new UserTokenRefreshManager();
      mockedJwt.decode.mockReturnValue({
        exp: Math.floor(new Date("2026-05-05T10:01:00.000Z").getTime() / 1000),
        iat: Math.floor(new Date("2026-05-05T10:00:00.000Z").getTime() / 1000),
      } as any);
      manager.storeAccessToken("u1", "old");

      const callback = jest.fn().mockResolvedValue({
        token: "new",
        expiresAt: "2026-05-05T11:00:00.000Z",
      });
      manager.registerRefreshCallback("u1", callback);

      const result = await manager.refreshIfDue(
        "u1",
        120,
        new Date("2026-05-05T10:00:30.000Z"),
      );
      expect(result?.token).toBe("new");
      expect(manager.getAccessToken("u1")).toBe("new");
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("does not refresh token when not due", async () => {
      const manager = new UserTokenRefreshManager();
      mockedJwt.decode.mockReturnValue({
        exp: Math.floor(new Date("2026-05-05T11:00:00.000Z").getTime() / 1000),
        iat: Math.floor(new Date("2026-05-05T10:00:00.000Z").getTime() / 1000),
      } as any);
      manager.storeAccessToken("u1", "stable");

      const callback = jest.fn().mockResolvedValue({ token: "new" });
      manager.registerRefreshCallback("u1", callback);

      const result = await manager.refreshIfDue(
        "u1",
        120,
        new Date("2026-05-05T10:10:00.000Z"),
      );
      expect(result).toBeNull();
      expect(callback).not.toHaveBeenCalled();
    });
  });
});
