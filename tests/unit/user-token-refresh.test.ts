import jwt from "jsonwebtoken";
import {
  normalizeExpiresAt,
  getJwtExpiresAt,
  getEffectiveUserTokenRefreshBuffer,
  getUserTokenRefreshDueAt,
  isUserTokenRefreshDue,
  isUserTokenExpired,
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

  describe("UserTokenRefreshManager", () => {
    it("stores and clears canonical tokens", () => {
      const manager = new UserTokenRefreshManager();
      manager.storeAccessToken("u1", "access", "2026-05-05T10:10:00Z");
      manager.storeRefreshToken("u1", "refresh");

      expect(manager.getAccessToken("u1")).toBe("access");
      expect(manager.getRefreshToken("u1")).toBe("refresh");
      expect(manager.getExpiresAt("u1")?.toISOString()).toBe(
        "2026-05-05T10:10:00.000Z",
      );

      manager.clearUserTokens("u1");
      expect(manager.getAccessToken("u1")).toBeNull();
      expect(manager.getRefreshToken("u1")).toBeNull();
      expect(manager.getExpiresAt("u1")).toBeNull();
    });

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

    it("returns null when callback throws", async () => {
      const manager = new UserTokenRefreshManager();
      manager.storeAccessToken("u1", "stable", "2026-05-05T10:00:00.000Z");
      manager.registerRefreshCallback(
        "u1",
        jest.fn().mockRejectedValue(new Error("boom")),
      );
      const result = await manager.refreshIfDue(
        "u1",
        60,
        new Date("2026-05-05T10:00:30.000Z"),
      );
      expect(result).toBeNull();
    });

    it("does not persist refresh token from callback in strict hard-cut flow", async () => {
      const manager = new UserTokenRefreshManager();
      mockedJwt.decode.mockReturnValue({
        exp: Math.floor(new Date("2026-05-05T10:01:00.000Z").getTime() / 1000),
        iat: Math.floor(new Date("2026-05-05T10:00:00.000Z").getTime() / 1000),
      } as any);
      manager.storeAccessToken("u1", "old");
      manager.storeRefreshToken("u1", "seeded-device-refresh-token");

      manager.registerRefreshCallback(
        "u1",
        jest.fn().mockResolvedValue({
          token: "new",
          expiresAt: "2026-05-05T11:00:00.000Z",
          refreshToken: "should-not-overwrite",
        }),
      );

      await manager.refreshIfDue(
        "u1",
        120,
        new Date("2026-05-05T10:00:30.000Z"),
      );

      expect(manager.getAccessToken("u1")).toBe("new");
      expect(manager.getRefreshToken("u1")).toBe("seeded-device-refresh-token");
    });
  });
});
