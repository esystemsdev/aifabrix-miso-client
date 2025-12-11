/**
 * Unit tests for Response Middleware (injectResponseHelpers)
 */

import { Request, Response, NextFunction } from "express";
import { injectResponseHelpers } from "../../src/express/response-middleware";
import { ResponseHelper, PaginationMeta } from "../../src/express/response-helper";

// Mock ResponseHelper
jest.mock("../../src/express/response-helper");

describe("injectResponseHelpers", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response> & {
    success?: <T>(data: T, message?: string) => Response;
    created?: <T>(data: T, message?: string) => Response;
    paginated?: <T>(items: T[], meta: PaginationMeta) => Response;
    noContent?: () => Response;
    accepted?: <T>(data?: T, message?: string) => Response;
  };
  let mockNext: jest.Mock;
  let statusSpy: jest.Mock;
  let jsonSpy: jest.Mock;
  let sendSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn().mockReturnThis();
    sendSpy = jest.fn().mockReturnThis();
    statusSpy = jest.fn().mockReturnThis();

    mockReq = {};
    mockRes = {
      status: statusSpy,
      json: jsonSpy,
      send: sendSpy,
    };
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    (ResponseHelper.success as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockRes as Response);
    (ResponseHelper.created as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockRes as Response);
    (ResponseHelper.paginated as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockRes as Response);
    (ResponseHelper.noContent as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockRes as Response);
    (ResponseHelper.accepted as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockRes as Response);
  });

  describe("middleware injection", () => {
    it("should inject all helper methods into response object", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockRes.success).toBeDefined();
      expect(mockRes.created).toBeDefined();
      expect(mockRes.paginated).toBeDefined();
      expect(mockRes.noContent).toBeDefined();
      expect(mockRes.accepted).toBeDefined();
    });

    it("should call next() after injecting helpers", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      expect(mockNext).toHaveBeenCalledTimes(1);
      expect(mockNext).toHaveBeenCalledWith();
    });
  });

  describe("injected success() method", () => {
    it("should call ResponseHelper.success with correct parameters", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const data = { id: 1, name: "Test" };
      const message = "Success message";

      mockRes.success!(data, message);

      expect(ResponseHelper.success).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.success).toHaveBeenCalledWith(
        mockRes,
        data,
        message,
      );
    });

    it("should work without message parameter", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const data = { id: 1 };

      mockRes.success!(data);

      expect(ResponseHelper.success).toHaveBeenCalledWith(
        mockRes,
        data,
        undefined,
      );
    });

    it("should handle null data", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      mockRes.success!(null);

      expect(ResponseHelper.success).toHaveBeenCalledWith(
        mockRes,
        null,
        undefined,
      );
    });

    it("should handle array data", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const data = [1, 2, 3];

      mockRes.success!(data);

      expect(ResponseHelper.success).toHaveBeenCalledWith(
        mockRes,
        data,
        undefined,
      );
    });
  });

  describe("injected created() method", () => {
    it("should call ResponseHelper.created with correct parameters", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const data = { id: 1, name: "New Resource" };
      const message = "Resource created successfully";

      mockRes.created!(data, message);

      expect(ResponseHelper.created).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.created).toHaveBeenCalledWith(
        mockRes,
        data,
        message,
      );
    });

    it("should work without message parameter", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const data = { id: 1 };

      mockRes.created!(data);

      expect(ResponseHelper.created).toHaveBeenCalledWith(
        mockRes,
        data,
        undefined,
      );
    });
  });

  describe("injected paginated() method", () => {
    it("should call ResponseHelper.paginated with correct parameters", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const items = [{ id: 1 }, { id: 2 }];
      const meta: PaginationMeta = {
        currentPage: 1,
        pageSize: 10,
        totalItems: 2,
        type: "user",
      };

      mockRes.paginated!(items, meta);

      expect(ResponseHelper.paginated).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.paginated).toHaveBeenCalledWith(
        mockRes,
        items,
        meta,
      );
    });

    it("should handle empty array", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const items: unknown[] = [];
      const meta: PaginationMeta = {
        currentPage: 1,
        pageSize: 10,
        totalItems: 0,
        type: "user",
      };

      mockRes.paginated!(items, meta);

      expect(ResponseHelper.paginated).toHaveBeenCalledWith(
        mockRes,
        items,
        meta,
      );
    });
  });

  describe("injected noContent() method", () => {
    it("should call ResponseHelper.noContent", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      mockRes.noContent!();

      expect(ResponseHelper.noContent).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.noContent).toHaveBeenCalledWith(mockRes);
    });
  });

  describe("injected accepted() method", () => {
    it("should call ResponseHelper.accepted with correct parameters", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const data = { jobId: "123" };
      const message = "Job queued";

      mockRes.accepted!(data, message);

      expect(ResponseHelper.accepted).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.accepted).toHaveBeenCalledWith(
        mockRes,
        data,
        message,
      );
    });

    it("should work without data parameter", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      const message = "Request accepted";

      mockRes.accepted!(undefined, message);

      expect(ResponseHelper.accepted).toHaveBeenCalledWith(
        mockRes,
        undefined,
        message,
      );
    });

    it("should work without any parameters", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      mockRes.accepted!();

      expect(ResponseHelper.accepted).toHaveBeenCalledWith(
        mockRes,
        undefined,
        undefined,
      );
    });
  });

  describe("multiple calls", () => {
    it("should allow multiple calls to injected methods", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      mockRes.success!({ id: 1 });
      mockRes.success!({ id: 2 });

      expect(ResponseHelper.success).toHaveBeenCalledTimes(2);
    });

    it("should allow calling different methods in sequence", () => {
      injectResponseHelpers(
        mockReq as Request,
        mockRes as Response,
        mockNext,
      );

      mockRes.success!({ id: 1 });
      mockRes.created!({ id: 2 });
      mockRes.noContent!();

      expect(ResponseHelper.success).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.created).toHaveBeenCalledTimes(1);
      expect(ResponseHelper.noContent).toHaveBeenCalledTimes(1);
    });
  });
});

