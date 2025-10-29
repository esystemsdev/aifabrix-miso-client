/**
 * Unit tests for ConfigLoader utility
 */

import { loadConfig } from '../../src/utils/config-loader';
import { MisoClientConfig } from '../../src/types/config.types';

describe('ConfigLoader', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadConfig', () => {
    describe('default values', () => {
      it('should load configuration with defaults when env vars are not set', () => {
        // Set required fields
        process.env.MISO_CLIENTID = 'test-client-id';
        process.env.MISO_CLIENTSECRET = 'test-secret';
        delete process.env.MISO_CONTROLLER_URL;
        delete process.env.REDIS_HOST;

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: 'https://controller.aifabrix.ai',
          clientId: 'test-client-id',
          clientSecret: 'test-secret',
          logLevel: 'debug',
        });
      });
    });

    describe('environment variables', () => {
      it('should load configuration from environment variables', () => {
        process.env.MISO_CONTROLLER_URL = 'https://custom-controller.example.com';
        process.env.MISO_CLIENTID = 'ctrl-prod-my-custom-app';
        process.env.MISO_CLIENTSECRET = 'secret-123';
        process.env.MISO_LOG_LEVEL = 'error';

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: 'https://custom-controller.example.com',
          clientId: 'ctrl-prod-my-custom-app',
          clientSecret: 'secret-123',
          logLevel: 'error',
        });
      });

      it('should handle all log levels', () => {
        const logLevels = ['debug', 'info', 'warn', 'error'] as const;

        // Set required fields
        process.env.MISO_CLIENTID = 'test-client-id';
        process.env.MISO_CLIENTSECRET = 'test-secret';

        logLevels.forEach(level => {
          process.env.MISO_LOG_LEVEL = level;
          const config = loadConfig();
          expect(config.logLevel).toBe(level);
        });
      });
    });

    describe('Redis configuration', () => {
      beforeEach(() => {
        // Set required fields for all Redis tests
        process.env.MISO_CLIENTID = 'test-client-id';
        process.env.MISO_CLIENTSECRET = 'test-secret';
      });

      it('should not include Redis config when REDIS_HOST is not set', () => {
        delete process.env.REDIS_HOST;

        const config = loadConfig();

        expect(config.redis).toBeUndefined();
      });

      it('should load basic Redis configuration', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        process.env.REDIS_PORT = '6380';

        const config = loadConfig();

        expect(config.redis).toBeDefined();
        expect(config.redis).toMatchObject({
          host: 'redis.example.com',
          port: 6380,
        });
      });

      it('should use default Redis port when not specified', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        delete process.env.REDIS_PORT;

        const config = loadConfig();

        expect(config.redis?.port).toBe(6379);
      });

      it('should include optional Redis password', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        process.env.REDIS_PASSWORD = 'secret-password';

        const config = loadConfig();

        expect(config.redis?.password).toBe('secret-password');
      });

      it('should include optional Redis database number', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        process.env.REDIS_DB = '2';

        const config = loadConfig();

        expect(config.redis?.db).toBe(2);
      });

      it('should include optional Redis key prefix', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        process.env.REDIS_KEY_PREFIX = 'myapp:';

        const config = loadConfig();

        expect(config.redis?.keyPrefix).toBe('myapp:');
      });

      it('should load complete Redis configuration', () => {
        process.env.REDIS_HOST = 'redis.example.com';
        process.env.REDIS_PORT = '6380';
        process.env.REDIS_PASSWORD = 'secret-password';
        process.env.REDIS_DB = '3';
        process.env.REDIS_KEY_PREFIX = 'prod:miso:';

        const config = loadConfig();

        expect(config.redis).toMatchObject({
          host: 'redis.example.com',
          port: 6380,
          password: 'secret-password',
          db: 3,
          keyPrefix: 'prod:miso:',
        });
      });
    });
  });
});
