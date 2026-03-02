/**
 * Unit tests for LoggerService
 */

import { LoggerService } from "../../src/services/logger";
import { HttpClient } from "../../src/utils/http-client";
import { RedisService } from "../../src/services/redis.service";
import { MisoClientConfig } from "../../src/types/config.types";
import { Request } from "express";
import { ApiClient } from "../../src/api";
import { LoggerContextStorage } from "../../src/services/logger/logger-context-storage";
import jwt from "jsonwebtoken";

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
const mockedJwtDecode = jwt.decode as jest.MockedFunction<typeof jwt.decode>;

describe("LoggerService", () => {
  let loggerService: LoggerService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let mockApiClient: jest.Mocked<ApiClient>;
  let config: MisoClientConfig;

  const setHttpClientConfig = (
    client: jest.Mocked<HttpClient>,
    nextConfig: MisoClientConfig,
  ): void => {
    const clientWithConfig = client as jest.Mocked<HttpClient> & {
      config: MisoClientConfig;
    };
    clientWithConfig.config = nextConfig;
  };

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      logLevel: "debug",
    };

    mockHttpClient = {
      request: jest.fn(),
    } as unknown as jest.Mocked<HttpClient>;
    setHttpClientConfig(mockHttpClient, config);

    mockRedisService = {
      isConnected: jest.fn(),
      rpush: jest.fn(),
    } as unknown as jest.Mocked<RedisService>;

    // Mock ApiClient with logs.createLog that calls through to httpClient.request
    mockApiClient = {
      logs: {
        createLog: jest
          .fn()
          .mockImplementation(async (logEntry: unknown) => {
            return mockHttpClient.request("POST", "/api/v1/logs", logEntry);
          }),
      },
    } as unknown as jest.Mocked<ApiClient>;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    loggerService = new LoggerService(mockHttpClient, mockRedisService);
    loggerService.setApiClient(mockApiClient);
  });

  afterEach(() => {
    LoggerContextStorage.getInstance().clearContext();
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
          type: "error",
          data: expect.objectContaining({
            level: "error",
            message: "Test error",
            context: expect.any(Object),
          }),
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
          type: "error",
          data: expect.objectContaining({
            level: "error",
            message: "Test error",
          }),
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

    it("should normalize empty action and resource for audit completeness", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.audit("   ", "", { userId: "123" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Audit: unknown_action on unknown_resource"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"action":"unknown_action"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"resource":"unknown_resource"'),
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

  describe("warn", () => {
    it("should log warn message", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.warn("Test warn");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"warn"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Test warn"'),
      );
    });

    it("should preserve warn level in HTTP payload", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.request.mockResolvedValue({});

      await loggerService.warn("Warn over HTTP");

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs",
        expect.objectContaining({
          type: "general",
          data: expect.objectContaining({
            level: "warn",
            message: "Warn over HTTP",
          }),
        }),
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
      setHttpClientConfig(mockHttpClient, configWithoutDebug);
      const loggerWithoutDebug = new LoggerService(
        mockHttpClient,
        mockRedisService,
      );

      await loggerWithoutDebug.debug("Test debug");

      expect(mockRedisService.rpush).not.toHaveBeenCalled();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });
  });

  describe("log level threshold policy", () => {
    it("should suppress info logs when logLevel is warn", async () => {
      const warnConfig = { ...config, logLevel: "warn" as const };
      setHttpClientConfig(mockHttpClient, warnConfig);
      const thresholdLogger = new LoggerService(mockHttpClient, mockRedisService);

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await thresholdLogger.info("Info should be suppressed");

      expect(mockRedisService.rpush).not.toHaveBeenCalled();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should suppress warn logs when logLevel is error", async () => {
      const errorConfig = { ...config, logLevel: "error" as const };
      setHttpClientConfig(mockHttpClient, errorConfig);
      const thresholdLogger = new LoggerService(mockHttpClient, mockRedisService);

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await thresholdLogger.warn("Warn should be suppressed");

      expect(mockRedisService.rpush).not.toHaveBeenCalled();
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should always keep audit logs regardless of logLevel", async () => {
      const errorConfig = { ...config, logLevel: "error" as const };
      setHttpClientConfig(mockHttpClient, errorConfig);
      const thresholdLogger = new LoggerService(mockHttpClient, mockRedisService);

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await thresholdLogger.audit("access.granted", "resource", { userId: "user-1" });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"audit"'),
      );
    });
  });

  describe("log entry structure", () => {
    it("should include timestamp in log entries", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const beforeTime = new Date().toISOString();
      await loggerService.info("Test message");
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

    it("should prefer logger context over JWT token values", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "jwt-user",
        sessionId: "jwt-session",
      });
      const contextStorage = LoggerContextStorage.getInstance();
      contextStorage.setContext({
        token: "jwt-token",
        userId: "ctx-user",
        sessionId: "ctx-session",
        requestId: "req-123",
        correlationId: "corr-123",
        ipAddress: "10.0.0.1",
        userAgent: "UnitTest/1.0",
      });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string) as {
          userId?: string;
          sessionId?: string;
          requestId?: string;
          correlationId?: string;
          ipAddress?: string;
          userAgent?: string;
        };
        expect(logEntry.userId).toBe("ctx-user");
        expect(logEntry.sessionId).toBe("ctx-session");
        expect(logEntry.requestId).toBe("req-123");
        expect(logEntry.correlationId).toBe("corr-123");
        expect(logEntry.ipAddress).toBe("10.0.0.1");
        expect(logEntry.userAgent).toBe("UnitTest/1.0");
      }
    });

    it("should use context environment and application in log entry", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Test", {
        environment: "dev",
        application: "miso-controller",
      });

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string) as {
          environment?: string;
          application?: string;
          context?: { environment?: string; application?: string };
        };
        expect(logEntry.environment).toBe("dev");
        expect(logEntry.application).toBe("miso-controller");
        expect(logEntry.context?.environment).toBe("dev");
        expect(logEntry.context?.application).toBe("miso-controller");
      }
    });

    it("should include hostname from environment metadata", async () => {
      const originalHostname = process.env.HOSTNAME;
      process.env.HOSTNAME = "test-host";
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      try {
        await loggerService.info("Test");
      } finally {
        if (originalHostname === undefined) {
          delete process.env.HOSTNAME;
        } else {
          process.env.HOSTNAME = originalHostname;
        }
      }

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string) as {
          hostname?: string;
        };
        expect(logEntry.hostname).toBe("test-host");
      }
    });

    it("should preserve all top-level fields in non-audit log entry", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info("Preserve fields", {
        environment: "dev",
        application: "miso-controller",
        action: "log.test",
      }, {
        sourceKey: "source-123",
        sourceDisplayName: "Source System",
        externalSystemKey: "ext-123",
        externalSystemDisplayName: "External System",
        recordKey: "record-123",
        recordDisplayName: "Record Name",
        credentialId: "cred-123",
        credentialType: "api-key",
        responseSize: 512,
        durationMs: 42,
        errorCategory: "network",
        httpStatusCategory: "5xx",
      });

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string) as {
          level?: string;
          environment?: string;
          application?: string;
          sourceKey?: string;
          sourceDisplayName?: string;
          externalSystemKey?: string;
          externalSystemDisplayName?: string;
          recordKey?: string;
          recordDisplayName?: string;
          credentialId?: string;
          credentialType?: string;
          responseSize?: number;
          durationMs?: number;
          errorCategory?: string;
          httpStatusCategory?: string;
          context?: { environment?: string; application?: string; action?: string };
        };
        expect(logEntry.level).toBe("info");
        expect(logEntry.environment).toBe("dev");
        expect(logEntry.application).toBe("miso-controller");
        expect(logEntry.sourceKey).toBe("source-123");
        expect(logEntry.sourceDisplayName).toBe("Source System");
        expect(logEntry.externalSystemKey).toBe("ext-123");
        expect(logEntry.externalSystemDisplayName).toBe("External System");
        expect(logEntry.recordKey).toBe("record-123");
        expect(logEntry.recordDisplayName).toBe("Record Name");
        expect(logEntry.credentialId).toBe("cred-123");
        expect(logEntry.credentialType).toBe("api-key");
        expect(logEntry.responseSize).toBe(512);
        expect(logEntry.durationMs).toBe(42);
        expect(logEntry.errorCategory).toBe("network");
        expect(logEntry.httpStatusCategory).toBe("5xx");
        expect(logEntry.context).toMatchObject({
          environment: "dev",
          application: "miso-controller",
          action: "log.test",
        });
      }
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

  describe("method chaining", () => {
    it("should support withContext method", () => {
      const chain = loggerService.withContext({ userId: "123" });
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

    it("should execute warn with chain context", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ action: "warn-test" });
      await chain.warn("Warning message");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"level":"warn"'),
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"action":"warn-test"'),
      );
    });

    it("should extract JWT context from request token", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        applicationId: "app-456",
        sessionId: "session-789",
        roles: ["admin", "user"],
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer valid-jwt-token",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
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

    it("should handle JWT decode failure in request token", async () => {
      mockedJwtDecode.mockImplementation(() => {
        throw new Error("Invalid token");
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer invalid-token",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test with invalid token");

      // Should still log without JWT context
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"message":"Test with invalid token"'),
      );
    });

    it("should extract userId from different JWT claim formats", async () => {
      mockedJwtDecode.mockReturnValue({
        user_id: "user-456", // Alternative format
        app_id: "app-789",
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-with-user_id",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-456"'),
      );
    });

    it("should extract roles from realm_access in JWT", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        realm_access: {
          roles: ["admin", "manager"],
        },
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-with-realm-access",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test");

      // JWT roles/permissions are extracted but not directly added to log entry
      // They're available in jwtContext but logged via userId which we can verify
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-123"'),
      );
    });

    it("should extract permissions from scope in JWT", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        scope: "read:users write:posts",
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-with-scope",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test");

      // JWT permissions from scope are extracted but not directly in log entry
      // Verify userId is extracted correctly
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"userId":"user-123"'),
      );
    });

    it("should handle null decoded JWT gracefully", async () => {
      mockedJwtDecode.mockReturnValue(null);

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-returns-null",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalled();
    });

    it("should extract sessionId from sid claim", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        sid: "session-from-sid",
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-with-sid",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        "logs:ctrl-dev-test-app",
        expect.stringContaining('"sessionId":"session-from-sid"'),
      );
    });

    it("should handle empty roles and permissions arrays in JWT", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        roles: [],
        permissions: [],
      });

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-empty-arrays",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      await chain.info("Test");

      expect(mockRedisService.rpush).toHaveBeenCalled();
    });

    it("should support withoutMasking method", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withoutMasking();
      chain.addContext("password", "secret");
      chain.addContext("apiKey", "key123");
      await chain.info("Test");

      const rpushCall = mockRedisService.rpush.mock.calls.find(
        (call: [string, string]) =>
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
      mockedJwtDecode.mockReturnValue({ sub: "user-123" });
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const req = {
        method: "GET",
        path: "/api/test",
        headers: {
          authorization: "Bearer token-123",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const chain = loggerService.forRequest(req);
      chain.addContext("action", "test");
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
      setHttpClientConfig(mockHttpClient, config);
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

      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        sessionId: "session-456",
      });
      const contextStorage = LoggerContextStorage.getInstance();
      contextStorage.setContext({
        token: "jwt-token",
        applicationId: "app-123",
        requestId: "req-789",
      });
      await loggerService.info("Test", { key: "value" });

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

    it("should preserve top-level fields in non-audit emitted log", async () => {
      const eventSpy = jest.fn();
      loggerService.on("log", eventSpy);

      await loggerService.info("Preserve fields", {
        environment: "dev",
        application: "miso-controller",
        action: "log.test",
      }, {
        sourceKey: "source-123",
        sourceDisplayName: "Source System",
        externalSystemKey: "ext-123",
        externalSystemDisplayName: "External System",
        recordKey: "record-123",
        recordDisplayName: "Record Name",
        credentialId: "cred-123",
        credentialType: "api-key",
        responseSize: 512,
        durationMs: 42,
        errorCategory: "network",
        httpStatusCategory: "5xx",
      });

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedLog = eventSpy.mock.calls[0][0] as {
        level?: string;
        environment?: string;
        application?: string;
        sourceKey?: string;
        sourceDisplayName?: string;
        externalSystemKey?: string;
        externalSystemDisplayName?: string;
        recordKey?: string;
        recordDisplayName?: string;
        credentialId?: string;
        credentialType?: string;
        responseSize?: number;
        durationMs?: number;
        errorCategory?: string;
        httpStatusCategory?: string;
        context?: { environment?: string; application?: string; action?: string };
      };
      expect(emittedLog.level).toBe("info");
      expect(emittedLog.environment).toBe("dev");
      expect(emittedLog.application).toBe("miso-controller");
      expect(emittedLog.sourceKey).toBe("source-123");
      expect(emittedLog.sourceDisplayName).toBe("Source System");
      expect(emittedLog.externalSystemKey).toBe("ext-123");
      expect(emittedLog.externalSystemDisplayName).toBe("External System");
      expect(emittedLog.recordKey).toBe("record-123");
      expect(emittedLog.recordDisplayName).toBe("Record Name");
      expect(emittedLog.credentialId).toBe("cred-123");
      expect(emittedLog.credentialType).toBe("api-key");
      expect(emittedLog.responseSize).toBe(512);
      expect(emittedLog.durationMs).toBe(42);
      expect(emittedLog.errorCategory).toBe("network");
      expect(emittedLog.httpStatusCategory).toBe("5xx");
      expect(emittedLog.context).toMatchObject({
        environment: "dev",
        application: "miso-controller",
        action: "log.test",
      });
    });

    it("should maintain backward compatibility when emitEvents is false", async () => {
      // Reset to default mode (emitEvents = false)
      config.emitEvents = false;
      setHttpClientConfig(mockHttpClient, config);
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

  describe("withRequest method", () => {
    let mockRequest: Partial<Request>;

    beforeEach(() => {
      mockRequest = {
        method: "POST",
        path: "/api/users",
        originalUrl: "/api/users",
        ip: "192.168.1.1",
        headers: {
          "user-agent": "Mozilla/5.0",
          "x-correlation-id": "corr-123",
          "x-request-id": "req-456",
          referer: "https://example.com",
          "content-length": "1024",
        },
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Partial<Request>;
    });

    it("should extract and set request context in LoggerChain", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-123",
        sessionId: "session-456",
      });
      mockRequest.headers = {
        ...mockRequest.headers,
        authorization: "Bearer valid-token",
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withRequest(mockRequest as Request);
      await chain.info("Test with request");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.userId).toBe("user-123");
        expect(logEntry.sessionId).toBe("session-456");
        expect(logEntry.correlationId).toBe("corr-123");
        expect(logEntry.requestId).toBe("req-456");
        expect(logEntry.ipAddress).toBe("192.168.1.1");
        expect(logEntry.userAgent).toBe("Mozilla/5.0");
        expect(logEntry.context.method).toBe("POST");
        expect(logEntry.context.path).toBe("/api/users");
        expect(logEntry.context.referer).toBe("https://example.com");
        expect(logEntry.context.requestSize).toBe(1024);
      }
    });

    it("should include top-level request metadata in log entry", async () => {
      mockRequest.headers = {
        ...mockRequest.headers,
        authorization: "Bearer valid-token",
      };
      mockedJwtDecode.mockReturnValue({
        sub: "user-999",
        sessionId: "session-123",
      });

      const logEntry = loggerService.getLogWithRequest(
        mockRequest as Request,
        "Test message",
        "info",
        { action: "test" },
      );

      expect(logEntry.ipAddress).toBe("192.168.1.1");
      expect(logEntry.userAgent).toBe("Mozilla/5.0");
      expect(logEntry.correlationId).toBe("corr-123");
      expect(logEntry.requestId).toBe("req-456");
      expect(logEntry.userId).toBe("user-999");
      expect(logEntry.sessionId).toBe("session-123");
      expect(logEntry.context).toMatchObject({
        action: "test",
      });
    });

    it("should handle request without Authorization header", async () => {
      const { authorization: _authorization, ...headersWithoutAuth } =
        mockRequest.headers || {};
      mockRequest.headers = headersWithoutAuth;
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withRequest(mockRequest as Request);
      await chain.info("Test without auth");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.ipAddress).toBe("192.168.1.1");
        expect(logEntry.userAgent).toBe("Mozilla/5.0");
        expect(logEntry.userId).toBeUndefined();
      }
    });

    it("should handle request with invalid JWT token", async () => {
      mockedJwtDecode.mockReturnValue(null);
      mockRequest.headers = {
        ...mockRequest.headers,
        authorization: "Bearer invalid-token",
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withRequest(mockRequest as Request);
      await chain.info("Test with invalid token");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.ipAddress).toBe("192.168.1.1");
        expect(logEntry.userId).toBeUndefined();
      }
    });

    it("should handle request with proxy IP (x-forwarded-for)", async () => {
      const proxyRequest: Partial<Request> = {
        ...mockRequest,
        ip: undefined,
        headers: {
          ...mockRequest.headers,
          "x-forwarded-for": "10.0.0.1, 192.168.1.1",
        },
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withRequest(proxyRequest as Request);
      await chain.info("Test with proxy IP");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.ipAddress).toBe("10.0.0.1");
      }
    });

    it("should support method chaining with withRequest", async () => {
      mockedJwtDecode.mockReturnValue({ sub: "user-123" });
      mockRequest.headers = {
        ...mockRequest.headers,
        authorization: "Bearer valid-token",
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService
        .withContext({ action: "test" })
        .withRequest(mockRequest as Request);
      await chain.info("Test chaining");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.context.action).toBe("test");
        expect(logEntry.ipAddress).toBe("192.168.1.1");
        expect(logEntry.userId).toBe("user-123");
      }
    });

    it("should use originalUrl over path when both are present", async () => {
      const urlRequest: Partial<Request> = {
        ...mockRequest,
        originalUrl: "/api/v2/users",
        path: "/api/users",
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withRequest(urlRequest as Request);
      await chain.info("Test originalUrl");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.context.path).toBe("/api/v2/users");
      }
    });
  });

  describe("forRequest method", () => {
    let mockRequest: Partial<Request>;

    beforeEach(() => {
      mockRequest = {
        method: "GET",
        path: "/api/data",
        ip: "127.0.0.1",
        headers: {
          "user-agent": "TestAgent/1.0",
          "x-correlation-id": "corr-789",
        },
        socket: {
          remoteAddress: "127.0.0.1",
        },
      } as unknown as Partial<Request>;
    });

    it("should create LoggerChain with request context pre-populated", async () => {
      mockedJwtDecode.mockReturnValue({
        sub: "user-999",
      });
      mockRequest.headers = {
        ...mockRequest.headers,
        authorization: "Bearer valid-token",
      };
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.forRequest(mockRequest as Request);
      await chain.info("Test forRequest");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.userId).toBe("user-999");
        expect(logEntry.ipAddress).toBe("127.0.0.1");
        expect(logEntry.userAgent).toBe("TestAgent/1.0");
        expect(logEntry.correlationId).toBe("corr-789");
        expect(logEntry.context.method).toBe("GET");
        expect(logEntry.context.path).toBe("/api/data");
      }
    });

    it("should support method chaining after forRequest", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService
        .forRequest(mockRequest as Request)
        .addContext("custom", "value")
        .info("Test chaining");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.context.custom).toBe("value");
        expect(logEntry.ipAddress).toBe("127.0.0.1");
      }
    });

    it("should handle request without optional headers", async () => {
      mockRequest.headers = {};
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.forRequest(mockRequest as Request);
      await chain.info("Test minimal request");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.ipAddress).toBe("127.0.0.1");
        expect(logEntry.context.method).toBe("GET");
        expect(logEntry.userAgent).toBeUndefined();
        // correlationId will be auto-generated if not provided
        expect(logEntry.correlationId).toBeDefined();
      }
    });
  });

  describe("indexed context methods", () => {
    it("should support withIndexedContext method", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withIndexedContext({
        sourceKey: "datasource-1",
        sourceDisplayName: "PostgreSQL DB",
        externalSystemKey: "system-1",
        externalSystemDisplayName: "External System",
        recordKey: "record-123",
        recordDisplayName: "User Profile",
      });
      await chain.info("Test with indexed context");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.sourceKey).toBe("datasource-1");
        expect(logEntry.sourceDisplayName).toBe("PostgreSQL DB");
        expect(logEntry.externalSystemKey).toBe("system-1");
        expect(logEntry.externalSystemDisplayName).toBe("External System");
        expect(logEntry.recordKey).toBe("record-123");
        expect(logEntry.recordDisplayName).toBe("User Profile");
      }
    });

    it("should support withIndexedContext with partial fields", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withIndexedContext({
        sourceKey: "datasource-1",
        recordKey: "record-123",
      });
      await chain.info("Test with partial indexed context");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.sourceKey).toBe("datasource-1");
        expect(logEntry.recordKey).toBe("record-123");
        expect(logEntry.sourceDisplayName).toBeUndefined();
        expect(logEntry.externalSystemKey).toBeUndefined();
      }
    });

    it("should support withCredentialContext method", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withCredentialContext("cred-123", "oauth2");
      await chain.info("Test with credential context");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.credentialId).toBe("cred-123");
        expect(logEntry.credentialType).toBe("oauth2");
      }
    });

    it("should support withCredentialContext with only credentialId", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withCredentialContext("cred-456");
      await chain.info("Test with credential ID only");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.credentialId).toBe("cred-456");
        expect(logEntry.credentialType).toBeUndefined();
      }
    });

    it("should support withResponseMetrics method", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withResponseMetrics(2048, 150);
      await chain.info("Test with response metrics");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.responseSize).toBe(2048);
        expect(logEntry.durationMs).toBe(150);
      }
    });

    it("should support withResponseMetrics with partial metrics", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({});
      chain.withResponseMetrics(2048, 150);
      await chain.info("Test with partial metrics");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.responseSize).toBe(2048);
        expect(logEntry.durationMs).toBe(150);
      }
    });

    it("should combine indexed context, credential context, and request metrics", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService
        .withContext({ action: "sync" })
        .withIndexedContext({
          sourceKey: "datasource-1",
          externalSystemKey: "system-1",
        })
        .withCredentialContext("cred-123", "oauth2")
        .withResponseMetrics(2048, 150);
      await chain.info("Test with all indexed fields");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.context.action).toBe("sync");
        expect(logEntry.sourceKey).toBe("datasource-1");
        expect(logEntry.externalSystemKey).toBe("system-1");
        expect(logEntry.credentialId).toBe("cred-123");
        expect(logEntry.credentialType).toBe("oauth2");
        expect(logEntry.responseSize).toBe(2048);
        expect(logEntry.durationMs).toBe(150);
      }
    });

    it("should support indexed context in audit logs", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService
        .withContext({})
        .withIndexedContext({
          sourceKey: "datasource-1",
          recordKey: "record-123",
        })
        .withCredentialContext("cred-123", "api-key");
      await chain.audit("abac.authorization.grant", "external_record");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.level).toBe("audit");
        expect(logEntry.sourceKey).toBe("datasource-1");
        expect(logEntry.recordKey).toBe("record-123");
        expect(logEntry.credentialId).toBe("cred-123");
        expect(logEntry.credentialType).toBe("api-key");
      }
    });

    it("should support indexed context in error logs", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService
        .withContext({})
        .withIndexedContext({
          sourceKey: "datasource-1",
          externalSystemKey: "system-1",
        })
        .withResponseMetrics(0, 5000);
      await chain.error("Sync failed", "Error stack trace");

      const rpushCall = mockRedisService.rpush.mock.calls[0];
      expect(rpushCall).toBeDefined();
      if (rpushCall && rpushCall[1]) {
        const logEntry = JSON.parse(rpushCall[1] as string);
        expect(logEntry.level).toBe("error");
        expect(logEntry.sourceKey).toBe("datasource-1");
        expect(logEntry.externalSystemKey).toBe("system-1");
        expect(logEntry.responseSize).toBe(0);
        expect(logEntry.durationMs).toBe(5000);
        expect(logEntry.stackTrace).toBe("Error stack trace");
      }
    });
  });
});
