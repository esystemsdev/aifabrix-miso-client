/**
 * Unit tests for origin-validator
 */

import { validateOrigin, OriginValidationResult } from "../../src/utils/origin-validator";
import { Request } from "express";

describe("origin-validator", () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {
      headers: {},
      ip: "127.0.0.1",
      socket: {
        remoteAddress: "127.0.0.1",
      },
    } as Partial<Request>;
  });

  describe("validateOrigin", () => {
    it("should return valid when no allowed origins configured (backward compatibility)", () => {
      const result = validateOrigin(mockRequest as Request, undefined);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return valid when allowed origins is empty array", () => {
      const result = validateOrigin(mockRequest as Request, []);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid when origin header is missing", () => {
      mockRequest.headers = {};
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Missing origin header");
    });

    it("should validate exact origin match", () => {
      mockRequest.headers = {
        origin: "http://localhost:3000",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should validate case-insensitive origin match", () => {
      mockRequest.headers = {
        origin: "HTTP://LOCALHOST:3000",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should validate origin with trailing slash", () => {
      mockRequest.headers = {
        origin: "http://localhost:3000/",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should reject origin that does not match", () => {
      mockRequest.headers = {
        origin: "http://localhost:3000",
      };
      const result = validateOrigin(mockRequest as Request, [
        "https://example.com",
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should validate wildcard port pattern", () => {
      mockRequest.headers = {
        origin: "http://localhost:3000",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:*",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should validate wildcard port with different ports", () => {
      mockRequest.headers = {
        origin: "http://localhost:8080",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:*",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should validate wildcard port with default HTTP port", () => {
      mockRequest.headers = {
        origin: "http://localhost",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:*",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should reject wildcard port when protocol differs", () => {
      mockRequest.headers = {
        origin: "https://localhost:3000",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:*",
      ]);
      expect(result.valid).toBe(false);
    });

    it("should reject wildcard port when hostname differs", () => {
      mockRequest.headers = {
        origin: "http://example.com:3000",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:*",
      ]);
      expect(result.valid).toBe(false);
    });

    it("should use referer header when origin is missing", () => {
      mockRequest.headers = {
        referer: "http://localhost:3000/page",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should prefer origin header over referer", () => {
      mockRequest.headers = {
        origin: "http://localhost:3000",
        referer: "http://evil.com/page",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should handle multiple allowed origins", () => {
      mockRequest.headers = {
        origin: "https://example.com",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
        "https://example.com",
        "http://localhost:*",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should reject when origin matches none of the allowed origins", () => {
      mockRequest.headers = {
        origin: "http://evil.com",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
        "https://example.com",
      ]);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("not allowed");
    });

    it("should handle HTTPS origins", () => {
      mockRequest.headers = {
        origin: "https://example.com",
      };
      const result = validateOrigin(mockRequest as Request, [
        "https://example.com",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should handle origins with paths in referer", () => {
      mockRequest.headers = {
        origin: "https://example.com",
        referer: "https://example.com/api/users?page=1",
      };
      const result = validateOrigin(mockRequest as Request, [
        "https://example.com",
      ]);
      expect(result.valid).toBe(true);
    });

    it("should handle invalid referer URL gracefully", () => {
      mockRequest.headers = {
        referer: "not-a-valid-url",
      };
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      // Should fail validation since referer is not a valid URL
      expect(result.valid).toBe(false);
    });

    it("should handle referer as array (Express behavior)", () => {
      mockRequest.headers = {
        referer: ["http://localhost:3000/page"],
      } as any;
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      // Should extract origin from array referer
      expect(result.valid).toBe(true);
    });

    it("should handle origin as array (Express behavior)", () => {
      mockRequest.headers = {
        origin: ["http://localhost:3000"],
      } as any;
      const result = validateOrigin(mockRequest as Request, [
        "http://localhost:3000",
      ]);
      // Should extract first element from array
      expect(result.valid).toBe(true);
    });
  });
});
