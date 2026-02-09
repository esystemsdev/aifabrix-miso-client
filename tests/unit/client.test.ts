/**
 * Unit tests for MisoClient SDK
 */

import { MisoClient } from "../../src/index";
import { MisoClientConfig } from "../../src/types/config.types";
import { Request } from "express";

// Mock Redis
jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    del: jest.fn().mockResolvedValue(true),
    rpush: jest.fn().mockResolvedValue(true),
  }));
});

// Mock axios
jest.mock("axios", () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
}));

describe("MisoClient", () => {
  let client: MisoClient;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      redis: {
        host: "localhost",
        port: 6379,
      },
    };
    client = new MisoClient(config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      await expect(client.initialize()).resolves.toBeUndefined();
      expect(client.isInitialized()).toBe(true);
    });

    it("should handle Redis connection failure gracefully", async () => {
      const mockRedis = require("ioredis");
      mockRedis.mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error("Connection failed")),
        disconnect: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        rpush: jest.fn(),
      }));

      const clientWithoutRedis = new MisoClient({
        ...config,
        redis: undefined,
      });

      await expect(clientWithoutRedis.initialize()).resolves.toBeUndefined();
      expect(clientWithoutRedis.isInitialized()).toBe(true);
    });
  });

  describe("Configuration", () => {
    it("should return configuration", () => {
      const returnedConfig = client.getConfig();
      expect(returnedConfig).toEqual(config);
    });

    it("should not allow modification of returned config", () => {
      const returnedConfig = client.getConfig();
      returnedConfig.clientId = "modified-client-id";

      const originalConfig = client.getConfig();
      expect(originalConfig.clientId).toBe("ctrl-dev-test-app");
    });
  });

  describe("Authentication", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should provide login method", () => {
      expect(typeof client.login).toBe("function");
    });

    it("should provide validateToken method", () => {
      expect(typeof client.validateToken).toBe("function");
    });

    it("should provide getUser method", () => {
      expect(typeof client.getUser).toBe("function");
    });

    it("should provide isAuthenticated method", () => {
      expect(typeof client.isAuthenticated).toBe("function");
    });

    it("should provide logout method", () => {
      expect(typeof client.logout).toBe("function");
    });

    it("should provide getToken method", () => {
      expect(typeof client.getToken).toBe("function");
    });

    it("should provide getEnvironmentToken method", () => {
      expect(typeof client.getEnvironmentToken).toBe("function");
    });

    it("should provide getUserInfo method", () => {
      expect(typeof client.getUserInfo).toBe("function");
    });

    it("should extract token from request headers", () => {
      const req = {
        headers: {
          authorization: "Bearer my-token-123",
        },
      };

      const token = client.getToken(req as any);

      expect(token).toBe("my-token-123");
    });

    it("should return null when no authorization header", () => {
      const req = {
        headers: {},
      };

      const token = client.getToken(req as any);

      expect(token).toBeNull();
    });

    it("should handle token without Bearer prefix", () => {
      const req = {
        headers: {
          authorization: "my-token-123",
        },
      };

      const token = client.getToken(req as any);

      expect(token).toBe("my-token-123");
    });

    it("should provide validateOrigin method", () => {
      expect(typeof client.validateOrigin).toBe("function");
    });

    it("should validate origin using config allowedOrigins", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com", "http://localhost:*"],
      });

      const req = {
        headers: {
          origin: "https://myapp.com",
        },
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(true);
    });

    it("should validate origin with wildcard port from config", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["http://localhost:*"],
      });

      const req = {
        headers: {
          origin: "http://localhost:3000",
        },
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(true);
    });

    it("should reject invalid origin when using config allowedOrigins", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com"],
      });

      const req = {
        headers: {
          origin: "https://evil.com",
        },
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should use provided allowedOrigins override instead of config", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com"],
      });

      const req = {
        headers: {
          origin: "https://other.com",
        },
      } as Request;

      // Override with different origins
      const result = clientWithOrigins.validateOrigin(req, [
        "https://other.com",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should return valid when no allowedOrigins in config and none provided", () => {
      const req = {
        headers: {
          origin: "https://any-origin.com",
        },
      } as Request;

      const result = client.validateOrigin(req);
      expect(result.valid).toBe(true);
    });

    it("should handle missing origin header", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com"],
      });

      const req = {
        headers: {},
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing origin header");
    });

    it("should use referer header when origin is missing", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com"],
      });

      const req = {
        headers: {
          referer: "https://myapp.com/page",
        },
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(true);
    });

    it("should prefer origin header over referer", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com", "https://evil.com"],
      });

      const req = {
        headers: {
          origin: "https://myapp.com",
          referer: "https://evil.com/page",
        },
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(true);
    });

    it("should handle case-insensitive origin matching", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: ["https://myapp.com"],
      });

      const req = {
        headers: {
          origin: "HTTPS://MYAPP.COM",
        },
      } as Request;

      const result = clientWithOrigins.validateOrigin(req);
      expect(result.valid).toBe(true);
    });

    it("should handle multiple allowed origins from config", () => {
      const clientWithOrigins = new MisoClient({
        ...config,
        allowedOrigins: [
          "http://localhost:3000",
          "https://myapp.com",
          "http://localhost:*",
        ],
      });

      const req1 = {
        headers: {
          origin: "https://myapp.com",
        },
      } as Request;

      const req2 = {
        headers: {
          origin: "http://localhost:8080",
        },
      } as Request;

      expect(clientWithOrigins.validateOrigin(req1).valid).toBe(true);
      expect(clientWithOrigins.validateOrigin(req2).valid).toBe(true);
    });
  });

  describe("Authorization", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should provide getRoles method", () => {
      expect(typeof client.getRoles).toBe("function");
    });

    it("should provide hasRole method", () => {
      expect(typeof client.hasRole).toBe("function");
    });

    it("should provide hasAnyRole method", () => {
      expect(typeof client.hasAnyRole).toBe("function");
    });

    it("should provide hasAllRoles method", () => {
      expect(typeof client.hasAllRoles).toBe("function");
    });

    it("should provide refreshRoles method", () => {
      expect(typeof client.refreshRoles).toBe("function");
    });
  });

  describe("Logging", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should provide logger service", () => {
      expect(client.log).toBeDefined();
      expect(typeof client.log.error).toBe("function");
      expect(typeof client.log.audit).toBe("function");
      expect(typeof client.log.info).toBe("function");
      expect(typeof client.log.debug).toBe("function");
    });
  });

  describe("Redis Status", () => {
    it("should report Redis connection status", async () => {
      expect(client.isRedisConnected()).toBe(false);

      // Mock successful Redis connection
      const mockRedis = require("ioredis");
      mockRedis.mockImplementation(() => ({
        connect: jest.fn().mockResolvedValue(undefined),
        disconnect: jest.fn(),
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn(),
        rpush: jest.fn(),
      }));

      await client.initialize();
      expect(client.isRedisConnected()).toBe(true);
    });
  });

  describe("Application status", () => {
    beforeEach(async () => {
      await client.initialize();
    });

    it("should provide updateMyApplicationStatus method", () => {
      expect(typeof client.updateMyApplicationStatus).toBe("function");
    });

    it("should provide getApplicationStatus method", () => {
      expect(typeof client.getApplicationStatus).toBe("function");
    });

    it("should provide getMyApplicationStatus method", () => {
      expect(typeof client.getMyApplicationStatus).toBe("function");
    });

    it("updateMyApplicationStatus should throw when envKey omitted and context missing", async () => {
      // config uses clientId "ctrl-dev-test-app" which does not parse to env/app
      await expect(
        client.updateMyApplicationStatus({ status: "active" }),
      ).rejects.toThrow(/envKey or application context/);
    });

    it("updateMyApplicationStatus should forward to API when envKey provided", async () => {
      const apiClient = (client as any).apiClient;
      const updateSpy = jest
        .spyOn(apiClient.applications, "updateSelfStatus")
        .mockResolvedValue({ success: true });

      const result = await client.updateMyApplicationStatus(
        { status: "active", url: "https://app.example.com" },
        { envKey: "miso" },
      );

      expect(updateSpy).toHaveBeenCalledWith(
        "miso",
        { status: "active", url: "https://app.example.com" },
        undefined,
      );
      expect(result).toEqual({ success: true });

      updateSpy.mockRestore();
    });

    it("updateMyApplicationStatus should pass authStrategy when provided", async () => {
      const apiClient = (client as any).apiClient;
      const authStrategy = { bearerToken: "token-123" };
      const updateSpy = jest
        .spyOn(apiClient.applications, "updateSelfStatus")
        .mockResolvedValue({ success: true });

      await client.updateMyApplicationStatus(
        { port: 8080 },
        { envKey: "miso", authStrategy },
      );

      expect(updateSpy).toHaveBeenCalledWith(
        "miso",
        { port: 8080 },
        authStrategy,
      );

      updateSpy.mockRestore();
    });

    it("getApplicationStatus should forward to API", async () => {
      const apiClient = (client as any).apiClient;
      const mockStatus = {
        key: "my-app",
        displayName: "My App",
        url: "https://app.example.com",
        status: "active",
      };
      const getSpy = jest
        .spyOn(apiClient.applications, "getApplicationStatus")
        .mockResolvedValue(mockStatus);

      const result = await client.getApplicationStatus("miso", "my-app");

      expect(getSpy).toHaveBeenCalledWith("miso", "my-app", undefined);
      expect(result).toEqual(mockStatus);

      getSpy.mockRestore();
    });

    it("getApplicationStatus should pass authStrategy when provided", async () => {
      const apiClient = (client as any).apiClient;
      const authStrategy = { bearerToken: "token-123" };
      const getSpy = jest
        .spyOn(apiClient.applications, "getApplicationStatus")
        .mockResolvedValue({ key: "my-app" });

      await client.getApplicationStatus("miso", "my-app", authStrategy);

      expect(getSpy).toHaveBeenCalledWith("miso", "my-app", authStrategy);

      getSpy.mockRestore();
    });

    it("getMyApplicationStatus should throw when context missing", async () => {
      // config uses clientId "ctrl-dev-test-app" which does not parse to env/app
      await expect(client.getMyApplicationStatus()).rejects.toThrow(
        /envKey and appKey or application context/,
      );
    });

    it("getMyApplicationStatus should forward to API when options provided", async () => {
      const apiClient = (client as any).apiClient;
      const mockStatus = { key: "my-app", status: "active" };
      const getSpy = jest
        .spyOn(apiClient.applications, "getApplicationStatus")
        .mockResolvedValue(mockStatus);

      const result = await client.getMyApplicationStatus({
        envKey: "miso",
        appKey: "my-app",
      });

      expect(getSpy).toHaveBeenCalledWith("miso", "my-app", undefined);
      expect(result).toEqual(mockStatus);

      getSpy.mockRestore();
    });
  });
});
