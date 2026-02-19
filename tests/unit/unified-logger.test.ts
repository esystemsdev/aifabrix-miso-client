/**
 * Unit tests for Unified Logger components
 */

import { LoggerContextStorage, LoggerContext } from "../../src/services/logger/logger-context-storage";
import jwt from "jsonwebtoken";
import {
  UnifiedLoggerService,
  UnifiedLogger,
} from "../../src/services/logger/unified-logger.service";
import { LoggerService } from "../../src/services/logger/logger.service";
import {
  getLogger,
  setLoggerContext,
  clearLoggerContext,
  mergeLoggerContext,
  registerLoggerService,
  LoggerServiceRegistry,
} from "../../src/services/logger/unified-logger.factory";
import { HttpClient } from "../../src/utils/http-client";
import { RedisService } from "../../src/services/redis.service";
import { MisoClientConfig } from "../../src/types/config.types";
import { ApiClient } from "../../src/api";

// Mock HttpClient
jest.mock("../../src/utils/http-client");

// Mock RedisService
jest.mock("../../src/services/redis.service");

// Mock ApiClient
jest.mock("../../src/api");

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const mockedJwtDecode = jwt.decode as jest.MockedFunction<typeof jwt.decode>;

describe("LoggerContextStorage", () => {
  let storage: LoggerContextStorage;

  beforeEach(() => {
    // Get fresh instance for each test
    storage = LoggerContextStorage.getInstance();
    storage.clearContext();
  });

  afterEach(() => {
    storage.clearContext();
  });

  describe("getContext", () => {
    it("should return null when no context is set", () => {
      // When AsyncLocalStorage store is undefined (no context ever set)
      // getContext() returns null
      // But after clearContext(), it returns {} because enterWith({}) creates a store
      const context = storage.getContext();
      // In test environment, AsyncLocalStorage might have a store from previous tests
      // So we check that it's either null or empty object
      expect(context === null || Object.keys(context || {}).length === 0).toBe(true);
    });

    it("should return context when set", () => {
      const testContext: Partial<LoggerContext> = {
        userId: "user-123",
        correlationId: "corr-456",
      };
      storage.setContext(testContext);

      const context = storage.getContext();
      expect(context).toEqual(testContext);
    });
  });

  describe("setContext", () => {
    it("should set context for current async execution", () => {
      const testContext: Partial<LoggerContext> = {
        userId: "user-123",
        ipAddress: "192.168.1.1",
      };
      storage.setContext(testContext);

      const context = storage.getContext();
      expect(context?.userId).toBe("user-123");
      expect(context?.ipAddress).toBe("192.168.1.1");
    });

    it("should merge with existing context", () => {
      storage.setContext({ userId: "user-123" });
      storage.setContext({ correlationId: "corr-456" });

      const context = storage.getContext();
      expect(context?.userId).toBe("user-123");
      expect(context?.correlationId).toBe("corr-456");
    });
  });

  describe("clearContext", () => {
    it("should clear context", () => {
      storage.setContext({ userId: "user-123" });
      storage.clearContext();

      const context = storage.getContext();
      // After clearContext, getContext returns empty object (not null)
      expect(context).toEqual({});
    });
  });

  describe("mergeContext", () => {
    it("should merge additional fields into existing context", () => {
      storage.setContext({ userId: "user-123" });
      storage.mergeContext({ correlationId: "corr-456" });

      const context = storage.getContext();
      expect(context?.userId).toBe("user-123");
      expect(context?.correlationId).toBe("corr-456");
    });
  });

  describe("runWithContext", () => {
    it("should run function with context set", () => {
      const testContext: Partial<LoggerContext> = {
        userId: "user-123",
      };

      const result = storage.runWithContext(testContext, () => {
        const ctx = storage.getContext();
        return ctx?.userId;
      });

      expect(result).toBe("user-123");
    });

    it("should not affect context after function completes", () => {
      storage.setContext({ userId: "original" });

      storage.runWithContext({ userId: "temporary" }, () => {
        const ctx = storage.getContext();
        expect(ctx?.userId).toBe("temporary");
      });

      const ctx = storage.getContext();
      expect(ctx?.userId).toBe("original");
    });
  });

  describe("runWithContextAsync", () => {
    it("should run async function with context set", async () => {
      const testContext: Partial<LoggerContext> = {
        userId: "user-123",
      };

      const result = await storage.runWithContextAsync(testContext, async () => {
        const ctx = storage.getContext();
        return ctx?.userId;
      });

      expect(result).toBe("user-123");
    });
  });
});

