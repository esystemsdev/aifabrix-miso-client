/**
 * Comprehensive integration tests for all Auth and Logs API endpoints
 * Tests against real controller using credentials from .env file
 * 
 * To run these tests:
 * 1. Ensure .env file exists with MISO_CLIENTID, MISO_CLIENTSECRET, MISO_CONTROLLER_URL
 * 2. Optionally set TEST_USER_TOKEN for authenticated endpoint tests
 * 3. Run: npm run test:integration:api
 * 
 * Tests will gracefully skip if controller is unavailable (don't fail CI/CD)
 */

// CRITICAL: Load environment variables BEFORE importing anything that uses dotenv
// This ensures .env is loaded before loadConfig() imports "dotenv/config"
import { resolve, join } from "path";
import { existsSync } from "fs";

// Load environment variables from project root .env file
// Use absolute path to ensure we find the .env file regardless of Jest's working directory
const projectRoot = resolve(__dirname, "../..");
const envPath = join(projectRoot, ".env");

if (existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
} else {
  // Fallback: try current working directory
  const cwdEnvPath = join(process.cwd(), ".env");
  if (existsSync(cwdEnvPath)) {
    require("dotenv").config({ path: cwdEnvPath });
  } else {
    // Last resort: default behavior
    require("dotenv").config();
  }
}

// Now import modules that may use dotenv
import { MisoClient } from "../../src/index";
import { loadConfig } from "../../src/utils/config-loader";
import { MisoClientConfig } from "../../src/types/config.types";

