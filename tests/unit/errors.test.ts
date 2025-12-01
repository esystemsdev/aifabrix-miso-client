/**
 * Unit tests for error handling
 */

import { ErrorResponse, isErrorResponse } from "../../src/types/config.types";
import { MisoClientError } from "../../src/utils/errors";

describe("isErrorResponse", () => {
  describe("valid error response structures", () => {
    it("should validate correct error response with camelCase statusCode", () => {
      const validResponse: ErrorResponse = {
        errors: ["Error message 1", "Error message 2"],
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: 400,
        instance: "/api/test",
      };

      expect(isErrorResponse(validResponse)).toBe(true);
    });

    it("should validate correct error response with camelCase statusCode", () => {
      const validResponse: ErrorResponse = {
        errors: ["Error message"],
        type: "/Errors/Validation Error",
        title: "Validation Failed",
        statusCode: 422,
      };

      expect(isErrorResponse(validResponse)).toBe(true);
    });

    it("should validate error response without instance field", () => {
      const validResponse = {
        errors: ["Error message"],
        type: "/Errors/Internal Error",
        title: "Internal Server Error",
        statusCode: 500,
      };

      expect(isErrorResponse(validResponse)).toBe(true);
    });

    it("should validate error response with empty errors array", () => {
      const validResponse = {
        errors: [],
        type: "/Errors/Unknown",
        title: "Unknown Error",
        statusCode: 500,
      };

      expect(isErrorResponse(validResponse)).toBe(true);
    });
  });

  describe("invalid error response structures", () => {
    it("should reject null", () => {
      expect(isErrorResponse(null)).toBe(false);
    });

    it("should reject undefined", () => {
      expect(isErrorResponse(undefined)).toBe(false);
    });

    it("should reject string", () => {
      expect(isErrorResponse("not an object")).toBe(false);
    });

    it("should reject number", () => {
      expect(isErrorResponse(123)).toBe(false);
    });

    it("should reject empty object", () => {
      expect(isErrorResponse({})).toBe(false);
    });

    it("should reject missing errors field", () => {
      const invalidResponse = {
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject missing type field", () => {
      const invalidResponse = {
        errors: ["Error message"],
        title: "Bad Request",
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject missing title field", () => {
      const invalidResponse = {
        errors: ["Error message"],
        type: "/Errors/Bad Input",
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject missing statusCode field", () => {
      const invalidResponse = {
        errors: ["Error message"],
        type: "/Errors/Bad Input",
        title: "Bad Request",
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject errors field that is not an array", () => {
      const invalidResponse = {
        errors: "not an array",
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject errors array with non-string elements", () => {
      const invalidResponse = {
        errors: ["Error 1", 123, "Error 2"],
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject type field that is not a string", () => {
      const invalidResponse = {
        errors: ["Error message"],
        type: 123,
        title: "Bad Request",
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject title field that is not a string", () => {
      const invalidResponse = {
        errors: ["Error message"],
        type: "/Errors/Bad Input",
        title: 123,
        statusCode: 400,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject statusCode that is not a number", () => {
      const invalidResponse = {
        errors: ["Error message"],
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: "400",
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });

    it("should reject instance field that is not a string", () => {
      const invalidResponse = {
        errors: ["Error message"],
        type: "/Errors/Bad Input",
        title: "Bad Request",
        statusCode: 400,
        instance: 123,
      };

      expect(isErrorResponse(invalidResponse)).toBe(false);
    });
  });
});

describe("MisoClientError", () => {
  describe("constructor with ErrorResponse", () => {
    it("should create error with ErrorResponse and use title as message", () => {
      const errorResponse: ErrorResponse = {
        errors: ["Validation failed"],
        type: "/Errors/Validation Error",
        title: "Validation Failed",
        statusCode: 422,
        instance: "/api/users",
      };

      const error = new MisoClientError("Fallback message", errorResponse);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(MisoClientError);
      expect(error.name).toBe("MisoClientError");
      expect(error.message).toBe("Validation Failed");
      expect(error.errorResponse).toEqual(errorResponse);
      expect(error.statusCode).toBe(422);
      expect(error.errorBody).toBeUndefined();
    });

    it("should use first error from errors array if title is empty", () => {
      const errorResponse: ErrorResponse = {
        errors: ["First error", "Second error"],
        type: "/Errors/Validation Error",
        title: "",
        statusCode: 422,
      };

      const error = new MisoClientError("Fallback message", errorResponse);

      expect(error.message).toBe("First error");
    });

    it("should use first error from errors array if title is missing", () => {
      const errorResponse: ErrorResponse = {
        errors: ["First error", "Second error"],
        type: "/Errors/Validation Error",
        title: "",
        statusCode: 422,
      };

      const error = new MisoClientError("Fallback message", errorResponse);

      expect(error.message).toBe("First error");
    });
  });

  describe("constructor with errorBody (backward compatibility)", () => {
    it("should create error with errorBody only", () => {
      const errorBody = {
        error: "Something went wrong",
        details: "Additional details",
      };

      const error = new MisoClientError(
        "Request failed",
        undefined,
        errorBody,
        500,
      );

      expect(error.message).toBe("Request failed");
      expect(error.errorResponse).toBeUndefined();
      expect(error.errorBody).toEqual(errorBody);
      expect(error.statusCode).toBe(500);
    });
  });

  describe("constructor with both ErrorResponse and errorBody", () => {
    it("should prioritize ErrorResponse but keep errorBody", () => {
      const errorResponse: ErrorResponse = {
        errors: ["Validation error"],
        type: "/Errors/Validation Error",
        title: "Validation Failed",
        statusCode: 422,
      };

      const errorBody = {
        error: "Legacy error format",
        details: "Additional details",
      };

      const error = new MisoClientError("Fallback", errorResponse, errorBody);

      expect(error.message).toBe("Validation Failed");
      expect(error.errorResponse).toEqual(errorResponse);
      expect(error.errorBody).toEqual(errorBody);
      expect(error.statusCode).toBe(422);
    });
  });

  describe("message generation priority", () => {
    it("should prioritize ErrorResponse.title over message", () => {
      const errorResponse: ErrorResponse = {
        errors: ["Error"],
        type: "/Errors/Test",
        title: "Error Title",
        statusCode: 400,
      };

      const error = new MisoClientError("Custom message", errorResponse);

      expect(error.message).toBe("Error Title");
    });

    it("should use first error from errors array if title is empty", () => {
      const errorResponse: ErrorResponse = {
        errors: ["First error"],
        type: "/Errors/Test",
        title: "",
        statusCode: 400,
      };

      const error = new MisoClientError("Custom message", errorResponse);

      expect(error.message).toBe("First error");
    });

    it("should fall back to provided message if no ErrorResponse", () => {
      const error = new MisoClientError("Custom message");

      expect(error.message).toBe("Custom message");
      expect(error.errorResponse).toBeUndefined();
    });
  });

  describe("status code handling", () => {
    it("should use statusCode from ErrorResponse when provided", () => {
      const errorResponse: ErrorResponse = {
        errors: ["Error"],
        type: "/Errors/Test",
        title: "Error",
        statusCode: 404,
      };

      const error = new MisoClientError("Message", errorResponse);

      expect(error.statusCode).toBe(404);
    });

    it("should use statusCode parameter when provided separately", () => {
      const errorResponse: ErrorResponse = {
        errors: ["Error"],
        type: "/Errors/Test",
        title: "Error",
        statusCode: 404,
      };

      const error = new MisoClientError(
        "Message",
        errorResponse,
        undefined,
        500,
      );

      expect(error.statusCode).toBe(500);
    });

    it("should use statusCode parameter when no ErrorResponse", () => {
      const error = new MisoClientError("Message", undefined, undefined, 403);

      expect(error.statusCode).toBe(403);
    });
  });

  describe("stack trace", () => {
    it("should have stack trace", () => {
      const error = new MisoClientError("Test error");

      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe("string");
    });
  });
});
