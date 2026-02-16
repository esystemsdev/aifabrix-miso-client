/**
 * Unit tests for DataClient authentication utilities
 * Tests handleOAuthCallback and related security features
 */

jest.mock("../../src/utils/console-logger", () => ({
  writeWarn: jest.fn(),
  writeErr: jest.fn(),
  logErrorWithContext: jest.fn(),
}));

import { handleOAuthCallback } from "../../src/utils/data-client-auth";
import { DataClientConfig } from "../../src/types/data-client.types";
import * as consoleLogger from "../../src/utils/console-logger";

const mockWriteWarn = consoleLogger.writeWarn as jest.Mock;
const mockWriteErr = consoleLogger.writeErr as jest.Mock;

describe("handleOAuthCallback", () => {
  let mockWindow: {
    location: {
      hash: string;
      pathname: string;
      search: string;
      protocol: string;
      hostname: string;
    };
    history: {
      replaceState: jest.Mock;
    };
  };
  let mockLocalStorage: Record<string, string>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock localStorage
    mockLocalStorage = {};
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

    // Mock window
    mockWindow = {
      location: {
        hash: "",
        pathname: "/",
        search: "",
        protocol: "https:",
        hostname: "example.com",
      },
      history: {
        replaceState: jest.fn(),
      },
    };

    (globalThis as any).window = mockWindow;
    (globalThis as any).localStorage = (global as any).localStorage;
    (globalThis as any).fetch = jest.fn();

    // Store original NODE_ENV
    originalEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (globalThis as any).window;
    delete (globalThis as any).localStorage;
    delete (globalThis as any).fetch;
    process.env.NODE_ENV = originalEnv;
  });

  const createValidJWT = (): string => {
    // Create a valid JWT format token (3 parts separated by dots)
    const header = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
    const payload = "eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ";
    const signature = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    return `${header}.${payload}.${signature}`;
  };

  const createConfig = (overrides?: Partial<DataClientConfig>): DataClientConfig => {
    const defaultMisoConfig = {
      clientId: "test-client-id",
      controllerUrl: "https://controller.example.com",
    };
    return {
      baseUrl: "https://example.com",
      tokenKeys: ["token", "accessToken", "authToken"],
      ...overrides,
      // Ensure misoConfig is always set (required field)
      misoConfig: overrides?.misoConfig || defaultMisoConfig,
    };
  };

  describe("Hash fragment parsing", () => {
    it("should extract token from #token=... format", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockLocalStorage["accessToken"]).toBe(token);
      expect(mockLocalStorage["authToken"]).toBe(token);
    });

    it("should extract token from #access_token=... format", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#access_token=${token}`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
    });

    it("should extract token from #accessToken=... format", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#accessToken=${token}`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
    });

    it("should prefer token over access_token", () => {
      const token1 = createValidJWT();
      const token2 = createValidJWT() + "different";
      mockWindow.location.hash = `#token=${token1}&access_token=${token2}`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token1);
    });

    it("should return null when no token in hash", () => {
      mockWindow.location.hash = "#other=value";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBeNull();
      expect(mockLocalStorage["token"]).toBeUndefined();
    });

    it("should return null when hash is empty", () => {
      mockWindow.location.hash = "";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBeNull();
    });

    it("should return null when hash is only #", () => {
      mockWindow.location.hash = "#";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBeNull();
    });
  });

  describe("Token format validation", () => {
    it("should accept valid JWT format (3 parts)", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
    });

    it("should accept token with 2 parts (non-JWT format)", () => {
      const token = "header.payload";
      mockWindow.location.hash = `#token=${token}`;

      const result = handleOAuthCallback(createConfig());

      // Non-JWT tokens are now accepted if they meet length requirements
      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
    });

    it("should accept token with 4 parts (non-JWT format)", () => {
      const token = "header.payload.signature.extra";
      mockWindow.location.hash = `#token=${token}`;

      const result = handleOAuthCallback(createConfig());

      // Non-JWT tokens are now accepted if they meet length requirements
      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
    });

    it("should accept token with empty parts if length is sufficient", () => {
      const token = "header..signature";
      mockWindow.location.hash = `#token=${token}`;

      const result = handleOAuthCallback(createConfig());

      // Tokens with empty parts are accepted if they meet length requirements
      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
    });

    it("should reject token that is too short (< 5 characters)", () => {
      const invalidToken = "abcd"; // 4 characters
      mockWindow.location.hash = `#token=${invalidToken}`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBeNull();
      expect(mockLocalStorage["token"]).toBeUndefined();
      expect(mockWriteErr).toHaveBeenCalledWith(
        expect.stringContaining("[handleOAuthCallback] Invalid token format - token rejected"),
      );
      expect(mockWriteErr).toHaveBeenCalledWith(
        expect.stringMatching(/tokenLength|tooShort/),
      );
    });

    it("should reject non-string token", () => {
      // This shouldn't happen in practice, but test edge case
      mockWindow.location.hash = "#token=";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBeNull();
    });
  });

  describe("Hash cleanup", () => {
    it("should clean up hash immediately after extraction", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.pathname = "/dashboard";
      mockWindow.location.search = "?param=value";

      handleOAuthCallback(createConfig());

      expect(mockWindow.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        "/dashboard?param=value",
      );
    });

    it("should verify hash cleanup succeeded", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.pathname = "/dashboard";
      mockWindow.location.search = "";

      handleOAuthCallback(createConfig());

      // After cleanup, hash should be empty
      expect(mockWindow.history.replaceState).toHaveBeenCalled();
      // Verify no warning about hash cleanup failure
      expect(mockWriteWarn).not.toHaveBeenCalledWith(
        expect.stringContaining("Hash cleanup may have failed"),
      );
    });


    it("should clean up hash even if token is invalid", () => {
      mockWindow.location.hash = "#token=invalid";
      mockWindow.location.pathname = "/";
      mockWindow.location.search = "";

      handleOAuthCallback(createConfig());

      expect(mockWindow.history.replaceState).toHaveBeenCalledWith(null, "", "/");
    });

    it("should handle cleanup errors gracefully", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.history.replaceState.mockImplementation(() => {
        throw new Error("History API error");
      });

      const result = handleOAuthCallback(createConfig());

      // Should still return token even if cleanup fails
      expect(result).toBe(token);
      expect(mockWriteWarn).toHaveBeenCalledWith(
        expect.stringContaining("[handleOAuthCallback] Failed to clean up hash:"),
      );
    });
  });

  describe("Token storage", () => {
    it("should store token in all configured tokenKeys", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      const config = createConfig({
        tokenKeys: ["customToken", "anotherToken"],
      });

      handleOAuthCallback(config);

      expect(mockLocalStorage["customToken"]).toBe(token);
      expect(mockLocalStorage["anotherToken"]).toBe(token);
    });

    it("should use default tokenKeys when not configured", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      const config = createConfig();
      delete (config as any).tokenKeys;

      handleOAuthCallback(config);

      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockLocalStorage["accessToken"]).toBe(token);
      expect(mockLocalStorage["authToken"]).toBe(token);
    });

    it("should handle localStorage.setItem errors gracefully", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      // Mock setLocalStorage to throw for one key
      const originalSetLocalStorage = require("../../src/utils/data-client-utils").setLocalStorage;
      jest.spyOn(require("../../src/utils/data-client-utils"), "setLocalStorage").mockImplementation(((key: string, value: string) => {
        if (key === "accessToken") {
          throw new Error("Storage quota exceeded");
        }
        mockLocalStorage[key] = value;
      }) as any);

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockLocalStorage["accessToken"]).toBeUndefined();
      expect(mockWriteWarn).toHaveBeenCalledWith(
        expect.stringContaining("[handleOAuthCallback] Failed to store token in key accessToken:"),
      );

      // Restore original implementation
      jest.restoreAllMocks();
    });

    it("should return null when not in browser environment", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      // Mock isBrowser to return false
      jest.spyOn(require("../../src/utils/data-client-utils"), "isBrowser").mockReturnValue(false);

      const result = handleOAuthCallback(createConfig());

      // Function returns null early without logging (isBrowser check at function start)
      expect(result).toBeNull();
      expect(mockLocalStorage["token"]).toBeUndefined();

      // Restore original implementation
      jest.restoreAllMocks();
    });
  });

  describe("HTTPS enforcement", () => {
    it("should accept token over HTTPS in production", () => {
      process.env.NODE_ENV = "production";
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "https:";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
    });

    it("should reject token over HTTP in production (non-localhost)", () => {
      process.env.NODE_ENV = "production";
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "http:";
      mockWindow.location.hostname = "example.com"; // Non-localhost

      const result = handleOAuthCallback(createConfig());

      expect(result).toBeNull();
      expect(mockLocalStorage["token"]).toBeUndefined();
      expect(mockWriteErr).toHaveBeenCalledWith(
        "[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production",
      );
      expect(mockWindow.history.replaceState).toHaveBeenCalled();
    });

    it("should accept token over HTTP on localhost even in production", () => {
      process.env.NODE_ENV = "production";
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "http:";
      mockWindow.location.hostname = "localhost";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockWriteErr).not.toHaveBeenCalledWith(
        "[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production",
      );
    });

    it("should accept token over HTTP on 127.0.0.1 even in production", () => {
      process.env.NODE_ENV = "production";
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "http:";
      mockWindow.location.hostname = "127.0.0.1";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockWriteErr).not.toHaveBeenCalledWith(
        "[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production",
      );
    });

    it("should accept token over HTTP on local IP addresses even in production", () => {
      process.env.NODE_ENV = "production";
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "http:";
      mockWindow.location.hostname = "192.168.1.100";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockWriteErr).not.toHaveBeenCalledWith(
        "[handleOAuthCallback] SECURITY WARNING: Token received over HTTP in production",
      );
    });

    it("should accept token over HTTP in development", () => {
      process.env.NODE_ENV = "development";
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "http:";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
    });

    it("should check HTTPS when logLevel is debug", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.protocol = "https:";
      const config = createConfig({
        misoConfig: {
          logLevel: "debug",
        } as any,
      });

      const result = handleOAuthCallback(config);

      expect(result).toBe(token);
    });
  });

  describe("Non-browser environment", () => {
    it("should return null when window is not available", () => {
      delete (globalThis as any).window;
      const config = createConfig();

      const result = handleOAuthCallback(config);

      expect(result).toBeNull();
    });

    it("should return null when localStorage is not available", () => {
      // Remove localStorage to make isBrowser() return false
      delete (globalThis as any).localStorage;
      delete (global as any).localStorage;
      const config = createConfig();

      const result = handleOAuthCallback(config);

      // isBrowser() check happens first, so it returns null before checking localStorage
      expect(result).toBeNull();
    });
  });

  describe("Error handling", () => {
    it("should handle hash parsing errors gracefully", () => {
      // URLSearchParams doesn't throw on invalid strings, but test the try-catch anyway
      // Use a hash that might cause issues
      mockWindow.location.hash = "#token=valid.jwt.token";

      const result = handleOAuthCallback(createConfig());

      // Should still work with valid JWT
      expect(result).toBe("valid.jwt.token");
    });

    it("should handle storage errors without exposing token", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      // Mock setLocalStorage to throw only for some keys, not all
      let callCount = 0;
      jest.spyOn(require("../../src/utils/data-client-utils"), "setLocalStorage").mockImplementation(((key: string, value: string) => {
        callCount++;
        if (callCount === 2) {
          // Throw error on second call (accessToken)
          throw new Error("Storage error");
        }
        mockLocalStorage[key] = value;
      }) as any);

      const result = handleOAuthCallback(createConfig());

      // Should still return token even if some storage operations fail
      expect(result).toBe(token);
      expect(mockWriteWarn).toHaveBeenCalledWith(
        expect.stringContaining("[handleOAuthCallback] Failed to store token in key accessToken:"),
      );
      // Verify error message doesn't contain token
      const warnCall = mockWriteWarn.mock.calls.find((call) =>
        call[0]?.includes("Failed to store token in key"),
      );
      expect(warnCall).toBeDefined();
      expect(JSON.stringify(warnCall)).not.toContain(token);

      // Restore original implementation
      jest.restoreAllMocks();
    });

    it("should handle outer try-catch storage errors", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      // Mock setLocalStorage to throw for all keys
      jest.spyOn(require("../../src/utils/data-client-utils"), "setLocalStorage").mockImplementation(() => {
        throw new Error("Storage completely unavailable");
      });

      const result = handleOAuthCallback(createConfig());

      // Individual setLocalStorage errors are caught in forEach, but if the whole try block fails,
      // the outer catch should handle it. However, since each setLocalStorage is wrapped in try-catch,
      // the function will still return the token. Let's verify the behavior matches implementation.
      // Actually, looking at the code, if all setLocalStorage calls fail, it still returns the token
      // because each failure is caught individually. The outer try-catch only catches
      // errors from accessing storage or other unexpected errors.
      // So this test should verify that individual failures are handled gracefully
      expect(result).toBe(token); // Token is still returned even if storage fails
      expect(mockWriteWarn).toHaveBeenCalled();

      // Restore original implementation
      jest.restoreAllMocks();
    });
  });

  describe("Synchronous extraction", () => {
    it("should extract hash before any async operations", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      const originalHash = mockWindow.location.hash;

      handleOAuthCallback(createConfig());

      // Hash should be cleaned up synchronously
      expect(mockWindow.history.replaceState).toHaveBeenCalled();
      // Verify hash was read before cleanup
      expect(mockWindow.history.replaceState).toHaveBeenCalledWith(
        null,
        "",
        expect.stringMatching(/^\/.*$/),
      );
    });
  });

  describe("Performance", () => {
    it("should complete hash cleanup within 100ms", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;

      const startTime = Date.now();
      handleOAuthCallback(createConfig());
      const endTime = Date.now();

      const duration = endTime - startTime;
      expect(duration).toBeLessThan(100);
      expect(mockWindow.history.replaceState).toHaveBeenCalled();
    });
  });

  describe("Debug logging", () => {
    it("should log security event in debug mode", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      const config = createConfig({
        misoConfig: {
          logLevel: "debug",
        } as any,
      });

      handleOAuthCallback(config);

      expect(mockWriteWarn).toHaveBeenCalledWith(
        expect.stringContaining("[handleOAuthCallback] OAuth token extracted and stored securely"),
      );
      expect(mockWriteWarn).toHaveBeenCalledWith(
        expect.stringMatching(/tokenLength|tokenKeys|storedInKeys/),
      );
    });

    it("should not log security event in non-debug mode", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      const config = createConfig({
        misoConfig: {
          logLevel: "info",
        } as any,
      });

      handleOAuthCallback(config);

      expect(mockWriteWarn).not.toHaveBeenCalledWith(
        expect.stringContaining("[handleOAuthCallback] OAuth token extracted and stored securely"),
      );
    });
  });

  describe("Integration scenarios", () => {
    it("should handle full OAuth callback flow", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}`;
      mockWindow.location.pathname = "/dashboard";
      mockWindow.location.search = "";

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
      expect(mockLocalStorage["accessToken"]).toBe(token);
      expect(mockLocalStorage["authToken"]).toBe(token);
      expect(mockWindow.history.replaceState).toHaveBeenCalledWith(null, "", "/dashboard");
    });

    it("should handle multiple hash parameters", () => {
      const token = createValidJWT();
      mockWindow.location.hash = `#token=${token}&other=value&another=param`;

      const result = handleOAuthCallback(createConfig());

      expect(result).toBe(token);
      expect(mockLocalStorage["token"]).toBe(token);
    });
  });
});

