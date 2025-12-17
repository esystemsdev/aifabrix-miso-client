/**
 * Unit tests for client-token-endpoint helper
 */

import { createClientTokenEndpoint, hasConfig } from "../../src/express/client-token-endpoint";
import { MisoClient } from "../../src/index";
import { Request, Response } from "express";
import { getEnvironmentToken } from "../../src/utils/environment-token";

// Mock getEnvironmentToken
jest.mock("../../src/utils/environment-token", () => ({
  getEnvironmentToken: jest.fn(),
}));

const mockGetEnvironmentToken = getEnvironmentToken as jest.MockedFunction<
  typeof getEnvironmentToken
>;

describe("client-token-endpoint", () => {
  let mockMisoClient: jest.Mocked<MisoClient>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockMisoClient = {
      isInitialized: jest.fn().mockReturnValue(true),
      getConfig: jest.fn().mockReturnValue({
        controllerUrl: "https://controller.aifabrix.ai",
        controllerPublicUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        allowedOrigins: ["http://localhost:3000"],
      }),
      getEnvironmentToken: jest.fn().mockResolvedValue("test-client-token"),
      log: {
        error: jest.fn().mockResolvedValue(undefined),
        audit: jest.fn().mockResolvedValue(undefined),
      },
    } as any;

    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({
      json: jsonSpy,
    });

    mockRequest = {
      protocol: "http",
      get: jest.fn().mockReturnValue("localhost:3083"),
      headers: {
        origin: "http://localhost:3000",
      },
    } as any;

    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    } as any;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("createClientTokenEndpoint", () => {
    it("should return route handler function", () => {
      const handler = createClientTokenEndpoint(mockMisoClient);
      expect(typeof handler).toBe("function");
    });

    it("should return token and config in response", async () => {
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(mockGetEnvironmentToken).toHaveBeenCalledWith(
        mockMisoClient,
        mockRequest,
      );
      expect(statusSpy).not.toHaveBeenCalled();
      expect(jsonSpy).toHaveBeenCalledWith({
        token: "test-token-123",
        expiresIn: 1800,
        config: {
          baseUrl: "http://localhost:3083",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      });
    });

    it("should use custom clientTokenUri and expiresIn", async () => {
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient, {
        clientTokenUri: "/custom/token",
        expiresIn: 3600,
      });
      await handler(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        token: "test-token-123",
        expiresIn: 3600,
        config: {
          baseUrl: "http://localhost:3083",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/custom/token",
        },
      });
    });

    it("should exclude config when includeConfig is false", async () => {
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient, {
        includeConfig: false,
      });
      await handler(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        token: "test-token-123",
        expiresIn: 1800,
      });
    });

    it("should return 503 if misoClient is not initialized", async () => {
      mockMisoClient.isInitialized = jest.fn().mockReturnValue(false);

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(503);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: "Service Unavailable",
        message: "MisoClient is not initialized",
      });
      expect(mockGetEnvironmentToken).not.toHaveBeenCalled();
    });

    it("should return 403 if origin validation fails", async () => {
      mockGetEnvironmentToken.mockRejectedValue(
        new Error("Origin validation failed: Origin not allowed"),
      );

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(403);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: "Forbidden",
        message: "Origin validation failed: Origin not allowed",
      });
    });

    it("should return 500 if controller URL is not configured", async () => {
      mockMisoClient.getConfig = jest.fn().mockReturnValue({
        clientId: "ctrl-dev-test-app",
        // No controllerUrl or controllerPublicUrl
      });
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: "Internal Server Error",
        message: "Controller URL not configured",
      });
    });

    it("should use controllerPublicUrl when available", async () => {
      mockMisoClient.getConfig = jest.fn().mockReturnValue({
        controllerUrl: "https://controller-internal.local",
        controllerPublicUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
      });
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        token: "test-token-123",
        expiresIn: 1800,
        config: {
          baseUrl: "http://localhost:3083",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      });
    });

    it("should fallback to controllerUrl when controllerPublicUrl is not set", async () => {
      mockMisoClient.getConfig = jest.fn().mockReturnValue({
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        // No controllerPublicUrl
      });
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        token: "test-token-123",
        expiresIn: 1800,
        config: {
          baseUrl: "http://localhost:3083",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: undefined,
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      });
    });

    it("should return 500 for other errors", async () => {
      mockGetEnvironmentToken.mockRejectedValue(
        new Error("Token fetch failed"),
      );

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      expect(statusSpy).toHaveBeenCalledWith(500);
      expect(jsonSpy).toHaveBeenCalledWith({
        error: "Internal Server Error",
        message: "Token fetch failed",
      });
    });
  });

  describe("hasConfig", () => {
    it("should return true when config is present", () => {
      const response = {
        token: "test-token",
        expiresIn: 1800,
        config: {
          baseUrl: "http://localhost:3083",
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      };

      expect(hasConfig(response)).toBe(true);
      if (hasConfig(response)) {
        expect(response.config.baseUrl).toBe("http://localhost:3083");
      }
    });

    it("should return false when config is missing", () => {
      const response = {
        token: "test-token",
        expiresIn: 1800,
      };

      expect(hasConfig(response)).toBe(false);
    });

    it("should return false when config is undefined", () => {
      const response = {
        token: "test-token",
        expiresIn: 1800,
        config: undefined,
      };

      expect(hasConfig(response)).toBe(false);
    });
  });
});

