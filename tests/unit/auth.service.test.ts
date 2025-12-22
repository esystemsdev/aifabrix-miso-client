/**
 * Unit tests for AuthService
 */

import { AuthService } from "../../src/services/auth.service";
import { HttpClient } from "../../src/utils/http-client";
import { CacheService } from "../../src/services/cache.service";
import { MisoClientConfig, AuthMethod } from "../../src/types/config.types";
import { MisoClientError } from "../../src/utils/errors";

// Mock HttpClient
jest.mock("../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock CacheService
jest.mock("../../src/services/cache.service");
const MockedCacheService = CacheService as jest.MockedClass<
  typeof CacheService
>;

// Mock axios for getEnvironmentToken
jest.mock("axios");

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const jwt = require("jsonwebtoken");

describe("AuthService", () => {
  let authService: AuthService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockCacheService: jest.Mocked<CacheService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
    };

    mockHttpClient = {
      authenticatedRequest: jest.fn(),
      validateTokenRequest: jest.fn(),
      request: jest.fn(),
    } as any;
    (mockHttpClient as any).config = config; // Add config to httpClient for access

    mockCacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedCacheService.mockImplementation(() => mockCacheService);

    authService = new AuthService(mockHttpClient, mockCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should call login endpoint with query parameters", async () => {
      const mockResponse = {
        success: true,
        data: {
          loginUrl: "https://keycloak.example.com/auth?redirect=...",
          state: "abc123",
        },
        timestamp: new Date().toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authService.login({
        redirect: "http://localhost:3000/callback",
      });

      expect(result).toEqual(mockResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/login",
        undefined,
        {
          params: {
            redirect: "http://localhost:3000/callback",
          },
        },
      );
    });

    it("should include state parameter when provided", async () => {
      const mockResponse = {
        success: true,
        data: {
          loginUrl: "https://keycloak.example.com/auth?redirect=...",
          state: "custom-state-123",
        },
        timestamp: new Date().toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authService.login({
        redirect: "http://localhost:3000/callback",
        state: "custom-state-123",
      });

      expect(result).toEqual(mockResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/login",
        undefined,
        {
          params: {
            redirect: "http://localhost:3000/callback",
            state: "custom-state-123",
          },
        },
      );
    });

    it("should throw error on failure", async () => {
      mockHttpClient.request.mockRejectedValue(
        new Error("Login failed: Network error"),
      );

      await expect(
        authService.login({ redirect: "http://localhost:3000/callback" }),
      ).rejects.toThrow("Login failed");
    });
  });

  describe("validateToken", () => {
    beforeEach(() => {
      // Reset JWT decode mock
      jwt.decode.mockReturnValue(null);
      jest.clearAllMocks();
    });

    describe("caching behavior", () => {
      it("should return cached result on cache hit without calling API", async () => {
        const cachedData = {
          authenticated: true,
          timestamp: Date.now(),
        };
        mockCacheService.get.mockResolvedValue(cachedData);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

        const result = await authService.validateToken("valid-token");

        expect(result).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalledWith("token:123");
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it("should use cache on second call with same token (performance optimization)", async () => {
        const cachedData = {
          authenticated: true,
          timestamp: Date.now(),
        };
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

        // First call - cache miss, should call API and cache
        mockCacheService.get.mockResolvedValueOnce(null);
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockResolvedValue(true);

        const result1 = await authService.validateToken("same-token");
        expect(result1).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledTimes(1);

        // Second call - cache hit, should not call API
        mockCacheService.get.mockResolvedValueOnce(cachedData);
        const result2 = await authService.validateToken("same-token");
        expect(result2).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledTimes(1); // Still 1
        expect(mockCacheService.get).toHaveBeenCalledTimes(2);
      });

      it("should fetch from controller on cache miss and cache result", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("valid-token");

        expect(result).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalledWith("token:123");
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "valid-token",
          undefined,
        );
        expect(mockCacheService.set).toHaveBeenCalledWith(
          "token:123",
          expect.objectContaining({
            authenticated: true,
            timestamp: expect.any(Number),
          }),
          900, // Default TTL
        );
      });

      it("should return false for invalid token and cache negative result", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: false,
          error: "Invalid token",
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("invalid-token");

        expect(result).toBe(false);
        expect(mockCacheService.set).toHaveBeenCalledWith(
          "token:123",
          expect.objectContaining({
            authenticated: false,
            timestamp: expect.any(Number),
          }),
          900,
        );
      });

      it("should return false when cache set fails (caught by outer try-catch)", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockRejectedValue(new Error("Cache set failed"));

        const result = await authService.validateToken("valid-token");

        // When cache.set throws, it's caught by outer try-catch and returns false
        expect(result).toBe(false);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalled();
        expect(mockCacheService.set).toHaveBeenCalled();
      });
    });

    it("should fetch from controller on cache miss and cache result", async () => {
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.validateToken("valid-token");

      expect(result).toBe(true);
      expect(mockCacheService.get).toHaveBeenCalledWith("token:123");
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "valid-token",
        undefined,
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "token:123",
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        900, // Default TTL
      );
    });

    it("should return false for invalid token and cache result", async () => {
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: false,
        error: "Invalid token",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.validateToken("invalid-token");

      expect(result).toBe(false);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        "token:123",
        expect.objectContaining({
          authenticated: false,
          timestamp: expect.any(Number),
        }),
        900,
      );
    });

    describe("edge cases", () => {
      it("should fetch from controller when userId not in token and skip caching", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue(null); // No userId in token
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });

        const result = await authService.validateToken("token-without-userid");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "token-without-userid",
          undefined,
        );
        // Should not cache when userId not available
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it("should return false when cache get fails (safe fallback)", async () => {
        mockCacheService.get.mockRejectedValue(new Error("Cache error"));
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

        const result = await authService.validateToken("valid-token");

        // When cache.get throws, the error is caught and method returns false
        expect(result).toBe(false);
        expect(mockCacheService.get).toHaveBeenCalledWith("token:123");
        // Should not call API when cache fails (safe fallback)
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
      });

      it("should return false on API error", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockHttpClient.validateTokenRequest.mockRejectedValue(
          new Error("Network error"),
        );

        const result = await authService.validateToken("token");

        expect(result).toBe(false);
      });

      it("should handle empty token string", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue(null);
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: false,
          error: "Invalid token",
        });

        const result = await authService.validateToken("");

        expect(result).toBe(false);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "",
          undefined,
        );
      });
    });

    describe("JWT claim extraction", () => {
      it("should extract userId from various JWT claim fields", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockResolvedValue(true);

        // Test sub claim (highest priority)
        jwt.decode.mockReturnValue({ sub: "user-123" });
        await authService.validateToken("token");
        expect(mockCacheService.get).toHaveBeenCalledWith("token:user-123");

        // Test userId claim
        jwt.decode.mockReturnValue({ userId: "user-456" });
        await authService.validateToken("token");
        expect(mockCacheService.get).toHaveBeenCalledWith("token:user-456");

        // Test user_id claim
        jwt.decode.mockReturnValue({ user_id: "user-789" });
        await authService.validateToken("token");
        expect(mockCacheService.get).toHaveBeenCalledWith("token:user-789");

        // Test id claim
        jwt.decode.mockReturnValue({ id: "user-999" });
        await authService.validateToken("token");
        expect(mockCacheService.get).toHaveBeenCalledWith("token:user-999");
      });

      it("should prioritize sub claim over other claims", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockResolvedValue(true);

        // Token has multiple claim fields - sub should be used
        jwt.decode.mockReturnValue({
          sub: "user-sub-123",
          userId: "user-id-456",
          user_id: "user-id-789",
          id: "user-id-999",
        });
        await authService.validateToken("token");

        expect(mockCacheService.get).toHaveBeenCalledWith("token:user-sub-123");
      });

      it("should handle JWT decode returning non-object gracefully", async () => {
        mockCacheService.get.mockResolvedValue(null);
        // When jwt.decode returns a non-object (string), the implementation
        // will try to access properties which will be undefined, resulting in null userId
        jwt.decode.mockReturnValue("invalid-decoded-value" as any);
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });

        const result = await authService.validateToken("token");

        // Should still validate token and return result
        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalled();
        // Note: If userId extraction fails (returns null), caching should be skipped
        // The actual behavior depends on how extractUserIdFromToken handles non-objects
        // We test that the method doesn't crash and still validates the token
      });
    });

    describe("authStrategy parameter", () => {
      it("should pass authStrategy to validateTokenRequest", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        const authStrategy = {
          methods: ["bearer", "client-token"] as AuthMethod[],
          bearerToken: "bearer-token-123",
        };
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockResolvedValue(true);

        await authService.validateToken("token", authStrategy);

        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "token",
          authStrategy,
        );
      });

      it("should use cache with authStrategy when userId available", async () => {
        const cachedData = {
          authenticated: true,
          timestamp: Date.now(),
        };
        mockCacheService.get.mockResolvedValue(cachedData);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        const authStrategy = {
          methods: ["bearer"] as AuthMethod[],
          bearerToken: "bearer-token-123",
        };

        const result = await authService.validateToken("token", authStrategy);

        expect(result).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalledWith("token:123");
        // Should not call API when cache hit, even with authStrategy
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
      });
    });
  });

  describe("getUser", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return user info for valid token", async () => {
      const userInfo = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: userInfo,
      });

      const result = await authService.getUser("valid-token");

      expect(result).toEqual(userInfo);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "valid-token",
        undefined,
      );
    });

    it("should return null for invalid token", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: false,
        error: "Invalid token",
      });

      const result = await authService.getUser("invalid-token");

      expect(result).toBeNull();
    });

    it("should return null when authenticated but no user object", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        // No user object
      });

      const result = await authService.getUser("token");

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await authService.getUser("token");

      expect(result).toBeNull();
    });

    it("should pass authStrategy to validateTokenRequest", async () => {
      const authStrategy = {
        methods: ["bearer"] as AuthMethod[],
        bearerToken: "bearer-token-123",
      };
      const userInfo = {
        id: "123",
        username: "testuser",
      };
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: userInfo,
      });

      const result = await authService.getUser("token", authStrategy);

      expect(result).toEqual(userInfo);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        authStrategy,
      );
    });
  });

  describe("logout", () => {
    beforeEach(() => {
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      jest.clearAllMocks();
    });

    it("should call logout endpoint with token in body and clear cache", async () => {
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);
      mockCacheService.delete.mockResolvedValue(true);

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual(mockResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/logout",
        { token: "test-token-123" },
      );
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:123");
    });

    it("should complete logout even when cache delete fails (delete is fire-and-forget)", async () => {
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);
      // Cache delete is wrapped in void, so failures are silently ignored
      mockCacheService.delete.mockRejectedValue(new Error("Cache delete failed"));

      const result = await authService.logout({ token: "test-token-123" });

      // Should still return success even if cache delete fails (fire-and-forget)
      expect(result).toEqual(mockResponse);
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:123");
      // No warning logged because cache.delete is wrapped in void
    });

    it("should return success response on 400 error (no active session) and clear cache", async () => {
      const error = new MisoClientError(
        "No active session",
        undefined,
        {},
        400,
      );

      mockHttpClient.request.mockRejectedValue(error);
      mockCacheService.delete.mockResolvedValue(true);

      // Mock console.warn to suppress expected warning in test output
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual({
        success: true,
        message: "Logout successful (no active session)",
        timestamp: expect.any(String),
      });

      // Verify cache was cleared even on 400 error
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:123");

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Logout: No active session or invalid request (400)"),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should throw error on other failures", async () => {
      const error = new MisoClientError(
        "Internal server error",
        undefined,
        {},
        500,
      );

      mockHttpClient.request.mockRejectedValue(error);

      await expect(
        authService.logout({ token: "test-token-123" }),
      ).rejects.toThrow("Logout failed");
    });

    it("should handle non-Error thrown values", async () => {
      mockHttpClient.request.mockRejectedValue("String error");

      await expect(
        authService.logout({ token: "test-token-123" }),
      ).rejects.toThrow("Logout failed: Unknown error");
    });

    it("should clear cache even when userId not found in token", async () => {
      jwt.decode.mockReturnValue(null); // No userId
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authService.logout({ token: "token-without-userid" });

      expect(result).toEqual(mockResponse);
      // Should not call delete when userId not found
      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it("should handle AxiosError 400 response", async () => {
      const axiosError = {
        isAxiosError: true,
        message: "Bad Request",
        response: {
          status: 400,
          statusText: "Bad Request",
          data: { error: "No active session" },
          headers: {},
        },
      };
      mockHttpClient.request.mockRejectedValue(axiosError);
      mockCacheService.delete.mockResolvedValue(true);
      const consoleWarnSpy = jest
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual({
        success: true,
        message: "Logout successful (no active session)",
        timestamp: expect.any(String),
      });
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:123");

      consoleWarnSpy.mockRestore();
    });
  });

  describe("isAuthenticated", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should delegate to validateToken and return authentication status", async () => {
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.isAuthenticated("token");

      expect(result).toBe(true);
      // Should use validateToken which includes caching
      expect(mockCacheService.get).toHaveBeenCalledWith("token:123");
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        undefined,
      );
    });

    it("should pass authStrategy to validateToken", async () => {
      const authStrategy = {
        methods: ["bearer"] as AuthMethod[],
        bearerToken: "bearer-token-123",
      };
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.isAuthenticated("token", authStrategy);

      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "token",
        authStrategy,
      );
    });

    it("should return false when token is invalid", async () => {
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: false,
        error: "Invalid token",
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.isAuthenticated("invalid-token");

      expect(result).toBe(false);
    });
  });

  describe("getEnvironmentToken", () => {
    let mockAxios: any;
    let mockTempAxios: any;

    beforeEach(() => {
      mockAxios = require("axios");
      mockTempAxios = {
        post: jest.fn(),
      };
      // Reset and setup axios.create mock
      mockAxios.create.mockImplementation((config?: any) => {
        if (config?.headers?.["x-client-id"]) {
          return mockTempAxios;
        }
        return {
          post: jest.fn(),
          get: jest.fn(),
          put: jest.fn(),
          delete: jest.fn(),
        };
      });
    });

    it("should fetch and return environment token", async () => {
      mockTempAxios.post.mockResolvedValue({
        data: {
          success: true,
          token: "env-token-123",
          expiresIn: 3600,
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
        },
      });

      const result = await authService.getEnvironmentToken();

      expect(result).toBe("env-token-123");
      expect(mockTempAxios.post).toHaveBeenCalledWith("/api/v1/auth/token");
    });

    it("should use default endpoint when clientTokenUri is not configured", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockCacheService);

      mockTempAxios.post.mockResolvedValue({
        data: {
          success: true,
          token: "env-token-123",
        },
      });

      await authService.getEnvironmentToken();

      expect(mockTempAxios.post).toHaveBeenCalledWith("/api/v1/auth/token");
    });

    it("should use custom clientTokenUri when configured", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        clientTokenUri: "/api/custom/token",
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockCacheService);

      mockTempAxios.post.mockResolvedValue({
        data: {
          success: true,
          token: "env-token-123",
        },
      });

      await authService.getEnvironmentToken();

      expect(mockTempAxios.post).toHaveBeenCalledWith("/api/custom/token");
    });

    it("should handle nested token response format with custom URI", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        clientTokenUri: "/api/v1/auth/client-token",
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockCacheService);

      mockTempAxios.post.mockResolvedValue({
        data: {
          success: true,
          data: {
            token: "nested-token-123",
            expiresIn: 1800,
          },
        },
      });

      const result = await authService.getEnvironmentToken();

      expect(result).toBe("nested-token-123");
      expect(mockTempAxios.post).toHaveBeenCalledWith("/api/v1/auth/client-token");
    });

    it("should throw error on invalid response", async () => {
      mockTempAxios.post.mockResolvedValue({
        data: {
          success: false,
        },
      });

      await expect(authService.getEnvironmentToken()).rejects.toThrow(
        "Failed to get environment token",
      );
    });

    it("should throw error on network failure", async () => {
      mockTempAxios.post.mockRejectedValue(new Error("Network error"));

      await expect(authService.getEnvironmentToken()).rejects.toThrow(
        "Failed to get environment token",
      );
    });

    it("should handle non-Error thrown values", async () => {
      mockTempAxios.post.mockRejectedValue("String error");

      await expect(authService.getEnvironmentToken()).rejects.toThrow(
        "Failed to get environment token: Unknown error",
      );
    });
  });

  describe("getUserInfo", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return user info from GET endpoint", async () => {
      const userInfo = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };
      mockHttpClient.authenticatedRequest.mockResolvedValue(userInfo);

      const result = await authService.getUserInfo("valid-token");

      expect(result).toEqual(userInfo);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/user",
        "valid-token",
        undefined,
        undefined,
        undefined,
      );
    });

    it("should return null on error", async () => {
      mockHttpClient.authenticatedRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await authService.getUserInfo("token");

      expect(result).toBeNull();
    });

    it("should pass authStrategy to authenticatedRequest", async () => {
      const authStrategy = {
        methods: ["bearer"] as AuthMethod[],
        bearerToken: "bearer-token-123",
      };
      const userInfo = {
        id: "123",
        username: "testuser",
      };
      mockHttpClient.authenticatedRequest.mockResolvedValue(userInfo);

      const result = await authService.getUserInfo("token", authStrategy);

      expect(result).toEqual(userInfo);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "GET",
        "/api/v1/auth/user",
        "token",
        undefined,
        undefined,
        authStrategy,
      );
    });

    it("should handle empty user info response", async () => {
      mockHttpClient.authenticatedRequest.mockResolvedValue({} as any);

      const result = await authService.getUserInfo("token");

      expect(result).toEqual({});
    });
  });

  describe("API_KEY support for testing", () => {
    beforeEach(() => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        apiKey: "test-api-key-123",
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockCacheService);
    });

    describe("validateToken with API_KEY", () => {
      beforeEach(() => {
        jest.clearAllMocks();
        jwt.decode.mockReturnValue(null);
      });

      it("should return true for matching API_KEY without calling controller or cache", async () => {
        const result = await authService.validateToken("test-api-key-123");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
        expect(mockCacheService.get).not.toHaveBeenCalled();
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("different-token");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "different-token",
          undefined,
        );
      });

      it("should be case-sensitive", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: false,
          error: "Invalid token",
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("TEST-API-KEY-123");

        expect(result).toBe(false);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalled();
      });

      it("should not use cache when API_KEY matches", async () => {
        const result = await authService.validateToken("test-api-key-123");

        expect(result).toBe(true);
        // Should bypass cache completely for API_KEY
        expect(mockCacheService.get).not.toHaveBeenCalled();
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });
    });

    describe("getUser with API_KEY", () => {
      it("should return null for matching API_KEY without calling controller", async () => {
        const result = await authService.getUser("test-api-key-123");

        expect(result).toBeNull();
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: userInfo,
        });

        const result = await authService.getUser("different-token");

        expect(result).toEqual(userInfo);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "different-token",
          undefined,
        );
      });
    });

    describe("getUserInfo with API_KEY", () => {
      it("should return null for matching API_KEY without calling controller", async () => {
        const result = await authService.getUserInfo("test-api-key-123");

        expect(result).toBeNull();
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        mockHttpClient.authenticatedRequest.mockResolvedValue(userInfo);

        const result = await authService.getUserInfo("different-token");

        expect(result).toEqual(userInfo);
        expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
          "GET",
          "/api/v1/auth/user",
          "different-token",
          undefined,
          undefined,
          undefined,
        );
      });
    });

    describe("isAuthenticated with API_KEY", () => {
      it("should return true for matching API_KEY (delegates to validateToken)", async () => {
        const result = await authService.isAuthenticated("test-api-key-123");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });

        const result = await authService.isAuthenticated("different-token");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalled();
      });
    });
  });

  describe("validateToken without API_KEY (normal flow)", () => {
    it("should call controller when API_KEY is not configured", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        // apiKey not set
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockCacheService);

      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.validateToken("some-token");

      expect(result).toBe(true);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "some-token",
        undefined,
      );
    });
  });

  describe("clearTokenCache", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should delete cache key when userId found in token", () => {
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockCacheService.delete.mockResolvedValue(true);

      authService.clearTokenCache("test-token");

      expect(jwt.decode).toHaveBeenCalledWith("test-token");
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:123");
    });

    it("should handle gracefully when userId not found in token", () => {
      jwt.decode.mockReturnValue(null);

      authService.clearTokenCache("invalid-token");

      expect(jwt.decode).toHaveBeenCalledWith("invalid-token");
      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it("should handle gracefully when JWT decode fails", () => {
      // JWT decode throws error - extractUserIdFromToken catches and returns null
      jwt.decode.mockImplementation(() => {
        throw new Error("Invalid token format");
      });

      // Should not throw - extractUserIdFromToken handles the error internally
      expect(() => {
        authService.clearTokenCache("malformed-token");
      }).not.toThrow();

      // Should not call delete since userId extraction failed
      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it("should handle cache delete failure gracefully (fire-and-forget)", () => {
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      // Cache delete is wrapped in void, so failures are silently ignored
      mockCacheService.delete.mockRejectedValue(new Error("Cache delete failed"));

      // Should not throw even if cache delete fails (fire-and-forget)
      expect(() => {
        authService.clearTokenCache("test-token");
      }).not.toThrow();

      expect(mockCacheService.delete).toHaveBeenCalledWith("token:123");
      // No warning logged because cache.delete is wrapped in void (fire-and-forget)
    });

    it("should extract userId from various JWT claim fields", () => {
      mockCacheService.delete.mockResolvedValue(true);

      // Test sub claim
      jwt.decode.mockReturnValue({ sub: "user-123" });
      authService.clearTokenCache("token");
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:user-123");

      // Test userId claim
      jwt.decode.mockReturnValue({ userId: "user-456" });
      authService.clearTokenCache("token");
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:user-456");

      // Test user_id claim
      jwt.decode.mockReturnValue({ user_id: "user-789" });
      authService.clearTokenCache("token");
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:user-789");

      // Test id claim
      jwt.decode.mockReturnValue({ id: "user-999" });
      authService.clearTokenCache("token");
      expect(mockCacheService.delete).toHaveBeenCalledWith("token:user-999");
    });

    it("should handle empty token string", () => {
      jwt.decode.mockReturnValue(null);

      authService.clearTokenCache("");

      expect(jwt.decode).toHaveBeenCalledWith("");
      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });
  });

  describe("validateToken with custom TTL", () => {
    it("should use custom tokenValidationTTL from config", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        cache: { tokenValidationTTL: 600 }, // 10 minutes
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockCacheService);

      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.validateToken("token");

      expect(mockCacheService.set).toHaveBeenCalledWith(
        "token:123",
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        600, // Custom TTL
      );
    });
  });

  describe("refreshToken", () => {
    const mockRefreshToken = "refresh-token-123";
    const mockRefreshResponse = {
      success: true,
      accessToken: "new-access-token-456",
      refreshToken: "new-refresh-token-789",
      expiresIn: 3600,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      timestamp: new Date().toISOString(),
    };

    it("should successfully refresh token using request method", async () => {
      mockHttpClient.request.mockResolvedValue(mockRefreshResponse);

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual(mockRefreshResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/refresh",
        { refreshToken: mockRefreshToken },
      );
      expect(mockHttpClient.authenticatedRequest).not.toHaveBeenCalled();
    });

    it("should successfully refresh token using authenticatedRequest when authStrategy provided", async () => {
      const authStrategy = {
        methods: ["bearer", "client-token"] as AuthMethod[],
        bearerToken: "bearer-token-123",
      };
      mockHttpClient.authenticatedRequest.mockResolvedValue(mockRefreshResponse);

      const result = await authService.refreshToken(
        mockRefreshToken,
        authStrategy,
      );

      expect(result).toEqual(mockRefreshResponse);
      expect(mockHttpClient.authenticatedRequest).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/refresh",
        "", // Empty token - authStrategy handles authentication
        { refreshToken: mockRefreshToken },
        undefined,
        authStrategy,
      );
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should return null on MisoClientError", async () => {
      const error = new MisoClientError(
        "Invalid refresh token",
        undefined,
        {},
        401,
      );
      mockHttpClient.request.mockRejectedValue(error);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null on network error", async () => {
      const error = new Error("Network error");
      mockHttpClient.request.mockRejectedValue(error);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null on AxiosError (500)", async () => {
      const axiosError = {
        isAxiosError: true,
        message: "Internal server error",
        response: {
          status: 500,
          statusText: "Internal Server Error",
          data: { error: "Server error" },
          headers: {},
        },
      };
      mockHttpClient.request.mockRejectedValue(axiosError);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null on AxiosError without response", async () => {
      const axiosError = {
        isAxiosError: true,
        message: "Network timeout",
        request: {},
      };
      mockHttpClient.request.mockRejectedValue(axiosError);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should include correlation ID in error messages", async () => {
      const error = new MisoClientError(
        "Invalid refresh token",
        undefined,
        {},
        401,
      );
      mockHttpClient.request.mockRejectedValue(error);

      // Mock console.error to capture error message
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await authService.refreshToken(mockRefreshToken);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[correlationId: .+, clientId: ctrl-dev-test-app\]/),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null on 403 Forbidden error", async () => {
      const error = new MisoClientError(
        "Forbidden",
        undefined,
        {},
        403,
      );
      mockHttpClient.request.mockRejectedValue(error);

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should return null on 404 Not Found error", async () => {
      const error = new MisoClientError(
        "Endpoint not found",
        undefined,
        {},
        404,
      );
      mockHttpClient.request.mockRejectedValue(error);

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should handle empty refresh token", async () => {
      const error = new MisoClientError(
        "Refresh token required",
        undefined,
        {},
        400,
      );
      mockHttpClient.request.mockRejectedValue(error);

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken("");

      expect(result).toBeNull();
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/refresh",
        { refreshToken: "" },
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle malformed response (missing accessToken)", async () => {
      const malformedResponse = {
        success: true,
        refreshToken: "new-refresh-token-789",
        // Missing accessToken
      };
      mockHttpClient.request.mockResolvedValue(malformedResponse as any);

      const result = await authService.refreshToken(mockRefreshToken);

      // Should return the response as-is (validation happens at API level)
      expect(result).toEqual(malformedResponse);
    });

    it("should handle response with partial fields", async () => {
      const partialResponse = {
        success: true,
        accessToken: "new-access-token-456",
        // Missing refreshToken and expiresIn
      };
      mockHttpClient.request.mockResolvedValue(partialResponse as any);

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual(partialResponse);
    });

    it("should handle refresh token with special characters", async () => {
      const specialToken = "refresh-token-with-special-chars-!@#$%^&*()";
      mockHttpClient.request.mockResolvedValue(mockRefreshResponse);

      const result = await authService.refreshToken(specialToken);

      expect(result).toEqual(mockRefreshResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/refresh",
        { refreshToken: specialToken },
      );
    });

    it("should handle very long refresh token", async () => {
      const longToken = "a".repeat(10000); // Very long token
      mockHttpClient.request.mockResolvedValue(mockRefreshResponse);

      const result = await authService.refreshToken(longToken);

      expect(result).toEqual(mockRefreshResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/refresh",
        { refreshToken: longToken },
      );
    });

    it("should handle refresh token with unicode characters", async () => {
      const unicodeToken = "refresh-token-测试-🚀-émoji";
      mockHttpClient.request.mockResolvedValue(mockRefreshResponse);

      const result = await authService.refreshToken(unicodeToken);

      expect(result).toEqual(mockRefreshResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/refresh",
        { refreshToken: unicodeToken },
      );
    });

    it("should handle response with expiresAt in different formats", async () => {
      const responseWithExpiresAt = {
        ...mockRefreshResponse,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(responseWithExpiresAt);

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual(responseWithExpiresAt);
      expect(result?.expiresAt).toBeDefined();
    });

    it("should handle response without expiresAt", async () => {
      const responseWithoutExpiresAt = {
        success: true,
        accessToken: "new-access-token-456",
        refreshToken: "new-refresh-token-789",
        expiresIn: 3600,
        timestamp: new Date().toISOString(),
        // No expiresAt
      };
      mockHttpClient.request.mockResolvedValue(responseWithoutExpiresAt);

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual(responseWithoutExpiresAt);
      expect(result?.expiresAt).toBeUndefined();
    });
  });
});
