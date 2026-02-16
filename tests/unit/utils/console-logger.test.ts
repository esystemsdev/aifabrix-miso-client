/**
 * Unit tests for console logger utility
 */

import { logErrorWithContext } from "../../../src/utils/console-logger";
import { StructuredErrorInfo } from "../../../src/utils/error-extractor";

describe("logErrorWithContext", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("logs basic error with default prefix", () => {
    const errorInfo: StructuredErrorInfo = {
      errorType: "Error",
      errorName: "Error",
      message: "Test error",
    };

    logErrorWithContext(errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[MisoClient] [no-correlation-id]",
      "Error: Test error",
    );
  });

  it("logs status and endpoint context", () => {
    const errorInfo: StructuredErrorInfo = {
      errorType: "ApiError",
      errorName: "ApiError",
      message: "Request failed",
      statusCode: 400,
      endpoint: "/api/users",
      method: "POST",
    };

    logErrorWithContext(errorInfo, "[DataClient]");

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[DataClient] [no-correlation-id]",
      "ApiError: Request failed | Status: 400 | Endpoint: POST /api/users",
    );
  });

  it("logs response body as separate call", () => {
    const errorInfo: StructuredErrorInfo = {
      errorType: "ApiError",
      errorName: "ApiError",
      message: "Request failed",
      correlationId: "corr-123",
      responseBody: { errors: ["Validation failed"] },
    };

    logErrorWithContext(errorInfo);

    expect(consoleErrorSpy).toHaveBeenNthCalledWith(
      2,
      "[MisoClient] [corr-123]",
      `Response Body: ${JSON.stringify(errorInfo.responseBody, null, 2)}`,
    );
  });

  it("logs stack trace when provided", () => {
    const errorInfo: StructuredErrorInfo = {
      errorType: "Error",
      errorName: "Error",
      message: "Test error",
      correlationId: "corr-123",
      stackTrace: "stack-value",
    };

    logErrorWithContext(errorInfo);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[MisoClient] [corr-123]",
      "Stack Trace: stack-value",
    );
  });
});
