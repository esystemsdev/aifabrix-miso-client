/**
 * Unit tests for error-types
 */

import {
  AppError,
  ApiError,
  ValidationError,
  createSuccessResponse,
  createErrorResponse,
} from "../../src/express/error-types";

describe("error-types", () => {
  describe("AppError", () => {
    it("should create AppError with default values", () => {
      const error = new AppError("Test error");

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(true);
      expect(error.validationErrors).toEqual([]);
    });

    it("should create AppError with custom status code", () => {
      const error = new AppError("Not found", 404);

      expect(error.statusCode).toBe(404);
    });

    it("should create AppError with isOperational flag", () => {
      const error = new AppError("Fatal error", 500, false);

      expect(error.isOperational).toBe(false);
    });

    it("should create AppError with validation errors", () => {
      const validationErrors: ValidationError[] = [
        { field: "email", message: "Invalid email" },
        { field: "name", message: "Required" },
      ];
      const error = new AppError(
        "Validation failed",
        422,
        true,
        validationErrors,
      );

      expect(error.validationErrors).toEqual(validationErrors);
    });

    it("should create AppError with error type", () => {
      const error = new AppError("Error", 400, true, { errorType: "/Errors/Custom" });

      expect(error.errorType).toBe("/Errors/Custom");
    });

    it("should create AppError with instance", () => {
      const error = new AppError("Error", 400, true, { instance: "/api/users/123" });

      expect(error.instance).toBe("/api/users/123");
    });

    it("should create AppError with correlation ID", () => {
      const error = new AppError("Error", 400, true, { correlationId: "corr-123" });

      expect(error.correlationId).toBe("corr-123");
    });

    it("should capture stack trace", () => {
      const error = new AppError("Test error");

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
      expect(error.stack?.length).toBeGreaterThan(0);
    });

    it("should implement ApiError interface", () => {
      const error: ApiError = new AppError("Test", 500);

      expect(error.statusCode).toBeDefined();
      expect(error.isOperational).toBeDefined();
    });
  });

  describe("toErrorResponse()", () => {
    it("should convert AppError to RFC 7807 format", () => {
      const error = new AppError("Not found", 404);
      const response = error.toErrorResponse();

      expect(response).toEqual({
        type: "/Errors/NotFound",
        title: "Not Found",
        status: 404,
        detail: "Not found",
        instance: undefined,
        correlationId: undefined,
        errors: undefined,
      });
    });

    it("should use custom error type if provided", () => {
      const error = new AppError("Error", 400, true, { errorType: "/Errors/CustomType" });
      const response = error.toErrorResponse();

      expect(response.type).toBe("/Errors/CustomType");
    });

    it("should use instance from error if provided", () => {
      const error = new AppError("Error", 404, true, { instance: "/api/users/123" });
      const response = error.toErrorResponse();

      expect(response.instance).toBe("/api/users/123");
    });

    it("should use requestUrl as fallback for instance", () => {
      const error = new AppError("Error", 404);
      const response = error.toErrorResponse("/api/test");

      expect(response.instance).toBe("/api/test");
    });

    it("should include validation errors", () => {
      const validationErrors: ValidationError[] = [
        { field: "email", message: "Invalid" },
      ];
      const error = new AppError("Validation", 422, true, validationErrors);
      const response = error.toErrorResponse();

      expect(response.errors).toEqual(validationErrors);
    });

    it("should not include errors field if no validation errors", () => {
      const error = new AppError("Error", 400);
      const response = error.toErrorResponse();

      expect(response.errors).toBeUndefined();
    });

    it("should include correlation ID", () => {
      const error = new AppError("Error", 400, true, { correlationId: "corr-123" });
      const response = error.toErrorResponse();

      expect(response.correlationId).toBe("corr-123");
    });

    it("should map all common status codes correctly", () => {
      const statusTests = [
        { code: 400, type: "/Errors/BadRequest", title: "Bad Request" },
        { code: 401, type: "/Errors/Unauthorized", title: "Unauthorized" },
        { code: 403, type: "/Errors/Forbidden", title: "Forbidden" },
        { code: 404, type: "/Errors/NotFound", title: "Not Found" },
        { code: 409, type: "/Errors/Conflict", title: "Conflict" },
        {
          code: 422,
          type: "/Errors/UnprocessableEntity",
          title: "Unprocessable Entity",
        },
        {
          code: 500,
          type: "/Errors/InternalServerError",
          title: "Internal Server Error",
        },
      ];

      statusTests.forEach(({ code, type, title }) => {
        const error = new AppError("Test", code);
        const response = error.toErrorResponse();
        expect(response.type).toBe(type);
        expect(response.title).toBe(title);
      });
    });

    it("should default to 500 error type for unknown status codes", () => {
      const error = new AppError("Error", 418); // I'm a teapot
      const response = error.toErrorResponse();

      expect(response.type).toBe("/Errors/InternalServerError");
      expect(response.title).toBe("Internal Server Error");
    });
  });

  describe("createSuccessResponse()", () => {
    it("should create success response with data", () => {
      const data = { id: 1, name: "Test" };
      const response = createSuccessResponse(data);

      expect(response).toEqual({
        success: true,
        data,
        timestamp: expect.any(String),
      });
    });

    it("should include message when provided", () => {
      const data = { id: 1 };
      const response = createSuccessResponse(data, "Success message");

      expect(response.message).toBe("Success message");
    });

    it("should include correlation ID when provided", () => {
      const data = { id: 1 };
      const response = createSuccessResponse(data, undefined, "corr-123");

      expect(response.correlationId).toBe("corr-123");
    });

    it("should include both message and correlation ID", () => {
      const data = { id: 1 };
      const response = createSuccessResponse(data, "Message", "corr-123");

      expect(response.message).toBe("Message");
      expect(response.correlationId).toBe("corr-123");
    });

    it("should generate valid ISO timestamp", () => {
      const response = createSuccessResponse({});

      expect(response.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe("createErrorResponse()", () => {
    it("should create error response", () => {
      const response = createErrorResponse("Error message");

      expect(response).toEqual({
        success: false,
        error: "Error message",
        timestamp: expect.any(String),
      });
    });

    it("should include correlation ID when provided", () => {
      const response = createErrorResponse("Error", "corr-123");

      expect(response.correlationId).toBe("corr-123");
    });

    it("should generate valid ISO timestamp", () => {
      const response = createErrorResponse("Error");

      expect(response.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });
});
