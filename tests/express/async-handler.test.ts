/**
 * Unit tests for asyncHandler
 */

import { Request, Response, NextFunction } from "express";
import {
  asyncHandler,
  asyncHandlerNamed,
} from "../../src/express/async-handler";
import { handleRouteError } from "../../src/express/error-handler";

// Mock handleRouteError
jest.mock("../../src/express/error-handler");

describe("asyncHandler", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      method: "GET",
      path: "/test",
      route: {
        path: "/test",
      } as never,
    };
    mockRes = {};
    mockNext = jest.fn();

    jest.clearAllMocks();
  });

  describe("asyncHandler()", () => {
    it("should execute async function successfully", async () => {
      const fn = jest.fn().mockResolvedValue(undefined);
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(fn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(handleRouteError).not.toHaveBeenCalled();
    });

    it("should catch and handle errors", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        "GET /test",
      );
    });

    it("should use custom operation name if provided", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn, "customOperation");

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        "customOperation",
      );
    });

    it("should extract operation name from route path", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn);

      mockReq.method = "POST";
      mockReq.route = { path: "/users/:id" } as never;

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        "POST /users/:id",
      );
    });

    it("should fallback to req.path if route.path is not available", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn);

      const reqWithoutRoute = {
        method: "GET",
        path: "/actual/path",
      } as Request;

      await handler(reqWithoutRoute, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        reqWithoutRoute,
        mockRes,
        "GET /actual/path",
      );
    });

    it("should handle synchronous errors", async () => {
      const error = new Error("Sync error");
      const fn = jest.fn().mockImplementation(() => {
        throw error;
      });
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        expect.any(String),
      );
    });

    it("should pass through all arguments to handler function", async () => {
      const fn = jest.fn().mockResolvedValue(undefined);
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(fn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("should handle string errors", async () => {
      const error = "String error message";
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        expect.any(String),
      );
    });

    it("should handle null errors", async () => {
      const fn = jest.fn().mockRejectedValue(null);
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        null,
        mockReq,
        mockRes,
        expect.any(String),
      );
    });

    it("should handle errors with custom properties", async () => {
      const error = new Error("Custom error");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (error as any).customProp = "customValue";
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        expect.any(String),
      );
    });
  });

  describe("asyncHandlerNamed()", () => {
    it("should use provided operation name", async () => {
      const error = new Error("Test error");
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandlerNamed("getUserById", fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        "getUserById",
      );
    });

    it("should execute function successfully", async () => {
      const fn = jest.fn().mockResolvedValue(undefined);
      const handler = asyncHandlerNamed("testOperation", fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(fn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
      expect(handleRouteError).not.toHaveBeenCalled();
    });

    it("should pass all arguments correctly", async () => {
      const fn = jest.fn().mockResolvedValue(undefined);
      const handler = asyncHandlerNamed("myOperation", fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(fn).toHaveBeenCalledWith(mockReq, mockRes, mockNext);
    });

    it("should catch errors with named operation", async () => {
      const error = new Error("Named error");
      const fn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandlerNamed("createUser", fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        "createUser",
      );
    });
  });

  describe("Integration scenarios", () => {
    it("should work with multiple handlers in sequence", async () => {
      const fn1 = jest.fn().mockResolvedValue(undefined);
      const fn2 = jest.fn().mockResolvedValue(undefined);

      const handler1 = asyncHandler(fn1, "step1");
      const handler2 = asyncHandler(fn2, "step2");

      await handler1(mockReq as Request, mockRes as Response, mockNext);
      await handler2(mockReq as Request, mockRes as Response, mockNext);

      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(handleRouteError).not.toHaveBeenCalled();
    });

    it("should handle promise chain errors", async () => {
      const error = new Error("Chain error");
      const fn = jest.fn().mockImplementation(async () => {
        await Promise.resolve();
        throw error;
      });
      const handler = asyncHandler(fn);

      await handler(mockReq as Request, mockRes as Response, mockNext);

      expect(handleRouteError).toHaveBeenCalledWith(
        error,
        mockReq,
        mockRes,
        expect.any(String),
      );
    });
  });
});
