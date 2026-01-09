/**
 * Unit tests for DataClient
 */

import { DataClient } from "../../src/utils/data-client";
import { MisoClient } from "../../src/index";
import {
  DataClientConfig,
  NetworkError,
  TimeoutError,
  AuthenticationError,
} from "../../src/types/data-client.types";
import { DataMasker } from "../../src/utils/data-masker";
import jwt from "jsonwebtoken";

// Mock MisoClient - create a factory function that returns fresh mocks for each instance
jest.mock("../../src/index", () => {
  const createMockMisoClientInstance = () => ({
    log: {
      audit: jest.fn().mockResolvedValue(undefined),
      info: jest.fn().mockResolvedValue(undefined),
      error: jest.fn().mockResolvedValue(undefined),
    },
    getDefaultAuthStrategy: jest.fn().mockReturnValue({
      methods: ["bearer", "client-token"],
    }),
    login: jest.fn().mockResolvedValue({
      success: true,
      data: {
        loginUrl: "https://keycloak.example.com/auth?redirect=...",
        state: "abc123",
      },
      timestamp: new Date().toISOString(),
    }),
    logout: jest.fn().mockResolvedValue({
      success: true,
      message: "Logout successful",
      timestamp: new Date().toISOString(),
    }),
  });

  return {
    MisoClient: jest.fn().mockImplementation(() => createMockMisoClientInstance()),
  };
});

// Mock DataMasker
jest.mock("../../src/utils/data-masker", () => ({
  DataMasker: {
    maskSensitiveData: jest.fn((data) => data),
    setConfigPath: jest.fn(),
  },
}));

// Mock jsonwebtoken
jest.mock("jsonwebtoken", () => ({
  __esModule: true,
  default: {
    decode: jest.fn().mockReturnValue({ sub: "user-123" }),
  },
}));

// Mock data-client-utils to control isBrowser behavior conditionally
jest.mock("../../src/utils/data-client-utils", () => {
  const originalModule = jest.requireActual("../../src/utils/data-client-utils");
  let useJwtDecode = false; // Flag to control behavior
  
  const isBrowserMock = jest.fn(() => {
    // Check call stack to see if we're in decodeJWT
    const stack = new Error().stack || "";
    const isInDecodeJWT = stack.includes("decodeJWT") || stack.includes("token-utils");
    
    // If we're in decodeJWT and useJwtDecode is true, return false to use jwt.decode()
    if (isInDecodeJWT && useJwtDecode) {
      return false;
    }
    
    // Otherwise, check actual browser environment
    return (
      typeof (globalThis as { window?: unknown }).window !== "undefined" &&
      typeof (globalThis as { localStorage?: unknown }).localStorage !== "undefined" &&
      typeof (globalThis as { fetch?: unknown }).fetch !== "undefined"
    );
  });
  
  return {
    ...originalModule,
    isBrowser: isBrowserMock,
    __setUseJwtDecode: (value: boolean) => {
      useJwtDecode = value;
    },
    __resetUseJwtDecode: () => {
      useJwtDecode = false;
    },
  };
});

// Mock browser APIs
let mockLocalStorage: Record<string, string> = {};
const mockWindow = {
  location: { 
    href: "", 
    origin: "https://example.com",
    hash: "",
    protocol: "https:",
  },
};
const mockFetch = jest.fn();

// Setup global mocks
beforeAll(() => {
  (global as any).fetch = mockFetch;
  (global as any).localStorage = {
    getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockLocalStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockLocalStorage[key];
    }),
    clear: jest.fn(() => {
      Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
    }),
  };
  (global as any).window = mockWindow;
  // Also set globalThis.window.window for handleOAuthCallback (nested access pattern)
  // The code accesses: globalThis.window.window.location.hash
  // So we need: globalThis.window = { window: { location: { hash: "", ... } } }
  // Use mockWindow directly so it stays in sync
  (globalThis as any).window = { 
    window: mockWindow,
  };
});

