/**
 * Unit tests for RedisService
 */

import { RedisService } from "../../src/services/redis.service";
import { RedisConfig } from "../../src/types/config.types";

// Mock ioredis
const mockRedis = {
  connect: jest.fn(),
  disconnect: jest.fn(),
  get: jest.fn(),
  setex: jest.fn(),
  del: jest.fn(),
  rpush: jest.fn(),
};

jest.mock("ioredis", () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// Mock console methods to avoid test output noise
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

describe("RedisService", () => {
  let redisService: RedisService;
  let config: RedisConfig;

  beforeEach(() => {
    config = {
      host: "localhost",
      port: 6379,
      password: "password",
      db: 0,
      keyPrefix: "test:",
    };
    redisService = new RedisService(config);
    jest.clearAllMocks();
  });

  describe("Connection", () => {
    it("should connect to Redis successfully", async () => {
      mockRedis.connect.mockResolvedValue(undefined);

      await redisService.connect();

      expect(mockRedis.connect).toHaveBeenCalled();
      expect(redisService.isConnected()).toBe(true);
    });

    it("should handle connection failure", async () => {
      mockRedis.connect.mockRejectedValue(new Error("Connection failed"));

      await expect(redisService.connect()).rejects.toThrow("Connection failed");
      expect(redisService.isConnected()).toBe(false);
    });

    it("should disconnect from Redis", async () => {
      // First connect to Redis
      mockRedis.connect.mockResolvedValue(undefined);
      await redisService.connect();

      // Then disconnect
      mockRedis.disconnect.mockResolvedValue(undefined);

      await redisService.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalled();
      expect(redisService.isConnected()).toBe(false);
    });

    it("should handle missing Redis config gracefully", async () => {
      const serviceWithoutRedis = new RedisService(undefined);

      await serviceWithoutRedis.connect();
      expect(serviceWithoutRedis.isConnected()).toBe(false);
    });
  });

  describe("Cache Operations", () => {
    beforeEach(async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      await redisService.connect();
    });

    it("should get value from Redis", async () => {
      const testValue = "test-value";
      mockRedis.get.mockResolvedValue(testValue);

      const result = await redisService.get("test-key");

      expect(mockRedis.get).toHaveBeenCalledWith("test-key");
      expect(result).toBe(testValue);
    });

    it("should return null when key does not exist", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await redisService.get("non-existent-key");

      expect(result).toBeNull();
    });

    it("should set value with TTL", async () => {
      mockRedis.setex.mockResolvedValue("OK");

      const result = await redisService.set("test-key", "test-value", 300);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        "test-key",
        300,
        "test-value",
      );
      expect(result).toBe(true);
    });

    it("should delete key", async () => {
      mockRedis.del.mockResolvedValue(1);

      const result = await redisService.delete("test-key");

      expect(mockRedis.del).toHaveBeenCalledWith("test-key");
      expect(result).toBe(true);
    });

    it("should handle Redis errors gracefully", async () => {
      mockRedis.get.mockRejectedValue(new Error("Redis error"));

      const result = await redisService.get("test-key");

      expect(result).toBeNull();
    });
  });

  describe("Queue Operations", () => {
    beforeEach(async () => {
      mockRedis.connect.mockResolvedValue(undefined);
      await redisService.connect();
    });

    it("should push to queue", async () => {
      mockRedis.rpush.mockResolvedValue(1);

      const result = await redisService.rpush("test-queue", "test-message");

      expect(mockRedis.rpush).toHaveBeenCalledWith(
        "test-queue",
        "test-message",
      );
      expect(result).toBe(true);
    });

    it("should handle queue push errors", async () => {
      mockRedis.rpush.mockRejectedValue(new Error("Queue error"));

      const result = await redisService.rpush("test-queue", "test-message");

      expect(result).toBe(false);
    });
  });

  describe("Disconnected State", () => {
    it("should return false for operations when disconnected", async () => {
      const getResult = await redisService.get("test-key");
      const setResult = await redisService.set("test-key", "value", 300);
      const deleteResult = await redisService.delete("test-key");
      const pushResult = await redisService.rpush("queue", "message");

      expect(getResult).toBeNull();
      expect(setResult).toBe(false);
      expect(deleteResult).toBe(false);
      expect(pushResult).toBe(false);
    });
  });
});
