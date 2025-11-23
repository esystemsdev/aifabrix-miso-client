/**
 * Configuration loader utility
 * Automatically loads environment variables with sensible defaults
 */

import 'dotenv/config';
import { MisoClientConfig, RedisConfig, AuthStrategy, AuthMethod } from '../types/config.types';

/**
 * Loads configuration from environment variables with defaults
 */
export function loadConfig(): MisoClientConfig {
  const config: MisoClientConfig = {
    controllerUrl: process.env.MISO_CONTROLLER_URL || 'https://controller.aifabrix.ai',
    clientId: process.env.MISO_CLIENTID || process.env.MISO_CLIENT_ID || '',
    clientSecret: process.env.MISO_CLIENTSECRET || process.env.MISO_CLIENT_SECRET || '',
    logLevel: (process.env.MISO_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'debug',
  };

  // Validate required fields
  if (!config.clientId) {
    throw new Error('MISO_CLIENTID environment variable is required');
  }
  if (!config.clientSecret) {
    throw new Error('MISO_CLIENTSECRET environment variable is required');
  }

  // Optional Redis configuration
  const redisHost = process.env.REDIS_HOST;
  if (redisHost) {
    const redisConfig: RedisConfig = {
      host: redisHost,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
    };

    if (process.env.REDIS_DB) {
      redisConfig.db = parseInt(process.env.REDIS_DB);
    }

    if (process.env.REDIS_KEY_PREFIX) {
      redisConfig.keyPrefix = process.env.REDIS_KEY_PREFIX;
    }

    config.redis = redisConfig;
  }

  // Optional encryption key
  if (process.env.ENCRYPTION_KEY) {
    config.encryptionKey = process.env.ENCRYPTION_KEY;
  }

  // Optional API key for testing (bypasses OAuth2 authentication)
  if (process.env.API_KEY) {
    config.apiKey = process.env.API_KEY;
  }

  // Optional sensitive fields configuration file path
  if (process.env.MISO_SENSITIVE_FIELDS_CONFIG) {
    config.sensitiveFieldsConfig = process.env.MISO_SENSITIVE_FIELDS_CONFIG;
  }

  // Optional emitEvents flag (for direct SDK embedding in your own application)
  if (process.env.MISO_EMIT_EVENTS) {
    config.emitEvents = process.env.MISO_EMIT_EVENTS.toLowerCase() === 'true';
  }

  // Optional auth strategy configuration
  // Format: MISO_AUTH_STRATEGY=bearer,client-token,api-key
  if (process.env.MISO_AUTH_STRATEGY) {
    const methods = process.env.MISO_AUTH_STRATEGY.split(',').map(m => m.trim()) as AuthMethod[];
    const authStrategy: AuthStrategy = {
      methods: methods.filter(m => ['bearer', 'client-token', 'client-credentials', 'api-key'].includes(m))
    };

    // Add bearer token if provided
    if (process.env.MISO_BEARER_TOKEN) {
      authStrategy.bearerToken = process.env.MISO_BEARER_TOKEN;
    }

    // Add API key if provided (can also use existing API_KEY env var)
    if (process.env.MISO_API_KEY || process.env.API_KEY) {
      authStrategy.apiKey = process.env.MISO_API_KEY || process.env.API_KEY;
    }

    if (authStrategy.methods.length > 0) {
      config.authStrategy = authStrategy;
    }
  }

  return config;
}
