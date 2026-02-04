/**
 * Configuration loader utility
 * Automatically loads environment variables with sensible defaults
 */

import "dotenv/config";
import {
  MisoClientConfig,
  RedisConfig,
  AuthStrategy,
  AuthMethod,
} from "../types/config.types";

/** Load Redis configuration from environment */
function loadRedisConfig(): RedisConfig | undefined {
  const redisHost = process.env.REDIS_HOST;
  if (!redisHost) return undefined;

  const redisConfig: RedisConfig = {
    host: redisHost,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD,
  };
  if (process.env.REDIS_DB) redisConfig.db = parseInt(process.env.REDIS_DB);
  if (process.env.REDIS_KEY_PREFIX) redisConfig.keyPrefix = process.env.REDIS_KEY_PREFIX;
  return redisConfig;
}

/** Load auth strategy from environment */
function loadAuthStrategy(): AuthStrategy | undefined {
  if (!process.env.MISO_AUTH_STRATEGY) return undefined;

  const methods = process.env.MISO_AUTH_STRATEGY.split(",").map((m) => m.trim()) as AuthMethod[];
  const validMethods = methods.filter((m) => ["bearer", "client-token", "client-credentials", "api-key"].includes(m));
  if (validMethods.length === 0) return undefined;

  const authStrategy: AuthStrategy = { methods: validMethods };
  if (process.env.MISO_BEARER_TOKEN) authStrategy.bearerToken = process.env.MISO_BEARER_TOKEN;
  if (process.env.MISO_API_KEY || process.env.API_KEY) authStrategy.apiKey = process.env.MISO_API_KEY || process.env.API_KEY;
  return authStrategy;
}

/** Load Keycloak configuration from environment */
function loadKeycloakConfig(): MisoClientConfig["keycloak"] | undefined {
  if (!process.env.KEYCLOAK_SERVER_URL && !process.env.KEYCLOAK_PUBLIC_SERVER_URL) return undefined;
  return {
    authServerUrl: process.env.KEYCLOAK_PUBLIC_SERVER_URL || process.env.KEYCLOAK_SERVER_URL || '',
    authServerPrivateUrl: process.env.KEYCLOAK_SERVER_URL,
    authServerPublicUrl: process.env.KEYCLOAK_PUBLIC_SERVER_URL,
    realm: process.env.KEYCLOAK_REALM || '',
    clientId: process.env.KEYCLOAK_CLIENT_ID,
    verifyAudience: process.env.KEYCLOAK_VERIFY_AUDIENCE === 'true',
  };
}

/** Load allowed origins from environment */
function loadAllowedOrigins(): string[] | undefined {
  if (!process.env.MISO_ALLOWED_ORIGINS) return undefined;
  const origins = process.env.MISO_ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter((o) => o.length > 0);
  return origins.length > 0 ? origins : undefined;
}

/**
 * Loads configuration from environment variables with defaults.
 * @returns MisoClient configuration object.
 * @throws Error when required environment variables are missing.
 */
export function loadConfig(): MisoClientConfig {
  const config: MisoClientConfig = {
    controllerUrl: process.env.MISO_CONTROLLER_URL || "https://controller.aifabrix.ai",
    clientId: process.env.MISO_CLIENTID || process.env.MISO_CLIENT_ID || "",
    clientSecret: process.env.MISO_CLIENTSECRET || process.env.MISO_CLIENT_SECRET || "",
    logLevel: (process.env.MISO_LOG_LEVEL as "debug" | "info" | "warn" | "error") || "debug",
  };

  // Controller URLs
  if (process.env.MISO_WEB_SERVER_URL) config.controllerPublicUrl = process.env.MISO_WEB_SERVER_URL;
  if (process.env.MISO_CONTROLLER_URL) {
    config.controllerPrivateUrl = process.env.MISO_CONTROLLER_URL;
    config.controllerUrl = process.env.MISO_CONTROLLER_URL;
  }

  // Validate required fields
  if (!config.clientId) throw new Error("MISO_CLIENTID environment variable is required");
  if (!config.clientSecret) throw new Error("MISO_CLIENTSECRET environment variable is required");

  // Optional configurations
  const redis = loadRedisConfig();
  if (redis) config.redis = redis;
  if (process.env.API_KEY) config.apiKey = process.env.API_KEY;
  if (process.env.MISO_SENSITIVE_FIELDS_CONFIG) config.sensitiveFieldsConfig = process.env.MISO_SENSITIVE_FIELDS_CONFIG;
  if (process.env.MISO_EMIT_EVENTS) config.emitEvents = process.env.MISO_EMIT_EVENTS.toLowerCase() === "true";

  const authStrategy = loadAuthStrategy();
  if (authStrategy) config.authStrategy = authStrategy;
  if (process.env.MISO_CLIENT_TOKEN_URI) config.clientTokenUri = process.env.MISO_CLIENT_TOKEN_URI;

  const allowedOrigins = loadAllowedOrigins();
  if (allowedOrigins) config.allowedOrigins = allowedOrigins;

  // Response validation (default: true in dev, false in prod)
  config.validateResponses = process.env.MISO_VALIDATE_RESPONSES !== undefined
    ? process.env.MISO_VALIDATE_RESPONSES.toLowerCase() === "true"
    : process.env.NODE_ENV !== "production";

  const keycloak = loadKeycloakConfig();
  if (keycloak) config.keycloak = keycloak;
  if (process.env.ENCRYPTION_KEY) config.encryptionKey = process.env.ENCRYPTION_KEY;

  return config;
}
