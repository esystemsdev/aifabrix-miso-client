/**
 * Unit tests for http-error-handler.ts
 * Tests detectAuthMethodFromHeaders, parseErrorResponse, and createMisoClientError
 */

import { AxiosError } from "axios";
import {
  detectAuthMethodFromHeaders,
  parseErrorResponse,
  createMisoClientError,
  isAxiosError,
} from "../../src/utils/http-error-handler";
import { MisoClientError } from "../../src/utils/errors";

describe("http-error-handler", () => {
  describe("detectAuthMethodFromHeaders", () => {
    it("should return 'bearer' when Authorization header is present", () => {
      const headers = { Authorization: "Bearer token123" };
      expect(detectAuthMethodFromHeaders(headers)).toBe("bearer");
    });

    it("should return 'client-token' when x-client-token header is present", () => {
      const headers = { "x-client-token": "client-token-123" };
      expect(detectAuthMethodFromHeaders(headers)).toBe("client-token");
    });

    it("should return 'client-credentials' when x-client-id header is present", () => {
      const headers = { "x-client-id": "client-id-123" };
      expect(detectAuthMethodFromHeaders(headers)).toBe("client-credentials");
    });

    it("should return null when no auth headers are present", () => {
      const headers = { "Content-Type": "application/json" };
      expect(detectAuthMethodFromHeaders(headers)).toBeNull();
    });

    it("should return null when headers is undefined", () => {
      expect(detectAuthMethodFromHeaders(undefined)).toBeNull();
    });

    it("should return null when headers is empty object", () => {
      expect(detectAuthMethodFromHeaders({})).toBeNull();
    });

    it("should prioritize Authorization header over x-client-token", () => {
      const headers = {
        Authorization: "Bearer token123",
        "x-client-token": "client-token-123",
      };
      expect(detectAuthMethodFromHeaders(headers)).toBe("bearer");
    });

    it("should prioritize x-client-token over x-client-id", () => {
      const headers = {
        "x-client-token": "client-token-123",
        "x-client-id": "client-id-123",
      };
      expect(detectAuthMethodFromHeaders(headers)).toBe("client-token");
    });
  });

  describe("parseErrorResponse with authMethod", () => {
    it("should extract authMethod from error response data", () => {
      const error = {
        config: { url: "/test", headers: {} },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        toJSON: jest.fn(),
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
            authMethod: "bearer",
          },
          headers: {},
          config: {} as any,
        },
      } as unknown as AxiosError;

      const result = parseErrorResponse(error, "/test");
      expect(result).toBeDefined();
      expect(result?.authMethod).toBe("bearer");
    });

    it("should extract authMethod 'client-credentials' from error response", () => {
      const error = {
        config: { url: "/api/v1/auth/token", headers: {} },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        toJSON: jest.fn(),
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid client credentials"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
            authMethod: "client-credentials",
          },
          headers: {},
          config: {} as any,
        },
      } as unknown as AxiosError;

      const result = parseErrorResponse(error, "/api/v1/auth/token");
      expect(result).toBeDefined();
      expect(result?.authMethod).toBe("client-credentials");
    });

    it("should return undefined authMethod when not present in response", () => {
      const error = {
        config: { url: "/test", headers: {} },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        toJSON: jest.fn(),
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
          },
          headers: {},
          config: {} as any,
        },
      } as unknown as AxiosError;

      const result = parseErrorResponse(error, "/test");
      expect(result).toBeDefined();
      expect(result?.authMethod).toBeUndefined();
    });

    it("should parse authMethod from JSON string response", () => {
      const error: AxiosError = {
        config: { url: "/test" },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: JSON.stringify({
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
            authMethod: "client-token",
          }),
          headers: {},
          config: {} as any,
        },
      } as AxiosError;

      const result = parseErrorResponse(error, "/test");
      expect(result).toBeDefined();
      expect(result?.authMethod).toBe("client-token");
    });
  });

  describe("createMisoClientError with authMethod", () => {
    it("should set authMethod from error response for 401 errors", () => {
      const error: AxiosError = {
        config: { url: "/test" },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
            authMethod: "bearer",
          },
          headers: {},
          config: {} as any,
        },
      } as AxiosError;

      const result = createMisoClientError(error, "/test");
      expect(result).toBeInstanceOf(MisoClientError);
      expect(result.authMethod).toBe("bearer");
      expect(result.statusCode).toBe(401);
    });

    it("should use fallback header detection when authMethod not in response", () => {
      const error: AxiosError = {
        config: {
          url: "/test",
          headers: { Authorization: "Bearer token123" },
        },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
            // No authMethod in response
          },
          headers: {},
          config: {} as any,
        },
      } as AxiosError;

      const result = createMisoClientError(error, "/test");
      expect(result).toBeInstanceOf(MisoClientError);
      expect(result.authMethod).toBe("bearer");
    });

    it("should detect client-token from headers when authMethod not in response", () => {
      const error = {
        config: {
          url: "/test",
          headers: { "x-client-token": "client-token-123" },
        },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        toJSON: jest.fn(),
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid client token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
          },
          headers: {},
          config: {} as any,
        },
      } as unknown as AxiosError;

      const result = createMisoClientError(error, "/test");
      expect(result).toBeInstanceOf(MisoClientError);
      expect(result.authMethod).toBe("client-token");
    });

    it("should detect client-credentials from headers when authMethod not in response", () => {
      const error = {
        config: {
          url: "/api/v1/auth/token",
          headers: { "x-client-id": "client-id-123" },
        },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        toJSON: jest.fn(),
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid client credentials"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
          },
          headers: {},
          config: {} as any,
        },
      } as unknown as AxiosError;

      const result = createMisoClientError(error, "/api/v1/auth/token");
      expect(result).toBeInstanceOf(MisoClientError);
      expect(result.authMethod).toBe("client-credentials");
    });

    it("should return null authMethod when no auth headers and not 401", () => {
      const error: AxiosError = {
        config: { url: "/test" },
        message: "Bad Request",
        name: "AxiosError",
        isAxiosError: true,
        response: {
          status: 400,
          statusText: "Bad Request",
          data: {
            errors: ["Validation failed"],
            type: "/Errors/BadRequest",
            title: "Bad Request",
            statusCode: 400,
          },
          headers: {},
          config: {} as any,
        },
      } as AxiosError;

      const result = createMisoClientError(error, "/test");
      expect(result).toBeInstanceOf(MisoClientError);
      expect(result.authMethod).toBeNull();
    });

    it("should return null authMethod for 401 with no auth headers and no response authMethod", () => {
      const error: AxiosError = {
        config: {
          url: "/test",
          headers: { "Content-Type": "application/json" },
        },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
          },
          headers: {},
          config: {} as any,
        },
      } as AxiosError;

      const result = createMisoClientError(error, "/test");
      expect(result).toBeInstanceOf(MisoClientError);
      expect(result.authMethod).toBeNull();
    });

    it("should prefer authMethod from response over header detection", () => {
      const error: AxiosError = {
        config: {
          url: "/test",
          headers: { Authorization: "Bearer token123" },
        },
        message: "Unauthorized",
        name: "AxiosError",
        isAxiosError: true,
        response: {
          status: 401,
          statusText: "Unauthorized",
          data: {
            errors: ["Invalid token"],
            type: "/Errors/Unauthorized",
            title: "Unauthorized",
            statusCode: 401,
            authMethod: "client-credentials", // Different from header
          },
          headers: {},
          config: {} as any,
        },
      } as AxiosError;

      const result = createMisoClientError(error, "/test");
      expect(result).toBeInstanceOf(MisoClientError);
      // Should use authMethod from response, not from header detection
      expect(result.authMethod).toBe("client-credentials");
    });
  });

  describe("isAxiosError", () => {
    it("should detect AxiosError with isAxiosError property", () => {
      const error = {
        message: "Test error",
        isAxiosError: true,
      };
      expect(isAxiosError(error)).toBe(true);
    });

    it("should return false for regular Error", () => {
      const error = new Error("Test error");
      expect(isAxiosError(error)).toBe(false);
    });

    it("should return false for null", () => {
      expect(isAxiosError(null)).toBe(false);
    });

    it("should return false for undefined", () => {
      expect(isAxiosError(undefined)).toBe(false);
    });

    it("should return false for object without isAxiosError", () => {
      const error = { message: "Test error" };
      expect(isAxiosError(error)).toBe(false);
    });

    it("should return false for object with isAxiosError: false", () => {
      const error = { message: "Test error", isAxiosError: false };
      expect(isAxiosError(error)).toBe(false);
    });
  });
});
