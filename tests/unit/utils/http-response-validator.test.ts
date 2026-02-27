/**
 * Unit tests for HTTP response validator
 */

import { validateHttpResponse } from "../../../src/utils/http-response-validator";
import { MisoClientConfig } from "../../../src/types/config.types";

describe("http-response-validator", () => {
  const baseConfig: MisoClientConfig = {
    controllerUrl: "https://controller.aifabrix.ai",
    clientId: "test-client",
    clientSecret: "secret",
    validateResponses: true,
  };

  it("should accept minimal log response with data null for logs endpoint", () => {
    const result = validateHttpResponse(
      { data: null },
      "/api/v1/logs",
      baseConfig,
    );
    expect(result).toBe(true);
  });

  it("should accept minimal batch response in data for logs endpoint", () => {
    const result = validateHttpResponse(
      { data: { processed: 2, failed: 0 } },
      "/api/v1/logs/batch",
      baseConfig,
    );
    expect(result).toBe(true);
  });

  it("should accept minimal batch response at top level for logs endpoint", () => {
    const result = validateHttpResponse(
      { processed: 3, failed: 1 },
      "/api/logs/batch",
      baseConfig,
    );
    expect(result).toBe(true);
  });

  it("should not accept minimal response for non-logs endpoint", () => {
    const result = validateHttpResponse(
      { data: null },
      "/api/v1/auth/login",
      baseConfig,
    );
    expect(result).toBe(false);
  });
});
