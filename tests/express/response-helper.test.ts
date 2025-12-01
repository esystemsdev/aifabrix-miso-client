/**
 * Unit tests for ResponseHelper
 */

import { Response } from "express";
import {
  ResponseHelper,
  PaginationMeta,
} from "../../src/express/response-helper";
import { AppError } from "../../src/express/error-types";
import { createPaginatedListResponse } from "../../src/utils/pagination.utils";

// Mock the pagination utility
jest.mock("../../src/utils/pagination.utils");

describe("ResponseHelper", () => {
  let mockRes: Partial<Response>;
  let statusSpy: jest.Mock;
  let jsonSpy: jest.Mock;
  let sendSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn().mockReturnThis();
    sendSpy = jest.fn().mockReturnThis();
    statusSpy = jest.fn().mockReturnThis();

    mockRes = {
      status: statusSpy,
      json: jsonSpy,
      send: sendSpy,
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe("success()", () => {
    it("should return 200 status with data and timestamp", () => {
      const data = { id: 1, name: "Test" };

      ResponseHelper.success(mockRes as Response, data);

      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          timestamp: expect.any(String),
        }),
      );
    });

    it("should include message when provided", () => {
      const data = { id: 1 };
      const message = "Success message";

      ResponseHelper.success(mockRes as Response, data, message);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
          message,
          timestamp: expect.any(String),
        }),
      );
    });

    it("should allow custom status code", () => {
      const data = { id: 1 };

      ResponseHelper.success(mockRes as Response, data, undefined, 201);

      expect(statusSpy).toHaveBeenCalledWith(201);
    });

    it("should handle null data", () => {
      ResponseHelper.success(mockRes as Response, null);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: null,
        }),
      );
    });

    it("should handle array data", () => {
      const data = [1, 2, 3];

      ResponseHelper.success(mockRes as Response, data);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data,
        }),
      );
    });

    it("should generate valid ISO timestamp", () => {
      ResponseHelper.success(mockRes as Response, {});

      const call = jsonSpy.mock.calls[0][0];
      expect(call.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );
    });
  });

  describe("created()", () => {
    it("should return 201 status", () => {
      const data = { id: 1 };

      ResponseHelper.created(mockRes as Response, data);

      expect(statusSpy).toHaveBeenCalledWith(201);
    });

    it("should use default message", () => {
      const data = { id: 1 };

      ResponseHelper.created(mockRes as Response, data);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Resource created",
        }),
      );
    });

    it("should allow custom message", () => {
      const data = { id: 1 };
      const message = "User created";

      ResponseHelper.created(mockRes as Response, data, message);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
        }),
      );
    });
  });

  describe("paginated()", () => {
    it("should call createPaginatedListResponse with correct parameters", () => {
      const items = [{ id: 1 }, { id: 2 }];
      const meta: PaginationMeta = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 100,
        type: "user",
      };
      const mockResponse = { data: items, meta: {} };

      (createPaginatedListResponse as jest.Mock).mockReturnValue(mockResponse);

      ResponseHelper.paginated(mockRes as Response, items, meta);

      expect(createPaginatedListResponse).toHaveBeenCalledWith(
        items,
        100,
        1,
        20,
        "user",
      );
      expect(statusSpy).toHaveBeenCalledWith(200);
      expect(jsonSpy).toHaveBeenCalledWith(mockResponse);
    });

    it("should handle empty items array", () => {
      const items: unknown[] = [];
      const meta: PaginationMeta = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 0,
        type: "user",
      };
      const mockResponse = { data: [], meta: {} };

      (createPaginatedListResponse as jest.Mock).mockReturnValue(mockResponse);

      ResponseHelper.paginated(mockRes as Response, items, meta);

      expect(createPaginatedListResponse).toHaveBeenCalledWith(
        [],
        0,
        1,
        20,
        "user",
      );
    });

    it("should pass through totalPages if provided", () => {
      const items = [{ id: 1 }];
      const meta: PaginationMeta = {
        currentPage: 1,
        pageSize: 20,
        totalItems: 100,
        totalPages: 5,
        type: "user",
      };
      const mockResponse = { data: items, meta: {} };

      (createPaginatedListResponse as jest.Mock).mockReturnValue(mockResponse);

      ResponseHelper.paginated(mockRes as Response, items, meta);

      expect(createPaginatedListResponse).toHaveBeenCalled();
    });
  });

  describe("noContent()", () => {
    it("should return 204 status and call send()", () => {
      ResponseHelper.noContent(mockRes as Response);

      expect(statusSpy).toHaveBeenCalledWith(204);
      expect(sendSpy).toHaveBeenCalledWith();
    });
  });

  describe("accepted()", () => {
    it("should return 202 status", () => {
      const data = { jobId: "123" };

      ResponseHelper.accepted(mockRes as Response, data);

      expect(statusSpy).toHaveBeenCalledWith(202);
    });

    it("should use default message", () => {
      const data = { jobId: "123" };

      ResponseHelper.accepted(mockRes as Response, data);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Request accepted",
        }),
      );
    });

    it("should allow custom message", () => {
      const data = { jobId: "123" };
      const message = "Job queued";

      ResponseHelper.accepted(mockRes as Response, data, message);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          message,
        }),
      );
    });

    it("should handle undefined data", () => {
      ResponseHelper.accepted(mockRes as Response);

      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          data: undefined,
          message: "Request accepted",
        }),
      );
    });
  });

  describe("error()", () => {
    it("should throw AppError with default values", () => {
      expect(() => {
        ResponseHelper.error("Error message");
      }).toThrow(AppError);

      try {
        ResponseHelper.error("Error message");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect((error as AppError).message).toBe("Error message");
        expect((error as AppError).statusCode).toBe(400);
        expect((error as AppError).isOperational).toBe(true);
      }
    });

    it("should throw AppError with custom status code", () => {
      try {
        ResponseHelper.error("Not found", 404);
      } catch (error) {
        expect((error as AppError).statusCode).toBe(404);
      }
    });

    it("should throw AppError with isOperational flag", () => {
      try {
        ResponseHelper.error("Error", 500, false);
      } catch (error) {
        expect((error as AppError).isOperational).toBe(false);
      }
    });

    it("should throw AppError with validation errors", () => {
      const validationErrors = [{ field: "email", message: "Invalid email" }];

      try {
        ResponseHelper.error("Validation failed", 422, true, validationErrors);
      } catch (error) {
        expect((error as AppError).validationErrors).toEqual(validationErrors);
      }
    });

    it("should throw AppError with error type", () => {
      try {
        ResponseHelper.error("Error", 400, true, undefined, "/Errors/Custom");
      } catch (error) {
        expect((error as AppError).errorType).toBe("/Errors/Custom");
      }
    });
  });
});