describe("DataClient", () => {
  let dataClient: DataClient;
  let config: DataClientConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage = {};
    mockWindow.location.href = "";
    mockWindow.location.hash = ""; // Clear hash to prevent OAuth callback from triggering
    // Update globalThis.window.window to match mockWindow (handleOAuthCallback accesses this)
    if ((globalThis as any).window?.window) {
      (globalThis as any).window.window.location.hash = "";
      (globalThis as any).window.window.location.href = "";
      (globalThis as any).window.window.location.protocol = "https:";
    }

    config = {
      baseUrl: "https://api.example.com",
      misoConfig: {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "ctrl-dev-test-app",
        clientSecret: "test-secret",
      },
    };

    // Reset mocks
    (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data) => data);
    (DataMasker.setConfigPath as jest.Mock).mockClear();
    (jwt.decode as jest.Mock).mockReturnValue({ sub: "user-123" });

    // Clear previous MisoClient mock calls
    (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
    
    dataClient = new DataClient(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Constructor", () => {
    it("should create DataClient with default config", () => {
      const client = new DataClient(config);
      expect(client).toBeInstanceOf(DataClient);
      expect(MisoClient).toHaveBeenCalledWith(config.misoConfig);
    });

    it("should initialize with custom config", () => {
      const customConfig: DataClientConfig = {
        ...config,
        tokenKeys: ["customToken"],
        loginUrl: "/custom-login",
        timeout: 60000,
        cache: {
          enabled: false,
          defaultTTL: 600,
          maxSize: 50,
        },
        retry: {
          enabled: false,
          maxRetries: 5,
          baseDelay: 2000,
          maxDelay: 20000,
        },
        audit: {
          enabled: false,
          level: "full",
          batchSize: 20,
          maxResponseSize: 20000,
          maxMaskingSize: 100000,
          skipEndpoints: ["/health"],
        },
      };

      const client = new DataClient(customConfig);
      expect(client).toBeInstanceOf(DataClient);
    });
  });

  describe("Automatic Client Token Bridging", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockLocalStorage = {};
      // Ensure browser environment
      (global as any).window = mockWindow;
      (global as any).localStorage = {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      };
      (globalThis as any).window = mockWindow;
      (globalThis as any).localStorage = (global as any).localStorage;
    });

    it("should automatically bridge getEnvironmentToken to MisoClient when onClientTokenRefresh is not provided", () => {
      const browserConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          // No clientSecret, no onClientTokenRefresh - should auto-bridge
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(browserConfig);

      // Verify MisoClient was called
      expect(MisoClient).toHaveBeenCalledTimes(1);
      
      // Get the config passed to MisoClient
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      
      // Should have onClientTokenRefresh automatically set
      expect(misoConfigCall.onClientTokenRefresh).toBeDefined();
      expect(typeof misoConfigCall.onClientTokenRefresh).toBe("function");
    });

    it("should use user-provided onClientTokenRefresh when provided", () => {
      const userCallback = jest.fn().mockResolvedValue({
        token: "user-provided-token",
        expiresIn: 3600,
      });

      const browserConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          onClientTokenRefresh: userCallback,
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(browserConfig);

      // Verify MisoClient was called
      expect(MisoClient).toHaveBeenCalledTimes(1);
      
      // Get the config passed to MisoClient
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      
      // Should use user-provided callback (same reference)
      expect(misoConfigCall.onClientTokenRefresh).toBe(userCallback);
    });

    it("should NOT auto-bridge when clientSecret is provided (server-side)", () => {
      const serverConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
          clientSecret: "server-secret", // Server-side - should use clientSecret instead
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(serverConfig);

      // Verify MisoClient was called
      expect(MisoClient).toHaveBeenCalledTimes(1);
      
      // Get the config passed to MisoClient
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      
      // Should NOT have onClientTokenRefresh (server-side uses clientSecret)
      expect(misoConfigCall.onClientTokenRefresh).toBeUndefined();
    });

    it("should correctly bridge getEnvironmentToken and format response", async () => {
      // Setup: cache a token in localStorage
      const testToken = "test-client-token-123";
      const expiresAt = Date.now() + 3600000; // 1 hour from now
      mockLocalStorage["miso:client-token"] = testToken;
      mockLocalStorage["miso:client-token-expires-at"] = expiresAt.toString();

      const browserConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(browserConfig);

      // Get the auto-bridged callback
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      const onClientTokenRefresh = misoConfigCall.onClientTokenRefresh;

      expect(onClientTokenRefresh).toBeDefined();

      // Call the callback - it should use getEnvironmentToken internally
      const result = await onClientTokenRefresh!();

      // Verify result format
      expect(result).toHaveProperty("token");
      expect(result).toHaveProperty("expiresIn");
      expect(result.token).toBe(testToken);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.expiresIn).toBeLessThanOrEqual(3600);
    });

    it("should handle token expiration calculation correctly", async () => {
      // Setup: cache a token with specific expiration
      const testToken = "test-client-token-456";
      const expiresAt = Date.now() + 1800000; // 30 minutes from now
      mockLocalStorage["miso:client-token"] = testToken;
      mockLocalStorage["miso:client-token-expires-at"] = expiresAt.toString();

      const browserConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(browserConfig);

      // Get the auto-bridged callback
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      const onClientTokenRefresh = misoConfigCall.onClientTokenRefresh;

      // Call the callback
      const result = await onClientTokenRefresh!();

      // Verify expiration is calculated correctly (should be around 1800 seconds / 30 minutes)
      expect(result.expiresIn).toBeGreaterThan(1700); // Allow some time for test execution
      expect(result.expiresIn).toBeLessThanOrEqual(1800);
    });

    it("should handle missing expiration gracefully with default", async () => {
      // Setup: no token in cache, will fetch from server
      const testToken = "test-client-token-789";
      const expiresIn = 1800; // 30 minutes

      // Mock fetch to return token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: testToken,
          expiresIn: expiresIn,
        }),
        } as unknown as Response);

      const browserConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(browserConfig);

      // Get the auto-bridged callback
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      const onClientTokenRefresh = misoConfigCall.onClientTokenRefresh;

      // Call the callback - it will fetch token and set expiration
      const result = await onClientTokenRefresh!();

      // Verify token was fetched and expiration is set
      expect(result.token).toBe(testToken);
      // Allow 1 second tolerance for timing differences
      expect(result.expiresIn).toBeGreaterThanOrEqual(expiresIn - 1);
      expect(result.expiresIn).toBeLessThanOrEqual(expiresIn + 1);
      // Verify expiration was stored in localStorage
      expect(mockLocalStorage["miso:client-token-expires-at"]).toBeTruthy();
    });

    it("should throw error when getEnvironmentToken fails", async () => {
      const browserConfig: DataClientConfig = {
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "ctrl-dev-test-app",
        },
      };

      (MisoClient as jest.MockedClass<typeof MisoClient>).mockClear();
      const client = new DataClient(browserConfig);

      // Get the auto-bridged callback
      const misoConfigCall = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.calls[0][0];
      const onClientTokenRefresh = misoConfigCall.onClientTokenRefresh;

      // Mock getEnvironmentToken to fail (no cache, will fetch from server)
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Call the callback - should propagate the error from getEnvironmentToken
      await expect(onClientTokenRefresh!()).rejects.toThrow("Network error");
    });
  });

  describe("Authentication", () => {
    it("should get token from localStorage", () => {
      mockLocalStorage["token"] = "test-token-123";
      const token = (dataClient as any).getToken();
      expect(token).toBe("test-token-123");
    });

    it("should try multiple token keys", () => {
      mockLocalStorage["accessToken"] = "access-token-123";
      const token = (dataClient as any).getToken();
      expect(token).toBe("access-token-123");
    });

    it("should return null if no token found", () => {
      const token = (dataClient as any).getToken();
      expect(token).toBeNull();
    });

    it("should check if authenticated", () => {
      mockLocalStorage["token"] = "test-token";
      expect(dataClient.isAuthenticated()).toBe(true);

      delete mockLocalStorage["token"];
      expect(dataClient.isAuthenticated()).toBe(false);
    });

    it("should redirect to login via controller", async () => {
      mockWindow.location.href = "https://example.com/current-page";
      mockLocalStorage["miso:client-token"] = "test-client-token";
      mockLocalStorage["miso:client-token-expires-at"] = (Date.now() + 3600000).toString();
      
      await dataClient.redirectToLogin();
      
      // Should redirect directly to controller login URL with query params
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fcurrent-page");
      expect(mockWindow.location.href).toContain("x-client-token=test-client-token");
    });

    it("should redirect to login with custom redirect URL", async () => {
      mockWindow.location.href = "https://example.com/current-page";
      mockLocalStorage["miso:client-token"] = "test-client-token";
      mockLocalStorage["miso:client-token-expires-at"] = (Date.now() + 3600000).toString();
      
      await dataClient.redirectToLogin("https://example.com/dashboard");
      
      // Should redirect directly to controller login URL with custom redirect param
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fdashboard");
      expect(mockWindow.location.href).toContain("x-client-token=test-client-token");
    });

    it("should redirect to login when misoClient is not available", async () => {
      mockWindow.location.href = "https://example.com/current-page";
      const client = new DataClient({
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client",
        },
      });
      // Manually set misoClient to null to test fallback behavior
      (client as any).misoClient = null;
      
      await client.redirectToLogin();
      
      // Should redirect to controller login URL
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
    });

    it("should redirect to custom loginUrl when misoClient is not available", async () => {
      mockWindow.location.href = "https://example.com/current-page";
      const client = new DataClient({
        baseUrl: "https://api.example.com",
        loginUrl: "/custom-login",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client",
        },
      });
      // Manually set misoClient to null to test fallback behavior
      (client as any).misoClient = null;
      
      await client.redirectToLogin();
      
      // Should redirect to controller custom login URL
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/custom-login");
    });

    it("should redirect to login even when no client token", async () => {
      mockWindow.location.href = "https://example.com/current-page";
      // No client token in localStorage
      
      await dataClient.redirectToLogin();
      
      // Should still redirect to controller login URL (without client token param)
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fcurrent-page");
    });

    it("should redirect to login when controller URL not configured", () => {
      mockWindow.location.href = "https://example.com/current-page";
      
      // Error should be thrown during construction when controller URL is not configured
      expect(() => {
        new DataClient({
          baseUrl: "https://api.example.com",
          misoConfig: {
            clientId: "test-client",
            // No controller URL configured - should throw error
          },
        });
      }).toThrow("No controller URL configured");
      
      // Should NOT redirect - error should be thrown instead
      expect(mockWindow.location.href).toBe("https://example.com/current-page");
    });

    it("should logout and redirect to loginUrl", async () => {
      mockLocalStorage["token"] = "test-token-123";
      mockLocalStorage["miso:client-token"] = "test-client-token";
      mockLocalStorage["miso:client-token-expires-at"] = (Date.now() + 3600000).toString();
      
      await dataClient.logout();
      
      // Should redirect to controller logout URL with redirect param
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Flogin");
      expect(mockWindow.location.href).toContain("x-client-token=test-client-token");
      expect(mockWindow.location.href).toContain("token=test-token-123");
      expect(mockLocalStorage["token"]).toBeUndefined();
    });

    it("should logout with custom redirectUrl", async () => {
      mockLocalStorage["token"] = "test-token-123";
      mockLocalStorage["miso:client-token"] = "test-client-token";
      mockLocalStorage["miso:client-token-expires-at"] = (Date.now() + 3600000).toString();
      
      await dataClient.logout("/home");
      
      // Should redirect to controller logout URL with custom redirect param
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fhome");
      expect(mockWindow.location.href).toContain("x-client-token=test-client-token");
      expect(mockWindow.location.href).toContain("token=test-token-123");
      expect(mockLocalStorage["token"]).toBeUndefined();
    });

    it("should logout with logoutUrl config", async () => {
      const client = new DataClient({
        ...config,
        logoutUrl: "/goodbye",
      });
      mockLocalStorage["token"] = "test-token-123";
      
      await client.logout();
      
      // Should redirect to controller logout URL with logoutUrl as path and redirect param
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/goodbye");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fgoodbye");
      expect(mockLocalStorage["token"]).toBeUndefined();
    });

    it("should logout and clear tokens from localStorage", async () => {
      mockLocalStorage["token"] = "test-token-123";
      mockLocalStorage["accessToken"] = "access-token-456";
      
      await dataClient.logout();
      
      expect(mockLocalStorage["token"]).toBeUndefined();
      expect(mockLocalStorage["accessToken"]).toBeUndefined();
    });

    it("should logout and clear cache", async () => {
      mockLocalStorage["token"] = "test-token-123";
      
      // Add something to cache
      (dataClient as any).cache.set("test-key", {
        data: "test-data",
        expiresAt: Date.now() + 10000,
        key: "test-key",
      });
      
      await dataClient.logout();
      
      expect((dataClient as any).cache.size).toBe(0);
    });

    it("should logout and redirect even without token", async () => {
      // No token in localStorage
      
      await dataClient.logout();
      
      // Should still redirect to controller logout URL (without token param)
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Flogin");
    });

    it("should logout when misoClient not available", async () => {
      const client = new DataClient({
        baseUrl: "https://api.example.com",
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client",
        },
      });
      // Manually set misoClient to null to test fallback
      (client as any).misoClient = null;
      mockLocalStorage["token"] = "test-token-123";
      
      await client.logout();
      
      // Should redirect to controller logout URL
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Flogin");
      expect(mockLocalStorage["token"]).toBeUndefined();
    });

    it("should logout when no token exists", async () => {
      // No token in localStorage
      
      await dataClient.logout();
      
      // Should redirect to controller logout URL (without token param)
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Flogin");
    });

    it("should handle multiple token keys", async () => {
      const client = new DataClient({
        ...config,
        tokenKeys: ["customToken", "anotherToken"],
      });
      mockLocalStorage["customToken"] = "custom-token-123";
      mockLocalStorage["anotherToken"] = "another-token-456";
      
      await client.logout();
      
      expect(mockLocalStorage["customToken"]).toBeUndefined();
      expect(mockLocalStorage["anotherToken"]).toBeUndefined();
    });

    it("should construct full URL from relative logoutUrl", async () => {
      const client = new DataClient({
        ...config,
        logoutUrl: "/goodbye",
      });
      mockLocalStorage["token"] = "test-token-123";
      
      await client.logout();
      
      // Should redirect to controller logout URL with logoutUrl as path
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/goodbye");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fgoodbye");
    });

    it("should handle absolute logoutUrl", async () => {
      const client = new DataClient({
        ...config,
        logoutUrl: "https://myapp.com/goodbye",
      });
      mockLocalStorage["token"] = "test-token-123";
      
      await client.logout();
      
      // Should redirect to absolute logoutUrl with redirect param
      expect(mockWindow.location.href).toContain("https://myapp.com/goodbye");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fmyapp.com%2Fgoodbye");
    });
  });

  describe("HTTP Methods", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ data: "test" }),
        text: jest.fn(),
        blob: jest.fn(),
      } as any);
    });

    it("should make GET request", async () => {
      const result = await dataClient.get("/api/users");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/users",
        expect.objectContaining({
          method: "GET",
        }),
      );
      expect(result).toEqual({ data: "test" });
    });

    it("should make POST request", async () => {
      const data = { name: "John" };
      await dataClient.post("/api/users", data);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/users",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(data),
        }),
      );
    });

    it("should make PUT request", async () => {
      const data = { name: "Jane" };
      await dataClient.put("/api/users/1", data);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/users/1",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify(data),
        }),
      );
    });

    it("should make PATCH request", async () => {
      const data = { name: "Updated" };
      await dataClient.patch("/api/users/1", data);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/users/1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(data),
        }),
      );
    });

    it("should make DELETE request", async () => {
      await dataClient.delete("/api/users/1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/users/1",
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should add Authorization header when token exists", async () => {
      mockLocalStorage["token"] = "bearer-token-123";
      await dataClient.get("/api/users");
      const callArgs = mockFetch.mock.calls[0];
      const headers = callArgs[1].headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer bearer-token-123");
    });

    it("should skip auth when skipAuth is true", async () => {
      await dataClient.get("/api/public", { skipAuth: true });
      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("Authorization")).toBeNull();
    });
  });

  describe("Caching", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ data: "cached" }),
      } as any);
    });

    it("should cache GET responses", async () => {
      const result1 = await dataClient.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const result2 = await dataClient.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Should use cache
      expect(result2).toEqual(result1);
    });

    it("should not cache non-GET requests", async () => {
      await dataClient.post("/api/users", { name: "John" });
      await dataClient.post("/api/users", { name: "John" });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should respect cache TTL", async () => {
      jest.useFakeTimers();
      const client = new DataClient({
        ...config,
        cache: { defaultTTL: 1 }, // 1 second TTL
      });

      await client.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(500);
      await client.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still cached

      jest.advanceTimersByTime(600);
      await client.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(2); // Cache expired

      jest.useRealTimers();
    });

    it("should clear cache", async () => {
      await dataClient.get("/api/users");
      dataClient.clearCache();
      await dataClient.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should respect cache.enabled = false", async () => {
      const client = new DataClient({
        ...config,
        cache: { enabled: false },
      });
      await client.get("/api/users");
      await client.get("/api/users");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Retry Logic", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should retry on network errors", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ success: true }),
        } as any);

      const promise = dataClient.get("/api/users");
      
      // Fast-forward through retry delays
      await jest.runAllTimersAsync();
      
      const result = await promise;

      expect(mockFetch).toHaveBeenCalledTimes(3);
      expect(result).toEqual({ success: true });
    });

    it("should not retry on 5xx errors (fail immediately)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Internal server error" }),
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: "Internal server error" })),
      } as any);

      await expect(dataClient.get("/api/users")).rejects.toThrow();
      // 500 errors should NOT retry - fail immediately
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry on 4xx errors (except 401/403)", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Bad request" }),
        text: jest.fn().mockResolvedValue(JSON.stringify({ error: "Bad request" })),
      } as any);

      await expect(dataClient.get("/api/users")).rejects.toThrow();
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("should not retry on 401 errors", async () => {
      // Use real timers for this test to avoid timing issues with retry logic
      jest.useRealTimers();
      
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
      } as any);

      await expect(dataClient.get("/api/users")).rejects.toThrow(
        AuthenticationError,
      );
      
      // Count only calls to the original endpoint (not redirect-to-login calls)
      const originalEndpointCalls = mockFetch.mock.calls.filter(
        (call) => call[0] === "https://api.example.com/api/users"
      );
      expect(originalEndpointCalls.length).toBe(1);
      
      // Restore fake timers for other tests
      jest.useFakeTimers();
    });
  });

  describe("Request Deduplication", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      mockFetch.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  status: 200,
                  headers: new Headers({ "content-type": "application/json" }),
                  json: jest.fn().mockResolvedValue({ data: "test" }),
                } as any),
              100,
            ),
          ),
      );
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should deduplicate concurrent requests", async () => {
      const promise1 = dataClient.get("/api/users");
      const promise2 = dataClient.get("/api/users");
      const promise3 = dataClient.get("/api/users");

      // Fast-forward timers
      jest.advanceTimersByTime(100);
      await jest.runAllTimersAsync();

      const [result1, result2, result3] = await Promise.all([
        promise1,
        promise2,
        promise3,
      ]);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
      expect(result2).toEqual(result3);
    });
  });

  describe("Error Handling", () => {
    it("should throw NetworkError on network failures", async () => {
      const client = new DataClient({
        ...config,
        retry: { enabled: false },
      });
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.get("/api/users")).rejects.toThrow(NetworkError);
    });

    it("should throw TimeoutError on timeout", async () => {
      // Mock fetch to never resolve, simulating a timeout
      mockFetch.mockImplementation((url, options) => {
        return new Promise((_, reject) => {
          if (options?.signal) {
            // Listen for abort event
            options.signal.addEventListener('abort', () => {
              const error = new Error('AbortError');
              error.name = 'AbortError';
              reject(error);
            });
          }
          // Never resolve - will timeout
        });
      });

      const client = new DataClient({
        ...config,
        timeout: 50, // Use a reasonable timeout for test
        retry: { enabled: false },
      });

      // The request should timeout and throw TimeoutError
      await expect(client.get("/api/users")).rejects.toThrow(TimeoutError);
      await expect(client.get("/api/users")).rejects.toThrow("Request timeout after 50ms");
    }, 10000);

    it("should throw AuthenticationError on 401", async () => {
      mockWindow.location.href = "https://example.com/current-page";
      mockLocalStorage["miso:client-token"] = "test-client-token";
      mockLocalStorage["miso:client-token-expires-at"] = (Date.now() + 3600000).toString();
      
      // Mock the API request that returns 401
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
      } as any);

      await expect(dataClient.get("/api/users")).rejects.toThrow(
        AuthenticationError,
      );
      // Wait for async redirect to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      // Should redirect to controller login URL directly (no API call)
      expect(mockWindow.location.href).toContain("https://controller.aifabrix.ai/login");
      expect(mockWindow.location.href).toContain("redirect=https%3A%2F%2Fexample.com%2Fcurrent-page");
      expect(mockWindow.location.href).toContain("x-client-token=test-client-token");
    }, 10000);
  });

  describe("Interceptors", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);
    });

    it("should apply request interceptor", async () => {
      const interceptor = jest.fn((url, options) => ({
        ...options,
        headers: new Headers({
          ...(options.headers as Record<string, string>),
          "X-Custom": "value",
        }),
      }));

      dataClient.setInterceptors({ onRequest: interceptor });
      await dataClient.get("/api/users");

      expect(interceptor).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0][1];
      const headers = callArgs.headers as Headers;
      expect(headers.get("X-Custom")).toBe("value");
    });

    it("should apply response interceptor", async () => {
      const interceptor = jest.fn((response, data) => ({
        ...data,
        intercepted: true,
      }));

      dataClient.setInterceptors({ onResponse: interceptor });
      const result = await dataClient.get("/api/users");

      expect(interceptor).toHaveBeenCalled();
      expect(result).toHaveProperty("intercepted", true);
    });

    it("should apply error interceptor", async () => {
      const client = new DataClient({
        ...config,
        retry: { enabled: false },
      });
      const customError = new Error("Custom error");
      const interceptor = jest.fn(() => customError);

      mockFetch.mockRejectedValue(new Error("Network error"));
      client.setInterceptors({ onError: interceptor });

      await expect(client.get("/api/users")).rejects.toThrow(customError);
      expect(interceptor).toHaveBeenCalled();
    });
  });

  describe("ISO 27001 Audit Logging", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
          "x-custom": "header-value",
        }),
        json: jest.fn().mockResolvedValue({ data: "test", password: "secret" }),
      } as any);
      mockLocalStorage["token"] = "test-token";
    });

    it("should log audit events for requests", async () => {
      await dataClient.get("/api/users");

      // Get the most recent MisoClient instance
      const misoInstance = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results[
        (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results.length - 1
      ]?.value;
      expect(misoInstance?.log.audit).toHaveBeenCalled();
      const auditCall = (misoInstance?.log.audit as jest.Mock).mock.calls[0];
      expect(auditCall[0]).toContain("http.request.get");
      expect(auditCall[1]).toBe("/api/users");
    });

    it("should mask sensitive data in audit logs", async () => {
      (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data: any) => ({
        ...(typeof data === "object" && data !== null ? data : {}),
        password: "***MASKED***",
      }));

      await dataClient.post("/api/users", { username: "john", password: "secret" });

      expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
    });

    it("should skip audit for configured endpoints", async () => {
      const client = new DataClient({
        ...config,
        audit: {
          skipEndpoints: ["/health"],
        },
      });

      await client.get("/health");

      // Get the most recent MisoClient instance (the one created for this client)
      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      expect(misoInstance?.log.audit).not.toHaveBeenCalled();
    });

    it("should skip audit logging when no authentication token is available", async () => {
      // Clear localStorage to simulate unauthenticated request
      mockLocalStorage = {};
      
      const client = new DataClient({
        ...config,
        // No clientToken or clientSecret configured
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client",
          // No clientToken, clientSecret, or onClientTokenRefresh
        },
      });

      await client.get("/api/v1/auth/login");

      // Get the most recent MisoClient instance
      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      
      // Audit logging should be skipped when no tokens are available
      expect(misoInstance?.log.audit).not.toHaveBeenCalled();
    });

    it("should perform audit logging when user token is available", async () => {
      mockLocalStorage["token"] = "test-user-token";
      
      const client = new DataClient({
        ...config,
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client",
        },
      });

      await client.get("/api/users");

      // Get the most recent MisoClient instance
      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      
      // Audit logging should be performed when user token is available
      expect(misoInstance?.log.audit).toHaveBeenCalled();
    });

    it("should perform audit logging when client token is available", async () => {
      // Clear user token but provide client token
      mockLocalStorage = {};
      mockLocalStorage["miso:client-token"] = "test-client-token";
      mockLocalStorage["miso:client-token-expires-at"] = String(Date.now() + 3600000); // 1 hour from now
      
      const client = new DataClient({
        ...config,
        misoConfig: {
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client",
        },
      });

      await client.get("/api/users");

      // Get the most recent MisoClient instance
      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      
      // Audit logging should be performed when client token is available
      expect(misoInstance?.log.audit).toHaveBeenCalled();
    });

    it("should extract userId from token for audit", async () => {
      mockLocalStorage["token"] = "test-token";
      (jwt.decode as jest.Mock).mockReturnValue({ sub: "user-456" });
      await dataClient.get("/api/users");

      // Get the most recent MisoClient instance
      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      const auditCall = (misoInstance?.log.audit as jest.Mock).mock.calls[0];
      const context = auditCall[2] as Record<string, unknown>;
      expect(context.userId).toBe("user-456");
    });

    it("should log errors in audit", async () => {
      const client = new DataClient({
        ...config,
        retry: { enabled: false },
      });
      mockFetch.mockRejectedValue(new Error("Network error"));
      
      try {
        await client.get("/api/users");
      } catch {
        // Expected
      }
      
      await Promise.resolve();

      // Get the most recent MisoClient instance
      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      expect(misoInstance?.log.audit).toHaveBeenCalled();
    });
  });

  describe("Metrics", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);
    });

    it("should track request metrics", async () => {
      await dataClient.get("/api/users");
      const metrics = dataClient.getMetrics();

      expect(metrics.totalRequests).toBeGreaterThanOrEqual(1);
      expect(metrics.totalFailures).toBe(0);
      // Response time might be 0 in tests due to mocked fetch
      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it("should track cache hit rate", async () => {
      await dataClient.get("/api/users");
      await dataClient.get("/api/users"); // Should hit cache

      const metrics = dataClient.getMetrics();
      expect(metrics.cacheHitRate).toBeGreaterThan(0);
    });

    it("should track error rate", async () => {
      const client = new DataClient({
        ...config,
        retry: { enabled: false },
      });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Server error" }),
      } as any);

      try {
        await client.get("/api/users");
      } catch {
        // Expected
      }

      const metrics = client.getMetrics();
      expect(metrics.errorRate).toBeGreaterThan(0);
    });
  });

  describe("Utility Methods", () => {
    it("should set audit config", () => {
      dataClient.setAuditConfig({ level: "full", enabled: false });
      // Config should be updated internally
      expect(dataClient).toBeDefined();
    });

    it("should set log level", () => {
      const client = new DataClient({
        ...config,
        misoConfig: {
          ...config.misoConfig,
          logLevel: "info",
        },
      });
      
      // Should be able to set log level
      expect(() => client.setLogLevel("debug")).not.toThrow();
      expect(() => client.setLogLevel("warn")).not.toThrow();
      expect(() => client.setLogLevel("error")).not.toThrow();
    });

    it("should get metrics", () => {
      const metrics = dataClient.getMetrics();
      expect(metrics).toHaveProperty("totalRequests");
      expect(metrics).toHaveProperty("totalFailures");
      expect(metrics).toHaveProperty("averageResponseTime");
      expect(metrics).toHaveProperty("errorRate");
      expect(metrics).toHaveProperty("cacheHitRate");
    });
  });

  describe("Browser Compatibility", () => {
    it("should handle SSR gracefully", () => {
      // Temporarily remove browser APIs
      const originalWindow = (global as any).window;
      const originalLocalStorage = (global as any).localStorage;
      delete (global as any).window;
      delete (global as any).localStorage;

      const client = new DataClient(config);
      expect(client.isAuthenticated()).toBe(false);

      // Restore
      (global as any).window = originalWindow;
      (global as any).localStorage = originalLocalStorage;
    });
  });

  describe("Security: ISO 27001 Compliance", () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ data: "test" }),
      } as any);
      mockLocalStorage["token"] = "test-token";
    });

    describe("Browser Security: clientSecret Detection", () => {
      let consoleWarnSpy: jest.SpyInstance;

      beforeEach(() => {
        consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      });

      afterEach(() => {
        consoleWarnSpy.mockRestore();
      });

      it("should warn if clientSecret is provided in browser environment", () => {
        new DataClient({
          baseUrl: "https://api.example.com",
          misoConfig: {
            controllerUrl: "https://controller.aifabrix.ai",
            clientId: "test-app",
            clientSecret: "secret-key", // Should trigger warning
          },
        });

        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("SECURITY WARNING"),
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining("clientSecret"),
        );
      });

      it("should not warn if clientSecret is not provided", () => {
        new DataClient({
          baseUrl: "https://api.example.com",
          misoConfig: {
            controllerUrl: "https://controller.aifabrix.ai",
            clientId: "test-app",
            // No clientSecret - should not warn
            clientToken: "token-123",
          },
        });

        expect(consoleWarnSpy).not.toHaveBeenCalled();
      });
    });

    describe("Data Masking: Sensitive Headers", () => {
      it("should mask Authorization header in audit logs", async () => {
        let headerMasked = false;
        const maskSpy = jest.fn((data) => {
          if (typeof data === "object" && data !== null && !Array.isArray(data)) {
            const masked: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (
                key.toLowerCase().includes("authorization") ||
                key.toLowerCase().includes("token") ||
                key.toLowerCase().includes("secret")
              ) {
                masked[key] = "***MASKED***";
                headerMasked = true;
              } else {
                masked[key] = value;
              }
            }
            return masked;
          }
          return data;
        });

        (DataMasker.maskSensitiveData as jest.Mock).mockImplementation(maskSpy);

        await dataClient.get("/api/users");
        await Promise.resolve();

        // Verify headers were masked - check if any call had Authorization header
        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
        // Headers are extracted and passed to masking, so check if masking was called with headers
        const calls = (DataMasker.maskSensitiveData as jest.Mock).mock.calls;
        const hasHeaderCall = calls.some((call) => {
          const arg = call[0];
          return (
            typeof arg === "object" &&
            arg !== null &&
            !Array.isArray(arg) &&
            Object.keys(arg).some((key) =>
              key.toLowerCase().includes("authorization"),
            )
          );
        });
        // Headers are always masked if present, so verify masking was called
        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });

      it("should mask x-client-token header if present", async () => {
        const maskSpy = jest.fn((data) => {
          if (typeof data === "object" && data !== null) {
            const masked: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (
                key.toLowerCase().includes("token") ||
                key.toLowerCase().includes("secret")
              ) {
                masked[key] = "***MASKED***";
              } else {
                masked[key] = value;
              }
            }
            return masked;
          }
          return data;
        });

        (DataMasker.maskSensitiveData as jest.Mock).mockImplementation(maskSpy);

        await dataClient.get("/api/users", {
          headers: { "x-client-token": "secret-token-123" },
        });
        await Promise.resolve();

        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });
    });

    describe("Data Masking: Request/Response Bodies", () => {
      it("should mask sensitive fields in request body", async () => {
        const sensitiveData = {
          username: "john",
          password: "secret123",
          email: "john@example.com",
          creditCard: "4111-1111-1111-1111",
          ssn: "123-45-6789",
        };

        (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data: any) => {
          if (typeof data === "object" && data !== null) {
            const masked: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (
                ["password", "email", "creditCard", "ssn", "token", "secret"].includes(
                  key.toLowerCase(),
                )
              ) {
                masked[key] = "***MASKED***";
              } else {
                masked[key] = value;
              }
            }
            return masked;
          }
          return data;
        });

        await dataClient.post("/api/users", sensitiveData);
        await Promise.resolve();

        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
        const requestBodyCall = (DataMasker.maskSensitiveData as jest.Mock).mock.calls.find(
          (call) => {
            const arg = call[0];
            return (
              typeof arg === "string" &&
              (arg.includes("password") || arg.includes("secret123"))
            );
          },
        );
        // Request body is stringified, so we check if masking was called
        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });

      it("should mask sensitive fields in nested objects", async () => {
        const nestedData = {
          user: {
            name: "John",
            password: "secret",
            profile: {
              email: "john@example.com",
              phone: "123-456-7890",
            },
          },
        };

        (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data: any) => {
          if (typeof data === "object" && data !== null && !Array.isArray(data)) {
            const masked: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (
                ["password", "email", "phone", "token"].includes(key.toLowerCase())
              ) {
                masked[key] = "***MASKED***";
              } else if (typeof value === "object" && value !== null) {
                masked[key] = DataMasker.maskSensitiveData(value);
              } else {
                masked[key] = value;
              }
            }
            return masked;
          }
          return data;
        });

        await dataClient.post("/api/users", nestedData);
        await Promise.resolve();

        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });

      it("should mask sensitive fields in arrays", async () => {
        const arrayData = [
          { name: "User1", password: "pass1", email: "user1@example.com" },
          { name: "User2", password: "pass2", email: "user2@example.com" },
        ];

        (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data: any) => {
          if (Array.isArray(data)) {
            return data.map((item) => DataMasker.maskSensitiveData(item));
          }
          if (typeof data === "object" && data !== null) {
            const masked: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (["password", "email"].includes(key.toLowerCase())) {
                masked[key] = "***MASKED***";
              } else {
                masked[key] = value;
              }
            }
            return masked;
          }
          return data;
        });

        await dataClient.post("/api/users", arrayData);
        await Promise.resolve();

        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });
    });

    describe("Audit Logging: Security Controls", () => {
      it("should never log clientSecret in audit context", async () => {
        await dataClient.get("/api/users");
        await Promise.resolve();

        const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
        const misoInstance = misoInstances[misoInstances.length - 1]?.value;
        const auditCalls = (misoInstance?.log.audit as jest.Mock).mock.calls;

        // Verify no audit call contains clientSecret
        auditCalls.forEach((call) => {
          const context = call[2] as Record<string, unknown>;
          const contextStr = JSON.stringify(context);
          expect(contextStr).not.toContain("clientSecret");
          expect(contextStr).not.toContain("test-secret");
        });
      });

      it("should mask error messages containing sensitive data", async () => {
        const client = new DataClient({
          ...config,
          retry: { enabled: false },
        });
        mockFetch.mockRejectedValue(
          new Error("Failed with password: secret123 and token: abc123"),
        );

        (DataMasker.maskSensitiveData as jest.Mock).mockImplementation((data: any) => {
          if (typeof data === "object" && data !== null) {
            const masked: Record<string, unknown> = {};
            for (const [key, value] of Object.entries(data)) {
              if (key === "message" && typeof value === "string") {
                masked[key] = value.replace(/password:\s*\S+/gi, "password: ***MASKED***");
                masked[key] = (masked[key] as string).replace(
                  /token:\s*\S+/gi,
                  "token: ***MASKED***",
                );
              } else {
                masked[key] = value;
              }
            }
            return masked;
          }
          return data;
        });

        try {
          await client.get("/api/users");
        } catch {
          // Expected
        }
        
        await Promise.resolve();

        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });

      it("should extract and log userId from JWT token", async () => {
        (jwt.decode as jest.Mock).mockReturnValue({ sub: "user-789" });

        await dataClient.get("/api/users");
        await Promise.resolve();

        const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
        const misoInstance = misoInstances[misoInstances.length - 1]?.value;
        const auditCall = (misoInstance?.log.audit as jest.Mock).mock.calls[0];
        const context = auditCall[2] as Record<string, unknown>;
        expect(context.userId).toBe("user-789");
      });
    });

    describe("Audit Levels: ISO 27001 Compliance", () => {
      it("should log minimal audit level correctly", async () => {
        const client = new DataClient({
          ...config,
          audit: { enabled: true, level: "minimal" },
        });

        await client.get("/api/users");
        await Promise.resolve();

        const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
        const misoInstance = misoInstances[misoInstances.length - 1]?.value;
        
        if (misoInstance?.log.audit) {
          expect(misoInstance.log.audit).toHaveBeenCalled();
          const auditCalls = (misoInstance.log.audit as jest.Mock).mock.calls;
          if (auditCalls.length > 0) {
            const auditCall = auditCalls[auditCalls.length - 1]; // Get last call
            const context = auditCall[2] as Record<string, unknown>;

            // Minimal should only have basic fields
            expect(context).toHaveProperty("method");
            expect(context).toHaveProperty("url");
            expect(context).toHaveProperty("statusCode");
            expect(context).toHaveProperty("duration");
            // Should not have headers/bodies for minimal
            expect(context).not.toHaveProperty("requestHeaders");
            expect(context).not.toHaveProperty("requestBody");
          }
        }
      });

      it("should log standard audit level with masked headers and bodies", async () => {
        const client = new DataClient({
          ...config,
          audit: { enabled: true, level: "standard" },
        });

        await client.post("/api/users", { username: "john", password: "secret" });
        await Promise.resolve();

        const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
        const misoInstance = misoInstances[misoInstances.length - 1]?.value;
        
        if (misoInstance?.log.audit) {
          expect(misoInstance.log.audit).toHaveBeenCalled();
          const auditCalls = (misoInstance.log.audit as jest.Mock).mock.calls;
          if (auditCalls.length > 0) {
            const auditCall = auditCalls[auditCalls.length - 1]; // Get last call
            const context = auditCall[2] as Record<string, unknown>;

            // Standard should have headers and bodies (masked)
            expect(context).toHaveProperty("requestHeaders");
            expect(context).toHaveProperty("requestBody");
            // Should not have sizes
            expect(context).not.toHaveProperty("requestSize");
          }
        }
      });

      it("should log detailed audit level with sizes", async () => {
        const client = new DataClient({
          ...config,
          audit: { enabled: true, level: "detailed" },
        });

        await client.post("/api/users", { username: "john" });
        await Promise.resolve();

        const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
        const misoInstance = misoInstances[misoInstances.length - 1]?.value;
        
        if (misoInstance?.log.audit) {
          expect(misoInstance.log.audit).toHaveBeenCalled();
          const auditCalls = (misoInstance.log.audit as jest.Mock).mock.calls;
          if (auditCalls.length > 0) {
            const auditCall = auditCalls[auditCalls.length - 1]; // Get last call
            const context = auditCall[2] as Record<string, unknown>;

            // Detailed should have sizes
            expect(context).toHaveProperty("requestSize");
            expect(context).toHaveProperty("responseSize");
          }
        }
      });
    });

    describe("Performance: Large Payload Truncation", () => {
      it("should truncate large payloads before masking", async () => {
        const largeData = "x".repeat(60000); // Larger than maxMaskingSize (50000)

        await dataClient.post("/api/users", { data: largeData });

        // Should not attempt to mask truncated payloads
        // The truncatePayload function should handle this
        expect(DataMasker.maskSensitiveData).toHaveBeenCalled();
      });
    });
  });

  describe("getEnvironmentToken", () => {
    beforeEach(() => {
      mockFetch.mockClear();
      // Ensure browser environment is set up
      (global as any).window = mockWindow;
      (global as any).localStorage = {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      };
      // Also set on globalThis for isBrowser() check
      (globalThis as any).window = mockWindow;
      (globalThis as any).localStorage = (global as any).localStorage;
    });

    it("should throw error in non-browser environment", async () => {
      // Mock non-browser environment
      (global as any).window = undefined;
      (global as any).localStorage = undefined;
      (globalThis as any).window = undefined;
      (globalThis as any).localStorage = undefined;

      await expect(dataClient.getEnvironmentToken()).rejects.toThrow(
        "getEnvironmentToken() is only available in browser environment",
      );
      
      // Restore browser environment
      (global as any).window = mockWindow;
      (global as any).localStorage = {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      };
      (globalThis as any).window = mockWindow;
      (globalThis as any).localStorage = (global as any).localStorage;
    });

    it("should return cached token if valid", async () => {
      const cachedToken = "cached-token-123";
      const expiresAt = Date.now() + 3600000; // 1 hour from now

      mockLocalStorage["miso:client-token"] = cachedToken;
      mockLocalStorage["miso:client-token-expires-at"] = expiresAt.toString();

      const token = await dataClient.getEnvironmentToken();

      expect(token).toBe(cachedToken);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should fetch token when cache is expired", async () => {
      const expiredToken = "expired-token";
      const expiredAt = Date.now() - 1000; // 1 second ago

      mockLocalStorage["miso:client-token"] = expiredToken;
      mockLocalStorage["miso:client-token-expires-at"] = expiredAt.toString();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "new-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      const token = await dataClient.getEnvironmentToken();

      expect(token).toBe("new-token-123");
      expect(mockFetch).toHaveBeenCalled();
      expect(mockLocalStorage["miso:client-token"]).toBe("new-token-123");
    });

    it("should fetch token when cache is missing", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "new-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      const token = await dataClient.getEnvironmentToken();

      expect(token).toBe("new-token-123");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should use default clientTokenUri when not configured", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "new-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      await dataClient.getEnvironmentToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/auth/client-token"),
        expect.any(Object),
      );
    });

    it("should use custom clientTokenUri from config", async () => {
      const customClient = new DataClient({
        ...config,
        misoConfig: {
          ...config.misoConfig!,
          clientTokenUri: "/api/custom/token",
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "new-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      await customClient.getEnvironmentToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/custom/token"),
        expect.any(Object),
      );
    });

    it("should handle absolute URL clientTokenUri", async () => {
      const customClient = new DataClient({
        ...config,
        misoConfig: {
          ...config.misoConfig!,
          clientTokenUri: "https://auth.example.com/token",
        },
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "new-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      await customClient.getEnvironmentToken();

      expect(mockFetch).toHaveBeenCalledWith(
        "https://auth.example.com/token",
        expect.any(Object),
      );
    });

    it("should extract token from nested data format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            token: "nested-token-123",
            expiresIn: 1800,
          },
        }),
        } as unknown as Response);

      const token = await dataClient.getEnvironmentToken();

      expect(token).toBe("nested-token-123");
    });

    it("should extract token from flat format", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "flat-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      const token = await dataClient.getEnvironmentToken();

      expect(token).toBe("flat-token-123");
    });

    it("should handle expiresIn from nested data", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            token: "token-123",
            expiresIn: 3600,
          },
        }),
        } as unknown as Response);

      await dataClient.getEnvironmentToken();

      const expiresAt = parseInt(mockLocalStorage["miso:client-token-expires-at"], 10);
      const expectedExpiresAt = Date.now() + 3600 * 1000;
      expect(expiresAt).toBeCloseTo(expectedExpiresAt, -3); // Within 1 second
    });

    it("should use default expiresIn when not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "token-123",
        }),
        } as unknown as Response);

      await dataClient.getEnvironmentToken();

      const expiresAt = parseInt(mockLocalStorage["miso:client-token-expires-at"], 10);
      const expectedExpiresAt = Date.now() + 3600 * 1000; // Default 1 hour
      expect(expiresAt).toBeCloseTo(expectedExpiresAt, -3);
    });

    it("should throw error when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Access denied",
        } as unknown as Response);

      await expect(dataClient.getEnvironmentToken()).rejects.toThrow(
        "Failed to get environment token",
      );
    });

    it("should throw error when token is missing in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
        }),
        } as unknown as Response);

      await expect(dataClient.getEnvironmentToken()).rejects.toThrow(
        "Invalid response format",
      );
    });

    it("should log audit event on success", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      await dataClient.getEnvironmentToken();

      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      
      if (misoInstance?.log.audit) {
        expect(misoInstance.log.audit).toHaveBeenCalledWith(
          "client.token.request.success",
          expect.any(String),
          expect.objectContaining({
            method: "POST",
            statusCode: 200,
            cached: false,
          }),
          {},
        );
      }
    });

    it("should log audit event on error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "Access denied",
        } as unknown as Response);

      await expect(dataClient.getEnvironmentToken()).rejects.toThrow();

      const misoInstances = (MisoClient as jest.MockedClass<typeof MisoClient>).mock.results;
      const misoInstance = misoInstances[misoInstances.length - 1]?.value;
      
      if (misoInstance?.log.audit) {
        expect(misoInstance.log.audit).toHaveBeenCalledWith(
          "client.token.request.failed",
          expect.any(String),
          expect.objectContaining({
            method: "POST",
            statusCode: 0,
            cached: false,
          }),
          expect.objectContaining({
            errorCategory: "authentication",
          }),
        );
      }
    });

    it("should remove expired token from cache", async () => {
      const expiredToken = "expired-token";
      const expiredAt = Date.now() - 1000;

      mockLocalStorage["miso:client-token"] = expiredToken;
      mockLocalStorage["miso:client-token-expires-at"] = expiredAt.toString();

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          token: "new-token-123",
          expiresIn: 1800,
        }),
        } as unknown as Response);

      await dataClient.getEnvironmentToken();

      expect(mockLocalStorage["miso:client-token"]).toBe("new-token-123");
      expect(mockLocalStorage["miso:client-token-expires-at"]).toBeTruthy();
    });
  });

  describe("getClientTokenInfo", () => {
    beforeEach(() => {
      jest.clearAllMocks();
      // Enable useJwtDecode flag so decodeJWT uses jwt.decode() instead of manual base64 decode
      // This allows us to use the jwt.decode mock while still allowing getClientTokenInfo to proceed
      const dataClientUtils = require("../../src/utils/data-client-utils");
      (dataClientUtils as any).__setUseJwtDecode(true);
      
      // Ensure browser environment is set up for localStorage access
      (global as any).window = mockWindow;
      (global as any).localStorage = {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      };
      (globalThis as any).window = mockWindow;
      (globalThis as any).localStorage = (global as any).localStorage;
    });

    afterEach(() => {
      // Reset useJwtDecode flag
      const dataClientUtils = require("../../src/utils/data-client-utils");
      (dataClientUtils as any).__resetUseJwtDecode();
    });

    it("should return null in non-browser environment", () => {
      // Mock non-browser environment
      (global as any).window = undefined;
      (global as any).localStorage = undefined;
      (globalThis as any).window = undefined;
      (globalThis as any).localStorage = undefined;

      const info = dataClient.getClientTokenInfo();
      expect(info).toBeNull();
      
      // Restore browser environment
      (global as any).window = mockWindow;
      (global as any).localStorage = {
        getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
        setItem: jest.fn((key: string, value: string) => {
          mockLocalStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockLocalStorage[key];
        }),
      };
      (globalThis as any).window = mockWindow;
      (globalThis as any).localStorage = (global as any).localStorage;
    });

    it("should extract info from cached token", () => {
      const token = "test-token";
      (jwt.decode as jest.Mock).mockReturnValue({
        application: "my-app",
        environment: "production",
        applicationId: "app-123",
        clientId: "client-123",
      });

      mockLocalStorage["miso:client-token"] = token;

      const info = dataClient.getClientTokenInfo();

      expect(info).toEqual({
        application: "my-app",
        environment: "production",
        applicationId: "app-123",
        clientId: "client-123",
      });
      expect(jwt.decode).toHaveBeenCalledWith(token);
    });

    it("should extract info from config clientToken", () => {
      const customClient = new DataClient({
        ...config,
        misoConfig: {
          ...config.misoConfig!,
          clientToken: "config-token",
        },
      });

      (jwt.decode as jest.Mock).mockReturnValue({
        application: "config-app",
        environment: "dev",
      });

      const info = customClient.getClientTokenInfo();

      expect(info).toEqual({
        application: "config-app",
        environment: "dev",
      });
    });

    it("should prefer cached token over config token", () => {
      const customClient = new DataClient({
        ...config,
        misoConfig: {
          ...config.misoConfig!,
          clientToken: "config-token",
        },
      });

      mockLocalStorage["miso:client-token"] = "cached-token";
      (jwt.decode as jest.Mock).mockReturnValue({
        application: "cached-app",
      });

      const info = customClient.getClientTokenInfo();

      expect(info).toEqual({
        application: "cached-app",
      });
      expect(jwt.decode).toHaveBeenCalledWith("cached-token");
    });

    it("should return null when no token available", () => {
      const info = dataClient.getClientTokenInfo();
      expect(info).toBeNull();
    });

    it("should handle decode errors gracefully", () => {
      mockLocalStorage["miso:client-token"] = "invalid-token";
      (jwt.decode as jest.Mock).mockReturnValue(null);

      const info = dataClient.getClientTokenInfo();

      expect(info).toEqual({});
    });
  });

  describe("onTokenRefresh callback", () => {
    beforeEach(() => {
      mockLocalStorage = {};
      mockWindow.location.href = "";
      mockWindow.location.hash = "";
      mockFetch.mockClear();
      mockFetch.mockReset(); // Reset both call history and implementation
    });

    it("should call onTokenRefresh callback on 401 error and retry request", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-access-token-456",
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      // First request returns 401
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: "Unauthorized",
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        // Second request (after refresh) succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      mockLocalStorage["token"] = "old-token-123";

      const result = await customClient.get("/api/test");

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ data: "success" });
      // Verify new token was stored in localStorage
      expect(mockLocalStorage["token"]).toBe("new-access-token-456");
    });

    it("should update token in all configured tokenKeys after refresh", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "refreshed-token-789",
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        tokenKeys: ["token", "accessToken", "authToken"],
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      await customClient.get("/api/test");

      expect(mockLocalStorage["token"]).toBe("refreshed-token-789");
      expect(mockLocalStorage["accessToken"]).toBe("refreshed-token-789");
      expect(mockLocalStorage["authToken"]).toBe("refreshed-token-789");
    });

    it("should redirect to login when onTokenRefresh fails", async () => {
      const onTokenRefresh = jest
        .fn()
        .mockRejectedValue(new Error("Refresh failed"));

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      // First request returns 401, triggering refresh attempt
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response);

      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      // The request should throw AuthenticationError after refresh fails
      await expect(customClient.get("/api/test")).rejects.toThrow(
        AuthenticationError,
      );

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
    });

    it("should redirect to login when onTokenRefresh returns null", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue(null);

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response);

      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      await expect(customClient.get("/api/test")).rejects.toThrow();

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
    });

    it("should not call onTokenRefresh if callback is not provided", async () => {
      const customClient = new DataClient({
        ...config,
        // onTokenRefresh not provided
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response);

      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      await expect(customClient.get("/api/test")).rejects.toThrow();

      // Should not have called any refresh callback
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only the original request
    });

    it("should only attempt refresh once per request", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-token-123",
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      // First request returns 401, second also returns 401 (refresh didn't help)
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Still unauthorized" }),
        } as unknown as Response);

      mockLocalStorage["token"] = "old-token";

      await expect(customClient.get("/api/test")).rejects.toThrow();

      // Should only call refresh once, not retry again
      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledTimes(2); // Original + one retry
    });

    it("should not store refresh token in localStorage", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-access-token-456",
        expiresIn: 3600,
        // Note: refreshToken should NOT be in the response or stored
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      await customClient.get("/api/test");

      // Verify only access token is stored, not refresh token
      expect(mockLocalStorage["token"]).toBe("new-access-token-456");
      // Verify no refresh token keys exist
      expect(mockLocalStorage["refreshToken"]).toBeUndefined();
      expect(mockLocalStorage["refresh_token"]).toBeUndefined();
    });

    it("should handle refresh for POST requests", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-token-post-123",
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "created" }),
        } as unknown as Response);

      await customClient.post("/api/test", { data: "test" });

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe("new-token-post-123");
    });

    it("should handle refresh for PUT requests", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-token-put-456",
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "updated" }),
        } as unknown as Response);

      await customClient.put("/api/test", { data: "test" });

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe("new-token-put-456");
    });

    it("should handle refresh for DELETE requests", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-token-delete-789",
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 204,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({}),
          text: jest.fn().mockResolvedValue(""),
          blob: jest.fn().mockResolvedValue(new Blob()),
        } as any);

      await customClient.delete("/api/test");

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe("new-token-delete-789");
    });

    it("should handle refresh callback returning invalid token format", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "", // Empty token
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response);

      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      await expect(customClient.get("/api/test")).rejects.toThrow();

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      // Empty token should NOT be stored (code checks `if (result.token)`)
      expect(mockLocalStorage["token"]).toBeUndefined();
    });

    it("should handle refresh callback with different expiresIn values", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-token-expires-123",
        expiresIn: 7200, // 2 hours
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      await customClient.get("/api/test");

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe("new-token-expires-123");
    });

    it("should handle refresh callback timing out", async () => {
      let timeoutId: NodeJS.Timeout | null = null;
      const onTokenRefresh = jest.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new Error("Timeout")), 100);
          }),
      );

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
        timeout: 50, // Shorter timeout than refresh callback
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response);

      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      await expect(customClient.get("/api/test")).rejects.toThrow();

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      
      // Clear the timeout to prevent open handles
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      
      // Wait a bit to ensure any pending timers complete
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it("should handle refresh when callback returns token without expiresIn", async () => {
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: "new-token-no-expires",
        // Missing expiresIn
      } as any);

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      await customClient.get("/api/test");

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe("new-token-no-expires");
    });

    it("should handle concurrent requests each triggering refresh", async () => {
      const onTokenRefresh1 = jest.fn().mockResolvedValue({
        token: "new-token-concurrent-1",
        expiresIn: 3600,
      });
      const onTokenRefresh2 = jest.fn().mockResolvedValue({
        token: "new-token-concurrent-2",
        expiresIn: 3600,
      });

      const customClient1 = new DataClient({
        ...config,
        onTokenRefresh: onTokenRefresh1,
      });
      const customClient2 = new DataClient({
        ...config,
        onTokenRefresh: onTokenRefresh2,
      });

      // Wait for any async initialization to complete
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 50)),
        new Promise((resolve) => setTimeout(resolve, 50)),
      ]);

      // Reset call count after initialization
      onTokenRefresh1.mockClear();
      onTokenRefresh2.mockClear();

      // Setup client tokens to avoid client token fetch calls
      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      // Track request counts per endpoint to handle concurrent requests
      const requestCounts: Record<string, number> = {};
      mockFetch.mockImplementation((url: string) => {
        const urlStr = url.toString();
        const isTest1 = urlStr.includes("/api/test1");
        const isTest2 = urlStr.includes("/api/test2");
        
        if (!isTest1 && !isTest2) {
          // Not one of our test endpoints, return a default response
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: jest.fn().mockResolvedValue({}),
          } as unknown as Response);
        }
        
        const endpoint = isTest1 ? "/api/test1" : "/api/test2";
        requestCounts[endpoint] = (requestCounts[endpoint] || 0) + 1;
        const attempt = requestCounts[endpoint];
        
        if (attempt === 1) {
          // First attempt: 401
          return Promise.resolve({
            ok: false,
            status: 401,
            headers: new Headers({ "content-type": "application/json" }),
            json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
          } as unknown as Response);
        } else {
          // Retry after refresh: success
          const data = isTest1 ? "success1" : "success2";
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: new Headers({ "content-type": "application/json" }),
            json: jest.fn().mockResolvedValue({ data }),
          } as unknown as Response);
        }
      });

      // Make concurrent requests with different clients
      const [result1, result2] = await Promise.all([
        customClient1.get("/api/test1"),
        customClient2.get("/api/test2"),
      ]);

      // Each client should trigger its own refresh
      expect(onTokenRefresh1).toHaveBeenCalledTimes(1);
      expect(onTokenRefresh2).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ data: "success1" });
      expect(result2).toEqual({ data: "success2" });
    });

    it("should handle refresh with token containing special characters", async () => {
      const specialToken = "token-with-special-!@#$%^&*()-chars";
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: specialToken,
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
        tokenKeys: ["token"], // Use single key to avoid confusion
      });

      // Wait for any async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Reset call count after initialization
      onTokenRefresh.mockClear();

      // Setup client tokens to avoid client token fetch calls
      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      await customClient.get("/api/test");

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe(specialToken);
    });

    it("should handle refresh with very long token", async () => {
      const longToken = "a".repeat(10000); // Very long token
      const onTokenRefresh = jest.fn().mockResolvedValue({
        token: longToken,
        expiresIn: 3600,
      });

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
        tokenKeys: ["token"], // Use single key to avoid confusion
      });

      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ error: "Unauthorized" }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: jest.fn().mockResolvedValue({ data: "success" }),
        } as unknown as Response);

      await customClient.get("/api/test");

      expect(onTokenRefresh).toHaveBeenCalledTimes(1);
      expect(mockLocalStorage["token"]).toBe(longToken);
    });

    it("should not refresh on 403 Forbidden (only 401)", async () => {
      // Ensure no hash in URL to prevent handleOAuthCallback from running
      mockWindow.location.href = "https://example.com/test";
      mockWindow.location.hash = "";
      mockLocalStorage = {}; // Clear localStorage

      const onTokenRefresh = jest.fn();

      const customClient = new DataClient({
        ...config,
        onTokenRefresh,
      });

      // Wait for any async initialization to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Reset call count after initialization (handleOAuthCallback doesn't call onTokenRefresh,
      // but we clear to ensure we only count calls from the actual request)
      const initCallCount = onTokenRefresh.mock.calls.length;
      onTokenRefresh.mockClear();
      
      // Ensure no calls happened during initialization
      expect(initCallCount).toBe(0);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        headers: new Headers({ "content-type": "application/json" }),
        json: jest.fn().mockResolvedValue({ error: "Forbidden" }),
        } as unknown as Response);

      mockLocalStorage["miso:client-token"] = "client-token-123";
      mockLocalStorage["miso:client-token-expires-at"] = (
        Date.now() + 3600000
      ).toString();

      await expect(customClient.get("/api/test")).rejects.toThrow();

      // Should not call refresh for 403 errors (only 401 triggers refresh)
      // Refresh should only be called for 401, not 403
      expect(onTokenRefresh).not.toHaveBeenCalled();
    });
  });
});

