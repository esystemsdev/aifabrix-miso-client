/**
 * Unit tests for HttpClient filter builder and pagination helpers
 */

import { HttpClient } from "../../src/utils/http-client";
import { InternalHttpClient } from "../../src/utils/internal-http-client";
import { LoggerService } from "../../src/services/logger.service";
import { MisoClientConfig } from "../../src/types/config.types";
import { FilterBuilder } from "../../src/utils/filter.utils";

// Mock dependencies
jest.mock("../../src/utils/internal-http-client");
jest.mock("../../src/services/logger.service");
jest.mock("jsonwebtoken");

describe("HttpClient filter and pagination helpers", () => {
  let httpClient: HttpClient;
  let mockInternalClient: jest.Mocked<InternalHttpClient>;
  let mockLogger: jest.Mocked<LoggerService>;
  const config: MisoClientConfig = {
    controllerUrl: "https://controller.aifabrix.ai",
    clientId: "test-client",
    clientSecret: "test-secret",
  };

  beforeEach(() => {
    // Create mock axios instance
    const mockAxiosInstance = {
      interceptors: {
        request: {
          use: jest.fn(),
        },
        response: {
          use: jest.fn(),
        },
      },
    };

    // Create mock InternalHttpClient
    mockInternalClient = {
      get: jest.fn(),
      getAxiosInstance: jest.fn().mockReturnValue(mockAxiosInstance),
    } as any;

    // Create mock LoggerService
    mockLogger = {
      audit: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Mock InternalHttpClient constructor
    (InternalHttpClient as jest.Mock).mockImplementation(
      () => mockInternalClient,
    );

    // Mock LoggerService constructor
    (LoggerService as unknown as jest.Mock).mockImplementation(
      () => mockLogger,
    );

    httpClient = new HttpClient(config, mockLogger);
  });

  describe("getWithFilters", () => {
    it("should call get with query string from FilterBuilder", async () => {
      const filterBuilder = new FilterBuilder()
        .add("status", "eq", "active")
        .add("region", "in", ["eu", "us"]);

      const mockResponse = { data: [{ id: 1 }] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      const result = await httpClient.getWithFilters(
        "/api/applications",
        filterBuilder,
      );

      // FilterBuilder now uses JSON format, URL-encoded
      // Expected: {"status":{"eq":"active"},"region":{"in":["eu","us"]}}
      // URL-encoded: %7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%2C%22region%22%3A%7B%22in%22%3A%5B%22eu%22%2C%22us%22%5D%7D%7D
      const calledUrl = (mockInternalClient.get as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain("/api/applications?filter=");
      expect(calledUrl).toContain("%22status%22"); // "status"
      expect(calledUrl).toContain("%22eq%22"); // "eq"
      expect(calledUrl).toContain("%22active%22"); // "active"
      expect(calledUrl).toContain("%22region%22"); // "region"
      expect(calledUrl).toContain("%22in%22"); // "in"
      expect(result).toEqual(mockResponse);
    });

    it("should call get with empty FilterBuilder (no filters)", async () => {
      const filterBuilder = new FilterBuilder();

      const mockResponse = { data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      const result = await httpClient.getWithFilters(
        "/api/applications",
        filterBuilder,
      );

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/api/applications",
        undefined,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should pass config parameter to get", async () => {
      const filterBuilder = new FilterBuilder().add("status", "eq", "active");
      const requestConfig = { timeout: 5000 };

      const mockResponse = { data: [{ id: 1 }] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getWithFilters(
        "/api/applications",
        filterBuilder,
        requestConfig,
      );

      // FilterBuilder now uses JSON format, URL-encoded
      // Expected: {"status":{"eq":"active"}}
      // URL-encoded: %7B%22status%22%3A%7B%22eq%22%3A%22active%22%7D%7D
      const calledUrl = (mockInternalClient.get as jest.Mock).mock.calls[0][0];
      expect(calledUrl).toContain("/api/applications?filter=");
      expect(calledUrl).toContain("%22status%22"); // "status"
      expect(calledUrl).toContain("%22eq%22"); // "eq"
      expect(calledUrl).toContain("%22active%22"); // "active"
      expect(mockInternalClient.get).toHaveBeenCalledWith(
        expect.stringContaining("/api/applications?filter="),
        requestConfig,
      );
    });

    it("should handle FilterBuilder with multiple filters", async () => {
      const filterBuilder = new FilterBuilder()
        .add("status", "eq", "active")
        .add("age", "gte", 18)
        .add("region", "in", ["eu", "us", "uk"]);

      const mockResponse = { data: [{ id: 1 }] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getWithFilters("/api/users", filterBuilder);

      const calledUrl = (mockInternalClient.get as jest.Mock).mock.calls[0][0];
      // FilterBuilder now uses JSON format, URL-encoded
      // Expected: {"status":{"eq":"active"},"age":{"gte":18},"region":{"in":["eu","us","uk"]}}
      expect(calledUrl).toContain("/api/users?filter=");
      expect(calledUrl).toContain("%22status%22"); // "status"
      expect(calledUrl).toContain("%22eq%22"); // "eq"
      expect(calledUrl).toContain("%22active%22"); // "active"
      expect(calledUrl).toContain("%22age%22"); // "age"
      expect(calledUrl).toContain("%22gte%22"); // "gte"
      expect(calledUrl).toContain("18"); // 18 (number, not string)
      expect(calledUrl).toContain("%22region%22"); // "region"
      expect(calledUrl).toContain("%22in%22"); // "in"
    });

    it("should handle errors from InternalHttpClient", async () => {
      const filterBuilder = new FilterBuilder().add("status", "eq", "active");
      const error = new Error("Network error");
      mockInternalClient.get.mockRejectedValue(error);

      await expect(
        httpClient.getWithFilters("/api/applications", filterBuilder),
      ).rejects.toThrow("Network error");
    });
  });

  describe("getPaginated", () => {
    it("should call get with pagination query parameters", async () => {
      const pagination = { page: 1, pageSize: 25 };
      const mockResponse = {
        meta: { totalItems: 100, currentPage: 1, pageSize: 25, type: "item" },
        data: [{ id: 1 }],
      };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      const result = await httpClient.getPaginated(
        "/api/applications",
        pagination,
      );

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/api/applications?page=1&page_size=25",
        undefined,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle different page numbers", async () => {
      const pagination = { page: 3, pageSize: 50 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated("/api/applications", pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/api/applications?page=3&page_size=50",
        undefined,
      );
    });

    it("should pass config parameter to get", async () => {
      const pagination = { page: 2, pageSize: 10 };
      const requestConfig = { timeout: 5000 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated(
        "/api/applications",
        pagination,
        requestConfig,
      );

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/api/applications?page=2&page_size=10",
        requestConfig,
      );
    });

    it("should handle large page sizes", async () => {
      const pagination = { page: 1, pageSize: 1000 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated("/api/applications", pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/api/applications?page=1&page_size=1000",
        undefined,
      );
    });

    it("should handle errors from InternalHttpClient", async () => {
      const pagination = { page: 1, pageSize: 25 };
      const error = new Error("Network error");
      mockInternalClient.get.mockRejectedValue(error);

      await expect(
        httpClient.getPaginated("/api/applications", pagination),
      ).rejects.toThrow("Network error");
    });

    it("should handle page 0 (edge case)", async () => {
      const pagination = { page: 0, pageSize: 25 };
      const mockResponse = { meta: {}, data: [] };
      mockInternalClient.get.mockResolvedValue(mockResponse);

      await httpClient.getPaginated("/api/applications", pagination);

      expect(mockInternalClient.get).toHaveBeenCalledWith(
        "/api/applications?page=0&page_size=25",
        undefined,
      );
    });
  });
});
