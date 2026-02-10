/**
 * Load .env from project root for integration tests.
 * Use this BEFORE importing anything that uses loadConfig() or dotenv
 * so that MISO_* and TEST_* variables come from the same .env as API tests.
 *
 * Usage:
 * - From tests/integration/*.test.ts: loadIntegrationEnv(resolve(__dirname, "../.."))
 * - From project root (e.g. test_integration.ts): loadIntegrationEnv(__dirname)
 */

import { join } from "path";
import { existsSync } from "fs";

/**
 * Load environment variables from .env at the given project root.
 * Same behavior as api-endpoints.integration.test.ts: try projectRoot/.env,
 * then process.cwd()/.env, then dotenv default.
 */
export function loadIntegrationEnv(projectRoot: string): void {
  const envPath = join(projectRoot, ".env");
  if (existsSync(envPath)) {
    require("dotenv").config({ path: envPath });
    return;
  }
  const cwdEnvPath = join(process.cwd(), ".env");
  if (existsSync(cwdEnvPath)) {
    require("dotenv").config({ path: cwdEnvPath });
    return;
  }
  require("dotenv").config();
}