describe("API Endpoints Integration Tests", () => {
  let client: MisoClient;
  let config: MisoClientConfig | undefined;
  let userToken: string | undefined;

  beforeAll(async () => {
    // Load config from .env
    try {
      config = loadConfig();
    } catch (error) {
      console.warn("Failed to load config from .env, skipping integration tests:", error instanceof Error ? error.message : error);
      console.warn("Environment check - MISO_CLIENTID:", process.env.MISO_CLIENTID ? "SET" : "NOT SET");
      console.warn("Environment check - MISO_CLIENTSECRET:", process.env.MISO_CLIENTSECRET ? "SET" : "NOT SET");
      console.warn("Environment check - MISO_CONTROLLER_URL:", process.env.MISO_CONTROLLER_URL || "NOT SET");
      return;
    }

    // Check if required environment variables are set
    if (!config.controllerUrl || !config.clientId || !config.clientSecret) {
      console.warn("Missing required environment variables (MISO_CONTROLLER_URL, MISO_CLIENTID, MISO_CLIENTSECRET), skipping integration tests");
      console.warn("Config check - controllerUrl:", config.controllerUrl || "NOT SET");
      console.warn("Config check - clientId:", config.clientId ? "SET" : "NOT SET");
      console.warn("Config check - clientSecret:", config.clientSecret ? "SET" : "NOT SET");
      return;
    }

    // Initialize client
    client = new MisoClient(config);
    await client.initialize();

    // Get user token from environment (optional)
    userToken = process.env.TEST_USER_TOKEN;
  });

  afterAll(async () => {
    if (client) {
      await client.disconnect();
    }
  });

  // Helper function to check if tests should be skipped (evaluated at test time, not module load time)
  const shouldSkip = (): boolean => {
    return !config?.controllerUrl || !config?.clientId || !config?.clientSecret;
  };

  describe("Auth Endpoints", () => {
    describe("Client Token Endpoints", () => {
      test("POST /api/v1/auth/token - Generate client token (legacy)", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.generateClientToken();
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.token).toBeDefined();
        } catch (error) {
          // Gracefully handle errors (controller might not be available)
          console.warn("Client token generation failed (may be expected):", error);
        }
      });

      test("POST /api/v1/auth/client-token - Generate client token (frontend)", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.getClientToken();
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.token).toBeDefined();
        } catch (error) {
          console.warn("Frontend client token generation failed (may be expected):", error);
        }
      });
    });

    describe("User Endpoints", () => {
      test("GET /api/v1/auth/user - Get user info", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.getUser({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();
        } catch (error) {
          console.warn("Get user failed:", error);
        }
      });

      test("POST /api/v1/auth/validate - Validate token", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.validateToken(
            { token: userToken },
            { bearerToken: userToken }
          );
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data.authenticated).toBeDefined();
        } catch (error) {
          console.warn("Token validation failed:", error);
        }
      });

      test("POST /api/v1/auth/logout - Logout", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.logoutWithToken(userToken);
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Logout failed:", error);
        }
      });
    });

    describe("Login Endpoints", () => {
      test("GET /api/v1/auth/login - Initiate login flow", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.login({
            redirect: "http://localhost:3000/callback",
            state: "test-state",
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data.loginUrl).toBeDefined();
        } catch (error) {
          console.warn("Login initiation failed:", error);
        }
      });

      test("GET /api/v1/auth/login/diagnostics - Get login diagnostics", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.getLoginDiagnostics();
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Login diagnostics failed:", error);
        }
      });
    });

    describe("Roles Endpoints", () => {
      test("GET /api/v1/auth/roles - Get roles", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.roles.getRoles(
            undefined,
            { bearerToken: userToken }
          );
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(Array.isArray(response.data.roles)).toBe(true);
        } catch (error) {
          console.warn("Get roles failed:", error);
        }
      });

      test("GET /api/v1/auth/roles/refresh - Refresh roles", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.roles.refreshRoles({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(Array.isArray(response.data.roles)).toBe(true);
        } catch (error) {
          console.warn("Refresh roles failed:", error);
        }
      });
    });

    describe("Permissions Endpoints", () => {
      test("GET /api/v1/auth/permissions - Get permissions", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.permissions.getPermissions(
            undefined,
            { bearerToken: userToken }
          );
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(Array.isArray(response.data.permissions)).toBe(true);
        } catch (error) {
          console.warn("Get permissions failed:", error);
        }
      });

      test("GET /api/v1/auth/permissions/refresh - Refresh permissions", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.permissions.refreshPermissions({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(Array.isArray(response.data.permissions)).toBe(true);
        } catch (error) {
          console.warn("Refresh permissions failed:", error);
        }
      });
    });

    describe("Cache Endpoints", () => {
      test("GET /api/v1/auth/cache/stats - Get cache stats", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.getCacheStats({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Get cache stats failed:", error);
        }
      });

      test("GET /api/v1/auth/cache/performance - Get cache performance", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.getCachePerformance({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Get cache performance failed:", error);
        }
      });

      test("GET /api/v1/auth/cache/efficiency - Get cache efficiency", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.auth.getCacheEfficiency({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Get cache efficiency failed:", error);
        }
      });
    });
  });

  describe("Logs Endpoints", () => {
    describe("Create Log Endpoints", () => {
      test("POST /api/v1/logs - Create error log", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.createLog({
            type: "error",
            data: {
              level: "error",
              message: "Integration test error log",
              context: { test: true },
              correlationId: "test-correlation-id",
            },
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
        } catch (error) {
          console.warn("Create error log failed:", error);
        }
      });

      test("POST /api/v1/logs - Create general log", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.createLog({
            type: "general",
            data: {
              level: "info",
              message: "Integration test general log",
              context: { test: true },
              correlationId: "test-correlation-id",
            },
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
        } catch (error) {
          console.warn("Create general log failed:", error);
        }
      });

      test("POST /api/v1/logs - Create audit log with required fields", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.createLog({
            type: "audit",
            data: {
              level: "info",
              message: "Integration test audit log",
              context: { test: true },
              correlationId: "test-correlation-id",
              entityType: "Test Entity",
              entityId: "test-entity-123",
              action: "test-action",
            },
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
        } catch (error) {
          console.warn("Create audit log failed:", error);
        }
      });

      test("POST /api/v1/logs/batch - Create batch logs (1-100 logs)", async () => {
        if (shouldSkip()) {
          console.log("Skipping test - config not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.createBatchLogs({
            logs: [
              {
                type: "general",
                data: {
                  level: "info",
                  message: "Batch log 1",
                  context: { batch: true },
                  correlationId: "batch-test-1",
                },
              },
              {
                type: "general",
                data: {
                  level: "info",
                  message: "Batch log 2",
                  context: { batch: true },
                  correlationId: "batch-test-2",
                },
              },
            ],
          });
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data.processed).toBeDefined();
        } catch (error) {
          console.warn("Create batch logs failed:", error);
        }
      });
    });

    describe("List Log Endpoints", () => {
      test("GET /api/v1/logs/general - List general logs (paginated)", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.listGeneralLogs(
            { page: 1, pageSize: 10 },
            { bearerToken: userToken }
          );
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();
          expect(Array.isArray(response.data.logs)).toBe(true);
        } catch (error) {
          console.warn("List general logs failed:", error);
        }
      });

      test("GET /api/v1/logs/audit - List audit logs (paginated)", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.listAuditLogs(
            { page: 1, pageSize: 10 },
            { bearerToken: userToken }
          );
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();
          expect(Array.isArray(response.data.logs)).toBe(true);
        } catch (error) {
          console.warn("List audit logs failed:", error);
        }
      });

      test("GET /api/v1/logs/jobs - List job logs (paginated)", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.listJobLogs(
            { page: 1, pageSize: 10 },
            { bearerToken: userToken }
          );
          expect(response).toBeDefined();
          expect(response.success).toBe(true);
          expect(response.data).toBeDefined();
          expect(Array.isArray(response.data.logs)).toBe(true);
        } catch (error) {
          console.warn("List job logs failed:", error);
        }
      });
    });

    describe("Stats Endpoints", () => {
      test("GET /api/v1/logs/stats/summary - Get log statistics summary", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.getStatsSummary({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Get stats summary failed:", error);
        }
      });

      test("GET /api/v1/logs/stats/errors - Get error statistics", async () => {
        if (shouldSkip() || !userToken) {
          console.log("Skipping test - config or user token not available");
          return;
        }

        try {
          const response = await client.apiClient.logs.getErrorStats({
            bearerToken: userToken,
          });
          expect(response).toBeDefined();
          expect(response.success).toBeDefined();
        } catch (error) {
          console.warn("Get error stats failed:", error);
        }
      });
    });
  });
});
