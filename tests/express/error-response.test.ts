/**
 * Unit tests for error-response
 */

import { Request, Response } from "express";
import {
  createErrorResponse,
  sendErrorResponse,
  getErrorTypeUri,
  getErrorTitle,
  ErrorResponse,
} from "../../src/express/error-response";
import { ValidationError } from "../../src/express/error-types";

describe("error-response", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let setHeaderSpy: jest.Mock;
  let statusSpy: jest.Mock;
  let jsonSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn().mockReturnThis();
    setHeaderSpy = jest.fn();
    statusSpy = jest.fn().mockReturnThis();

    mockReq = {
      originalUrl: "/api/test",
      headers: {},
    };

    mockRes = {
      setHeader: setHeaderSpy,
      status: statusSpy,
      json: jsonSpy,
    };

    jest.clearAllMocks();
  });

  describe("getErrorTypeUri()", () => {
    it("should return correct URI for standard status codes", () => {
      expect(getErrorTypeUri(400)).toBe("/Errors/BadRequest");
      expect(getErrorTypeUri(401)).toBe("/Errors/Unauthorized");
      expect(getErrorTypeUri(403)).toBe("/Errors/Forbidden");
      expect(getErrorTypeUri(404)).toBe("/Errors/NotFound");
      expect(getErrorTypeUri(409)).toBe("/Errors/Conflict");
      expect(getErrorTypeUri(422)).toBe("/Errors/UnprocessableEntity");
      expect(getErrorTypeUri(500)).toBe("/Errors/InternalServerError");
    });

    it("should default to InternalServerError for unknown codes", () => {
      expect(getErrorTypeUri(418)).toBe("/Errors/InternalServerError");
      expect(getErrorTypeUri(999)).toBe("/Errors/InternalServerError");
    });
  });

  describe("getErrorTitle()", () => {
    it("should return correct title for standard status codes", () => {
      expect(getErrorTitle(400)).toBe("Bad Request");
      expect(getErrorTitle(401)).toBe("Unauthorized");
      expect(getErrorTitle(403)).toBe("Forbidden");
      expect(getErrorTitle(404)).toBe("Not Found");
      expect(getErrorTitle(409)).toBe("Conflict");
      expect(getErrorTitle(500)).toBe("Internal Server Error");
    });

    it("should default to Internal Server Error for unknown codes", () => {
      expect(getErrorTitle(418)).toBe("Internal Server Error");
      expect(getErrorTitle(999)).toBe("Internal Server Error");
    });
  });

  describe("createErrorResponse()", () => {
    it("should create error response from Error object", () => {
      const error = new Error("Test error");
      const response = createErrorResponse(error, 500, mockReq as Request);

      expect(response).toEqual({
        type: "/Errors/InternalServerError",
        title: "Internal Server Error",
        status: 500,
        detail: "Test error",
        instance: "/api/test",
      });
    });

    it("should create error response from string", () => {
      const response = createErrorResponse(
        "String error",
        400,
        mockReq as Request,
      );

      expect(response.detail).toBe("String error");
      expect(response.status).toBe(400);
    });

    it("should handle null error", () => {
      const response = createErrorResponse(null, 500);

      expect(response.detail).toBe("An error occurred");
    });

    it("should handle undefined error", () => {
      const response = createErrorResponse(undefined, 500);

      expect(response.detail).toBe("An error occurred");
    });

    it("should handle unknown error types", () => {
      const response = createErrorResponse({ unknown: "object" }, 500);

      expect(response.detail).toBe("[object Object]");
    });

    it("should include correlation ID from parameter", () => {
      const response = createErrorResponse(
        "Error",
        500,
        undefined,
        "param-corr-id",
      );

      expect(response.correlationId).toBe("param-corr-id");
    });

    it("should include correlation ID from request property", () => {
      const reqWithCorr = {
        ...mockReq,
        correlationId: "req-corr-id",
      } as Request & { correlationId?: string };
      const response = createErrorResponse("Error", 500, reqWithCorr);

      expect(response.correlationId).toBe("req-corr-id");
    });

    it("should include correlation ID from header", () => {
      mockReq.headers = { "x-correlation-id": "header-corr-id" };
      const response = createErrorResponse("Error", 500, mockReq as Request);

      expect(response.correlationId).toBe("header-corr-id");
    });

    it("should prefer parameter over request property", () => {
      const reqWithCorr = {
        ...mockReq,
        correlationId: "req-corr-id",
      } as Request & { correlationId?: string };
      const response = createErrorResponse(
        "Error",
        500,
        reqWithCorr,
        "param-corr-id",
      );

      expect(response.correlationId).toBe("param-corr-id");
    });

    it("should include validation errors", () => {
      const validationErrors: ValidationError[] = [
        { field: "email", message: "Invalid email", value: "bad-email" },
        { field: "age", message: "Must be positive", value: -5 },
      ];
      const response = createErrorResponse(
        "Validation failed",
        422,
        undefined,
        undefined,
        validationErrors,
      );

      expect(response.errors).toEqual(validationErrors);
    });

    it("should not include empty validation errors array", () => {
      const response = createErrorResponse(
        "Error",
        400,
        undefined,
        undefined,
        [],
      );

      expect(response.errors).toBeUndefined();
    });

    it("should include instance from request originalUrl", () => {
      mockReq.originalUrl = "/api/users/123";
      const response = createErrorResponse("Error", 404, mockReq as Request);

      expect(response.instance).toBe("/api/users/123");
    });

    it("should handle request without originalUrl", () => {
      const reqWithoutUrl = { headers: {} } as Request;
      const response = createErrorResponse("Error", 500, reqWithoutUrl);

      expect(response.instance).toBeUndefined();
    });

    it("should create RFC 7807 compliant structure", () => {
      const response = createErrorResponse(
        "Test",
        404,
        mockReq as Request,
        "corr-123",
      );

      // Required fields
      expect(response).toHaveProperty("type");
      expect(response).toHaveProperty("title");
      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("detail");

      // Type should be URI
      expect(response.type).toContain("/Errors/");
    });
  });

  describe("sendErrorResponse()", () => {
    it("should set Content-Type header to application/problem+json", () => {
      const errorResponse: ErrorResponse = {
        type: "/Errors/NotFound",
        title: "Not Found",
        status: 404,
        detail: "Resource not found",
      };

      sendErrorResponse(mockRes as Response, errorResponse);

      expect(setHeaderSpy).toHaveBeenCalledWith(
        "Content-Type",
        "application/problem+json",
      );
    });

    it("should set status code from error response", () => {
      const errorResponse: ErrorResponse = {
        type: "/Errors/BadRequest",
        title: "Bad Request",
        status: 400,
        detail: "Invalid input",
      };

      sendErrorResponse(mockRes as Response, errorResponse);

      expect(statusSpy).toHaveBeenCalledWith(400);
    });

    it("should send JSON response", () => {
      const errorResponse: ErrorResponse = {
        type: "/Errors/NotFound",
        title: "Not Found",
        status: 404,
        detail: "Not found",
      };

      sendErrorResponse(mockRes as Response, errorResponse);

      expect(jsonSpy).toHaveBeenCalledWith(errorResponse);
    });

    it("should handle error response with all fields", () => {
      const errorResponse: ErrorResponse = {
        type: "/Errors/UnprocessableEntity",
        title: "Unprocessable Entity",
        status: 422,
        detail: "Validation failed",
        instance: "/api/users",
        correlationId: "corr-123",
        errors: [{ field: "email", message: "Invalid" }],
        required: { permissions: ["users:create"] },
        missing: { permissions: ["users:create"] },
      };

      sendErrorResponse(mockRes as Response, errorResponse);

      expect(jsonSpy).toHaveBeenCalledWith(errorResponse);
    });
  });

  describe("RFC 7807 compliance", () => {
    it("should include required fields", () => {
      const response = createErrorResponse("Error", 404);

      expect(response).toHaveProperty("type");
      expect(response).toHaveProperty("title");
      expect(response).toHaveProperty("status");
      expect(response).toHaveProperty("detail");
    });

    it("should support optional fields", () => {
      const validationErrors: ValidationError[] = [
        { field: "test", message: "error" },
      ];
      const response = createErrorResponse(
        "Error",
        422,
        mockReq as Request,
        "corr-123",
        validationErrors,
      );

      expect(response).toHaveProperty("instance");
      expect(response).toHaveProperty("correlationId");
      expect(response).toHaveProperty("errors");
    });

    it("should allow custom extensions (RBAC)", () => {
      const response: ErrorResponse = {
        type: "/Errors/Forbidden",
        title: "Forbidden",
        status: 403,
        detail: "Insufficient permissions",
        required: { permissions: ["users:delete"] },
        missing: { permissions: ["users:delete"] },
        userPermissions: ["users:read"],
        userRoles: ["user"],
      };

      expect(response.required).toBeDefined();
      expect(response.missing).toBeDefined();
      expect(response.userPermissions).toBeDefined();
      expect(response.userRoles).toBeDefined();
    });
  });
});