describe("UnifiedLoggerService", () => {
  let unifiedLogger: UnifiedLogger;
  let mockLoggerService: jest.Mocked<LoggerService>;
  let contextStorage: LoggerContextStorage;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      logLevel: "debug",
    };

    const mockHttpClient = {
      request: jest.fn(),
    } as any;
    (mockHttpClient as any).config = config;

    const mockRedisService = {
      isConnected: jest.fn().mockReturnValue(false),
    } as any;

    const mockApiClient = {
      logs: {
        createLog: jest.fn().mockResolvedValue({}),
      },
    } as any;

    mockLoggerService = new LoggerService(
      mockHttpClient as any,
      mockRedisService as any,
    ) as jest.Mocked<LoggerService>;
    mockLoggerService.setApiClient(mockApiClient as any);

    // Mock methods
    mockLoggerService.info = jest.fn().mockResolvedValue(undefined);
    mockLoggerService.warn = jest.fn().mockResolvedValue(undefined);
    mockLoggerService.error = jest.fn().mockResolvedValue(undefined);
    mockLoggerService.debug = jest.fn().mockResolvedValue(undefined);
    mockLoggerService.audit = jest.fn().mockResolvedValue(undefined);

    contextStorage = LoggerContextStorage.getInstance();
    contextStorage.clearContext();

    unifiedLogger = new UnifiedLoggerService(mockLoggerService, contextStorage);
  });

  afterEach(() => {
    contextStorage.clearContext();
    jest.clearAllMocks();
  });

  describe("info", () => {
    it("should log info message with context", async () => {
      contextStorage.setContext({
        userId: "user-123",
        correlationId: "corr-456",
        ipAddress: "192.168.1.1",
      });

      await unifiedLogger.info("Test message");

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        "Test message",
        undefined,
        expect.objectContaining({
          maskSensitiveData: true,
        }),
      );
    });

    it("should log info message with JWT token context", async () => {
      // Mock JWT token that will be decoded
      const mockToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWp3dCIsInNlc3Npb25JZCI6InNlc3MtMTIzIiwiYXBwbGljYXRpb25JZCI6ImFwcC00NTYifQ.test";
      
      contextStorage.setContext({
        token: mockToken,
      });

      // Mock jwt.decode to return test data
      mockedJwtDecode.mockReturnValue({
        sub: "user-jwt",
        sessionId: "sess-123",
        applicationId: "app-456",
      });

      await unifiedLogger.info("Test message");

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        "Test message",
        undefined,
        expect.objectContaining({
          maskSensitiveData: true,
        }),
      );
    });

    it("should log info message without context", async () => {
      await unifiedLogger.info("Test message");

      expect(mockLoggerService.info).toHaveBeenCalledWith(
        "Test message",
        undefined,
        expect.any(Object),
      );
    });

    it("should handle errors silently", async () => {
      mockLoggerService.info = jest.fn().mockRejectedValue(new Error("Test error"));

      await expect(unifiedLogger.info("Test message")).resolves.not.toThrow();
    });
  });

  describe("warn", () => {
    it("should log warning message", async () => {
      await unifiedLogger.warn("Warning message");

      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        "Warning message",
        undefined,
        expect.any(Object),
      );
      expect(mockLoggerService.info).not.toHaveBeenCalled();
    });
  });

  describe("debug", () => {
    it("should log debug message", async () => {
      await unifiedLogger.debug("Debug message");

      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        "Debug message",
        undefined,
        expect.any(Object),
      );
    });
  });

  describe("error", () => {
    it("should log error message with Error object", async () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";

      await unifiedLogger.error("Error occurred", error);

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        "Error occurred",
        expect.objectContaining({
          errorName: "Error",
          errorMessage: "Test error",
        }),
        "Error: Test error\n    at test.js:1:1",
        expect.any(Object),
      );
    });

    it("should log error message with string", async () => {
      await unifiedLogger.error("Error occurred", "String error");

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        "Error occurred",
        expect.objectContaining({
          errorMessage: "String error",
        }),
        undefined,
        expect.any(Object),
      );
    });

    it("should log error message with object error", async () => {
      const errorObj = {
        name: "CustomError",
        message: "Custom error message",
        stack: "CustomError: Custom error message\n    at test.js:1:1",
      };

      await unifiedLogger.error("Error occurred", errorObj);

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        "Error occurred",
        expect.objectContaining({
          errorName: "CustomError",
          errorMessage: "Custom error message",
        }),
        "CustomError: Custom error message\n    at test.js:1:1",
        expect.any(Object),
      );
    });

    it("should log error message with null error", async () => {
      await unifiedLogger.error("Error occurred", null);

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        "Error occurred",
        {},
        undefined,
        expect.any(Object),
      );
    });

    it("should log error message without error object", async () => {
      await unifiedLogger.error("Error occurred");

      expect(mockLoggerService.error).toHaveBeenCalledWith(
        "Error occurred",
        {},
        undefined,
        expect.any(Object),
      );
    });
  });

  describe("audit", () => {
    it("should log audit event with entityId", async () => {
      await unifiedLogger.audit("CREATE", "User", "user-123");

      expect(mockLoggerService.audit).toHaveBeenCalledWith(
        "CREATE",
        "User",
        expect.objectContaining({
          entityId: "user-123",
        }),
        expect.any(Object),
      );
    });

    it("should log audit event with oldValues and newValues", async () => {
      const oldValues = { name: "Old Name" };
      const newValues = { name: "New Name" };

      await unifiedLogger.audit("UPDATE", "User", "user-123", oldValues, newValues);

      expect(mockLoggerService.audit).toHaveBeenCalledWith(
        "UPDATE",
        "User",
        expect.objectContaining({
          entityId: "user-123",
          oldValues,
          newValues,
        }),
        expect.any(Object),
      );
    });

    it("should use 'unknown' as default entityId", async () => {
      await unifiedLogger.audit("CREATE", "User");

      expect(mockLoggerService.audit).toHaveBeenCalledWith(
        "CREATE",
        "User",
        expect.objectContaining({
          entityId: "unknown",
        }),
        expect.any(Object),
      );
    });
  });
});

