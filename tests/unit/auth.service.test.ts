/**
 * Unit tests for AuthService
 */

import { AuthService } from "../../src/services/auth.service";
import { HttpClient } from "../../src/utils/http-client";
import { RedisService } from "../../src/services/redis.service";
import { MisoClientConfig } from "../../src/types/config.types";
import { MisoClientError } from "../../src/utils/errors";

// Mock HttpClient
jest.mock("../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock("../../src/services/redis.service");
const MockedRedisService = RedisService as jest.MockedClass<
  typeof RedisService
>;

// Mock axios for getEnvironmentToken
jest.mock("axios");

describe("AuthService", () => {
  let authService: AuthService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
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

    mockRedisService = {} as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    authService = new AuthService(mockHttpClient, mockRedisService);
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
    it("should return true for valid token", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });

      const result = await authService.validateToken("valid-token");

      expect(result).toBe(true);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "valid-token",
        undefined,
      );
    });

    it("should return false for invalid token", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: false,
        error: "Invalid token",
      });

      const result = await authService.validateToken("invalid-token");

      expect(result).toBe(false);
    });

    it("should return false on error", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await authService.validateToken("token");

      expect(result).toBe(false);
    });
  });

  describe("getUser", () => {
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
    });

    it("should return null for invalid token", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: false,
        error: "Invalid token",
      });

      const result = await authService.getUser("invalid-token");

      expect(result).toBeNull();
    });

    it("should return null on error", async () => {
      mockHttpClient.validateTokenRequest.mockRejectedValue(
        new Error("Network error"),
      );

      const result = await authService.getUser("token");

      expect(result).toBeNull();
    });
  });

  describe("logout", () => {
    it("should call logout endpoint with token in body", async () => {
      const mockResponse = {
        success: true,
        message: "Logout successful",
        timestamp: new Date().toISOString(),
      };
      mockHttpClient.request.mockResolvedValue(mockResponse);

      const result = await authService.logout({ token: "test-token-123" });

      expect(result).toEqual(mockResponse);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/auth/logout",
        { token: "test-token-123" },
      );
    });

    it("should return success response on 400 error (no active session)", async () => {
      const error = new MisoClientError(
        "No active session",
        undefined,
        {},
        400,
      );

      mockHttpClient.request.mockRejectedValue(error);

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
  });

  describe("isAuthenticated", () => {
    it("should return authentication status", async () => {
      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });

      const result = await authService.isAuthenticated("token");

      expect(result).toBe(true);
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
        if (config?.headers?.["X-Client-Id"]) {
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
      authService = new AuthService(mockHttpClient, mockRedisService);

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
      authService = new AuthService(mockHttpClient, mockRedisService);

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
      authService = new AuthService(mockHttpClient, mockRedisService);

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
      authService = new AuthService(mockHttpClient, mockRedisService);
    });

    describe("validateToken with API_KEY", () => {
      it("should return true for matching API_KEY without calling controller", async () => {
        const result = await authService.validateToken("test-api-key-123");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).not.toHaveBeenCalled();
      });

      it("should fall through to controller for non-matching token", async () => {
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: true,
          user: { id: "123", username: "testuser" },
        });

        const result = await authService.validateToken("different-token");

        expect(result).toBe(true);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
          "different-token",
          undefined,
        );
      });

      it("should be case-sensitive", async () => {
        mockHttpClient.validateTokenRequest.mockResolvedValue({
          authenticated: false,
          error: "Invalid token",
        });

        const result = await authService.validateToken("TEST-API-KEY-123");

        expect(result).toBe(false);
        expect(mockHttpClient.validateTokenRequest).toHaveBeenCalled();
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
      authService = new AuthService(mockHttpClient, mockRedisService);

      mockHttpClient.validateTokenRequest.mockResolvedValue({
        authenticated: true,
        user: { id: "123", username: "testuser" },
      });

      const result = await authService.validateToken("some-token");

      expect(result).toBe(true);
      expect(mockHttpClient.validateTokenRequest).toHaveBeenCalledWith(
        "some-token",
        undefined,
      );
    });
  });
});
