/**
 * Unit tests for LoggerService
 */

import { LoggerService } from '../../src/services/logger.service';
import { HttpClient } from '../../src/utils/http-client';
import { RedisService } from '../../src/services/redis.service';
import { MisoClientConfig } from '../../src/types/config.types';

// Mock HttpClient
jest.mock('../../src/utils/http-client');
const MockedHttpClient = HttpClient as jest.MockedClass<typeof HttpClient>;

// Mock RedisService
jest.mock('../../src/services/redis.service');
const MockedRedisService = RedisService as jest.MockedClass<typeof RedisService>;

describe('LoggerService', () => {
  let loggerService: LoggerService;
  let mockHttpClient: jest.Mocked<HttpClient>;
  let mockRedisService: jest.Mocked<RedisService>;
  let config: MisoClientConfig;

  beforeEach(() => {
    config = {
      controllerUrl: 'https://controller.aifabrix.ai',
      environment: 'dev',
      applicationKey: 'test-app',
      applicationId: 'test-app-id-123',
      logLevel: 'debug'
    };

    mockHttpClient = {
      post: jest.fn()
    } as any;

    mockRedisService = {
      isConnected: jest.fn(),
      rpush: jest.fn()
    } as any;

    MockedHttpClient.mockImplementation(() => mockHttpClient);
    MockedRedisService.mockImplementation(() => mockRedisService);

    loggerService = new LoggerService(config, mockRedisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('error', () => {
    it('should log error to Redis when connected', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.error('Test error', { userId: '123' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"level":"error"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"message":"Test error"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"environment":"dev"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"application":"test-app"')
      );
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });

    it('should fallback to HTTP when Redis fails', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(false);
      mockHttpClient.post.mockResolvedValue({});

      await loggerService.error('Test error', { userId: '123' });

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/logs',
        expect.objectContaining({
          level: 'error',
          message: 'Test error',
          environment: 'dev',
          application: 'test-app',
          applicationId: 'test-app-id-123',
          context: { userId: '123' }
        }),
        expect.any(Object)
      );
    });

    it('should use HTTP when Redis not connected', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.post.mockResolvedValue({});

      await loggerService.error('Test error');

      expect(mockHttpClient.post).toHaveBeenCalledWith(
        '/logs',
        expect.objectContaining({
          level: 'error',
          message: 'Test error',
          applicationId: 'test-app-id-123'
        }),
        expect.any(Object)
      );
      expect(mockRedisService.rpush).not.toHaveBeenCalled();
    });
  });

  describe('audit', () => {
    it('should log audit event with action and resource', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.audit('user.created', 'users', { userId: '123' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"level":"audit"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"message":"Audit: user.created on users"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"action":"user.created"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"resource":"users"')
      );
    });
  });

  describe('info', () => {
    it('should log info message', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info('Test info');

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"level":"info"')
      );
      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"message":"Test info"')
      );
    });
  });

  describe('debug', () => {
    it('should log debug message when logLevel is debug', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.debug('Test debug');

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"level":"debug"')
      );
    });

    it('should not log debug message when logLevel is not debug', async () => {
      const configWithoutDebug = { ...config, logLevel: 'info' as const };
      const loggerWithoutDebug = new LoggerService(configWithoutDebug, mockRedisService);

      await loggerWithoutDebug.debug('Test debug');

      expect(mockRedisService.rpush).not.toHaveBeenCalled();
      expect(mockHttpClient.post).not.toHaveBeenCalled();
    });
  });

  describe('log entry structure', () => {
    it('should include timestamp in log entries', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const beforeTime = new Date().toISOString();
      await loggerService.info('Test message');
      const afterTime = new Date().toISOString();

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringMatching(new RegExp(`"timestamp":"${beforeTime.split('T')[0]}`))
      );
    });

    it('should handle HTTP fallback errors gracefully', async () => {
      mockRedisService.isConnected.mockReturnValue(false);
      mockHttpClient.post.mockRejectedValue(new Error('HTTP error'));

      // Should not throw
      await expect(loggerService.error('Test error')).resolves.toBeUndefined();
    });
  });

  describe('enhanced logging options', () => {
    it('should include stack trace in error logs', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.error('Test error', { userId: '123' }, 'Stack trace here');

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"stackTrace":"Stack trace here"')
      );
    });

    it('should include correlation ID when provided', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info('Test', { data: 'value', correlationId: 'corr-123' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"correlationId":"corr-123"')
      );
    });

    it('should include user ID when provided', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info('Test', { data: 'value', userId: 'user-123' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"userId":"user-123"')
      );
    });

    it('should mask sensitive data by default', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info('Test', { password: 'secret123', username: 'john' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('***MASKED***')
      );
    });

    it('should not mask data when disabled', async () => {
      loggerService.setMasking(false);
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info('Test', { password: 'secret123' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"password":"secret123"')
      );
    });

    it('should include performance metrics when requested', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      await loggerService.info('Test', { data: 'value' });

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"data":"value"')
      );
    });
  });

  describe('performance tracking', () => {
    it('should start performance tracking', () => {
      loggerService.startPerformanceTracking('test-op');

      const metrics = loggerService.endPerformanceTracking('test-op');
      expect(metrics).not.toBeNull();
      expect(metrics?.duration).toBeGreaterThanOrEqual(0);
    });

    it('should return null for non-existent operation', () => {
      const metrics = loggerService.endPerformanceTracking('non-existent');
      expect(metrics).toBeNull();
    });

    it('should track memory usage when available', () => {
      loggerService.startPerformanceTracking('test-op');
      const metrics = loggerService.endPerformanceTracking('test-op');

      expect(metrics?.memoryUsage).toBeDefined();
      expect(metrics?.memoryUsage?.rss).toBeGreaterThan(0);
    });
  });

  describe('method chaining', () => {
    it('should support withContext method', () => {
      const chain = loggerService.withContext({ userId: '123' });
      expect(chain).toBeDefined();
    });

    it('should support withToken method', () => {
      const chain = loggerService.withToken('test-token');
      expect(chain).toBeDefined();
    });

    it('should support withPerformance method', () => {
      const chain = loggerService.withPerformance();
      expect(chain).toBeDefined();
    });

    it('should support withoutMasking method', () => {
      const chain = loggerService.withoutMasking();
      expect(chain).toBeDefined();
    });
  });

  describe('LoggerChain', () => {
    it('should support fluent API with addContext', async () => {
      loggerService.setMasking(false);
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ initial: 'data' });
      chain.addContext('userKey', 'value');
      await chain.info('Test message');

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"userKey":"value"')
      );
    });

    it('should support addUser method', () => {
      const chain = loggerService.withContext({});
      chain.addUser('user-123');
      expect(chain['options'].userId).toBe('user-123');
    });

    it('should support addApplication method', () => {
      const chain = loggerService.withContext({});
      chain.addApplication('app-123');
      expect(chain['options'].applicationId).toBe('app-123');
    });

    it('should support addCorrelation method', () => {
      const chain = loggerService.withContext({});
      chain.addCorrelation('corr-123');
      expect(chain['options'].correlationId).toBe('corr-123');
    });

    it('should execute error with chain context', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ action: 'test' });
      await chain.error('Error occurred', 'Stack trace');

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"action":"test"')
      );
    });

    it('should execute audit with chain context', async () => {
      mockRedisService.isConnected.mockReturnValue(true);
      mockRedisService.rpush.mockResolvedValue(true);

      const chain = loggerService.withContext({ userId: '123' });
      await chain.audit('action', 'resource');

      expect(mockRedisService.rpush).toHaveBeenCalledWith(
        'logs:dev:test-app',
        expect.stringContaining('"userId":"123"')
      );
    });
  });
});
