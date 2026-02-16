/**
 * Unit tests for AuditLogQueue
 */

import { EventEmitter } from "events";
import { AuditLogQueue } from "../../src/utils/audit-log-queue";
import { HttpClient } from "../../src/utils/http-client";
import { RedisService } from "../../src/services/redis.service";
import { MisoClientConfig, LogEntry } from "../../src/types/config.types";

// Mock HttpClient
jest.mock("../../src/utils/http-client");
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock("../../src/services/redis.service");
const MockedRedisService = RedisService as jest.MockedClass<
  typeof RedisService
>;

describe("AuditLogQueue", () => {
  let auditLogQueue: AuditLogQueue;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    jest.useFakeTimers();

    config = {
      controllerUrl: "https://controller.aifabrix.ai",
      clientId: "ctrl-dev-test-app",
      clientSecret: "test-secret",
      audit: {
        batchSize: 10,
        batchInterval: 100,
      },
    };

    mockHttpClient = {
      request: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<HttpClient>;
    const httpClientWithConfig = mockHttpClient as jest.Mocked<HttpClient> & {
      config: MisoClientConfig;
    };
    httpClientWithConfig.config = config;

    mockRedisService = {
      isConnected: jest.fn().mockReturnValue(false),
      rpush: jest.fn().mockResolvedValue(true),
    } as unknown as jest.Mocked<RedisService>;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    auditLogQueue = new AuditLogQueue(mockHttpClient, mockRedisService, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();

    // Clean up process listeners to prevent memory leak warnings
    if (typeof process !== "undefined") {
      process.removeAllListeners("SIGINT");
      process.removeAllListeners("SIGTERM");
      process.removeAllListeners("beforeExit");
    }
  });

  const createLogEntry = (message: string = "Test log"): LogEntry => ({
    timestamp: new Date().toISOString(),
    level: "audit",
    environment: "test",
    application: config.clientId,
    applicationId: "",
    message,
  });

  describe("add", () => {
    it("should add log entry to queue", async () => {
      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      expect(auditLogQueue.getQueueSize()).toBe(1);
    });

    it("should flush when batch size is reached", async () => {
      config.audit!.batchSize = 3;
      auditLogQueue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        config,
      );

      const entries = [
        createLogEntry("1"),
        createLogEntry("2"),
        createLogEntry("3"),
      ];

      for (const entry of entries) {
        await auditLogQueue.add(entry);
      }

      // Wait for flush to complete
      await Promise.resolve();

      expect(auditLogQueue.getQueueSize()).toBe(0);
      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs/batch",
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({ message: "1" }),
            expect.objectContaining({ message: "2" }),
            expect.objectContaining({ message: "3" }),
          ]),
        }),
      );
    });

    it("should setup flush timer when adding first entry", async () => {
      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      // Timer should be set
      expect(jest.getTimerCount()).toBe(1);
    });

    it("should flush after batch interval", async () => {
      config.audit!.batchInterval = 100;
      auditLogQueue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        config,
      );

      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      // Fast-forward time and wait for async flush to complete
      await jest.advanceTimersByTimeAsync(100);

      expect(auditLogQueue.getQueueSize()).toBe(0);
      expect(mockHttpClient.request).toHaveBeenCalled();
    });
  });

  describe("flush", () => {
    it("should flush empty queue without errors", async () => {
      await expect(auditLogQueue.flush()).resolves.not.toThrow();
    });

    it("should flush queue via Redis when connected", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      await auditLogQueue.flush();

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        `audit-logs:${config.clientId}`,
        expect.stringContaining(entry.message),
      );
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should fallback to HTTP when Redis push fails", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(false);

      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      await auditLogQueue.flush();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs/batch",
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({ message: entry.message }),
          ]),
        }),
      );
    });

    it("should fallback to HTTP when Redis is not connected", async () => {
      mockRedisService.isConnected.mockReturnValue(false);

      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      await auditLogQueue.flush();

      expect(mockHttpClient.request).toHaveBeenCalled();
      expect(mockRedisService.rpush).not.toHaveBeenCalled();
    });

    it("should handle HTTP errors gracefully", async () => {
      mockHttpClient.request.mockRejectedValue(new Error("Network error"));

      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      // Should not throw
      await expect(auditLogQueue.flush()).resolves.not.toThrow();
    });

    it("should clear flush timer when flushing", async () => {
      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      expect(jest.getTimerCount()).toBe(1);

      await auditLogQueue.flush();

      expect(jest.getTimerCount()).toBe(0);
    });

    it("should not flush if already flushing", async () => {
      const entry1 = createLogEntry("1");

      await auditLogQueue.add(entry1);

      // Start flush but don't await
      const flushPromise = auditLogQueue.flush();

      // Try to flush again immediately (should be ignored)
      await auditLogQueue.flush();

      // Wait for first flush
      await flushPromise;

      // Should only flush once
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    });

    it("should remove environment and application fields from logs", async () => {
      const entry = createLogEntry();
      await auditLogQueue.add(entry);

      await auditLogQueue.flush();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs/batch",
        expect.objectContaining({
          logs: expect.arrayContaining([
            expect.objectContaining({
              environment: undefined,
              application: undefined,
            }),
          ]),
        }),
      );
    });
  });

  describe("getQueueSize", () => {
    it("should return 0 for empty queue", () => {
      expect(auditLogQueue.getQueueSize()).toBe(0);
    });

    it("should return correct queue size", async () => {
      await auditLogQueue.add(createLogEntry("1"));
      expect(auditLogQueue.getQueueSize()).toBe(1);

      await auditLogQueue.add(createLogEntry("2"));
      expect(auditLogQueue.getQueueSize()).toBe(2);

      await auditLogQueue.flush();
      expect(auditLogQueue.getQueueSize()).toBe(0);
    });
  });

  describe("clear", () => {
    it("should clear queue", async () => {
      await auditLogQueue.add(createLogEntry("1"));
      await auditLogQueue.add(createLogEntry("2"));

      expect(auditLogQueue.getQueueSize()).toBe(2);

      auditLogQueue.clear();

      expect(auditLogQueue.getQueueSize()).toBe(0);
    });

    it("should clear flush timer", async () => {
      await auditLogQueue.add(createLogEntry());

      expect(jest.getTimerCount()).toBe(1);

      auditLogQueue.clear();

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe("default configuration", () => {
    it("should use default batch size when not configured", () => {
      const configWithoutBatch: MisoClientConfig = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "test",
        clientSecret: "secret",
      };

      const queue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        configWithoutBatch,
      );

      // Should use default batch size (10)
      for (let i = 0; i < 9; i++) {
        queue.add(createLogEntry(`entry-${i}`));
      }

      expect(queue.getQueueSize()).toBe(9);

      // 10th entry should trigger flush
      queue.add(createLogEntry("entry-10"));
    });

    it("should use default batch interval when not configured", async () => {
      const configWithoutInterval: MisoClientConfig = {
        controllerUrl: "https://controller.aifabrix.ai",
        clientId: "test",
        clientSecret: "secret",
        audit: {
          batchSize: 10,
        },
      };

      const queue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        configWithoutInterval,
      );

      await queue.add(createLogEntry());

      // Should use default interval (100ms)
      await jest.advanceTimersByTimeAsync(100);

      expect(mockHttpClient.request).toHaveBeenCalled();
    });
  });

  describe("graceful shutdown", () => {
    it("should setup process handlers in Node.js environment", () => {
      const originalProcess = global.process;

      const mockProcess = {
        on: jest.fn(),
      } as unknown as NodeJS.Process;

      // Temporarily replace process
      const globalWithProcess = global as typeof global & {
        process: NodeJS.Process;
      };
      globalWithProcess.process = mockProcess;

      new AuditLogQueue(mockHttpClient, mockRedisService, config);

      expect(mockProcess.on).toHaveBeenCalledWith(
        "SIGINT",
        expect.any(Function),
      );
      expect(mockProcess.on).toHaveBeenCalledWith(
        "SIGTERM",
        expect.any(Function),
      );
      expect(mockProcess.on).toHaveBeenCalledWith(
        "beforeExit",
        expect.any(Function),
      );

      // Restore original process
      globalWithProcess.process = originalProcess;
    });
  });

  describe("multiple logs", () => {
    it("should batch multiple logs correctly", async () => {
      const entries = Array.from({ length: 5 }, (_, i) =>
        createLogEntry(`Log ${i}`),
      );

      for (const entry of entries) {
        await auditLogQueue.add(entry);
      }

      await auditLogQueue.flush();

      expect(mockHttpClient.request).toHaveBeenCalledWith(
        "POST",
        "/api/v1/logs/batch",
        expect.objectContaining({
          logs: expect.arrayContaining(
            entries.map((e) => expect.objectContaining({ message: e.message })),
          ),
        }),
      );
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    });

    it("should handle large batches", async () => {
      config.audit!.batchSize = 50;
      auditLogQueue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        config,
      );

      const entries = Array.from({ length: 50 }, (_, i) =>
        createLogEntry(`Log ${i}`),
      );

      for (const entry of entries) {
        await auditLogQueue.add(entry);
      }

      // Wait for auto-flush
      await Promise.resolve();

      expect(auditLogQueue.getQueueSize()).toBe(0);
      expect(mockHttpClient.request).toHaveBeenCalledTimes(1);
    });

    it("should preserve per-entry fields in HTTP batch payload", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      const entry1: LogEntry = {
        ...createLogEntry("Log 1"),
        applicationId: "app-1",
        userId: "user-1",
        sessionId: "session-1",
        requestId: "req-1",
        correlationId: "corr-1",
        ipAddress: "10.0.0.1",
        userAgent: "UnitTest/1.0",
        hostname: "host-1",
        context: { action: "sync", requestPath: "/api/users" },
        requestSize: 120,
        responseSize: 240,
        durationMs: 180,
        errorCategory: "network",
        httpStatusCategory: "5xx",
        stackTrace: "stack-trace-1",
        sourceKey: "source-1",
        recordKey: "record-1",
      };
      const entry2: LogEntry = {
        ...createLogEntry("Log 2"),
        applicationId: "app-2",
        userId: "user-2",
        sessionId: "session-2",
        requestId: "req-2",
        correlationId: "corr-2",
        ipAddress: "10.0.0.2",
        userAgent: "UnitTest/2.0",
        hostname: "host-2",
        context: { action: "delete", requestPath: "/api/records/2" },
        requestSize: 320,
        responseSize: 640,
        durationMs: 380,
        errorCategory: "validation",
        httpStatusCategory: "4xx",
        stackTrace: "stack-trace-2",
        sourceKey: "source-2",
        recordKey: "record-2",
      };

      await auditLogQueue.add(entry1);
      await auditLogQueue.add(entry2);
      await auditLogQueue.flush();

      const payload = (mockHttpClient.request as jest.Mock).mock.calls[0]?.[2] as {
        logs: LogEntry[];
      };
      expect(payload.logs).toHaveLength(2);

      const first = payload.logs[0];
      expect(first.userId).toBe("user-1");
      expect(first.sessionId).toBe("session-1");
      expect(first.requestId).toBe("req-1");
      expect(first.correlationId).toBe("corr-1");
      expect(first.ipAddress).toBe("10.0.0.1");
      expect(first.userAgent).toBe("UnitTest/1.0");
      expect(first.hostname).toBe("host-1");
      expect(first.applicationId).toBe("app-1");
      expect(first.context).toMatchObject({
        action: "sync",
        requestPath: "/api/users",
      });
      expect(first.requestSize).toBe(120);
      expect(first.responseSize).toBe(240);
      expect(first.durationMs).toBe(180);
      expect(first.errorCategory).toBe("network");
      expect(first.httpStatusCategory).toBe("5xx");
      expect(first.stackTrace).toBe("stack-trace-1");
      expect(first.sourceKey).toBe("source-1");
      expect(first.recordKey).toBe("record-1");
    });
  });

  describe("event emission (emitEvents mode)", () => {
    let eventEmitter: EventEmitter;

    beforeEach(() => {
      eventEmitter = new EventEmitter();
      config.emitEvents = true;
      const httpClientWithConfig = mockHttpClient as jest.Mocked<HttpClient> & {
        config: MisoClientConfig;
      };
      httpClientWithConfig.config = config;
      auditLogQueue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        config,
        eventEmitter,
      );
    });

    it("should emit log:batch event when emitEvents is true", async () => {
      const eventSpy = jest.fn();
      eventEmitter.on("log:batch", eventSpy);

      const entries = [createLogEntry("Log 1"), createLogEntry("Log 2")];

      for (const entry of entries) {
        await auditLogQueue.add(entry);
      }

      await auditLogQueue.flush();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedBatch = eventSpy.mock.calls[0][0];
      expect(Array.isArray(emittedBatch)).toBe(true);
      expect(emittedBatch.length).toBe(2);
      expect(emittedBatch[0]).toMatchObject({ message: "Log 1" });
      expect(emittedBatch[1]).toMatchObject({ message: "Log 2" });
    });

    it("should skip Redis when emitEvents is true", async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      const eventSpy = jest.fn();
      eventEmitter.on("log:batch", eventSpy);

      await auditLogQueue.add(createLogEntry("Test"));
      await auditLogQueue.flush();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(mockRedisService.rpush).not.toHaveBeenCalled();
    });

    it("should skip HTTP when emitEvents is true", async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      const eventSpy = jest.fn();
      eventEmitter.on("log:batch", eventSpy);

      await auditLogQueue.add(createLogEntry("Test"));
      await auditLogQueue.flush();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should emit batch events with correct payload structure", async () => {
      const eventSpy = jest.fn();
      eventEmitter.on("log:batch", eventSpy);

      const entries = [
        createLogEntry("Log 1"),
        createLogEntry("Log 2"),
        createLogEntry("Log 3"),
      ];

      for (const entry of entries) {
        await auditLogQueue.add(entry);
      }

      await auditLogQueue.flush();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      const emittedBatch = eventSpy.mock.calls[0][0];
      expect(Array.isArray(emittedBatch)).toBe(true);
      expect(emittedBatch.length).toBe(3);

      // Each entry should have LogEntry structure
      emittedBatch.forEach((entry: LogEntry) => {
        expect(entry).toHaveProperty("timestamp");
        expect(entry).toHaveProperty("level", "audit");
        expect(entry).toHaveProperty("environment", "test");
        expect(entry).toHaveProperty("application", "ctrl-dev-test-app");
        expect(entry).toHaveProperty("message");
      });
    });

    it("should preserve per-entry fields in emitted batches", async () => {
      const eventSpy = jest.fn();
      eventEmitter.on("log:batch", eventSpy);

      const entry1: LogEntry = {
        ...createLogEntry("Log 1"),
        applicationId: "app-1",
        userId: "user-1",
        sessionId: "session-1",
        requestId: "req-1",
        correlationId: "corr-1",
        ipAddress: "10.0.0.1",
        userAgent: "UnitTest/1.0",
        hostname: "host-1",
        context: { action: "sync", requestPath: "/api/users" },
        requestSize: 120,
        responseSize: 240,
        durationMs: 180,
        errorCategory: "network",
        httpStatusCategory: "5xx",
        stackTrace: "stack-trace-1",
      };
      const entry2: LogEntry = {
        ...createLogEntry("Log 2"),
        applicationId: "app-2",
        userId: "user-2",
        sessionId: "session-2",
        requestId: "req-2",
        correlationId: "corr-2",
        ipAddress: "10.0.0.2",
        userAgent: "UnitTest/2.0",
        hostname: "host-2",
        context: { action: "delete", requestPath: "/api/records/2" },
        requestSize: 320,
        responseSize: 640,
        durationMs: 380,
        errorCategory: "validation",
        httpStatusCategory: "4xx",
        stackTrace: "stack-trace-2",
      };

      await auditLogQueue.add(entry1);
      await auditLogQueue.add(entry2);
      await auditLogQueue.flush();

      const emittedBatch = eventSpy.mock.calls[0]?.[0] as LogEntry[];
      expect(emittedBatch).toHaveLength(2);
      expect(emittedBatch[0]).toMatchObject({
        userId: "user-1",
        sessionId: "session-1",
        requestId: "req-1",
        correlationId: "corr-1",
        ipAddress: "10.0.0.1",
        userAgent: "UnitTest/1.0",
        hostname: "host-1",
        applicationId: "app-1",
        requestSize: 120,
        responseSize: 240,
        durationMs: 180,
        errorCategory: "network",
        httpStatusCategory: "5xx",
        stackTrace: "stack-trace-1",
      });
      expect(emittedBatch[1]).toMatchObject({
        userId: "user-2",
        sessionId: "session-2",
        requestId: "req-2",
        correlationId: "corr-2",
        ipAddress: "10.0.0.2",
        userAgent: "UnitTest/2.0",
        hostname: "host-2",
        applicationId: "app-2",
        requestSize: 320,
        responseSize: 640,
        durationMs: 380,
        errorCategory: "validation",
        httpStatusCategory: "4xx",
        stackTrace: "stack-trace-2",
      });
    });

    it("should batch events correctly when batch size is reached", async () => {
      config.audit!.batchSize = 3;
      auditLogQueue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        config,
        eventEmitter,
      );

      const eventSpy = jest.fn();
      eventEmitter.on("log:batch", eventSpy);

      const entries = [
        createLogEntry("Log 1"),
        createLogEntry("Log 2"),
        createLogEntry("Log 3"),
      ];

      for (const entry of entries) {
        await auditLogQueue.add(entry);
      }

      // Wait for auto-flush
      await Promise.resolve();

      expect(eventSpy).toHaveBeenCalledTimes(1);
      expect(eventSpy.mock.calls[0][0].length).toBe(3);
      expect(mockHttpClient.request).not.toHaveBeenCalled();
    });

    it("should maintain backward compatibility when emitEvents is false", async () => {
      config.emitEvents = false;
      const httpClientWithConfig = mockHttpClient as jest.Mocked<HttpClient> & {
        config: MisoClientConfig;
      };
      httpClientWithConfig.config = config;
      auditLogQueue = new AuditLogQueue(
        mockHttpClient,
        mockRedisService,
        config,
      );

      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const eventSpy = jest.fn();
      const tempEmitter = new EventEmitter();
      tempEmitter.on("log:batch", eventSpy);

      await auditLogQueue.add(createLogEntry("Test"));
      await auditLogQueue.flush();

      // Should use Redis/HTTP, not emit events
      expect(mockRedisService.rpush).toHaveBeenCalled();
      expect(eventSpy).not.toHaveBeenCalled();
    });
  });
});
