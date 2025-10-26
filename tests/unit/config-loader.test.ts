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
        delete process.env.CONTROLLER_URL;
        delete process.env.ENVIRONMENT;
        delete process.env.APPLICATION_KEY;
        delete process.env.APPLICATION_ID;
        delete process.env.REDIS_HOST;

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: 'https://controller.aifabrix.ai',
          environment: 'dev',
          applicationKey: 'example-app',
          applicationId: '',
          logLevel: 'debug',
        });
      });
    });

    describe('environment variables', () => {
      it('should load configuration from environment variables', () => {
        process.env.CONTROLLER_URL = 'https://custom-controller.example.com';
        process.env.ENVIRONMENT = 'pro';
        process.env.APPLICATION_KEY = 'my-custom-app';
        process.env.APPLICATION_ID = 'app-id-123';
        process.env.API_KEY = 'prod-app-id-123-key';
        process.env.LOG_LEVEL = 'error';

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: 'https://custom-controller.example.com',
          environment: 'pro',
          applicationKey: 'my-custom-app',
          applicationId: 'app-id-123',
          apiKey: 'prod-app-id-123-key',
          logLevel: 'error',
        });
      });

      it('should handle all three environment types', () => {
        const environments = ['dev', 'tst', 'pro'] as const;

        environments.forEach(env => {
          process.env.ENVIRONMENT = env;
          const config = loadConfig();
          expect(config.environment).toBe(env);
        });
      });

      it('should handle all log levels', () => {
        const logLevels = ['debug', 'info', 'warn', 'error'] as const;

        logLevels.forEach(level => {
          process.env.LOG_LEVEL = level;
          const config = loadConfig();
          expect(config.logLevel).toBe(level);
        });
      });
    });

    describe('Redis configuration', () => {
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

    describe('environment configuration', () => {
      it('should work with typical development environment', () => {
        process.env.CONTROLLER_URL = 'http://localhost:3000';
        process.env.ENVIRONMENT = 'dev';
        process.env.APPLICATION_KEY = 'dev-app';
        process.env.APPLICATION_ID = 'dev-app-123';
        process.env.REDIS_HOST = 'localhost';

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: 'http://localhost:3000',
          environment: 'dev',
          applicationKey: 'dev-app',
          applicationId: 'dev-app-123',
        });
        expect(config.redis?.host).toBe('localhost');
      });

      it('should work with typical production environment', () => {
        process.env.CONTROLLER_URL = 'https://controller.aifabrix.ai';
        process.env.ENVIRONMENT = 'pro';
        process.env.APPLICATION_KEY = 'prod-app';
        process.env.APPLICATION_ID = 'prod-app-456';
        process.env.API_KEY = 'pro-prod-app-prod-app-456-abc123';
        process.env.LOG_LEVEL = 'warn';
        process.env.REDIS_HOST = 'prod-redis.example.com';
        process.env.REDIS_PORT = '6379';
        process.env.REDIS_PASSWORD = 'secure-password';
        process.env.REDIS_DB = '1';
        process.env.REDIS_KEY_PREFIX = 'prod:miso:';

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: 'https://controller.aifabrix.ai',
          environment: 'pro',
          applicationKey: 'prod-app',
          applicationId: 'prod-app-456',
          apiKey: 'pro-prod-app-prod-app-456-abc123',
          logLevel: 'warn',
        });

        expect(config.redis).toMatchObject({
          host: 'prod-redis.example.com',
          port: 6379,
          password: 'secure-password',
          db: 1,
          keyPrefix: 'prod:miso:',
        });
      });
    });
  });
});

