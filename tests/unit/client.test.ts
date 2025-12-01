/**
 * Unit tests for MisoClient SDK
 */

import { MisoClient } from "../../src/index";
import { MisoClientConfig } from "../../src/types/config.types";

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
});
