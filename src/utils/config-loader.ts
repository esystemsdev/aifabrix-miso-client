/**
 * Configuration loader utility
 * Automatically loads environment variables with sensible defaults
 */

import 'dotenv/config';
import { MisoClientConfig, RedisConfig } from '../types/config.types';

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

  return config;
}
