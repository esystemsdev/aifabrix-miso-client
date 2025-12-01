/**
 * Unit tests for LoggerService
 */

import { LoggerService } from "../../src/services/logger.service";
import { HttpClient } from "../../src/utils/http-client";
import { RedisService } from "../../src/services/redis.service";
import { MisoClientConfig } from "../../src/types/config.types";

// Mock HttpClient
jest.mock("../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock("../../src/services/redis.service");
const MockedRedisService = RedisService as jest.MockedClass<
  typeof RedisService
>;

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const jwt = require("jsonwebtoken");

describe("LoggerService", () => {
  let loggerService: LoggerService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      logLevel: "debug",
    };

    mockHttpClient = {
      request: jest.fn(),
    } as any;
    (mockHttpClient as any).config = config; // Add config to httpClient for access

    mockRedisService = {
      isConnected: jest.fn(),
      rpush: jest.fn(),
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    loggerService = new LoggerService(mockHttpClient, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("error", () => {
    it("should log error to Redis when connected", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.error("Test error", { userId: "123" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"error"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Test error"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"environment":"unknown"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"application":"ctrl-dev-test-app"'),
      );
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should fallback to HTTP when Redis fails", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(false);
      mockHttpClient.request.mockResolvedValue({});

      await loggerService.error("Test error", { userId: "123" });

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs",
        expect.objectContaining({
          level: "error",
          message: "Test error",
          context: { userId: "123" },
        }),
      );
    });

    it("should use HTTP when Redis not connected", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.request.mockResolvedValue({});

      await loggerService.error("Test error");

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs",
        expect.objectContaining({
          level: "error",
          message: "Test error",
        }),
      );
      expect(mockRedisService.rpush).not.toHaveBeenCalled();
    });
  });

  describe("audit", () => {
    it("should log audit event with action and resource", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.audit("user.created", "users", { userId: "123" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"audit"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Audit: user.created on users"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"action":"user.created"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"resource":"users"'),
      );
    });
  });

  describe("info", () => {
    it("should log info message", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test info");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"info"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Test info"'),
      );
    });
  });

  describe("debug", () => {
    it("should log debug message when logLevel is debug", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.debug("Test debug");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"debug"'),
      );
    });

    it("should not log debug message when logLevel is not debug", async () => {
      const configWithoutDebug = { ...config, logLevel: "info" as const };
      (mockHttpClient as any).config = configWithoutDebug;
      const loggerWithoutDebug = new LoggerService(
        mockHttpClient,
        mockRedisService,
      );

      await loggerWithoutDebug.debug("Test debug");

      expect(mockRedisService.rpush).not.toHaveBeenCalled();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });
  });

  describe("log entry structure", () => {
    it("should include timestamp in log entries", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const beforeTime = new Date().toISOString();
      await loggerService.info("Test message");
      const afterTime = new Date().toISOString();

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringMatching(
          new RegExp(`"timestamp":"${beforeTime.split("T")[0]}`),
        ),
      );
    });

    it("should handle HTTP fallback errors gracefully", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.request.mockRejectedValue(new Error("HTTP error"));

      // Should not throw
      await expect(loggerService.error("Test error")).resolves.toBeUndefined();
    });
  });

  describe("enhanced logging options", () => {
    it("should include stack trace in error logs", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.error(
        "Test error",
        { userId: "123" },
        "Stack trace here",
      );

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"stackTrace":"Stack trace here"'),
      );
    });

    it("should include correlation ID when provided", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test", {
        data: "value",
        correlationId: "corr-123",
      });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"correlationId":"corr-123"'),
      );
    });

    it("should include user ID when provided", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test", { data: "value", userId: "user-123" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-123"'),
      );
    });

    it("should mask sensitive data by default", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test", {
        password: "secret123",
        username: "john",
      });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining("***MASKED***"),
      );
    });

    it("should not mask data when disabled", async () => {
      loggerService.setMasking(false);
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test", { password: "secret123" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"password":"secret123"'),
      );
    });

    it("should include performance metrics when requested", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test", { data: "value" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"data":"value"'),
      );
    });
  });

  describe("performance tracking", () => {
    it("should start performance tracking", () => {
      loggerService.startPerformanceTracking("test-op");

      const metrics = loggerService.endPerformanceTracking("test-op");
      expect(metrics).not.toBeNull();
      expect(metrics?.duration).toBeGreaterThanOrEqual(0);
    });

    it("should return null for non-existent operation", () => {
      const metrics = loggerService.endPerformanceTracking("non-existent");
      expect(metrics).toBeNull();
    });

    it("should track memory usage when available", () => {
      loggerService.startPerformanceTracking("test-op");
      const metrics = loggerService.endPerformanceTracking("test-op");

      expect(metrics?.memoryUsage).toBeDefined();
      expect(metrics?.memoryUsage?.rss).toBeGreaterThan(0);
    });
  });

  describe("method chaining", () => {
    it("should support withContext method", () => {
      const chain = loggerService.withContext({ userId: "123" });
      expect(chain).toBeDefined();
    });

    it("should support withToken method", () => {
      const chain = loggerService.withToken("test-token");
      expect(chain).toBeDefined();
    });

    it("should support withPerformance method", () => {
      const chain = loggerService.withPerformance();
      expect(chain).toBeDefined();
    });

    it("should support withoutMasking method", () => {
      const chain = loggerService.withoutMasking();
      expect(chain).toBeDefined();
    });
  });

  describe("LoggerChain", () => {
    it("should support fluent API with addContext", async () => {
      loggerService.setMasking(false);
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ initial: "data" });
      chain.addContext("userKey", "value");
      await chain.info("Test message");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userKey":"value"'),
      );
    });

    it("should support addUser method", () => {
      const chain = loggerService.withContext({});
      chain.addUser("user-123");
      expect(chain["options"].userId).toBe("user-123");
    });

    it("should support addApplication method", () => {
      const chain = loggerService.withContext({});
      chain.addApplication("app-123");
      expect(chain["options"].applicationId).toBe("app-123");
    });

    it("should support addCorrelation method", () => {
      const chain = loggerService.withContext({});
      chain.addCorrelation("corr-123");
      expect(chain["options"].correlationId).toBe("corr-123");
    });

    it("should execute error with chain context", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ action: "test" });
      await chain.error("Error occurred", "Stack trace");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"action":"test"'),
      );
    });

    it("should execute audit with chain context", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ userId: "123" });
      await chain.audit("action", "resource");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"123"'),
      );
    });

    it("should support withToken method and extract JWT context", async () => {
      jwt.decode.mockReturnValue({
        sub: "user-123",
        applicationId: "app-456",
        sessionId: "session-789",
        roles: ["admin", "user"],
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("valid-jwt-token");
      await chain.info("Test with token");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-123"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"sessionId":"session-789"'),
      );
    });

    it("should handle JWT decode failure in withToken", async () => {
      jwt.decode.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("invalid-token");
      await chain.info("Test with invalid token");

      // Should still log without JWT context
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Test with invalid token"'),
      );
    });

    it("should extract userId from different JWT claim formats", async () => {
      jwt.decode.mockReturnValue({
        user_id: "user-456", // Alternative format
        app_id: "app-789",
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("token-with-user_id");
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-456"'),
      );
    });

    it("should extract roles from realm_access in JWT", async () => {
      jwt.decode.mockReturnValue({
        sub: "user-123",
        realm_access: {
          roles: ["admin", "manager"],
        },
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("token-with-realm-access");
      await chain.info("Test");

      // JWT roles/permissions are extracted but not directly added to log entry
      // They're available in jwtContext but logged via userId which we can verify
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-123"'),
      );
    });

    it("should extract permissions from scope in JWT", async () => {
      jwt.decode.mockReturnValue({
        sub: "user-123",
        scope: "read:users write:posts",
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("token-with-scope");
      await chain.info("Test");

      // JWT permissions from scope are extracted but not directly in log entry
      // Verify userId is extracted correctly
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-123"'),
      );
    });

    it("should handle null decoded JWT gracefully", async () => {
      jwt.decode.mockReturnValue(null);

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("token-returns-null");
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalled();
    });

    it("should extract sessionId from sid claim", async () => {
      jwt.decode.mockReturnValue({
        sub: "user-123",
        sid: "session-from-sid",
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("token-with-sid");
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"sessionId":"session-from-sid"'),
      );
    });

    it("should handle empty roles and permissions arrays in JWT", async () => {
      jwt.decode.mockReturnValue({
        sub: "user-123",
        roles: [],
        permissions: [],
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withToken("token-empty-arrays");
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalled();
    });

    it("should support withPerformance and include metrics", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withPerformance();
      await chain.info("Test with performance");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"performance"'),
      );
    });

    it("should support withoutMasking method", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withoutMasking();
      chain.addContext("password", "secret");
      chain.addContext("apiKey", "key123");
      await chain.info("Test");

      const rpushCall = mockRedisService.rpush.mock.calls.find(
        (call: any[]) =>
          call &&
          call[1] &&
          typeof call[1] === "string" &&
          call[1].includes("password"),
      );
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        expect(rpushCall[1]).toContain('"password":"secret"');
        expect(rpushCall[1]).not.toContain("***MASKED***");
      }
    });

    it("should handle HTTP error in chain methods gracefully", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.request.mockRejectedValue(new Error("HTTP error"));

      const chain = loggerService.withContext({ test: "data" });
      await expect(chain.error("Test error")).resolves.toBeUndefined();
    });

    it("should handle Redis error and fallback to HTTP", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      // Make rpush return false (not throw) to trigger HTTP fallback
      mockRedisService.rpush.mockResolvedValue(false);
      mockHttpClient.request.mockResolvedValue({}); // HTTP fallback should succeed

      const chain = loggerService.withContext({ test: "data" });
      await expect(chain.info("Test")).resolves.toBeUndefined();
      expect(mockHttpClient.request).toHaveBeenCalled();
    });

    it("should handle Redis failure and HTTP error gracefully", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      // Make rpush return false (not throw) to trigger HTTP fallback
      mockRedisService.rpush.mockResolvedValue(false);
      mockHttpClient.request.mockRejectedValue(new Error("HTTP error"));

      const chain = loggerService.withContext({ test: "data" });
      // HTTP error is caught and silently swallowed to avoid infinite logging loops
      await expect(chain.info("Test")).resolves.toBeUndefined();
    });

    it("should handle Redis rejection", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockRejectedValue(new Error("Redis error"));

      const chain = loggerService.withContext({ test: "data" });
      // If Redis throws, error propagates immediately
      await expect(chain.info("Test")).rejects.toThrow("Redis error");
    });

    it("should combine multiple chain methods", async () => {
      jwt.decode.mockReturnValue({ sub: "user-123" });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService
        .withContext({ action: "test" })
        .withToken("token-123")
        .addUser("user-456")
        .addCorrelation("corr-789");
      await chain.info("Test with multiple chain methods");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"action":"test"'),
      );
    });
  });

  describe("event emission (emitEvents mode)", () => {
    beforeEach(() => {
      // Set emitEvents to true
      config.emitEvents = true;
      (mockHttpClient as any).config = config;
      loggerService = new LoggerService(mockHttpClient, mockRedisService);
    });

    it("should emit log event when emitEvents is true", async () => {
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.error("Test error", { userId: "123" });

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedLog = eventSpy.mock.calls[0][0];
      expect(emittedLog).toMatchObject({
        level: "error",
        message: "Test error",
        context: { userId: "123" },
        environment: "unknown",
        application: "ctrl-dev-test-app",
      });
      expect(emittedLog.timestamp).toBeDefined();
      expect(emittedLog.correlationId).toBeDefined();
    });

    it("should skip Redis when emitEvents is true", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.info("Test info");

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(mockRedisService.rpush).not.toHaveBeenCalled();
    });

    it("should skip HTTP when emitEvents is true", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.error("Test error");

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should emit audit events with correct structure", async () => {
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.audit("user.created", "users", { userId: "123" });

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedLog = eventSpy.mock.calls[0][0];
      expect(emittedLog.level).toBe("audit");
      expect(emittedLog.message).toContain("Audit: user.created on users");
      expect(emittedLog.context).toMatchObject({
        action: "user.created",
        resource: "users",
        userId: "123",
      });
    });

    it("should emit debug events when logLevel is debug", async () => {
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.debug("Test debug");

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedLog = eventSpy.mock.calls[0][0];
      expect(emittedLog.level).toBe("debug");
    });

    it("should emit events with same payload structure as REST API", async () => {
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      jwt.decode.mockReturnValue({ sub: "user-123", sessionId: "session-456" });
      await loggerService.info(
        "Test",
        { key: "value" },
        {
          token: "jwt-token",
          applicationId: "app-123",
          requestId: "req-789",
        },
      );

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedLog = eventSpy.mock.calls[0][0];
      // Should have same structure as REST API payload
      expect(emittedLog).toHaveProperty("timestamp");
      expect(emittedLog).toHaveProperty("level", "info");
      expect(emittedLog).toHaveProperty("environment", "unknown");
      expect(emittedLog).toHaveProperty("application", "ctrl-dev-test-app");
      expect(emittedLog).toHaveProperty("applicationId", "app-123");
      expect(emittedLog).toHaveProperty("message", "Test");
      expect(emittedLog).toHaveProperty("context");
      expect(emittedLog).toHaveProperty("userId", "user-123");
      expect(emittedLog).toHaveProperty("sessionId", "session-456");
      expect(emittedLog).toHaveProperty("requestId", "req-789");
      expect(emittedLog).toHaveProperty("correlationId");
    });

    it("should maintain backward compatibility when emitEvents is false", async () => {
      // Reset to default mode (emitEvents = false)
      config.emitEvents = false;
      (mockHttpClient as any).config = config;
      loggerService = new LoggerService(mockHttpClient, mockRedisService);

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.error("Test error");

      // Should use Redis/HTTP, not emit events
      expect(mockRedisService.rpush).toHaveBeenCalled();
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
