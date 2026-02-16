/**
 * Unit tests for console logger utility
 */

import { logErrorWithContext } from "../../../src/utils/console-logger";
import { StructuredErrorInfo } from "../../../src/utils/error-extractor";

describe("logErrorWithContext", () => {
  let stderrWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    stderrWriteSpy = jest.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    stderrWriteSpy.mockRestore();
  });

  describe("basic logging", () => {
    it("should log error with default prefix", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] Error: Test error\n",
      );
    });

    it("should log error with custom prefix", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
        correlationId: "corr-123",
      };

      logErrorWithContext(errorInfo, "[DataClient]");

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[DataClient] [corr-123] Error: Test error\n",
      );
    });

    it("should use correlationId from errorInfo", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
        correlationId: "test-correlation-id",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [test-correlation-id] Error: Test error\n",
      );
    });

    it("should use no-correlation-id when correlationId is missing", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] Error: Test error\n",
      );
    });
  });

  describe("status code logging", () => {
    it("should include status code in log message", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        statusCode: 400,
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] ApiError: Request failed | Status: 400\n",
      );
    });

    it("should not include status code when undefined", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] Error: Test error\n",
      );
    });
  });

  describe("endpoint and method logging", () => {
    it("should include endpoint and method when both present", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        statusCode: 400,
        endpoint: "/api/users",
        method: "POST",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] ApiError: Request failed | Status: 400 | Endpoint: POST /api/users\n",
      );
    });

    it("should include only endpoint when method is missing", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        endpoint: "/api/users",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] ApiError: Request failed | Endpoint: /api/users\n",
      );
    });

    it("should include only method when endpoint is missing", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        method: "POST",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] ApiError: Request failed | Method: POST\n",
      );
    });

    it("should not include endpoint or method when both missing", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledWith(
        "[MisoClient] [no-correlation-id] Error: Test error\n",
      );
    });
  });

  describe("response body logging", () => {
    it("should log response body when available", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        correlationId: "corr-123",
        responseBody: {
          errors: ["Validation failed"],
          type: "/Errors/BadRequest",
        },
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledTimes(2);
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        1,
        "[MisoClient] [corr-123] ApiError: Request failed\n",
      );
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        2,
        `[MisoClient] [corr-123] Response Body: ${JSON.stringify(errorInfo.responseBody, null, 2)}\n`,
      );
    });

    it("should not log response body when not available", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("stack trace logging", () => {
    it("should log stack trace when available", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
        correlationId: "corr-123",
        stackTrace: "Error: Test error\n    at test.js:1:1",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledTimes(2);
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        1,
        "[MisoClient] [corr-123] Error: Test error\n",
      );
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        2,
        `[MisoClient] [corr-123] Stack Trace: ${errorInfo.stackTrace}\n`,
      );
    });

    it("should not log stack trace when not available", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("original error logging", () => {
    it("should log original error when available", () => {
      const originalError = new Error("Original error");
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        correlationId: "corr-123",
        originalError,
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledTimes(2);
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        1,
        "[MisoClient] [corr-123] ApiError: Request failed\n",
      );
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        2,
        `[MisoClient] [corr-123] Original Error: ${String(originalError)}\n`,
      );
    });

    it("should not log original error when not available", () => {
      const errorInfo: StructuredErrorInfo = {
        errorType: "Error",
        errorName: "Error",
        message: "Test error",
      };

      logErrorWithContext(errorInfo);

      expect(stderrWriteSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("complex error logging", () => {
    it("should log all available information", () => {
      const originalError = new Error("Original error");
      const errorInfo: StructuredErrorInfo = {
        errorType: "ApiError",
        errorName: "ApiError",
        message: "Request failed",
        statusCode: 400,
        correlationId: "corr-123",
        endpoint: "/api/users",
        method: "POST",
        responseBody: {
          errors: ["Validation failed"],
        },
        stackTrace: "Error: Request failed\n    at test.js:1:1",
        originalError,
      };

      logErrorWithContext(errorInfo, "[DataClient] [AUTH]");

      expect(stderrWriteSpy).toHaveBeenCalledTimes(4);
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        1,
        "[DataClient] [AUTH] [corr-123] ApiError: Request failed | Status: 400 | Endpoint: POST /api/users\n",
      );
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        2,
        `[DataClient] [AUTH] [corr-123] Response Body: ${JSON.stringify(errorInfo.responseBody, null, 2)}\n`,
      );
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        3,
        `[DataClient] [AUTH] [corr-123] Stack Trace: ${errorInfo.stackTrace}\n`,
      );
      expect(stderrWriteSpy).toHaveBeenNthCalledWith(
        4,
        `[DataClient] [AUTH] [corr-123] Original Error: ${String(originalError)}\n`,
      );
    });
  });
});
