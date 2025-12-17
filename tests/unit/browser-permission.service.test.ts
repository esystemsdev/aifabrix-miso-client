/**
 * Unit tests for BrowserPermissionService
 */

import { BrowserPermissionService } from "../../src/services/browser-permission.service";
import { HttpClient } from "../../src/utils/http-client";
import { CacheService } from "../../src/services/cache.service";
import { MisoClientConfig } from "../../src/types/config.types";

// Mock dependencies
jest.mock("../../src/utils/http-client");
jest.mock("../../src/services/cache.service");
jest.mock("../../src/utils/browser-jwt-decoder");

const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;

// Mock browser JWT decoder
jest.mock("../../src/utils/browser-jwt-decoder", () => ({
  decodeJWT: jest.fn(),
  extractUserIdFromToken: jest.fn(),
}));

const { decodeJWT } = require("../../src/utils/browser-jwt-decoder");

describe("BrowserPermissionService", () => {
  let permissionService: BrowserPermissionService;
  let config: MisoClientConfig;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      cache: { permissionTTL: 900 },
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      validateTokenRequest: jest.fn(),
    } as any;
    (mockHttpClient as any).config = config; // Add config to httpClient for access

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedCacheService.mockImplementation(() => mockCacheService);

    permissionService = new BrowserPermissionService(
      mockHttpClient,
      mockCacheService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getPermissions", () => {
    it("should return cached permissions from cache", async () => {
      const cachedPermissions = {
        permissions: ["read:users", "write:posts"],
        timestamp: Date.now(),
      };
      mockCacheService.get.mockResolvedValue(cachedPermissions);
      // Mock JWT decode to return userId - avoids validate API call
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("permissions:123");
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it("should fetch permissions from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        permissions: ["read:users", "write:posts"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      // Only one call - to get permissions (userId extracted from token)
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/permissions",
        "token",
        undefined,
        undefined,
        undefined,
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "permissions:123",
        expect.objectContaining({
          permissions: ["read:users", "write:posts"],
        }),
        900,
      );
    });

    it("should fetch userId from validate endpoint if not in token", async () => {
      mockCacheService.get.mockResolvedValue(null);
      decodeJWT.mockReturnValue(null); // No userId in token
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "456" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "456",
        permissions: ["read:users"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users"]);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/permissions",
        "token",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should return empty array on error", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockRejectedValue(new Error("Cache error"));

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });

    it("should return empty array if userId cannot be determined", async () => {
      mockCacheService.get.mockResolvedValue(null);
      decodeJWT.mockReturnValue(null);
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: {},
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });
  });

  describe("hasPermission", () => {
    it("should return true if user has permission", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:posts"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasPermission("token", "read:users");

      expect(result).toBe(true);
    });

    it("should return false if user does not have permission", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasPermission(
        "token",
        "write:posts",
      );

      expect(result).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true if user has any permission", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAnyPermission("token", [
        "read:users",
        "write:posts",
      ]);

      expect(result).toBe(true);
    });

    it("should return false if user has none of the permissions", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAnyPermission("token", [
        "write:posts",
        "delete:users",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true if user has all permissions", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:posts"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:posts",
      ]);

      expect(result).toBe(true);
    });

    it("should return false if user missing any permission", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:posts",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("refreshPermissions", () => {
    it("should fetch fresh permissions and update cache", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        permissions: ["read:users", "write:posts"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/permissions/refresh",
        "token",
        undefined,
        undefined,
        undefined,
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "permissions:123",
        expect.objectContaining({
          permissions: ["read:users", "write:posts"],
        }),
        900,
      );
    });

    it("should return empty array if userId cannot be determined", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: {},
      });

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });
  });

  describe("clearPermissionsCache", () => {
    it("should clear cached permissions", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:123");
    });

    it("should handle errors gracefully", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        permissionService.clearPermissionsCache("token"),
      ).resolves.not.toThrow();
    });
  });
});

