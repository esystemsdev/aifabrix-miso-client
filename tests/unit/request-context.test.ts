/**
 * Unit tests for request-context utility
 */

import { extractRequestContext, RequestContext } from "../../src/utils/request-context";
import { Request } from "express";

// Mock jsonwebtoken
jest.mock("jsonwebtoken");
const jwt = require("jsonwebtoken");

describe("request-context", () => {
  let mockRequest: Partial<Request>;

  beforeEach(() => {
    mockRequest = {
      method: "GET",
      path: "/api/users",
      originalUrl: "/api/users",
      ip: "127.0.0.1",
      headers: {},
      socket: {
        remoteAddress: "127.0.0.1",
      },
    } as Partial<Request>;
    jest.clearAllMocks();
  });

  describe("extractRequestContext", () => {
    it("should extract basic request fields", () => {
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.method).toBe("GET");
      expect(ctx.path).toBe("/api/users");
      expect(ctx.ipAddress).toBe("127.0.0.1");
    });

    it("should extract user-agent from headers", () => {
      mockRequest.headers = {
        "user-agent": "Mozilla/5.0",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.userAgent).toBe("Mozilla/5.0");
    });

    it("should extract correlation ID from x-correlation-id header", () => {
      mockRequest.headers = {
        "x-correlation-id": "corr-123",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.correlationId).toBe("corr-123");
    });

    it("should extract correlation ID from x-request-id header when x-correlation-id is missing", () => {
      mockRequest.headers = {
        "x-request-id": "req-456",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.correlationId).toBe("req-456");
      expect(ctx.requestId).toBe("req-456");
    });

    it("should extract correlation ID from request-id header when others are missing", () => {
      mockRequest.headers = {
        "request-id": "req-789",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.correlationId).toBe("req-789");
    });

    it("should extract referer from headers", () => {
      mockRequest.headers = {
        referer: "https://example.com/page",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.referer).toBe("https://example.com/page");
    });

    it("should extract request size from content-length header", () => {
      mockRequest.headers = {
        "content-length": "1024",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.requestSize).toBe(1024);
    });

    it("should handle missing content-length gracefully", () => {
      mockRequest.headers = {};
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.requestSize).toBeUndefined();
    });

    it("should extract IP from req.ip", () => {
      mockRequest.ip = "192.168.1.1";
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.ipAddress).toBe("192.168.1.1");
    });

    it("should extract IP from x-forwarded-for header when req.ip is missing", () => {
      delete mockRequest.ip;
      mockRequest.headers = {
        "x-forwarded-for": "192.168.1.1, 10.0.0.1",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.ipAddress).toBe("192.168.1.1");
    });

    it("should handle x-forwarded-for with single IP", () => {
      delete mockRequest.ip;
      mockRequest.headers = {
        "x-forwarded-for": "192.168.1.1",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.ipAddress).toBe("192.168.1.1");
    });

    it("should extract IP from socket.remoteAddress when other sources are missing", () => {
      delete mockRequest.ip;
      mockRequest.headers = {};
      mockRequest.socket = {
        remoteAddress: "10.0.0.1",
      };
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.ipAddress).toBe("10.0.0.1");
    });

    it("should use originalUrl over path when both are present", () => {
      mockRequest.originalUrl = "/api/v2/users";
      mockRequest.path = "/api/users";
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.path).toBe("/api/v2/users");
    });

    it("should use path when originalUrl is missing", () => {
      delete mockRequest.originalUrl;
      mockRequest.path = "/api/users";
      const ctx = extractRequestContext(mockRequest as Request);

      expect(ctx.path).toBe("/api/users");
    });

    describe("JWT extraction", () => {
      it("should extract userId from Bearer token", () => {
        jwt.decode.mockReturnValue({
          sub: "user-123",
        });
        mockRequest.headers = {
          authorization: "Bearer valid-token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBe("user-123");
        expect(jwt.decode).toHaveBeenCalledWith("valid-token");
      });

      it("should extract userId from sub claim", () => {
        jwt.decode.mockReturnValue({
          sub: "user-456",
        });
        mockRequest.headers = {
          authorization: "Bearer token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBe("user-456");
      });

      it("should extract userId from userId claim when sub is missing", () => {
        jwt.decode.mockReturnValue({
          userId: "user-789",
        });
        mockRequest.headers = {
          authorization: "Bearer token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBe("user-789");
      });

      it("should extract userId from user_id claim when others are missing", () => {
        jwt.decode.mockReturnValue({
          user_id: "user-abc",
        });
        mockRequest.headers = {
          authorization: "Bearer token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBe("user-abc");
      });

      it("should extract userId from id claim when others are missing", () => {
        jwt.decode.mockReturnValue({
          id: "user-xyz",
        });
        mockRequest.headers = {
          authorization: "Bearer token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBe("user-xyz");
      });

      it("should extract sessionId from sessionId claim", () => {
        jwt.decode.mockReturnValue({
          sub: "user-123",
          sessionId: "session-456",
        });
        mockRequest.headers = {
          authorization: "Bearer token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.sessionId).toBe("session-456");
      });

      it("should extract sessionId from sid claim when sessionId is missing", () => {
        jwt.decode.mockReturnValue({
          sub: "user-123",
          sid: "session-789",
        });
        mockRequest.headers = {
          authorization: "Bearer token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.sessionId).toBe("session-789");
      });

      it("should not extract user info when Authorization header is missing", () => {
        mockRequest.headers = {};
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBeUndefined();
        expect(ctx.sessionId).toBeUndefined();
        expect(jwt.decode).not.toHaveBeenCalled();
      });

      it("should not extract user info when Authorization header does not start with Bearer", () => {
        mockRequest.headers = {
          authorization: "Basic token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBeUndefined();
        expect(ctx.sessionId).toBeUndefined();
        expect(jwt.decode).not.toHaveBeenCalled();
      });

      it("should handle JWT decode returning null gracefully", () => {
        jwt.decode.mockReturnValue(null);
        mockRequest.headers = {
          authorization: "Bearer invalid-token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBeUndefined();
        expect(ctx.sessionId).toBeUndefined();
      });

      it("should handle JWT decode throwing error gracefully", () => {
        jwt.decode.mockImplementation(() => {
          throw new Error("Invalid token");
        });
        mockRequest.headers = {
          authorization: "Bearer invalid-token",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.userId).toBeUndefined();
        expect(ctx.sessionId).toBeUndefined();
      });

      it("should handle missing Bearer prefix in token extraction", () => {
        jwt.decode.mockReturnValue({
          sub: "user-123",
        });
        mockRequest.headers = {
          authorization: "Bearer token-without-space",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        // Should still extract token correctly
        expect(jwt.decode).toHaveBeenCalledWith("token-without-space");
      });
    });

    describe("edge cases", () => {
      it("should handle empty headers object", () => {
        mockRequest.headers = {};
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.method).toBe("GET");
        expect(ctx.path).toBe("/api/users");
        expect(ctx.ipAddress).toBe("127.0.0.1");
      });

      it("should handle undefined headers gracefully", () => {
        delete mockRequest.headers;
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.method).toBe("GET");
        expect(ctx.path).toBe("/api/users");
      });

      it("should handle x-forwarded-for with whitespace", () => {
        delete mockRequest.ip;
        mockRequest.headers = {
          "x-forwarded-for": "  192.168.1.1  ,  10.0.0.1  ",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.ipAddress).toBe("192.168.1.1");
      });

      it("should handle content-length as string", () => {
        mockRequest.headers = {
          "content-length": "2048",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.requestSize).toBe(2048);
      });

      it("should handle invalid content-length gracefully", () => {
        mockRequest.headers = {
          "content-length": "not-a-number",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.requestSize).toBeNaN();
      });
    });

    describe("RequestContext interface", () => {
      it("should return all fields when available", () => {
        jwt.decode.mockReturnValue({
          sub: "user-123",
          sessionId: "session-456",
        });
        mockRequest.headers = {
          authorization: "Bearer valid-token",
          "user-agent": "Mozilla/5.0",
          "x-correlation-id": "corr-123",
          "x-request-id": "req-456",
          referer: "https://example.com",
          "content-length": "1024",
        };
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx).toMatchObject({
          ipAddress: "127.0.0.1",
          method: "GET",
          path: "/api/users",
          userAgent: "Mozilla/5.0",
          correlationId: "corr-123",
          referer: "https://example.com",
          userId: "user-123",
          sessionId: "session-456",
          requestId: "req-456",
          requestSize: 1024,
        });
      });

      it("should return partial fields when some are missing", () => {
        mockRequest.headers = {};
        const ctx = extractRequestContext(mockRequest as Request);

        expect(ctx.method).toBe("GET");
        expect(ctx.path).toBe("/api/users");
        expect(ctx.ipAddress).toBe("127.0.0.1");
        expect(ctx.userAgent).toBeUndefined();
        expect(ctx.correlationId).toBeUndefined();
        expect(ctx.userId).toBeUndefined();
      });
    });
  });
});

