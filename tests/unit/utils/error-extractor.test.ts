/**
 * Unit tests for error extraction utility
 */

import { extractErrorInfo } from "../../../src/utils/error-extractor";
import { MisoClientError } from "../../../src/utils/errors";
import {
  ApiError,
  AuthenticationError,
  NetworkError,
  TimeoutError,
} from "../../../src/types/data-client.types";
import { ErrorResponse } from "../../../src/types/config.types";

describe("extractErrorInfo", () => {
  describe("MisoClientError", () => {
    it("should extract error info from MisoClientError with errorResponse", () => {
      const errorResponse: ErrorResponse & { correlationId: string } = {
        errors: ["Validation failed"],
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
        instance: "/api/users",
        correlationId: "corr-123",
      };

      const error = new MisoClientError("Bad Request", errorResponse);
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/users",
        method: "POST",
      });

      expect(errorInfo.errorType).toBe("MisoClientError");
      expect(errorInfo.errorName).toBe("MisoClientError");
      expect(errorInfo.message).toBe("Bad Request");
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.correlationId).toBe("corr-123");
      expect(errorInfo.endpoint).toBe("/api/users");
      expect(errorInfo.method).toBe("POST");
      expect(errorInfo.responseBody).toEqual({
        errors: ["Validation failed"],
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
        instance: "/api/users",
        correlationId: "corr-123",
      });
      expect(errorInfo.stackTrace).toBeDefined();
    });

    it("should extract error info from MisoClientError with errorBody", () => {
      const errorBody = {
        error: "Invalid request",
        code: "INVALID_REQUEST",
      };

      const error = new MisoClientError("Invalid request", undefined, errorBody, 400);
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("MisoClientError");
      expect(errorInfo.message).toBe("Invalid request");
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.responseBody).toEqual(errorBody);
    });

    it("should prefer correlationId from options over errorResponse", () => {
      const errorResponse: ErrorResponse & { correlationId: string } = {
        errors: ["Error"],
        type: "/Errors/InternalServerError",
        title: "Internal Server Error",
        statusCode: 500,
        correlationId: "corr-from-error",
      };

      const error = new MisoClientError("Internal Server Error", errorResponse);
      const errorInfo = extractErrorInfo(error, {
        correlationId: "corr-from-options",
      });

      expect(errorInfo.correlationId).toBe("corr-from-options");
    });

    it("should use correlationId from errorResponse when not in options", () => {
      const errorResponse: ErrorResponse & { correlationId: string } = {
        errors: ["Error"],
        type: "/Errors/InternalServerError",
        title: "Internal Server Error",
        statusCode: 500,
        correlationId: "corr-from-error",
      };

      const error = new MisoClientError("Internal Server Error", errorResponse);
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.correlationId).toBe("corr-from-error");
    });
  });

  describe("ApiError", () => {
    it("should extract error info from ApiError", () => {
      const originalError = new Error("Original error");
      const error = new ApiError("Request failed", 400, undefined, originalError);
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/test",
        method: "GET",
      });

      expect(errorInfo.errorType).toBe("ApiError");
      expect(errorInfo.errorName).toBe("ApiError");
      expect(errorInfo.message).toBe("Request failed");
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.endpoint).toBe("/api/test");
      expect(errorInfo.method).toBe("GET");
      expect(errorInfo.originalError).toBe(originalError);
      expect(errorInfo.stackTrace).toBeDefined();
    });

    it("should extract response body info from ApiError with response", () => {
      const mockResponse = {} as Response;
      const error = new ApiError("Request failed", 400, mockResponse);
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("ApiError");
      expect(errorInfo.responseBody).toEqual({
        status: 400,
        message: "Request failed",
      });
    });

    it("should handle ApiError without response", () => {
      const error = new ApiError("Request failed", 400);
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("ApiError");
      expect(errorInfo.statusCode).toBe(400);
      expect(errorInfo.responseBody).toBeUndefined();
    });
  });

  describe("AuthenticationError", () => {
    it("should extract error info from AuthenticationError", () => {
      const error = new AuthenticationError("Authentication required");
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/auth",
        method: "POST",
      });

      expect(errorInfo.errorType).toBe("AuthenticationError");
      expect(errorInfo.errorName).toBe("AuthenticationError");
      expect(errorInfo.message).toBe("Authentication required");
      expect(errorInfo.statusCode).toBe(401);
      expect(errorInfo.endpoint).toBe("/api/auth");
      expect(errorInfo.method).toBe("POST");
      expect(errorInfo.stackTrace).toBeDefined();
    });
  });

  describe("NetworkError", () => {
    it("should extract error info from NetworkError", () => {
      const originalError = new Error("Network failure");
      const error = new NetworkError("Connection failed", originalError);
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("NetworkError");
      expect(errorInfo.errorName).toBe("NetworkError");
      expect(errorInfo.message).toBe("Connection failed");
      expect(errorInfo.statusCode).toBe(0);
      expect(errorInfo.originalError).toBe(originalError);
      expect(errorInfo.stackTrace).toBeDefined();
    });
  });

  describe("TimeoutError", () => {
    it("should extract error info from TimeoutError", () => {
      const error = new TimeoutError("Request timeout", 5000);
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/slow",
        method: "GET",
      });

      expect(errorInfo.errorType).toBe("TimeoutError");
      expect(errorInfo.errorName).toBe("TimeoutError");
      expect(errorInfo.message).toBe("Request timeout");
      expect(errorInfo.statusCode).toBe(408);
      expect(errorInfo.endpoint).toBe("/api/slow");
      expect(errorInfo.method).toBe("GET");
      expect(errorInfo.stackTrace).toBeDefined();
    });
  });

  describe("generic Error", () => {
    it("should extract error info from generic Error", () => {
      const error = new Error("Generic error message");
      const errorInfo = extractErrorInfo(error, {
        correlationId: "test-correlation-id",
      });

      expect(errorInfo.errorType).toBe("Error");
      expect(errorInfo.errorName).toBe("Error");
      expect(errorInfo.message).toBe("Generic error message");
      expect(errorInfo.correlationId).toBe("test-correlation-id");
      expect(errorInfo.stackTrace).toBeDefined();
    });
  });

  describe("unknown error types", () => {
    it("should handle string errors", () => {
      const error = "String error";
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("Unknown");
      expect(errorInfo.errorName).toBe("UnknownError");
      expect(errorInfo.message).toBe("String error");
    });

    it("should handle object with message property", () => {
      const error = { message: "Object error message" };
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("Unknown");
      expect(errorInfo.errorName).toBe("UnknownError");
      expect(errorInfo.message).toBe("Object error message");
    });

    it("should handle null", () => {
      const errorInfo = extractErrorInfo(null);

      expect(errorInfo.errorType).toBe("Unknown");
      expect(errorInfo.errorName).toBe("UnknownError");
      expect(errorInfo.message).toBe("Unknown error occurred");
    });

    it("should handle undefined", () => {
      const errorInfo = extractErrorInfo(undefined);

      expect(errorInfo.errorType).toBe("Unknown");
      expect(errorInfo.errorName).toBe("UnknownError");
      expect(errorInfo.message).toBe("Unknown error occurred");
    });

    it("should handle object without message property", () => {
      const error = { code: 500 };
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.errorType).toBe("Unknown");
      expect(errorInfo.errorName).toBe("UnknownError");
      expect(errorInfo.message).toBe("Unknown error occurred");
    });
  });

  describe("options handling", () => {
    it("should include endpoint and method from options", () => {
      const error = new Error("Test error");
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/test",
        method: "POST",
        correlationId: "test-correlation",
      });

      expect(errorInfo.endpoint).toBe("/api/test");
      expect(errorInfo.method).toBe("POST");
      expect(errorInfo.correlationId).toBe("test-correlation");
    });

    it("should handle missing options", () => {
      const error = new Error("Test error");
      const errorInfo = extractErrorInfo(error);

      expect(errorInfo.endpoint).toBeUndefined();
      expect(errorInfo.method).toBeUndefined();
      expect(errorInfo.correlationId).toBeUndefined();
    });

    it("should handle partial options", () => {
      const error = new Error("Test error");
      const errorInfo = extractErrorInfo(error, {
        endpoint: "/api/test",
      });

      expect(errorInfo.endpoint).toBe("/api/test");
      expect(errorInfo.method).toBeUndefined();
    });
  });
});
