/**
 * Unit tests for BrowserRoleService
 */

import { BrowserRoleService } from "../../src/services/browser-role.service";
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

describe("BrowserRoleService", () => {
  let roleService: BrowserRoleService;
  let config: MisoClientConfig;
  let mockHttpClient: jest.Mocked<HttpClient>;
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

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedCacheService.mockImplementation(() => mockCacheService);

    roleService = new BrowserRoleService(mockHttpClient, mockCacheService);
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
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it("should fetch roles from controller when cache miss", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Mock JWT decode to return userId - avoids validate API call
      decodeJWT.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        roles: ["admin", "user"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin", "user"]);
      // Only one call - to get roles (userId extracted from token)
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/roles",
        "token",
        undefined,
        undefined,
        undefined,
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
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "456" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "456",
        roles: ["admin"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.getRoles("token");

      expect(result).toEqual(["admin"]);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/roles",
        "token",
        undefined,
        undefined,
        undefined,
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
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: {},
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
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockHttpClient.authenticatedRequest.mockResolvedValue({
        userId: "123",
        roles: ["admin", "user"],
        environment: "dev",
        application: "test-app",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/roles/refresh",
        "token",
        undefined,
        undefined,
        undefined,
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
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: {},
      });

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual([]);
    });

    it("should return empty array on error", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await roleService.refreshRoles("token");

      expect(result).toEqual([]);
    });
  });

  describe("clearRolesCache", () => {
    it("should clear cached roles", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        user: { id: "123" },
      });
      mockCacheService.delete.mockResolvedValue(true);

      await roleService.clearRolesCache("token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("roles:123");
    });

    it("should handle errors gracefully", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      await expect(roleService.clearRolesCache("token")).resolves.not.toThrow();
    });
  });
});

