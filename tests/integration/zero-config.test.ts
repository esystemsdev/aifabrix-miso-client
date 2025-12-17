/**
 * Integration tests for zero-config DataClient setup
 * Tests end-to-end flow: server endpoint -> client initialization
 */

import { MisoClient } from "../../src/index";
import { createClientTokenEndpoint } from "../../src/express/client-token-endpoint";
import { autoInitializeDataClient } from "../../src/utils/data-client-auto-init";
import { Request, Response } from "express";
import { getEnvironmentToken } from "../../src/utils/environment-token";

// Mock getEnvironmentToken
jest.mock("../../src/utils/environment-token", () => ({
  getEnvironmentToken: jest.fn(),
}));

const mockGetEnvironmentToken = getEnvironmentToken as jest.MockedFunction<
  typeof getEnvironmentToken
>;

// Mock DataClient
jest.mock("../../src/utils/data-client", () => ({
  DataClient: jest.fn(),
}));

// Mock data-client-utils
jest.mock("../../src/utils/data-client-utils", () => ({
  isBrowser: jest.fn(),
  getLocalStorage: jest.fn(),
  setLocalStorage: jest.fn(),
  removeLocalStorage: jest.fn(),
}));

import { isBrowser, getLocalStorage, setLocalStorage, removeLocalStorage } from "../../src/utils/data-client-utils";

const mockIsBrowser = isBrowser as jest.MockedFunction<typeof isBrowser>;
const mockGetLocalStorage = getLocalStorage as jest.MockedFunction<typeof getLocalStorage>;
const mockSetLocalStorage = setLocalStorage as jest.MockedFunction<typeof setLocalStorage>;
const mockRemoveLocalStorage = removeLocalStorage as jest.MockedFunction<typeof removeLocalStorage>;

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock window
const mockWindow = {
  location: { origin: "https://example.com" },
};
(global as any).window = mockWindow;

describe("Zero-Config Integration", () => {
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
        allowedOrigins: ["https://example.com"],
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
      protocol: "https",
      get: jest.fn().mockReturnValue("example.com"),
      headers: {
        origin: "https://example.com",
      },
    } as any;

    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    } as any;

    mockIsBrowser.mockReturnValue(true);
    mockGetLocalStorage.mockReturnValue(null);
    mockSetLocalStorage.mockImplementation(() => {});
    mockRemoveLocalStorage.mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("End-to-End Flow", () => {
    it("should complete full flow: server endpoint -> client initialization", async () => {
      // Setup: Server endpoint returns config
      mockGetEnvironmentToken.mockResolvedValue("test-token-123");

      const handler = createClientTokenEndpoint(mockMisoClient);
      await handler(mockRequest as Request, mockResponse as Response);

      // Verify server response includes config
      expect(jsonSpy).toHaveBeenCalledWith({
        token: "test-token-123",
        expiresIn: 1800,
        config: {
          baseUrl: "https://example.com",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      });

      // Setup: Client fetches config
      const serverResponse = {
        token: "test-token-123",
        expiresIn: 1800,
        config: {
          baseUrl: "https://example.com",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => serverResponse,
      });

      const { DataClient } = require("../../src/utils/data-client");
      const mockDataClientInstance = {};
      DataClient.mockImplementation(() => mockDataClientInstance);

      // Client initialization
      const dataClient = await autoInitializeDataClient();

      // Verify client fetched config and initialized
      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/api/v1/auth/client-token",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        }),
      );
      expect(DataClient).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        misoConfig: {
          clientId: "ctrl-dev-test-app",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientTokenUri: "/api/v1/auth/client-token",
        },
      });
      expect(dataClient).toBe(mockDataClientInstance);
    });

    it("should handle cached config flow", async () => {
      // Setup: Config is cached
      const cachedConfig = {
        config: {
          baseUrl: "https://example.com",
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/api/v1/auth/client-token",
        },
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };

      mockGetLocalStorage.mockImplementation((key: string) => {
        if (key === "miso:dataclient-config") {
          return JSON.stringify(cachedConfig);
        }
        return null;
      });

      const { DataClient } = require("../../src/utils/data-client");
      const mockDataClientInstance = {};
      DataClient.mockImplementation(() => mockDataClientInstance);

      // Client initialization should use cache
      const dataClient = await autoInitializeDataClient();

      // Verify no fetch was made (used cache)
      expect(mockFetch).not.toHaveBeenCalled();
      expect(DataClient).toHaveBeenCalledWith({
        baseUrl: "https://example.com",
        misoConfig: {
          clientId: "ctrl-dev-test-app",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: undefined,
          clientTokenUri: "/api/v1/auth/client-token",
        },
      });
      expect(dataClient).toBe(mockDataClientInstance);
    });

    it("should handle custom options in both server and client", async () => {
      // Server with custom options
      mockGetEnvironmentToken.mockResolvedValue("custom-token");

      const handler = createClientTokenEndpoint(mockMisoClient, {
        clientTokenUri: "/custom/token",
        expiresIn: 3600,
      });

      await handler(mockRequest as Request, mockResponse as Response);

      expect(jsonSpy).toHaveBeenCalledWith({
        token: "custom-token",
        expiresIn: 3600,
        config: {
          baseUrl: "https://example.com",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/custom/token",
        },
      });

      // Client with custom options
      const serverResponse = {
        token: "custom-token",
        expiresIn: 3600,
        config: {
          baseUrl: "https://custom-api.com",
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientTokenUri: "/custom/token",
        },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => serverResponse,
      });

      const { DataClient } = require("../../src/utils/data-client");
      const mockDataClientInstance = {};
      DataClient.mockImplementation(() => mockDataClientInstance);

      const dataClient = await autoInitializeDataClient({
        clientTokenUri: "/custom/token",
        baseUrl: "https://custom-api.com",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom-api.com/custom/token",
        expect.any(Object),
      );
      expect(DataClient).toHaveBeenCalledWith({
        baseUrl: "https://custom-api.com",
        misoConfig: {
          clientId: "ctrl-dev-test-app",
          controllerUrl: "https://controller.aifabrix.ai",
          controllerPublicUrl: undefined,
          clientTokenUri: "/custom/token",
        },
      });
      expect(dataClient).toBe(mockDataClientInstance);
    });

    it("should handle error scenarios gracefully", async () => {
      // Server error: origin validation fails
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

      // Client error: server returns error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Origin validation failed",
      });

      await expect(autoInitializeDataClient()).rejects.toThrow(
        "Failed to fetch config: 403 Forbidden",
      );
    });
  });
});

