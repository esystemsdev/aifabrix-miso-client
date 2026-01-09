/**
 * Unit tests for error-handler
 */

import { Request, Response } from "express";
import {
  handleRouteError,
  setErrorLogger,
  ErrorLogger,
} from "../../src/express/error-handler";
import { AppError } from "../../src/express/error-types";
import { sendErrorResponse } from "../../src/express/error-response";

// Mock sendErrorResponse
jest.mock("../../src/express/error-response", () => ({
  ...jest.requireActual("../../src/express/error-response"),
  sendErrorResponse: jest.fn(),
}));

describe("error-handler", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockLogger: ErrorLogger;
  let stderrWriteSpy: jest.SpyInstance;

  beforeEach(() => {
    mockReq = {
      method: "GET",
      originalUrl: "/test",
      path: "/test",
      headers: {},
    };
    mockRes = {};

    mockLogger = {
      logError: jest.fn().mockResolvedValue(undefined),
    };

    // Spy on stderr.write
    stderrWriteSpy = jest
      .spyOn(process.stderr, "write")
      .mockImplementation(() => true);

    jest.clearAllMocks();
  });

  afterEach(() => {
    setErrorLogger(null);
    stderrWriteSpy.mockRestore();
  });

  describe("handleRouteError()", () => {
    it("should handle AppError with correct status code", async () => {
      const error = new AppError("Not found", 404);

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 404,
          detail: "Not found",
        }),
      );
    });

    it('should map "not found" error message to 404', async () => {
      const error = new Error("User not found");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 404,
        }),
      );
    });

    it('should map "already exists" error message to 409', async () => {
      const error = new Error("User already exists");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 409,
        }),
      );
    });

    it('should map "validation" error message to 400', async () => {
      const error = new Error("Validation failed");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 400,
        }),
      );
    });

    it('should map "unauthorized" error message to 401', async () => {
      const error = new Error("Unauthorized access");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 401,
        }),
      );
    });

    it('should map "forbidden" error message to 403', async () => {
      const error = new Error("Forbidden action");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 403,
        }),
      );
    });

    it("should default to 500 for unknown errors", async () => {
      const error = new Error("Something went wrong");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 500,
        }),
      );
    });

    it("should handle Prisma P2002 error (unique constraint)", async () => {
      const error = { code: "P2002", message: "Unique constraint failed" };

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 409,
        }),
      );
    });

    it("should handle Prisma P2025 error (not found)", async () => {
      const error = { code: "P2025", message: "Record not found" };

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 404,
        }),
      );
    });

    it("should handle Prisma P2003 error (foreign key)", async () => {
      const error = { code: "P2003", message: "Foreign key constraint" };

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          status: 400,
        }),
      );
    });

    it("should handle string errors", async () => {
      const error = "String error";

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          detail: "String error",
        }),
      );
    });

    it("should handle unknown error types", async () => {
      const error = { unknown: "object" };

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          detail: "[object Object]",
        }),
      );
    });

    it("should include operation name in log", async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");

      await handleRouteError(
        error,
        mockReq as Request,
        mockRes as Response,
        "testOperation",
      );

      expect(mockLogger.logError).toHaveBeenCalledWith(
        "testOperation failed: Test error",
        expect.any(Object),
      );
    });

    it('should fallback to "unknown operation" if no operation provided', async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.stringContaining("unknown operation failed"),
        expect.any(Object),
      );
    });

    it("should include correlation ID from request property", async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");
      (mockReq as Request & { correlationId?: string }).correlationId =
        "test-correlation-id";

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          correlationId: "test-correlation-id",
        }),
      );
    });

    it("should include correlation ID from header", async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");
      mockReq.headers = { "x-correlation-id": "header-correlation-id" };

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          correlationId: "header-correlation-id",
        }),
      );
    });

    it("should prefer request property over header for correlation ID", async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");
      (mockReq as Request & { correlationId?: string }).correlationId =
        "property-id";
      mockReq.headers = { "x-correlation-id": "header-id" };

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          correlationId: "property-id",
        }),
      );
    });

    it("should use AppError correlationId if available", async () => {
      const error = new AppError(
        "Error",
        400,
        true,
        undefined,
        undefined,
        undefined,
        "app-error-correlation-id",
      );

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          correlationId: "app-error-correlation-id",
        }),
      );
    });

    it("should generate correlation ID when none is present", async () => {
      const error = new Error("Test error");
      mockReq.headers = {}; // No correlation ID headers

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          correlationId: expect.stringMatching(/^express-\d+-[a-z0-9]+$/),
        }),
      );
    });

    it("should include validation errors from AppError", async () => {
      const validationErrors = [
        { field: "email", message: "Invalid email" },
        { field: "name", message: "Required" },
      ];
      const error = new AppError(
        "Validation failed",
        422,
        true,
        validationErrors,
      );

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(sendErrorResponse).toHaveBeenCalledWith(
        mockRes,
        expect.objectContaining({
          errors: validationErrors,
        }),
      );
    });
  });

  describe("setErrorLogger()", () => {
    it("should use custom logger when set", async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(mockLogger.logError).toHaveBeenCalled();
      expect(stderrWriteSpy).not.toHaveBeenCalled();
    });

    it("should fallback to stderr when no logger set", async () => {
      setErrorLogger(null);
      const error = new Error("Test error");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(stderrWriteSpy).toHaveBeenCalled();
      expect(stderrWriteSpy.mock.calls[0][0]).toContain("Test error");
    });

    it("should include stack trace in stderr output", async () => {
      setErrorLogger(null);
      const error = new Error("Test error");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      const allOutput = stderrWriteSpy.mock.calls
        .map((call) => call[0])
        .join("");
      expect(allOutput).toContain("Stack:");
    });

    it("should fallback to stderr if logger throws", async () => {
      const throwingLogger: ErrorLogger = {
        logError: jest.fn().mockRejectedValue(new Error("Logger failed")),
      };
      setErrorLogger(throwingLogger);
      const error = new Error("Test error");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(stderrWriteSpy).toHaveBeenCalled();
      expect(
        stderrWriteSpy.mock.calls.some((call) =>
          call[0].includes("Failed to log error"),
        ),
      ).toBe(true);
    });

    it("should accept synchronous logger", async () => {
      const syncLogger: ErrorLogger = {
        logError: jest.fn(), // Synchronous, no return value
      };
      setErrorLogger(syncLogger);
      const error = new Error("Test error");

      await handleRouteError(error, mockReq as Request, mockRes as Response);

      expect(syncLogger.logError).toHaveBeenCalled();
    });

    it("should pass error context to logger", async () => {
      setErrorLogger(mockLogger);
      const error = new Error("Test error");

      await handleRouteError(
        error,
        mockReq as Request,
        mockRes as Response,
        "testOp",
      );

      expect(mockLogger.logError).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operation: "testOp",
          statusCode: expect.any(Number),
          url: "/test",
          method: "GET",
          errorMessage: "Test error",
          errorName: "Error",
        }),
      );
    });
  });
});
