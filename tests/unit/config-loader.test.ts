/**
 * Unit tests for ConfigLoader utility
 */

// Mock dotenv/config to prevent real file loading
jest.mock("dotenv/config", () => ({}), { virtual: true });

import { loadConfig } from "../../src/utils/config-loader";
import { MisoClientConfig } from "../../src/types/config.types";

describe("ConfigLoader", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    // DO NOT use jest.resetModules() - it's very slow and causes module reloads
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("loadConfig", () => {
    describe("default values", () => {
      it("should load configuration with defaults when env vars are not set", () => {
        // Set required fields; unset others so defaults apply
        process.env.MISO_CLIENTID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "test-secret";
        delete process.env.MISO_CONTROLLER_URL;
        delete process.env.MISO_LOG_LEVEL;
        delete process.env.REDIS_HOST;

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: "https://controller.aifabrix.ai",
          clientId: "test-client-id",
          clientSecret: "test-secret",
          logLevel: "debug",
        });
      });
    });

    describe("environment variables", () => {
      it("should load configuration from environment variables", () => {
        process.env.MISO_CONTROLLER_URL =
          "https://custom-controller.example.com";
        process.env.MISO_CLIENTID = "ctrl-prod-my-custom-app";
        process.env.MISO_CLIENTSECRET = "secret-123";
        process.env.MISO_LOG_LEVEL = "error";

        const config = loadConfig();

        expect(config).toMatchObject({
          controllerUrl: "https://custom-controller.example.com",
          clientId: "ctrl-prod-my-custom-app",
          clientSecret: "secret-123",
          logLevel: "error",
        });
      });

      it("should handle all log levels", () => {
        const logLevels = ["debug", "info", "warn", "error"] as const;

        // Set required fields
        process.env.MISO_CLIENTID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "test-secret";

        logLevels.forEach((level) => {
          process.env.MISO_LOG_LEVEL = level;
          const config = loadConfig();
          expect(config.logLevel).toBe(level);
        });
      });
    });

    describe("Redis configuration", () => {
      beforeEach(() => {
        // Set required fields for all Redis tests
        process.env.MISO_CLIENTID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "test-secret";
      });

      it("should not include Redis config when REDIS_HOST is not set", () => {
        delete process.env.REDIS_HOST;

        const config = loadConfig();

        expect(config.redis).toBeUndefined();
      });

      it("should load basic Redis configuration", () => {
        process.env.REDIS_HOST = "redis.example.com";
        process.env.REDIS_PORT = "6380";

        const config = loadConfig();

        expect(config.redis).toBeDefined();
        expect(config.redis).toMatchObject({
          host: "redis.example.com",
          port: 6380,
        });
      });

      it("should use default Redis port when not specified", () => {
        process.env.REDIS_HOST = "redis.example.com";
        delete process.env.REDIS_PORT;

        const config = loadConfig();

        expect(config.redis?.port).toBe(6379);
      });

      it("should include optional Redis password", () => {
        process.env.REDIS_HOST = "redis.example.com";
        process.env.REDIS_PASSWORD = "secret-password";

        const config = loadConfig();

        expect(config.redis?.password).toBe("secret-password");
      });

      it("should include optional Redis database number", () => {
        process.env.REDIS_HOST = "redis.example.com";
        process.env.REDIS_DB = "2";

        const config = loadConfig();

        expect(config.redis?.db).toBe(2);
      });

      it("should include optional Redis key prefix", () => {
        process.env.REDIS_HOST = "redis.example.com";
        process.env.REDIS_KEY_PREFIX = "myapp:";

        const config = loadConfig();

        expect(config.redis?.keyPrefix).toBe("myapp:");
      });

      it("should load complete Redis configuration", () => {
        process.env.REDIS_HOST = "redis.example.com";
        process.env.REDIS_PORT = "6380";
        process.env.REDIS_PASSWORD = "secret-password";
        process.env.REDIS_DB = "3";
        process.env.REDIS_KEY_PREFIX = "prod:miso:";

        const config = loadConfig();

        expect(config.redis).toMatchObject({
          host: "redis.example.com",
          port: 6380,
          password: "secret-password",
          db: 3,
          keyPrefix: "prod:miso:",
        });
      });
    });

    describe("error cases", () => {
      it("should throw error when MISO_CLIENTID is missing", () => {
        delete process.env.MISO_CLIENTID;
        delete process.env.MISO_CLIENT_ID;
        delete process.env.MISO_CLIENTSECRET;
        delete process.env.MISO_CLIENT_SECRET;

        expect(() => loadConfig()).toThrow(
          "MISO_CLIENTID environment variable is required",
        );
      });

      it("should throw error when MISO_CLIENTSECRET is missing", () => {
        process.env.MISO_CLIENTID = "test-client-id";
        delete process.env.MISO_CLIENTSECRET;
        delete process.env.MISO_CLIENT_SECRET;

        expect(() => loadConfig()).toThrow(
          "MISO_CLIENTSECRET environment variable is required",
        );
      });

      it("should throw error when clientId is empty string", () => {
        process.env.MISO_CLIENTID = "";
        delete process.env.MISO_CLIENT_ID;
        process.env.MISO_CLIENTSECRET = "test-secret";

        expect(() => loadConfig()).toThrow(
          "MISO_CLIENTID environment variable is required",
        );
      });

      it("should throw error when clientSecret is empty string", () => {
        process.env.MISO_CLIENTID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "";

        expect(() => loadConfig()).toThrow(
          "MISO_CLIENTSECRET environment variable is required",
        );
      });

      it("should accept MISO_CLIENT_ID as alternative to MISO_CLIENTID", () => {
        delete process.env.MISO_CLIENTID;
        process.env.MISO_CLIENT_ID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "test-secret";

        const config = loadConfig();
        expect(config.clientId).toBe("test-client-id");
      });

      it("should accept MISO_CLIENT_SECRET as alternative to MISO_CLIENTSECRET", () => {
        process.env.MISO_CLIENTID = "test-client-id";
        delete process.env.MISO_CLIENTSECRET;
        process.env.MISO_CLIENT_SECRET = "test-secret";

        const config = loadConfig();
        expect(config.clientSecret).toBe("test-secret");
      });
    });

    describe("optional configuration", () => {
      beforeEach(() => {
        process.env.MISO_CLIENTID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "test-secret";
      });

      it("should include apiKey when API_KEY is set", () => {
        process.env.API_KEY = "api-key-123";

        const config = loadConfig();
        expect(config.apiKey).toBe("api-key-123");
      });

      it("should not include apiKey when API_KEY is not set", () => {
        delete process.env.API_KEY;

        const config = loadConfig();
        expect(config.apiKey).toBeUndefined();
      });

      it("should include sensitiveFieldsConfig when MISO_SENSITIVE_FIELDS_CONFIG is set", () => {
        process.env.MISO_SENSITIVE_FIELDS_CONFIG = "/path/to/config.json";

        const config = loadConfig();
        expect(config.sensitiveFieldsConfig).toBe("/path/to/config.json");
      });

      it("should not include sensitiveFieldsConfig when MISO_SENSITIVE_FIELDS_CONFIG is not set", () => {
        delete process.env.MISO_SENSITIVE_FIELDS_CONFIG;

        const config = loadConfig();
        expect(config.sensitiveFieldsConfig).toBeUndefined();
      });

      it("should include clientTokenUri when MISO_CLIENT_TOKEN_URI is set", () => {
        process.env.MISO_CLIENT_TOKEN_URI = "/api/custom/token";

        const config = loadConfig();
        expect(config.clientTokenUri).toBe("/api/custom/token");
      });

      it("should not include clientTokenUri when MISO_CLIENT_TOKEN_URI is not set", () => {
        delete process.env.MISO_CLIENT_TOKEN_URI;

        const config = loadConfig();
        expect(config.clientTokenUri).toBeUndefined();
      });

      it("should parse MISO_ALLOWED_ORIGINS as comma-separated list", () => {
        process.env.MISO_ALLOWED_ORIGINS =
          "http://localhost:3000,https://example.com,http://localhost:*";

        const config = loadConfig();
        expect(config.allowedOrigins).toEqual([
          "http://localhost:3000",
          "https://example.com",
          "http://localhost:*",
        ]);
      });

      it("should trim whitespace from origins", () => {
        process.env.MISO_ALLOWED_ORIGINS =
          " http://localhost:3000 , https://example.com ";

        const config = loadConfig();
        expect(config.allowedOrigins).toEqual([
          "http://localhost:3000",
          "https://example.com",
        ]);
      });

      it("should filter out empty origins", () => {
        process.env.MISO_ALLOWED_ORIGINS =
          "http://localhost:3000,,https://example.com,";

        const config = loadConfig();
        expect(config.allowedOrigins).toEqual([
          "http://localhost:3000",
          "https://example.com",
        ]);
      });

      it("should not include allowedOrigins when MISO_ALLOWED_ORIGINS is not set", () => {
        delete process.env.MISO_ALLOWED_ORIGINS;

        const config = loadConfig();
        expect(config.allowedOrigins).toBeUndefined();
      });

      it("should handle single origin", () => {
        process.env.MISO_ALLOWED_ORIGINS = "http://localhost:3000";

        const config = loadConfig();
        expect(config.allowedOrigins).toEqual(["http://localhost:3000"]);
      });

      it("should handle empty MISO_ALLOWED_ORIGINS", () => {
        process.env.MISO_ALLOWED_ORIGINS = "";

        const config = loadConfig();
        expect(config.allowedOrigins).toBeUndefined();
      });

      it("should include controllerPublicUrl when MISO_WEB_SERVER_URL is set", () => {
        process.env.MISO_WEB_SERVER_URL =
          "https://public-controller.example.com";

        const config = loadConfig();
        expect(config.controllerPublicUrl).toBe(
          "https://public-controller.example.com"
        );
      });

      it("should not include controllerPublicUrl when MISO_WEB_SERVER_URL is not set", () => {
        delete process.env.MISO_WEB_SERVER_URL;

        const config = loadConfig();
        expect(config.controllerPublicUrl).toBeUndefined();
      });

      it("should include controllerPrivateUrl when MISO_CONTROLLER_URL is set", () => {
        process.env.MISO_CONTROLLER_URL = "http://private-controller:3010";

        const config = loadConfig();
        expect(config.controllerPrivateUrl).toBe(
          "http://private-controller:3010"
        );
        // Also sets controllerUrl for backward compatibility
        expect(config.controllerUrl).toBe("http://private-controller:3010");
      });

      it("should not include controllerPrivateUrl when MISO_CONTROLLER_URL is not set", () => {
        delete process.env.MISO_CONTROLLER_URL;

        const config = loadConfig();
        expect(config.controllerPrivateUrl).toBeUndefined();
        // controllerUrl should still have default value
        expect(config.controllerUrl).toBe("https://controller.aifabrix.ai");
      });

      it("should load both public and private URLs when both are set", () => {
        process.env.MISO_WEB_SERVER_URL =
          "https://public-controller.example.com";
        process.env.MISO_CONTROLLER_URL = "http://private-controller:3010";

        const config = loadConfig();
        expect(config.controllerPublicUrl).toBe(
          "https://public-controller.example.com"
        );
        expect(config.controllerPrivateUrl).toBe(
          "http://private-controller:3010"
        );
        expect(config.controllerUrl).toBe("http://private-controller:3010");
      });
    });

    describe("encryption key configuration", () => {
      beforeEach(() => {
        // Set required fields for all encryption key tests
        process.env.MISO_CLIENTID = "test-client-id";
        process.env.MISO_CLIENTSECRET = "test-secret";
      });

      it("should load encryptionKey from ENCRYPTION_KEY", () => {
        process.env.ENCRYPTION_KEY = "test-encryption-key-12345";

        const config = loadConfig();

        expect(config.encryptionKey).toBe("test-encryption-key-12345");
      });

      it("should not set encryptionKey when ENCRYPTION_KEY is not provided", () => {
        delete process.env.ENCRYPTION_KEY;

        const config = loadConfig();

        expect(config.encryptionKey).toBeUndefined();
      });

      it("should load encryptionKey with special characters", () => {
        process.env.ENCRYPTION_KEY = "key-with-special_chars.123!@#";

        const config = loadConfig();

        expect(config.encryptionKey).toBe("key-with-special_chars.123!@#");
      });

      it("should load long encryptionKey", () => {
        const longKey = "a".repeat(256);
        process.env.ENCRYPTION_KEY = longKey;

        const config = loadConfig();

        expect(config.encryptionKey).toBe(longKey);
      });
    });
  });
});
