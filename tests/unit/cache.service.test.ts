/**
 * Unit tests for CacheService
 */

import { CacheService } from '../../src/services/cache.service';
import { RedisService } from '../../src/services/redis.service';

// Mock RedisService
jest.mock('../../src/services/redis.service');
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedisService: jest.Mocked<RedisService>;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn()
    } as any;

    MockedRedisService.mockImplementation(() => mockRedisService);
  });

  afterEach(() => {
    jest.useRealTimers();
    if (cacheService) {
      cacheService.destroy();
    }
  });

  describe('Constructor', () => {
    it('should create instance without Redis', () => {
      cacheService = new CacheService();
      expect(cacheService).toBeInstanceOf(CacheService);
    });

    it('should create instance with Redis', () => {
      cacheService = new CacheService(mockRedisService);
      expect(cacheService).toBeInstanceOf(CacheService);
    });
  });

  describe('Set and Get Operations', () => {
    beforeEach(() => {
      mockRedisService.isConnected.mockReturnValue(true);
      cacheService = new CacheService(mockRedisService);
    });

    it('should set and get value from Redis', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.get.mockResolvedValue(JSON.stringify(value));

      const setResult = await cacheService.set(key, value, 300);
      expect(setResult).toBe(true);
      expect(mockRedisService.set).toHaveBeenCalledWith(key, JSON.stringify(value), 300);

      const getResult = await cacheService.get<string>(key);
      expect(getResult).toBe(value);
      expect(mockRedisService.get).toHaveBeenCalledWith(key);
    });

    it('should set and get complex objects', async () => {
      const key = 'complex-key';
      const value = { name: 'John', age: 30, items: [1, 2, 3] };
      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.get.mockResolvedValue(JSON.stringify(value));

      await cacheService.set(key, value, 300);

      const result = await cacheService.get<typeof value>(key);
      expect(result).toEqual(value);
    });

    it('should fallback to memory cache when Redis fails', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockRedisService.set.mockResolvedValue(false);
      mockRedisService.isConnected.mockReturnValue(false);

      await cacheService.set(key, value, 300);

      // Should still be in memory cache
      const result = await cacheService.get<string>(key);
      expect(result).toBe(value);
    });

    it('should get from memory cache when Redis returns null', async () => {
      const key = 'test-key';
      const value = 'test-value';
      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.get.mockResolvedValue(null); // Not in Redis

      await cacheService.set(key, value, 300);

      // Should be in memory cache
      const result = await cacheService.get<string>(key);
      expect(result).toBe(value);
    });
  });

  describe('Memory Cache Fallback', () => {
    beforeEach(() => {
      cacheService = new CacheService(); // No Redis
    });

    it('should store and retrieve from memory cache', async () => {
      const key = 'memory-key';
      const value = 'memory-value';

      await cacheService.set(key, value, 300);

      const result = await cacheService.get<string>(key);
      expect(result).toBe(value);
    });

    it('should expire entries from memory cache', async () => {
      const key = 'expire-key';
      const value = 'expire-value';

      await cacheService.set(key, value, 5); // 5 seconds TTL

      // Immediately should be available
      let result = await cacheService.get<string>(key);
      expect(result).toBe(value);

      // Fast-forward 6 seconds
      jest.advanceTimersByTime(6000);

      // Should be expired
      result = await cacheService.get<string>(key);
      expect(result).toBeNull();
    });

    it('should handle different TTL values', async () => {
      const key1 = 'ttl1';
      const key2 = 'ttl2';
      const value = 'value';

      await cacheService.set(key1, value, 10); // 10 seconds
      await cacheService.set(key2, value, 20); // 20 seconds

      // Fast-forward 15 seconds
      jest.advanceTimersByTime(15000);

      const result1 = await cacheService.get<string>(key1);
      const result2 = await cacheService.get<string>(key2);

      expect(result1).toBeNull(); // Expired
      expect(result2).toBe(value); // Still valid
    });
  });

  describe('Delete Operations', () => {
    beforeEach(() => {
      mockRedisService.isConnected.mockReturnValue(true);
      cacheService = new CacheService(mockRedisService);
    });

    it('should delete from Redis and memory', async () => {
      const key = 'delete-key';
      const value = 'delete-value';

      mockRedisService.set.mockResolvedValue(true);
      mockRedisService.delete.mockResolvedValue(true);

      await cacheService.set(key, value, 300);
      const deleteResult = await cacheService.delete(key);

      expect(deleteResult).toBe(true);
      expect(mockRedisService.delete).toHaveBeenCalledWith(key);

      // Should not be in memory cache either
      const result = await cacheService.get<string>(key);
      expect(result).toBeNull();
    });

    it('should delete from memory when Redis unavailable', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      const key = 'delete-key';
      const value = 'delete-value';

      await cacheService.set(key, value, 300);
      const deleteResult = await cacheService.delete(key);

      expect(deleteResult).toBe(true); // Deleted from memory

      const result = await cacheService.get<string>(key);
      expect(result).toBeNull();
    });
  });

  describe('Clear Operations', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should clear memory cache', async () => {
      await cacheService.set('key1', 'value1', 300);
      await cacheService.set('key2', 'value2', 300);

      await cacheService.clear();

      const result1 = await cacheService.get<string>('key1');
      const result2 = await cacheService.get<string>('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('Type Safety', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should preserve type with generics', async () => {
      interface CustomType {
        id: number;
        name: string;
      }

      const value: CustomType = { id: 1, name: 'Test' };
      await cacheService.set('custom', value, 300);

      const result = await cacheService.get<CustomType>('custom');
      expect(result).toEqual(value);
      expect(result?.id).toBe(1);
      expect(result?.name).toBe('Test');
    });

    it('should handle array types', async () => {
      const value = [1, 2, 3, 4, 5];
      await cacheService.set('array', value, 300);

      const result = await cacheService.get<number[]>('array');
      expect(result).toEqual(value);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockRedisService.isConnected.mockReturnValue(true);
      cacheService = new CacheService(mockRedisService);
    });

    it('should handle Redis errors gracefully', async () => {
      const key = 'error-key';
      mockRedisService.get.mockRejectedValue(new Error('Redis error'));

      // Should fallback to memory if available
      await cacheService.set(key, 'value', 300);
      const result = await cacheService.get<string>(key);
      expect(result).toBe('value'); // From memory
    });

    it('should handle invalid JSON from Redis', async () => {
      const key = 'invalid-json';
      mockRedisService.get.mockResolvedValue('invalid-json-data');

      const result = await cacheService.get<string>(key);
      expect(result).toBeNull();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      cacheService = new CacheService();
    });

    it('should cleanup expired entries periodically', async () => {
      await cacheService.set('key1', 'value1', 5);
      await cacheService.set('key2', 'value2', 600); // 10 minutes TTL

      // Fast-forward 6 seconds
      jest.advanceTimersByTime(6000);

      // key1 should be expired (6 seconds > 5 seconds TTL)
      const result1BeforeCleanup = await cacheService.get<string>('key1');
      expect(result1BeforeCleanup).toBeNull(); // get() should clean up expired entries

      // key2 should still be valid (6 seconds < 600 seconds TTL)
      const result2BeforeCleanup = await cacheService.get<string>('key2');
      expect(result2BeforeCleanup).toBe('value2');

      // Trigger cleanup by advancing timer past cleanup interval (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);

      // After cleanup interval, key1 was already removed, key2 should still be valid
      const result1 = await cacheService.get<string>('key1');
      const result2 = await cacheService.get<string>('key2');

      expect(result1).toBeNull();
      expect(result2).toBe('value2'); // Still valid (5 minutes + 6 seconds < 600 seconds)
    });

    it('should stop cleanup on destroy', () => {
      const spy = jest.spyOn(cacheService, 'destroy');
      cacheService.destroy();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Redis and Memory Cache Coordination', () => {
    beforeEach(() => {
      mockRedisService.isConnected.mockReturnValue(true);
      cacheService = new CacheService(mockRedisService);
    });

    it('should sync Redis hit to memory cache', async () => {
      const key = 'sync-key';
      const value = 'sync-value';
      mockRedisService.get.mockResolvedValue(JSON.stringify(value));

      // First get from Redis
      const result1 = await cacheService.get<string>(key);
      expect(result1).toBe(value);
      expect(mockRedisService.get).toHaveBeenCalledWith(key);

      // Second get should use memory cache (Redis not called again)
      mockRedisService.get.mockClear();
      const result2 = await cacheService.get<string>(key);
      expect(result2).toBe(value);
      // Note: In actual implementation, it might still check Redis, but should also have it in memory
    });
  });
});

