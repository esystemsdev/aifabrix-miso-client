/**
 * Unit tests for BrowserRoleService
 */

import { BrowserRoleService } from "../../src/services/browser-role.service";
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

describe("BrowserRoleService", () => {
  let roleService: BrowserRoleService;
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
      cache: { roleTTL: 900 },
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

    roleService = new BrowserRoleService(mockHttpClient, mockApiClient, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getRoles", () => {
    it("should return cached roles from cache", async () => {
      const cachedRoles = {
        roles: ["admin", "user"],
        timestamp: Date.now(),
      };
      mockCacheService.get.mockResolvedValue(cachedRoles);
      // Mock JWT decode to return userId - avoids validate API call
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("roles:123");
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockApiClient.roles.getRoles).not.toHaveBeenCalled();
    });

    it("should fetch roles from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.roles.getRoles.mockResolvedValue({
        success: true,
        data: {
          roles: ["admin", "user"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin", "user"]);
      // Only one call - to get roles (userId extracted from token)
      expect(mockApiClient.roles.getRoles).toHaveBeenCalledTimes(1);
      expect(mockApiClient.roles.getRoles).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "roles:123",
        expect.objectContaining({
          roles: ["admin", "user"],
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
      mockApiClient.roles.getRoles.mockResolvedValue({
        success: true,
        data: {
          roles: ["admin"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin"]);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockApiClient.roles.getRoles).toHaveBeenCalledWith(
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

      const result = await roleService.getRoles("token");

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

      const result = await roleService.getRoles("token");

      expect(result).toEqual([]);
    });
  });

  describe("hasRole", () => {
    it("should return true if user has role", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        roles: ["admin", "user"],
        timestamp: Date.now(),
      });

      const result = await roleService.hasRole("token", "admin");

      expect(result).toBe(true);
    });

    it("should return false if user does not have role", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        roles: ["user"],
        timestamp: Date.now(),
      });

      const result = await roleService.hasRole("token", "admin");

      expect(result).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("should return true if user has any role", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        roles: ["admin"],
        timestamp: Date.now(),
      });

      const result = await roleService.hasAnyRole("token", ["admin", "user"]);

      expect(result).toBe(true);
    });

    it("should return false if user has none of the roles", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        roles: ["user"],
        timestamp: Date.now(),
      });

      const result = await roleService.hasAnyRole("token", [
        "admin",
        "moderator",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("hasAllRoles", () => {
    it("should return true if user has all roles", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        roles: ["admin", "user"],
        timestamp: Date.now(),
      });

      const result = await roleService.hasAllRoles("token", ["admin", "user"]);

      expect(result).toBe(true);
    });

    it("should return false if user missing any role", async () => {
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.get.mockResolvedValue({
        roles: ["user"],
        timestamp: Date.now(),
      });

      const result = await roleService.hasAllRoles("token", ["admin", "user"]);

      expect(result).toBe(false);
    });
  });

  describe("refreshRoles", () => {
    it("should fetch fresh roles and update cache", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockApiClient.roles.refreshRoles.mockResolvedValue({
        success: true,
        data: {
          roles: ["admin", "user"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockApiClient.roles.refreshRoles).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "roles:123",
        expect.objectContaining({
          roles: ["admin", "user"],
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

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual([]);
    });
  });

  describe("clearRolesCache", () => {
    it("should clear cached roles", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "test", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await roleService.clearRolesCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("roles:123");
    });

    it("should handle errors gracefully", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(roleService.clearRolesCache("token")).resolves.not.toThrow();
    });
  });
});