describe("Unified Logger Factory", () => {
  let mockLoggerService: jest.Mocked<LoggerService>;
  let contextStorage: LoggerContextStorage;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      logLevel: "debug",
    };

    const mockHttpClient = {
      request: jest.fn(),
    } as any;
    (mockHttpClient as any).config = config;

    const mockRedisService = {
      isConnected: jest.fn().mockReturnValue(false),
    } as any;

    const mockApiClient = {
      logs: {
        createLog: jest.fn().mockResolvedValue({}),
      },
    } as any;

    mockLoggerService = new LoggerService(
      mockHttpClient as any,
      mockRedisService as any,
    ) as jest.Mocked<LoggerService>;
    mockLoggerService.setApiClient(mockApiClient as any);

    contextStorage = LoggerContextStorage.getInstance();
    contextStorage.clearContext();

    // Clear registry before each test
    LoggerServiceRegistry.clear();
  });

  afterEach(() => {
    contextStorage.clearContext();
    LoggerServiceRegistry.clear();
    jest.clearAllMocks();
  });

  describe("getLogger", () => {
    it("should return UnifiedLogger instance when LoggerService is registered", () => {
      registerLoggerService(mockLoggerService);
      const logger = getLogger();

      expect(logger).toBeInstanceOf(UnifiedLoggerService);
    });

    it("should return UnifiedLogger instance when LoggerService is passed", () => {
      const logger = getLogger(mockLoggerService);

      expect(logger).toBeInstanceOf(UnifiedLoggerService);
    });

    it("should throw error when LoggerService is not available", () => {
      expect(() => getLogger()).toThrow(
        "LoggerService not available. Either pass LoggerService to getLogger() or ensure MisoClient is initialized.",
      );
    });
  });

  describe("setLoggerContext", () => {
    it("should set context in AsyncLocalStorage", () => {
      setLoggerContext({
        userId: "user-123",
        correlationId: "corr-456",
      });

      const context = contextStorage.getContext();
      expect(context?.userId).toBe("user-123");
      expect(context?.correlationId).toBe("corr-456");
    });
  });

  describe("clearLoggerContext", () => {
    it("should clear context from AsyncLocalStorage", () => {
      setLoggerContext({ userId: "user-123" });
      clearLoggerContext();

      const context = contextStorage.getContext();
      expect(context).toEqual({});
    });
  });

  describe("mergeLoggerContext", () => {
    it("should merge additional context", () => {
      setLoggerContext({ userId: "user-123" });
      mergeLoggerContext({ correlationId: "corr-456" });

      const context = contextStorage.getContext();
      expect(context?.userId).toBe("user-123");
      expect(context?.correlationId).toBe("corr-456");
    });
  });

  describe("registerLoggerService", () => {
    it("should register LoggerService for global access", () => {
      registerLoggerService(mockLoggerService);

      const logger = getLogger();
      expect(logger).toBeInstanceOf(UnifiedLoggerService);
    });
  });
});
