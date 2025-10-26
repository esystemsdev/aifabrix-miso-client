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
    controllerUrl: process.env.CONTROLLER_URL || 'https://controller.aifabrix.ai',
    environment: (process.env.ENVIRONMENT as 'dev' | 'tst' | 'pro') || 'dev',
    applicationKey: process.env.APPLICATION_KEY || 'example-app',
    applicationId: process.env.APPLICATION_ID || '',
    apiKey: process.env.API_KEY,
    logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'debug',
  };

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

