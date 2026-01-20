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

/**
 * Loads configuration from environment variables with defaults
 */
export function loadConfig(): MisoClientConfig {
  const config: MisoClientConfig = {
    controllerUrl:
      process.env.MISO_CONTROLLER_URL || "https://controller.aifabrix.ai",
    clientId: process.env.MISO_CLIENTID || process.env.MISO_CLIENT_ID || "",
    clientSecret:
      process.env.MISO_CLIENTSECRET || process.env.MISO_CLIENT_SECRET || "",
    logLevel:
      (process.env.MISO_LOG_LEVEL as "debug" | "info" | "warn" | "error") ||
      "debug",
  };

  // Note: controllerUrl always has a default value for backward compatibility
  // If MISO_CONTROLLER_URL is not set, it defaults to "https://controller.aifabrix.ai"
  // However, MISO_CONTROLLER_URL is now used as the private URL (server environment)
  // and maps to controllerPrivateUrl

  // Public URL for browser/Vite environments (accessible from internet)
  if (process.env.MISO_WEB_SERVER_URL) {
    config.controllerPublicUrl = process.env.MISO_WEB_SERVER_URL;
  }

  // Private URL for server environments (internal network access)
  // MISO_CONTROLLER_URL maps to controllerPrivateUrl (server environment)
  if (process.env.MISO_CONTROLLER_URL) {
    config.controllerPrivateUrl = process.env.MISO_CONTROLLER_URL;
    // Also set controllerUrl for backward compatibility with manual config
    config.controllerUrl = process.env.MISO_CONTROLLER_URL;
  }

  // Validate required fields
  if (!config.clientId) {
    throw new Error("MISO_CLIENTID environment variable is required");
  }
  if (!config.clientSecret) {
    throw new Error("MISO_CLIENTSECRET environment variable is required");
  }

  // Optional Redis configuration
  const redisHost = process.env.REDIS_HOST;
  if (redisHost) {
    const redisConfig: RedisConfig = {
      host: redisHost,
      port: parseInt(process.env.REDIS_PORT || "6379"),
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
    config.emitEvents = process.env.MISO_EMIT_EVENTS.toLowerCase() === "true";
  }

  // Optional auth strategy configuration
  // Format: MISO_AUTH_STRATEGY=bearer,client-token,api-key
  if (process.env.MISO_AUTH_STRATEGY) {
    const methods = process.env.MISO_AUTH_STRATEGY.split(",").map((m) =>
      m.trim(),
    ) as AuthMethod[];
    const authStrategy: AuthStrategy = {
      methods: methods.filter((m) =>
        ["bearer", "client-token", "client-credentials", "api-key"].includes(m),
      ),
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

  // Optional client token URI
  if (process.env.MISO_CLIENT_TOKEN_URI) {
    config.clientTokenUri = process.env.MISO_CLIENT_TOKEN_URI;
  }

  // Optional allowed origins for CORS validation
  // Format: MISO_ALLOWED_ORIGINS=http://localhost:3000,https://example.com,http://localhost:*
  if (process.env.MISO_ALLOWED_ORIGINS) {
    const origins = process.env.MISO_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
    if (origins.length > 0) {
      config.allowedOrigins = origins;
    }
  }

  // Optional response validation
  // Default: true in development (NODE_ENV !== 'production'), false in production
  if (process.env.MISO_VALIDATE_RESPONSES !== undefined) {
    config.validateResponses =
      process.env.MISO_VALIDATE_RESPONSES.toLowerCase() === "true";
  } else {
    // Default: true in development, false in production
    config.validateResponses = process.env.NODE_ENV !== "production";
  }

  // Optional Keycloak configuration for local token validation
  if (process.env.KEYCLOAK_SERVER_URL || process.env.KEYCLOAK_PUBLIC_SERVER_URL) {
    config.keycloak = {
      authServerUrl: process.env.KEYCLOAK_PUBLIC_SERVER_URL || process.env.KEYCLOAK_SERVER_URL || '',
      authServerPrivateUrl: process.env.KEYCLOAK_SERVER_URL,
      authServerPublicUrl: process.env.KEYCLOAK_PUBLIC_SERVER_URL,
      realm: process.env.KEYCLOAK_REALM || '',
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      verifyAudience: process.env.KEYCLOAK_VERIFY_AUDIENCE === 'true',
    };
  }

  return config;
}
