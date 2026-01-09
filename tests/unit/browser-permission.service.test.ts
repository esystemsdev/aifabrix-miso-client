/**
 * Unit tests for BrowserPermissionService
 */

import { BrowserPermissionService } from "../../src/services/browser-permission.service";
import { HttpClient } from "../../src/utils/http-client";
import { ApiClient } from "../../src/api";
import { CacheService } from "../../src/services/cache.service";
import { MisoClientConfig } from "../../src/types/config.types";

// Mock dependencies
jest.mock("../../src/utils/http-client");
jest.mock("../../src/api");
jest.mock("../../src/services/cache.service");
jest.mock("../../src/utils/browser-jwt-decoder");

const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;
const MockedApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;
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
  let mockApiClient: {
    auth: {
      validateToken: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
    };
    roles: {
      getRoles: jest.MockedFunction<(params?: any, authStrategy?: any) => Promise<any>>;
      refreshRoles: jest.MockedFunction<(authStrategy?: any) => Promise<any>>;
    };
    permissions: {
      getPermissions: jest.MockedFunction<(params?: any, authStrategy?: any) => Promise<any>>;
      refreshPermissions: jest.MockedFunction<(authStrategy?: any) => Promise<any>>;
    };
    logs: Record<string, jest.MockedFunction<any>>;
  };
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

    mockApiClient = {
      auth: {
        validateToken: jest.fn(),
      },
      roles: {
        getRoles: jest.fn(),
        refreshRoles: jest.fn(),
      },
      permissions: {
        getPermissions: jest.fn(),
        refreshPermissions: jest.fn(),
      },
      logs: {},
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedApiClient.mockImplementation(() => mockApiClient as any);
    MockedCacheService.mockImplementation(() => mockCacheService);

    permissionService = new BrowserPermissionService(
      mockHttpClient,
      mockApiClient,
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
      expect(mockApiClient.permissions.getPermissions).not.toHaveBeenCalled();
    });

    it("should fetch permissions from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.permissions.getPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: ["read:users", "write:posts"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      // Only one call - to get permissions (userId extracted from token)
      expect(mockApiClient.permissions.getPermissions).toHaveBeenCalledTimes(1);
      expect(mockApiClient.permissions.getPermissions).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
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
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "456", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.permissions.getPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: ["read:users"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users"]);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockApiClient.permissions.getPermissions).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
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
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {},
        },
        timestamp: new Date().toISOString(),
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
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.permissions.refreshPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: ["read:users", "write:posts"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockApiClient.permissions.refreshPermissions).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
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
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {},
        },
        timestamp: new Date().toISOString(),
      });

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });
  });

  describe("clearPermissionsCache", () => {
    it("should clear cached permissions", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:123");
    });

    it("should handle errors gracefully", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        permissionService.clearPermissionsCache("token"),
      ).resolves.not.toThrow();
    });
  });
});

