/**
 * Unit tests for AuthService
 */

import crypto from "crypto";
import { AuthService } from "../../src/services/auth.service";
import { HttpClient } from "../../src/utils/http-client";
import { ApiClient } from "../../src/api";
import { CacheService } from "../../src/services/cache.service";
import { MisoClientConfig, AuthMethod } from "../../src/types/config.types";
import { MisoClientError } from "../../src/utils/errors";

/**
 * Helper function to compute expected cache key (matches AuthService.getTokenCacheKey)
 */
function getExpectedCacheKey(token: string): string {
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return `token_validation:${hash}`;
}

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

// Mock axios for getEnvironmentToken
jest.mock("axios");

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const jwt = require("jsonwebtoken");

describe("AuthService", () => {
  let authService: AuthService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockApiClient: {
    auth: {
      login: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
      validateToken: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
      getUser: jest.MockedFunction<(authStrategy?: any) => Promise<any>>;
      refreshToken: jest.MockedFunction<(params: any, authStrategy?: any) => Promise<any>>;
      logoutWithToken: jest.MockedFunction<(token: string) => Promise<any>>;
    };
  };
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

    mockApiClient = {
      auth: {
        login: jest.fn(),
        validateToken: jest.fn(),
        getUser: jest.fn(),
        refreshToken: jest.fn(),
        logoutWithToken: jest.fn(),
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

    authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);
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
      mockApiClient.auth.login.mockResolvedValue(mockResponse);

      const result = await authService.login({
        redirect: "http://localhost:3000/callback",
      });

      // Convert ApiClient response format to service response format
      expect(result.success).toBe(true);
      expect(result.data.loginUrl).toBe(mockResponse.data.loginUrl);
      expect(result.data.state).toBe(mockResponse.data.state || '');
      expect(mockApiClient.auth.login).toHaveBeenCalledWith(
        { redirect: "http://localhost:3000/callback" },
        undefined,
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
      mockApiClient.auth.login.mockResolvedValue(mockResponse);

      const result = await authService.login({
        redirect: "http://localhost:3000/callback",
        state: "custom-state-123",
      });

      expect(result.success).toBe(true);
      expect(result.data.loginUrl).toBe(mockResponse.data.loginUrl);
      expect(result.data.state).toBe(mockResponse.data.state || '');
      expect(mockApiClient.auth.login).toHaveBeenCalledWith(
        { redirect: "http://localhost:3000/callback", state: "custom-state-123" },
        undefined,
      );
    });

    it("should return failure response on error", async () => {
      mockApiClient.auth.login.mockRejectedValue(
        new Error("Login failed: Network error"),
      );

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.login({
        redirect: "http://localhost:3000/callback",
      });

      expect(result).toEqual({
        success: false,
        data: { loginUrl: "", state: "" },
        timestamp: expect.any(String),
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Login failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: expect.any(String),
          operation: "Login",
        }),
      );

      consoleErrorSpy.mockRestore();
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

        const result = await authService.validateToken("valid-token");

        expect(result).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalledWith(
          getExpectedCacheKey("valid-token"),
        );
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it("should use cache on second call with same token (performance optimization)", async () => {
        const cachedData = {
          authenticated: true,
          timestamp: Date.now(),
        };

        // First call - cache miss, should call API and cache
        mockCacheService.get.mockResolvedValueOnce(null);
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        const result1 = await authService.validateToken("same-token");
        expect(result1).toBe(true);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledTimes(1);

        // Second call - cache hit, should not call API
        mockCacheService.get.mockResolvedValueOnce(cachedData);
        const result2 = await authService.validateToken("same-token");
        expect(result2).toBe(true);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledTimes(1); // Still 1
        expect(mockCacheService.get).toHaveBeenCalledTimes(2);
      });

      it("should fetch from controller on cache miss and cache result", async () => {
        mockCacheService.get.mockResolvedValue(null);
        // Token without exp claim - uses default TTL
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("valid-token");

        expect(result).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalledWith(
          getExpectedCacheKey("valid-token"),
        );
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
          { token: "valid-token" },
          expect.objectContaining({
            methods: ["bearer"],
            bearerToken: "valid-token",
          }),
        );
        expect(mockCacheService.set).toHaveBeenCalledWith(
          getExpectedCacheKey("valid-token"),
          expect.objectContaining({
            authenticated: true,
            timestamp: expect.any(Number),
          }),
          900, // Default TTL (no exp claim in token)
        );
      });

      it("should return false for invalid token and cache negative result", async () => {
        mockCacheService.get.mockResolvedValue(null);
        // Token without exp claim - uses default TTL
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: false,
            error: "Invalid token",
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("invalid-token");

        expect(result).toBe(false);
        expect(mockCacheService.set).toHaveBeenCalledWith(
          getExpectedCacheKey("invalid-token"),
          expect.objectContaining({
            authenticated: false,
            timestamp: expect.any(Number),
          }),
          900, // Default TTL (no exp claim in token)
        );
      });

      it("should return false when cache set fails (caught by outer try-catch)", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockRejectedValue(new Error("Cache set failed"));

        const result = await authService.validateToken("valid-token");

        // When cache.set throws, it's caught by outer try-catch and returns false
        expect(result).toBe(false);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalled();
        expect(mockCacheService.set).toHaveBeenCalled();
      });
    });

    it("should fetch from controller on cache miss and cache result", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Token without exp - uses default TTL
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.validateToken("valid-token");

      expect(result).toBe(true);
      expect(mockCacheService.get).toHaveBeenCalledWith(
        getExpectedCacheKey("valid-token"),
      );
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "valid-token" },
        expect.objectContaining({
          methods: ["bearer"],
          bearerToken: "valid-token",
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        getExpectedCacheKey("valid-token"),
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        900, // Default TTL (no exp claim)
      );
    });

    it("should return false for invalid token and cache result", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Token without exp - uses default TTL
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: false,
          error: "Invalid token",
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.validateToken("invalid-token");

      expect(result).toBe(false);
      expect(mockCacheService.set).toHaveBeenCalledWith(
        getExpectedCacheKey("invalid-token"),
        expect.objectContaining({
          authenticated: false,
          timestamp: expect.any(Number),
        }),
        900, // Default TTL (no exp claim)
      );
    });

    describe("edge cases", () => {
      it("should cache result even when JWT decode returns null (uses token hash)", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue(null); // No claims in token
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("token-without-userid");

        expect(result).toBe(true);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
          { token: "token-without-userid" },
          expect.objectContaining({
            methods: ["bearer"],
            bearerToken: "token-without-userid",
          }),
        );
        // Should cache using token hash even when JWT decode returns null
        expect(mockCacheService.set).toHaveBeenCalledWith(
          getExpectedCacheKey("token-without-userid"),
          expect.objectContaining({
            authenticated: true,
            timestamp: expect.any(Number),
          }),
          900, // Default TTL
        );
      });

      it("should return false when cache get fails (safe fallback)", async () => {
        mockCacheService.get.mockRejectedValue(new Error("Cache error"));

        const result = await authService.validateToken("valid-token");

        // When cache.get throws, the error is caught and method returns false
        expect(result).toBe(false);
        expect(mockCacheService.get).toHaveBeenCalledWith(
          getExpectedCacheKey("valid-token"),
        );
        // Should not call API when cache fails (safe fallback)
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
      });

      it("should return false on API error", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockApiClient.auth.validateToken.mockRejectedValue(
          new Error("Network error"),
        );

        const result = await authService.validateToken("token");

        expect(result).toBe(false);
      });

      it("should handle empty token string", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue(null);
        mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
          authenticated: false,
          error: "Invalid token",
        }, timestamp: new Date().toISOString()});

        const result = await authService.validateToken("");

        expect(result).toBe(false);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
          { token: "" },
          expect.objectContaining({
            methods: ['bearer'],
            bearerToken: '',
          }),
        );
      });
    });

    describe("Token hash caching", () => {
      it("should use token hash for cache key (not JWT claims)", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        // Different JWT claims should not affect cache key
        jwt.decode.mockReturnValue({ sub: "user-123" });
        await authService.validateToken("token-1");
        expect(mockCacheService.get).toHaveBeenCalledWith(
          getExpectedCacheKey("token-1"),
        );

        jwt.decode.mockReturnValue({ userId: "user-456" });
        await authService.validateToken("token-2");
        expect(mockCacheService.get).toHaveBeenCalledWith(
          getExpectedCacheKey("token-2"),
        );
      });

      it("should generate deterministic hash for same token", async () => {
        mockCacheService.get.mockResolvedValue(null);
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        // Same token should always generate same hash
        const expectedKey = getExpectedCacheKey("same-token");
        await authService.validateToken("same-token");
        expect(mockCacheService.get).toHaveBeenCalledWith(expectedKey);

        // Call again - should use same cache key
        await authService.validateToken("same-token");
        expect(mockCacheService.get).toHaveBeenNthCalledWith(2, expectedKey);
      });

      it("should handle JWT decode returning non-object gracefully", async () => {
        mockCacheService.get.mockResolvedValue(null);
        // When jwt.decode returns a non-object (string), the implementation
        // should still use token hash for caching
        jwt.decode.mockReturnValue("invalid-decoded-value");
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("token");

        // Should still validate token and cache result using token hash
        expect(result).toBe(true);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalled();
        expect(mockCacheService.set).toHaveBeenCalledWith(
          getExpectedCacheKey("token"),
          expect.objectContaining({
            authenticated: true,
          }),
          900, // Default TTL (no exp claim in decoded token)
        );
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
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        await authService.validateToken("token", authStrategy);

        expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
          { token: "token" },
          expect.objectContaining({
            methods: authStrategy.methods,
            bearerToken: 'token',
          }),
        );
      });

      it("should use cache with authStrategy (uses token hash)", async () => {
        const cachedData = {
          authenticated: true,
          timestamp: Date.now(),
        };
        mockCacheService.get.mockResolvedValue(cachedData);
        const authStrategy = {
          methods: ["bearer"] as AuthMethod[],
          bearerToken: "bearer-token-123",
        };

        const result = await authService.validateToken("token", authStrategy);

        expect(result).toBe(true);
        expect(mockCacheService.get).toHaveBeenCalledWith(
          getExpectedCacheKey("token"),
        );
        // Should not call API when cache hit, even with authStrategy
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
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
      mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
        authenticated: true,
        user: userInfo,
      }, timestamp: new Date().toISOString()});

      const result = await authService.getUser("valid-token");

      expect(result).toEqual(userInfo);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "valid-token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'valid-token',
        }),
      );
    });

    it("should return null for invalid token", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
        authenticated: false,
        error: "Invalid token",
      }, timestamp: new Date().toISOString()});

      const result = await authService.getUser("invalid-token");

      expect(result).toBeNull();
    });

    it("should return null when authenticated but no user object", async () => {
      mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
        authenticated: true,
        // No user object
      }, timestamp: new Date().toISOString()});

      const result = await authService.getUser("token");

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      mockApiClient.auth.validateToken.mockRejectedValue(
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
      mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
        authenticated: true,
        user: userInfo,
      }, timestamp: new Date().toISOString()});

      const result = await authService.getUser("token", authStrategy);

      expect(result).toEqual(userInfo);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: authStrategy.methods,
          bearerToken: 'token',
        }),
      );
    });
  });

  describe("logout", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should call logout endpoint with token in body and clear cache", async () => {
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockApiClient.auth.logoutWithToken.mockResolvedValue(mockResponse);
      mockCacheService.delete.mockResolvedValue(true);

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual(mockResponse);
      expect(mockApiClient.auth.logoutWithToken).toHaveBeenCalledWith(
        "test-token-123",
      );
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("test-token-123"),
      );
    });

    it("should complete logout even when cache delete fails (delete is fire-and-forget)", async () => {
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockApiClient.auth.logoutWithToken.mockResolvedValue(mockResponse);
      // Cache delete is wrapped in void, so failures are silently ignored
      mockCacheService.delete.mockRejectedValue(new Error("Cache delete failed"));

      const result = await authService.logout({ token: "test-token-123" });

      // Should still return success even if cache delete fails (fire-and-forget)
      expect(result).toEqual(mockResponse);
      expect(mockApiClient.auth.logoutWithToken).toHaveBeenCalledWith(
        "test-token-123",
      );
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("test-token-123"),
      );
      // No warning logged because cache.delete is wrapped in void
    });

    it("should return success response on 400 error (no active session) and clear cache", async () => {
      const error = new MisoClientError(
        "No active session",
        undefined,
        {},
        400,
      );

      mockApiClient.auth.logoutWithToken.mockRejectedValue(error);
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
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("test-token-123"),
      );

      // Verify warning was logged
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Logout: No active session (400)"),
        expect.objectContaining({
          correlationId: expect.any(String),
        }),
      );

      consoleWarnSpy.mockRestore();
    });

    it("should return failure response on other failures", async () => {
      const error = new MisoClientError(
        "Internal server error",
        undefined,
        {},
        500,
      );

      mockApiClient.auth.logoutWithToken.mockRejectedValue(error);

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual({
        success: false,
        message: "Logout failed",
        timestamp: expect.any(String),
      });
    });

    it("should handle non-Error thrown values", async () => {
      mockApiClient.auth.logoutWithToken.mockRejectedValue("String error");

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual({
        success: false,
        message: "Logout failed",
        timestamp: expect.any(String),
      });
    });

    it("should clear cache even when userId not found in token", async () => {
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockApiClient.auth.logoutWithToken.mockResolvedValue(mockResponse);

      const result = await authService.logout({
        token: "token-without-userid",
      });

      expect(result).toEqual(mockResponse);
      expect(mockApiClient.auth.logoutWithToken).toHaveBeenCalledWith(
        "token-without-userid",
      );
      // With token hash, cache is always cleared regardless of JWT claims
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("token-without-userid"),
      );
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
      mockApiClient.auth.logoutWithToken.mockRejectedValue(axiosError);
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
      expect(mockApiClient.auth.logoutWithToken).toHaveBeenCalledWith(
        "test-token-123",
      );
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("test-token-123"),
      );

      consoleWarnSpy.mockRestore();
    });
  });

  describe("isAuthenticated", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should delegate to validateToken and return authentication status", async () => {
      mockCacheService.get.mockResolvedValue(null);
      // Token without exp - uses default TTL
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.isAuthenticated("token");

      expect(result).toBe(true);
      // Should use validateToken which includes caching with token hash
      expect(mockCacheService.get).toHaveBeenCalledWith(
        getExpectedCacheKey("token"),
      );
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
    });

    it("should pass authStrategy to validateToken", async () => {
      const authStrategy = {
        methods: ["bearer"] as AuthMethod[],
        bearerToken: "bearer-token-123",
      };
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.isAuthenticated("token", authStrategy);

      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: authStrategy.methods,
          bearerToken: 'token',
        }),
      );
    });

    it("should return false when token is invalid", async () => {
      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
        authenticated: false,
        error: "Invalid token",
      }, timestamp: new Date().toISOString()});
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
        status: 200,
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
      authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);

      mockTempAxios.post.mockResolvedValue({
        status: 200,
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
      authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);

      mockTempAxios.post.mockResolvedValue({
        status: 200,
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
      authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);

      mockTempAxios.post.mockResolvedValue({
        status: 200,
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

    it("should handle status 201 Created with nested data.data.token format", async () => {
      config = {
        controllerUrl: "http://127.0.0.1:3110",
        clientId: "miso-controller-miso-miso-test",
        clientSecret: "test-secret",
        clientTokenUri: "/api/v1/auth/token",
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);

      // Simulate the actual controller response format: status 201 with nested data.data.token
      mockTempAxios.post.mockResolvedValue({
        status: 201,
        statusText: "Created",
        data: {
          data: {
            token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token",
            expiresIn: 900,
            expiresAt: "2026-01-09T14:43:06.000Z",
          },
        },
      });

      const result = await authService.getEnvironmentToken();

      expect(result).toBe("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token");
      expect(mockTempAxios.post).toHaveBeenCalledWith("/api/v1/auth/token");
    });

    it("should throw error on invalid response", async () => {
      mockTempAxios.post.mockResolvedValue({
        data: {
          success: false,
        },
      });

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.getEnvironmentToken();

      expect(result).toBe("");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Get environment token failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: expect.any(String),
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return empty string on network failure", async () => {
      mockTempAxios.post.mockRejectedValue(new Error("Network error"));

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.getEnvironmentToken();

      expect(result).toBe("");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Get environment token failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: expect.any(String),
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle non-Error thrown values", async () => {
      mockTempAxios.post.mockRejectedValue("String error");

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.getEnvironmentToken();

      expect(result).toBe("");
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Get environment token failed: Unknown error"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: expect.any(String),
        }),
      );

      consoleErrorSpy.mockRestore();
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
      mockApiClient.auth.getUser.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: userInfo,
        },
        timestamp: new Date().toISOString(),
      });

      const result = await authService.getUserInfo("valid-token");

      expect(result).toEqual(userInfo);
      expect(mockApiClient.auth.getUser).toHaveBeenCalledWith(
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'valid-token',
        }),
      );
    });

    it("should return null on error", async () => {
      mockApiClient.auth.getUser.mockRejectedValue(
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
      mockApiClient.auth.getUser.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: userInfo,
        },
        timestamp: new Date().toISOString(),
      });

      const result = await authService.getUserInfo("token", authStrategy);

      expect(result).toEqual(userInfo);
      expect(mockApiClient.auth.getUser).toHaveBeenCalledWith(
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'token',
        }),
      );
    });

    it("should handle empty user info response", async () => {
      mockApiClient.auth.getUser.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: {},
        },
        timestamp: new Date().toISOString(),
      });

      const result = await authService.getUserInfo("token");

      expect(result).toEqual({});
    });

    describe("getUserInfo caching", () => {
      beforeEach(() => {
        jest.clearAllMocks();
      });

      it("should return cached user info on cache hit", async () => {
        const cachedUser = {
          id: "cached-123",
          username: "cacheduser",
          email: "cached@example.com",
        };
        jwt.decode.mockReturnValue({ sub: "cached-123" });
        mockCacheService.get.mockResolvedValue({
          user: cachedUser,
          timestamp: Date.now(),
        });

        const result = await authService.getUserInfo("valid-token");

        expect(result).toEqual(cachedUser);
        expect(mockCacheService.get).toHaveBeenCalledWith("user:cached-123");
        expect(mockApiClient.auth.getUser).not.toHaveBeenCalled();
      });

      it("should fetch from API and cache on cache miss", async () => {
        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        jwt.decode.mockReturnValue({ sub: "123" });
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(true);
        mockApiClient.auth.getUser.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: userInfo,
          },
          timestamp: new Date().toISOString(),
        });

        const result = await authService.getUserInfo("valid-token");

        expect(result).toEqual(userInfo);
        expect(mockCacheService.get).toHaveBeenCalledWith("user:123");
        expect(mockApiClient.auth.getUser).toHaveBeenCalled();
        expect(mockCacheService.set).toHaveBeenCalledWith(
          "user:123",
          expect.objectContaining({
            user: userInfo,
            timestamp: expect.any(Number),
          }),
          300, // default userTTL
        );
      });

      it("should use custom userTTL from config", async () => {
        // Create new service with custom TTL
        const customConfig = {
          ...config,
          cache: { userTTL: 600 }, // 10 minutes
        };
        (mockHttpClient as unknown as { config: typeof customConfig }).config = customConfig;
        const customAuthService = new AuthService(mockHttpClient, mockApiClient as unknown as ApiClient, mockCacheService);

        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        jwt.decode.mockReturnValue({ sub: "123" });
        mockCacheService.get.mockResolvedValue(null);
        mockCacheService.set.mockResolvedValue(true);
        mockApiClient.auth.getUser.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: userInfo,
          },
          timestamp: new Date().toISOString(),
        });

        await customAuthService.getUserInfo("valid-token");

        expect(mockCacheService.set).toHaveBeenCalledWith(
          "user:123",
          expect.objectContaining({ user: userInfo }),
          600, // custom userTTL
        );

        // Restore original config
        (mockHttpClient as unknown as { config: typeof config }).config = config;
      });

      it("should not cache when userId cannot be extracted from token", async () => {
        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        jwt.decode.mockReturnValue(null); // No userId in token
        mockApiClient.auth.getUser.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: userInfo,
          },
          timestamp: new Date().toISOString(),
        });

        const result = await authService.getUserInfo("valid-token");

        expect(result).toEqual(userInfo);
        expect(mockCacheService.get).not.toHaveBeenCalled();
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it("should return null on error even with cache miss", async () => {
        jwt.decode.mockReturnValue({ sub: "123" });
        mockCacheService.get.mockResolvedValue(null);
        mockApiClient.auth.getUser.mockRejectedValue(new Error("Network error"));

        const result = await authService.getUserInfo("valid-token");

        expect(result).toBeNull();
      });
    });
  });

  describe("clearUserCache", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should clear user cache when userId can be extracted", () => {
      jwt.decode.mockReturnValue({ sub: "user-123" });
      mockCacheService.delete.mockResolvedValue(true);

      authService.clearUserCache("valid-token");

      expect(mockCacheService.delete).toHaveBeenCalledWith("user:user-123");
    });

    it("should not attempt cache delete when userId cannot be extracted", () => {
      jwt.decode.mockReturnValue(null);

      authService.clearUserCache("invalid-token");

      expect(mockCacheService.delete).not.toHaveBeenCalled();
    });

    it("should handle cache delete errors gracefully", () => {
      jwt.decode.mockReturnValue({ sub: "user-123" });
      mockCacheService.delete.mockRejectedValue(new Error("Redis error"));

      // Should not throw
      expect(() => authService.clearUserCache("valid-token")).not.toThrow();
    });
  });

  describe("logout clears user cache", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should clear both token and user cache on successful logout", async () => {
      jwt.decode.mockReturnValue({ sub: "user-123" });
      mockApiClient.auth.logoutWithToken.mockResolvedValue({
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      });
      mockCacheService.delete.mockResolvedValue(true);

      await authService.logout({ token: "valid-token" });

      // Should clear token cache (using token hash)
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        expect.stringContaining("token_validation:"),
      );
      // Should clear user cache
      expect(mockCacheService.delete).toHaveBeenCalledWith("user:user-123");
    });

    it("should clear both caches on 400 error (no active session)", async () => {
      jwt.decode.mockReturnValue({ sub: "user-123" });
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
      mockApiClient.auth.logoutWithToken.mockRejectedValue(axiosError);
      mockCacheService.delete.mockResolvedValue(true);

      const result = await authService.logout({ token: "valid-token" });

      expect(result.success).toBe(true);
      // Should clear token cache
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        expect.stringContaining("token_validation:"),
      );
      // Should clear user cache
      expect(mockCacheService.delete).toHaveBeenCalledWith("user:user-123");
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
      authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);
    });

    describe("validateToken with API_KEY", () => {
      beforeEach(() => {
        jest.clearAllMocks();
        jwt.decode.mockReturnValue(null);
      });

      it("should return true for matching API_KEY without calling controller or cache", async () => {
        const result = await authService.validateToken("test-api-key-123");

        expect(result).toBe(true);
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
        expect(mockCacheService.get).not.toHaveBeenCalled();
        expect(mockCacheService.set).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("different-token");

        expect(result).toBe(true);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
          { token: "different-token" },
          expect.objectContaining({
            methods: ['bearer'],
            bearerToken: 'different-token',
          }),
        );
      });

      it("should be case-sensitive", async () => {
        mockCacheService.get.mockResolvedValue(null);
        jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
        mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
          authenticated: false,
          error: "Invalid token",
        }, timestamp: new Date().toISOString()});
        mockCacheService.set.mockResolvedValue(true);

        const result = await authService.validateToken("TEST-API-KEY-123");

        expect(result).toBe(false);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalled();
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
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        mockApiClient.auth.validateToken.mockResolvedValue({success: true, data: {
          authenticated: true,
          user: userInfo,
        }, timestamp: new Date().toISOString()});

        const result = await authService.getUser("different-token");

        expect(result).toEqual(userInfo);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
          { token: "different-token" },
          expect.objectContaining({
            methods: ['bearer'],
            bearerToken: 'different-token',
          }),
        );
      });
    });

    describe("getUserInfo with API_KEY", () => {
      it("should return null for matching API_KEY without calling controller", async () => {
        const result = await authService.getUserInfo("test-api-key-123");

        expect(result).toBeNull();
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        const userInfo = {
          id: "123",
          username: "testuser",
          email: "test@example.com",
        };
        mockApiClient.auth.getUser.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: userInfo,
        },
        timestamp: new Date().toISOString(),
      });

        const result = await authService.getUserInfo("different-token");

        expect(result).toEqual(userInfo);
        expect(mockApiClient.auth.getUser).toHaveBeenCalledWith(
          expect.objectContaining({
            methods: ['bearer'],
            bearerToken: 'different-token',
          }),
        );
      });
    });

    describe("isAuthenticated with API_KEY", () => {
      it("should return true for matching API_KEY (delegates to validateToken)", async () => {
        const result = await authService.isAuthenticated("test-api-key-123");

        expect(result).toBe(true);
        expect(mockApiClient.auth.validateToken).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        mockApiClient.auth.validateToken.mockResolvedValue({
          success: true,
          data: {
            authenticated: true,
            user: { id: "123", username: "testuser", email: "test@example.com" },
          },
          timestamp: new Date().toISOString(),
        });

        const result = await authService.isAuthenticated("different-token");

        expect(result).toBe(true);
        expect(mockApiClient.auth.validateToken).toHaveBeenCalled();
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
      authService = new AuthService(mockHttpClient, mockApiClient as any, mockCacheService);

      mockCacheService.get.mockResolvedValue(null);
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      const result = await authService.validateToken("some-token");

      expect(result).toBe(true);
      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "some-token" },
        expect.objectContaining({
          methods: ['bearer'],
          bearerToken: 'some-token',
        }),
      );
    });
  });

  describe("clearTokenCache", () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should delete cache key using token hash", () => {
      mockCacheService.delete.mockResolvedValue(true);

      authService.clearTokenCache("test-token");

      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("test-token"),
      );
    });

    it("should always delete cache regardless of JWT decode result", () => {
      mockCacheService.delete.mockResolvedValue(true);

      // Even when JWT decode returns null, cache should be deleted using token hash
      authService.clearTokenCache("invalid-token");

      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("invalid-token"),
      );
    });

    it("should handle gracefully when crypto hash fails", () => {
      // Crypto hash should never fail for string input, but test error handling
      mockCacheService.delete.mockResolvedValue(true);

      // Should not throw
      expect(() => {
        authService.clearTokenCache("test-token");
      }).not.toThrow();

      expect(mockCacheService.delete).toHaveBeenCalled();
    });

    it("should handle cache delete failure gracefully (fire-and-forget)", () => {
      // Cache delete is wrapped in void, so failures are silently ignored
      mockCacheService.delete.mockRejectedValue(
        new Error("Cache delete failed"),
      );

      // Should not throw even if cache delete fails (fire-and-forget)
      expect(() => {
        authService.clearTokenCache("test-token");
      }).not.toThrow();

      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey("test-token"),
      );
      // No warning logged because cache.delete is wrapped in void (fire-and-forget)
    });

    it("should generate deterministic cache key for same token", () => {
      mockCacheService.delete.mockResolvedValue(true);

      // Call clearTokenCache twice with same token
      authService.clearTokenCache("same-token");
      authService.clearTokenCache("same-token");

      const expectedKey = getExpectedCacheKey("same-token");
      expect(mockCacheService.delete).toHaveBeenNthCalledWith(1, expectedKey);
      expect(mockCacheService.delete).toHaveBeenNthCalledWith(2, expectedKey);
    });

    it("should handle empty token string (generates hash of empty string)", () => {
      mockCacheService.delete.mockResolvedValue(true);

      authService.clearTokenCache("");

      // Empty string still generates a valid SHA-256 hash
      expect(mockCacheService.delete).toHaveBeenCalledWith(
        getExpectedCacheKey(""),
      );
    });
  });

  describe("validateToken with custom TTL", () => {
    it("should use custom tokenValidationTTL from config (no exp claim)", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        cache: { tokenValidationTTL: 600 }, // 10 minutes
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(
        mockHttpClient,
        mockApiClient as unknown as ApiClient,
        mockCacheService,
      );

      mockCacheService.get.mockResolvedValue(null);
      // Token without exp claim - uses configured TTL
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.validateToken("token");

      expect(mockApiClient.auth.validateToken).toHaveBeenCalledWith(
        { token: "token" },
        expect.objectContaining({
          methods: ["bearer"],
          bearerToken: "token",
        }),
      );
      expect(mockCacheService.set).toHaveBeenCalledWith(
        getExpectedCacheKey("token"),
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        600, // Custom TTL (no exp claim, uses configured value)
      );
    });

    it("should use smart TTL based on token expiration when exp claim present", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        cache: { tokenValidationTTL: 900 }, // 15 minutes max
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(
        mockHttpClient,
        mockApiClient as unknown as ApiClient,
        mockCacheService,
      );

      mockCacheService.get.mockResolvedValue(null);
      // Token expires in 5 minutes (300s), should use 300 - 30 = 270s TTL
      const now = Math.floor(Date.now() / 1000);
      jwt.decode.mockReturnValue({ sub: "123", exp: now + 300 });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.validateToken("token-with-exp");

      expect(mockCacheService.set).toHaveBeenCalledWith(
        getExpectedCacheKey("token-with-exp"),
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        270, // Smart TTL: 300 - 30 buffer = 270s
      );
    });

    it("should use minValidationTTL when token expires very soon", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        cache: { tokenValidationTTL: 900, minValidationTTL: 60 },
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(
        mockHttpClient,
        mockApiClient as unknown as ApiClient,
        mockCacheService,
      );

      mockCacheService.get.mockResolvedValue(null);
      // Token expires in 50s, after 30s buffer = 20s, but min is 60s
      const now = Math.floor(Date.now() / 1000);
      jwt.decode.mockReturnValue({ sub: "123", exp: now + 50 });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.validateToken("token-expires-soon");

      expect(mockCacheService.set).toHaveBeenCalledWith(
        getExpectedCacheKey("token-expires-soon"),
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        60, // Min TTL (50 - 30 = 20 < 60, so uses 60)
      );
    });

    it("should cap TTL at tokenValidationTTL when token has long expiration", async () => {
      config = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
        cache: { tokenValidationTTL: 900 }, // 15 minutes max
      };
      (mockHttpClient as any).config = config;
      authService = new AuthService(
        mockHttpClient,
        mockApiClient as unknown as ApiClient,
        mockCacheService,
      );

      mockCacheService.get.mockResolvedValue(null);
      // Token expires in 2 hours (7200s), should cap at 900s
      const now = Math.floor(Date.now() / 1000);
      jwt.decode.mockReturnValue({ sub: "123", exp: now + 7200 });
      mockApiClient.auth.validateToken.mockResolvedValue({
        success: true,
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser", email: "test@example.com" },
        },
        timestamp: new Date().toISOString(),
      });
      mockCacheService.set.mockResolvedValue(true);

      await authService.validateToken("token-long-exp");

      expect(mockCacheService.set).toHaveBeenCalledWith(
        getExpectedCacheKey("token-long-exp"),
        expect.objectContaining({
          authenticated: true,
          timestamp: expect.any(Number),
        }),
        900, // Capped at tokenValidationTTL
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
      // Mock API response format (what ApiClient returns)
      mockApiClient.auth.refreshToken.mockResolvedValue({
        success: true,
        data: {
          accessToken: mockRefreshResponse.accessToken,
          refreshToken: mockRefreshResponse.refreshToken,
          expiresIn: mockRefreshResponse.expiresIn,
        },
        timestamp: mockRefreshResponse.timestamp,
      });

      const result = await authService.refreshToken(mockRefreshToken);

      // Service transforms the response, so expect the transformed format
      expect(result).toEqual({
        success: true,
        accessToken: mockRefreshResponse.accessToken,
        refreshToken: mockRefreshResponse.refreshToken,
        expiresIn: mockRefreshResponse.expiresIn,
        expiresAt: mockRefreshResponse.timestamp,
        timestamp: mockRefreshResponse.timestamp,
      });
      expect(mockApiClient.auth.refreshToken).toHaveBeenCalledWith(
        { refreshToken: mockRefreshToken },
        undefined,
      );
    });

    it("should successfully refresh token using authenticatedRequest when authStrategy provided", async () => {
      const authStrategy = {
        methods: ["bearer", "client-token"] as AuthMethod[],
        bearerToken: "bearer-token-123",
      };
      mockApiClient.auth.refreshToken.mockResolvedValue({
        success: true,
        data: {
          accessToken: mockRefreshResponse.accessToken,
          refreshToken: mockRefreshResponse.refreshToken,
          expiresIn: mockRefreshResponse.expiresIn,
        },
        timestamp: mockRefreshResponse.timestamp,
      });

      const result = await authService.refreshToken(
        mockRefreshToken,
        authStrategy,
      );

      expect(result).toEqual({ success: true, accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn, expiresAt: mockRefreshResponse.timestamp, timestamp: mockRefreshResponse.timestamp });
      expect(mockApiClient.auth.refreshToken).toHaveBeenCalledWith(
        { refreshToken: mockRefreshToken },
        authStrategy,
      );
    });

    it("should return null on MisoClientError", async () => {
      const error = new MisoClientError(
        "Invalid refresh token",
        undefined,
        {},
        401,
      );
      mockApiClient.auth.refreshToken.mockRejectedValue(error);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: "ctrl-dev-test-app",
          operation: "Refresh token",
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null on network error", async () => {
      const error = new Error("Network error");
      mockApiClient.auth.refreshToken.mockRejectedValue(error);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: "ctrl-dev-test-app",
          operation: "Refresh token",
        }),
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
      mockApiClient.auth.refreshToken.mockRejectedValue(axiosError);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: "ctrl-dev-test-app",
          operation: "Refresh token",
        }),
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return null on AxiosError without response", async () => {
      const axiosError = {
        isAxiosError: true,
        message: "Network timeout",
        request: {},
      };
      mockApiClient.auth.refreshToken.mockRejectedValue(axiosError);

      // Mock console.error to suppress expected error in test output
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Refresh token failed"),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: "ctrl-dev-test-app",
          operation: "Refresh token",
        }),
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
      mockApiClient.auth.refreshToken.mockRejectedValue(error);

      // Mock console.error to capture error message
      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      await authService.refreshToken(mockRefreshToken);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[correlationId: .+, clientId: ctrl-dev-test-app\]/),
        expect.objectContaining({
          correlationId: expect.any(String),
          clientId: "ctrl-dev-test-app",
          operation: "Refresh token",
        }),
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
      mockApiClient.auth.refreshToken.mockRejectedValue(error);

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
      mockApiClient.auth.refreshToken.mockRejectedValue(error);

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
      mockApiClient.auth.refreshToken.mockRejectedValue(error);

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const result = await authService.refreshToken("");

      expect(result).toBeNull();
      expect(mockApiClient.auth.refreshToken).toHaveBeenCalledWith(
        { refreshToken: "" },
        undefined,
      );

      consoleErrorSpy.mockRestore();
    });

    it("should handle malformed response (missing accessToken)", async () => {
      const malformedResponse = {
        success: true,
        refreshToken: "new-refresh-token-789",
        // Missing accessToken
      };
      mockApiClient.auth.refreshToken.mockResolvedValue({
        success: true,
        data: malformedResponse,
        timestamp: new Date().toISOString(),
      } as any);

      const result = await authService.refreshToken(mockRefreshToken);

      // Service transforms response, so expect transformed format
      expect(result).toEqual({
        success: true,
        accessToken: undefined,
        refreshToken: malformedResponse.refreshToken || mockRefreshToken,
        expiresIn: undefined,
        expiresAt: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("should handle response with partial fields", async () => {
      const partialResponse = {
        success: true,
        accessToken: "new-access-token-456",
        // Missing refreshToken and expiresIn
      };
      mockApiClient.auth.refreshToken.mockResolvedValue({
        success: true,
        data: partialResponse,
        timestamp: new Date().toISOString(),
      } as any);

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual({
        success: true,
        accessToken: partialResponse.accessToken,
        refreshToken: mockRefreshToken, // Falls back to input refreshToken
        expiresIn: undefined,
        expiresAt: expect.any(String),
        timestamp: expect.any(String),
      });
    });

    it("should handle refresh token with special characters", async () => {
      const specialToken = "refresh-token-with-special-chars-!@#$%^&*()";
      mockApiClient.auth.refreshToken.mockResolvedValue({ success: true, data: { accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn }, timestamp: mockRefreshResponse.timestamp });

      const result = await authService.refreshToken(specialToken);

      expect(result).toEqual({ success: true, accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn, expiresAt: mockRefreshResponse.timestamp, timestamp: mockRefreshResponse.timestamp });
      expect(mockApiClient.auth.refreshToken).toHaveBeenCalledWith(
        { refreshToken: specialToken },
        undefined,
      );
    });

    it("should handle very long refresh token", async () => {
      const longToken = "a".repeat(10000); // Very long token
      mockApiClient.auth.refreshToken.mockResolvedValue({ success: true, data: { accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn }, timestamp: mockRefreshResponse.timestamp });

      const result = await authService.refreshToken(longToken);

      expect(result).toEqual({ success: true, accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn, expiresAt: mockRefreshResponse.timestamp, timestamp: mockRefreshResponse.timestamp });
      expect(mockApiClient.auth.refreshToken).toHaveBeenCalledWith(
        { refreshToken: longToken },
        undefined,
      );
    });

    it("should handle refresh token with unicode characters", async () => {
      const unicodeToken = "refresh-token-测试-🚀-émoji";
      mockApiClient.auth.refreshToken.mockResolvedValue({ success: true, data: { accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn }, timestamp: mockRefreshResponse.timestamp });

      const result = await authService.refreshToken(unicodeToken);

      expect(result).toEqual({ success: true, accessToken: mockRefreshResponse.accessToken, refreshToken: mockRefreshResponse.refreshToken, expiresIn: mockRefreshResponse.expiresIn, expiresAt: mockRefreshResponse.timestamp, timestamp: mockRefreshResponse.timestamp });
      expect(mockApiClient.auth.refreshToken).toHaveBeenCalledWith(
        { refreshToken: unicodeToken },
        undefined,
      );
    });

    it("should handle response with expiresAt in different formats", async () => {
      const responseWithExpiresAt = {
        ...mockRefreshResponse,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      };
      mockApiClient.auth.refreshToken.mockResolvedValue({
        success: true,
        data: {
          accessToken: responseWithExpiresAt.accessToken,
          refreshToken: responseWithExpiresAt.refreshToken,
          expiresIn: responseWithExpiresAt.expiresIn,
        },
        timestamp: responseWithExpiresAt.timestamp,
      });

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual({
        success: true,
        accessToken: responseWithExpiresAt.accessToken,
        refreshToken: responseWithExpiresAt.refreshToken,
        expiresIn: responseWithExpiresAt.expiresIn,
        expiresAt: responseWithExpiresAt.timestamp,
        timestamp: responseWithExpiresAt.timestamp,
      });
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
      mockApiClient.auth.refreshToken.mockResolvedValue({
        success: true,
        data: responseWithoutExpiresAt,
        timestamp: new Date().toISOString(),
      });

      const result = await authService.refreshToken(mockRefreshToken);

      expect(result).toEqual({
        success: true,
        accessToken: responseWithoutExpiresAt.accessToken,
        refreshToken: responseWithoutExpiresAt.refreshToken || mockRefreshToken,
        expiresIn: responseWithoutExpiresAt.expiresIn,
        expiresAt: expect.any(String), // Service always sets expiresAt from timestamp
        timestamp: expect.any(String),
      });
      expect(result?.expiresAt).toBeDefined(); // Service always sets expiresAt
    });
  });
});

