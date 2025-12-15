/**
 * Integration tests for MisoClient SDK
 */

import { MisoClient } from "../../src/index";
import { MisoClientConfig } from "../../src/types/config.types";

// Mock all external dependencies
jest.mock("axios");
jest.mock("ioredis");
jest.mock("jsonwebtoken");

const jwt = require("jsonwebtoken");

const mockAxiosInstance = {
  interceptors: {
    request: { use: jest.fn() },
    response: { use: jest.fn() },
  },
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

// Mock for temporary axios instance used for token fetch
const mockTempAxiosInstance = {
  post: jest.fn(),
};

const mockAxios = {
  create: jest.fn((config?: any) => {
    // If config has x-client-id header, return temp instance for token fetch
    if (config?.headers?.["x-client-id"]) {
      return mockTempAxiosInstance;
    }
    return mockAxiosInstance;
  }),
};

const mockRedis = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  rpush: jest.fn(),
  isConnected: jest.fn(),
};

require("axios").create = mockAxios.create;
require("ioredis").mockImplementation(() => mockRedis);

describe("MisoClient Integration", () => {
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

    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup default token response for all tests
    mockTempAxiosInstance.post.mockResolvedValue({
      data: {
        success: true,
        token: "client-token-123",
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });

    // Re-setup mocks after clearing
    mockAxiosInstance.post.mockClear();
    mockAxiosInstance.get.mockClear();
    mockTempAxiosInstance.post.mockClear();
    mockTempAxiosInstance.post.mockResolvedValue({
      data: {
        success: true,
        token: "client-token-123",
        expiresIn: 3600,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      },
    });
    mockRedis.connect.mockClear();
    mockRedis.disconnect.mockClear();
    mockRedis.get.mockClear();
    mockRedis.set.mockClear();
    mockRedis.setex.mockClear();
    mockRedis.del.mockClear();
    mockRedis.rpush.mockClear();
    mockRedis.isConnected.mockClear();

    client = new MisoClient(config);
  });

  describe("Initialization", () => {
    it("should initialize successfully with Redis", async () => {
      mockRedis.connect.mockResolvedValue(undefined);

      await client.initialize();

      expect(client.isInitialized()).toBe(true);
      expect(client.isRedisConnected()).toBe(true);
      expect(mockRedis.connect).toHaveBeenCalled();
    });

    it("should initialize successfully without Redis", async () => {
      const clientWithoutRedis = new MisoClient({
        ...config,
        redis: undefined,
      });

      await clientWithoutRedis.initialize();

      expect(clientWithoutRedis.isInitialized()).toBe(true);
      expect(clientWithoutRedis.isRedisConnected()).toBe(false);
    });

    it("should handle Redis connection failure gracefully", async () => {
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));

      await client.initialize();

      expect(client.isInitialized()).toBe(true);
      expect(client.isRedisConnected()).toBe(false);
    });
  });

  describe("Authentication Flow", () => {
    beforeEach(async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      await client.initialize();
    });

    it("should validate token successfully", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          authenticated: true,
          user: { id: "123", username: "testuser" },
        },
      });

      const result = await client.validateToken("valid-token");

      expect(result).toBe(true);
    });

    it("should get user information", async () => {
      const userInfo = {
        id: "123",
        username: "testuser",
        email: "test@example.com",
      };
      mockAxiosInstance.post.mockResolvedValue({
        data: { authenticated: true, user: userInfo },
      });

      const result = await client.getUser("valid-token");

      expect(result).toEqual(userInfo);
    });

    it("should check authentication status", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { authenticated: true, user: { id: "123" } },
      });

      const result = await client.isAuthenticated("valid-token");

      expect(result).toBe(true);
    });
  });

  describe("Authorization Flow", () => {
    beforeEach(async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      await client.initialize();
    });

    it("should get roles from cache when available", async () => {
      // Mock JWT decode to return userId - avoids validate API call
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ roles: ["admin", "user"], timestamp: Date.now() }),
      );

      const result = await client.getRoles("valid-token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockRedis.get).toHaveBeenCalledWith("roles:123");
    });

    it("should fetch roles from controller when cache miss", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });
      // Mock the authenticated request (which internally uses axios.get with token interceptor)
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          userId: "123",
          roles: ["admin", "user"],
          environment: "dev",
          application: "test-app",
        },
      });

      mockRedis.get.mockResolvedValue(null);
      mockRedis.isConnected.mockReturnValue(true);
      mockRedis.setex.mockResolvedValue(undefined);

      const result = await client.getRoles("valid-token");

      expect(result).toEqual(["admin", "user"]);
      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it("should check specific role", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ roles: ["admin", "user"], timestamp: Date.now() }),
      );

      const result = await client.hasRole("valid-token", "admin");

      expect(result).toBe(true);
    });

    it("should check multiple roles", async () => {
      // Mock JWT decode to return userId
      jwt.decode.mockReturnValue({ sub: "123", userId: "123" });

      mockRedis.get.mockResolvedValue(
        JSON.stringify({ roles: ["admin", "user"], timestamp: Date.now() }),
      );

      const hasAny = await client.hasAnyRole("valid-token", [
        "admin",
        "moderator",
      ]);
      const hasAll = await client.hasAllRoles("valid-token", ["admin", "user"]);

      expect(hasAny).toBe(true);
      expect(hasAll).toBe(true);
    });
  });

  describe("Logging Flow", () => {
    beforeEach(async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      await client.initialize();
    });

    it("should log to Redis when connected", async () => {
      mockRedis.rpush.mockResolvedValue(true);

      await client.log.error("Test error", { userId: "123" });

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"error"'),
      );
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Test error"'),
      );
    });

    it("should log audit events", async () => {
      mockRedis.rpush.mockResolvedValue(true);

      await client.log.audit("user.created", "users", { userId: "123" });

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"audit"'),
      );
      expect(mockRedis.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Audit: user.created on users"'),
      );
    });

    it("should fallback to HTTP when Redis fails", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: {} });

      // Ensure Redis is connected but rpush fails
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.isConnected.mockReturnValue(true);
      mockRedis.rpush.mockRejectedValue(new Error("Redis rpush failed"));

      // Initialize the client to ensure Redis is connected
      await client.initialize();

      await client.log.info("Test info");

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/api/v1/logs",
        expect.objectContaining({
          level: "info",
          message: "Test info",
          application: undefined,
          applicationId: "",
          environment: undefined,
          timestamp: expect.any(String),
        }),
        undefined,
      );
    });
  });

  describe("Configuration", () => {
    it("should return configuration", () => {
      const returnedConfig = client.getConfig();

      expect(returnedConfig).toEqual(config);
      expect(returnedConfig).not.toBe(config); // Should be a copy
    });
  });

  describe("Cleanup", () => {
    it("should disconnect from Redis", async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      mockRedis.disconnect.mockResolvedValue(undefined);

      await client.initialize();
      await client.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalled();
      expect(client.isInitialized()).toBe(false);
    });
  });
});
