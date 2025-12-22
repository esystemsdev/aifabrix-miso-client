/**
 * Unit tests for data-client-auto-init helper
 */

import { autoInitializeDataClient } from "../../src/utils/data-client-auto-init";
import { DataClient } from "../../src/utils/data-client";

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
const MockDataClient = DataClient as jest.MockedClass<typeof DataClient>;

// Mock fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// Mock window
const mockWindow = {
  location: { origin: "https://example.com" },
};
(global as any).window = mockWindow;

describe("data-client-auto-init", () => {
  let mockDataClientInstance: jest.Mocked<DataClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsBrowser.mockReturnValue(true);
    mockGetLocalStorage.mockReturnValue(null);
    mockSetLocalStorage.mockImplementation(() => {});
    mockRemoveLocalStorage.mockImplementation(() => {});
    mockWindow.location.origin = "https://example.com";

    mockDataClientInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    MockDataClient.mockImplementation(() => mockDataClientInstance);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("autoInitializeDataClient", () => {
    it("should throw error if not in browser", async () => {
      mockIsBrowser.mockReturnValue(false);

      await expect(autoInitializeDataClient()).rejects.toThrow(
        "autoInitializeDataClient() is only available in browser environment",
      );
    });

    it("should fetch config from server and initialize DataClient", async () => {
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        controllerPublicUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      const result = await autoInitializeDataClient();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/api/v1/auth/client-token",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          signal: expect.any(AbortSignal),
        }),
      );
      expect(MockDataClient).toHaveBeenCalledWith({
        baseUrl: mockConfig.baseUrl,
        misoConfig: {
          clientId: mockConfig.clientId,
          controllerUrl: mockConfig.controllerUrl,
          controllerPublicUrl: mockConfig.controllerPublicUrl,
          clientTokenUri: mockConfig.clientTokenUri,
        },
      });
      expect(result).toBe(mockDataClientInstance);
    });

    it("should use cached config if available and not expired", async () => {
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      const cachedConfig = {
        config: mockConfig,
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };

      mockGetLocalStorage.mockImplementation((key: string) => {
        if (key === "miso:dataclient-config") {
          return JSON.stringify(cachedConfig);
        }
        return null;
      });

      const result = await autoInitializeDataClient();

      expect(mockFetch).not.toHaveBeenCalled();
      expect(MockDataClient).toHaveBeenCalledWith({
        baseUrl: mockConfig.baseUrl,
        misoConfig: {
          clientId: mockConfig.clientId,
          controllerUrl: mockConfig.controllerUrl,
          controllerPublicUrl: undefined,
          clientTokenUri: mockConfig.clientTokenUri,
        },
      });
      expect(result).toBe(mockDataClientInstance);
    });

    it("should fetch from server if cached config is expired", async () => {
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      const expiredConfig = {
        config: mockConfig,
        expiresAt: Date.now() - 1000, // Expired
      };

      mockGetLocalStorage.mockImplementation((key: string) => {
        if (key === "miso:dataclient-config") {
          return JSON.stringify(expiredConfig);
        }
        return null;
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient();

      expect(mockFetch).toHaveBeenCalled();
      expect(mockRemoveLocalStorage).toHaveBeenCalledWith("miso:dataclient-config");
    });

    it("should use custom clientTokenUri", async () => {
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/custom/token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient({
        clientTokenUri: "/custom/token",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://example.com/custom/token",
        expect.any(Object),
      );
    });

    it("should use custom baseUrl", async () => {
      const mockConfig = {
        baseUrl: "https://custom-api.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient({
        baseUrl: "https://custom-api.com",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom-api.com/api/v1/auth/client-token",
        expect.any(Object),
      );
    });

    it("should handle absolute URLs in clientTokenUri", async () => {
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "https://api.example.com/token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient({
        clientTokenUri: "https://api.example.com/token",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/token",
        expect.any(Object),
      );
    });

    it("should try GET if POST returns 405", async () => {
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 405,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            token: "test-token",
            expiresIn: 1800,
            config: mockConfig,
          }),
        });

      await autoInitializeDataClient();

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(mockFetch).toHaveBeenNthCalledWith(1, expect.any(String), expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        signal: expect.any(AbortSignal),
      }));
      expect(mockFetch).toHaveBeenNthCalledWith(2, expect.any(String), expect.objectContaining({
        method: "GET",
        credentials: "include",
        signal: expect.any(AbortSignal),
      }));
    });

    it("should throw error if response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: async () => "Server error",
      });

      await expect(autoInitializeDataClient()).rejects.toThrow(
        "Failed to fetch config: 500 Internal Server Error. Server error",
      );
    });

    it("should throw error if config is missing from response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          // No config field
        }),
      });

      await expect(autoInitializeDataClient()).rejects.toThrow(
        "Invalid response format: config not found in response",
      );
    });

    it("should throw error if baseUrl cannot be detected", async () => {
      mockWindow.location.origin = "";
      mockIsBrowser.mockReturnValue(true);

      await expect(autoInitializeDataClient()).rejects.toThrow(
        "Unable to detect baseUrl. Please provide baseUrl option.",
      );
    });

    it("should call onError callback on error", async () => {
      const onError = jest.fn();
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(
        autoInitializeDataClient({ onError }),
      ).rejects.toThrow("Network error");

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should cache config when cacheConfig is true", async () => {
      mockWindow.location.origin = "https://example.com";
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient({ cacheConfig: true });

      expect(mockSetLocalStorage).toHaveBeenCalledWith(
        "miso:dataclient-config",
        expect.stringContaining('"baseUrl":"https://example.com"'),
      );
    });

    it("should not cache config when cacheConfig is false", async () => {
      mockWindow.location.origin = "https://example.com";
      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient({ cacheConfig: false });

      expect(mockSetLocalStorage).not.toHaveBeenCalled();
    });

    it("should handle invalid cached config gracefully", async () => {
      mockWindow.location.origin = "https://example.com";
      mockGetLocalStorage.mockImplementation((key: string) => {
        if (key === "miso:dataclient-config") {
          return "invalid-json";
        }
        return null;
      });

      const mockConfig = {
        baseUrl: "https://example.com",
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientTokenUri: "/api/v1/auth/client-token",
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          token: "test-token",
          expiresIn: 1800,
          config: mockConfig,
        }),
      });

      await autoInitializeDataClient();

      expect(mockRemoveLocalStorage).toHaveBeenCalledWith("miso:dataclient-config");
      expect(mockFetch).toHaveBeenCalled();
    });
  });
});

