/**
 * Unit tests for LoggerService getter methods
 */

import { LoggerService } from "../../../src/services/logger";
import { HttpClient } from "../../../src/utils/http-client";
import { RedisService } from "../../../src/services/redis.service";
import { MisoClientConfig, LogEntry } from "../../../src/types/config.types";
import { Request } from "express";
import jwt from "jsonwebtoken";

// Mock HttpClient
jest.mock("../../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock("../../../src/services/redis.service");
const MockedRedisService = RedisService as jest.MockedClass<
  typeof RedisService
>;

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe("LoggerService Getter Methods", () => {
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
    (mockHttpClient as any).config = config;

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

  describe("generateCorrelationId", () => {
    it("should generate a correlation ID", () => {
      const correlationId = loggerService.generateCorrelationId();

      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe("string");
      expect(correlationId.length).toBeGreaterThan(0);
    });

    it("should generate unique correlation IDs", () => {
      const id1 = loggerService.generateCorrelationId();
      const id2 = loggerService.generateCorrelationId();

      expect(id1).not.toBe(id2);
    });
  });

  describe("getLogWithRequest", () => {
    it("should return LogEntry with request context extracted", () => {
      const mockReq = {
        method: "POST",
        path: "/api/users",
        headers: {
          "x-correlation-id": "req-correlation-123",
          "user-agent": "Mozilla/5.0",
          authorization: "Bearer jwt-token-here",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      mockedJwt.decode.mockReturnValue({
        sub: "user-123",
        sessionId: "session-456",
      });

      const logEntry = loggerService.getLogWithRequest(
        mockReq,
        "User action",
        "info",
        { action: "login" },
      );

      expect(logEntry).toBeDefined();
      expect(logEntry.message).toBe("User action");
      expect(logEntry.level).toBe("info");
      expect(logEntry.application).toBe("ctrl-dev-test-app");
      expect(logEntry.correlationId).toBe("req-correlation-123");
      expect(logEntry.userId).toBe("user-123");
      expect(logEntry.sessionId).toBe("session-456");
      expect(logEntry.context).toEqual({ action: "login" });
      expect(logEntry.timestamp).toBeDefined();
    });

    it("should generate correlation ID when not in request", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {},
        ip: "192.168.1.1",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test message");

      expect(logEntry.correlationId).toBeDefined();
      expect(logEntry.correlationId).not.toBe("req-correlation-123");
    });

    it("should extract IP address from request", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {},
        ip: "192.168.1.100",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test");

      expect(logEntry.ipAddress).toBe("192.168.1.100");
    });

    it("should extract user agent from request", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {
          "user-agent": "TestAgent/1.0",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test");

      expect(logEntry.userAgent).toBe("TestAgent/1.0");
    });

    it("should mask sensitive data in context by default", () => {
      const mockReq = {
        method: "POST",
        path: "/api/login",
        headers: {},
        ip: "192.168.1.1",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Login", "info", {
        password: "secret123",
        username: "john",
      });

      expect(logEntry.context).toBeDefined();
      const contextStr = JSON.stringify(logEntry.context);
      expect(contextStr).toContain("***MASKED***");
      expect(contextStr).not.toContain("secret123");
    });

    it("should not mask data when masking is disabled", () => {
      loggerService.setMasking(false);

      const mockReq = {
        method: "POST",
        path: "/api/login",
        headers: {},
        ip: "192.168.1.1",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Login", "info", {
        password: "secret123",
      });

      expect(logEntry.context).toEqual({ password: "secret123" });
    });

    it("should use default log level when not provided", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {},
        ip: "192.168.1.1",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test message");

      expect(logEntry.level).toBe("info");
    });

    it("should handle missing authorization header", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {},
        ip: "192.168.1.1",
      } as unknown as Request;

      mockedJwt.decode.mockReturnValue(null);

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test");

      expect(logEntry.userId).toBeUndefined();
      expect(logEntry.sessionId).toBeUndefined();
    });
  });

  describe("getWithContext", () => {
    it("should return LogEntry with provided context", () => {
      const logEntry = loggerService.getWithContext(
        { operation: "sync", count: 10 },
        "Sync started",
        "info",
      );

      expect(logEntry).toBeDefined();
      expect(logEntry.message).toBe("Sync started");
      expect(logEntry.level).toBe("info");
      expect(logEntry.application).toBe("ctrl-dev-test-app");
      expect(logEntry.correlationId).toBeDefined();
      expect(logEntry.context).toEqual({ operation: "sync", count: 10 });
      expect(logEntry.timestamp).toBeDefined();
    });

    it("should generate correlation ID automatically", () => {
      const logEntry1 = loggerService.getWithContext({}, "Message 1");
      const logEntry2 = loggerService.getWithContext({}, "Message 2");

      expect(logEntry1.correlationId).toBeDefined();
      expect(logEntry2.correlationId).toBeDefined();
      expect(logEntry1.correlationId).not.toBe(logEntry2.correlationId);
    });

    it("should mask sensitive data in context by default", () => {
      const logEntry = loggerService.getWithContext(
        { password: "secret", apiKey: "key123" },
        "Test",
      );

      const contextStr = JSON.stringify(logEntry.context);
      expect(contextStr).toContain("***MASKED***");
      expect(contextStr).not.toContain("secret");
      expect(contextStr).not.toContain("key123");
    });

    it("should use default log level when not provided", () => {
      const logEntry = loggerService.getWithContext({}, "Test message");

      expect(logEntry.level).toBe("info");
    });

    it("should include metadata from environment", () => {
      const logEntry = loggerService.getWithContext({}, "Test");

      expect(logEntry.environment).toBe("unknown");
      expect(logEntry.application).toBe("ctrl-dev-test-app");
    });
  });

  describe("getForRequest", () => {
    it("should return LogEntry (alias for getLogWithRequest)", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {
          "x-correlation-id": "test-correlation",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      mockedJwt.decode.mockReturnValue({ sub: "user-123" });

      const logEntry = loggerService.getForRequest(mockReq, "Test message", "info", {
        test: "data",
      });

      expect(logEntry).toBeDefined();
      expect(logEntry.message).toBe("Test message");
      expect(logEntry.level).toBe("info");
      expect(logEntry.correlationId).toBe("test-correlation");
      expect(logEntry.context).toEqual({ test: "data" });
    });

    it("should behave identically to getLogWithRequest", () => {
      const mockReq = {
        method: "POST",
        path: "/api/users",
        headers: {
          "x-correlation-id": "corr-123",
          "user-agent": "TestAgent",
        },
        ip: "192.168.1.1",
      } as unknown as Request;

      mockedJwt.decode.mockReturnValue({ sub: "user-456" });

      const logEntry1 = loggerService.getLogWithRequest(mockReq, "Test", "info", {
        data: "value",
      });
      const logEntry2 = loggerService.getForRequest(mockReq, "Test", "info", {
        data: "value",
      });

      // Should produce identical results (except timestamp which will differ)
      expect(logEntry1.message).toBe(logEntry2.message);
      expect(logEntry1.level).toBe(logEntry2.level);
      expect(logEntry1.correlationId).toBe(logEntry2.correlationId);
      expect(logEntry1.userId).toBe(logEntry2.userId);
      expect(logEntry1.context).toEqual(logEntry2.context);
    });
  });

  describe("log level handling", () => {
    it("should accept all valid log levels", () => {
      const levels: LogEntry["level"][] = [
        "debug",
        "info",
        "warn",
        "error",
        "audit",
      ];

      levels.forEach((level) => {
        const logEntry = loggerService.getWithContext({}, "Test", level);
        expect(logEntry.level).toBe(level);
      });
    });
  });

  describe("edge cases", () => {
    it("should handle empty context object", () => {
      const logEntry = loggerService.getWithContext({}, "Test");

      expect(logEntry.context).toEqual({});
    });

    it("should handle undefined context", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {},
        ip: "192.168.1.1",
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test");

      expect(logEntry.context).toBeUndefined();
    });

    it("should handle empty message", () => {
      const logEntry = loggerService.getWithContext({}, "");

      expect(logEntry.message).toBe("");
    });

    it("should handle proxy headers for IP extraction", () => {
      const mockReq = {
        method: "GET",
        path: "/api/test",
        headers: {
          "x-forwarded-for": "203.0.113.1",
        },
        ip: "192.168.1.1",
        socket: {
          remoteAddress: "192.168.1.1",
        },
      } as unknown as Request;

      const logEntry = loggerService.getLogWithRequest(mockReq, "Test");

      // Should extract IP from x-forwarded-for if available
      expect(logEntry.ipAddress).toBeDefined();
    });
  });
});
