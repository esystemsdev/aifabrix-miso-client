/**
 * Environment configuration tests
 */

import { loadEnvConfig } from '../../config/env';

describe('loadEnvConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load default values when environment variables are not set', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;
    delete process.env.MISO_CONTROLLER_URL;
    delete process.env.MISO_CLIENTID;
    delete process.env.MISO_CLIENTSECRET;
    delete process.env.MISO_ALLOWED_ORIGINS;
    delete process.env.MISO_LOG_LEVEL;

    const config = loadEnvConfig();

    expect(config.port).toBe(3083);
    expect(config.nodeEnv).toBe('development');
    expect(config.misoControllerUrl).toBe('');
    expect(config.misoClientId).toBe('');
    expect(config.misoClientSecret).toBe('');
    expect(config.misoAllowedOrigins).toEqual(['http://localhost:3083']);
    expect(config.misoLogLevel).toBe('info');
  });

  it('should load environment variables when set', () => {
    process.env.PORT = '3000';
    process.env.NODE_ENV = 'test';
    process.env.MISO_CONTROLLER_URL = 'http://localhost:3110';
    process.env.MISO_CLIENTID = 'test-client';
    process.env.MISO_CLIENTSECRET = 'test-secret';
    process.env.MISO_ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3001';
    process.env.MISO_LOG_LEVEL = 'debug';

    const config = loadEnvConfig();

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('test');
    expect(config.misoControllerUrl).toBe('http://localhost:3110');
    expect(config.misoClientId).toBe('test-client');
    expect(config.misoClientSecret).toBe('test-secret');
    expect(config.misoAllowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
    expect(config.misoLogLevel).toBe('debug');
  });

  it('should parse allowed origins with spaces and trim them', () => {
    process.env.MISO_ALLOWED_ORIGINS = ' http://localhost:3000 , http://localhost:3001 , http://localhost:3002 ';

    const config = loadEnvConfig();

    expect(config.misoAllowedOrigins).toEqual([
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ]);
  });

  it('should filter out empty origins', () => {
    process.env.MISO_ALLOWED_ORIGINS = 'http://localhost:3000,,http://localhost:3001,  ,';

    const config = loadEnvConfig();

    expect(config.misoAllowedOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
  });

  it('should not throw error in development mode when required vars are missing', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.MISO_CONTROLLER_URL;
    delete process.env.MISO_CLIENTID;
    delete process.env.MISO_CLIENTSECRET;

    expect(() => loadEnvConfig()).not.toThrow();
  });

  it('should throw error in production when MISO_CONTROLLER_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.MISO_CONTROLLER_URL;
    delete process.env.MISO_CLIENTID;
    delete process.env.MISO_CLIENTSECRET;

    expect(() => loadEnvConfig()).toThrow('MISO_CONTROLLER_URL is required in production');
  });

  it('should throw error in production when MISO_CLIENTID is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.MISO_CONTROLLER_URL = 'http://localhost:3110';
    delete process.env.MISO_CLIENTID;
    delete process.env.MISO_CLIENTSECRET;

    expect(() => loadEnvConfig()).toThrow('MISO_CLIENTID is required in production');
  });

  it('should throw error in production when MISO_CLIENTSECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.MISO_CONTROLLER_URL = 'http://localhost:3110';
    process.env.MISO_CLIENTID = 'test-client';
    delete process.env.MISO_CLIENTSECRET;

    expect(() => loadEnvConfig()).toThrow('MISO_CLIENTSECRET is required in production');
  });

  it('should not throw error in production when all required vars are present', () => {
    process.env.NODE_ENV = 'production';
    process.env.MISO_CONTROLLER_URL = 'http://localhost:3110';
    process.env.MISO_CLIENTID = 'test-client';
    process.env.MISO_CLIENTSECRET = 'test-secret';

    expect(() => loadEnvConfig()).not.toThrow();
  });
});
