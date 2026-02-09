/**
 * Unit tests for PermissionService
 */

import { PermissionService } from "../../src/services/permission.service";
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
import * as browserJwtDecoder from "../../src/utils/browser-jwt-decoder";
const mockExtractUserIdFromToken = browserJwtDecoder.extractUserIdFromToken as jest.MockedFunction<typeof browserJwtDecoder.extractUserIdFromToken>;

describe("PermissionService", () => {
  let permissionService: PermissionService;
  let config: MisoClientConfig;
  let mockHttpClient: jest.Mocked<HttpClient>;
  type MockApiClient = {
    auth: {
      validateToken: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
    };
    permissions: {
      getPermissions: jest.MockedFunction<(params?: any, authStrategy?: any) => Promise<any>>;
      refreshPermissions: jest.MockedFunction<(authStrategy?: any) => Promise<any>>;
    };
    roles: {
      getRoles: jest.MockedFunction<(params?: any, authStrategy?: any) => Promise<any>>;
      refreshRoles: jest.MockedFunction<(authStrategy?: any) => Promise<any>>;
    };
    logs: {
      createLog: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
    };
    encryption: Record<string, unknown>;
    applications: Record<string, unknown>;
  };
  let mockApiClient: MockApiClient;
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
      permissions: {
        getPermissions: jest.fn(),
        refreshPermissions: jest.fn(),
      },
      roles: {
        getRoles: jest.fn(),
        refreshRoles: jest.fn(),
      },
      logs: {
        createLog: jest.fn(),
      },
      encryption: {},
      applications: {},
    } as any;

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedApiClient.mockImplementation(
      () => mockApiClient as unknown as ApiClient,
    );
    MockedCacheService.mockImplementation(() => mockCacheService);

    permissionService = new PermissionService(
      mockHttpClient,
      mockApiClient as unknown as ApiClient,
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
      // Mock extractUserIdFromToken to return userId - avoids validate API call
      mockExtractUserIdFromToken.mockReturnValue("123");

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users", "write:posts"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("permissions:123");
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockApiClient.permissions.getPermissions).not.toHaveBeenCalled();
    });

    it("should fetch permissions from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock extractUserIdFromToken to return userId - avoids validate API call
      mockExtractUserIdFromToken.mockReturnValue("123");
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
        expect.objectContaining({ permissions: ["read:users", "write:posts"] }),
        900,
      );
    });

    it("should handle cache miss gracefully", async () => {
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(true);
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.permissions.getPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: ["read:users"],
        },
        timestamp: new Date().toISOString(),
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:users"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("permissions:123");
      expect(mockCacheService.set).toHaveBeenCalled();
    });

    it("should handle invalid cached data", async () => {
      // CacheService handles JSON parsing, so invalid data becomes null
      mockCacheService.get.mockResolvedValue(null);
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
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
      // Only one call - to get permissions (userId extracted from token)
      expect(mockApiClient.permissions.getPermissions).toHaveBeenCalledTimes(1);
    });

    it("should return empty array when user validation fails", async () => {
      // extractUserIdFromToken returns null (no userId in token)
      mockExtractUserIdFromToken.mockReturnValue(null);
      mockHttpClient.authenticatedRequest.mockResolvedValue({});

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });

    it("should handle network errors gracefully", async () => {
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.permissions.getPermissions.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });

    it("should handle JWT decode failure gracefully", async () => {
      // Mock extractUserIdFromToken to return null (decode failed)
      mockExtractUserIdFromToken.mockReturnValue(null);

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
      // Mock extractUserIdFromToken to return userId - avoids validate API call
      mockExtractUserIdFromToken.mockReturnValue("123");

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
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");

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
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");

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
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");

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
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");

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
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");

      const result = await permissionService.hasAllPermissions("token", [
        "read:users",
        "write:posts",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("refreshPermissions", () => {
    it("should fetch fresh permissions from controller", async () => {
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.auth.validateToken.mockResolvedValueOnce({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.permissions.refreshPermissions.mockResolvedValueOnce({
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
        expect.objectContaining({ permissions: ["read:users", "write:posts"] }),
        900,
      );
    });

    it("should handle errors during refresh", async () => {
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual([]);
    });

    it("should return empty array when user validation fails", async () => {
      // Mock extractUserIdFromToken to return userId, but validate returns empty
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.auth.validateToken.mockResolvedValueOnce({
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
  });

  describe("clearPermissionsCache", () => {
    it("should clear cached permissions from cache", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:123");
    });

    it("should handle cache delete failure gracefully", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(false);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:123");
    });

    it("should handle user validation failure", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {},
        },
        timestamp: new Date().toISOString(),
      });

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it("should handle errors gracefully", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(
        permissionService.clearPermissionsCache("token"),
      ).resolves.not.toThrow();
    });

    it("should handle cache delete error gracefully", async () => {
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockRejectedValue(
        new Error("Cache delete failed"),
      );

      await expect(
        permissionService.clearPermissionsCache("token"),
      ).resolves.not.toThrow();
    });

    it("should extract userId from validate API when clearing cache", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
        user: { id: "456" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:456");
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
    });

    it("should handle different user IDs from validate API when clearing cache", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "789" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:789");
    });

    it("should always use validate API to get userId for clearing cache", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
        user: { id: "999" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await permissionService.clearPermissionsCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("permissions:999");
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
    });
  });

  describe("extractUserIdFromToken edge cases", () => {
    it("should extract userId from id field when sub is not present", async () => {
      mockExtractUserIdFromToken.mockReturnValue("user-from-id");
      mockCacheService.get.mockResolvedValue(null);
      mockApiClient.permissions.getPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: ["read:test"],
        },
        timestamp: new Date().toISOString(),
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:test"]);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        "permissions:user-from-id",
      );
    });

    it("should handle JWT decode returning empty object", async () => {
      mockExtractUserIdFromToken.mockReturnValue(null);
      mockCacheService.get.mockResolvedValue(null);
      mockApiClient.auth.validateToken.mockResolvedValueOnce({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.permissions.getPermissions.mockResolvedValueOnce({
        success: true,
        data: {
          permissions: ["read:test"],
        },
        timestamp: new Date().toISOString(),
      });

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual(["read:test"]);
    });

    it("should handle permissions array in response correctly", async () => {
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockCacheService.get.mockResolvedValue(null);
      mockApiClient.permissions.getPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: ["perm1", "perm2", "perm3"],
        },
        timestamp: new Date().toISOString(),
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
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockCacheService.get.mockResolvedValue(null);
      mockApiClient.permissions.getPermissions.mockResolvedValue({
        success: true,
        data: {
          permissions: [],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.getPermissions("token");

      expect(result).toEqual([]);
    });
  });

  describe("permission checking edge cases", () => {
    it("should handle empty permissions array in hasPermission", async () => {
      mockExtractUserIdFromToken.mockReturnValue("123");
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
      mockExtractUserIdFromToken.mockReturnValue("123");
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
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAnyPermission("token", []);

      expect(result).toBe(false);
    });

    it("should handle hasAllPermissions with empty array input", async () => {
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockCacheService.get.mockResolvedValue({
        permissions: ["read:users"],
        timestamp: Date.now(),
      });

      const result = await permissionService.hasAllPermissions("token", []);

      expect(result).toBe(true); // Empty array should return true
    });

    it("should handle hasAllPermissions with exact match", async () => {
      mockExtractUserIdFromToken.mockReturnValue("123");
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
      mockExtractUserIdFromToken.mockReturnValue("123");
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
      mockExtractUserIdFromToken.mockReturnValue("refresh-user");
      mockApiClient.auth.validateToken.mockResolvedValueOnce({
        success: true,
        data: {
          authenticated: true,
          user: { id: "refresh-user", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.permissions.refreshPermissions.mockResolvedValueOnce({
        success: true,
        data: {
          permissions: ["refresh:perm"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await permissionService.refreshPermissions("token");

      expect(result).toEqual(["refresh:perm"]);
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
    });

    it("should handle refresh when cache update fails", async () => {
      mockExtractUserIdFromToken.mockReturnValue("refresh-user");
      mockApiClient.auth.validateToken.mockResolvedValueOnce({
        success: true,
        data: {
          authenticated: true,
          user: { id: "refresh-user", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.permissions.refreshPermissions.mockResolvedValueOnce({
        success: true,
        data: {
          permissions: ["perm1"],
        },
        timestamp: new Date().toISOString(),
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

      const service = new PermissionService(
        mockHttpClient,
        mockApiClient as unknown as ApiClient,
        mockCacheService,
      );
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

      const service = new PermissionService(
        mockHttpClient,
        mockApiClient as unknown as ApiClient,
        mockCacheService,
      );
      expect(service).toBeDefined();
    });
  });
});
