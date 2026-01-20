/**
 * Unit tests for RoleService
 */

import { RoleService } from "../../src/services/role.service";
import { HttpClient } from "../../src/utils/http-client";
import { ApiClient } from "../../src/api";
import { CacheService } from "../../src/services/cache.service";
import { MisoClientConfig } from "../../src/types/config.types";

// Mock HttpClient
jest.mock("../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock ApiClient
jest.mock("../../src/api");
const MockedApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

// Mock CacheService
jest.mock("../../src/services/cache.service");
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;

// Mock browser-jwt-decoder
jest.mock("../../src/utils/browser-jwt-decoder");
import * as browserJwtDecoder from "../../src/utils/browser-jwt-decoder";
const mockExtractUserIdFromToken = browserJwtDecoder.extractUserIdFromToken as jest.MockedFunction<typeof browserJwtDecoder.extractUserIdFromToken>;

describe("RoleService", () => {
  let roleService: RoleService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockApiClient: {
    auth: {
      validateToken: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
    };
    roles: {
      getRoles: jest.MockedFunction<(params?: any, authStrategy?: any) => Promise<any>>;
      refreshRoles: jest.MockedFunction<(authStrategy?: any) => Promise<any>>;
    };
  };
  let mockCacheService: jest.Mocked<CacheService>;
  let config: MisoClientConfig;

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
    };

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedApiClient.mockImplementation(() => mockApiClient as any);
    MockedCacheService.mockImplementation(() => mockCacheService);

    roleService = new RoleService(mockHttpClient, mockApiClient as any, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getRoles", () => {
    it("should return cached roles from cache", async () => {
      const cachedRoles = { roles: ["admin", "user"], timestamp: Date.now() };
      mockCacheService.get.mockResolvedValue(cachedRoles);
      // Mock extractUserIdFromToken to return userId - avoids validate API call
      mockExtractUserIdFromToken.mockReturnValue("123");

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("roles:123");
      // No HTTP client calls when userId extracted from token and cache hit
      expect(mockApiClient.roles.getRoles).not.toHaveBeenCalled();
    });

    it("should fetch roles from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock extractUserIdFromToken to return userId - avoids validate API call
      mockExtractUserIdFromToken.mockReturnValue("123");
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
        expect.objectContaining({ roles: ["admin", "user"] }),
        900,
      );
    });

    it("should handle cache failure gracefully", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.roles.getRoles.mockResolvedValue({
        success: true,
        data: {
          roles: ["admin"],
        },
        timestamp: new Date().toISOString(),
      });

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin"]);
      expect(mockApiClient.roles.getRoles).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
    });

    it("should handle invalid cached data", async () => {
      // CacheService returns null for invalid data or cache miss
      mockCacheService.get.mockResolvedValue(null);
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.roles.getRoles.mockResolvedValue({
        success: true,
        data: {
          roles: ["user"],
        },
        timestamp: new Date().toISOString(),
      });

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["user"]);
    });

    it("should return empty array on error", async () => {
      // Mock extractUserIdFromToken to return userId
      mockExtractUserIdFromToken.mockReturnValue("123");
      mockApiClient.roles.getRoles.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await roleService.getRoles("token");

      expect(result).toEqual([]);
    });

    it("should handle JWT decode failure gracefully", async () => {
      // Mock extractUserIdFromToken to return null (decode failed)
      mockExtractUserIdFromToken.mockReturnValue(null);
      // When userId cannot be extracted, it falls back to validate API
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {}, // No id field
        },
        timestamp: new Date().toISOString(),
      });

      const result = await roleService.getRoles("invalid-token");

      expect(result).toEqual([]);
    });

    it("should extract userId from different JWT claim fields", async () => {
      // Test that extractUserIdFromToken returns userId from token
      mockExtractUserIdFromToken.mockReturnValue("456");
      mockCacheService.get.mockResolvedValue(null);
      mockApiClient.roles.getRoles.mockResolvedValue({
        success: true,
        data: {
          roles: ["user"],
        },
        timestamp: new Date().toISOString(),
      });

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["user"]);
      expect(mockCacheService.get).toHaveBeenCalledWith("roles:456");
    });

    it("should return empty array when validate returns no userId", async () => {
      // extractUserIdFromToken returns null
      mockExtractUserIdFromToken.mockReturnValue(null);
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {}, // No id field
        },
        timestamp: new Date().toISOString(),
      });

      const result = await roleService.getRoles("token");

      expect(result).toEqual([]);
    });
  });

  describe("hasRole", () => {
    it("should return true when user has role", async () => {
      jest.spyOn(roleService, "getRoles").mockResolvedValue(["admin", "user"]);

      const result = await roleService.hasRole("token", "admin");

      expect(result).toBe(true);
    });

    it("should return false when user does not have role", async () => {
      jest.spyOn(roleService, "getRoles").mockResolvedValue(["user"]);

      const result = await roleService.hasRole("token", "admin");

      expect(result).toBe(false);
    });
  });

  describe("hasAnyRole", () => {
    it("should return true when user has any of the roles", async () => {
      jest.spyOn(roleService, "getRoles").mockResolvedValue(["admin", "user"]);

      const result = await roleService.hasAnyRole("token", [
        "admin",
        "moderator",
      ]);

      expect(result).toBe(true);
    });

    it("should return false when user has none of the roles", async () => {
      jest.spyOn(roleService, "getRoles").mockResolvedValue(["user"]);

      const result = await roleService.hasAnyRole("token", [
        "admin",
        "moderator",
      ]);

      expect(result).toBe(false);
    });
  });

  describe("hasAllRoles", () => {
    it("should return true when user has all roles", async () => {
      jest
        .spyOn(roleService, "getRoles")
        .mockResolvedValue(["admin", "user", "moderator"]);

      const result = await roleService.hasAllRoles("token", ["admin", "user"]);

      expect(result).toBe(true);
    });

    it("should return false when user missing some roles", async () => {
      jest.spyOn(roleService, "getRoles").mockResolvedValue(["admin"]);

      const result = await roleService.hasAllRoles("token", ["admin", "user"]);

      expect(result).toBe(false);
    });
  });

  describe("refreshRoles", () => {
    it("should force refresh roles from controller", async () => {
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
      mockApiClient.roles.refreshRoles.mockResolvedValueOnce({
        success: true,
        data: {
          roles: ["admin", "user"],
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockApiClient.roles.refreshRoles).toHaveBeenCalledWith(
        undefined,
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "roles:123",
        expect.objectContaining({ roles: ["admin", "user"] }),
        900,
      );
    });

    it("should return empty array on error", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual([]);
    });
  });
});
