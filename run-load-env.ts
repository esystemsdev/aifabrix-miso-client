/**
 * Load .env from project root before any other app code.
 * Import this first in scripts that use loadConfig() (e.g. test_integration.ts)
 * so they read the same .env as integration API tests.
 */
import { loadIntegrationEnv } from "./tests/integration/load-env";

loadIntegrationEnv(__dirname);
