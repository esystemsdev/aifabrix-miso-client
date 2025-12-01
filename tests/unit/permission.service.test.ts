/**
 * Unit tests for PermissionService
 */

import { PermissionService } from "../../src/services/permission.service";
import { HttpClient } from "../../src/utils/http-client";
import { CacheService } from "../../src/services/cache.service";
import { MisoClientConfig } from "../../src/types/config.types";

// Mock dependencies
jest.mock("../../src/utils/http-client");
jest.mock("../../src/services/cache.service");
jest.mock("jsonwebtoken");

const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;
const jwt = require("jsonwebtoken");

describe("PermissionService", () => {
  let permissionService: PermissionService;
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

    permissionService = new PermissionService(mockHttpClient, mockCacheService);
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
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("permissions:123");
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it("should fetch permissions from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
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
        expect.objectContaining({ permissions: ["read:users", "write:posts"] }),
        900,
      );
    });

    it("should handle cache miss gracefully", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        permissions: ["read:users"],
        environment: "dev",
        application: "test-app",
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("permissions:123");
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should handle invalid cached data", async () => {
      // CacheService handles JSON parsing, so invalid data becomes null
      mockCacheService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        permissions: ["read:users"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users"]);
      // Only one call - to get permissions (userId extracted from token)
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when user validation fails", async () => {
      // JWT decode returns null (no userId in token)
      jwt.decode.mockReturnValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({});

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });

    it("should handle network errors gracefully", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.authenticatedRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });

    it("should handle JWT decode failure gracefully", async () => {
      // Mock JWT decode to throw error
      jwt.decode.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      const result = await permissionService.getPermissions("invalid-token");

      expect(result).toEqual([]);
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has permission", async () => {
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:posts"],
        timestamp: Date.now(),
      });
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.hasPermission(
        "token",
        "read:users",
      );

      expect(result).toBe(true);
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it("should return false when user does not have permission", async () => {
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.hasPermission(
        "token",
        "write:posts",
      );

      expect(result).toBe(false);
    });
  });

  describe("hasAnyPermission", () => {
    it("should return true when user has any of the permissions", async () => {
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:posts"],
        timestamp: Date.now(),
      });
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.hasAnyPermission("token", [
        "write:posts",
        "delete:users",
      ]);

      expect(result).toBe(true);
    });

    it("should return false when user has none of the permissions", async () => {
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.hasAnyPermission("token", [
        "write:posts",
        "delete:users",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("hasAllPermissions", () => {
    it("should return true when user has all permissions", async () => {
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:posts", "delete:users"],
        timestamp: Date.now(),
      });
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:posts",
      ]);

      expect(result).toBe(true);
    });

    it("should return false when user is missing some permissions", async () => {
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:posts",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("refreshPermissions", () => {
    it("should fetch fresh permissions from controller", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValueOnce({
        user: { id: "123" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValueOnce({
        userId: "123",
        permissions: ["read:users", "write:posts"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
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
        expect.objectContaining({ permissions: ["read:users", "write:posts"] }),
        900,
      );
    });

    it("should handle errors during refresh", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });

    it("should return empty array when user validation fails", async () => {
      // Mock JWT decode to return userId, but validate returns empty
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValueOnce({});

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });
  });

  describe("clearPermissionsCache", () => {
    it("should clear cached permissions from cache", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:123");
    });

    it("should handle cache delete failure gracefully", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockCacheService.delete.mockResolvedValue(false);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:123");
    });

    it("should handle user validation failure", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({});

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        permissionService.clearPermissionsCache("token"),
      ).resolves.not.toThrow();
    });

    it("should handle cache delete error gracefully", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockCacheService.delete.mockRejectedValue(
        new Error("Cache delete failed"),
      );

      await expect(
        permissionService.clearPermissionsCache("token"),
      ).resolves.not.toThrow();
    });

    it("should extract userId from validate API when clearing cache", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "456" },
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:456");
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
    });

    it("should handle different user IDs from validate API when clearing cache", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "789" },
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:789");
    });

    it("should always use validate API to get userId for clearing cache", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "999" },
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:999");
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
    });
  });

  describe("extractUserIdFromToken edge cases", () => {
    it("should extract userId from id field when sub is not present", async () => {
      jwt.decode.mockReturnValue({ id: "user-from-id" });
      mockCacheService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "user-from-id",
        permissions: ["read:test"],
        environment: "dev",
        application: "test-app",
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:test"]);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        "permissions:user-from-id",
      );
    });

    it("should handle JWT decode returning empty object", async () => {
      jwt.decode.mockReturnValue({});
      mockCacheService.get.mockResolvedValue(null);
      mockHttpClient.validateTokenRequest.mockResolvedValueOnce({
        user: { id: "123" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValueOnce({
        userId: "123",
        permissions: ["read:test"],
        environment: "dev",
        application: "test-app",
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:test"]);
    });

    it("should handle permissions array in response correctly", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        permissions: ["perm1", "perm2", "perm3"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["perm1", "perm2", "perm3"]);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "permissions:123",
        expect.objectContaining({ permissions: ["perm1", "perm2", "perm3"] }),
        900,
      );
    });

    it("should handle empty permissions array", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        permissions: [],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });
  });

  describe("permission checking edge cases", () => {
    it("should handle empty permissions array in hasPermission", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: [],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasPermission(
        "token",
        "read:users",
      );

      expect(result).toBe(false);
    });

    it("should handle permission check with multiple matching permissions", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:users", "delete:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasPermission(
        "token",
        "write:users",
      );

      expect(result).toBe(true);
    });

    it("should handle hasAnyPermission with empty array input", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAnyPermission("token", []);

      expect(result).toBe(false);
    });

    it("should handle hasAllPermissions with empty array input", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAllPermissions("token", []);

      expect(result).toBe(true); // Empty array should return true
    });

    it("should handle hasAllPermissions with exact match", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users", "write:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:users",
      ]);

      expect(result).toBe(true);
    });

    it("should handle hasAllPermissions with one permission missing", async () => {
      jwt.decode.mockReturnValue({ sub: "123" });
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:users",
        "delete:users",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("refreshPermissions edge cases", () => {
    it("should handle refresh when userId extracted from token", async () => {
      jwt.decode.mockReturnValue({ sub: "refresh-user" });
      mockHttpClient.validateTokenRequest.mockResolvedValueOnce({
        user: { id: "refresh-user" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValueOnce({
        userId: "refresh-user",
        permissions: ["refresh:perm"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual(["refresh:perm"]);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/permissions/refresh",
        "token",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should handle refresh when cache update fails", async () => {
      jwt.decode.mockReturnValue({ sub: "refresh-user" });
      mockHttpClient.validateTokenRequest.mockResolvedValueOnce({
        user: { id: "refresh-user" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValueOnce({
        userId: "refresh-user",
        permissions: ["perm1"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(false);

      const result = await permissionService.refreshPermissions("token");

      // Should still return permissions even if cache update fails
      expect(result).toEqual(["perm1"]);
    });
  });

  describe("configuration", () => {
    it("should use default permission TTL when not configured", () => {
      const configWithoutTTL = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
      };
      (mockHttpClient as any).config = configWithoutTTL;

      const service = new PermissionService(mockHttpClient, mockCacheService);
      expect(service).toBeDefined();
    });

    it("should use custom permission TTL when configured", () => {
      const configWithTTL = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        cache: { permissionTTL: 1800 },
      };
      (mockHttpClient as any).config = configWithTTL;

      const service = new PermissionService(mockHttpClient, mockCacheService);
      expect(service).toBeDefined();
    });
  });
});
