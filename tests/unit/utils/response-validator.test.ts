/**
 * Unit tests for response validator utilities
 */

import {
  validateSuccessResponse,
  validatePaginatedResponse,
  validateErrorResponse,
  getResponseType,
  SuccessResponse,
  PaginatedResponse,
} from "../../../src/utils/response-validator";
import { ErrorResponse } from "../../../src/types/config.types";

describe("Response Validator", () => {
  describe("validateSuccessResponse", () => {
    it("should validate valid success response with all fields", () => {
      const response: SuccessResponse = {
        success: true,
        data: { id: "123", name: "Test" },
        message: "Success",
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(true);
    });

    it("should validate valid success response with only required fields", () => {
      const response: SuccessResponse = {
        success: true,
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(true);
    });

    it("should validate success response with null data", () => {
      const response: SuccessResponse = {
        success: true,
        data: null as unknown as undefined,
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(true);
    });

    it("should validate success response without data field", () => {
      const response = {
        success: true,
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(true);
    });

    it("should reject response without success field", () => {
      const response = {
        data: { id: "123" },
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(false);
    });

    it("should reject response with non-boolean success", () => {
      const response = {
        success: "true",
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(false);
    });

    it("should reject response without timestamp", () => {
      const response = {
        success: true,
        data: { id: "123" },
      };

      expect(validateSuccessResponse(response)).toBe(false);
    });

    it("should reject response with non-string timestamp", () => {
      const response = {
        success: true,
        timestamp: 1234567890,
      };

      expect(validateSuccessResponse(response)).toBe(false);
    });

    it("should reject response with non-string message", () => {
      const response = {
        success: true,
        message: 123,
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(validateSuccessResponse(response)).toBe(false);
    });

    it("should reject null response", () => {
      expect(validateSuccessResponse(null)).toBe(false);
    });

    it("should reject non-object response", () => {
      expect(validateSuccessResponse("string")).toBe(false);
      expect(validateSuccessResponse(123)).toBe(false);
      expect(validateSuccessResponse([])).toBe(false);
    });
  });

  describe("validatePaginatedResponse", () => {
    it("should validate valid paginated response with all fields", () => {
      const response: PaginatedResponse = {
        data: [{ id: "1" }, { id: "2" }],
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
        links: {
          first: "/api/users?page=1",
          prev: undefined,
          next: "/api/users?page=2",
          last: "/api/users?page=10",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(true);
    });

    it("should validate paginated response without links", () => {
      const response: PaginatedResponse = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 1,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(true);
    });

    it("should validate paginated response with empty data array", () => {
      const response: PaginatedResponse = {
        data: [],
        meta: {
          totalItems: 0,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(true);
    });

    it("should reject response without data field", () => {
      const response = {
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with non-array data", () => {
      const response = {
        data: { id: "1" },
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response without meta field", () => {
      const response = {
        data: [{ id: "1" }],
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with invalid meta.totalItems", () => {
      const response = {
        data: [{ id: "1" }],
        meta: {
          totalItems: "100",
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with invalid meta.currentPage", () => {
      const response = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 100,
          currentPage: "1",
          pageSize: 10,
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with invalid meta.pageSize", () => {
      const response = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: "10",
          type: "users",
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with invalid meta.type", () => {
      const response = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: 10,
          type: 123,
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with invalid links (non-object)", () => {
      const response = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
        links: "invalid",
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject response with invalid links.first (non-string)", () => {
      const response = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 100,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
        links: {
          first: 123,
        },
      };

      expect(validatePaginatedResponse(response)).toBe(false);
    });

    it("should reject null response", () => {
      expect(validatePaginatedResponse(null)).toBe(false);
    });

    it("should reject non-object response", () => {
      expect(validatePaginatedResponse("string")).toBe(false);
      expect(validatePaginatedResponse(123)).toBe(false);
      expect(validatePaginatedResponse([])).toBe(false);
    });
  });

  describe("validateErrorResponse", () => {
    it("should validate valid error response", () => {
      const response: ErrorResponse = {
        errors: ["Error message"],
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
        instance: "/api/users",
        correlationId: "corr-123",
      };

      expect(validateErrorResponse(response)).toBe(true);
    });

    it("should validate error response with minimal fields", () => {
      const response: ErrorResponse = {
        errors: ["Error message"],
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(validateErrorResponse(response)).toBe(true);
    });

    it("should reject error response without errors array", () => {
      const response = {
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(validateErrorResponse(response)).toBe(false);
    });

    it("should reject error response with non-array errors", () => {
      const response = {
        errors: "Error message",
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(validateErrorResponse(response)).toBe(false);
    });

    it("should reject error response with non-string error items", () => {
      const response = {
        errors: [123],
        type: "/Errors/BadRequest",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(validateErrorResponse(response)).toBe(false);
    });

    it("should reject null response", () => {
      expect(validateErrorResponse(null)).toBe(false);
    });
  });

  describe("getResponseType", () => {
    it("should return 'success' for success response", () => {
      const response: SuccessResponse = {
        success: true,
        timestamp: "2024-01-01T00:00:00Z",
      };

      expect(getResponseType(response)).toBe("success");
    });

    it("should return 'paginated' for paginated response", () => {
      const response: PaginatedResponse = {
        data: [{ id: "1" }],
        meta: {
          totalItems: 1,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
      };

      expect(getResponseType(response)).toBe("paginated");
    });

    it("should return 'unknown' for invalid response", () => {
      const response = {
        invalid: "data",
      };

      expect(getResponseType(response)).toBe("unknown");
    });

    it("should return 'unknown' for null", () => {
      expect(getResponseType(null)).toBe("unknown");
    });

    it("should prioritize success over paginated when both match", () => {
      // This shouldn't happen in practice, but test the behavior
      const response = {
        success: true,
        data: [{ id: "1" }],
        meta: {
          totalItems: 1,
          currentPage: 1,
          pageSize: 10,
          type: "users",
        },
        timestamp: "2024-01-01T00:00:00Z",
      };

      // Success response validator checks first, so it should match
      expect(getResponseType(response)).toBe("success");
    });
  });
});

